/**
 * Atomically move gold from the global treasury reserve into a player's wallet (Redis HASH `gold`).
 *
 * This operates on **in-game** Redis state only — not on-chain tokens.
 *
 * Usage:
 *   pnpm exec tsx src/cli/treasuryGrantGold.ts --user-id <uuid> --amount <n> [--note <text>]
 *   pnpm exec tsx src/cli/treasuryGrantGold.ts --dry-run --user-id <uuid> --amount 50000
 *
 * Requires REDIS_URL (e.g. in .env). Do not commit credentials.
 */
import "dotenv/config";
import { Redis } from "ioredis";
import { treasuryReserveKey, walletKey } from "../infrastructure/redis/keys.js";

const TRANSFER_LUA = `
local amt = tonumber(ARGV[1])
if not amt or amt < 1 or math.floor(amt) ~= amt then
  return redis.error_reply('BAD_AMOUNT')
end
local reserve = tonumber(redis.call('GET', KEYS[1]) or '0') or 0
if reserve < amt then
  return redis.error_reply('INSUFFICIENT_TREASURY')
end
local afterReserve = redis.call('DECRBY', KEYS[1], amt)
local newGold = redis.call('HINCRBY', KEYS[2], 'gold', amt)
return {afterReserve, newGold}
`;

function parseArgs(argv: string[]): {
  userId: string;
  amount: number;
  dryRun: boolean;
  note?: string;
} {
  let userId = "";
  let amount = 0;
  let dryRun = false;
  let note: string | undefined;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--user-id" && argv[i + 1]) {
      userId = argv[++i]!;
    } else if (a === "--amount" && argv[i + 1]) {
      amount = Number.parseInt(argv[++i]!, 10);
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--note" && argv[i + 1]) {
      note = argv[++i];
    }
  }
  if (!userId || !Number.isFinite(amount) || amount < 1) {
    console.error(
      "Usage: tsx src/cli/treasuryGrantGold.ts --user-id <uuid> --amount <positive-int> [--dry-run] [--note <text>]",
    );
    process.exit(1);
  }
  return { userId, amount, dryRun, note };
}

const { userId, amount, dryRun, note } = parseArgs(process.argv);

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.error("REDIS_URL is required (set in environment or .env)");
  process.exit(1);
}

const reserveK = treasuryReserveKey();
const walletK = walletKey(userId);

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
});

try {
  const beforeReserve = Number(await redis.get(reserveK)) || 0;
  const beforeGold = Number(await redis.hget(walletK, "gold")) || 0;

  console.log("Treasury grant (Redis)");
  console.log("  reserve key:", reserveK);
  console.log("  wallet key: ", walletK);
  console.log("  userId:     ", userId);
  console.log("  amount:     ", amount);
  if (note) console.log("  note:       ", note);
  console.log("  before reserve:", beforeReserve);
  console.log("  before wallet gold:", beforeGold);

  if (dryRun) {
    if (beforeReserve < amount) {
      console.error("Dry-run: treasury would be insufficient.");
      process.exit(2);
    }
    console.log("Dry-run only — no changes applied.");
    process.exit(0);
  }

  if (beforeReserve < amount) {
    console.error(
      `Insufficient treasury: have ${beforeReserve}, need ${amount}`,
    );
    process.exit(2);
  }

  const result = (await redis.eval(
    TRANSFER_LUA,
    2,
    reserveK,
    walletK,
    String(amount),
  )) as [number | string, number | string];

  const afterReserve = Number(result[0]);
  const afterGold = Number(result[1]);

  console.log("OK — transfer applied atomically.");
  console.log("  after reserve:    ", afterReserve);
  console.log("  after wallet gold:", afterGold);
} finally {
  await redis.quit();
}
