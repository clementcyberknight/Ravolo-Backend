import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Redis } from "ioredis";
import { IDEMPOTENCY_TTL_SEC } from "../../config/constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveLuaFile(name: string): string {
  const here = join(__dirname, "scripts", name);
  if (existsSync(here)) return here;
  const fromSrc = join(
    process.cwd(),
    "src",
    "infrastructure",
    "redis",
    "scripts",
    name,
  );
  if (existsSync(fromSrc)) return fromSrc;
  const fromDist = join(
    process.cwd(),
    "dist",
    "infrastructure",
    "redis",
    "scripts",
    name,
  );
  if (existsSync(fromDist)) return fromDist;
  throw new Error(`Missing Lua script: ${name}`);
}

let plantSha: string | null = null;
let harvestSha: string | null = null;
let harvestWitherSha: string | null = null;
let clearPlotWitherSha: string | null = null;
let onboardSha: string | null = null;
let sellSha: string | null = null;
let buySha: string | null = null;
let buyPlotSha: string | null = null;
let loanOpenSha: string | null = null;
let loanRepaySha: string | null = null;
let animalFeedSha: string | null = null;
let animalHarvestSha: string | null = null;
let craftStartSha: string | null = null;
let craftClaimSha: string | null = null;
let syndicateCreateSha: string | null = null;
let syndicateRequestJoinSha: string | null = null;
let syndicateAcceptJoinSha: string | null = null;
let syndicateRemoveJoinRequestSha: string | null = null;
let syndicateKickMemberSha: string | null = null;
let syndicatePromoteDemoteSha: string | null = null;
let syndicateDepositSha: string | null = null;
let syndicateBuyShieldSha: string | null = null;
let syndicateAttackSha: string | null = null;
let syndicateIdolContributeSha: string | null = null;
let syndicateLeaveOrDisbandSha: string | null = null;
let syndicateBankSellSha: string | null = null;
let decaySha: string | null = null;
let redeemRefreshTokenSha: string | null = null;
let warDeclareSha: string | null = null;
let warMatchSha: string | null = null;
let warAttackSha: string | null = null;
let warPhaseAdvanceSha: string | null = null;
let warSettleSha: string | null = null;
let warBuyShieldSha: string | null = null;
let upgradeTroopSha: string | null = null;
let helpFulfillSha: string | null = null;

export async function loadRedisScripts(redis: Redis): Promise<void> {
  const plantSrc = readFileSync(resolveLuaFile("plant.lua"), "utf8");
  const harvestSrc = readFileSync(resolveLuaFile("harvest.lua"), "utf8");
  const harvestWitherSrc = readFileSync(
    resolveLuaFile("harvestWither.lua"),
    "utf8",
  );
  const clearPlotWitherSrc = readFileSync(
    resolveLuaFile("clearPlotWither.lua"),
    "utf8",
  );
  const onboardSrc = readFileSync(resolveLuaFile("onboarding.lua"), "utf8");
  const sellSrc = readFileSync(resolveLuaFile("treasurySell.lua"), "utf8");
  const buySrc = readFileSync(resolveLuaFile("treasuryBuy.lua"), "utf8");
  const buyPlotSrc = readFileSync(resolveLuaFile("buyPlot.lua"), "utf8");
  const loanOpenSrc = readFileSync(resolveLuaFile("loanOriginate.lua"), "utf8");
  const loanRepaySrc = readFileSync(resolveLuaFile("loanRepay.lua"), "utf8");
  const animalFeedSrc = readFileSync(resolveLuaFile("animalFeed.lua"), "utf8");
  const animalHarvestSrc = readFileSync(
    resolveLuaFile("animalHarvest.lua"),
    "utf8",
  );
  const craftStartSrc = readFileSync(resolveLuaFile("craftStart.lua"), "utf8");
  const craftClaimSrc = readFileSync(resolveLuaFile("craftClaim.lua"), "utf8");
  const syndicateCreateSrc = readFileSync(
    resolveLuaFile("syndicateCreate.lua"),
    "utf8",
  );
  const syndicateRequestJoinSrc = readFileSync(
    resolveLuaFile("syndicateRequestJoin.lua"),
    "utf8",
  );
  const syndicateAcceptJoinSrc = readFileSync(
    resolveLuaFile("syndicateAcceptJoin.lua"),
    "utf8",
  );
  const syndicateDepositSrc = readFileSync(
    resolveLuaFile("syndicateDeposit.lua"),
    "utf8",
  );
  const syndicateBuyShieldSrc = readFileSync(
    resolveLuaFile("syndicateBuyShield.lua"),
    "utf8",
  );
  const syndicateAttackSrc = readFileSync(
    resolveLuaFile("syndicateAttack.lua"),
    "utf8",
  );
  const syndicateIdolContributeSrc = readFileSync(
    resolveLuaFile("syndicateIdolContribute.lua"),
    "utf8",
  );
  const syndicateLeaveOrDisbandSrc = readFileSync(
    resolveLuaFile("syndicateLeaveOrDisband.lua"),
    "utf8",
  );
  const syndicateBankSellSrc = readFileSync(
    resolveLuaFile("syndicateBankSell.lua"),
    "utf8",
  );
  const decaySrc = readFileSync(resolveLuaFile("decay.lua"), "utf8");

  plantSha = (await redis.script("LOAD", plantSrc)) as string;
  harvestSha = (await redis.script("LOAD", harvestSrc)) as string;
  harvestWitherSha = (await redis.script("LOAD", harvestWitherSrc)) as string;
  clearPlotWitherSha = (await redis.script("LOAD", clearPlotWitherSrc)) as string;
  onboardSha = (await redis.script("LOAD", onboardSrc)) as string;
  sellSha = (await redis.script("LOAD", sellSrc)) as string;
  buySha = (await redis.script("LOAD", buySrc)) as string;
  buyPlotSha = (await redis.script("LOAD", buyPlotSrc)) as string;
  loanOpenSha = (await redis.script("LOAD", loanOpenSrc)) as string;
  loanRepaySha = (await redis.script("LOAD", loanRepaySrc)) as string;
  animalFeedSha = (await redis.script("LOAD", animalFeedSrc)) as string;
  animalHarvestSha = (await redis.script("LOAD", animalHarvestSrc)) as string;
  craftStartSha = (await redis.script("LOAD", craftStartSrc)) as string;
  craftClaimSha = (await redis.script("LOAD", craftClaimSrc)) as string;
  syndicateCreateSha = (await redis.script(
    "LOAD",
    syndicateCreateSrc,
  )) as string;
  syndicateRequestJoinSha = (await redis.script(
    "LOAD",
    syndicateRequestJoinSrc,
  )) as string;
  syndicateAcceptJoinSha = (await redis.script(
    "LOAD",
    syndicateAcceptJoinSrc,
  )) as string;
  const syndicateRemoveJoinRequestSrc = readFileSync(
    resolveLuaFile("syndicateRemoveJoinRequest.lua"),
    "utf8",
  );
  syndicateRemoveJoinRequestSha = (await redis.script(
    "LOAD",
    syndicateRemoveJoinRequestSrc,
  )) as string;
  const syndicateKickMemberSrc = readFileSync(
    resolveLuaFile("syndicateKickMember.lua"),
    "utf8",
  );
  syndicateKickMemberSha = (await redis.script(
    "LOAD",
    syndicateKickMemberSrc,
  )) as string;
  const syndicatePromoteDemoteSrc = readFileSync(
    resolveLuaFile("syndicatePromoteDemote.lua"),
    "utf8",
  );
  syndicatePromoteDemoteSha = (await redis.script(
    "LOAD",
    syndicatePromoteDemoteSrc,
  )) as string;
  syndicateDepositSha = (await redis.script(
    "LOAD",
    syndicateDepositSrc,
  )) as string;
  syndicateBuyShieldSha = (await redis.script(
    "LOAD",
    syndicateBuyShieldSrc,
  )) as string;
  syndicateAttackSha = (await redis.script(
    "LOAD",
    syndicateAttackSrc,
  )) as string;
  syndicateIdolContributeSha = (await redis.script(
    "LOAD",
    syndicateIdolContributeSrc,
  )) as string;
  syndicateLeaveOrDisbandSha = (await redis.script(
    "LOAD",
    syndicateLeaveOrDisbandSrc,
  )) as string;
  syndicateBankSellSha = (await redis.script(
    "LOAD",
    syndicateBankSellSrc,
  )) as string;
  decaySha = (await redis.script("LOAD", decaySrc)) as string;
  const redeemRefreshTokenSrc = readFileSync(
    resolveLuaFile("redeemRefreshToken.lua"),
    "utf8",
  );
  redeemRefreshTokenSha = (await redis.script(
    "LOAD",
    redeemRefreshTokenSrc,
  )) as string;

  // ── War scripts ──
  const warDeclareSrc = readFileSync(resolveLuaFile("syndicateWarDeclare.lua"), "utf8");
  const warMatchSrc = readFileSync(resolveLuaFile("syndicateWarMatch.lua"), "utf8");
  const warAttackSrc = readFileSync(resolveLuaFile("syndicateWarAttack.lua"), "utf8");
  const warPhaseAdvanceSrc = readFileSync(resolveLuaFile("syndicateWarPhaseAdvance.lua"), "utf8");
  const warSettleSrc = readFileSync(resolveLuaFile("syndicateWarSettle.lua"), "utf8");
  const warBuyShieldSrc = readFileSync(resolveLuaFile("syndicateWarBuyShield.lua"), "utf8");
  warDeclareSha = (await redis.script("LOAD", warDeclareSrc)) as string;
  warMatchSha = (await redis.script("LOAD", warMatchSrc)) as string;
  warAttackSha = (await redis.script("LOAD", warAttackSrc)) as string;
  warPhaseAdvanceSha = (await redis.script("LOAD", warPhaseAdvanceSrc)) as string;
  warSettleSha = (await redis.script("LOAD", warSettleSrc)) as string;
  warBuyShieldSha = (await redis.script("LOAD", warBuyShieldSrc)) as string;
  const upgradeTroopSrc = readFileSync(resolveLuaFile("syndicateUpgradeTroop.lua"), "utf8");
  upgradeTroopSha = (await redis.script("LOAD", upgradeTroopSrc)) as string;
  const helpFulfillSrc = readFileSync(resolveLuaFile("syndicateHelpFulfill.lua"), "utf8");
  helpFulfillSha = (await redis.script("LOAD", helpFulfillSrc)) as string;
}

