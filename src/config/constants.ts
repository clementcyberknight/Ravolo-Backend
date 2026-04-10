/** Idempotency key TTL for plant/harvest/trade replays (seconds). */
export const IDEMPOTENCY_TTL_SEC = 86_400;

/** WebSocket action rate limit: points per duration (see handlers). */
export const WS_RATE_POINTS = 20;
export const WS_RATE_DURATION_MS = 1000;

/** Fixed treasury gold pool (integer gold units). No mint/burn beyond accounting moves. */
export const MAX_TREASURY_GOLD_SUPPLY = 100_000_000;

/** New account grant (debited from treasury reserve). */
export const STARTER_GOLD = 250;
export const STARTER_WHEAT_SEEDS = 2;
/** Plot indices granted on first join (4 plots). */
export const STARTER_PLOT_IDS = [0, 1, 2, 3] as const;
/** Maximum number of plots a player can own or lock as collateral. */
export const MAX_PLOTS_PER_PLAYER = 32;
/** Cost of the first purchased plot after the starter grant. */
export const PLOT_PURCHASE_BASE_GOLD = 300;
/** Additional gold added for each later plot purchase. */
export const PLOT_PURCHASE_STEP_GOLD = 100;

/**
 * Price is stored as micro-gold per 1 unit (1000 micro = 1 gold).
 * Totals: floor(priceMicro * qty / PRICE_MICRO_PER_GOLD) on sell payout, ceil on buy cost.
 */
export const PRICE_MICRO_PER_GOLD = 1000;

/** Dynamic pricing tick (ms). Keep between 5–10s per design. */
export const PRICING_TICK_MS = 7000;
export const AI_EVENT_TICK_MS = 60 * 1000;
export const AI_EVENT_ACTIVE_TTL_SEC = 30 * 60;
export const AI_PRESSURE_MAX = 1000;
export const AI_PRESSURE_DECAY_PER_TICK = 40;
export const AI_EVENT_PRESSURE_THRESHOLDS = {
  micro: 150,
  minor: 300,
  medium: 600,
  major: 850,
} as const;
export const AI_TIER_COOLDOWN_SEC = {
  micro: 3 * 60,
  minor: 10 * 60,
  medium: 25 * 60,
  major: 60 * 60,
} as const;
export const AI_PRESSURE_RESET_BPS = {
  micro: 8500,
  minor: 6500,
  medium: 5000,
  major: 3500,
} as const;
export const AI_EVENT_HISTORY_LIMIT = 24;

/** Clamp multipliers applied in pricing engine. */
export const PRICE_DEMAND_CLAMP: [number, number] = [0.25, 4];
export const PRICE_SCARCITY_CLAMP: [number, number] = [0.5, 3];
export const PRICE_VOLATILITY_CLAMP: [number, number] = [0.85, 1.35];

/** Proxy "total supply" used in scarcity term (tunable macro constant). */
export const SCARCITY_TOTAL_UNITS = 1_000_000;

/**
 * Market spread factors applied to the "mid" price each pricing tick.
 * Buy price (player pays CBN)       = mid × SPREAD_BUY_FACTOR   (>1 → costs more)
 * Sell price (player receives CBN)  = mid × SPREAD_SELL_FACTOR  (<1 → earns less)
 * This guarantees buy > sell at all times, preventing arbitrage loops.
 */
export const SPREAD_BUY_FACTOR = 1.3; // player pays 30 % above mid
export const SPREAD_SELL_FACTOR = 0.75; // player receives 25 % below mid

/** Maximum members per syndicate. */
export const MAX_SYNDICATE_MEMBERS = 25;

/** Minimum player level required to create a syndicate. */
export const MIN_SYNDICATE_CREATE_LEVEL = 1;

/** Threshold (ms) for considering a syndicate member "online". */
export const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

/** Idol request scheduler tick interval (ms). Every 5 minutes. */
export const IDOL_TICK_MS = 5 * 60 * 1000;

/** Idol request duration (ms). 7 days to fulfill. */
export const IDOL_REQUEST_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** Duration of idol blessing (ms). 7 days. */
export const IDOL_BLESS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** Duration of idol punishment (ms). 7 days. */
export const IDOL_PUNISH_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** Portion of syndicate bank gold removed on idol punishment (basis points: 3000 = 30%). */
export const IDOL_PUNISH_BANK_BPS = 3000;

// ── Syndicate War ──────────────────────────────────────────────────────

