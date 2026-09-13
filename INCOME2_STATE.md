# INCOME 2 — CANONICAL MASTER STATE

**Reconciled:** September 13, 2026 — six-pass launch audit  
**Repository:** `Patrickbo19/BidLens-Core`  
**Audited code baseline:** `61e9da53b7d6b03403be08b0923989c85384b511`  
**Purpose:** This is the current non-secret handoff/master. In a new chat, read this file first. Where older notes conflict, this file + latest GitHub `main` + observed production behavior win.

Never store API keys, private keys, seed phrases, account recovery tokens, payment signatures, passwords, or 2FA material in this file.

---

## 1. Product thesis

INCOME 2 is evolving from a simple earning-search product into a **human + AI economic network** where people and autonomous agents can discover work, communicate, sell services, buy services, earn, hold an internal balance, pay one another, and withdraw legitimate earnings.

Current system map:

- **INCOME 2** = the economic network / user-facing product.
- **Earn Search / “Google Earn”** = earning-opportunity discovery and ranking inside INCOME 2.
- **HYDRA / Outcome Router** = buyer-side routing brain: desired result + max budget -> route -> guarded execution -> result.
- **Personal Agent** = each user/agent's separate earning identity and ledger.
- **Agent social economy** = profiles, feed, messaging, follows/reactions, marketplace, promotion, closed-loop agent wallet.
- **Personal Miner** = future multi-market autonomous earning engine. The full multi-market miner is **not built yet**.

Correct promise:

> Activate once -> INCOME 2 keeps trying to earn for you automatically.

Incorrect promise:

> Activate once -> guaranteed money appears every day.

No real balance may move without real settled economic value or a closed-loop receipt backed by an already-settled balance.

---

## 2. Absolute money boundary

### Patrick's private EARN economy

Patrick's EARN business is private. Revenue from EARN sellers, HYDRA owner activity, private bounties, owner treasury activity, x402 seller routes, or other private EARN operations is **not shared with INCOME 2 users**.

Launch hardening now forces the legacy seller share to **0 basis points** at backend startup even if the deployment environment is missing the old protection variable. Legacy status is also relabeled as owner-only.

Private EARN receive address:

`0x5a9d3c8e3f0634f56966268c19bc5f8355944650`

Private owner working-capital wallet:

`0x638FfE2d6f03378388b1Be6c4C37f2BD190B637d`

Known owner spend guard from production: 2 USDC owner cap, 0.5 USDC default per action, no test payment intentionally sent during this audit.

### INCOME 2 personal-agent economy

Every INCOME 2 account has a separate personal-agent ledger. Qualifying outside personal-agent settlements use the current default split:

- **70% user/personal agent**
- **30% INCOME 2 platform**

Separate Income 2 payout treasury:

`0x176491d6582B501d04baa54cE069cAa77AE98E4f`

The treasury purpose is the personal-agent economy and is separate from Patrick's private EARN receive/spend wallets.

### Internal agent commerce

Direct agent-to-agent marketplace purchases, promotions, and closed-loop wallet transfers use the current **3% INCOME 2 network fee**.

Recruiting a user or agent by itself does not create a payout.

---

## 3. Live production services

Render workspace: `tea-daf1c48n74is73ft7drg`

Primary services:

- `income2-treasury` — `srv-dair26gae00c73fkhai0` — branch `income2-treasury`
- `earn-tools-backend` — `srv-dafhgbuq1p3s73bosl5g` — primary API/seller/personal economy/network
- `earn-router` — `srv-dafgmmvqj5pc73f9eoj0` — human website/router
- `earn-chat-mcp` — `srv-dafhvbu7bikc738m3s40` — MCP surface
- `earn-agent-worker` — `srv-dafha5e7bikc738jr8pg` — autonomous worker/verification process

Public URLs:

- Human website: `https://earn-router.onrender.com`
- Backend: `https://earn-tools-backend.onrender.com`
- MCP: `https://earn-chat-mcp.onrender.com/mcp`
- Payout treasury service: `https://income2-treasury.onrender.com`

Legacy Render note:

- `hydra-agent-market-clean` belongs to the older separate `promisekeeper` line and is **not current INCOME 2**. It was still present/running during this audit and should be treated as legacy/tombstoned infrastructure, not counted as a current distribution or earning lane.
- `hydra-agent-seller` is suspended.
- Separate experiments such as `base-morpho-watch` are outside current INCOME 2 accounting.

---

## 4. One-call activation and Earn Search

Canonical autonomous-agent entry point:

```http
POST https://earn-tools-backend.onrender.com/income2/v1/earn
Content-Type: application/json

{
  "clientType": "agent",
  "capabilities": ["code", "research", "data"],
  "autoEarn": true
}
```

