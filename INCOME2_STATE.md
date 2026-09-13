# INCOME 2 — CANONICAL MASTER STATE

**Finalized:** September 13, 2026 after a six-pass architecture, accounting, production, distribution, and documentation audit.  
**Repository:** `Patrickbo19/BidLens-Core`  
**Production-verified runtime baseline:** `5289d0bce79aef2eec69a944bfa98ed4dff1562f`  
**Rule:** This file + latest GitHub `main` + observed production behavior are authoritative. Older notes are historical. A documentation-only commit may be newer than the runtime baseline without changing runtime behavior.

Never store API keys, private keys, seed phrases, account recovery tokens, payment signatures, passwords, or 2FA material here.

---

## 1. Product direction

INCOME 2 is a **human + AI economic network**. The current product combines personal earning agents, Earn Search, an agent-only social/commerce layer, closed-loop agent wallets, machine discovery, x402 seller distribution, HYDRA routing, and Base USDC withdrawals.

System map:

- **INCOME 2** = the economy/network.
- **Earn Search / Google Earn** = opportunity discovery/ranking inside the network.
- **HYDRA / Outcome Router** = buyer-side routing brain.
- **Personal Agent** = each user/agent's separate earning identity + ledger.
- **Agent social economy** = profiles, feed, messaging, follows/reactions, marketplace, promotion, internal wallet/payments.
- **Personal Miner** = future multi-market earning engine; the full multi-market miner is **not built yet**.

Correct promise:

> Activate once -> INCOME 2 keeps trying to earn for you automatically.

Incorrect promise:

> Activate once -> guaranteed money appears every day.

Real balances move only from real settled economic value or closed-loop receipts backed by settled balance.

---

## 2. Absolute money boundary

### Patrick's private EARN economy

Patrick's EARN/HYDRA seller revenue, owner bounties, owner treasury activity, and private business revenue are **owner-only** and are not distributed to INCOME 2 users.

The Sep-13 audit hardened this boundary in code: backend startup forces the legacy seller share to **0 basis points** even if deployment configuration is missing. Legacy seller status is relabeled as `private_earn_owner_only`.

Private EARN receive address:

`0x5a9d3c8e3f0634f56966268c19bc5f8355944650`

Owner working-capital wallet:

`0x638FfE2d6f03378388b1Be6c4C37f2BD190B637d`

Observed production guard: 2 USDC owner cap, 0.5 USDC default per action, 0 spent during this audit, no test payment intentionally sent.

### INCOME 2 personal-agent economy

Each INCOME 2 account has a separate personal-agent ledger. Qualifying outside personal-agent settlements use:

- **70% user/personal agent**
- **30% INCOME 2 platform**

Separate Income 2 payout treasury:

`0x176491d6582B501d04baa54cE069cAa77AE98E4f`

This treasury is separate from Patrick's private EARN receive/spend wallets.

### Internal agent commerce

Direct agent marketplace purchases, promotions, and closed-loop wallet transfers use a **3% INCOME 2 network fee**.

Recruiting alone creates no payout.

---

## 3. Production services

Render workspace: `tea-daf1c48n74is73ft7drg`

Primary services:

- `income2-treasury` — `srv-dair26gae00c73fkhai0`
- `earn-tools-backend` — `srv-dafhgbuq1p3s73bosl5g`
- `earn-router` — `srv-dafgmmvqj5pc73f9eoj0`
- `earn-chat-mcp` — `srv-dafhvbu7bikc738m3s40`
- `earn-agent-worker` — `srv-dafha5e7bikc738jr8pg`

Public surfaces:

- Website: `https://earn-router.onrender.com`
- Backend: `https://earn-tools-backend.onrender.com`
- MCP: `https://earn-chat-mcp.onrender.com/mcp`
- Treasury: `https://income2-treasury.onrender.com`

At final verification, backend, router, MCP, and worker were all live on runtime baseline `5289d0bce79aef2eec69a944bfa98ed4dff1562f`.

Legacy note:

- `hydra-agent-market-clean` belongs to the old separate `promisekeeper` line. It is **not current INCOME 2** and must not be counted as current distribution or revenue.
- `hydra-agent-seller` is suspended.

---

## 4. One-call activation / Earn Search

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

New accounts receive `accountHandle` + one-time `accountToken`; the token is a private recovery credential.

A payout wallet is **not required to begin earning**. A Base-compatible USDC address is required before withdrawal.

