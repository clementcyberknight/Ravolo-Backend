export type SyndicateVisibility = "public" | "private";

export type SyndicateRole = "owner" | "officer" | "member";

export type SyndicateSummary = {
  id: string;
  name: string;
  description: string;
  visibility: SyndicateVisibility;
  levelPreferenceMin: number;
  goldPreferenceMin: number;
  members: number;
  shieldExpiresAtMs: number;
  idolLevel: number;
  emblemId: string;
};

export type SyndicateMember = {
  userId: string;
  username: string;
  role: SyndicateRole;
  level: number;
  lastSeenAtMs: number;
};

export type SyndicateView = SyndicateSummary & {
  ownerId: string;
  createdAtMs: number;
  joinRequests?: { userId: string; username: string; requestedAtMs: number; level: number }[];
  membersList: SyndicateMember[];
};

export type CreateSyndicateCommand = {
  requestId: string;
  name: string;
  description: string;
  visibility: SyndicateVisibility;
  levelPreferenceMin: number;
  goldPreferenceMin: number;
  emblemId: string;
};

export type ListSyndicatesQuery = {
  includePrivate?: boolean;
};

export type RequestJoinCommand = {
  requestId: string;
  syndicateId: string;
};

export type AcceptJoinCommand = {
  requestId: string;
  syndicateId: string;
  userId: string;
};

export type CancelJoinRequestCommand = {
  requestId: string;
  syndicateId: string;
};

export type RejectJoinRequestCommand = {
  requestId: string;
  syndicateId: string;
  userId: string;
};

export type KickMemberCommand = {
  requestId: string;
  syndicateId: string;
  userId: string;
};

export type PromoteMemberCommand = {
  requestId: string;
  syndicateId: string;
  userId: string;
};

export type DemoteMemberCommand = {
  requestId: string;
  syndicateId: string;
  userId: string;
};

export type DepositBankCommand =
  | { requestId: string; syndicateId: string; kind: "gold"; amount: number }
  | { requestId: string; syndicateId: string; kind: "item"; itemId: string; amount: number };

export type BuyShieldCommand = {
  requestId: string;
  syndicateId: string;
  goldPaid: number;
};

export type AttackSyndicateCommand = {
  requestId: string;
  targetSyndicateId: string;
  attackPower: number;
  lootGoldMax: number;
  lootItemId?: string;
  lootItemMax?: number;
};

export type IdolContributeCommand = {
  requestId: string;
  syndicateId: string;
  requestKey: string;
  itemId: string;
  amount: number;
};

export type LeaveSyndicateCommand = {
  requestId: string;
};

export type DisbandSyndicateCommand = {
  requestId: string;
  syndicateId: string;
};

export type SyndicateChatSendCommand = {
  requestId: string;
  syndicateId: string;
  text: string;
};

export type ViewSyndicateMemberQuery = {
  syndicateId: string;
};

export type ViewBankQuery = {
  syndicateId: string;
};

export type ViewContributionQuery = {
  syndicateId: string;
  userId: string;
};

export type BankSellCommand = {
  requestId: string;
  syndicateId: string;
  itemId: string;
  quantity: number;
};

export type BankSellResult = {
  item: string;
  quantity: number;
  goldPaid: number;
  priceMicro: number;
};

export type SyndicateDashboardQuery = {
  syndicateId: string;
};

export type DashboardActiveBoost = {
  shieldExpiresAtMs: number;
  idolLevel: number;
  idolStatus: "blessed" | "punished" | "none";
  blessedUntilMs: number;
  punishedUntilMs: number;
};

export type DashboardMember = {
  userId: string;
  username: string;
  role: SyndicateRole;
  level: number;
  lastSeenAtMs: number;
  online: boolean;
};

export type CommodityStat = {
  itemId: string;
  quantity: number;
  sellPriceMicro: number;
  sellPriceGold: number;
  monopolyPct: number;
  crashPct: number;
  memberShares: Record<string, number>;
};

export type SyndicateDashboardView = {
  name: string;
  emblemId: string;
  activeBoost: DashboardActiveBoost;
  totalGold: number;
  totalMembers: number;
  onlineCount: number;
  members: DashboardMember[];
  commodities: CommodityStat[];
  joinRequests?: { userId: string; username: string; requestedAtMs: number; level: number }[];
};

// ── Syndicate War Types ────────────────────────────────────────────────

export type WarPhase = "declaration" | "prep" | "battle" | "cooldown" | "settlement" | "ended";

