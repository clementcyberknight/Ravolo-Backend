/** Hash tag `{userId}` keeps user-scoped keys on the same Redis Cluster slot. */

export const TREASURY_HASH_TAG = "{treasury}";

export function userTag(userId: string): string {
  return `{${userId}}`;
}

export function plotKey(userId: string, plotId: number): string {
  return `ravolo:${userTag(userId)}:plot:${plotId}`;
}

export function inventoryKey(userId: string): string {
  return `ravolo:${userTag(userId)}:inv`;
}

export function inventoryLockedKey(userId: string): string {
  return `ravolo:${userTag(userId)}:inv_locked`;
}

export function ownedPlotsKey(userId: string): string {
  return `ravolo:${userTag(userId)}:plots`;
}

export function plotsLockedKey(userId: string): string {
  return `ravolo:${userTag(userId)}:plots_locked`;
}

export function plotSeqKey(userId: string): string {
  return `ravolo:${userTag(userId)}:plot_seq`;
}

export function walletKey(userId: string): string {
  return `ravolo:${userTag(userId)}:wallet`;
}

export function accountInitKey(userId: string): string {
  return `ravolo:${userTag(userId)}:account_init`;
}

export function userLevelKey(userId: string): string {
  return `ravolo:${userTag(userId)}:lvl`;
}

export function userProfileKey(userId: string): string {
  return `ravolo:${userTag(userId)}:profile`;
}

export function plantIdempotencyKey(userId: string, requestId: string): string {
  return `ravolo:${userTag(userId)}:idemp:plant:${requestId}`;
}

export function harvestIdempotencyKey(userId: string, requestId: string): string {
  return `ravolo:${userTag(userId)}:idemp:harvest:${requestId}`;
}

export function clearPlotWitherIdempotencyKey(
  userId: string,
  requestId: string,
): string {
  return `ravolo:${userTag(userId)}:idemp:clear_wither:${requestId}`;
}

export function sellIdempotencyKey(userId: string, requestId: string): string {
  return `ravolo:${userTag(userId)}:idemp:sell:${requestId}`;
}

export function buyIdempotencyKey(userId: string, requestId: string): string {
  return `ravolo:${userTag(userId)}:idemp:buy:${requestId}`;
}

export function buyPlotIdempotencyKey(userId: string, requestId: string): string {
  return `ravolo:${userTag(userId)}:idemp:buy_plot:${requestId}`;
}

export function loanActiveKey(userId: string): string {
  return `ravolo:${userTag(userId)}:loan_active`;
}

export function loanRecordKey(userId: string, loanId: string): string {
  return `ravolo:${userTag(userId)}:loan:${loanId}`;
}

export function loanOpenIdempotencyKey(userId: string, requestId: string): string {
  return `ravolo:${userTag(userId)}:idemp:loan_open:${requestId}`;
}

export function loanRepayIdempotencyKey(userId: string, requestId: string): string {
  return `ravolo:${userTag(userId)}:idemp:loan_repay:${requestId}`;
}

export function animalStateKey(userId: string): string {
  return `ravolo:${userTag(userId)}:animal_state`;
}

export function animalFeedIdempotencyKey(userId: string, requestId: string): string {
  return `ravolo:${userTag(userId)}:idemp:animal_feed:${requestId}`;
}

export function animalHarvestIdempotencyKey(userId: string, requestId: string): string {
  return `ravolo:${userTag(userId)}:idemp:animal_harvest:${requestId}`;
}

export function craftPendingKey(userId: string): string {
  return `ravolo:${userTag(userId)}:craft_pending`;
}

export function craftStartIdempotencyKey(userId: string, requestId: string): string {
  return `ravolo:${userTag(userId)}:idemp:craft_start:${requestId}`;
}

export function craftClaimIdempotencyKey(userId: string, requestId: string): string {
  return `ravolo:${userTag(userId)}:idemp:craft_claim:${requestId}`;
}

export function seedInventoryField(cropId: string): string {
  return `seed:${cropId}`;
}

/** Global treasury gold pool (string integer). */
export function treasuryReserveKey(): string {
  return `ravolo:${TREASURY_HASH_TAG}:reserve`;
}

/** HASH field=item → mid micro price per unit (used internally by pricing worker). */
export function treasuryPricesKey(): string {
  return `ravolo:${TREASURY_HASH_TAG}:prices`;
}

/** HASH field=item → buy micro price per unit (what player pays to CBN). */
export function treasuryBuyPricesKey(): string {
  return `ravolo:${TREASURY_HASH_TAG}:prices_buy`;
}

/** HASH field=item → sell micro price per unit (what player receives from CBN). */
export function treasurySellPricesKey(): string {
  return `ravolo:${TREASURY_HASH_TAG}:prices_sell`;
}

/** HASH cumulative buy volumes (per tick window; worker may decay). */
export function treasuryBuyFlowKey(): string {
  return `ravolo:${TREASURY_HASH_TAG}:flow_buy`;
}

/** HASH cumulative sell volumes. */
export function treasurySellFlowKey(): string {
  return `ravolo:${TREASURY_HASH_TAG}:flow_sell`;
}

export function treasuryTradesStreamKey(): string {
  return `ravolo:${TREASURY_HASH_TAG}:trades`;
}

export function treasuryPriceHistoryKey(itemId: string): string {
  return `ravolo:${TREASURY_HASH_TAG}:ph:${itemId}`;
}

/** One-time Solana auth challenge message (UTF-8 string), keyed by challenge id. */
export function authChallengeKey(challengeId: string): string {
  return `ravolo:auth:challenge:${challengeId}`;
}

