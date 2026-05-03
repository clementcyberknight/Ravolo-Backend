/**
 * Catalog transcode worker — SoundCloud AAC HLS URL resolution.
 *
 * Processes a batch of catalog tracks that need their stream URLs resolved or
 * refreshed. For each SoundCloud track:
 *
 * 1. Calls `getSoundCloudPlaybackUrl()` with the stored transcoding endpoint URL.
 * 2. If that fails (e.g. endpoint is stale/missing), re-resolves from the track
 *    permalink URL using `resolveTrackTranscodingEndpoint()`.
 * 3. Retries transient failures with exponential backoff (up to 3 attempts).
 * 4. Logs which tracks fail and why (404, unavailable, auth error, etc.).
 * 5. Skips failed tracks instead of crashing the job — partial success is fine.
 *
 * The worker stores the **transcoding endpoint URL** back to the database,
 * never the short-lived CDN URL. CDN URLs are resolved fresh at playback time.
 */

import { logger } from "../infrastructure/logger/logger.js";
import {
  getSoundCloudPlaybackUrl,
  resolveTrackTranscodingEndpoint,
} from "../lib/soundcloud.scraper.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CatalogTranscodeTrack {
  id: string;
  provider: "soundcloud" | "local";
  title: string;
  /** Stored transcoding endpoint URL (may be null if never resolved). */
  streamUrl: string | null;
  /** SoundCloud track permalink URL for re-resolution. */
  trackUrl?: string | null;
}

export interface TranscodeResult {
  trackId: string;
  status: "ok" | "skipped" | "failed";
  /** Updated transcoding endpoint URL (if re-resolved). */
  transcodingEndpointUrl?: string;
  /** Fresh CDN playback URL (valid ~5 min — for immediate use only, do not store). */
  playbackUrl?: string;
  reason?: string;
}

export interface CatalogTranscodeJobData {
  tracks: CatalogTranscodeTrack[];
  /** If true, verify each stored endpoint is still reachable (slower but thorough). */
  verifyExisting?: boolean;
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = MAX_RETRIES,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isTransient = isTransientError(err);
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const delayMs = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      logger.warn(
        { err, attempt, maxRetries, delayMs, label },
        "[catalog-transcode] Transient error — retrying with backoff",
      );
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  // Treat network errors and 5xx as transient; 404/unavailable as permanent
  return (
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("http 5")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Single-track resolution
// ---------------------------------------------------------------------------

async function resolveTrack(
  track: CatalogTranscodeTrack,
  verifyExisting: boolean,
): Promise<TranscodeResult> {
  const log = logger.child({ trackId: track.id, title: track.title });

  if (track.provider !== "soundcloud") {
    return { trackId: track.id, status: "skipped", reason: "non-soundcloud provider" };
  }

  // --- Attempt 1: use stored transcoding endpoint ---
  if (track.streamUrl && (!verifyExisting || isTranscodingEndpoint(track.streamUrl))) {
    try {
      const resolved = await withRetry(
        () => getSoundCloudPlaybackUrl(track.streamUrl!),
        `getSoundCloudPlaybackUrl(${track.id})`,
      );
      log.info(
        { transcodingEndpoint: track.streamUrl },
        "[catalog-transcode] Verified transcoding endpoint — CDN URL resolved",
      );
      return {
        trackId: track.id,
        status: "ok",
        transcodingEndpointUrl: track.streamUrl,
        playbackUrl: resolved.url,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is404 = msg.includes("404") || msg.includes("HTTP 404");
      log.warn(
        { err, is404, streamUrl: track.streamUrl },
        "[catalog-transcode] Stored transcoding endpoint failed — attempting re-resolve",
      );
    }
  }

  // --- Attempt 2: re-resolve from track permalink URL ---
  const permalinkUrl = track.trackUrl;
  if (!permalinkUrl) {
    log.warn(
      { streamUrl: track.streamUrl },
      "[catalog-transcode] No track permalink URL available for re-resolution — skipping",
    );
    return {
      trackId: track.id,
      status: "failed",
      reason: "no permalink URL for re-resolution and stored endpoint failed",
    };
  }

  try {
    const endpointUrl = await withRetry(
      () => resolveTrackTranscodingEndpoint(permalinkUrl),
      `resolveTrackTranscodingEndpoint(${track.id})`,
    );

    if (!endpointUrl) {
      log.warn(
        { permalinkUrl },
        "[catalog-transcode] Track has no AAC HLS transcoding — unavailable or geo-blocked",
      );
      return {
        trackId: track.id,
        status: "failed",
        reason: "no AAC HLS transcoding available (track may be unavailable or geo-blocked)",
      };
    }

    // Verify the new endpoint resolves to a CDN URL
    const resolved = await withRetry(
      () => getSoundCloudPlaybackUrl(endpointUrl),
      `getSoundCloudPlaybackUrl(re-resolved, ${track.id})`,
    );

    log.info(
      { permalinkUrl, newTranscodingEndpoint: endpointUrl },
      "[catalog-transcode] Re-resolved transcoding endpoint from permalink",
    );

    return {
      trackId: track.id,
      status: "ok",
      transcodingEndpointUrl: endpointUrl,
      playbackUrl: resolved.url,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is404 = msg.includes("404") || msg.includes("HTTP 404");
    const isUnavailable = msg.includes("unavailable") || msg.includes("geo-blocked");

    log.error(
      { err, permalinkUrl, is404, isUnavailable },
      "[catalog-transcode] Track re-resolve failed — skipping track",
    );

    return {
      trackId: track.id,
      status: "failed",
      reason: msg,
    };
  }
}

// ---------------------------------------------------------------------------
// Job runner
// ---------------------------------------------------------------------------

/**
 * Run a catalog transcode job for a batch of tracks.
 *
 * Processes tracks sequentially to avoid hammering the SoundCloud API.
 * Failed tracks are logged and skipped — they do not abort the job.
 *
 * @returns Array of results, one per input track.
 */
export async function runCatalogTranscodeJob(
  data: CatalogTranscodeJobData,
): Promise<TranscodeResult[]> {
  const { tracks, verifyExisting = false } = data;
  const log = logger.child({ jobTrackCount: tracks.length, verifyExisting });

  log.info("[catalog-transcode] Starting catalog transcode job");

  const results: TranscodeResult[] = [];
  let okCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const track of tracks) {
    const result = await resolveTrack(track, verifyExisting);
    results.push(result);

    switch (result.status) {
      case "ok":
        okCount++;
        break;
      case "failed":
        failedCount++;
        log.warn(
          { trackId: result.trackId, reason: result.reason },
          "[catalog-transcode] Track failed — skipping",
        );
        break;
      case "skipped":
        skippedCount++;
        break;
    }

    // Small delay between tracks to be a good API citizen
    await sleep(100);
  }

  log.info(
    { okCount, failedCount, skippedCount, total: tracks.length },
    "[catalog-transcode] Catalog transcode job complete",
  );

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the URL looks like a SoundCloud transcoding endpoint
 * (api-v2.soundcloud.com/media/...) rather than a CDN URL.
 */
function isTranscodingEndpoint(url: string): boolean {
  return (
    url.includes("api-v2.soundcloud.com/media") ||
    url.includes("api-v2.soundcloud.com/tracks")
  );
}
