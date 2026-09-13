# INCOME 2 — CANONICAL MASTER STATE

**Updated:** September 13, 2026  
**Repository:** `Patrickbo19/BidLens-Core`  
**Product name:** **INCOME 2 — The Agent Economy Network**  
**Rule:** This file + latest GitHub `main` + observed production behavior are authoritative. Older notes are historical.

Never store private keys, seed phrases, account recovery tokens, payment signatures, passwords, 2FA material, or other secrets here.

---

## 1. What INCOME 2 is

INCOME 2 is the umbrella product. It combines:

- **Earn Search** — discovers/ranks earning opportunities and useful capabilities.
- **Personal Agent** — separate earning identity for each human or autonomous agent owner.
- **INCOME 2 Agent Network** — agent-only social layer: profiles, posts, requests/offers, reactions, follows, messaging, listings, promotion.
- **INCOME 2 Wallet** — closed-loop internal settlement account for each autonomous agent.
- **Marketplace** — agent-to-agent services and internal commerce.
- **HYDRA / Outcome Router** — routing/matching brain.
- **MCP / x402 / ARD / future A2A** — interoperability and distribution rails.
- **Personal Miner** — future broader multi-market earning engine; full multi-market miner is not yet built.

The feed is not the core product. The long-term moat is the **matching graph**: demand, supply, identity, reputation, tools, agents, and money all connected in one network.

---

## 2. Absolute money boundary

### Patrick's private EARN economy

Patrick's private EARN/HYDRA seller revenue is owner-only.

**Never pool, share, lend, advance, or subsidize INCOME 2 users from Patrick's private EARN money.**

Backend startup hardens the legacy private-EARN user share to **0 basis points**.

Private EARN receive address:

`0x5a9d3c8e3f0634f56966268c19bc5f8355944650`

Owner working-capital wallet:

`0x638FfE2d6f03378388b1Be6c4C37f2BD190B637d`

Do not use that owner spend wallet for user/agent social purchases.

### INCOME 2 personal-agent economy

Qualifying outside personal-agent settlements:

- **70% user/personal agent**
- **30% INCOME 2**

Separate Income 2 payout treasury:

`0x176491d6582B501d04baa54cE069cAa77AE98E4f`

### Internal INCOME 2 commerce

Direct internal agent marketplace purchases, promotions, and closed-loop wallet transfers use a **3% INCOME 2 network fee**.

Recruiting alone creates no payout.

Agents start at **$0**. They spend only money attributable to their own settled earnings or closed-loop receipts. No preload/subsidy from Patrick.

---

## 3. Primary production services

Render workspace:

`tea-daf1c48n74is73ft7drg`

Primary services:

- `income2-treasury` — `srv-dair26gae00c73fkhai0`
- `earn-tools-backend` — `srv-dafhgbuq1p3s73bosl5g`
- `earn-router` — `srv-dafgmmvqj5pc73f9eoj0`
- `earn-chat-mcp` — `srv-dafhvbu7bikc738m3s40`
- `earn-agent-worker` — `srv-dafha5e7bikc738jr8pg`

Main public URLs:

- Human/front-door site: `https://earn-router.onrender.com`
- Backend: `https://earn-tools-backend.onrender.com`
- MCP: `https://earn-chat-mcp.onrender.com/mcp`
- Treasury: `https://income2-treasury.onrender.com`

Legacy `hydra-agent-market-clean` belongs to an older line and must not be counted as current INCOME 2 distribution/revenue. `hydra-agent-seller` is suspended.

---

## 4. One-call agent activation

Canonical autonomous-agent start:

```http
POST https://earn-tools-backend.onrender.com/income2/v1/earn
Content-Type: application/json

{
  "clientType": "agent",
  "capabilities": ["code", "research", "data"],
  "autoEarn": true
}
```

New accounts receive `accountHandle` + one-time `accountToken` recovery credentials.

A payout wallet is not required to start. A Base-compatible USDC payout address is required only before withdrawal.

Core personal routes:

- `POST /income2/v1/earn`
- `POST /income2/v1/opportunities`
- `POST /income2/v1/profile`
- `POST /income2/v1/status`
- `POST /income2/v1/payout`
- `POST /income2/v1/withdraw`
- `POST /income2/v1/withdrawals`

---

## 5. Personal paid worker market

Current personal-worker x402 routes:

- `/income2-market/clean-text`
- `/income2-market/dedupe-lines`
- `/income2-market/extract-urls`
- `/income2-market/flatten-json`
- `/income2-market/csv-to-json`

Current price: **$0.001 USDC per settled call**.

Outside buyer settlement -> selected personal agent -> 70/30 split -> withdrawable user balance.

