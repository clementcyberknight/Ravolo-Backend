import type { Redis } from "ioredis";
import {
  IDEMPOTENCY_TTL_SEC,
  MAX_SYNDICATE_MEMBERS,
  MIN_SYNDICATE_CREATE_LEVEL,
  ONLINE_THRESHOLD_MS,
  PRICE_MICRO_PER_GOLD,
  SCARCITY_TOTAL_UNITS,
  PRICE_DEMAND_CLAMP,
  PRICE_SCARCITY_CLAMP,
  SPREAD_SELL_FACTOR,
} from "../../config/constants.js";
import { logger } from "../../infrastructure/logger/logger.js";
import {
  inventoryKey,
  syndicateBankGoldKey,
  syndicateBankItemsKey,
  syndicateChatKey,
  syndicateContributionGoldKey,
  syndicateContributionItemsKey,
  syndicateIdolKey,
  syndicateIdolRequestKey,
  syndicateJoinRequestsKey,
  syndicateMemberRolesKey,
  syndicateMembersKey,
  syndicateMemberSeenKey,
  syndicateMetaKey,
  syndicateNameIndexKey,
  syndicateSeqKey,
  syndicateShieldExpiresAtKey,
  userAttackCooldownKey,
  userLastSeenKey,
  userLevelKey,
  userProfileKey,
  userSyndicateIdKey,
  userPendingSyndicateIdKey,
  walletKey,
  syndicateHoldingsKey,
  treasurySellPricesKey,
  treasuryBuyFlowKey,
  treasurySellFlowKey,
  treasuryReserveKey,
} from "../../infrastructure/redis/keys.js";
import {
  redisSyndicateAcceptJoin,
  redisSyndicateAttack,
  redisSyndicateBankSell,
  redisSyndicateBuyShield,
  redisSyndicateCreate,
  redisSyndicateDeposit,
  redisSyndicateIdolContribute,
  redisSyndicateKickMember,
  redisSyndicateLeaveOrDisband,
  redisSyndicatePromoteDemote,
  redisSyndicateRemoveJoinRequest,
  redisSyndicateRequestJoin,
} from "../../infrastructure/redis/commands.js";
import { AppError } from "../../shared/errors/appError.js";
import { sellPayoutGold, toSafeGold } from "../../shared/utils/gold.js";
import { isTreasurySellable, produceBasePriceMicro, resolveBaseMicro } from "../market/market.catalog.js";
import { getEventMultiplier } from "../ai-events/event.service.js";
import { OnboardingService } from "../onboarding/onboarding.service.js";
import { SyndicateRepository } from "./syndicate.repository.js";
import type {
  AcceptJoinCommand,
  AttackSyndicateCommand,
  BankSellCommand,
  BankSellResult,
  BuyShieldCommand,
  CancelJoinRequestCommand,
  CommodityStat,
  CreateSyndicateCommand,
  DashboardMember,
  DemoteMemberCommand,
  DepositBankCommand,
  DisbandSyndicateCommand,
  IdolContributeCommand,
  KickMemberCommand,
  LeaveSyndicateCommand,
  ListSyndicatesQuery,
  PromoteMemberCommand,
  RejectJoinRequestCommand,
  RequestJoinCommand,
  SyndicateChatSendCommand,
  SyndicateDashboardQuery,
  SyndicateDashboardView,
  SyndicateMember,
  SyndicateSummary,
  SyndicateView,
  ViewBankQuery,
  ViewContributionQuery,
  ViewSyndicateMemberQuery,
} from "./syndicate.types.js";
import {
  acceptJoinSchema,
  attackSyndicateSchema,
  bankSellSchema,
  buyShieldSchema,
  cancelJoinRequestSchema,
  createSyndicateSchema,
  demoteMemberSchema,
  depositBankSchema,
  disbandSyndicateSchema,
  idolContributeSchema,
  kickMemberSchema,
  leaveSyndicateSchema,
  promoteMemberSchema,
  rejectJoinRequestSchema,
  requestJoinSchema,
  syndicateChatSendSchema,
  syndicateDashboardSchema,
  viewBankSchema,
  viewContributionSchema,
  viewSyndicateMemberSchema,
} from "./syndicate.validator.js";

const CHAT_MAX = 200;

function toInt(n: unknown, fallback: number): number {
  const x = Number(n);
  return Number.isFinite(x) ? Math.floor(x) : fallback;
}

function nowMs(): number {
  return Date.now();
}

export class SyndicateService {
  constructor(
    private readonly redis: Redis,
    private readonly repo = new SyndicateRepository(),
    private readonly onboarding = new OnboardingService(redis),
  ) {}

  async list(
    userId: string,
    raw: unknown,
  ): Promise<{ syndicates: SyndicateSummary[] }> {
    await this.onboarding.ensureOnboarded(userId);
    const q = (raw ?? {}) as ListSyndicatesQuery;
    const includePrivate = q.includePrivate === true;
    const ids = await this.repo.listIds(this.redis, includePrivate);

    const out: SyndicateSummary[] = [];
    for (const id of ids) {
      const meta = await this.repo.getMeta(this.redis, id);
      if (!meta.id) continue;
      if (!includePrivate && meta.visibility !== "public") continue;

      const members = await this.redis.scard(syndicateMembersKey(id));
      const shield = await this.repo.shieldExpiresAtMs(this.redis, id);
      const idolLevel = await this.repo.idolLevel(this.redis, id);
      out.push({
        id,
        name: meta.name ?? "",
        description: meta.description ?? "",
        visibility: (meta.visibility as "public" | "private") ?? "public",
        levelPreferenceMin: toInt(meta.levelPreferenceMin, 1),
        goldPreferenceMin: toInt(meta.goldPreferenceMin, 0),
        members: Number.isFinite(members) ? members : 0,
        shieldExpiresAtMs: shield,
        idolLevel,
        emblemId: meta.emblemId ?? "emblem:default",
      });
    }

    return { syndicates: out };
  }