/** SHA-256 hex of opaque refresh token (never store raw token in key logs). */
export function refreshTokenStorageKey(tokenHashHex: string): string {
  return `ravolo:auth:rt:${tokenHashHex}`;
}

/** Marker set after a refresh token is redeemed once (detect reuse). */
export function refreshTokenUsedKey(tokenHashHex: string): string {
  return `ravolo:auth:rt_used:${tokenHashHex}`;
}

/** Marker set when a refresh token is explicitly revoked (logout). */
export function refreshTokenRevokedKey(tokenHashHex: string): string {
  return `ravolo:auth:rt_revoked:${tokenHashHex}`;
}

/** SET of active session ids for a user (best-effort, used for mass revocation). */
export function userSessionSetKey(userId: string): string {
  return `ravolo:${userTag(userId)}:auth:sessions`;
}

/** Session revocation flag checked on auth. */
export function sessionRevokedKey(sessionId: string): string {
  return `ravolo:session:revoked:${sessionId}`;
}

/** LIST of JSON lines; worker batches to Supabase (hot path only RPUSH). */
export function userActionsQueueKey(): string {
  return "ravolo:user_actions:queue";
}

export function aiEventActiveKey(): string {
  return "ravolo:ai:event:active";
}

export function aiEventPressureKey(): string {
  return "ravolo:ai:pressure";
}

export function aiEventCooldownKey(tier: "micro" | "minor" | "medium" | "major"): string {
  return `ravolo:ai:cooldown:${tier}`;
}

export function aiEventHistoryKey(): string {
  return "ravolo:ai:event:history";
}

// --- Syndicates ---

export function userSyndicateIdKey(userId: string): string {
  return `ravolo:${userTag(userId)}:syndicate_id`;
}

export function userPendingSyndicateIdKey(userId: string): string {
  return `ravolo:${userTag(userId)}:syndicate_pending_id`;
}

export function userLastSeenKey(userId: string): string {
  return `ravolo:${userTag(userId)}:last_seen_ms`;
}

export function userAttackCooldownKey(userId: string): string {
  return `ravolo:${userTag(userId)}:attack_cd_until`;
}

export function syndicateSeqKey(): string {
  return "ravolo:syndicate:seq";
}

export function syndicateIndexAllKey(): string {
  return "ravolo:syndicate:index:all";
}

export function syndicateIndexPublicKey(): string {
  return "ravolo:syndicate:index:public";
}

export function syndicateNameIndexKey(): string {
  return "ravolo:syndicate:index:name";
}

export function syndicateMetaKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:meta`;
}

export function syndicateMembersKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:members`;
}

export function syndicateMemberRolesKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:member_roles`;
}

export function syndicateJoinRequestsKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:join_requests`;
}

export function syndicateBankGoldKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:bank_gold`;
}

export function syndicateBankItemsKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:bank_items`;
}

export function syndicateHoldingsKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:holdings`;
}

export function syndicateShieldExpiresAtKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:shield_expires_at`;
}

export function syndicateIdolKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:idol`;
}

export function syndicateIdolRequestKey(syndicateId: string, requestKey: string): string {
  return `ravolo:syndicate:${syndicateId}:idol:req:${requestKey}`;
}

export function syndicateChatKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:chat`;
}

/** Active help requests (HASH: requestId → JSON). */
export function syndicateHelpRequestsKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:help_requests`;
}

/** Per-user help request cooldown (STRING with TTL). */
export function userHelpRequestCooldownKey(userId: string): string {
  return `ravolo:user:${userId}:help_cooldown`;
}

export function syndicateMemberSeenKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:member_seen`;
}

export function syndicateContributionGoldKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:contrib_gold`;
}

export function syndicateContributionItemsKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:contrib_items`;
}

export function syndicateTaxPenaltyKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:tax_penalty`;
}

// ── Syndicate War Keys ─────────────────────────────────────────────────

/** Global Infamy ZSET: syndicateId → infamy score. */
export function syndicateInfamyKey(): string {
  return "ravolo:syndicate:infamy";
}

/** War state hash (all fields of a single war). */
export function warStateKey(warId: string): string {
  return `ravolo:war:${warId}`;
}

/** Current active war for a syndicate (STRING: warId). */
export function syndicateActiveWarKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:active_war`;
}

/** Matchmaking queue (SORTED SET: syndicateId → infamy). */
export function warMatchmakingQueueKey(): string {
  return "ravolo:war:matchmaking";
}

/** Per-user attack count within a war (HASH: userId → count). */
export function warAttackCountKey(warId: string): string {
  return `ravolo:war:${warId}:attack_counts`;
}

/** War attack log (LIST: attack records as pipe-delimited strings). */
export function warAttackLogKey(warId: string): string {
  return `ravolo:war:${warId}:attacks`;
}

/** War history per syndicate (SORTED SET: warId → endTimestamp). */
export function syndicateWarHistoryKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:war_history`;
}

/** War declaration cooldown (STRING: timestamp when cooldown expires). */
export function syndicateWarCooldownKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:war_cooldown`;
}

/** Active war shields (HASH: shieldType → expiresAtMs). */
export function syndicateWarShieldsKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:war_shields`;
}

/** Sequence counter for generating warIds. */
export function warSeqKey(): string {
  return "ravolo:war:seq";
}

/** Set of all active war IDs (for scheduler scanning). */
export function activeWarsIndexKey(): string {
  return "ravolo:war:active";
}

/** Syndicate defense power (STRING integer, derived from members/idol/level). */
export function syndicateDefensePowerKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:defense_power`;
}

/** Syndicate troop upgrade levels (HASH: troopType → level). */
export function syndicateTroopLevelsKey(syndicateId: string): string {
  return `ravolo:syndicate:${syndicateId}:troop_levels`;
}
