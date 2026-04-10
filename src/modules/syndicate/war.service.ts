import type { Redis } from "ioredis";
import {
  IDEMPOTENCY_TTL_SEC,
  WAR_STARTING_INFAMY,
  WAR_MAX_ATTACKS_PER_MEMBER,
  WAR_STAR_1_DESTRUCTION_BPS,
  WAR_STAR_2_DESTRUCTION_BPS,
  WAR_STAR_3_DESTRUCTION_BPS,
  SHIELD_MILITIA_SURGE_DEF_BONUS_BPS,
  SHIELD_CROP_DECOY_LOOT_REDUCE_BPS,
  TROOP_BASE_POWER,
  WAR_SHIELD_CONFIG,
  TROOP_MAX_LEVEL,
  TROOP_UPGRADE_COSTS,
  TROOP_LEVEL_POWER_BPS,
} from "../../config/constants.js";
import { logger } from "../../infrastructure/logger/logger.js";
import {
  userSyndicateIdKey,
  syndicateMetaKey,
  syndicateActiveWarKey,
  syndicateWarCooldownKey,
  warMatchmakingQueueKey,
  syndicateInfamyKey,
  syndicateMemberRolesKey,
  syndicateWarShieldsKey,
  warStateKey,
  warAttackCountKey,
  warAttackLogKey,
  syndicateBankGoldKey,
  syndicateBankItemsKey,
  syndicateDefensePowerKey,
  syndicateTroopLevelsKey,
} from "../../infrastructure/redis/keys.js";
import {
  redisWarDeclare,
  redisWarAttack,
  redisWarBuyShield,
  redisUpgradeTroop,
} from "../../infrastructure/redis/commands.js";
import { AppError } from "../../shared/errors/appError.js";
import { OnboardingService } from "../onboarding/onboarding.service.js";
import { WarRepository } from "./war.repository.js";
import {
  declareWarSchema,
  warAttackSchema,
  buyWarShieldSchema,
  viewWarSchema,
  viewWarHistorySchema,
  upgradeTroopSchema,
  viewTroopLevelsSchema,
} from "./syndicate.validator.js";
import type {
  DeclareWarCommand,
  WarAttackCommand,
  BuyWarShieldCommand,
  ViewWarCommand,
  ViewWarHistoryCommand,
  WarView,
  WarMatchmakingResult,
  WarAttackRecord,
  ActiveShield,
  TroopDeployment,
  UpgradeTroopCommand,
  TroopUpgradeResult,
  TroopLevelsView,
} from "./syndicate.types.js";

function nowMs(): number {
  return Date.now();
}

export class WarService {
  constructor(
    private readonly redis: Redis,
    private readonly repo = new WarRepository(),
    private readonly onboarding = new OnboardingService(redis),
  ) {}

