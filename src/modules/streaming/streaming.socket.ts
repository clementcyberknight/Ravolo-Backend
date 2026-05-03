/**
 * Streaming socket handler — SoundCloud playback URL resolution.
 *
 * Design:
 * - `handleInitMessage`: resolves a fresh CDN URL on every playback request.
 *   CDN URLs expire in ~5 min so they must never be cached; only the
 *   transcoding endpoint URL is stored in the database.
 * - `hydrateSoundCloudCatalogTrack`: stores the transcoding endpoint URL
 *   (stable) rather than the short-lived CDN URL.
 * - Falls back to re-resolving from the stored transcoding endpoint if the
 *   initial attempt fails.
 * - Handles unavailable tracks gracefully with structured error messages.
 */

import { logger } from "../../infrastructure/logger/logger.js";
import {
  getSoundCloudPlaybackUrl,
  resolveTrackTranscodingEndpoint,
  chooseBestTranscoding,
  resolveSoundCloudTrack,
} from "../../lib/soundcloud.scraper.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreamInitMessage {
  type: "STREAM_INIT";
  trackId: string;
  provider: "soundcloud" | "local";
  /** Stored transcoding endpoint URL (preferred) or legacy stream URL. */
  streamUrl?: string;
  /** SoundCloud track permalink URL — used to re-resolve if streamUrl is absent. */
  trackUrl?: string;
}

export interface StreamInitAck {
  ok: boolean;
  type: "STREAM_INIT_ACK";
  trackId: string;
  /** Short-lived HLS playlist CDN URL — valid for ~5 minutes. */
  playbackUrl?: string;
  error?: string;
  message?: string;
}

export interface CatalogTrack {
  id: string;
  provider: "soundcloud" | "local";
  title: string;
  artist: string;
  artworkUrl: string | null;
  durationMs: number;
  /** Transcoding endpoint URL (stable, storable). Never a CDN URL. */
  streamUrl: string | null;
  /** SoundCloud track permalink URL for re-resolution. */
  trackUrl?: string;
}

// ---------------------------------------------------------------------------
// handleInitMessage
// ---------------------------------------------------------------------------

/**
 * Handle a STREAM_INIT message from a client.
 *
 * Resolution strategy:
 * 1. If `streamUrl` looks like a transcoding endpoint, resolve it to a fresh CDN URL.
 * 2. If `streamUrl` is absent or resolution fails, re-resolve from `trackUrl`.
 * 3. If both fail, return an error ack with a human-readable message.
 */
export async function handleInitMessage(msg: StreamInitMessage): Promise<StreamInitAck> {
  const { trackId, provider, streamUrl, trackUrl } = msg;

  if (provider !== "soundcloud") {
    // Non-SoundCloud providers are handled elsewhere; pass through.
    return {
      ok: false,
      type: "STREAM_INIT_ACK",
      trackId,
      error: "UNSUPPORTED_PROVIDER",
      message: `Provider "${provider}" is not handled by this socket.`,
    };
  }

  const log = logger.child({ trackId, provider });

  // --- Attempt 1: resolve from stored transcoding endpoint ---
  if (streamUrl && isTranscodingEndpoint(streamUrl)) {
    try {
      const resolved = await getSoundCloudPlaybackUrl(streamUrl);
      log.info(
        { transcodingEndpoint: streamUrl },
        "[streaming] Resolved fresh CDN URL from transcoding endpoint",
      );
      return {
        ok: true,
        type: "STREAM_INIT_ACK",
        trackId,
        playbackUrl: resolved.url,
      };
    } catch (err) {
      log.warn(
        { err, streamUrl },
        "[streaming] Transcoding endpoint resolution failed — falling back to track re-resolve",
      );
    }
  }

  // --- Attempt 2: re-resolve from track permalink URL ---
  const resolveFrom = trackUrl ?? streamUrl;
  if (resolveFrom && isTrackPermalinkUrl(resolveFrom)) {
    try {
      const endpointUrl = await resolveTrackTranscodingEndpoint(resolveFrom);
      if (!endpointUrl) {
        log.warn(
          { trackUrl: resolveFrom },
          "[streaming] Track has no AAC HLS transcoding — unavailable or geo-blocked",
        );
        return {
          ok: false,
          type: "STREAM_INIT_ACK",
          trackId,
          error: "TRACK_UNAVAILABLE",
          message: "This track is not available for streaming (no AAC HLS transcoding found).",
        };
      }
      const resolved = await getSoundCloudPlaybackUrl(endpointUrl);
      log.info(
        { trackUrl: resolveFrom, transcodingEndpoint: endpointUrl },
        "[streaming] Re-resolved CDN URL from track permalink",
      );
      return {
        ok: true,
        type: "STREAM_INIT_ACK",
        trackId,
        playbackUrl: resolved.url,
      };
    } catch (err) {
      log.error(
        { err, trackUrl: resolveFrom },
        "[streaming] Track re-resolve failed",
      );
      return {
        ok: false,
        type: "STREAM_INIT_ACK",
        trackId,
        error: "STREAM_RESOLUTION_FAILED",
        message: "Failed to resolve a playback URL for this track. Please try again.",
      };
    }
  }

  // --- No usable URL available ---
  log.warn(
    { streamUrl, trackUrl },
    "[streaming] No transcoding endpoint or track URL available for resolution",
  );
  return {
    ok: false,
    type: "STREAM_INIT_ACK",
    trackId,
    error: "NO_STREAM_URL",
    message: "No stream URL is stored for this track. Re-index the track to fix this.",
  };
}

