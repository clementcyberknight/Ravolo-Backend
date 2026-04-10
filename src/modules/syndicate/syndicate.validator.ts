import { z } from "zod";

const requestIdSchema = z.string().min(8).max(128);

export const createSyndicateSchema = z.object({
  requestId: requestIdSchema,
  name: z.string().trim().min(3).max(28),
  description: z.string().trim().min(0).max(240).default(""),
  visibility: z.enum(["public", "private"]),
  levelPreferenceMin: z.coerce.number().int().min(1).max(100).default(1),
  goldPreferenceMin: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  emblemId: z.string().min(1).max(64).default("emblem:default"),
});

export const requestJoinSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
});

export const acceptJoinSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
  userId: z.string().min(1).max(128),
});

export const kickMemberSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
  userId: z.string().min(1).max(128),
});

export const promoteMemberSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
  userId: z.string().min(1).max(128),
});

export const demoteMemberSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
  userId: z.string().min(1).max(128),
});

export const cancelJoinRequestSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
});

export const rejectJoinRequestSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
  userId: z.string().min(1).max(128),
});

export const depositBankSchema = z.discriminatedUnion("kind", [
  z.object({
    requestId: requestIdSchema,
    syndicateId: z.string().min(1).max(64),
    kind: z.literal("gold"),
    amount: z.coerce.number().int().positive().max(1_000_000_000),
  }),
  z.object({
    requestId: requestIdSchema,
    syndicateId: z.string().min(1).max(64),
    kind: z.literal("item"),
    itemId: z.string().min(1).max(64),
    amount: z.coerce.number().int().positive().max(1_000_000_000),
  }),
]);

export const buyShieldSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
  goldPaid: z.coerce.number().int().positive().max(1_000_000_000),
});

export const attackSyndicateSchema = z.object({
  requestId: requestIdSchema,
  targetSyndicateId: z.string().min(1).max(64),
  attackPower: z.coerce.number().int().positive().max(1_000_000_000),
  lootGoldMax: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  lootItemId: z.string().min(1).max(64).optional(),
  lootItemMax: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
});

export const idolContributeSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
  requestKey: z.string().min(1).max(128),
  itemId: z.string().min(1).max(64),
  amount: z.coerce.number().int().positive().max(1_000_000_000),
});

export const leaveSyndicateSchema = z.object({
  requestId: requestIdSchema,
});

export const disbandSyndicateSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
});

export const syndicateChatSendSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
  text: z.string().trim().min(1).max(400),
});

export const viewSyndicateMemberSchema = z.object({
  syndicateId: z.string().min(1).max(64),
});

export const viewBankSchema = z.object({
  syndicateId: z.string().min(1).max(64),
});

export const viewContributionSchema = z.object({
  syndicateId: z.string().min(1).max(64),
  userId: z.string().min(1).max(128),
});

export const bankSellSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
  itemId: z.string().min(1).max(64),
  quantity: z.coerce.number().int().positive().max(1_000_000_000),
});

export const syndicateDashboardSchema = z.object({
  syndicateId: z.string().min(1).max(64),
});

// ── War Validators ─────────────────────────────────────────────────────

export const declareWarSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
});

export const warAttackSchema = z.object({
  requestId: requestIdSchema,
  warId: z.string().min(1).max(128),
  targetSyndicateId: z.string().min(1).max(64),
  troops: z
    .array(
      z.object({
        type: z.enum([
          "worker",
          "tractor",
          "scarecrow_breaker",
          "crop_duster",
          "siege_harvester",
        ]),
        count: z.coerce.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(5),
});

export const buyWarShieldSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
  shieldType: z.enum([
    "harvest_dome",
    "gold_vault_lock",
    "militia_surge",
    "crop_decoy",
    "ceasefire",
  ]),
});

export const viewWarSchema = z.object({
  warId: z.string().min(1).max(128),
});

export const viewWarHistorySchema = z.object({
  syndicateId: z.string().min(1).max(64),
  cursor: z.string().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const upgradeTroopSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
  troopType: z.enum([
    "worker",
    "tractor",
    "scarecrow_breaker",
    "crop_duster",
    "siege_harvester",
  ]),
});

export const viewTroopLevelsSchema = z.object({
  syndicateId: z.string().min(1).max(64),
});

export const syndicateHelpRequestSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
  goldAmount: z.number().int().min(1).max(50_000),
  message: z.string().trim().min(1).max(200),
});

export const syndicateHelpFulfillSchema = z.object({
  requestId: requestIdSchema,
  syndicateId: z.string().min(1).max(64),
  helpRequestId: z.string().min(1).max(128),
});
