/**
 * SoundCloud unified-search provider — 2025-compatible.
 *
 * Uses the new scraper to search SoundCloud tracks and returns results with
 * transcoding endpoint URLs (stable, storable) rather than short-lived CDN URLs.
 * AAC HLS format selection is handled by `chooseBestTranscoding`.
 */

import { logger } from "../../../infrastructure/logger/logger.js";
import {
  searchSoundCloudTracks,
  chooseBestTranscoding,
  getSoundCloudClientId,
} from "../../../lib/soundcloud.scraper.js";
import type { SoundCloudTrack } from "../../../lib/soundcloud.scraper.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UnifiedSearchTrack {
  id: string;
  provider: "soundcloud";
  title: string;
  artist: string;
  artworkUrl: string | null;
  durationMs: number;
  /**
   * Transcoding endpoint URL (stable, storable).
   * Resolve to a CDN URL at playback time via `getSoundCloudPlaybackUrl()`.
   * Null if no AAC HLS transcoding is available.
   */
  streamUrl: string | null;
  /** SoundCloud track permalink URL — used for re-resolution if streamUrl is stale. */
  trackUrl: string;
  externalId: string; // SoundCloud numeric track ID as string
}

export interface SoundCloudSearchOptions {
  limit?: number;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Search SoundCloud and return unified track results.
 *
 * Gracefully handles:
 * - Unavailable client_id (returns empty array with a warning log)
 * - Tracks with no AAC HLS transcoding (streamUrl set to null)
 * - Network errors (propagates with context)
 */
export async function searchSoundCloud(
  query: string,
  options: SoundCloudSearchOptions = {},
): Promise<UnifiedSearchTrack[]> {
  const { limit = 20 } = options;
  const log = logger.child({ query, limit });

  // Warm the client_id cache and verify it is available before attempting search.
  // getSoundCloudClientId() is also called internally by searchSoundCloudTracks,
  // but calling it here first lets us return an empty array (rather than throw)
  // when the client_id cannot be obtained.
  try {
    await getSoundCloudClientId();
  } catch (err) {
    log.warn({ err }, "[soundcloud-provider] client_id unavailable — skipping SoundCloud search");
    return [];
  }

  let tracks: SoundCloudTrack[];
  try {
    tracks = await searchSoundCloudTracks(query, limit);
  } catch (err) {
    log.error({ err }, "[soundcloud-provider] SoundCloud search request failed");
    throw new Error(`SoundCloud search failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const results: UnifiedSearchTrack[] = [];

  for (const track of tracks) {
    const transcodings = track.media?.transcodings ?? [];
    const best = chooseBestTranscoding(transcodings);

    if (!best) {
      log.debug(
        {
          trackId: track.id,
          title: track.title,
          presets: transcodings.map((t) => t.preset),
        },
        "[soundcloud-provider] Track has no AAC HLS transcoding — streamUrl will be null",
      );
    }

    results.push({
      id: `soundcloud:${track.id}`,
      provider: "soundcloud",
      title: track.title,
      artist: track.user.username,
      artworkUrl: track.artwork_url ?? null,
      durationMs: track.duration,
      // Store the transcoding endpoint URL, not a CDN URL.
      streamUrl: best?.url ?? null,
      trackUrl: track.permalink_url,
      externalId: String(track.id),
    });
  }

  log.info(
    { resultCount: results.length, withStream: results.filter((r) => r.streamUrl).length },
    "[soundcloud-provider] Search complete",
  );

  return results;
}

/**
 * Map a raw SoundCloud track object to a UnifiedSearchTrack.
 * Useful when you already have a resolved track (e.g. from catalog hydration).
 */
export function mapSoundCloudTrack(track: SoundCloudTrack): UnifiedSearchTrack {
  const transcodings = track.media?.transcodings ?? [];
  const best = chooseBestTranscoding(transcodings);

  return {
    id: `soundcloud:${track.id}`,
    provider: "soundcloud",
    title: track.title,
    artist: track.user.username,
    artworkUrl: track.artwork_url ?? null,
    durationMs: track.duration,
    streamUrl: best?.url ?? null,
    trackUrl: track.permalink_url,
    externalId: String(track.id),
  };
}