export type ShieldType = "harvest_dome" | "gold_vault_lock" | "militia_surge" | "crop_decoy" | "ceasefire";

export type ActiveShield = {
  type: ShieldType;
  expiresAtMs: number;
};

export type TroopType = "worker" | "tractor" | "scarecrow_breaker" | "crop_duster" | "siege_harvester";

export type TroopDeployment = {
  type: TroopType;
  count: number;
};

export type WarState = {
  warId: string;
  attackerSyndicateId: string;
  defenderSyndicateId: string;
  phase: WarPhase;
  declaredAtMs: number;
  prepStartsAtMs: number;
  battleStartsAtMs: number;
  cooldownStartsAtMs: number;
  settlementStartsAtMs: number;
  endsAtMs: number;
  attackerInfamy: number;
  defenderInfamy: number;
  attackerStars: number;
  defenderStars: number;
  attackerDestructionBps: number;
  defenderDestructionBps: number;
  settled: boolean;
};

export type WarAttackRecord = {
  attackId: string;
  attackerUserId: string;
  attackerSyndicateId: string;
  defenderSyndicateId: string;
  troops: TroopDeployment[];
  stars: number;
  destructionBps: number;
  lootGold: number;
  lootItems: Record<string, number>;
  timestampMs: number;
};

export type DeclareWarCommand = {
  requestId: string;
  syndicateId: string;
};

export type WarAttackCommand = {
  requestId: string;
  warId: string;
  targetSyndicateId: string;
  troops: TroopDeployment[];
};

export type BuyWarShieldCommand = {
  requestId: string;
  syndicateId: string;
  shieldType: ShieldType;
};

export type ViewWarCommand = {
  warId: string;
};

export type ViewWarHistoryCommand = {
  syndicateId: string;
  cursor?: string;
  limit?: number;
};

export type WarView = {
  warId: string;
  attackerSyndicateId: string;
  defenderSyndicateId: string;
  attackerName: string;
  defenderName: string;
  phase: WarPhase;
  attackerInfamy: number;
  defenderInfamy: number;
  attackerStars: number;
  defenderStars: number;
  attackerDestructionBps: number;
  defenderDestructionBps: number;
  timeRemainingMs: number;
  attacks: WarAttackRecord[];
  myAttacksRemaining: number;
};

export type WarMatchmakingResult = {
  queued: true;
  syndicateId: string;
  infamy: number;
};

export type UpgradeTroopCommand = {
  requestId: string;
  syndicateId: string;
  troopType: TroopType;
};

export type TroopUpgradeResult = {
  troopType: TroopType;
  newLevel: number;
  goldSpent: number;
};

export type TroopLevelsView = {
  worker: number;
  tractor: number;
  scarecrow_breaker: number;
  crop_duster: number;
  siege_harvester: number;
};

// ── Chat Message Types ──────────────────────────────────────────────────

export type ChatUserMessage = {
  kind: "chat";
  ts: number;
  userId: string;
  text: string;
};

export type ChatAlertType =
  | "war_declared"
  | "war_won"
  | "war_lost"
  | "war_draw"
  | "idol_level_up"
  | "idol_blessed"
  | "idol_punished"
  | "bank_sell"
  | "shield_purchased"
  | "member_joined"
  | "member_left"
  | "member_kicked"
  | "troop_upgraded"
  | "help_fulfilled";

export type ChatAlertMessage = {
  kind: "alert";
  ts: number;
  alertType: ChatAlertType;
  data: Record<string, unknown>;
};

export type HelpRequestStatus = "open" | "fulfilled" | "expired";

export type ChatHelpRequestMessage = {
  kind: "help_request";
  ts: number;
  requestId: string;
  userId: string;
  goldAmount: number;
  message: string;
  status: HelpRequestStatus;
  fulfilledBy: string | null;
};

export type ChatMessage = ChatUserMessage | ChatAlertMessage | ChatHelpRequestMessage;

// ── Help Request Commands ───────────────────────────────────────────────

export type HelpRequestCommand = {
  requestId: string;
  syndicateId: string;
  goldAmount: number;
  message: string;
};

export type HelpFulfillCommand = {
  requestId: string;
  syndicateId: string;
  helpRequestId: string;
};

export type HelpRequestResult = {
  requestId: string;
  goldAmount: number;
  message: string;
  expiresAtMs: number;
};

export type HelpFulfillResult = {
  helpRequestId: string;
  fulfillerUserId: string;
  requesterUserId: string;
  goldAmount: number;
};
