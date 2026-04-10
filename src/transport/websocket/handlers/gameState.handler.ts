import type { WebSocket } from "uWebSockets.js";
import type { Redis } from "ioredis";
import { z } from "zod";
import { logger } from "../../../infrastructure/logger/logger.js";
import type { FarmService } from "../../../modules/farm/farm.service.js";
import type { MarketService } from "../../../modules/market/market.service.js";
import { AppError } from "../../../shared/errors/appError.js";
import { sendGameMessage as send } from "../ws.codec.js";
import type { WsUserData } from "../ws.types.js";
import {
  walletKey,
  inventoryKey,
  inventoryLockedKey,
  animalStateKey,
  craftPendingKey,
  loanActiveKey,
  userLevelKey,
  userSyndicateIdKey,
} from "../../../infrastructure/redis/keys.js";
import { buildPlotsState } from "../../../modules/farm/plotState.js";
import { serverNowMs } from "../../../shared/utils/time.js";

const optionalTargetUserIdSchema = z
  .object({ userId: z.string().min(1).max(64).optional() })
  .strict();

function resolveTargetUserIdOrThrow(
  socketUserId: string,
  payload: unknown,
): string {
  const parsed = optionalTargetUserIdSchema.safeParse(payload ?? {});
  if (!parsed.success) {
    throw new AppError("BAD_REQUEST", "Invalid payload", {
      issues: parsed.error.issues,
    });
  }
  const { userId } = parsed.data;
  if (userId !== undefined && userId !== socketUserId) {
    throw new AppError(
      "NOT_AUTHORIZED",
      "You can only read your own plot and wallet state",
    );
  }
  return userId ?? socketUserId;
}

/**
 * GET_GAME_STATE — returns the full snapshot of the authenticated player's state.
 * No payload required. All Redis reads are issued in parallel.
 *
 * Response type: GAME_STATE_OK
 * Fields:
 *   gold           — wallet gold balance (integer)
 *   level          — player level (integer)
 *   inventory      — { [item]: quantity } free inventory
 *   lockedInv      — { [item]: quantity } inventory locked as loan collateral
 *   plots          — array of plot state objects (plotId, cropId, plantedAtMs, readyAtMs, status)
 *   animal         — raw animal state hash (null if not yet set up)
 *   craftPending   — active craft job (null if none), with readyAtMs for countdown
 *   activeLoanId   — loanId string if loan is active, null otherwise
 *   syndicateId    — syndicateId string if in a syndicate, null otherwise
 *   serverNowMs    — server timestamp so client can compute timers without drift
 */