/** War cycle total duration (ms). 6 hours. */
export const WAR_CYCLE_DURATION_MS = 6 * 60 * 60 * 1000;
/** Prep phase duration (ms). 1 hour. */
export const WAR_PREP_DURATION_MS = 1 * 60 * 60 * 1000;
/** Battle phase duration (ms). 4 hours. */
export const WAR_BATTLE_DURATION_MS = 4 * 60 * 60 * 1000;
/** Cooldown phase duration (ms). 30 minutes. */
export const WAR_COOLDOWN_DURATION_MS = 30 * 60 * 1000;
/** Settlement phase duration (ms). 30 minutes. */
export const WAR_SETTLEMENT_DURATION_MS = 30 * 60 * 1000;
/** Infamy matchmaking bracket tolerance (±10%). */
export const WAR_INFAMY_BRACKET_PCT = 10;
/** Starting Infamy for new syndicates. */
export const WAR_STARTING_INFAMY = 1000;
/** Maximum attacks per member per war. */
export const WAR_MAX_ATTACKS_PER_MEMBER = 2;
/** Underdog Infamy steal range (basis points). */
export const WAR_UNDERDOG_STEAL_MIN_BPS = 2500;
export const WAR_UNDERDOG_STEAL_MAX_BPS = 4000;
/** Favourite Infamy gain (basis points). */
export const WAR_FAVOURITE_GAIN_BPS = 500;
/** War declaration cooldown (ms). 1 hour after last war ends. */
export const WAR_DECLARE_COOLDOWN_MS = 1 * 60 * 60 * 1000;
/** War scheduler tick (ms). Every 30 seconds. */
export const WAR_TICK_MS = 30_000;
/** Bracket widening step (percentage points) per failed match tick. */
export const WAR_BRACKET_WIDEN_STEP_PCT = 5;
/** Maximum bracket tolerance (percentage). */
export const WAR_BRACKET_MAX_PCT = 30;

// ── Star Thresholds (basis points 0–10000) ─────────────────────────────
export const WAR_STAR_1_DESTRUCTION_BPS = 5000;
export const WAR_STAR_2_DESTRUCTION_BPS = 7500;
export const WAR_STAR_3_DESTRUCTION_BPS = 10000;

// ── Troop Stats ────────────────────────────────────────────────────────
export const TROOP_BASE_POWER: Record<string, number> = {
  worker: 10,
  tractor: 25,
  scarecrow_breaker: 15,
  crop_duster: 20,
  siege_harvester: 50,
};

// ── War Shield Types ───────────────────────────────────────────────────
export const WAR_SHIELD_CONFIG: Record<
  string,
  { gold: number; durationMs: number }
> = {
  harvest_dome: { gold: 500, durationMs: 4 * 60 * 60 * 1000 },
  gold_vault_lock: { gold: 800, durationMs: 6 * 60 * 60 * 1000 },
  militia_surge: { gold: 1200, durationMs: 2 * 60 * 60 * 1000 },
  crop_decoy: { gold: 600, durationMs: 3 * 60 * 60 * 1000 },
  ceasefire: { gold: 2000, durationMs: 8 * 60 * 60 * 1000 },
};
/** Militia Surge defense bonus (basis points: 5000 = +50%). */
export const SHIELD_MILITIA_SURGE_DEF_BONUS_BPS = 5000;
/** Crop Decoy loot reduction (basis points: 7500 = 75% less loot). */
export const SHIELD_CROP_DECOY_LOOT_REDUCE_BPS = 7500;

// ── Troop Upgrades ─────────────────────────────────────────────────────
/** Maximum troop upgrade level (1 = base, 5 = max). */
export const TROOP_MAX_LEVEL = 5;
/** Gold cost per upgrade level (index 0 = cost to go from lvl 1→2, etc.). */
export const TROOP_UPGRADE_COSTS: number[] = [500, 1200, 2500, 5000];
/** Power multiplier per level in basis points (10000 = 1.0×). Index 0 = level 1. */
export const TROOP_LEVEL_POWER_BPS: number[] = [10000, 12500, 15000, 20000, 25000];

// ── Syndicate Chat & Help Requests ──────────────────────────────────────
/** Max gold a player can request per help request (integer gold). */
export const HELP_REQUEST_MAX_GOLD = 50_000;
/** Cooldown between help requests from the same user (ms). 5 minutes. */
export const HELP_REQUEST_COOLDOWN_MS = 300_000;
/** Help requests expire after this duration (ms). 24 hours. */
export const HELP_REQUEST_TTL_MS = 86_400_000;