export function getRedeemRefreshTokenSha(): string {
  if (!redeemRefreshTokenSha) throw new Error("Redis scripts not loaded");
  return redeemRefreshTokenSha;
}

export type PlantScriptResult =
  | {
      ok: true;
      cropId: string;
      plantedAtMs: number;
      readyAtMs: number;
      outputQty: number;
    }
  | {
      ok: true;
      idempotentReplay: true;
      cropId: string;
      plantedAtMs: number;
      readyAtMs: number;
      outputQty: number;
    };

export type HarvestScriptResult =
  | { ok: true; itemId: string; quantity: number }
  | { ok: true; idempotentReplay: true; itemId: string; quantity: number };

export type HarvestWitherScriptResult =
  | { ok: true; kind: "withered_harvest"; itemId: string; quantity: 0 }
  | {
      ok: true;
      kind: "withered_harvest";
      idempotentReplay: true;
      itemId: string;
      quantity: 0;
    };

function parsePlantPayload(
  raw: string,
  idempotent: boolean,
): PlantScriptResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 5) {
    throw new Error(`Invalid plant payload: ${raw}`);
  }
  const [, cropId, plantedAt, readyAt, outputQty] = parts;
  const base = {
    ok: true as const,
    cropId,
    plantedAtMs: Number(plantedAt),
    readyAtMs: Number(readyAt),
    outputQty: Number(outputQty),
  };
  return idempotent ? { ...base, idempotentReplay: true } : base;
}

function parseHarvestPayload(
  raw: string,
  idempotent: boolean,
): HarvestScriptResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 3) {
    throw new Error(`Invalid harvest payload: ${raw}`);
  }
  const [, itemId, qty] = parts;
  const base = { ok: true as const, itemId, quantity: Number(qty) };
  return idempotent ? { ...base, idempotentReplay: true } : base;
}

function parseHarvestWitherPayload(
  raw: string,
  idempotent: boolean,
): HarvestWitherScriptResult {
  const parts = raw.split("|");
  if (
    parts[0] !== "OK" ||
    parts[1] !== "WITHERED" ||
    parts.length !== 4
  ) {
    throw new Error(`Invalid harvest wither payload: ${raw}`);
  }
  const itemId = parts[2]!;
  const base = {
    ok: true as const,
    kind: "withered_harvest" as const,
    itemId,
    quantity: 0 as const,
  };
  return idempotent ? { ...base, idempotentReplay: true } : base;
}

function isReplyError(err: unknown): err is { message: string } {
  return typeof err === "object" && err !== null && "message" in err;
}

export async function redisPlant(
  redis: Redis,
  keys: { plotKey: string; invKey: string; idempKey: string },
  args: {
    cropId: string;
    plantedAtMs: number;
    readyAtMs: number;
    outputQty: number;
    seedField: string;
    seedCost: number;
    harvestItem: string;
  },
): Promise<PlantScriptResult> {
  if (!plantSha) throw new Error("Redis scripts not loaded");

  const idempTtl = IDEMPOTENCY_TTL_SEC;
  try {
    const res = (await redis.evalsha(
      plantSha,
      3,
      keys.plotKey,
      keys.invKey,
      keys.idempKey,
      args.cropId,
      String(args.plantedAtMs),
      String(args.readyAtMs),
      String(args.outputQty),
      args.seedField,
      String(args.seedCost),
      String(idempTtl),
      args.harvestItem,
    )) as string;
    return parsePlantPayload(res, false);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("ERR_PLOT_OCCUPIED")) throw e;
    if (isReplyError(e) && e.message.includes("ERR_PLOT_WITHERED")) throw e;
    if (isReplyError(e) && e.message.includes("ERR_INSUFFICIENT_SEEDS"))
      throw e;
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisPlant(redis, keys, args);
    }
    throw e;
  }
}

export async function redisGetPlantIdempotency(
  redis: Redis,
  idempKey: string,
): Promise<PlantScriptResult | null> {
  const raw = await redis.get(idempKey);
  if (!raw) return null;
  return parsePlantPayload(raw, true);
}