export async function handleGetGameState(
  ws: WebSocket<WsUserData>,
  redis: Redis,
): Promise<void> {
  const { userId } = ws.getUserData();

  try {
    // ── Fetch everything in parallel ──────────────────────────────────────────
    const [
      walletRaw,
      levelRaw,
      invRaw,
      invLockedRaw,
      animalRaw,
      craftRaw,
      activeLoanId,
      syndicateId,
    ] = await Promise.all([
      redis.hgetall(walletKey(userId)),
      redis.get(userLevelKey(userId)),
      redis.hgetall(inventoryKey(userId)),
      redis.hgetall(inventoryLockedKey(userId)),
      redis.hgetall(animalStateKey(userId)),
      redis.hgetall(craftPendingKey(userId)),
      redis.get(loanActiveKey(userId)),
      redis.get(userSyndicateIdKey(userId)),
    ]);

    // ── Parse wallet ──────────────────────────────────────────────────────────
    // The Lua treasury scripts store gold as whole gold units (not micro-gold).
    // HINCRBY KEYS[walletKey] 'gold' pay — where pay = sellPayoutGold() in whole gold.
    // Do NOT divide by PRICE_MICRO_PER_GOLD here.
    const gold = Math.max(0, Math.floor(Number(walletRaw?.gold ?? 0)));

    // ── Parse level ───────────────────────────────────────────────────────────
    const level = Number(levelRaw ?? 1);

    // ── Parse inventories (convert string values to numbers) ──────────────────
    const inventory: Record<string, number> = {};
    for (const [k, v] of Object.entries(invRaw ?? {})) {
      const n = Number(v);
      if (n > 0) inventory[k] = n;
    }

    const lockedInv: Record<string, number> = {};
    for (const [k, v] of Object.entries(invLockedRaw ?? {})) {
      const n = Number(v);
      if (n > 0) lockedInv[k] = n;
    }

    const now = serverNowMs();
    const plots = await buildPlotsState(redis, userId, now);

    // ── Parse animal state ────────────────────────────────────────────────────
    const animal =
      Object.keys(animalRaw ?? {}).length > 0
        ? animalRaw
        : null;

    // ── Parse craft pending (HASH: pendingId, outputItem, outputQty, readyAtMs) ──
    let craftPending: Record<string, string | number> | null = null;
    if (Object.keys(craftRaw ?? {}).length > 0 && craftRaw.readyAtMs) {
      const craftReadyAtMs = Number(craftRaw.readyAtMs);
      craftPending = {
        pendingId: craftRaw.pendingId ?? "",
        outputItem: craftRaw.outputItem ?? "",
        outputQty: Number(craftRaw.outputQty ?? 0),
        readyAtMs: craftReadyAtMs,
        msUntilReady: Math.max(0, craftReadyAtMs - now),
        status: now >= craftReadyAtMs ? "ready" : "crafting",
      };
    }

    send(ws, {
      type: "GAME_STATE_OK",
      data: {
        gold,
        level,
        inventory,
        lockedInv,
        plots,
        animal,
        craftPending,
        activeLoanId: activeLoanId ?? null,
        syndicateId: syndicateId ?? null,
        serverNowMs: now,
      },
    });
  } catch (e) {
    logger.error({ err: e, userId }, "game state fetch failed");
    send(ws, {
      type: "ERROR",
      code: "INTERNAL",
      message: "Failed to load game state",
    });
  }
}

/**
 * GET_PLOT_STATE — plots only for the authenticated user (optional `userId` must match socket).
 * Response: GET_PLOT_STATE_OK { userId, plots, serverNowMs }
 */
export async function handleGetPlotState(
  ws: WebSocket<WsUserData>,
  payload: unknown,
  farm: FarmService,
): Promise<void> {
  const socketUserId = ws.getUserData().userId;
  try {
    const targetUserId = resolveTargetUserIdOrThrow(socketUserId, payload);
    const now = serverNowMs();
    const plots = await farm.getPlotsState(targetUserId, now);
    send(ws, {
      type: "GET_PLOT_STATE_OK",
      data: { userId: targetUserId, plots, serverNowMs: now },
    });
  } catch (e) {
    if (e instanceof AppError) {
      logger.warn({ e: e.code, userId: socketUserId }, e.message);
      send(ws, {
        type: "ERROR",
        code: e.code,
        message: e.httpSafeMessage,
        details: e.details,
      });
      return;
    }
    logger.error({ err: e, userId: socketUserId }, "get plot state failed");
    send(ws, {
      type: "ERROR",
      code: "INTERNAL",
      message: "Failed to load plot state",
    });
  }
}

/**
 * GET_GOLD_BALANCE — wallet gold for the authenticated user (optional `userId` must match socket).
 * Response: GET_GOLD_BALANCE_OK { userId, gold, serverNowMs }
 */
export async function handleGetGoldBalance(
  ws: WebSocket<WsUserData>,
  payload: unknown,
  market: MarketService,
): Promise<void> {
  const socketUserId = ws.getUserData().userId;
  try {
    const targetUserId = resolveTargetUserIdOrThrow(socketUserId, payload);
    const now = serverNowMs();
    const gold = await market.getUserGold(targetUserId);
    send(ws, {
      type: "GET_GOLD_BALANCE_OK",
      data: { userId: targetUserId, gold, serverNowMs: now },
    });
  } catch (e) {
    if (e instanceof AppError) {
      logger.warn({ e: e.code, userId: socketUserId }, e.message);
      send(ws, {
        type: "ERROR",
        code: e.code,
        message: e.httpSafeMessage,
        details: e.details,
      });
      return;
    }
    logger.error({ err: e, userId: socketUserId }, "get gold balance failed");
    send(ws, {
      type: "ERROR",
      code: "INTERNAL",
      message: "Failed to load gold balance",
    });
  }
}
