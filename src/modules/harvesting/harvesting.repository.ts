import type { Redis } from "ioredis";
import {
  clearPlotWitherIdempotencyKey,
  harvestIdempotencyKey,
  inventoryKey,
  plotKey,
} from "../../infrastructure/redis/keys.js";
import {
  redisClearPlotWither,
  redisHarvest,
  redisHarvestWither,
} from "../../infrastructure/redis/commands.js";
import type {
  ClearPlotWitherResult,
  HarvestResult,
} from "./harvesting.types.js";

function isReplyError(err: unknown): err is { message: string } {
  return typeof err === "object" && err !== null && "message" in err;
}

export class HarvestingRepository {
  async harvestAtomic(
    redis: Redis,
    userId: string,
    params: { plotId: number; requestId: string; nowMs: number },
  ): Promise<HarvestResult> {
    const keys = {
      plotKey: plotKey(userId, params.plotId),
      invKey: inventoryKey(userId),
      idempKey: harvestIdempotencyKey(userId, params.requestId),
    };

    try {
      const res = await redisHarvest(redis, keys, { nowMs: params.nowMs });
      return {
        kind: "harvest" as const,
        itemId: res.itemId,
        quantity: res.quantity,
        idempotentReplay: "idempotentReplay" in res ? res.idempotentReplay : undefined,
      };
    } catch (e) {
      if (isReplyError(e) && e.message.includes("ERR_EMPTY_PLOT")) {
        const err = new Error("EMPTY_PLOT");
        (err as Error & { code: string }).code = "EMPTY_PLOT";
        throw err;
      }
      if (isReplyError(e) && e.message.includes("ERR_NOT_READY")) {
        const err = new Error("NOT_READY");
        (err as Error & { code: string }).code = "NOT_READY";
        throw err;
      }
      if (isReplyError(e) && e.message.includes("ERR_INVALID_OUTPUT")) {
        const err = new Error("INVALID_OUTPUT");
        (err as Error & { code: string }).code = "INVALID_OUTPUT";
        throw err;
      }
      throw e;
    }
  }

  async harvestWitherAtomic(
    redis: Redis,
    userId: string,
    params: { plotId: number; requestId: string; nowMs: number },
  ): Promise<HarvestResult> {
    const keys = {
      plotKey: plotKey(userId, params.plotId),
      idempKey: harvestIdempotencyKey(userId, params.requestId),
    };

    try {
      const res = await redisHarvestWither(redis, keys, {
        nowMs: params.nowMs,
      });
      return {
        kind: "withered_harvest",
        itemId: res.itemId,
        quantity: 0,
        idempotentReplay: "idempotentReplay" in res ? res.idempotentReplay : undefined,
      };
    } catch (e) {
      if (isReplyError(e) && e.message.includes("ERR_EMPTY_PLOT")) {
        const err = new Error("EMPTY_PLOT");
        (err as Error & { code: string }).code = "EMPTY_PLOT";
        throw err;
      }
      if (isReplyError(e) && e.message.includes("ERR_NOT_READY")) {
        const err = new Error("NOT_READY");
        (err as Error & { code: string }).code = "NOT_READY";
        throw err;
      }
      throw e;
    }
  }

  async clearPlotWitherAtomic(
    redis: Redis,
    userId: string,
    params: { plotId: number; requestId: string },
  ): Promise<ClearPlotWitherResult> {
    const keys = {
      plotKey: plotKey(userId, params.plotId),
      idempKey: clearPlotWitherIdempotencyKey(userId, params.requestId),
    };

    try {
      await redisClearPlotWither(redis, keys);
      return { ok: true };
    } catch (e) {
      if (isReplyError(e) && e.message.includes("ERR_NOT_WITHERED")) {
        const err = new Error("NOT_WITHERED");
        (err as Error & { code: string }).code = "NOT_WITHERED";
        throw err;
      }
      if (isReplyError(e) && e.message.includes("ERR_PLOT_OCCUPIED")) {
        const err = new Error("PLOT_OCCUPIED");
        (err as Error & { code: string }).code = "PLOT_OCCUPIED";
        throw err;
      }
      throw e;
    }
  }
}
