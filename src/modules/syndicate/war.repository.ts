import type { Redis } from "ioredis";
import {
  warStateKey,
  syndicateActiveWarKey,
  warAttackLogKey,
  syndicateWarHistoryKey,
  syndicateInfamyKey,
  syndicateWarShieldsKey,
  syndicateDefensePowerKey,
  warAttackCountKey,
  syndicateMetaKey,
  syndicateTroopLevelsKey,
} from "../../infrastructure/redis/keys.js";
import type { WarPhase, WarState, WarAttackRecord, ActiveShield, ShieldType } from "./syndicate.types.js";

function toInt(n: unknown, fallback: number): number {
  const x = Number(n);
  return Number.isFinite(x) ? Math.floor(x) : fallback;
}

export class WarRepository {
  async getWarState(redis: Redis, warId: string): Promise<WarState | null> {
    const raw = await redis.hgetall(warStateKey(warId));
    if (!raw.warId) return null;
    return {
      warId: raw.warId,
      attackerSyndicateId: raw.attackerSyndicateId ?? "",
      defenderSyndicateId: raw.defenderSyndicateId ?? "",
      phase: (raw.phase ?? "ended") as WarPhase,
      declaredAtMs: toInt(raw.declaredAtMs, 0),
      prepStartsAtMs: toInt(raw.prepStartsAtMs, 0),
      battleStartsAtMs: toInt(raw.battleStartsAtMs, 0),
      cooldownStartsAtMs: toInt(raw.cooldownStartsAtMs, 0),
      settlementStartsAtMs: toInt(raw.settlementStartsAtMs, 0),
      endsAtMs: toInt(raw.endsAtMs, 0),
      attackerInfamy: toInt(raw.attackerInfamy, 0),
      defenderInfamy: toInt(raw.defenderInfamy, 0),
      attackerStars: toInt(raw.attackerStars, 0),
      defenderStars: toInt(raw.defenderStars, 0),
      attackerDestructionBps: toInt(raw.attackerDestructionBps, 0),
      defenderDestructionBps: toInt(raw.defenderDestructionBps, 0),
      settled: raw.settled === "1",
    };
  }

  async getActiveWarId(redis: Redis, syndicateId: string): Promise<string | null> {
    const id = await redis.get(syndicateActiveWarKey(syndicateId));
    return id && id !== "" ? id : null;
  }

  async getAttackLog(redis: Redis, warId: string): Promise<WarAttackRecord[]> {
    const raw = await redis.lrange(warAttackLogKey(warId), 0, -1);
    return raw.map((line) => this.parseAttackLogLine(line)).filter(Boolean) as WarAttackRecord[];
  }

  async getAttackCount(redis: Redis, warId: string, userId: string): Promise<number> {
    const raw = await redis.hget(warAttackCountKey(warId), userId);
    return toInt(raw, 0);
  }

  async getInfamy(redis: Redis, syndicateId: string): Promise<number> {
    const raw = await redis.zscore(syndicateInfamyKey(), syndicateId);
    return toInt(raw, 0);
  }

  async getActiveShields(redis: Redis, syndicateId: string, nowMs: number): Promise<ActiveShield[]> {
    const raw = await redis.hgetall(syndicateWarShieldsKey(syndicateId));
    const shields: ActiveShield[] = [];
    for (const [type, exp] of Object.entries(raw)) {
      const expiresAtMs = toInt(exp, 0);
      if (expiresAtMs > nowMs) {
        shields.push({ type: type as ShieldType, expiresAtMs });
      }
    }
    return shields;
  }

  async getDefensePower(redis: Redis, syndicateId: string): Promise<number> {
    const raw = await redis.get(syndicateDefensePowerKey(syndicateId));
    const n = toInt(raw, 0);
    return n > 0 ? n : 100; // default defense power
  }

  async getSyndicateName(redis: Redis, syndicateId: string): Promise<string> {
    const name = await redis.hget(syndicateMetaKey(syndicateId), "name");
    return name ?? "";
  }

  async getTroopLevels(redis: Redis, syndicateId: string): Promise<Record<string, number>> {
    const raw = await redis.hgetall(syndicateTroopLevelsKey(syndicateId));
    const levels: Record<string, number> = {
      worker: 1,
      tractor: 1,
      scarecrow_breaker: 1,
      crop_duster: 1,
      siege_harvester: 1,
    };
    for (const [type, lvl] of Object.entries(raw)) {
      const n = Number(lvl);
      if (Number.isFinite(n) && n >= 1) levels[type] = Math.floor(n);
    }
    return levels;
  }

  async getWarHistory(
    redis: Redis,
    syndicateId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<{ warIds: string[]; nextCursor: string | null }> {
    const start = cursor ? cursor : "+inf";
    const results = await redis.zrevrangebyscore(
      syndicateWarHistoryKey(syndicateId),
      start,
      "-inf",
      "LIMIT",
      0,
      limit + 1,
    );
    const hasMore = results.length > limit;
    const warIds = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && warIds.length > 0
      ? warIds[warIds.length - 1]!
      : null;
    return { warIds, nextCursor };
  }

  private parseAttackLogLine(line: string): WarAttackRecord | null {
    // Format: attackId|userId|attackerSid|defenderSid|troopsCsv|stars|destructionBps|lootGold|lootItemsCsv|timestampMs
    const parts = line.split("|");
    if (parts.length < 10) return null;
    const troops = parts[4]!.split(",").map((p) => {
      const [type, count] = p.split(":");
      return { type: type as WarAttackRecord["troops"][0]["type"], count: Number(count) || 0 };
    });
    const lootItems: Record<string, number> = {};
    if (parts[8] && parts[8] !== "") {
      for (const pair of parts[8].split(";")) {
        const [id, qty] = pair.split(":");
        if (id && qty) lootItems[id] = Number(qty) || 0;
      }
    }
    return {
      attackId: parts[0]!,
      attackerUserId: parts[1]!,
      attackerSyndicateId: parts[2]!,
      defenderSyndicateId: parts[3]!,
      troops,
      stars: Number(parts[5]) || 0,
      destructionBps: Number(parts[6]) || 0,
      lootGold: Number(parts[7]) || 0,
      lootItems,
      timestampMs: Number(parts[9]) || 0,
    };
  }
}
