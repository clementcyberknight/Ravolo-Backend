import type { Redis } from "ioredis";
import { syndicateIdolKey } from "../../infrastructure/redis/keys.js";

/** Treasury trade multipliers from active syndicate idol bless/punish windows. */
export type IdolTradeMultipliers = {
  buyMult: number;
  sellMult: number;
};

function toInt(n: unknown, fallback: number): number {
  const x = Number(n);
  return Number.isFinite(x) ? Math.floor(x) : fallback;
}

/**
 * Resolves idol-driven buy/sell multipliers for a syndicate.
 * Punished window takes precedence if both status and timestamps could disagree.
 */
export async function getSyndicateIdolTradeMultipliers(
  redis: Redis,
  syndicateId: string,
  nowMs: number,
): Promise<IdolTradeMultipliers> {
  const raw = await redis.hgetall(syndicateIdolKey(syndicateId));
  const status = raw.status ?? "none";
  const blessedUntil = toInt(raw.blessedUntilMs, 0);
  const punishedUntil = toInt(raw.punishedUntilMs, 0);

  if (status === "punished" && punishedUntil > nowMs) {
    return { buyMult: 1.2, sellMult: 0.8 };
  }
  if (status === "blessed" && blessedUntil > nowMs) {
    return { buyMult: 0.9, sellMult: 1.05 };
  }
  return { buyMult: 1, sellMult: 1 };
}

/** True while syndicate idol punishment window is active (treasury + wither harvest rules). */
export async function isSyndicateIdolPunishmentActive(
  redis: Redis,
  syndicateId: string,
  nowMs: number,
): Promise<boolean> {
  const raw = await redis.hgetall(syndicateIdolKey(syndicateId));
  if ((raw.status ?? "") !== "punished") return false;
  return toInt(raw.punishedUntilMs, 0) > nowMs;
}
