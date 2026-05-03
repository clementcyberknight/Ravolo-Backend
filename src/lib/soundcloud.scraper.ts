/**
 * SoundCloud scraper — 2025-compatible implementation.
 *
 * Key design decisions:
 * - Scans JS bundles in REVERSE order: client_id lives in the last bundles.
 * - Falls back to `window.__sc_hydration` extraction (faster, no JS parsing).
 * - Supports multiple client_id regex patterns for resilience.
 * - Resolves AAC HLS transcodings only (progressive MP3 / HLS MP3/Opus deprecated end-2025).
 * - Returns the transcoding *endpoint* URL (not the short-lived CDN URL) for storage.
 * - Auto-invalidates stale client_id on 401/403 responses.
 * - Exposes `getSoundCloudPlaybackUrl()` to resolve a fresh CDN URL on every playback request.
 */

import { logger } from "../infrastructure/logger/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SoundCloudTranscoding {
  url: string; // transcoding endpoint (stable, storable)
  preset: string; // e.g. "aac_160k", "aac_96k"
  format: {
    protocol: string; // "hls"
    mime_type: string; // "audio/ogg; codecs=\"opus\"" | "audio/mpeg" | "audio/mp4"
  };
  quality: string;
}

export interface SoundCloudTrack {
  id: number;
  title: string;
  permalink_url: string;
  artwork_url: string | null;
  user: { username: string; permalink_url: string };
  duration: number; // ms
  media?: { transcodings: SoundCloudTranscoding[] };
  // Legacy direct stream fields (deprecated 2025 — kept for type completeness only)
  stream_url?: string;
  hls_mp3_128_url?: string;
  hls_opus_64_url?: string;
}

export interface SoundCloudSearchResult {
  collection: SoundCloudTrack[];
  total_results: number;
  next_href: string | null;
}

export interface ResolvedPlaybackUrl {
  url: string; // short-lived CDN HLS playlist URL
  expiresApproxMs: number; // Date.now() + ~5 min
}

// ---------------------------------------------------------------------------
// In-process client_id cache
// ---------------------------------------------------------------------------

let cachedClientId: string | null = null;
let clientIdFetchedAtMs = 0;
/** Re-fetch client_id after 6 hours even if not invalidated. */
const CLIENT_ID_TTL_MS = 6 * 60 * 60 * 1000;

/** Invalidate the cached client_id (call on 401/403 from SoundCloud API). */
export function invalidateSoundCloudClientId(): void {
  logger.warn("[soundcloud] client_id invalidated — will re-fetch on next request");
  cachedClientId = null;
  clientIdFetchedAtMs = 0;
}

// ---------------------------------------------------------------------------
// client_id extraction
// ---------------------------------------------------------------------------

const CLIENT_ID_PATTERNS = [
  /client_id\s*[:=]\s*["']([a-zA-Z0-9_-]{20,40})["']/,
  /["']client_id["']\s*,\s*["']([a-zA-Z0-9_-]{20,40})["']/,
  /\bclient_id=([a-zA-Z0-9_-]{20,40})\b/,
  /\?client_id=([a-zA-Z0-9_-]{20,40})/,
];

function extractClientIdFromText(text: string): string | null {
  for (const pattern of CLIENT_ID_PATTERNS) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Attempt fast extraction from the `window.__sc_hydration` JSON blob embedded
 * in the SoundCloud homepage HTML — avoids fetching JS bundles entirely.
 */
function extractClientIdFromHydration(html: string): string | null {
  const hydrationMatch = /window\.__sc_hydration\s*=\s*(\[.*?\]);/s.exec(html);
  if (!hydrationMatch?.[1]) return null;
  try {
    const hydration = JSON.parse(hydrationMatch[1]) as Array<{
      hydratable?: string;
      data?: { client_id?: string };
    }>;
    for (const entry of hydration) {
      if (entry?.data?.client_id) return entry.data.client_id;
    }
  } catch {
    // malformed JSON — fall through to bundle scan
  }
  return null;
}

/** Fetch the SoundCloud homepage and extract all JS bundle URLs. */
async function fetchBundleUrls(): Promise<string[]> {
  const res = await fetch("https://soundcloud.com", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Ravolo/1.0)" },
  });
  if (!res.ok) {
    throw new Error(`SoundCloud homepage fetch failed: ${res.status}`);
  }
  const html = await res.text();

  // Try fast path first
  const fromHydration = extractClientIdFromHydration(html);
  if (fromHydration) {
    // Signal to caller via a special sentinel URL so we can short-circuit
    return [`__hydration__:${fromHydration}`];
  }

  // Extract <script src="..."> bundle URLs
  const scriptPattern = /<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g;
  const urls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = scriptPattern.exec(html)) !== null) {
    if (m[1]) urls.push(m[1]);
  }
  return urls;
}

