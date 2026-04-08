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
  role: SyndicateRole;
  level: number;
  lastSeenAtMs: number;
};

export type SyndicateView = SyndicateSummary & {
  ownerId: string;
  createdAtMs: number;
  joinRequests?: { userId: string; requestedAtMs: number }[];
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
};
