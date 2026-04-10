import type { WebSocket } from "uWebSockets.js";
import { logger } from "../../../infrastructure/logger/logger.js";
import type { WarService } from "../../../modules/syndicate/war.service.js";
import type { UserActionService } from "../../../modules/user-actions/userAction.service.js";
import { AppError } from "../../../shared/errors/appError.js";
import { sendGameMessage as send } from "../ws.codec.js";
import { wsActionLimiter } from "../ws.rateLimiter.js";
import type { WsOutboundMessage, WsUserData } from "../ws.types.js";

async function consume(userId: string, ws: WebSocket<WsUserData>): Promise<boolean> {
  try {
    await wsActionLimiter.consume(userId);
    return true;
  } catch {
    send(ws, { type: "ERROR", code: "RATE_LIMITED", message: "Too many actions" });
    return false;
  }
}

function handleErr(ws: WebSocket<WsUserData>, userId: string, e: unknown, what: string) {
  if (e instanceof AppError) {
    logger.warn({ e: e.code, userId }, e.message);
    send(ws, {
      type: "ERROR",
      code: e.code,
      message: e.httpSafeMessage,
      details: e.details,
    });
    return;
  }
  logger.error({ err: e, userId }, what);
  send(ws, { type: "ERROR", code: "INTERNAL", message: "Internal error" });
}

export async function handleDeclareWar(
  ws: WebSocket<WsUserData>,
  payload: unknown,
  wars: WarService,
  userActions: UserActionService,
): Promise<void> {
  const userId = ws.getUserData().userId;
  if (!(await consume(userId, ws))) return;
  try {
    const data = await wars.declareWar(userId, payload);
    userActions.log(userId, "DECLARE_WAR", payload);
    send(ws, { type: "DECLARE_WAR_OK", data } satisfies WsOutboundMessage);
  } catch (e) {
    handleErr(ws, userId, e, "declare war failed");
  }
}

export async function handleWarAttack(
  ws: WebSocket<WsUserData>,
  payload: unknown,
  wars: WarService,
  userActions: UserActionService,
): Promise<void> {
  const userId = ws.getUserData().userId;
  if (!(await consume(userId, ws))) return;
  try {
    const data = await wars.attack(userId, payload);
    userActions.log(userId, "WAR_ATTACK", payload);
    send(ws, { type: "WAR_ATTACK_OK", data } satisfies WsOutboundMessage);
  } catch (e) {
    handleErr(ws, userId, e, "war attack failed");
  }
}

export async function handleBuyWarShield(
  ws: WebSocket<WsUserData>,
  payload: unknown,
  wars: WarService,
  userActions: UserActionService,
): Promise<void> {
  const userId = ws.getUserData().userId;
  if (!(await consume(userId, ws))) return;
  try {
    const data = await wars.buyWarShield(userId, payload);
    userActions.log(userId, "BUY_WAR_SHIELD", payload);
    send(ws, { type: "BUY_WAR_SHIELD_OK", data } satisfies WsOutboundMessage);
  } catch (e) {
    handleErr(ws, userId, e, "buy war shield failed");
  }
}

export async function handleViewWar(
  ws: WebSocket<WsUserData>,
  payload: unknown,
  wars: WarService,
): Promise<void> {
  const userId = ws.getUserData().userId;
  if (!(await consume(userId, ws))) return;
  try {
    const data = await wars.viewWar(userId, payload);
    send(ws, { type: "VIEW_WAR_OK", data } satisfies WsOutboundMessage);
  } catch (e) {
    handleErr(ws, userId, e, "view war failed");
  }
}

export async function handleViewActiveWar(
  ws: WebSocket<WsUserData>,
  _payload: unknown,
  wars: WarService,
): Promise<void> {
  const userId = ws.getUserData().userId;
  if (!(await consume(userId, ws))) return;
  try {
    const data = await wars.viewActiveWar(userId);
    send(ws, { type: "VIEW_ACTIVE_WAR_OK", data } satisfies WsOutboundMessage);
  } catch (e) {
    handleErr(ws, userId, e, "view active war failed");
  }
}

export async function handleViewWarHistory(
  ws: WebSocket<WsUserData>,
  payload: unknown,
  wars: WarService,
): Promise<void> {
  const userId = ws.getUserData().userId;
  if (!(await consume(userId, ws))) return;
  try {
    const data = await wars.viewWarHistory(userId, payload);
    send(ws, { type: "VIEW_WAR_HISTORY_OK", data } satisfies WsOutboundMessage);
  } catch (e) {
    handleErr(ws, userId, e, "view war history failed");
  }
}

export async function handleUpgradeTroop(
  ws: WebSocket<WsUserData>,
  payload: unknown,
  wars: WarService,
  userActions: UserActionService,
): Promise<void> {
  const userId = ws.getUserData().userId;
  if (!(await consume(userId, ws))) return;
  try {
    const data = await wars.upgradeTroop(userId, payload);
    userActions.log(userId, "UPGRADE_TROOP", payload);
    send(ws, { type: "UPGRADE_TROOP_OK", data } satisfies WsOutboundMessage);
  } catch (e) {
    handleErr(ws, userId, e, "upgrade troop failed");
  }
}

export async function handleViewTroopLevels(
  ws: WebSocket<WsUserData>,
  payload: unknown,
  wars: WarService,
): Promise<void> {
  const userId = ws.getUserData().userId;
  if (!(await consume(userId, ws))) return;
  try {
    const data = await wars.viewTroopLevels(userId, payload);
    send(ws, { type: "VIEW_TROOP_LEVELS_OK", data } satisfies WsOutboundMessage);
  } catch (e) {
    handleErr(ws, userId, e, "view troop levels failed");
  }
}