// ---------------------------------------------------------------------------
// hydrateSoundCloudCatalogTrack
// ---------------------------------------------------------------------------

/**
 * Hydrate a catalog track entry with SoundCloud metadata.
 *
 * Stores the **transcoding endpoint URL** (stable, ~permanent) rather than
 * the short-lived CDN URL. The CDN URL is resolved fresh at playback time
 * via `handleInitMessage` / `getSoundCloudPlaybackUrl`.
 *
 * @param trackUrl - SoundCloud track permalink URL
 * @returns Hydrated CatalogTrack, or null if the track is unavailable.
 */
export async function hydrateSoundCloudCatalogTrack(
  trackUrl: string,
): Promise<CatalogTrack | null> {
  const log = logger.child({ trackUrl });

  let track;
  try {
    track = await resolveSoundCloudTrack(trackUrl);
  } catch (err) {
    log.error({ err }, "[streaming] Failed to resolve SoundCloud track for catalog hydration");
    return null;
  }

  const transcodings = track.media?.transcodings ?? [];
  const best = chooseBestTranscoding(transcodings);

  if (!best) {
    log.warn(
      { presets: transcodings.map((t) => t.preset) },
      "[streaming] No AAC HLS transcoding found — skipping catalog hydration",
    );
    return null;
  }

  // Store the transcoding endpoint URL — NOT the CDN URL.
  const transcodingEndpointUrl = best.url;

  log.info(
    { preset: best.preset, transcodingEndpoint: transcodingEndpointUrl },
    "[streaming] Hydrated SoundCloud catalog track with transcoding endpoint",
  );

  return {
    id: String(track.id),
    provider: "soundcloud",
    title: track.title,
    artist: track.user.username,
    artworkUrl: track.artwork_url ?? null,
    durationMs: track.duration,
    streamUrl: transcodingEndpointUrl,
    trackUrl: track.permalink_url,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the URL looks like a SoundCloud transcoding endpoint
 * (api-v2.soundcloud.com/media/... or api-v2.soundcloud.com/tracks/...)
 * rather than a short-lived CDN URL or a track permalink.
 */
function isTranscodingEndpoint(url: string): boolean {
  return (
    url.includes("api-v2.soundcloud.com/media") ||
    url.includes("api-v2.soundcloud.com/tracks")
  );
}

/**
 * Returns true if the URL looks like a SoundCloud track permalink
 * (e.g. https://soundcloud.com/artist/track-slug).
 */
function isTrackPermalinkUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "soundcloud.com" &&
      parsed.pathname.split("/").filter(Boolean).length >= 2
    );
  } catch {
    return false;
  }
}