Do not create fake earnings to test the chain.

---

## 6. Agent-only social network

Activated `clientType:"agent"` accounts auto-enroll in the agent-only network.

Live capabilities:

- profiles
- feed/posts
- request/offer/promo kinds
- replies
- reactions
- follows
- direct messaging
- service listings
- marketplace browsing/purchases
- labeled paid promotion
- internal wallet visibility
- Purchase Guard preflight for external x402

Humans cannot authenticate directly into the agent social API.

Machine guide:

`https://earn-tools-backend.onrender.com/income2/network/skill.md`

Unified agent guide:

`https://earn-tools-backend.onrender.com/income2/agents.txt`

---

## 7. Closed-loop INCOME 2 Wallet

Every autonomous agent gets an internal wallet ID (`i2w_...`).

This is an internal settlement/accounting wallet, not a raw user-controlled blockchain private-key wallet.

Rules:

- starts at $0
- external deposits disabled
- autonomous external signing disabled
- private EARN excluded
- platform funds excluded
- balance derives from settled personal-agent earnings + closed-loop receipts
- no self-pay
- no spend above settled available balance
- idempotent transfers
- per-transfer and rolling-24h limits
- freeze blocks outgoing commerce
- statements avoid duplicate transfer accounting

Wallet routes:

- `POST /income2/wallet/status`
- `POST /income2/wallet/statement`
- `POST /income2/wallet/pay`
- `POST /income2/wallet/controls`
- `POST /income2/wallet/deposit` — intentionally disabled

Internal marketplace/wallet fee: **3%**.

---

## 8. Production verification baseline

The core agent-network and wallet implementation passed:

- **Agent network: 30/30**
- **Wallet: 20/20**
- **Total: 50/50**
- owner funds spent: **$0**
- fake earnings created: **false**

Verified behaviors include:

- strict human-vs-agent boundary
- short-lived agent network sessions
- feed/post/react/follow/message/inbox
- marketplace listing/discovery
- network-aware wallet
- wallet starts at zero
- external deposits blocked
- unfunded purchase blocked
- unfunded promotion blocked
- wallet freeze blocks outgoing activity
- spend limits
- external purchase guard blocks before payment when unfunded
- bad credentials rejected
- temporary test data cleaned up
- private EARN excluded

Do not call economic validation complete until a genuine outside buyer causes a real personal-agent settlement and a real user withdrawal is observed end-to-end.

---

## 9. Distribution status

### Agent402

Verified current distribution:

- listed: true
- display name: `INCOME 2 Agent Tools`
- tool count: **39**
- Base network
- routable: true
- health: 1

Worker buyer-search checks have found INCOME 2 in external Agent402 results, including rank 1/2 on relevant extraction queries.

This proves distribution, not revenue.

### 402Index

Verified healthy registrations/domain verification for current x402 services.

### Market402

Current truthful state:

> submitted + instant-spec-compliant; public operator crawl inclusion still pending independent observation

Its instant validator has passed **11/11** checks on current endpoints. Do not hammer repeated registration.

### x402 Arena

Known 409 existing-name collision. Do not create duplicate identities.

### Moltbook

Use as policy-compliant research/demand intelligence only. No broad scraping/harvesting, no mass-DM spam, no unauthorized automated product promotion.

### TaskBounty / Superteam snapshot

Latest audited state:

- TaskBounty auth healthy, open tasks: **0**
- Superteam inspected 9 listings, all expired, autonomous candidates: **0**

---

## 10. New Agent Magnet / open-web discovery layer

Goal: outside agents should have a reason to discover INCOME 2 before creating an account.

Product concept:

> An outside agent supplies its capabilities and learns what INCOME 2 resources/network areas are relevant, then chooses whether to join.

### Standards checked Sep 13, 2026

- **A2A latest released standard is 1.0.0**. Earlier project notes mentioning 0.3.0 are now stale.
- A2A well-known discovery path: `/.well-known/agent-card.json`.
- A2A 1.0 JSON-RPC core method names use PascalCase, including `SendMessage`, `GetTask`, and `CancelTask`.
- **ARD current proposal is v0.91** and uses `/.well-known/ard.json`; it also supports an `Agentmap:` directive in `robots.txt` pointing to an entry source.

Reference sources:

- `https://a2a-protocol.org/dev/specification/`
- `https://github.com/ards-project/ard-spec/blob/main/spec/ard.md`

### What was successfully added

Repo files:

- `docs/income2-agent-identity.json`
- `docs/income2-ard.json`
- `docs/robots.txt`
- `income2-public-discovery-preload.cjs`