/**
 * Scrape a fresh client_id from SoundCloud.
 * Scans bundles in REVERSE order because client_id lives in the last bundles.
 */
async function scrapeClientId(): Promise<string> {
  logger.info("[soundcloud] Scraping fresh client_id from SoundCloud");

  const bundleUrls = await fetchBundleUrls();

  // Fast path: hydration extraction
  if (bundleUrls.length === 1 && bundleUrls[0]?.startsWith("__hydration__:")) {
    const id = bundleUrls[0].slice("__hydration__:".length);
    logger.info({ clientId: id.slice(0, 8) + "…" }, "[soundcloud] client_id from __sc_hydration");
    return id;
  }

  if (bundleUrls.length === 0) {
    throw new Error("SoundCloud: no JS bundle URLs found on homepage");
  }

  // Scan in reverse — client_id is in the last bundles
  const reversed = [...bundleUrls].reverse();

  for (const url of reversed) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Ravolo/1.0)" },
      });
      if (!res.ok) continue;
      const text = await res.text();
      const id = extractClientIdFromText(text);
      if (id) {
        logger.info(
          { clientId: id.slice(0, 8) + "…", bundleUrl: url },
          "[soundcloud] client_id found in JS bundle",
        );
        return id;
      }
    } catch (err) {
      logger.debug({ err, url }, "[soundcloud] bundle fetch error, continuing");
    }
  }

  throw new Error("SoundCloud: client_id not found in any JS bundle");
}

/** Return a valid client_id, re-fetching if stale or invalidated. */
export async function getSoundCloudClientId(): Promise<string> {
  const now = Date.now();
  if (cachedClientId && now - clientIdFetchedAtMs < CLIENT_ID_TTL_MS) {
    return cachedClientId;
  }
  const id = await scrapeClientId();
  cachedClientId = id;
  clientIdFetchedAtMs = Date.now();
  return id;
}

// ---------------------------------------------------------------------------
// Transcoding selection
// ---------------------------------------------------------------------------

/**
 * Priority order for AAC HLS formats (only supported formats as of 2025).
 * Progressive MP3 and HLS MP3/Opus are deprecated and return 404.
 */
const AAC_HLS_PRIORITY: Array<(t: SoundCloudTranscoding) => boolean> = [
  (t) => t.preset.includes("aac_160") && t.format.protocol === "hls",
  (t) => t.preset.includes("aac_96") && t.format.protocol === "hls",
  (t) =>
    t.format.protocol === "hls" &&
    (t.format.mime_type.includes("mp4") || t.preset.toLowerCase().includes("aac")),
];

/**
 * Choose the best available AAC HLS transcoding from a track's media object.
 * Returns `null` if no compatible transcoding is found.
 */
export function chooseBestTranscoding(
  transcodings: SoundCloudTranscoding[],
): SoundCloudTranscoding | null {
  for (const predicate of AAC_HLS_PRIORITY) {
    const match = transcodings.find(predicate);
    if (match) return match;
  }
  return null;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * Make an authenticated SoundCloud API request.
 * Automatically invalidates client_id on 401/403 and retries once.
 */
async function scApiRequest(
  path: string,
  params: Record<string, string> = {},
  retried = false,
): Promise<Response> {
  const clientId = await getSoundCloudClientId();
  const url = new URL(`https://api-v2.soundcloud.com${path}`);
  url.searchParams.set("client_id", clientId);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Ravolo/1.0)",
      Accept: "application/json",
    },
  });

  if ((res.status === 401 || res.status === 403) && !retried) {
    logger.warn(
      { status: res.status, path },
      "[soundcloud] Auth error — invalidating client_id and retrying",
    );
    invalidateSoundCloudClientId();
    return scApiRequest(path, params, true);
  }

  return res;
}

// ---------------------------------------------------------------------------
// Track resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a SoundCloud track URL to its full track object (including media transcodings).
 */