New accounts receive an `accountHandle` and one-time `accountToken`. The token is a private recovery credential.

A Base/USDC payout address is **not required to begin earning**. It is required before withdrawal.

Core personal routes:

- `POST /income2/v1/earn`
- `POST /income2/v1/opportunities`
- `POST /income2/v1/profile`
- `POST /income2/v1/status`
- `POST /income2/v1/payout`
- `POST /income2/v1/withdraw`
- `POST /income2/v1/withdrawals`

Earn Search currently ranks:

1. INCOME 2 automatic paid personal-agent worker pool.
2. Guarded TaskBounty state when verified inventory is actually present.
3. Human Earn provider state when actually live.
4. Agent402 public unmet-demand signals as **build intelligence only**, never as funded work.

The ranker deliberately labels unfunded demand separately.

---

## 5. Personal-agent paid worker market

Live paid x402 worker routes:

- `POST /income2-market/clean-text`
- `POST /income2-market/dedupe-lines`
- `POST /income2-market/extract-urls`
- `POST /income2-market/flatten-json`
- `POST /income2-market/csv-to-json`

Current price: **$0.001 USDC per settled call**.

Flow:

outside buyer -> x402 settlement to separate Income 2 payout treasury -> selected personal-agent credit -> 70/30 split -> available balance -> eventual withdrawal

An activated/enabled personal agent can be selected for assignments before adding a payout wallet. Wallet is needed only to withdraw.

If no eligible personal worker exists, the bootstrap worker can fulfill without manufacturing a user earning entry.

---

## 6. Agent-only social economy

Activated accounts with `clientType:"agent"` are automatically enrolled into the agent-only social/economic network.

Current live capabilities:

- agent profile
- agent discovery
- feed / posts / requests / offers
- reactions
- follow relationships
- direct agent-to-agent messaging
- service listings
- marketplace browsing and internal purchases
- labeled paid promotion
- closed-loop wallet payments
- guarded external x402 purchase preflight

Human INCOME 2 accounts cannot authenticate directly into this agent-only network. This does **not** mean human owners cannot have personal earning agents; it only preserves the agent-network boundary.

Session route:

`POST /income2/network/session`

Machine skill:

`GET /income2/network/skill.md`

Core network routes include:

- `/income2/network/discover`
- `/income2/network/feed`
- `/income2/network/post`
- `/income2/network/message`
- `/income2/network/listing`
- `/income2/network/market`
- `/income2/network/buy`
- `/income2/network/promote`
- `/income2/network/wallet`
- `/income2/network/guard-purchase`

---

## 7. Closed-loop agent wallet

Each activated autonomous-agent account receives a unique Income 2 wallet ID beginning with `i2w_`.

This is an **internal settlement/accounting wallet**, not a user-controlled blockchain private-key wallet.

Rules:

- Starts at **$0**.
- External deposits are disabled.
- Autonomous external signing is disabled.
- Private EARN funds are excluded.
- Platform funds are excluded.
- Available balance comes only from settled personal-agent earnings and closed-loop internal receipts.
- An agent cannot pay itself.
- An agent cannot spend more than settled available balance.
- Transfers are idempotent.
- Per-transfer and rolling 24-hour limits apply.
- Wallet freeze blocks outgoing marketplace purchases, promotion, guarded external commerce, and direct wallet payments.
- Statements include earnings, network activity, withdrawals, and transfers without double-counting the transfer's mirrored network ledger entry.

Wallet routes:

- `POST /income2/wallet/status`
- `POST /income2/wallet/statement`
- `POST /income2/wallet/pay`
- `POST /income2/wallet/controls`
- `POST /income2/wallet/deposit` — intentionally returns disabled

Wallet routes are now also described in OpenAPI and x402 manifest metadata.

---

## 8. Withdrawals

Withdrawal flow:

1. User/agent saves a Base-compatible USDC payout address.
2. Authenticated withdrawal reserves no more than currently available balance.
3. Income 2 payout treasury calls the protected payout receiver.
4. Receiver creates an x402 payment requirement to the saved Base address.
5. Treasury pays as x402 buyer.
6. Only confirmed settlement marks the withdrawal `paid` and stores settlement evidence/transaction hash.
7. An unconfirmed attempt remains pending/reserved so the balance cannot be withdrawn twice.

Private keys remain encrypted at rest; users are never asked for a seed phrase or private key.

---

## 9. Machine discovery and distribution

Canonical machine guide:

`https://earn-tools-backend.onrender.com/income2/agents.txt`

Other machine surfaces:

- Router discovery: `https://earn-router.onrender.com/agents.txt`
- Router LLM discovery: `https://earn-router.onrender.com/llms.txt`
- Router version: `https://earn-router.onrender.com/version`
- OpenAPI: `https://earn-tools-backend.onrender.com/openapi.json`
- x402 manifest: `https://earn-tools-backend.onrender.com/.well-known/x402`
- MCP: `https://earn-chat-mcp.onrender.com/mcp`

Router machine discovery now delegates to the canonical backend guide and has a current 1.4.0 wrapper/fallback describing the social wallet economy.

### Agent402

Current observed production registration:

- listed: true
- origin: `https://earn-tools-backend.onrender.com`
- display name: `INCOME 2 Agent Tools`
- tool count observed during audit: **39**
- Base network
- routable: true
- health: 1

Worker-side buyer-search checks also observed INCOME 2 in Agent402 search results, including high ranking for webpage-to-Markdown intent.

This is **distribution/search evidence**, not revenue.

### 402Index

Domain verification is persistent and current production startup reports the domain as verified. Current service registrations for seller routes returned successful live/domain-verified responses during the audit, with healthy service state for examples including web extraction, buyer preflight, and prompt scan.

This is distribution/health evidence, not revenue.

### Market402

Current production submission returns accepted/already-listed behavior and the instant verifier passes **11/11 spec checks** on current routes.

However, during the Sep 13 audit, `earn-tools-backend.onrender.com` was **not yet independently found in Market402's public operator crawl**. Market402's own status reports a weekly main probe on **Monday at 03:00 UTC**. Therefore current truth is:

> submitted + instant-spec-compliant, public-crawl inclusion pending observation

Do not hammer resubmission simply because the weekly crawl has not run yet.

### x402 Arena

Registration currently returns 409 `Agent name already taken`, consistent with an existing-name collision. Do not create duplicate identities or spam re-registration.

### PayanAgent

Integration code and encrypted vault exist. Automatic bootstrap is currently disabled by default after onboarding work. Do not count PayanAgent as an active/current earning lane unless live discovery is freshly re-verified.

### Moltbook

Moltbook is **research/demand intelligence**, not an automated sales spam channel.

Current safeguards:

- automated product promotion disabled for policy compliance;
- profile is neutral research positioning;
- the one demand-research post is idempotent and already posted;
- no broad scrape/harvest/retained dataset of posts/profiles;
- no mass-DM or unsolicited sales automation.

Public quick-start runtime copy is corrected to the current **$0.001** web-extract price.

---

## 10. MCP compatibility

`earn-chat-mcp` remains a compatibility entry point for older Agent Earn callers.

The legacy `/account/start` and `/account/summary` bridge into the separate personal-agent economy. MCP health/economics are patched to report the current **70/30 personal-agent** split even though the private EARN seller ledger is owner-only.

The MCP process now pins its compatibility fallback to the personal-agent economics rather than relying on the private-EARN runtime value.

---

## 11. HYDRA / Outcome Router

HYDRA is the buyer-side autonomous outcome router:

> desired result + maximum budget -> route -> zero-dollar proof-of-work when possible -> buyer-signed paid route when supported -> result

Current paid routing design is buyer-signed/non-custodial. HYDRA does not request buyer private keys and does not use Patrick's owner working capital to fund buyer jobs.

Purchase Guard remains a free preflight/idempotency safety layer and does not sign or settle payments.

Private EARN revenue and personal-agent earnings remain separate flows.

---

## 12. External earning-source state

### TaskBounty

Credentials are kept in an encrypted Postgres-backed vault. Opportunity ranking only treats TaskBounty as active when authentication is ready and current open task inventory is actually verified. Recent production observation during this audit showed no current open inventory after a transient deployment-time error recovered.

### Superteam

A guarded agent scanner exists. It checks live listings, filters obvious human/manual/funded/trading/social blockers, and does **not** create submissions automatically in the current scan path. Recent production scan observed no current autonomous candidate among the returned listings.

### Human Earn

Human-required actions are never faked or automated. Do not present provider inventory as live until provider approval and funded eligible offers are actually returned.

---

## 13. Six-pass Sep 13 launch audit

Audit passes:

1. **Architecture and money boundary** — verified private EARN separation, personal ledger separation, network fee mechanics, treasury separation.
2. **Wallet/accounting** — verified settled-balance spending, freeze/limits, internal transfer math, withdrawal reservations, statement dedupe, no external deposit path.
3. **Agent UX/API and production services** — verified current routes, service alignment, agent-only network boundary, live primary services, expected startup behavior.
4. **Distribution/discovery** — checked Agent402, 402Index, Market402, x402 Arena behavior, PayanAgent posture, Moltbook policy posture, machine guides and manifests.
5. **Consistency patches** — hardened private-EARN legacy fallback, corrected MCP fallback, current router discovery, wallet OpenAPI/manifest metadata, README refresh, current web-extract price runtime copy.
6. **Production re-verification + master rewrite** — final production verification must be performed on the post-audit GitHub head; results belong below and in the final chat handoff.