export async function redisHarvest(
  redis: Redis,
  keys: { plotKey: string; invKey: string; idempKey: string },
  args: { nowMs: number },
): Promise<HarvestScriptResult> {
  if (!harvestSha) throw new Error("Redis scripts not loaded");

  const idempTtl = IDEMPOTENCY_TTL_SEC;
  try {
    const res = (await redis.evalsha(
      harvestSha,
      3,
      keys.plotKey,
      keys.invKey,
      keys.idempKey,
      String(args.nowMs),
      String(idempTtl),
    )) as string;
    return parseHarvestPayload(res, false);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisHarvest(redis, keys, args);
    }
    throw e;
  }
}

export async function redisGetHarvestIdempotency(
  redis: Redis,
  idempKey: string,
): Promise<HarvestScriptResult | null> {
  const raw = await redis.get(idempKey);
  if (!raw) return null;
  return parseHarvestPayload(raw, true);
}

export async function redisHarvestWither(
  redis: Redis,
  keys: { plotKey: string; idempKey: string },
  args: { nowMs: number },
): Promise<HarvestWitherScriptResult> {
  if (!harvestWitherSha) throw new Error("Redis scripts not loaded");

  const idempTtl = IDEMPOTENCY_TTL_SEC;
  try {
    const res = (await redis.evalsha(
      harvestWitherSha,
      2,
      keys.plotKey,
      keys.idempKey,
      String(args.nowMs),
      String(idempTtl),
    )) as string;
    return parseHarvestWitherPayload(res, false);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisHarvestWither(redis, keys, args);
    }
    throw e;
  }
}

export async function redisGetHarvestWitherIdempotency(
  redis: Redis,
  idempKey: string,
): Promise<HarvestWitherScriptResult | null> {
  const raw = await redis.get(idempKey);
  if (!raw) return null;
  return parseHarvestWitherPayload(raw, true);
}

export async function redisClearPlotWither(
  redis: Redis,
  keys: { plotKey: string; idempKey: string },
): Promise<{ ok: true } | { ok: true; idempotentReplay: true }> {
  if (!clearPlotWitherSha) throw new Error("Redis scripts not loaded");

  const idempTtl = IDEMPOTENCY_TTL_SEC;
  try {
    const res = (await redis.evalsha(
      clearPlotWitherSha,
      2,
      keys.plotKey,
      keys.idempKey,
      String(idempTtl),
    )) as string;
    if (res === "OK") return { ok: true };
    throw new Error(`Invalid clear wither reply: ${res}`);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisClearPlotWither(redis, keys);
    }
    throw e;
  }
}

export async function redisOnboard(
  redis: Redis,
  keys: {
    accountInitKey: string;
    walletKey: string;
    invKey: string;
    plotsKey: string;
    reserveKey: string;
    plotSeqKey: string;
  },
  args: {
    starterGold: number;
    seedField: string;
    seedCount: number;
    plotCsv: string;
  },
): Promise<"OK" | "SKIP"> {
  if (!onboardSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      onboardSha,
      6,
      keys.accountInitKey,
      keys.walletKey,
      keys.invKey,
      keys.plotsKey,
      keys.reserveKey,
      keys.plotSeqKey,
      String(args.starterGold),
      args.seedField,
      String(args.seedCount),
      args.plotCsv,
    )) as string;
    if (res === "SKIP" || res === "OK") return res;
    throw new Error(`Invalid onboard reply: ${res}`);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisOnboard(redis, keys, args);
    }
    throw e;
  }
}

export type TreasuryTradeScriptResult = {
  item: string;
  quantity: number;
  gold: number;
};

export type BuyPlotScriptResult = {
  plotId: number;
  gold: number;
};

function parseTreasuryPayload(raw: string): TreasuryTradeScriptResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 4) {
    throw new Error(`Invalid treasury payload: ${raw}`);
  }
  return {
    item: parts[1]!,
    quantity: Number(parts[2]),
    gold: Number(parts[3]),
  };
}

function parseBuyPlotPayload(raw: string): BuyPlotScriptResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 3) {
    throw new Error(`Invalid buy plot payload: ${raw}`);
  }
  return {
    plotId: Number(parts[1]),
    gold: Number(parts[2]),
  };
}

export async function redisTreasurySell(
  redis: Redis,
  keys: {
    invKey: string;
    walletKey: string;
    idempKey: string;
    reserveKey: string;
    sellFlowKey: string;
    streamKey: string;
  },
  args: {
    item: string;
    quantity: number;
    goldPayout: number;
    idempTtlSec: number;
    streamEnable: boolean;
    userId: string;
    tsMs: number;
  },
): Promise<TreasuryTradeScriptResult> {
  if (!sellSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      sellSha,
      6,
      keys.invKey,
      keys.walletKey,
      keys.idempKey,
      keys.reserveKey,
      keys.sellFlowKey,
      keys.streamKey,
      args.item,
      String(args.quantity),
      String(args.goldPayout),
      String(args.idempTtlSec),
      args.streamEnable ? "1" : "0",
      args.userId,
      String(args.tsMs),
    )) as string;
    return parseTreasuryPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisTreasurySell(redis, keys, args);
    }
    throw e;
  }
}

export async function redisTreasuryBuy(
  redis: Redis,
  keys: {
    invKey: string;
    walletKey: string;
    idempKey: string;
    reserveKey: string;
    buyFlowKey: string;
    streamKey: string;
  },
  args: {
    item: string;
    quantity: number;
    goldCost: number;
    idempTtlSec: number;
    streamEnable: boolean;
    userId: string;
    tsMs: number;
  },
): Promise<TreasuryTradeScriptResult> {
  if (!buySha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      buySha,
      6,
      keys.invKey,
      keys.walletKey,
      keys.idempKey,
      keys.reserveKey,
      keys.buyFlowKey,
      keys.streamKey,
      args.item,
      String(args.quantity),
      String(args.goldCost),
      String(args.idempTtlSec),
      args.streamEnable ? "1" : "0",
      args.userId,
      String(args.tsMs),
    )) as string;
    return parseTreasuryPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisTreasuryBuy(redis, keys, args);
    }
    throw e;
  }
}

export async function redisBuyPlot(
  redis: Redis,
  keys: {
    walletKey: string;
    plotsKey: string;
    plotsLockedKey: string;
    plotSeqKey: string;
    idempKey: string;
    reserveKey: string;
  },
  args: {
    starterPlotCount: number;
    maxPlots: number;
    baseGold: number;
    stepGold: number;
    idempTtlSec: number;
    plotKeyPrefix: string;
  },
): Promise<BuyPlotScriptResult> {
  if (!buyPlotSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      buyPlotSha,
      6,
      keys.walletKey,
      keys.plotsKey,
      keys.plotsLockedKey,
      keys.plotSeqKey,
      keys.idempKey,
      keys.reserveKey,
      String(args.starterPlotCount),
      String(args.maxPlots),
      String(args.baseGold),
      String(args.stepGold),
      String(args.idempTtlSec),
      args.plotKeyPrefix,
    )) as string;
    return parseBuyPlotPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisBuyPlot(redis, keys, args);
    }
    throw e;
  }
}