export async function resolveSoundCloudTrack(trackUrl: string): Promise<SoundCloudTrack> {
  const res = await scApiRequest("/resolve", { url: trackUrl });
  if (!res.ok) {
    throw new Error(`SoundCloud resolve failed for "${trackUrl}": HTTP ${res.status}`);
  }
  return res.json() as Promise<SoundCloudTrack>;
}

/**
 * Fetch a SoundCloud track by numeric ID.
 */
export async function fetchSoundCloudTrackById(trackId: number): Promise<SoundCloudTrack> {
  const res = await scApiRequest(`/tracks/${trackId}`);
  if (!res.ok) {
    throw new Error(`SoundCloud track fetch failed for id=${trackId}: HTTP ${res.status}`);
  }
  return res.json() as Promise<SoundCloudTrack>;
}

// ---------------------------------------------------------------------------
// Playback URL resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a transcoding endpoint URL to a fresh short-lived CDN HLS playlist URL.
 *
 * CDN URLs expire after ~5 minutes — always call this at playback time,
 * never cache the returned URL. Store the `transcodingEndpointUrl` instead.
 */
export async function getSoundCloudPlaybackUrl(
  transcodingEndpointUrl: string,
): Promise<ResolvedPlaybackUrl> {
  const clientId = await getSoundCloudClientId();
  const url = new URL(transcodingEndpointUrl);
  url.searchParams.set("client_id", clientId);

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Ravolo/1.0)",
      Accept: "application/json",
    },
  });

  if (res.status === 401 || res.status === 403) {
    logger.warn(
      { status: res.status, transcodingEndpointUrl },
      "[soundcloud] Auth error on transcoding endpoint — invalidating client_id and retrying",
    );
    invalidateSoundCloudClientId();
    // Retry once with fresh client_id
    const clientId2 = await getSoundCloudClientId();
    const url2 = new URL(transcodingEndpointUrl);
    url2.searchParams.set("client_id", clientId2);
    const res2 = await fetch(url2.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Ravolo/1.0)",
        Accept: "application/json",
      },
    });
    if (!res2.ok) {
      throw new Error(
        `SoundCloud transcoding endpoint failed after retry: HTTP ${res2.status} — ${transcodingEndpointUrl}`,
      );
    }
    const data2 = (await res2.json()) as { url?: string };
    if (!data2.url) {
      throw new Error(
        `SoundCloud transcoding response missing url field — ${transcodingEndpointUrl}`,
      );
    }
    return { url: data2.url, expiresApproxMs: Date.now() + 5 * 60 * 1000 };
  }

  if (!res.ok) {
    throw new Error(
      `SoundCloud transcoding endpoint failed: HTTP ${res.status} — ${transcodingEndpointUrl}`,
    );
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) {
    throw new Error(
      `SoundCloud transcoding response missing url field — ${transcodingEndpointUrl}`,
    );
  }

  return { url: data.url, expiresApproxMs: Date.now() + 5 * 60 * 1000 };
}

/**
 * Convenience: resolve a track URL and return the best transcoding endpoint URL.
 * Returns `null` if no AAC HLS transcoding is available (track unavailable/geo-blocked).
 */
export async function resolveTrackTranscodingEndpoint(
  trackUrl: string,
): Promise<string | null> {
  const track = await resolveSoundCloudTrack(trackUrl);
  const transcodings = track.media?.transcodings ?? [];
  if (transcodings.length === 0) {
    logger.warn({ trackUrl }, "[soundcloud] Track has no transcodings — may be unavailable");
    return null;
  }
  const best = chooseBestTranscoding(transcodings);
  if (!best) {
    logger.warn(
      { trackUrl, presets: transcodings.map((t) => t.preset) },
      "[soundcloud] No AAC HLS transcoding found — track may use deprecated formats",
    );
    return null;
  }
  return best.url;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search SoundCloud tracks.
 * Returns an array of tracks with their transcoding endpoint URLs pre-resolved.
 */
export async function searchSoundCloudTracks(
  query: string,
  limit = 20,
): Promise<SoundCloudTrack[]> {
  const res = await scApiRequest("/search/tracks", {
    q: query,
    limit: String(Math.min(limit, 50)),
  });

  if (!res.ok) {
    throw new Error(`SoundCloud search failed for "${query}": HTTP ${res.status}`);
  }

  const data = (await res.json()) as SoundCloudSearchResult;
  return data.collection ?? [];
}