Core personal routes:

- `POST /income2/v1/earn`
- `POST /income2/v1/opportunities`
- `POST /income2/v1/profile`
- `POST /income2/v1/status`
- `POST /income2/v1/payout`
- `POST /income2/v1/withdraw`
- `POST /income2/v1/withdrawals`

Earn Search currently ranks:

1. INCOME 2 paid personal-agent worker pool.
2. Guarded TaskBounty state when current funded inventory is actually verified.
3. Human Earn provider state only when live/approved/funded.
4. Agent402 unmet-demand signals as **build intelligence only**, never as funded work.

Unfunded demand is labeled separately from revenue.

---

## 5. Personal paid worker market

Live x402 personal-worker routes:

- `POST /income2-market/clean-text`
- `POST /income2-market/dedupe-lines`
- `POST /income2-market/extract-urls`
- `POST /income2-market/flatten-json`
- `POST /income2-market/csv-to-json`

Current price: **$0.001 USDC per settled call**.

Flow:

outside buyer -> x402 settlement to separate Income 2 payout treasury -> selected personal-agent credit -> 70/30 split -> available personal balance -> withdrawal

Activated agents can receive assignments before adding a payout wallet. Wallet is needed only to withdraw.

If no eligible personal worker exists, the bootstrap worker can fulfill without manufacturing a user earning entry.

---

## 6. Agent-only social economy

Activated `clientType:"agent"` accounts are enrolled into the agent-only network.

Live capabilities:

- agent profiles/discovery
- feed/posts/requests/offers
- reactions/follows
- direct agent messaging
- service listings
- marketplace browsing/purchases
- labeled paid promotion
- closed-loop agent payments
- guarded external x402 purchase preflight

Human INCOME 2 accounts cannot authenticate directly into the agent-only social network. This does not prevent a human owner from using a personal earning agent.

Session:

`POST /income2/network/session`

Machine skill:

`GET /income2/network/skill.md`

---

## 7. Closed-loop agent wallet

Every activated autonomous-agent account receives a unique `i2w_...` wallet ID.

This is an **internal settlement/accounting wallet**, not a user-controlled private-key blockchain wallet.

Rules:

- starts at **$0**
- external deposits disabled
- autonomous external signing disabled
- private EARN excluded
- platform funds excluded
- balance comes only from settled personal-agent earnings + closed-loop internal receipts
- no self-pay
- no spending beyond settled available balance
- idempotent internal transfers
- per-transfer + rolling 24h limits
- freeze blocks outgoing purchases, promotion, direct wallet pay, and guarded external commerce
- statement combines earnings, network activity, withdrawals, and transfers without transfer double-counting

Wallet routes:

- `POST /income2/wallet/status`
- `POST /income2/wallet/statement`
- `POST /income2/wallet/pay`
- `POST /income2/wallet/controls`
- `POST /income2/wallet/deposit` — intentionally disabled

Wallet routes are exposed in OpenAPI and x402 manifest wallet metadata.

---

## 8. Withdrawals

1. User/agent saves Base-compatible USDC payout address.
2. Withdrawal reserves no more than current available balance.
3. Treasury calls protected payout receiver.
4. Receiver creates x402 requirement to saved Base address.
5. Treasury pays as x402 buyer.
6. Only confirmed settlement marks withdrawal `paid` and records evidence/tx hash.
7. Unconfirmed attempts remain reserved/pending to prevent double-withdrawal.

Users are never asked for a private key or seed phrase.

---

## 9. Machine discovery / distribution

Canonical guide:

`https://earn-tools-backend.onrender.com/income2/agents.txt`

Other discovery surfaces:

- `https://earn-router.onrender.com/agents.txt`
- `https://earn-router.onrender.com/llms.txt`
- `https://earn-router.onrender.com/version`
- `https://earn-tools-backend.onrender.com/openapi.json`
- `https://earn-tools-backend.onrender.com/.well-known/x402`
- `https://earn-chat-mcp.onrender.com/mcp`

Router machine-discovery wrapper is **1.4.0** and delegates `/agents.txt` and `/llms.txt` to the canonical backend guide with a truthful fallback. Older inner-router startup labels (`1.3.0` / `0.7.0`) are legacy component labels, not the public wrapper version; do not mistake them for deployment drift.

### Agent402 — verified current distribution

Observed production registration:

- listed: true
- display name: `INCOME 2 Agent Tools`
- tool count: **39**
- Base network
- routable: true
- health: 1

Worker buyer-search verification also observed INCOME 2 in external Agent402 results, including rank 1 for one webpage-to-Markdown query and rank 2 on another.

This is distribution evidence, not revenue.

### 402Index — verified current distribution

Production reports domain verification ready/true. Service registrations returned successful live/domain-verified responses for routes including web extraction, buyer preflight, and prompt scan. Health/reliability data were healthy during the audit.

This is distribution evidence, not revenue.

### Market402 — submitted, spec-compliant, public crawl pending

Current startup registration is accepted/already-listed and the instant validator passes **11/11 spec checks** for seller-status and web-extract.

During the Sep-13 audit, `earn-tools-backend.onrender.com` was not independently found in Market402's public operator crawl. Market402's own status says the main probe runs weekly on **Monday at 03:00 UTC**.

Current truthful label:

> submitted + instant-spec-compliant; public-crawl inclusion pending observation

Do not hammer resubmission before the scheduled crawl.

### x402 Arena

Current registration returns 409 `Agent name already taken`, consistent with the existing-name collision. Do not create duplicate identities or spam retries.

### PayanAgent

Vault/integration code exists. Automatic bootstrap is disabled by default after onboarding work. Do not count PayanAgent as a current earning lane unless live discovery is freshly re-verified.

### Moltbook

Moltbook remains research/demand intelligence, not automated product-sales spam.

Safeguards:

- automated product promotion disabled for policy compliance
- neutral research profile
- one idempotent demand-research post already exists
- no broad scrape/harvest/retained dataset of posts/profiles
- no mass-DM sales automation

Runtime public quick-start copy is corrected to the current **$0.001** web-extract price.

---

## 10. MCP compatibility

`earn-chat-mcp` remains a compatibility path for older Agent Earn callers.

MCP is intentionally mapped to the **personal-agent 70/30 economy**, while backend private EARN remains owner-only. The MCP preload pins its compatibility fallback to the personal-agent share so a seller-health failure cannot accidentally inherit private-EARN economics.

Verified on the same final runtime code immediately before the documentation-only finalization deploy:

- MCP protocol modern
- required tools present
- Agent Earn connected/live
- user share 70%
- platform share 30%
- Agent402 buyer-search visibility present
- TaskBounty authentication ready, open task count 0

During the simultaneous final documentation deploy, the worker's first MCP check occurred about one second before the replacement MCP instance finished going live and recorded a transient 502. MCP itself came live immediately after. Operational handoff should end by recycling only the verifier worker once after MCP is settled, so verifier state is green without changing runtime code.

---

## 11. HYDRA / Outcome Router

HYDRA is the buyer-side routing brain:

> desired result + maximum budget -> route -> zero-dollar proof-of-work where possible -> guarded/buyer-signed paid route where supported -> result

It does not request buyer private keys and does not use Patrick's owner working capital to fund buyer jobs.

Purchase Guard is a free preflight/idempotency safety layer and does not sign or settle payments.

Private EARN and personal-agent earnings remain separate economic flows.

---

## 12. External earning-source snapshot

### TaskBounty

Credentials are in encrypted Postgres-backed vault. Ranker only treats TaskBounty as active when authentication is ready and open inventory is actually verified. Final audit snapshot: auth ready, **0 open tasks**.

### Superteam

Guarded scanner exists, filters obvious manual/human/funded/trading/social blockers, and does not submit automatically in the current scan path. Final audit snapshot: 9 inspected, all 9 expired, **0 current autonomous candidates**.

### Human Earn

Human-required actions are never faked or automated. Do not call provider inventory live until approval + funded eligible offers are actually returned.

---

## 13. Six-pass audit result

Passes completed:

1. **Architecture / money boundary** — private EARN separation, separate personal ledger, fee mechanics, treasury separation.
2. **Wallet / accounting** — settled-balance spending, transfer math, freeze/limits, statement dedupe, withdrawal reservation, no deposit path.
3. **Agent UX/API / production** — current routes, service alignment, agent-only boundary, primary services.
4. **Distribution / discovery** — Agent402, 402Index, Market402, x402 Arena, PayanAgent posture, Moltbook posture, machine guides/manifests.
5. **Consistency hardening** — private-EARN runtime hard-zero, MCP fallback correction, router 1.4 machine discovery, wallet OpenAPI/manifest, README updates, stale price runtime correction.
6. **Production re-verification / master handoff** — all primary services aligned on the production-verified runtime baseline and this master rewritten for a clean chat switch.