  async declareWar(userId: string, raw: unknown): Promise<WarMatchmakingResult> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = declareWarSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("BAD_REQUEST", "Invalid declare war payload", {
        issues: parsed.error.issues,
      });
    }
    const cmd = parsed.data as DeclareWarCommand;

    try {
      const res = await redisWarDeclare(
        this.redis,
        {
          userSyndicateKey: userSyndicateIdKey(userId),
          metaKey: syndicateMetaKey(cmd.syndicateId),
          activeWarKey: syndicateActiveWarKey(cmd.syndicateId),
          cooldownKey: syndicateWarCooldownKey(cmd.syndicateId),
          matchmakingKey: warMatchmakingQueueKey(),
          infamyKey: syndicateInfamyKey(),
          idempKey: `ravolo:${userId}:idemp:war_declare:${cmd.requestId}`,
          rolesKey: syndicateMemberRolesKey(cmd.syndicateId),
          warShieldsKey: syndicateWarShieldsKey(cmd.syndicateId),
        },
        {
          userId,
          syndicateId: cmd.syndicateId,
          nowMs: nowMs(),
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
          startingInfamy: WAR_STARTING_INFAMY,
        },
      );
      return { queued: true, syndicateId: res.syndicateId, infamy: res.infamy };
    } catch (e) {
      throw this.mapLuaError(e);
    }
  }

  async attack(userId: string, raw: unknown): Promise<{
    attackId: string;
    stars: number;
    destructionBps: number;
    lootGold: number;
    lootItems: Record<string, number>;
  }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = warAttackSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("BAD_REQUEST", "Invalid war attack payload", {
        issues: parsed.error.issues,
      });
    }
    const cmd = parsed.data as WarAttackCommand;

    // Build troop CSV
    const troopsCsv = cmd.troops.map((t: TroopDeployment) => `${t.type}:${t.count}`).join(",");

    // Determine which syndicates are attacker/defender in this war context
    const war = await this.repo.getWarState(this.redis, cmd.warId);
    if (!war) throw new AppError("NO_SUCH_WAR", "War not found");

    const userSid = await this.redis.get(userSyndicateIdKey(userId));
    if (!userSid) throw new AppError("NOT_IN_SYNDICATE", "Not in a syndicate");

    // Get troop levels for the attacker's syndicate and compute upgraded power
    const troopLevels = await this.repo.getTroopLevels(this.redis, userSid);
    const troopPowerCsv = Object.entries(TROOP_BASE_POWER)
      .map(([k, v]) => {
        const level = troopLevels[k] ?? 1;
        const multiplierBps = TROOP_LEVEL_POWER_BPS[level - 1] ?? 10000;
        const upgradedPower = Math.floor(v * multiplierBps / 10000);
        return `${k}:${upgradedPower}`;
      })
      .join(",");

    // Figure out which bank is the attacker's and which is the defender's
    let attackerBankGold: string;
    let defenderBankGold: string;
    let attackerBankItems: string;
    let defenderBankItems: string;
    let defenderShields: string;
    let defenderDefPower: string;

    if (userSid === war.attackerSyndicateId) {
      attackerBankGold = syndicateBankGoldKey(war.attackerSyndicateId);
      defenderBankGold = syndicateBankGoldKey(war.defenderSyndicateId);
      attackerBankItems = syndicateBankItemsKey(war.attackerSyndicateId);
      defenderBankItems = syndicateBankItemsKey(war.defenderSyndicateId);
      defenderShields = syndicateWarShieldsKey(war.defenderSyndicateId);
      defenderDefPower = syndicateDefensePowerKey(war.defenderSyndicateId);
    } else {
      attackerBankGold = syndicateBankGoldKey(war.defenderSyndicateId);
      defenderBankGold = syndicateBankGoldKey(war.attackerSyndicateId);
      attackerBankItems = syndicateBankItemsKey(war.defenderSyndicateId);
      defenderBankItems = syndicateBankItemsKey(war.attackerSyndicateId);
      defenderShields = syndicateWarShieldsKey(war.attackerSyndicateId);
      defenderDefPower = syndicateDefensePowerKey(war.attackerSyndicateId);
    }

    try {
      const res = await redisWarAttack(
        this.redis,
        {
          warStateKey: warStateKey(cmd.warId),
          attackCountKey: warAttackCountKey(cmd.warId),
          attackLogKey: warAttackLogKey(cmd.warId),
          attackerBankGoldKey: attackerBankGold,
          defenderBankGoldKey: defenderBankGold,
          defenderBankItemsKey: defenderBankItems,
          attackerBankItemsKey: attackerBankItems,
          userSyndicateKey: userSyndicateIdKey(userId),
          defenderShieldsKey: defenderShields,
          defenderDefPowerKey: defenderDefPower,
          idempKey: `ravolo:${userId}:idemp:war_attack:${cmd.requestId}`,
        },
        {
          userId,
          warId: cmd.warId,
          targetSyndicateId: cmd.targetSyndicateId,
          troopsCsv,
          nowMs: nowMs(),
          maxAttacks: WAR_MAX_ATTACKS_PER_MEMBER,
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
          troopPowerCsv,
          star1Bps: WAR_STAR_1_DESTRUCTION_BPS,
          star2Bps: WAR_STAR_2_DESTRUCTION_BPS,
          star3Bps: WAR_STAR_3_DESTRUCTION_BPS,
          militiaSurgeBonusBps: SHIELD_MILITIA_SURGE_DEF_BONUS_BPS,
          cropDecoyReduceBps: SHIELD_CROP_DECOY_LOOT_REDUCE_BPS,
        },
      );

      // Parse loot items from CSV
      const lootItems: Record<string, number> = {};
      if (res.lootItems) {
        for (const pair of res.lootItems.split(";")) {
          const [id, qty] = pair.split(":");
          if (id && qty) lootItems[id] = Number(qty) || 0;
        }
      }

      return {
        attackId: res.attackId,
        stars: res.stars,
        destructionBps: res.destructionBps,
        lootGold: res.lootGold,
        lootItems,
      };
    } catch (e) {
      throw this.mapLuaError(e);
    }
  }

  async buyWarShield(
    userId: string,
    raw: unknown,
  ): Promise<ActiveShield> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = buyWarShieldSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("BAD_REQUEST", "Invalid buy war shield payload", {
        issues: parsed.error.issues,
      });
    }
    const cmd = parsed.data as BuyWarShieldCommand;

    const config = WAR_SHIELD_CONFIG[cmd.shieldType];
    if (!config) throw new AppError("BAD_REQUEST", "Unknown shield type");

    try {
      const res = await redisWarBuyShield(
        this.redis,
        {
          userSyndicateKey: userSyndicateIdKey(userId),
          rolesKey: syndicateMemberRolesKey(cmd.syndicateId),
          bankGoldKey: syndicateBankGoldKey(cmd.syndicateId),
          warShieldsKey: syndicateWarShieldsKey(cmd.syndicateId),
          idempKey: `ravolo:${userId}:idemp:war_shield:${cmd.requestId}`,
        },
        {
          userId,
          syndicateId: cmd.syndicateId,
          shieldType: cmd.shieldType,
          goldCost: config.gold,
          durationMs: config.durationMs,
          nowMs: nowMs(),
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
        },
      );
      return { type: cmd.shieldType, expiresAtMs: res.expiresAtMs };
    } catch (e) {
      throw this.mapLuaError(e);
    }
  }

  async viewWar(userId: string, raw: unknown): Promise<WarView> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = viewWarSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("BAD_REQUEST", "Invalid view war payload");
    const { warId } = parsed.data as ViewWarCommand;

    const war = await this.repo.getWarState(this.redis, warId);
    if (!war) throw new AppError("NO_SUCH_WAR", "War not found");

    const now = nowMs();
    const attacks = await this.repo.getAttackLog(this.redis, warId);
    const myAttacks = await this.repo.getAttackCount(this.redis, warId, userId);
    const attackerName = await this.repo.getSyndicateName(this.redis, war.attackerSyndicateId);
    const defenderName = await this.repo.getSyndicateName(this.redis, war.defenderSyndicateId);

    let timeRemainingMs = 0;
    switch (war.phase) {
      case "prep":
        timeRemainingMs = Math.max(0, war.battleStartsAtMs - now);
        break;
      case "battle":
        timeRemainingMs = Math.max(0, war.cooldownStartsAtMs - now);
        break;
      case "cooldown":
        timeRemainingMs = Math.max(0, war.settlementStartsAtMs - now);
        break;
      case "settlement":
        timeRemainingMs = Math.max(0, war.endsAtMs - now);
        break;
    }

    return {
      warId: war.warId,
      attackerSyndicateId: war.attackerSyndicateId,
      defenderSyndicateId: war.defenderSyndicateId,
      attackerName,
      defenderName,
      phase: war.phase,
      attackerInfamy: war.attackerInfamy,
      defenderInfamy: war.defenderInfamy,
      attackerStars: war.attackerStars,
      defenderStars: war.defenderStars,
      attackerDestructionBps: war.attackerDestructionBps,
      defenderDestructionBps: war.defenderDestructionBps,
      timeRemainingMs,
      attacks,
      myAttacksRemaining: Math.max(0, WAR_MAX_ATTACKS_PER_MEMBER - myAttacks),
    };
  }

  async viewActiveWar(userId: string): Promise<WarView | null> {
    await this.onboarding.ensureOnboarded(userId);
    const sid = await this.redis.get(userSyndicateIdKey(userId));
    if (!sid) return null;
    const warId = await this.repo.getActiveWarId(this.redis, sid);
    if (!warId) return null;
    return this.viewWar(userId, { warId });
  }

  async viewWarHistory(
    userId: string,
    raw: unknown,
  ): Promise<{ items: WarView[]; nextCursor: string | null }> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = viewWarHistorySchema.safeParse(raw);
    if (!parsed.success) throw new AppError("BAD_REQUEST", "Invalid view war history payload");
    const cmd = parsed.data as ViewWarHistoryCommand;

    const { warIds, nextCursor } = await this.repo.getWarHistory(
      this.redis,
      cmd.syndicateId,
      cmd.cursor,
      cmd.limit ?? 20,
    );

    const items: WarView[] = [];
    for (const wid of warIds) {
      try {
        const view = await this.viewWar(userId, { warId: wid });
        items.push(view);
      } catch {
        // War state may have expired, skip
      }
    }

    return { items, nextCursor };
  }

  async upgradeTroop(userId: string, raw: unknown): Promise<TroopUpgradeResult> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = upgradeTroopSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("BAD_REQUEST", "Invalid upgrade troop payload", {
        issues: parsed.error.issues,
      });
    }
    const cmd = parsed.data as UpgradeTroopCommand;

    // Get current level to determine cost
    const troopLevels = await this.repo.getTroopLevels(this.redis, cmd.syndicateId);
    const currentLevel = troopLevels[cmd.troopType] ?? 1;
    if (currentLevel >= TROOP_MAX_LEVEL) {
      throw new AppError("MAX_TROOP_LEVEL", `${cmd.troopType} is already at max level ${TROOP_MAX_LEVEL}`);
    }
    const goldCost = TROOP_UPGRADE_COSTS[currentLevel - 1] ?? 0;
    if (goldCost <= 0) {
      throw new AppError("BAD_REQUEST", "Invalid upgrade cost");
    }

    try {
      const res = await redisUpgradeTroop(
        this.redis,
        {
          userSyndicateKey: userSyndicateIdKey(userId),
          rolesKey: syndicateMemberRolesKey(cmd.syndicateId),
          bankGoldKey: syndicateBankGoldKey(cmd.syndicateId),
          troopLevelsKey: syndicateTroopLevelsKey(cmd.syndicateId),
          idempKey: `ravolo:${userId}:idemp:upgrade_troop:${cmd.requestId}`,
        },
        {
          userId,
          syndicateId: cmd.syndicateId,
          troopType: cmd.troopType,
          goldCost,
          maxLevel: TROOP_MAX_LEVEL,
          idempTtlSec: IDEMPOTENCY_TTL_SEC,
        },
      );
      return {
        troopType: cmd.troopType,
        newLevel: res.newLevel,
        goldSpent: res.goldSpent,
      };
    } catch (e) {
      throw this.mapLuaError(e);
    }
  }

  async viewTroopLevels(userId: string, raw: unknown): Promise<TroopLevelsView> {
    await this.onboarding.ensureOnboarded(userId);
    const parsed = viewTroopLevelsSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("BAD_REQUEST", "Invalid payload");
    const { syndicateId } = parsed.data;
    const levels = await this.repo.getTroopLevels(this.redis, syndicateId);
    return levels as TroopLevelsView;
  }

  private mapLuaError(e: unknown): AppError {
    if (typeof e === "object" && e !== null && "message" in e) {
      const msg = String((e as { message: string }).message);
      if (msg.includes("ERR_NOT_MEMBER"))
        return new AppError("NOT_MEMBER", "Not a syndicate member");
      if (msg.includes("ERR_NOT_AUTHORIZED"))
        return new AppError("NOT_AUTHORIZED", "Not authorized (officer+ required)");
      if (msg.includes("ERR_NO_SUCH_SYNDICATE"))
        return new AppError("NO_SUCH_SYNDICATE", "Syndicate not found");
      if (msg.includes("ERR_ALREADY_IN_WAR"))
        return new AppError("ALREADY_IN_WAR", "Already in a war or matchmaking queue");
      if (msg.includes("ERR_WAR_COOLDOWN"))
        return new AppError("WAR_COOLDOWN", "War declaration cooldown active");
      if (msg.includes("ERR_CEASEFIRE_ACTIVE"))
        return new AppError("CEASEFIRE_ACTIVE", "Ceasefire shield is active");
      if (msg.includes("ERR_WAR_NOT_IN_BATTLE"))
        return new AppError("WAR_NOT_IN_BATTLE", "War is not in battle phase");
      if (msg.includes("ERR_NOT_IN_SYNDICATE"))
        return new AppError("NOT_IN_SYNDICATE", "Not in a syndicate");
      if (msg.includes("ERR_NOT_IN_WAR"))
        return new AppError("NOT_IN_WAR", "Not a participant in this war");
      if (msg.includes("ERR_MAX_ATTACKS_REACHED"))
        return new AppError("MAX_ATTACKS_REACHED", "Maximum attacks per war reached");
      if (msg.includes("ERR_INSUFFICIENT_GOLD"))
        return new AppError("INSUFFICIENT_GOLD", "Insufficient gold in syndicate bank");
      if (msg.includes("ERR_SHIELD_ALREADY_ACTIVE"))
        return new AppError("SHIELD_ALREADY_ACTIVE", "This shield type is already active");
      if (msg.includes("ERR_BAD_ARGS"))
        return new AppError("BAD_REQUEST", "Invalid request");
      if (msg.includes("ERR_MAX_TROOP_LEVEL"))
        return new AppError("MAX_TROOP_LEVEL", "Troop is already at max level");
    }
    logger.error({ err: e }, "unmapped war lua error");
    return new AppError("INTERNAL", "Internal error");
  }
}