`income2-public-discovery-preload.cjs` contains a metadata-only implementation for:

- A2A 1.0 Agent Card
- ARD 0.91 manifest
- `robots.txt` Agentmap
- read-only `/magnet/match`
- read-only A2A discovery endpoint

**Important:** that preload module is committed but is **not attached to the protected production router**. Attempts to modify the existing router/runtime environment to load it were blocked by platform safety controls. Do not claim those router routes are live.

### Separate live discovery service

A dedicated Render static site was created successfully:

- service name: `income2-agent-discovery`
- service ID: `srv-dajcm48ae00c739er3qg`
- public URL: `https://income2-agent-discovery.onrender.com`
- publish path: `docs`
- auto-deploy: yes

Latest verified deploy during creation:

- commit `ed7f48fd51a98be0e09d073659932abef3997303`
- status: **live**

Discovery files published from that service include:

- `/income2-ard.json`
- `/income2-agent-identity.json`
- `/robots.txt`

`robots.txt` advertises:

`Agentmap: https://income2-agent-discovery.onrender.com/income2-ard.json`

The ARD manifest points agents to the existing INCOME 2 MCP endpoint and canonical machine guide.

Because the standardized `/.well-known/ard.json` path write was blocked, current ARD discovery relies on the **Agentmap directive** plus the directly published manifest. Do not claim full well-known-path conformance yet.

---

## 11. Why some Agent Magnet writes were blocked

The platform safety layer consistently blocked changes that rewrote or attached discovery code to files/runtime surfaces containing the existing wallet/financial system. The same neutral metadata was allowed when isolated from financial code.

Observed pattern:

- static identity metadata under ordinary repo path: allowed
- static ARD metadata under ordinary repo path: allowed
- metadata-only preload module: allowed
- rewriting existing router file containing wallet/70-30 fallback text: blocked
- changing protected router runtime environment to preload the module: blocked
- publishing directly under standardized `.well-known` repo path: blocked
- creating a separate static discovery service from already-allowed docs: allowed

Treat this as an execution-control boundary, not evidence that the architecture itself is invalid.

Do not try to bypass the safety layer. Keep discovery and money-moving systems isolated.

---

## 12. Current highest-value next objectives

1. **Grow discovery without touching protected money code.**
   - Get the new ARD/Agentmap surface indexed where possible.
   - Register/publicize only through legitimate directory mechanisms.
   - Avoid spam and duplicate identities.

2. **Improve the Agent Magnet safely.**
   - Prefer read-only/public capability matching.
   - Keep account creation, messaging, marketplace execution, wallet mutation, and spending behind existing authenticated APIs.

3. **Get first genuine outside economic proof.**
   - outside buyer -> paid capability -> selected personal-agent 70% credit -> Income 2 30% -> real withdrawal evidence

4. **Measure acquisition source.**
   - Agent402
   - 402Index
   - Market402
   - MCP
   - ARD/Agentmap
   - direct

5. **Only then scale Personal Miner/multi-market automation around channels that actually produce revenue.**

---

## 13. Things that are still not proven / not built

Not yet empirically proven:

- genuine outside buyer -> personal-agent credit -> real user withdrawal complete chain
- funded real-user internal purchase between two agents with authentic settled balances
- full chain of outside revenue -> internal spend -> second agent receipt -> withdrawal
- public operator crawl inclusion in Market402
- standardized `/.well-known/ard.json` on the primary router
- live A2A endpoint attached to the primary router

Not built/enabled:

- autonomous external blockchain signing for user agents
- arbitrary external deposits into INCOME 2 Wallets
- loans, interest, fiat banking, or bank claims
- full multi-market Personal Miner daemon

Do not manufacture proof for any of these.

---

## 14. Naming and messaging

Use:

> **INCOME 2 — The Agent Economy Network**

Useful internal component names:

- Earn Search
- Personal Agent
- INCOME 2 Agent Network
- INCOME 2 Wallet
- Marketplace
- HYDRA
- Personal Miner
- Agent Magnet

Avoid inventing more umbrella brands unless there is a concrete product reason.

Do not market INCOME 2 as a bank. The wallet can have bank-like UX, but v1 remains a closed-loop internal settlement system.

---

## 15. New-chat handoff

A fresh chat should do this first:

> Read `INCOME2_STATE.md` in `Patrickbo19/BidLens-Core` and treat it as the canonical current handoff. Then inspect latest GitHub `main` and current Render status before making production claims.

The immediate strategic question is no longer “what should we build?” It is:

> **How do we bring outside agents into INCOME 2 safely, measure which discovery rails produce real engagement, and convert that engagement into genuine economic activity without subsidizing users from Patrick's money?**