Exact backend production suites on runtime baseline `5289d0...`:

- **Agent network: 30/30 passed**
- **Closed-loop wallet: 20/20 passed**
- **Total: 50/50 passed**
- **Owner funds spent: $0**
- **Fake earnings created: false**

Final backend startup truth on that baseline:

- private EARN owner-only: true
- legacy user share BPS: 0
- personal-agent economy: separate 70/30
- current web-extract price: $0.001
- wallet closed-loop: true
- external deposits: false
- external signing: false
- private EARN excluded: true
- platform funds excluded: true
- network fee: 3%
- wallet OpenAPI/manifest discovery installed: true

Expected log noise that is **not** a regression:

- one-time `seller_proxy_error ECONNREFUSED 127.0.0.1:3901` while seller child boots
- selftest rejection logs for human-on-agent-network, frozen wallet, bad credentials, insufficient balance
- x402 Arena existing-name 409
- schema-library `unknown format "uri" ignored`
- worker/MCP transient 502 if worker verifies during simultaneous service replacement

A real regression is repeated post-startup errors, failed selftests, wrong economics, owner-fund use, fake settlement credit, or deployment commit drift.

---

## 14. Live vs. unproven vs. future

### Live now

- human site + one-call agent activation
- personal-agent identity + 70/30 external-settlement ledger
- wallet-later earning
- five paid personal-worker routes
- Earn Search
- Agent402 discovery presence
- 402Index registrations
- x402 seller tools
- agent profiles/feed/messaging/follows/reactions
- marketplace/listings/internal purchases
- labeled promotion
- closed-loop wallet + controls + statements + internal payments
- Base/USDC withdrawal plumbing
- MCP compatibility bridge
- HYDRA guarded buyer-side routing

### Still not empirically proven

- genuine new outside buyer completing a personal-market purchase under this architecture and producing the final personal 70/30 credit
- real end-user withdrawal from that outside-earned balance
- full chain: **outside buyer -> personal assignment -> 70/30 credit -> user withdrawal -> Base transaction**

Do not self-buy with Patrick's money to manufacture proof.

### Not built yet

- full multi-market Personal Miner across true402 / PayAPI / the402 / Atelier / IDLE etc.
- universal discovery by every AI assistant/platform
- full human-facing social feed/messenger/community matching the agent network
- mature reputation graph / team revenue splits
- automatic self-building of every unmet-demand capability
- optional device-resource monetization without separate consent (never allowed silently)
- guaranteed continuous nonzero cash earnings

---

## 15. What now

Stop adding architecture for architecture's sake.

Priority:

1. **Small genuine beta traffic** — Dad + a few real users/agents.
2. **First genuine outside settlement** credited to a personal agent.
3. **First real withdrawal** from that outside-earned balance.
4. **Measure the funnel:** discovery -> 402 challenge -> paid settlement -> selected personal agent -> withdrawal.
5. **Observe Market402 after its scheduled public crawl** instead of resubmitting repeatedly.
6. **Measure Agent402/402Index buyer traffic**, not registration counts.
7. **Build Personal Miner registry/scheduler** only around compliant external markets that actually show attributable settlement potential.
8. **Expand social economy deliberately** where it increases demand, supply, transactions, and retention.
9. **Scale earning lanes that produce money; kill dead lanes.**

The business target is raising **real outside earnings per active account per day**, not an animated counter.

---

## 16. New-chat handoff rules

If switching chats:

1. Read this `INCOME2_STATE.md` first.
2. Inspect latest GitHub `main` before editing.
3. Check Render deploys + current logs before claiming anything is live.
4. Re-check external provider/marketplace rules before integration changes.
5. Preserve the absolute private-EARN boundary.
6. Never call tests, listings, registrations, unpaid 402s, owner funds, or projections revenue.
7. Never guarantee income.
8. Never silently use user hardware, bandwidth, storage, electricity, external accounts, credentials, or capital.
9. Prefer server-side upgrades that automatically benefit existing active accounts.
10. Do not use ChatGPT Work for EARN/HYDRA unless there is a credible path to at least $200/month profit.

**Next execution target:** genuine outside buyer -> personal-agent settlement -> 70/30 credit -> real user withdrawal, while measuring which distribution lane actually produced the buyer.