export type LoanOpenScriptResult = { loanId: string; principal: number };

function parseLoanOpenPayload(raw: string): LoanOpenScriptResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 3) {
    throw new Error(`Invalid loan open payload: ${raw}`);
  }
  return { loanId: parts[1]!, principal: Number(parts[2]) };
}

export async function redisLoanOriginate(
  redis: Redis,
  keys: {
    invKey: string;
    invLockedKey: string;
    walletKey: string;
    reserveKey: string;
    loanRecordKey: string;
    idempKey: string;
    loanActiveKey: string;
    plotsKey: string;
    plotsLockedKey: string;
  },
  args: {
    loanId: string;
    principal: number;
    collateralValueGold: number;
    collateralInvSpec: string;
    collateralPlotCsv: string;
    idempTtlSec: number;
    userId: string;
    tsMs: number;
    borrowedAtMs: number;
    dueAtMs: number;
  },
): Promise<LoanOpenScriptResult> {
  if (!loanOpenSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      loanOpenSha,
      9,
      keys.invKey,
      keys.invLockedKey,
      keys.walletKey,
      keys.reserveKey,
      keys.loanRecordKey,
      keys.idempKey,
      keys.loanActiveKey,
      keys.plotsKey,
      keys.plotsLockedKey,
      args.loanId,
      String(args.principal),
      String(args.collateralValueGold),
      args.collateralInvSpec,
      args.collateralPlotCsv,
      String(args.idempTtlSec),
      args.userId,
      String(args.tsMs),
      String(args.borrowedAtMs),
      String(args.dueAtMs),
    )) as string;
    return parseLoanOpenPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisLoanOriginate(redis, keys, args);
    }
    throw e;
  }
}

export type LoanRepayScriptResult = { loanId: string; totalPaid: number };

function parseLoanRepayPayload(raw: string): LoanRepayScriptResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 3) {
    throw new Error(`Invalid loan repay payload: ${raw}`);
  }
  return { loanId: parts[1]!, totalPaid: Number(parts[2]) };
}

export async function redisLoanRepay(
  redis: Redis,
  keys: {
    invKey: string;
    invLockedKey: string;
    walletKey: string;
    reserveKey: string;
    loanRecordKey: string;
    idempKey: string;
    loanActiveKey: string;
    plotsKey: string;
    plotsLockedKey: string;
  },
  args: {
    loanId: string;
    totalDueGold: number;
    idempTtlSec: number;
    userId: string;
    tsMs: number;
  },
): Promise<LoanRepayScriptResult> {
  if (!loanRepaySha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      loanRepaySha,
      9,
      keys.invKey,
      keys.invLockedKey,
      keys.walletKey,
      keys.reserveKey,
      keys.loanRecordKey,
      keys.idempKey,
      keys.loanActiveKey,
      keys.plotsKey,
      keys.plotsLockedKey,
      args.loanId,
      String(args.totalDueGold),
      String(args.idempTtlSec),
      args.userId,
      String(args.tsMs),
    )) as string;
    return parseLoanRepayPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisLoanRepay(redis, keys, args);
    }
    throw e;
  }
}

export type AnimalFeedResult = {
  species: string;
  feedUsed: number;
  nextProduceMs: number;
};

function parseAnimalFeedPayload(raw: string): AnimalFeedResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 4) {
    throw new Error(`Invalid animal feed payload: ${raw}`);
  }
  return {
    species: parts[1]!,
    feedUsed: Number(parts[2]),
    nextProduceMs: Number(parts[3]),
  };
}

export async function redisAnimalFeed(
  redis: Redis,
  keys: { invKey: string; stateKey: string; idempKey: string },
  args: {
    speciesKey: string;
    animalInvField: string;
    feedItem: string;
    feedPerAnimal: number;
    nowMs: number;
    produceIntervalMs: number;
    fedWindowMs: number;
    idempTtlSec: number;
  },
): Promise<AnimalFeedResult> {
  if (!animalFeedSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      animalFeedSha,
      3,
      keys.invKey,
      keys.stateKey,
      keys.idempKey,
      args.speciesKey,
      args.animalInvField,
      args.feedItem,
      String(args.feedPerAnimal),
      String(args.nowMs),
      String(args.produceIntervalMs),
      String(args.fedWindowMs),
      String(args.idempTtlSec),
    )) as string;
    return parseAnimalFeedPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisAnimalFeed(redis, keys, args);
    }
    throw e;
  }
}

export type AnimalHarvestResult = {
  produceItem: string;
  quantity: number;
  nextProduceMs: number;
};

function parseAnimalHarvestPayload(raw: string): AnimalHarvestResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 4) {
    throw new Error(`Invalid animal harvest payload: ${raw}`);
  }
  return {
    produceItem: parts[1]!,
    quantity: Number(parts[2]),
    nextProduceMs: Number(parts[3]),
  };
}

export async function redisAnimalHarvest(
  redis: Redis,
  keys: { invKey: string; stateKey: string; idempKey: string },
  args: {
    speciesKey: string;
    animalInvField: string;
    produceItem: string;
    maxProduce: number;
    produceIntervalMs: number;
    nowMs: number;
    idempTtlSec: number;
  },
): Promise<AnimalHarvestResult> {
  if (!animalHarvestSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      animalHarvestSha,
      3,
      keys.invKey,
      keys.stateKey,
      keys.idempKey,
      args.speciesKey,
      args.animalInvField,
      args.produceItem,
      String(args.maxProduce),
      String(args.produceIntervalMs),
      String(args.nowMs),
      String(args.idempTtlSec),
    )) as string;
    return parseAnimalHarvestPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisAnimalHarvest(redis, keys, args);
    }
    throw e;
  }
}

export type CraftStartResult = {
  pendingId: string;
  readyAtMs: number;
  outputItem: string;
  outputQty: number;
};

function parseCraftStartPayload(raw: string): CraftStartResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 5) {
    throw new Error(`Invalid craft start payload: ${raw}`);
  }
  return {
    pendingId: parts[1]!,
    readyAtMs: Number(parts[2]),
    outputItem: parts[3]!,
    outputQty: Number(parts[4]),
  };
}

export async function redisCraftStart(
  redis: Redis,
  keys: { invKey: string; pendingKey: string; idempKey: string },
  args: {
    pendingId: string;
    toolField: string;
    toolMin: number;
    ingredientSpec: string;
    readyAtMs: number;
    outputItem: string;
    outputQty: number;
    idempTtlSec: number;
  },
): Promise<CraftStartResult> {
  if (!craftStartSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      craftStartSha,
      3,
      keys.invKey,
      keys.pendingKey,
      keys.idempKey,
      args.pendingId,
      args.toolField,
      String(args.toolMin),
      args.ingredientSpec,
      String(args.readyAtMs),
      args.outputItem,
      String(args.outputQty),
      String(args.idempTtlSec),
    )) as string;
    return parseCraftStartPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisCraftStart(redis, keys, args);
    }
    throw e;
  }
}

export type CraftClaimResult = { item: string; quantity: number };

function parseCraftClaimPayload(raw: string): CraftClaimResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 3) {
    throw new Error(`Invalid craft claim payload: ${raw}`);
  }
  return { item: parts[1]!, quantity: Number(parts[2]) };
}