  async view(userId: string, raw: unknown): Promise<SyndicateView> {
    await this.onboarding.ensureOnboarded(userId);
    const syndicateId = (raw as { syndicateId?: unknown })?.syndicateId;
    if (typeof syndicateId !== "string" || !syndicateId) {
      throw new AppError("BAD_REQUEST", "syndicateId required");
    }

    const meta = await this.repo.getMeta(this.redis, syndicateId);
    if (!meta.id)
      throw new AppError("NO_SUCH_SYNDICATE", "Syndicate not found");

    const memberIds = await this.repo.getMemberIds(this.redis, syndicateId);
    const roles = await this.repo.getMemberRoles(
      this.redis,
      syndicateId,
      memberIds,
    );
    const seen = await this.repo.getMemberSeen(
      this.redis,
      syndicateId,
      memberIds,
    );
    const lvls = await this.repo.getMemberLevels(this.redis, memberIds);
    const names = await this.repo.getMemberUsernames(this.redis, memberIds);
    const membersList: SyndicateMember[] = memberIds.map((uid) => ({
      userId: uid,
      username: names[uid] ?? "",
      role: (roles[uid] as SyndicateMember["role"]) ?? "member",
      level: lvls[uid] ?? 1,
      lastSeenAtMs: seen[uid] ?? 0,
    }));

    const shield = await this.repo.shieldExpiresAtMs(this.redis, syndicateId);
    const idolLevel = await this.repo.idolLevel(this.redis, syndicateId);

    const isMember = memberIds.includes(userId);
    const role = roles[userId] ?? "member";
    let joinRequests: SyndicateView["joinRequests"] | undefined;
    if (isMember && (role === "owner" || role === "officer")) {
      const reqs = await this.repo.joinRequests(this.redis, syndicateId);
      const jlvls = await this.repo.getMemberLevels(this.redis, reqs);
      const jnames = await this.repo.getMemberUsernames(this.redis, reqs);
      joinRequests = reqs.map((u) => ({
        userId: u,
        username: jnames[u] ?? "",
        requestedAtMs: 0,
        level: jlvls[u] ?? 1,
      }));
    }

    return {
      id: syndicateId,
      name: meta.name ?? "",
      description: meta.description ?? "",
      visibility: (meta.visibility as "public" | "private") ?? "public",
      levelPreferenceMin: toInt(meta.levelPreferenceMin, 1),
      goldPreferenceMin: toInt(meta.goldPreferenceMin, 0),
      members: membersList.length,
      shieldExpiresAtMs: shield,
      idolLevel,
      emblemId: meta.emblemId ?? "emblem:default",
      ownerId: meta.ownerId ?? "",
      createdAtMs: toInt(meta.createdAtMs, 0),
      joinRequests,
      membersList,
    };
  }