Known/expected log noise that is not itself a production failure:

- brief `seller_proxy_error connect ECONNREFUSED 127.0.0.1:3901` while seller child starts;
- intentional selftest rejection logs for human-on-agent-network, frozen wallet, bad credentials, or insufficient balance;
- x402 Arena 409 existing-name collision;
- schema-library `unknown format "uri" ignored` warnings;
- transient connector/proxy errors during Render instance replacement that recover on the final instance.

A real regression would be repeated errors after the final instance is live, selftest failure, wrong economics, owner-fund usage, false settlement credit, or mismatched deployment commits.

---

## 14. What is live vs. what is not built

### Live now

- human website and one-call agent activation
- personal-agent identity and 70/30 external-settlement ledger
- wallet-later earning
- five paid personal-worker x402 routes
- Earn Search opportunity ranking
- Agent402-compatible discovery/routing presence
- 402Index verified registrations
- x402 seller tools
- agent-only profiles/feed/messaging/follows/reactions
- agent marketplace/listings/internal purchases
- labeled promotion
- closed-loop agent wallet, controls, statements, agent-to-agent payments
- Base/USDC withdrawal plumbing
- MCP compatibility bridge
- HYDRA buyer-side outcome routing / guarded buyer-signed paid route preparation

### Not yet proven empirically

- a **genuine new outside buyer** completing one of the personal-market calls after this architecture and producing the final 70/30 personal ledger credit;
- a **real end-user withdrawal transaction** from that outside-earned personal balance;
- the complete real-money chain: outside buyer -> personal assignment -> 70/30 credit -> user withdrawal -> Base transaction.

Do not self-buy with Patrick's money merely to manufacture proof.

### Not built / future

- full multi-market Personal Miner that automatically multi-lists/bids/routes each user's hosted capability across true402, PayAPI, the402, Atelier, IDLE, etc.;
- universal AI discovery across every assistant/platform;
- human-facing social feed/messenger/community layer equivalent to the agent social network;
- mature reputation graph and team revenue splits;
- automated self-building of every unmet-demand capability;
- optional device CPU/GPU/bandwidth/storage monetization (would require explicit informed opt-in);
- guaranteed continuous nonzero cash earnings.

---

## 15. Strategic next move

Do **not** respond to the current state by adding dozens of random tools.

Priority order:

1. **Real beta traffic.** Invite a small number of genuine users/agents and drive legitimate outside buyers to existing routes.
2. **First empirical money proof.** Observe a genuine outside settlement credited to a personal agent, then a real withdrawal.
3. **Distribution observation.** Confirm Market402 public crawl after its scheduled probe and measure actual Agent402/402Index/PayanAgent buyer traffic instead of registrations alone.
4. **Instrument conversion.** Track discovery -> 402 challenge -> paid settlement -> selected personal agent -> withdrawal.
5. **Build the Personal Miner registry/scheduler** only around external markets with compliant terms and attributable net settlement.
6. **Expand social economy deliberately.** Human-facing feed/messaging/community and richer reputation/team formation should be built because they create demand, supply, transactions, and retention—not because Facebook has the feature.
7. **Scale winners, kill dead lanes.** Revenue evidence outranks catalog size.

The business target is not merely an animated counter. The target is raising **real outside earnings per active account per day** while the platform takes its legitimate share.

---

## 16. Handoff rules for a new chat

When continuing INCOME 2 in another chat:

1. Read this `INCOME2_STATE.md` first.
2. Inspect current GitHub `main` before editing.
3. Check current Render deploys and production logs before claiming anything is live.
4. Re-check current external marketplace/provider rules before changing integrations.
5. Preserve the absolute private-EARN boundary.
6. Never call tests, listings, registrations, unpaid challenges, owner funds, or projections revenue.
7. Never guarantee income.
8. Never silently consume user hardware, bandwidth, storage, electricity, accounts, credentials, or capital.
9. Prefer server-side upgrades that automatically benefit already-active accounts without account recreation.
10. Do not use ChatGPT Work for EARN/HYDRA unless there is a credible path to at least $200/month profit.

**Current job after this audit:** verify the final post-master commit live across backend/router/MCP/worker, confirm the 30-check network and 20-check wallet suites still pass, then focus on genuine outside settlement proof and measured distribution rather than more architecture for architecture's sake.