export async function redisCraftClaim(
  redis: Redis,
  keys: { invKey: string; pendingKey: string; idempKey: string },
  args: { pendingId: string; nowMs: number; idempTtlSec: number },
): Promise<CraftClaimResult> {
  if (!craftClaimSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      craftClaimSha,
      3,
      keys.invKey,
      keys.pendingKey,
      keys.idempKey,
      args.pendingId,
      String(args.nowMs),
      String(args.idempTtlSec),
    )) as string;
    return parseCraftClaimPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisCraftClaim(redis, keys, args);
    }
    throw e;
  }
}

// --- Syndicates ---

export type SyndicateCreateResult = { syndicateId: string };

function parseSyndicateCreatePayload(raw: string): SyndicateCreateResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 2) {
    throw new Error(`Invalid syndicate create payload: ${raw}`);
  }
  return { syndicateId: parts[1]! };
}

export async function redisSyndicateCreate(
  redis: Redis,
  keys: {
    seqKey: string;
    userSyndicateKey: string;
    userLevelKey: string;
    nameIndexKey: string;
    indexAllKey: string;
    indexPublicKey: string;
    idempKey: string;
    userPendingSyndicateKey: string;
  },
  args: {
    userId: string;
    minLevel: number;
    name: string;
    description: string;
    visibility: string;
    levelPrefMin: number;
    goldPrefMin: number;
    nowMs: number;
    idempTtlSec: number;
    syndicateKeyPrefix: string;
    emblemId: string;
  },
): Promise<SyndicateCreateResult> {
  if (!syndicateCreateSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      syndicateCreateSha,
      8,
      keys.seqKey,
      keys.userSyndicateKey,
      keys.userLevelKey,
      keys.nameIndexKey,
      keys.indexAllKey,
      keys.indexPublicKey,
      keys.idempKey,
      keys.userPendingSyndicateKey,
      args.userId,
      String(args.minLevel),
      args.name,
      args.description,
      args.visibility,
      String(args.levelPrefMin),
      String(args.goldPrefMin),
      String(args.nowMs),
      String(args.idempTtlSec),
      args.syndicateKeyPrefix,
      args.emblemId,
    )) as string;
    return parseSyndicateCreatePayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisSyndicateCreate(redis, keys, args);
    }
    throw e;
  }
}

export async function redisSyndicateRequestJoin(
  redis: Redis,
  keys: {
    userSyndicateKey: string;
    metaKey: string;
    membersKey: string;
    rolesKey: string;
    joinReqKey: string;
    idempKey: string;
    userLevelKey: string;
    userWalletKey: string;
    userPendingSyndicateKey: string;
  },
  args: {
    userId: string;
    nowMs: number;
    idempTtlSec: number;
    maxMembers: number;
  },
): Promise<"OK|JOINED" | "OK|REQUESTED"> {
  if (!syndicateRequestJoinSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      syndicateRequestJoinSha,
      9,
      keys.userSyndicateKey,
      keys.metaKey,
      keys.membersKey,
      keys.rolesKey,
      keys.joinReqKey,
      keys.idempKey,
      keys.userLevelKey,
      keys.userWalletKey,
      keys.userPendingSyndicateKey,
      args.userId,
      String(args.nowMs),
      String(args.idempTtlSec),
      String(args.maxMembers),
    )) as string;
    if (res === "OK|JOINED" || res === "OK|REQUESTED") return res;
    throw new Error(`Invalid syndicate request join reply: ${res}`);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisSyndicateRequestJoin(redis, keys, args);
    }
    throw e;
  }
}

export async function redisSyndicateAcceptJoin(
  redis: Redis,
  keys: {
    actorUserSyndicateKey: string;
    metaKey: string;
    joinReqKey: string;
    membersKey: string;
    rolesKey: string;
    targetUserSyndicateKey: string;
    idempKey: string;
    targetUserPendingSyndicateKey: string;
  },
  args: {
    actorUserId: string;
    targetUserId: string;
    nowMs: number;
    idempTtlSec: number;
    maxMembers: number;
  },
): Promise<"OK"> {
  if (!syndicateAcceptJoinSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      syndicateAcceptJoinSha,
      8,
      keys.actorUserSyndicateKey,
      keys.metaKey,
      keys.joinReqKey,
      keys.membersKey,
      keys.rolesKey,
      keys.targetUserSyndicateKey,
      keys.idempKey,
      keys.targetUserPendingSyndicateKey,
      args.actorUserId,
      args.targetUserId,
      String(args.nowMs),
      String(args.idempTtlSec),
      String(args.maxMembers),
    )) as string;
    if (res === "OK") return "OK";
    throw new Error(`Invalid syndicate accept reply: ${res}`);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisSyndicateAcceptJoin(redis, keys, args);
    }
    throw e;
  }
}

export async function redisSyndicateKickMember(
  redis: Redis,
  keys: {
    actorUserSyndicateKey: string;
    membersKey: string;
    rolesKey: string;
    targetUserSyndicateKey: string;
    idempKey: string;
  },
  args: {
    actorUserId: string;
    targetUserId: string;
    syndicateId: string;
    idempTtlSec: number;
  },
): Promise<"OK"> {
  if (!syndicateKickMemberSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      syndicateKickMemberSha,
      5,
      keys.actorUserSyndicateKey,
      keys.membersKey,
      keys.rolesKey,
      keys.targetUserSyndicateKey,
      keys.idempKey,
      args.actorUserId,
      args.targetUserId,
      args.syndicateId,
      String(args.idempTtlSec),
    )) as string;
    if (res === "OK") return "OK";
    throw new Error(`Invalid syndicate kick member reply: ${res}`);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisSyndicateKickMember(redis, keys, args);
    }
    throw e;
  }
}

export async function redisSyndicatePromoteDemote(
  redis: Redis,
  keys: {
    actorUserSyndicateKey: string;
    rolesKey: string;
    idempKey: string;
  },
  args: {
    actorUserId: string;
    targetUserId: string;
    syndicateId: string;
    mode: "promote" | "demote";
    idempTtlSec: number;
    maxAdmins: number;
  },
): Promise<"OK"> {
  if (!syndicatePromoteDemoteSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      syndicatePromoteDemoteSha,
      3,
      keys.actorUserSyndicateKey,
      keys.rolesKey,
      keys.idempKey,
      args.actorUserId,
      args.targetUserId,
      args.syndicateId,
      args.mode,
      String(args.idempTtlSec),
      String(args.maxAdmins),
    )) as string;
    if (res === "OK") return "OK";
    throw new Error(`Invalid syndicate promote/demote reply: ${res}`);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisSyndicatePromoteDemote(redis, keys, args);
    }
    throw e;
  }
}