  async create(userId: string, raw: unknown): Promise<{ syndicateId: string }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = createSyndicateSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid create syndicate payload", {
        issues: parsed.error.issues,
      });
    const cmd = parsed.data as CreateSyndicateCommand;

    try {
      const res = await redisSyndicateCreate(
        this.redis,
        {
          seqKey: syndicateSeqKey(),
          userSyndicateKey: userSyndicateIdKey(userId),
          userLevelKey: userLevelKey(userId),
          nameIndexKey: syndicateNameIndexKey(),
          indexAllKey: "ravolo:syndicate:index:all",
          indexPublicKey: "ravolo:syndicate:index:public",
          idempKey: `ravolo:${userId}:idemp:syndicate_create:${cmd.requestId}`,
          userPendingSyndicateKey: userPendingSyndicateIdKey(userId),
        },
        {
          userId,
          minLevel: MIN_SYNDICATE_CREATE_LEVEL,
          name: cmd.name,
          description: cmd.description,
          visibility: cmd.visibility,
          levelPrefMin: cmd.levelPreferenceMin,
          goldPrefMin: cmd.goldPreferenceMin,
          nowMs: nowMs(),
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
          syndicateKeyPrefix: "ravolo:syndicate:",
          emblemId: cmd.emblemId,
        },
      );
      return { syndicateId: res.syndicateId };
    } catch (e) {
      throw this.mapLuaError(e);
    }
  }

  async requestJoin(userId: string, raw: unknown): Promise<{ ok: true }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = requestJoinSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid request join payload", {
        issues: parsed.error.issues,
      });
    const cmd = parsed.data as RequestJoinCommand;

    try {
      await redisSyndicateRequestJoin(
        this.redis,
        {
          userSyndicateKey: userSyndicateIdKey(userId),
          metaKey: syndicateMetaKey(cmd.syndicateId),
          membersKey: syndicateMembersKey(cmd.syndicateId),
          rolesKey: syndicateMemberRolesKey(cmd.syndicateId),
          joinReqKey: syndicateJoinRequestsKey(cmd.syndicateId),
          idempKey: `ravolo:${userId}:idemp:syndicate_join_req:${cmd.requestId}`,
          userLevelKey: userLevelKey(userId),
          userWalletKey: walletKey(userId),
          userPendingSyndicateKey: userPendingSyndicateIdKey(userId),
        },
        { userId, nowMs: nowMs(), idempTtlSec: IDEMPOTENCY_TTL_SEC, maxMembers: MAX_SYNDICATE_MEMBERS },
      );
    } catch (e) {
      throw this.mapLuaError(e);
    }

    return { ok: true };
  }

  async acceptJoin(userId: string, raw: unknown): Promise<{ ok: true }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = acceptJoinSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid accept join payload", {
        issues: parsed.error.issues,
      });
    const cmd = parsed.data as AcceptJoinCommand;

    try {
      await redisSyndicateAcceptJoin(
        this.redis,
        {
          actorUserSyndicateKey: userSyndicateIdKey(userId),
          metaKey: syndicateMetaKey(cmd.syndicateId),
          joinReqKey: syndicateJoinRequestsKey(cmd.syndicateId),
          membersKey: syndicateMembersKey(cmd.syndicateId),
          rolesKey: syndicateMemberRolesKey(cmd.syndicateId),
          targetUserSyndicateKey: userSyndicateIdKey(cmd.userId),
          idempKey: `ravolo:${userId}:idemp:syndicate_accept:${cmd.requestId}`,
          targetUserPendingSyndicateKey: userPendingSyndicateIdKey(cmd.userId),
        },
        {
          actorUserId: userId,
          targetUserId: cmd.userId,
          nowMs: nowMs(),
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
          maxMembers: MAX_SYNDICATE_MEMBERS,
        },
      );
    } catch (e) {
      throw this.mapLuaError(e);
    }

    return { ok: true };
  }

  async deposit(userId: string, raw: unknown): Promise<{ ok: true }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = depositBankSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid deposit payload", {
        issues: parsed.error.issues,
      });
    const cmd = parsed.data as DepositBankCommand;

    try {
      await redisSyndicateDeposit(
        this.redis,
        {
          userSyndicateKey: userSyndicateIdKey(userId),
          userWalletKey: walletKey(userId),
          userInvKey: inventoryKey(userId),
          bankGoldKey: syndicateBankGoldKey(cmd.syndicateId),
          bankItemsKey: syndicateBankItemsKey(cmd.syndicateId),
          contribGoldKey: syndicateContributionGoldKey(cmd.syndicateId),
          contribItemsKey: syndicateContributionItemsKey(cmd.syndicateId),
          idempKey: `ravolo:${userId}:idemp:syndicate_deposit:${cmd.requestId}`,
          holdingsKey: syndicateHoldingsKey(cmd.syndicateId),
        },
        {
          userId,
          syndicateId: cmd.syndicateId,
          kind: cmd.kind,
          itemId: cmd.kind === "item" ? cmd.itemId : "",
          amount: cmd.amount,
          nowMs: nowMs(),
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
        },
      );
    } catch (e) {
      throw this.mapLuaError(e);
    }

    return { ok: true };
  }

  async bankSell(userId: string, raw: unknown): Promise<BankSellResult> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = bankSellSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid bank sell payload", {
        issues: parsed.error.issues,
      });
    const cmd = parsed.data as BankSellCommand;

    if (!isTreasurySellable(cmd.itemId))
      throw new AppError("UNKNOWN_ITEM", "Item cannot be sold to treasury", {
        item: cmd.itemId,
      });

    let priceMicro = toInt(
      await this.redis.hget(treasurySellPricesKey(), cmd.itemId),
      0,
    );
    if (priceMicro < 1) {
      priceMicro = Math.max(
        1,
        Math.round(produceBasePriceMicro(cmd.itemId) * SPREAD_SELL_FACTOR),
      );
    }

    const eventMul = await getEventMultiplier(this.redis, cmd.itemId);
    priceMicro = Math.max(1, Math.floor(priceMicro * eventMul));

    const goldPaid = toSafeGold(sellPayoutGold(priceMicro, cmd.quantity));

    try {
      const res = await redisSyndicateBankSell(
        this.redis,
        {
          userSyndicateKey: userSyndicateIdKey(userId),
          rolesKey: syndicateMemberRolesKey(cmd.syndicateId),
          bankItemsKey: syndicateBankItemsKey(cmd.syndicateId),
          bankGoldKey: syndicateBankGoldKey(cmd.syndicateId),
          treasuryReserveKey: treasuryReserveKey(),
          sellFlowKey: treasurySellFlowKey(),
          holdingsKey: syndicateHoldingsKey(cmd.syndicateId),
          idempKey: `ravolo:${userId}:idemp:syndicate_bank_sell:${cmd.requestId}`,
        },
        {
          userId,
          syndicateId: cmd.syndicateId,
          item: cmd.itemId,
          quantity: cmd.quantity,
          goldPayout: goldPaid,
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
          nowMs: nowMs(),
        },
      );
      return {
        item: res.item,
        quantity: res.quantity,
        goldPaid: res.goldPaid,
        priceMicro,
      };
    } catch (e) {
      throw this.mapLuaError(e);
    }
  }

  async buyShield(
    userId: string,
    raw: unknown,
  ): Promise<{ shieldExpiresAtMs: number }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = buyShieldSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid buy shield payload", {
        issues: parsed.error.issues,
      });
    const cmd = parsed.data as BuyShieldCommand;

    let res;
    try {
      res = await redisSyndicateBuyShield(
        this.redis,
        {
          userSyndicateKey: userSyndicateIdKey(userId),
          bankGoldKey: syndicateBankGoldKey(cmd.syndicateId),
          shieldKey: syndicateShieldExpiresAtKey(cmd.syndicateId),
          idempKey: `ravolo:${userId}:idemp:syndicate_shield:${cmd.requestId}`,
        },
        {
          userId,
          syndicateId: cmd.syndicateId,
          goldPaid: cmd.goldPaid,
          nowMs: nowMs(),
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
        },
      );
    } catch (e) {
      throw this.mapLuaError(e);
    }

    return { shieldExpiresAtMs: res.shieldExpiresAtMs };
  }

  async attack(
    userId: string,
    raw: unknown,
  ): Promise<{
    ok: true;
    lootGold: number;
    lootItemId?: string;
    lootItemQty?: number;
  }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = attackSyndicateSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid attack payload", {
        issues: parsed.error.issues,
      });
    const cmd = parsed.data as AttackSyndicateCommand;

    const attackerSid = await this.redis.get(userSyndicateIdKey(userId));
    if (!attackerSid)
      throw new AppError("NOT_IN_SYNDICATE", "Not in a syndicate");

    let res;
    try {
      res = await redisSyndicateAttack(
        this.redis,
        {
          attackerUserSyndicateKey: userSyndicateIdKey(userId),
          attackerBankGoldKey: syndicateBankGoldKey(attackerSid),
          attackerBankItemsKey: syndicateBankItemsKey(attackerSid),
          targetMetaKey: syndicateMetaKey(cmd.targetSyndicateId),
          targetBankGoldKey: syndicateBankGoldKey(cmd.targetSyndicateId),
          targetBankItemsKey: syndicateBankItemsKey(cmd.targetSyndicateId),
          targetShieldKey: syndicateShieldExpiresAtKey(cmd.targetSyndicateId),
          attackerCooldownKey: userAttackCooldownKey(userId),
          idempKey: `ravolo:${userId}:idemp:syndicate_attack:${cmd.requestId}`,
        },
        {
          userId,
          attackerSyndicateId: attackerSid,
          targetSyndicateId: cmd.targetSyndicateId,
          attackPower: cmd.attackPower,
          lootGoldMax: cmd.lootGoldMax,
          lootItemId: cmd.lootItemId ?? "",
          lootItemMax: cmd.lootItemMax ?? 0,
          nowMs: nowMs(),
          cooldownMs: 60_000,
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
        },
      );
    } catch (e) {
      throw this.mapLuaError(e);
    }

    return {
      ok: true,
      lootGold: res.lootGold,
      lootItemId: res.lootItemId || undefined,
      lootItemQty: res.lootItemQty || undefined,
    };
  }

  async idolContribute(
    userId: string,
    raw: unknown,
  ): Promise<{ ok: true; fulfilled: boolean }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = idolContributeSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid idol contribute payload", {
        issues: parsed.error.issues,
      });
    const cmd = parsed.data as IdolContributeCommand;

    let res;
    try {
      res = await redisSyndicateIdolContribute(
        this.redis,
        {
          userSyndicateKey: userSyndicateIdKey(userId),
          bankItemsKey: syndicateBankItemsKey(cmd.syndicateId),
          idolReqKey: syndicateIdolRequestKey(cmd.syndicateId, cmd.requestKey),
          idolKey: syndicateIdolKey(cmd.syndicateId),
          idempKey: `ravolo:${userId}:idemp:syndicate_idol:${cmd.requestId}`,
        },
        {
          userId,
          syndicateId: cmd.syndicateId,
          requestKey: cmd.requestKey,
          itemId: cmd.itemId,
          amount: cmd.amount,
          nowMs: nowMs(),
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
        },
      );
    } catch (e) {
      throw this.mapLuaError(e);
    }

    return { ok: true, fulfilled: res.fulfilled };
  }

  async leave(userId: string, raw: unknown): Promise<{ ok: true }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = leaveSyndicateSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid leave payload", {
        issues: parsed.error.issues,
      });
    const cmd = parsed.data as LeaveSyndicateCommand;

    try {
      await redisSyndicateLeaveOrDisband(
        this.redis,
        {
          userSyndicateKey: userSyndicateIdKey(userId),
          indexAllKey: "ravolo:syndicate:index:all",
          indexPublicKey: "ravolo:syndicate:index:public",
          nameIndexKey: syndicateNameIndexKey(),
          idempKey: `ravolo:${userId}:idemp:syndicate_leave:${cmd.requestId}`,
        },
        {
          userId,
          syndicateId: "",
          mode: "leave",
          nowMs: nowMs(),
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
        },
      );
    } catch (e) {
      throw this.mapLuaError(e);
    }
    return { ok: true };
  }

  async cancelJoinRequest(
    userId: string,
    raw: unknown,
  ): Promise<{ ok: true }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = cancelJoinRequestSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid cancel join request payload", {
        issues: parsed.error.issues,
      });
    const cmd = parsed.data as CancelJoinRequestCommand;

    try {
      await redisSyndicateRemoveJoinRequest(
        this.redis,
        {
          actorUserSyndicateKey: userSyndicateIdKey(userId),
          joinReqKey: syndicateJoinRequestsKey(cmd.syndicateId),
          targetUserPendingSyndicateKey: userPendingSyndicateIdKey(userId),
          rolesKey: syndicateMemberRolesKey(cmd.syndicateId),
          idempKey: `ravolo:${userId}:idemp:syndicate_cancel_join:${cmd.requestId}`,
        },
        {
          actorUserId: userId,
          targetUserId: userId,
          syndicateId: cmd.syndicateId,
          mode: "cancel",
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
        },
      );
    } catch (e) {
      throw this.mapLuaError(e);
    }
    return { ok: true };
  }

  async rejectJoinRequest(
    userId: string,
    raw: unknown,
  ): Promise<{ ok: true }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = rejectJoinRequestSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid reject join request payload", {
        issues: parsed.error.issues,
      });
    const cmd = parsed.data as RejectJoinRequestCommand;

    try {
      await redisSyndicateRemoveJoinRequest(
        this.redis,
        {
          actorUserSyndicateKey: userSyndicateIdKey(userId),
          joinReqKey: syndicateJoinRequestsKey(cmd.syndicateId),
          targetUserPendingSyndicateKey: userPendingSyndicateIdKey(cmd.userId),
          rolesKey: syndicateMemberRolesKey(cmd.syndicateId),
          idempKey: `ravolo:${userId}:idemp:syndicate_reject_join:${cmd.requestId}`,
        },
        {
          actorUserId: userId,
          targetUserId: cmd.userId,
          syndicateId: cmd.syndicateId,
          mode: "reject",
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
        },
      );
    } catch (e) {
      throw this.mapLuaError(e);
    }
    return { ok: true };
  }

  async kickMember(userId: string, raw: unknown): Promise<{ ok: true }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = kickMemberSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid kick member payload", {
        issues: parsed.error.issues,
      });
    const cmd = parsed.data as KickMemberCommand;

    try {
      await redisSyndicateKickMember(
        this.redis,
        {
          actorUserSyndicateKey: userSyndicateIdKey(userId),
          membersKey: syndicateMembersKey(cmd.syndicateId),
          rolesKey: syndicateMemberRolesKey(cmd.syndicateId),
          targetUserSyndicateKey: userSyndicateIdKey(cmd.userId),
          idempKey: `ravolo:${userId}:idemp:syndicate_kick:${cmd.requestId}`,
        },
        {
          actorUserId: userId,
          targetUserId: cmd.userId,
          syndicateId: cmd.syndicateId,
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
        },
      );
    } catch (e) {
      throw this.mapLuaError(e);
    }
    return { ok: true };
  }

  async promoteMember(userId: string, raw: unknown): Promise<{ ok: true }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = promoteMemberSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid promote member payload", {
        issues: parsed.error.issues,
      });
    const cmd = parsed.data as PromoteMemberCommand;

    try {
      await redisSyndicatePromoteDemote(
        this.redis,
        {
          actorUserSyndicateKey: userSyndicateIdKey(userId),
          rolesKey: syndicateMemberRolesKey(cmd.syndicateId),
          idempKey: `ravolo:${userId}:idemp:syndicate_promote:${cmd.requestId}`,
        },
        {
          actorUserId: userId,
          targetUserId: cmd.userId,
          syndicateId: cmd.syndicateId,
          mode: "promote",
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
          maxAdmins: 10,
        },
      );
    } catch (e) {
      throw this.mapLuaError(e);
    }
    return { ok: true };
  }

  async demoteMember(userId: string, raw: unknown): Promise<{ ok: true }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = demoteMemberSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid demote member payload", {
        issues: parsed.error.issues,
      });
    const cmd = parsed.data as DemoteMemberCommand;

    try {
      await redisSyndicatePromoteDemote(
        this.redis,
        {
          actorUserSyndicateKey: userSyndicateIdKey(userId),
          rolesKey: syndicateMemberRolesKey(cmd.syndicateId),
          idempKey: `ravolo:${userId}:idemp:syndicate_demote:${cmd.requestId}`,
        },
        {
          actorUserId: userId,
          targetUserId: cmd.userId,
          syndicateId: cmd.syndicateId,
          mode: "demote",
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
          maxAdmins: 10,
        },
      );
    } catch (e) {
      throw this.mapLuaError(e);
    }
    return { ok: true };
  }

  async disband(userId: string, raw: unknown): Promise<{ ok: true }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = disbandSyndicateSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid disband payload", {
        issues: parsed.error.issues,
      });
    const cmd = parsed.data as DisbandSyndicateCommand;

    try {
      await redisSyndicateLeaveOrDisband(
        this.redis,
        {
          userSyndicateKey: userSyndicateIdKey(userId),
          indexAllKey: "ravolo:syndicate:index:all",
          indexPublicKey: "ravolo:syndicate:index:public",
          nameIndexKey: syndicateNameIndexKey(),
          idempKey: `ravolo:${userId}:idemp:syndicate_disband:${cmd.requestId}`,
        },
        {
          userId,
          syndicateId: cmd.syndicateId,
          mode: "disband",
          nowMs: nowMs(),
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
        },
      );
    } catch (e) {
      throw this.mapLuaError(e);
    }
    return { ok: true };
  }

  private mapLuaError(e: unknown): AppError {
    if (typeof e === "object" && e !== null && "message" in e) {
      const msg = String((e as { message: string }).message);
      if (msg.includes("ERR_ALREADY_IN_SYNDICATE"))
        return new AppError("ALREADY_IN_SYNDICATE", "Already in a syndicate");
      if (msg.includes("ERR_LEVEL_TOO_LOW"))
        return new AppError("LEVEL_TOO_LOW", "Level too low", {
          minLevel: MIN_SYNDICATE_CREATE_LEVEL,
        });
      if (msg.includes("ERR_NAME_TAKEN"))
        return new AppError("NAME_TAKEN", "Syndicate name already taken");
      if (msg.includes("ERR_NO_SUCH_SYNDICATE"))
        return new AppError("NO_SUCH_SYNDICATE", "Syndicate not found");
      if (msg.includes("ERR_NOT_MEMBER"))
        return new AppError("NOT_MEMBER", "Not a syndicate member");
      if (msg.includes("ERR_NOT_AUTHORIZED"))
        return new AppError("NOT_AUTHORIZED", "Not authorized");
      if (msg.includes("ERR_JOIN_REQUEST_MISSING"))
        return new AppError("JOIN_REQUEST_MISSING", "Join request missing");
      if (msg.includes("ERR_ALREADY_REQUESTED"))
        return new AppError("ALREADY_REQUESTED", "Already have a pending join request");
      if (msg.includes("ERR_TARGET_ALREADY_IN_SYNDICATE"))
        return new AppError(
          "TARGET_ALREADY_IN_SYNDICATE",
          "Target already in a syndicate",
        );
      if (msg.includes("ERR_ATTACK_COOLDOWN"))
        return new AppError("ATTACK_COOLDOWN", "Attack cooldown active");
      if (msg.includes("ERR_OWNER_CANNOT_LEAVE"))
        return new AppError(
          "OWNER_CANNOT_LEAVE",
          "Owner cannot leave; disband instead",
        );
      if (msg.includes("ERR_TOO_MANY_MEMBERS"))
        return new AppError(
          "TOO_MANY_MEMBERS",
          "Too many members to disband safely",
        );
      if (msg.includes("ERR_NO_IDOL_REQUEST"))
        return new AppError("NO_IDOL_REQUEST", "No active idol request");
      if (msg.includes("ERR_INSUFFICIENT_GOLD"))
        return new AppError("INSUFFICIENT_GOLD", "Insufficient gold");
      if (msg.includes("ERR_INSUFFICIENT_INV"))
        return new AppError("INSUFFICIENT_INV", "Insufficient inventory");
      if (msg.includes("ERR_BAD_ARGS"))
        return new AppError("BAD_REQUEST", "Invalid request");
      if (msg.includes("ERR_CANNOT_KICK_SELF"))
        return new AppError("BAD_REQUEST", "Cannot kick self");
      if (msg.includes("ERR_TARGET_NOT_IN_SYNDICATE"))
        return new AppError("BAD_REQUEST", "Target not in syndicate");
      if (msg.includes("ERR_CANNOT_KICK_OWNER"))
        return new AppError("BAD_REQUEST", "Cannot kick owner");
      if (msg.includes("ERR_ALREADY_ADMIN"))
        return new AppError("BAD_REQUEST", "Member is already an admin");
      if (msg.includes("ERR_MAX_ADMINS_REACHED"))
        return new AppError("MAX_ADMINS_REACHED", "Max 10 admins allowed");
      if (msg.includes("ERR_ALREADY_MEMBER"))
        return new AppError("BAD_REQUEST", "Target is already a member");
      if (msg.includes("ERR_CANNOT_DEMOTE_OWNER"))
        return new AppError("BAD_REQUEST", "Cannot demote owner");
      if (msg.includes("ERR_TREASURY_DEPLETED"))
        return new AppError("TREASURY_DEPLETED", "Treasury depleted");
    }
    logger.error({ err: e }, "unmapped syndicate lua error");
    return new AppError("INTERNAL", "Internal error");
  }

  async ensureOnboarded(userId: string): Promise<void> {
    return this.onboarding.ensureOnboarded(userId);
  }

  async getUserSyndicateId(userId: string): Promise<string | null> {
    return this.redis.get(userSyndicateIdKey(userId));
  }

  async viewMembers(
    userId: string,
    raw: unknown,
  ): Promise<{ members: SyndicateMember[] }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = viewSyndicateMemberSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid view members payload");
    const { syndicateId } = parsed.data as ViewSyndicateMemberQuery;

    const sid = await this.redis.get(userSyndicateIdKey(userId));
    if (!sid || sid !== syndicateId)
      throw new AppError("NOT_MEMBER" as never, "Not a member");

    const memberIds = await this.repo.getMemberIds(this.redis, syndicateId);
    const roles = await this.repo.getMemberRoles(this.redis, syndicateId, memberIds);
    const seen = await this.repo.getMemberSeen(this.redis, syndicateId, memberIds);
    const lvls = await this.repo.getMemberLevels(this.redis, memberIds);
    const names = await this.repo.getMemberUsernames(this.redis, memberIds);
    const members: SyndicateMember[] = memberIds.map((uid) => ({
      userId: uid,
      username: names[uid] ?? "",
      role: (roles[uid] as SyndicateMember["role"]) ?? "member",
      level: lvls[uid] ?? 1,
      lastSeenAtMs: seen[uid] ?? 0,
    }));
    return { members };
  }

  async viewGoldBank(
    userId: string,
    raw: unknown,
  ): Promise<{ gold: number }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = viewBankSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid view bank payload");
    const { syndicateId } = parsed.data as ViewBankQuery;

    const sid = await this.redis.get(userSyndicateIdKey(userId));
    if (!sid || sid !== syndicateId)
      throw new AppError("NOT_MEMBER" as never, "Not a member");

    const gold = await this.repo.bankGold(this.redis, syndicateId);
    return { gold };
  }

  async viewCommodityBank(
    userId: string,
    raw: unknown,
  ): Promise<{ commodities: Record<string, number> }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = viewBankSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid view bank payload");
    const { syndicateId } = parsed.data as ViewBankQuery;

    const sid = await this.redis.get(userSyndicateIdKey(userId));
    if (!sid || sid !== syndicateId)
      throw new AppError("NOT_MEMBER" as never, "Not a member");

    const commodities = await this.repo.bankItems(this.redis, syndicateId);
    return { commodities };
  }

  async viewMemberContribution(
    userId: string,
    raw: unknown,
  ): Promise<{ gold: number; items: Record<string, number> }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = viewContributionSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid view contribution payload");
    const { syndicateId, userId: targetUserId } =
      parsed.data as ViewContributionQuery;

    const sid = await this.redis.get(userSyndicateIdKey(userId));
    if (!sid || sid !== syndicateId)
      throw new AppError("NOT_MEMBER" as never, "Not a member");

    const gold = await this.repo.memberContributionGold(
      this.redis,
      syndicateId,
      targetUserId,
    );
    const items = await this.repo.memberContributionItems(
      this.redis,
      syndicateId,
      targetUserId,
    );
    return { gold, items };
  }

  async chatSend(userId: string, raw: unknown): Promise<{ ok: true }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = syndicateChatSendSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid chat payload", {
        issues: parsed.error.issues,
      });
    const cmd = parsed.data as SyndicateChatSendCommand;

    const sid = await this.redis.get(userSyndicateIdKey(userId));
    if (!sid || sid !== cmd.syndicateId) {
      throw new AppError(
        "NOT_MEMBER" as never,
        "Not a member of this syndicate",
      );
    }

    const line = JSON.stringify({ ts: nowMs(), userId, text: cmd.text });
    const k = syndicateChatKey(cmd.syndicateId);
    await this.redis.multi().rpush(k, line).ltrim(k, -CHAT_MAX, -1).exec();
    return { ok: true };
  }

  async chatList(
    userId: string,
    raw: unknown,
  ): Promise<{ messages: unknown[] }> {
    await this.onboarding.ensureOnboarded(userId);
    const syndicateId = (raw as { syndicateId?: unknown })?.syndicateId;
    if (typeof syndicateId !== "string" || !syndicateId)
      throw new AppError("BAD_REQUEST", "syndicateId required");

    const sid = await this.redis.get(userSyndicateIdKey(userId));
    if (!sid || sid !== syndicateId)
      throw new AppError("NOT_MEMBER" as never, "Not a member");

    const rows = await this.repo.chatRecent(this.redis, syndicateId, 50);
    const msgs = rows
      .map((x) => {
        try {
          return JSON.parse(x) as unknown;
        } catch {
          return null;
        }
      })
      .filter((x) => x !== null);
    return { messages: msgs };
  }

  async dashboard(userId: string, raw: unknown): Promise<SyndicateDashboardView> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = syndicateDashboardSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid dashboard payload");
    const { syndicateId } = parsed.data as SyndicateDashboardQuery;

    const sid = await this.redis.get(userSyndicateIdKey(userId));
    if (!sid || sid !== syndicateId)
      throw new AppError("NOT_MEMBER" as never, "Not a member");

    const now = nowMs();

    // ── Pipeline 1: all syndicate-scoped + global market reads ────────────
    const p1 = this.redis.multi();
    p1.hgetall(syndicateMetaKey(syndicateId));                        // 0
    p1.get(syndicateBankGoldKey(syndicateId));                        // 1
    p1.hgetall(syndicateBankItemsKey(syndicateId));                   // 2
    p1.get(syndicateShieldExpiresAtKey(syndicateId));                 // 3
    p1.hgetall(syndicateIdolKey(syndicateId));                        // 4
    p1.smembers(syndicateMembersKey(syndicateId));                    // 5
    p1.hgetall(syndicateContributionItemsKey(syndicateId));           // 6
    p1.hgetall(treasurySellPricesKey());                              // 7
    p1.hgetall(treasuryBuyFlowKey());                                 // 8
    p1.hgetall(treasurySellFlowKey());                                // 9
    p1.smembers(syndicateJoinRequestsKey(syndicateId));               // 10
    const r1 = await p1.exec();
    if (!r1) throw new AppError("INTERNAL", "Redis pipeline failed");

    const meta    = (r1[0]?.[1] as Record<string, string>) ?? {};
    const bankGoldRaw = r1[1]?.[1] as string | null;
    const bankItemsRaw = (r1[2]?.[1] as Record<string, string>) ?? {};
    const shieldRaw   = r1[3]?.[1] as string | null;
    const idolRaw     = (r1[4]?.[1] as Record<string, string>) ?? {};
    const memberIds   = (r1[5]?.[1] as string[]) ?? [];
    const contribItemsRaw = (r1[6]?.[1] as Record<string, string>) ?? {};
    const sellPricesRaw   = (r1[7]?.[1] as Record<string, string>) ?? {};
    const buyFlowRaw      = (r1[8]?.[1] as Record<string, string>) ?? {};
    const sellFlowRaw     = (r1[9]?.[1] as Record<string, string>) ?? {};
    const joinReqIds      = (r1[10]?.[1] as string[]) ?? [];

    if (!meta.id) throw new AppError("NO_SUCH_SYNDICATE", "Syndicate not found");

    // ── Pipeline 2: per-member roles, seen, levels + join req levels ──────
    const p2 = this.redis.multi();
    if (memberIds.length > 0) {
      p2.hmget(syndicateMemberRolesKey(syndicateId), ...memberIds);     // 0
      p2.hmget(syndicateMemberSeenKey(syndicateId), ...memberIds);      // 1
    }
    for (const uid of memberIds) {
      p2.hget(userLevelKey(uid), "level");                              // 2..N
      p2.hget(userProfileKey(uid), "username");
    }
    for (const uid of joinReqIds) {
      p2.hget(userLevelKey(uid), "level");
      p2.hget(userProfileKey(uid), "username");
    }
    const r2 = await p2.exec();

    const rolesArr = memberIds.length > 0
      ? (r2?.[0]?.[1] as (string | null)[]) ?? []
      : [];
    const seenArr = memberIds.length > 0
      ? (r2?.[1]?.[1] as (string | null)[]) ?? []
      : [];
    const levelOffset = memberIds.length > 0 ? 2 : 0;

    // ── Build member list ─────────────────────────────────────────────────
    let onlineCount = 0;
    const members: DashboardMember[] = memberIds.map((uid, i) => {
      const role = (rolesArr[i] ?? "member") as DashboardMember["role"];
      const lastSeenAtMs = toInt(seenArr[i], 0);
      const levelRaw = r2?.[levelOffset + (i * 2)]?.[1];
      const nameRaw = r2?.[levelOffset + (i * 2) + 1]?.[1];
      const level = toInt(levelRaw, 1) || 1;
      const username = typeof nameRaw === "string" ? nameRaw : `User ${uid.slice(0, 8)}`;
      const online = now - lastSeenAtMs < ONLINE_THRESHOLD_MS;
      if (online) onlineCount++;
      return { userId: uid, username, role, level, lastSeenAtMs, online };
    });

    const actorRole = rolesArr[memberIds.indexOf(userId)] ?? "member";
    let joinRequests: SyndicateDashboardView["joinRequests"];
    if (actorRole === "owner" || actorRole === "officer") {
      const joinReqOffset = levelOffset + memberIds.length * 2;
      joinRequests = joinReqIds.map((uid, i) => {
        const levelRaw = r2?.[joinReqOffset + (i * 2)]?.[1];
        const nameRaw = r2?.[joinReqOffset + (i * 2) + 1]?.[1];
        const level = toInt(levelRaw, 1) || 1;
        const username = typeof nameRaw === "string" ? nameRaw : `User ${uid.slice(0, 8)}`;
        return { userId: uid, username, requestedAtMs: 0, level };
      });
    }

    // ── Parse bank items ──────────────────────────────────────────────────
    const bankItems: Record<string, number> = {};
    for (const [k, v] of Object.entries(bankItemsRaw)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) bankItems[k] = Math.floor(n);
    }

    // ── Parse contribution items into per-item-per-user totals ────────────
    // contribItemsRaw keys are "userId|itemId" -> qty
    const contribByItem: Record<string, Record<string, number>> = {};
    for (const [k, v] of Object.entries(contribItemsRaw)) {
      const sepIdx = k.indexOf("|");
      if (sepIdx < 1) continue;
      const uid = k.slice(0, sepIdx);
      const itemId = k.slice(sepIdx + 1);
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) continue;
      const qty = Math.floor(n);
      if (!contribByItem[itemId]) contribByItem[itemId] = {};
      contribByItem[itemId]![uid] = (contribByItem[itemId]![uid] ?? 0) + qty;
    }

    // ── Build commodity stats ─────────────────────────────────────────────
    const commodities: CommodityStat[] = [];
    for (const [itemId, quantity] of Object.entries(bankItems)) {
      const sellPriceMicro = toInt(sellPricesRaw[itemId], 0)
        || Math.max(1, Math.round(resolveBaseMicro(itemId) * SPREAD_SELL_FACTOR));
      const sellPriceGold = Math.floor((sellPriceMicro * quantity) / PRICE_MICRO_PER_GOLD);
      const monopolyPct = Math.min(100, (quantity / SCARCITY_TOTAL_UNITS) * 100);

      // Crash %: simulate dumping all bankQty into the sell flow
      const buyFlow = Number(buyFlowRaw[itemId]) || 0;
      const sellFlow = Number(sellFlowRaw[itemId]) || 0;
      const curDemand = Math.min(PRICE_DEMAND_CLAMP[1],
        Math.max(PRICE_DEMAND_CLAMP[0], (buyFlow + 1) / (sellFlow + 1)));
      const curCirc = buyFlow + sellFlow;
      const curScarcity = Math.min(PRICE_SCARCITY_CLAMP[1],
        Math.max(PRICE_SCARCITY_CLAMP[0], SCARCITY_TOTAL_UNITS / Math.max(1, curCirc)));
      const newSellFlow = sellFlow + quantity;
      const newDemand = Math.min(PRICE_DEMAND_CLAMP[1],
        Math.max(PRICE_DEMAND_CLAMP[0], (buyFlow + 1) / (newSellFlow + 1)));
      const newCirc = buyFlow + newSellFlow;
      const newScarcity = Math.min(PRICE_SCARCITY_CLAMP[1],
        Math.max(PRICE_SCARCITY_CLAMP[0], SCARCITY_TOTAL_UNITS / Math.max(1, newCirc)));
      const curFactor = curDemand * curScarcity;
      const newFactor = newDemand * newScarcity;
      const crashPct = curFactor > 0
        ? Math.max(0, Math.min(100, ((curFactor - newFactor) / curFactor) * 100))
        : 0;

      // Member share percentages for this commodity
      const itemContribs = contribByItem[itemId] ?? {};
      const totalContrib = Object.values(itemContribs).reduce((s, v) => s + v, 0);
      const memberShares: Record<string, number> = {};
      if (totalContrib > 0) {
        for (const [uid, qty] of Object.entries(itemContribs)) {
          memberShares[uid] = Math.round((qty / totalContrib) * 10000) / 100;
        }
      }

      commodities.push({
        itemId,
        quantity,
        sellPriceMicro,
        sellPriceGold,
        monopolyPct: Math.round(monopolyPct * 100) / 100,
        crashPct: Math.round(crashPct * 100) / 100,
        memberShares,
      });
    }

    // ── Parse boost info ──────────────────────────────────────────────────
    const shieldExpiresAtMs = toInt(shieldRaw, 0);
    const idolLevel = toInt(idolRaw.level, 0);
    const idolStatusRaw = idolRaw.status ?? "none";
    const idolStatus = (idolStatusRaw === "blessed" || idolStatusRaw === "punished")
      ? idolStatusRaw : "none" as const;
    const blessedUntilMs = toInt(idolRaw.blessedUntilMs, 0);
    const punishedUntilMs = toInt(idolRaw.punishedUntilMs, 0);

    const totalGold = toInt(bankGoldRaw, 0);

    return {
      name: meta.name ?? "",
      emblemId: meta.emblemId ?? "emblem:default",
      activeBoost: { shieldExpiresAtMs, idolLevel, idolStatus, blessedUntilMs, punishedUntilMs },
      totalGold,
      totalMembers: memberIds.length,
      onlineCount,
      members,
      commodities,
      joinRequests,
    };
  }

  async touchPresence(userId: string): Promise<void> {
    const ms = nowMs();
    await this.redis.set(userLastSeenKey(userId), String(ms), "EX", 3600);
    const sid = await this.redis.get(userSyndicateIdKey(userId));
    if (sid) {
      await this.redis.hset(syndicateMemberSeenKey(sid), userId, String(ms));
    }
  }
}
