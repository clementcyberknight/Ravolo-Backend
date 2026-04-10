import type { Redis } from "ioredis";
import { logger } from "../../../infrastructure/logger/logger.js";
import {
  warMatchmakingQueueKey,
  warSeqKey,
  activeWarsIndexKey,
  warStateKey as warStateKeyFn,
  syndicateInfamyKey,
  syndicateActiveWarKey,
  syndicateWarHistoryKey,
  syndicateWarCooldownKey,
} from "../../../infrastructure/redis/keys.js";
import {
  redisWarMatch,
  redisWarPhaseAdvance,
  redisWarSettle,
} from "../../../infrastructure/redis/commands.js";
import {
  WAR_INFAMY_BRACKET_PCT,
  WAR_PREP_DURATION_MS,
  WAR_BATTLE_DURATION_MS,
  WAR_COOLDOWN_DURATION_MS,
  WAR_SETTLEMENT_DURATION_MS,
  WAR_DECLARE_COOLDOWN_MS,
  WAR_UNDERDOG_STEAL_MIN_BPS,
  WAR_UNDERDOG_STEAL_MAX_BPS,
  WAR_FAVOURITE_GAIN_BPS,
} from "../../../config/constants.js";

const WAR_STATE_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

export async function runWarLifecycleTick(redis: Redis): Promise<void> {
  const now = Date.now();

  // 1. Matchmaking: try to pair queued syndicates
  try {
    const matchRes = await redisWarMatch(
      redis,
      {
        matchmakingKey: warMatchmakingQueueKey(),
        warSeqKey: warSeqKey(),
        activeWarsKey: activeWarsIndexKey(),
      },
      {
        bracketPct: WAR_INFAMY_BRACKET_PCT,
        nowMs: now,
        prepDurationMs: WAR_PREP_DURATION_MS,
        battleDurationMs: WAR_BATTLE_DURATION_MS,
        cooldownDurationMs: WAR_COOLDOWN_DURATION_MS,
        settlementDurationMs: WAR_SETTLEMENT_DURATION_MS,
      },
    );
    if (matchRes.startsWith("MATCHED|")) {
      const parts = matchRes.split("|");
      logger.info(
        { warId: parts[1], sid1: parts[2], sid2: parts[3] },
        "[war] matchmaking paired syndicates",
      );
    }
  } catch (err) {
    logger.error({ err }, "[war] matchmaking tick failed");
  }

  // 2. Phase advancement + settlement for all active wars
  const activeWarIds = await redis.smembers(activeWarsIndexKey());
  for (const warId of activeWarIds) {
    try {
      // Advance phase if timestamps have passed
      const advanceRes = await redisWarPhaseAdvance(
        redis,
        warStateKeyFn(warId),
        now,
      );
      if (advanceRes.startsWith("ADVANCED|")) {
        const newPhase = advanceRes.split("|")[1];
        logger.info({ warId, phase: newPhase }, "[war] phase advanced");

        // If we just entered settlement or ended, try to settle
        if (newPhase === "settlement" || newPhase === "ended") {
          const attackerSid = await redis.hget(warStateKeyFn(warId), "attackerSyndicateId");
          const defenderSid = await redis.hget(warStateKeyFn(warId), "defenderSyndicateId");
          if (attackerSid && defenderSid) {
            const settleRes = await redisWarSettle(
              redis,
              {
                warStateKey: warStateKeyFn(warId),
                infamyKey: syndicateInfamyKey(),
                attackerActiveWarKey: syndicateActiveWarKey(attackerSid),
                defenderActiveWarKey: syndicateActiveWarKey(defenderSid),
                attackerHistoryKey: syndicateWarHistoryKey(attackerSid),
                defenderHistoryKey: syndicateWarHistoryKey(defenderSid),
                attackerCooldownKey: syndicateWarCooldownKey(attackerSid),
                defenderCooldownKey: syndicateWarCooldownKey(defenderSid),
                activeWarsKey: activeWarsIndexKey(),
              },
              {
                warId,
                nowMs: now,
                cooldownDurationMs: WAR_DECLARE_COOLDOWN_MS,
                underdogStealMinBps: WAR_UNDERDOG_STEAL_MIN_BPS,
                underdogStealMaxBps: WAR_UNDERDOG_STEAL_MAX_BPS,
                favouriteGainBps: WAR_FAVOURITE_GAIN_BPS,
                warTtlSec: WAR_STATE_TTL_SEC,
              },
            );
            if (settleRes) {
              logger.info(
                { warId, winner: settleRes.winner, infamyDelta: settleRes.infamyDelta },
                "[war] war settled",
              );
            }
          }
        }
      }
    } catch (err) {
      logger.error({ err, warId }, "[war] phase/settle tick failed for war");
    }
  }
}
