# Ravolo — Pitch Deck (Text)

**Audience:** Monad hackathon judges & builders  
**Format:** ~8–10 slides · ~5–7 min live · adjust depth to timebox

---

## Slide 1 — Title

**Ravolo**  
_A real-time farming MMO with a live global economy — built so gameplay stays fast and value can settle on-chain._

**One-liner (pick one):**

- **Short:** Multiplayer farming where the economy _is_ the game — fast enough for WebSockets, EVM-native enough for real payouts on Monad.
- **Architecture-aware:** Authoritative game state in Redis for sub-100 ms actions; Monad for withdrawals and token settlement — not every click on-chain.

**Presenter name · contact · “Built for Monad” badge**

---

## Slide 2 — The problem

**Crypto games often force a false choice:**

- **Fun & fast** → economy lives only in a central DB; players don’t _own_ liquid value.
- **“Fully on-chain”** → every action waits on blocks; latency kills the feel of a real-time game.

**Players notice** when the UI says one thing and the chain another. **Devs notice** when they can’t ship both fairness under load and credible withdrawals.

---

## Slide 3 — Market opportunity

**Headline:** MARKET OPPORTUNITY

**Chart (your template):** three bars — **Global mobile gaming** (largest) · **Blockchain gaming** (early) · **Africa’s gaming market** (small today, asymmetric upside)

**Bullet 1 — A massive, underserved intersection**

Mobile is where real-time games actually live: session length, habit, and distribution already won. **Blockchain gaming** is still a thin slice of global play — most “web3 games” never ship the feel of a real mobile game. **Ravolo sits in the gap:** mobile-speed loops + an economy serious enough that **on-chain settlement** (e.g. on Monad) is meaningful, not cosmetic.

**Bullet 2 — Smartphone + internet penetration (why timing matters)**

Players already have the device; the constraint is **product**, not awareness. As connectivity and smartphone penetration keep rising — especially in **mobile-first regions** — the winners will be titles that feel native to the phone **first**, and attach wallets **second**. Ravolo is built that way: authoritative real-time server, optional chain for value.

**Optional speaker line (10 seconds):**  
_“The chart isn’t claiming precision — it’s the shape: mobile gaming is the ocean; web3 gaming is still a bay; regional markets like Africa are under-served relative to how people actually play. We’re building for the ocean’s UX with the bay’s ownership.”_

**Footnote for your designer / data:** Replace relative bar heights with **one sourced stat per bar** (e.g. Newzoo / DataReportal / regional games reports). Until then, label the Y-axis **“Relative scale (illustrative)”** or remove numbers from the slide to avoid fake precision.

---

## Slide 4 — What Ravolo is

**Ravolo** is a **live multiplayer** farming and economy simulation:

- Farms, crops, harvesting, inventory
- **Dynamic market** (buy / sell, pricing that reacts to flows)
- **Social layer** — syndicates, competition, shared stakes _(name only what you demo)_

**Design principle:** _Gameplay authority first._ The server is the source of truth for concurrent play; the chain is where we **prove** and **move** value when it should leave the game.

---

## Slide 5 — How it works (architecture in one breath)

| Layer                        | Role                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------- |
| **WebSockets + MessagePack** | Low-latency player actions                                                       |
| **Redis + Lua**              | Atomic mutations under contention — money, inventory, plots in one shot          |
| **Postgres / Supabase**      | Profiles, audit, durability, recovery                                            |
| **Workers (BullMQ)**         | Pricing ticks, settlements, heavy jobs — _not_ inside the hot path               |
| **Monad (EVM)**              | Token contracts, withdrawals, identity tied to the same wallet users already use |

**Key line for judges:** _We don’t spam the chain with gameplay — we settle value when it matters._

---

## Slide 6 — Why Monad

- **EVM-compatible L1** — same wallets, tooling, and mental model as Ethereum; deploy and test on **Monad testnet**, ship toward mainnet.
- **High throughput & fast blocks** — fits **batched settlements**, player withdrawals, and future token mechanics without pretending the chain confirms every farm click.
- **Ecosystem** — explorers, RPCs, wallets — players and devs aren’t learning a bespoke stack from scratch.

_(Optional sub-bullet if you cite docs: Monad testnet for development; align `chainId` and RPC with current [network docs](https://docs.monad.xyz/developer-essentials/testnets).)_

---

## Slide 7 — Product wedge (what we’re proving _this week_)

**Smallest sharp story:**

1. Player takes **real-time** actions in the world.
2. **Economy state** stays consistent under spam and retries (server-enforced).
3. **Wallet-linked identity** (Solana sign-in + **EIP-155 / Monad** path for EVM users).
4. **On-chain hook:** show **one** credible path — e.g. testnet **ERC-20** transfer or “withdraw gold” job — even if minimal.

_If you don’t ship (4) yet, say: “Hook designed; contract/deploy this sprint” — don’t imply it’s live._

---

## Slide 8 — Demo script (on-screen)

**2–3 minutes, three beats:**

1. **Play** — plant / harvest / sell — show **instant** feedback.
2. **Economy** — price or balance changes that reflect **real rules**, not fake UI.
3. **Chain (if available)** — tx hash, explorer link, or architecture slide if not wired.

**Fallback line:** _“Backend is production-shaped; on-chain leg is the hackathon stretch goal.”_

---

## Slide 9 — Traction & honesty

Use **only what’s true:**

- _e.g._ Private alpha · X testers · Y sessions · Z trades
- Or: _“Shipped for hackathon; first external playtests next.”_

**Do not** substitute waitlists for traction. If traction is thin, **one sentence** and move on.

---

## Slide 10 — Roadmap (near-term)

1. Harden **withdraw / mint** path to **Monad testnet** token.
2. **Indexer / receipt** confirmation before marking payout final in DB.
3. **Solana rail** for SPL — parallel story for non-EVM players _(if that’s the product split)_.
4. Progressive **decentralization** of treasury keys (multisig, custody) — post-wedge.

---

## Slide 11 — Team & ask

**Team:** names · roles · relevant past (one line each).

**Ask (pick one):**

- Technical feedback on **settlement architecture**
- Introductions to **Monad ecosystem** teams (wallets, RPCs, games)
- **Grant / prize** alignment with real-time + on-chain settlement story

**Close:** _“Ravolo — fast game loop, honest economy, Monad for value that leaves the farm.”_

---

## Appendix — FAQ (for Q&A)

**Q: Is everything on-chain?**  
A: No. Gameplay is authoritative on the server for speed and fairness; we use the chain for identity and value settlement.

**Q: Why not full on-chain game logic?**  
A: Players want **responsive** play and **credible** ownership — not every action waiting for a block.

**Q: What’s the token?**  
A: _[Your answer: e.g. in-game gold with a planned ERC-20 on testnet, treasury mint/transfer, etc.]_

---

## Speaker notes (30-second cold open)

> “Most ‘Web3 games’ make you pick: either it feels like a real game, or the numbers on-chain match reality. Ravolo is a real-time farming MMO with a live economy under the hood — Redis and atomic scripts for fair play at speed, and Monad for the EVM leg where we settle value to the player’s wallet. I’ll show you [two actions] and [one economy effect], and how we’re wiring Monad for the part that should actually be on-chain.”

---

_Customize Slides 4–5 with your exact feature names from the shipped build. Replace bracketed items before presenting._
