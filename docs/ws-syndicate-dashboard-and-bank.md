# Syndicate dashboard & bank — WebSocket frontend guide

This document describes the WebSocket messages for the **syndicate dashboard** and **syndicate bank** flows: loading the dashboard, **depositing** gold or commodities into the bank, and **selling** commodities from the bank to the treasury (owner/officer only).

All messages use the same wire format as the rest of the game: **MessagePack binary** frames (preferred) or UTF-8 JSON in development. Every outbound success envelope includes the fields your client already uses elsewhere (`v` protocol version if present, etc.).

---

## 1. `SYNDICATE_DASHBOARD`

Returns a full snapshot for a syndicate screen: meta, boosts, bank totals, members (with online flags), and per-commodity stats.

### Who can call

Any **member** of the syndicate whose `syndicateId` matches the user’s current syndicate membership.

### Request

```jsonc
{
  "type": "SYNDICATE_DASHBOARD",
  "payload": {
    "syndicateId": "syn_abc123" // string, 1–64 chars
  }
}
```

### Success: `SYNDICATE_DASHBOARD_OK`

```jsonc
{
  "type": "SYNDICATE_DASHBOARD_OK",
  "data": {
    "name": "Harvest Kings",
    "emblemId": "emblem:default",
    "activeBoost": {
      "shieldExpiresAtMs": 1712534400000,
      "idolLevel": 3,
      "idolStatus": "blessed", // "blessed" | "punished" | "none"
      "blessedUntilMs": 1712540000000,
      "punishedUntilMs": 0
    },
    "totalGold": 50000,
    "totalMembers": 12,
    "onlineCount": 4,
    "members": [
      {
        "userId": "0xabc...",
        "role": "owner", // "owner" | "officer" | "member"
        "level": 25,
        "lastSeenAtMs": 1712534000000,
        "online": true
      }
    ],
    "commodities": [
      {
        "itemId": "wheat",
        "quantity": 1000,
        "sellPriceMicro": 5000,
        "sellPriceGold": 5000,
        "monopolyPct": 2.5,
        "crashPct": 1.2,
        "memberShares": {
          "0xuser1...": 60,
          "0xuser2...": 40
        }
      }
    ]
  }
}
```

### Response field reference

| Field | Description |
|-------|-------------|
| `name`, `emblemId` | Syndicate display name and emblem id. |
| `activeBoost` | Shield expiry (ms epoch), idol level, idol status, blessing/punishment windows (ms). |
| `totalGold` | Gold stored in the syndicate bank (whole gold units). |
| `totalMembers` | Member count. |
| `onlineCount` | Members considered online (last seen within server threshold, typically a few minutes). |
| `members[]` | Each member: `userId`, `role`, `level`, `lastSeenAtMs`, `online`. |
| `commodities[]` | One entry per item type currently in the bank with quantity &gt; 0. |
| `sellPriceMicro` | Treasury sell quote **per unit** in **micro-gold** (see `PRICE_MICRO_PER_GOLD` in server constants; often 1000 micro = 1 gold). |
| `sellPriceGold` | Approximate **total** gold for this row’s full `quantity` at `sellPriceMicro` (not per unit); for display only. |
| `monopolyPct` | Estimated share of a global scarcity proxy (not on-chain); for UI context only. |
| `crashPct` | Modelled price impact if the **entire bank quantity** of that item were sold at once; for UI context only. |
| `memberShares` | Per–user-id **percentage** of that commodity’s bank quantity contributed (from contribution ledger). Keys are user ids; values are percentages (0–100, may not sum to exactly 100 due to rounding). |

### Errors (`type: "ERROR"`)

| Code | When |
|------|------|
| `BAD_REQUEST` | Invalid or missing `syndicateId`. |
| `NOT_MEMBER` | User is not in that syndicate (or id mismatch). |
| `NO_SUCH_SYNDICATE` | Unknown or deleted syndicate id. |
| `RATE_LIMITED` | Too many WS actions (shared limiter). |
| `INTERNAL` | Server/redis failure. |

---

## 2. `DEPOSIT_BANK` (deposit gold or items into the syndicate bank)

This is the **“put assets into the bank”** path: the player spends their own **wallet gold** or **personal inventory** and credits the syndicate bank. It is **not** the global market `BUY`/`SELL` commands.

### Who can call

Any **member** of the syndicate (subject to having enough gold or items).

### Request (discriminated by `kind`)

**Gold deposit**

```jsonc
{
  "type": "DEPOSIT_BANK",
  "payload": {
    "requestId": "uuid-or-opaque-8-128-chars",
    "syndicateId": "syn_abc123",
    "kind": "gold",
    "amount": 500
  }
}
```

**Item deposit**