export async function redisSyndicateRemoveJoinRequest(
  redis: Redis,
  keys: {
    actorUserSyndicateKey: string;
    joinReqKey: string;
    targetUserPendingSyndicateKey: string;
    rolesKey: string;
    idempKey: string;
  },
  args: {
    actorUserId: string;
    targetUserId: string;
    syndicateId: string;
    mode: "cancel" | "reject";
    idempTtlSec: number;
  },
): Promise<"OK"> {
  if (!syndicateRemoveJoinRequestSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      syndicateRemoveJoinRequestSha,
      5,
      keys.actorUserSyndicateKey,
      keys.joinReqKey,
      keys.targetUserPendingSyndicateKey,
      keys.rolesKey,
      keys.idempKey,
      args.actorUserId,
      args.targetUserId,
      args.syndicateId,
      args.mode,
      String(args.idempTtlSec),
    )) as string;
    if (res === "OK") return "OK";
    throw new Error(`Invalid syndicate remove join request reply: ${res}`);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisSyndicateRemoveJoinRequest(redis, keys, args);
    }
    throw e;
  }
}

export async function redisSyndicateDeposit(
  redis: Redis,
  keys: {
    userSyndicateKey: string;
    userWalletKey: string;
    userInvKey: string;
    bankGoldKey: string;
    bankItemsKey: string;
    contribGoldKey: string;
    contribItemsKey: string;
    idempKey: string;
    holdingsKey: string;
  },
  args: {
    userId: string;
    syndicateId: string;
    kind: string;
    itemId: string;
    amount: number;
    nowMs: number;
    idempTtlSec: number;
  },
): Promise<"OK"> {
  if (!syndicateDepositSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      syndicateDepositSha,
      9,
      keys.userSyndicateKey,
      keys.userWalletKey,
      keys.userInvKey,
      keys.bankGoldKey,
      keys.bankItemsKey,
      keys.contribGoldKey,
      keys.contribItemsKey,
      keys.idempKey,
      keys.holdingsKey,
      args.userId,
      args.syndicateId,
      args.kind,
      args.itemId,
      String(args.amount),
      String(args.nowMs),
      String(args.idempTtlSec),
    )) as string;
    if (res === "OK") return "OK";
    throw new Error(`Invalid syndicate deposit reply: ${res}`);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisSyndicateDeposit(redis, keys, args);
    }
    throw e;
  }
}

export type SyndicateBankSellResult = {
  item: string;
  quantity: number;
  goldPaid: number;
};

function parseSyndicateBankSellPayload(raw: string): SyndicateBankSellResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 4) {
    throw new Error(`Invalid syndicate bank sell payload: ${raw}`);
  }
  return {
    item: parts[1]!,
    quantity: Number(parts[2]),
    goldPaid: Number(parts[3]),
  };
}

export async function redisSyndicateBankSell(
  redis: Redis,
  keys: {
    userSyndicateKey: string;
    rolesKey: string;
    bankItemsKey: string;
    bankGoldKey: string;
    treasuryReserveKey: string;
    sellFlowKey: string;
    holdingsKey: string;
    idempKey: string;
  },
  args: {
    userId: string;
    syndicateId: string;
    item: string;
    quantity: number;
    goldPayout: number;
    idempTtlSec: number;
    nowMs: number;
  },
): Promise<SyndicateBankSellResult> {
  if (!syndicateBankSellSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      syndicateBankSellSha,
      8,
      keys.userSyndicateKey,
      keys.rolesKey,
      keys.bankItemsKey,
      keys.bankGoldKey,
      keys.treasuryReserveKey,
      keys.sellFlowKey,
      keys.holdingsKey,
      keys.idempKey,
      args.userId,
      args.syndicateId,
      args.item,
      String(args.quantity),
      String(args.goldPayout),
      String(args.idempTtlSec),
      String(args.nowMs),
    )) as string;
    return parseSyndicateBankSellPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisSyndicateBankSell(redis, keys, args);
    }
    throw e;
  }
}

export type SyndicateBuyShieldResult = { shieldExpiresAtMs: number };

function parseSyndicateShieldPayload(raw: string): SyndicateBuyShieldResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 2) {
    throw new Error(`Invalid syndicate shield payload: ${raw}`);
  }
  return { shieldExpiresAtMs: Number(parts[1]) };
}

export async function redisSyndicateBuyShield(
  redis: Redis,
  keys: {
    userSyndicateKey: string;
    bankGoldKey: string;
    shieldKey: string;
    idempKey: string;
  },
  args: {
    userId: string;
    syndicateId: string;
    goldPaid: number;
    nowMs: number;
    idempTtlSec: number;
  },
): Promise<SyndicateBuyShieldResult> {
  if (!syndicateBuyShieldSha) throw new Error("Redis scripts not loaded");
  const durationMult = 1000; // 1 gold = 1s shield by default (tune later)
  try {
    const res = (await redis.evalsha(
      syndicateBuyShieldSha,
      4,
      keys.userSyndicateKey,
      keys.bankGoldKey,
      keys.shieldKey,
      keys.idempKey,
      args.userId,
      args.syndicateId,
      String(args.goldPaid),
      String(args.nowMs),
      String(durationMult),
      String(args.idempTtlSec),
    )) as string;
    return parseSyndicateShieldPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisSyndicateBuyShield(redis, keys, args);
    }
    throw e;
  }
}

export type SyndicateAttackResult = {
  lootGold: number;
  lootItemId: string;
  lootItemQty: number;
  shieldExpiresAtMs: number;
};

function parseSyndicateAttackPayload(raw: string): SyndicateAttackResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 5) {
    throw new Error(`Invalid syndicate attack payload: ${raw}`);
  }
  return {
    lootGold: Number(parts[1]),
    lootItemId: parts[2] ?? "",
    lootItemQty: Number(parts[3]),
    shieldExpiresAtMs: Number(parts[4]),
  };
}

export async function redisSyndicateAttack(
  redis: Redis,
  keys: {
    attackerUserSyndicateKey: string;
    attackerBankGoldKey: string;
    attackerBankItemsKey: string;
    targetMetaKey: string;
    targetBankGoldKey: string;
    targetBankItemsKey: string;
    targetShieldKey: string;
    attackerCooldownKey: string;
    idempKey: string;
  },
  args: {
    userId: string;
    attackerSyndicateId: string;
    targetSyndicateId: string;
    attackPower: number;
    lootGoldMax: number;
    lootItemId: string;
    lootItemMax: number;
    nowMs: number;
    cooldownMs: number;
    idempTtlSec: number;
  },
): Promise<SyndicateAttackResult> {
  if (!syndicateAttackSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      syndicateAttackSha,
      9,
      keys.attackerUserSyndicateKey,
      keys.attackerBankGoldKey,
      keys.attackerBankItemsKey,
      keys.targetMetaKey,
      keys.targetBankGoldKey,
      keys.targetBankItemsKey,
      keys.targetShieldKey,
      keys.attackerCooldownKey,
      keys.idempKey,
      args.userId,
      args.attackerSyndicateId,
      args.targetSyndicateId,
      String(args.attackPower),
      String(args.lootGoldMax),
      args.lootItemId,
      String(args.lootItemMax),
      String(args.nowMs),
      String(args.cooldownMs),
      String(args.idempTtlSec),
    )) as string;
    return parseSyndicateAttackPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisSyndicateAttack(redis, keys, args);
    }
    throw e;
  }
}

export type SyndicateIdolContributeResult = { fulfilled: boolean };

function parseSyndicateIdolPayload(raw: string): SyndicateIdolContributeResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 2) {
    throw new Error(`Invalid syndicate idol payload: ${raw}`);
  }
  return { fulfilled: parts[1] === "1" };
}