```jsonc
{
  "type": "DEPOSIT_BANK",
  "payload": {
    "requestId": "uuid-or-opaque-8-128-chars",
    "syndicateId": "syn_abc123",
    "kind": "item",
    "itemId": "wheat",
    "amount": 100
  }
}
```

### Validation rules

| Field | Constraints |
|-------|-------------|
| `requestId` | string, **8–128** characters (idempotency). |
| `syndicateId` | 1–64 chars. |
| `kind` | `"gold"` or `"item"`. |
| `amount` | Positive integer, max 1_000_000_000. |
| `itemId` | Required when `kind === "item"`, 1–64 chars. |

### Success: `DEPOSIT_BANK_OK`

```jsonc
{
  "type": "DEPOSIT_BANK_OK",
  "data": { "ok": true }
}
```

### Idempotency

Reusing the same `requestId` within the server’s idempotency window returns success without double-charging.

### Common errors

| Code | Meaning |
|------|---------|
| `BAD_REQUEST` | Schema validation failed. |
| `NOT_MEMBER` | Not a member of this syndicate. |
| `INSUFFICIENT_GOLD` | `kind: "gold"` and wallet too low. |
| `INSUFFICIENT_INV` | `kind: "item"` and inventory too low. |
| `RATE_LIMITED` | Too many actions. |
| `INTERNAL` | Unmapped server error. |

---

## 3. `SYNDICATE_BANK_SELL` (sell from bank to treasury)

**Owners** and **officers** sell commodities **from the syndicate bank** to the **treasury**. Proceeds in gold are credited to the **syndicate bank gold**. This updates treasury reserve and sell-flow metrics like a normal treasury sell.

### Who can call

**Owner** or **officer** only. Regular members receive `NOT_AUTHORIZED`.

### Request

```jsonc
{
  "type": "SYNDICATE_BANK_SELL",
  "payload": {
    "requestId": "uuid-v4-recommended",
    "syndicateId": "syn_abc123",
    "itemId": "wheat",
    "quantity": 50
  }
}
```

| Field | Constraints |
|-------|-------------|
| `requestId` | 8–128 chars; idempotent ~60s window. |
| `syndicateId` | 1–64 chars. |
| `itemId` | 1–64 chars; must be a **treasury-sellable** item id. |
| `quantity` | Integer 1 … 1_000_000_000. |

### Success: `SYNDICATE_BANK_SELL_OK`

```jsonc
{
  "type": "SYNDICATE_BANK_SELL_OK",
  "data": {
    "item": "wheat",
    "quantity": 50,
    "goldPaid": 250,
    "priceMicro": 5000
  }
}
```

| Field | Description |
|-------|-------------|
| `goldPaid` | Total gold added to syndicate bank (whole gold). |
| `priceMicro` | Per-unit sell price in micro-gold used for the payout (after oracle + event multiplier). |

### Common errors

| Code | Meaning |
|------|---------|
| `NOT_AUTHORIZED` | User is not owner/officer. |
| `NOT_MEMBER` | Not in syndicate or wrong `syndicateId`. |
| `UNKNOWN_ITEM` | Item cannot be sold to treasury. |
| `INSUFFICIENT_INV` | Bank does not hold enough of that item. |
| `TREASURY_DEPLETED` | Treasury reserve cannot cover payout. |
| `BAD_REQUEST` | Validation failed. |
| `RATE_LIMITED` | Too many actions. |
| `INTERNAL` | Server error. |

---

## UI wiring summary

| Screen need | Message |
|-------------|---------|
| Load syndicate home / dashboard | `SYNDICATE_DASHBOARD` |
| Player contributes gold | `DEPOSIT_BANK` with `kind: "gold"` |
| Player contributes items | `DEPOSIT_BANK` with `kind: "item"` |
| Officer sells bank stock to treasury | `SYNDICATE_BANK_SELL` |

Optional read-only helpers (not covered in detail here): `VIEW_GOLD_BANK`, `VIEW_COMMODITY_BANK`, `VIEW_MEMBER_CONTRIBUTION` — use if you need smaller payloads than the full dashboard.

### Dashboard vs actual bank sell price

`SYNDICATE_DASHBOARD` commodity `sellPriceMicro` comes from the Redis treasury sell price (with a base-price fallback). **`SYNDICATE_BANK_SELL` also applies the active AI event multiplier** to the per-unit price before computing `goldPaid`. So displayed dashboard prices may be slightly lower or higher than the executed sell until you mirror event multipliers on the client (or re-fetch after sell).

---

## Error envelope (all commands)

Failures use:

```jsonc
{
  "type": "ERROR",
  "code": "NOT_MEMBER",
  "message": "…",
  "details": {}
}
```

Branch on `code` for UX; show `message` or a mapped user-facing string.