export async function redisSyndicateIdolContribute(
  redis: Redis,
  keys: {
    userSyndicateKey: string;
    bankItemsKey: string;
    idolReqKey: string;
    idolKey: string;
    idempKey: string;
  },
  args: {
    userId: string;
    syndicateId: string;
    requestKey: string;
    itemId: string;
    amount: number;
    nowMs: number;
    idempTtlSec: number;
  },
): Promise<SyndicateIdolContributeResult> {
  if (!syndicateIdolContributeSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      syndicateIdolContributeSha,
      5,
      keys.userSyndicateKey,
      keys.bankItemsKey,
      keys.idolReqKey,
      keys.idolKey,
      keys.idempKey,
      args.userId,
      args.syndicateId,
      args.requestKey,
      args.itemId,
      String(args.amount),
      String(args.nowMs),
      String(args.idempTtlSec),
    )) as string;
    return parseSyndicateIdolPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisSyndicateIdolContribute(redis, keys, args);
    }
    throw e;
  }
}

export async function redisSyndicateLeaveOrDisband(
  redis: Redis,
  keys: {
    userSyndicateKey: string;
    nameIndexKey: string;
    indexAllKey: string;
    indexPublicKey: string;
    idempKey: string;
  },
  args: {
    mode: "leave" | "disband";
    userId: string;
    syndicateId: string;
    nowMs: number;
    idempTtlSec: number;
  },
): Promise<"OK"> {
  if (!syndicateLeaveOrDisbandSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      syndicateLeaveOrDisbandSha,
      5,
      keys.userSyndicateKey,
      keys.nameIndexKey,
      keys.indexAllKey,
      keys.indexPublicKey,
      keys.idempKey,
      args.mode,
      args.userId,
      args.syndicateId,
      String(args.nowMs),
      String(args.idempTtlSec),
    )) as string;
    if (res === "OK") return "OK";
    throw new Error(`Invalid syndicate leave/disband reply: ${res}`);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisSyndicateLeaveOrDisband(redis, keys, args);
    }
    throw e;
  }
}

export async function redisDecay(
  redis: Redis,
  plotKey: string,
  currentTimeMs: number,
  maxDecayMs: number,
): Promise<"NO_CROP" | "NOT_READY" | "DECAYED" | "SAFE"> {
  if (!decaySha) throw new Error("Redis scripts not loaded");
  try {
    return (await redis.evalsha(
      decaySha,
      1,
      plotKey,
      String(currentTimeMs),
      String(maxDecayMs),
    )) as "NO_CROP" | "NOT_READY" | "DECAYED" | "SAFE";
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisDecay(redis, plotKey, currentTimeMs, maxDecayMs);
    }
    throw e;
  }
}

// ── War Command Wrappers ───────────────────────────────────────────────

export type WarDeclareResult = { syndicateId: string; infamy: number };

function parseWarDeclarePayload(raw: string): WarDeclareResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 3) {
    throw new Error(`Invalid war declare payload: ${raw}`);
  }
  return { syndicateId: parts[1]!, infamy: Number(parts[2]) };
}

export async function redisWarDeclare(
  redis: Redis,
  keys: {
    userSyndicateKey: string;
    metaKey: string;
    activeWarKey: string;
    cooldownKey: string;
    matchmakingKey: string;
    infamyKey: string;
    idempKey: string;
    rolesKey: string;
    warShieldsKey: string;
  },
  args: {
    userId: string;
    syndicateId: string;
    nowMs: number;
    idempTtlSec: number;
    startingInfamy: number;
  },
): Promise<WarDeclareResult> {
  if (!warDeclareSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      warDeclareSha,
      9,
      keys.userSyndicateKey,
      keys.metaKey,
      keys.activeWarKey,
      keys.cooldownKey,
      keys.matchmakingKey,
      keys.infamyKey,
      keys.idempKey,
      keys.rolesKey,
      keys.warShieldsKey,
      args.userId,
      args.syndicateId,
      String(args.nowMs),
      String(args.idempTtlSec),
      String(args.startingInfamy),
    )) as string;
    return parseWarDeclarePayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisWarDeclare(redis, keys, args);
    }
    throw e;
  }
}

export async function redisWarMatch(
  redis: Redis,
  keys: {
    matchmakingKey: string;
    warSeqKey: string;
    activeWarsKey: string;
  },
  args: {
    bracketPct: number;
    nowMs: number;
    prepDurationMs: number;
    battleDurationMs: number;
    cooldownDurationMs: number;
    settlementDurationMs: number;
  },
): Promise<string> {
  if (!warMatchSha) throw new Error("Redis scripts not loaded");
  try {
    return (await redis.evalsha(
      warMatchSha,
      3,
      keys.matchmakingKey,
      keys.warSeqKey,
      keys.activeWarsKey,
      String(args.bracketPct),
      String(args.nowMs),
      String(args.prepDurationMs),
      String(args.battleDurationMs),
      String(args.cooldownDurationMs),
      String(args.settlementDurationMs),
    )) as string;
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisWarMatch(redis, keys, args);
    }
    throw e;
  }
}

export type RedisWarAttackResult = {
  attackId: string;
  stars: number;
  destructionBps: number;
  lootGold: number;
  lootItems: string;
};

function parseWarAttackPayload(raw: string): RedisWarAttackResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length < 5) {
    throw new Error(`Invalid war attack payload: ${raw}`);
  }
  return {
    attackId: parts[1]!,
    stars: Number(parts[2]),
    destructionBps: Number(parts[3]),
    lootGold: Number(parts[4]),
    lootItems: parts[5] ?? "",
  };
}

export async function redisWarAttack(
  redis: Redis,
  keys: {
    warStateKey: string;
    attackCountKey: string;
    attackLogKey: string;
    attackerBankGoldKey: string;
    defenderBankGoldKey: string;
    defenderBankItemsKey: string;
    attackerBankItemsKey: string;
    userSyndicateKey: string;
    defenderShieldsKey: string;
    defenderDefPowerKey: string;
    idempKey: string;
  },
  args: {
    userId: string;
    warId: string;
    targetSyndicateId: string;
    troopsCsv: string;
    nowMs: number;
    maxAttacks: number;
    idempTtlSec: number;
    troopPowerCsv: string;
    star1Bps: number;
    star2Bps: number;
    star3Bps: number;
    militiaSurgeBonusBps: number;
    cropDecoyReduceBps: number;
  },
): Promise<RedisWarAttackResult> {
  if (!warAttackSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      warAttackSha,
      11,
      keys.warStateKey,
      keys.attackCountKey,
      keys.attackLogKey,
      keys.attackerBankGoldKey,
      keys.defenderBankGoldKey,
      keys.defenderBankItemsKey,
      keys.attackerBankItemsKey,
      keys.userSyndicateKey,
      keys.defenderShieldsKey,
      keys.defenderDefPowerKey,
      keys.idempKey,
      args.userId,
      args.warId,
      args.targetSyndicateId,
      args.troopsCsv,
      String(args.nowMs),
      String(args.maxAttacks),
      String(args.idempTtlSec),
      args.troopPowerCsv,
      String(args.star1Bps),
      String(args.star2Bps),
      String(args.star3Bps),
      String(args.militiaSurgeBonusBps),
      String(args.cropDecoyReduceBps),
    )) as string;
    return parseWarAttackPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisWarAttack(redis, keys, args);
    }
    throw e;
  }
}

export async function redisWarPhaseAdvance(
  redis: Redis,
  warStateKeyStr: string,
  nowMs: number,
): Promise<string> {
  if (!warPhaseAdvanceSha) throw new Error("Redis scripts not loaded");
  try {
    return (await redis.evalsha(
      warPhaseAdvanceSha,
      1,
      warStateKeyStr,
      String(nowMs),
    )) as string;
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisWarPhaseAdvance(redis, warStateKeyStr, nowMs);
    }
    throw e;
  }
}

export type WarSettleResult = {
  winner: string;
  infamyDelta: number;
  winnerSid: string;
  loserSid: string;
};

function parseWarSettlePayload(raw: string): WarSettleResult | null {
  if (raw === "ALREADY_SETTLED" || raw === "NOT_READY") return null;
  const parts = raw.split("|");
  if (parts[0] !== "SETTLED" || parts.length !== 5) return null;
  return {
    winner: parts[1]!,
    infamyDelta: Number(parts[2]),
    winnerSid: parts[3]!,
    loserSid: parts[4]!,
  };
}

export async function redisWarSettle(
  redis: Redis,
  keys: {
    warStateKey: string;
    infamyKey: string;
    attackerActiveWarKey: string;
    defenderActiveWarKey: string;
    attackerHistoryKey: string;
    defenderHistoryKey: string;
    attackerCooldownKey: string;
    defenderCooldownKey: string;
    activeWarsKey: string;
  },
  args: {
    warId: string;
    nowMs: number;
    cooldownDurationMs: number;
    underdogStealMinBps: number;
    underdogStealMaxBps: number;
    favouriteGainBps: number;
    warTtlSec: number;
  },
): Promise<WarSettleResult | null> {
  if (!warSettleSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      warSettleSha,
      9,
      keys.warStateKey,
      keys.infamyKey,
      keys.attackerActiveWarKey,
      keys.defenderActiveWarKey,
      keys.attackerHistoryKey,
      keys.defenderHistoryKey,
      keys.attackerCooldownKey,
      keys.defenderCooldownKey,
      keys.activeWarsKey,
      args.warId,
      String(args.nowMs),
      String(args.cooldownDurationMs),
      String(args.underdogStealMinBps),
      String(args.underdogStealMaxBps),
      String(args.favouriteGainBps),
      String(args.warTtlSec),
    )) as string;
    return parseWarSettlePayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisWarSettle(redis, keys, args);
    }
    throw e;
  }
}

export type WarBuyShieldResult = { shieldType: string; expiresAtMs: number };

function parseWarBuyShieldPayload(raw: string): WarBuyShieldResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 3) {
    throw new Error(`Invalid war buy shield payload: ${raw}`);
  }
  return { shieldType: parts[1]!, expiresAtMs: Number(parts[2]) };
}

export async function redisWarBuyShield(
  redis: Redis,
  keys: {
    userSyndicateKey: string;
    rolesKey: string;
    bankGoldKey: string;
    warShieldsKey: string;
    idempKey: string;
  },
  args: {
    userId: string;
    syndicateId: string;
    shieldType: string;
    goldCost: number;
    durationMs: number;
    nowMs: number;
    idempTtlSec: number;
  },
): Promise<WarBuyShieldResult> {
  if (!warBuyShieldSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      warBuyShieldSha,
      5,
      keys.userSyndicateKey,
      keys.rolesKey,
      keys.bankGoldKey,
      keys.warShieldsKey,
      keys.idempKey,
      args.userId,
      args.syndicateId,
      args.shieldType,
      String(args.goldCost),
      String(args.durationMs),
      String(args.nowMs),
      String(args.idempTtlSec),
    )) as string;
    return parseWarBuyShieldPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisWarBuyShield(redis, keys, args);
    }
    throw e;
  }
}

// ── Troop Upgrade Wrapper ──────────────────────────────────────────────

export type UpgradeTroopResult = { troopType: string; newLevel: number; goldSpent: number };

function parseUpgradeTroopPayload(raw: string): UpgradeTroopResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 4) {
    throw new Error(`Invalid upgrade troop payload: ${raw}`);
  }
  return { troopType: parts[1]!, newLevel: Number(parts[2]), goldSpent: Number(parts[3]) };
}

export async function redisUpgradeTroop(
  redis: Redis,
  keys: {
    userSyndicateKey: string;
    rolesKey: string;
    bankGoldKey: string;
    troopLevelsKey: string;
    idempKey: string;
  },
  args: {
    userId: string;
    syndicateId: string;
    troopType: string;
    goldCost: number;
    maxLevel: number;
    idempTtlSec: number;
  },
): Promise<UpgradeTroopResult> {
  if (!upgradeTroopSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      upgradeTroopSha,
      5,
      keys.userSyndicateKey,
      keys.rolesKey,
      keys.bankGoldKey,
      keys.troopLevelsKey,
      keys.idempKey,
      args.userId,
      args.syndicateId,
      args.troopType,
      String(args.goldCost),
      String(args.maxLevel),
      String(args.idempTtlSec),
    )) as string;
    return parseUpgradeTroopPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisUpgradeTroop(redis, keys, args);
    }
    throw e;
  }
}

// ── Help Fulfill Wrapper ───────────────────────────────────────────────

export type HelpFulfillLuaResult = {
  helpRequestId: string;
  fulfillerUserId: string;
  requesterUserId: string;
  goldAmount: number;
};

function parseHelpFulfillPayload(raw: string): HelpFulfillLuaResult {
  const parts = raw.split("|");
  if (parts[0] !== "OK" || parts.length !== 5) {
    throw new Error(`Invalid help fulfill payload: ${raw}`);
  }
  return {
    helpRequestId: parts[1]!,
    fulfillerUserId: parts[2]!,
    requesterUserId: parts[3]!,
    goldAmount: Number(parts[4]),
  };
}

export async function redisHelpFulfill(
  redis: Redis,
  keys: {
    fulfillerWalletKey: string;
    requesterWalletKey: string;
    helpRequestsKey: string;
    idempKey: string;
  },
  args: {
    fulfillerUserId: string;
    requesterUserId: string;
    helpRequestId: string;
    goldAmount: number;
    nowMs: number;
    idempTtlSec: number;
  },
): Promise<HelpFulfillLuaResult> {
  if (!helpFulfillSha) throw new Error("Redis scripts not loaded");
  try {
    const res = (await redis.evalsha(
      helpFulfillSha,
      4,
      keys.fulfillerWalletKey,
      keys.requesterWalletKey,
      keys.helpRequestsKey,
      keys.idempKey,
      args.fulfillerUserId,
      args.requesterUserId,
      args.helpRequestId,
      String(args.goldAmount),
      String(args.nowMs),
      String(args.idempTtlSec),
    )) as string;
    return parseHelpFulfillPayload(res);
  } catch (e) {
    if (isReplyError(e) && e.message.includes("NOSCRIPT")) {
      await loadRedisScripts(redis);
      return redisHelpFulfill(redis, keys, args);
    }
    throw e;
  }
}
