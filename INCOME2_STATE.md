# INCOME 2 — Canonical State

Last reconciled: 2026-09-08 15:02 America/New_York

This is the canonical **non-secret** state summary for INCOME 2. Before a material decision, reconcile it against latest GitHub main, live Render services, provider messages, external markets, and current Moltbook state. Never place API keys, recovery tokens, private keys, seed phrases, claim secrets, solver keys, or other credentials here.

## Product

**Brand:** INCOME 2  
**Motto:** Your second income. Powered by you or your AI.  
**Core promise:** Make money yourself — or let your AI earn for you.

Current modes:

- **Human Earn:** legitimate human-required paid opportunities completed truthfully by the user.
- **Agent Earn / Auto Make Me:** eligible machine-doable paid work performed autonomously.
- **Buyer intent / Outcome Router:** an agent states the result it wants plus a maximum budget; INCOME 2 autonomously finds a fulfillment route and executes when a supported path exists.

INCOME 2 is intended to become a two-sided earning/fulfillment network. Humans and agents can supply work; humans or agents can eventually buy completed outcomes; INCOME 2 sits in the transaction layer.

## Revenue truth

Only verified real third-party settled money earned by INCOME 2 counts as revenue.

Do **not** count listings, quotes, tasks, simulations, canaries, self-tests, free Purchase Guard calls, Outcome Router requests, proof-of-work fulfillment, buyer-to-supplier payments, or unverified ledger rows as INCOME 2 revenue.

As of this reconciliation:

- Verified real external INCOME 2 revenue: **$0**
- Verified genuine outside Agent Earn settlements: **0 confirmed**
- Human Earn live provider conversions: **0**
- HYDRA platform fee: **$0 during beta**
- A buyer paying Agent402 through HYDRA is fulfillment validation, not INCOME 2 revenue while the platform fee is zero.

## Canonical account / ledger

The canonical Agent Earn ledger is on `earn-tools-backend` and is Postgres-backed.

- Website Agent Earn and ChatGPT MCP use the same canonical seller ledger.
- x402 Agent Earn settlements write to the same ledger.
- Account handles use the `income2_` prefix.
- ChatGPT `/manage` reads the canonical ledger.
- Human Earn postback attribution remains unfinished until an approved provider's exact economics/security semantics are known.
- External task/bounty payout attribution remains unfinished until a real payout exists.
- External customer cash-out is **not production-enabled**.

## Live services

Repository: `Patrickbo19/BidLens-Core`, branch `main`, Render auto-deploy enabled.

- `earn-router` — customer-facing INCOME 2 / Human Earn router
- `earn-tools-backend` — canonical ledger, x402 seller, Purchase Guard, HYDRA Outcome Router, TaskBounty bridge, Moltbook vault/status
- `earn-chat-mcp` — ChatGPT/MCP surface
- `earn-agent-worker` — MCP/TaskBounty/discovery verifier

## HYDRA / Outcome Router

**HYDRA is the internal codename. Public feature: INCOME 2 Outcome Router.**

Definition:

> desired result + maximum budget → autonomous routing → safe execution → result, or abstract unmet-demand signal

Hard operating rules:

- autonomous only; **no manual brokerage**
- never spend owner working capital on anonymous buyer jobs
- never request or retain a buyer private key/seed phrase
- never retain raw task or raw params in the demand ledger
- retain only abstracted request metadata such as category, budget, route, status, timestamps, and result digest
- block credential-like inputs from external routing
- idempotency key binds one request to one parameter set
- do not automatically raise a caller's budget or escalate to higher paid tiers

### Live surfaces

Seller:

- `GET /outcome-router`
- `POST /outcome-router`
- `GET /outcome-router/{requestId}`
- `POST /outcome-router/execute/{requestId}` — buyer-signed x402 paid execution bridge

MCP:

- `request_agent_outcome`

### Free autonomous path

HYDRA first attempts compatible Agent402 proof-of-work tools where possible. This spends **$0** and can return a completed result automatically.

### Paid autonomous path — LIVE BETA

Paid fulfillment now uses the official Agent402 Smart Order Router basic tier:

`POST https://agent402.tools/api/route/execute`

Current model:

1. Buyer sends desired result, max budget, idempotency key, and optional params to INCOME 2.
2. HYDRA checks for free proof-of-work fulfillment first.
3. If paid routing is needed, HYDRA probes Agent402's Smart Order Router without paying.
4. HYDRA parses the x402 v2 `PAYMENT-REQUIRED` challenge and enforces the buyer's max budget.
5. If within budget, HYDRA returns an INCOME 2 execution URL.
6. The **buyer wallet signs locally**. HYDRA never receives the private key.
7. The buyer retries the INCOME 2 execution URL with the resulting `PAYMENT-SIGNATURE`.
8. HYDRA forwards the proof and matching request to Agent402 Smart Order Router.
9. Agent402 routes/executes the selected supplier and relays result + receipt.
10. HYDRA returns the result and records only abstract execution state/result digest.

This is non-custodial from INCOME 2's perspective: buyer funds do not become an INCOME 2 buyer balance, and owner capital is not used to subsidize supplier payments.

Current basic paid tier:

- Router price observed live: **$0.01 USDC**
- Covers Agent402 route-execute's basic tier (underlying tools up to its published threshold)
- Higher paid tiers are **not auto-escalated** yet; HYDRA will report that a higher tier is required rather than silently raising spend.

### Paid rail verification

Latest live no-payment safety self-test succeeded:

- upstream: `agent402_route_execute`
- x402 challenge observed: **true**
- observed quote: **$0.01**
- owner funds spent: **$0**
- payment signed during test: **false**

This proves the buyer-payment boundary/challenge relay. It does **not** prove a real funded external buyer has completed a paid HYDRA transaction yet.

### Fulfillment uncertainty rule

If a payment response indicates settlement may have happened but fulfillment does not complete cleanly, mark the request `payment_settled_fulfillment_unresolved`. Do not generate a fresh spending authorization automatically. Reconcile the original attempt first.

### Monetization

Current HYDRA platform fee: **$0** while we validate actual paid fulfillment demand.

Do not call buyer-to-Agent402 payment INCOME 2 revenue. A future fee/spread layer should only be added after real external usage demonstrates that agents value this routing layer. The preferred future design remains autonomous and non-custodial where practical.

## Agent Purchase Guard

Free beta endpoints:

- `GET /purchase-guard`
- `POST /purchase-guard`
- `GET /purchase-guard/{receiptId}`

MCP tool: `guard_x402_purchase`

Purpose:

**one intended x402 purchase → hard max spend → stable idempotent intent → durable receipt → retry recognition**

It never signs, sends, settles, or custodies funds. `paymentExecuted=false` remains a hard property of the Guard itself.

Purchase Guard remains a free wedge. Do not keep expanding it absent real outside usage or repeated demand.

## ChatGPT MCP

Endpoint: `https://earn-chat-mcp.onrender.com/mcp`  
Health: `https://earn-chat-mcp.onrender.com/health`

Current intended MCP version after paid-HYDRA reconciliation: **0.3.1**

Tools:

1. `get_earning_options`
2. `start_agent_earn`
3. `check_earnings`
4. `find_paid_opportunities`
5. `guard_x402_purchase`
6. `request_agent_outcome`

MCP health should report:

- `accountSystem=canonical_seller_ledger`
- Outcome Router enabled
- `paidExternalExecution=true`
- no manual brokerage
- owner working capital not used for buyer jobs
- current platform fee 0 during beta

Public ChatGPT Plugin Directory submission has **not** been sent.

### Public launch gate

Do not call public launch ready until BOTH are true:

1. at least one genuine outside Agent Earn settlement is recorded end-to-end; and
2. at least one Human Earn publisher feed is approved with real funded opportunities.

## x402 seller / discovery

Seller origin: `https://earn-tools-backend.onrender.com`  
Network: Base mainnet `eip155:8453`  
Asset: USDC

Primary paid first-sale route:

- `POST /web-extract`
- 0.003 USDC
- public static webpage/article → clean Markdown + metadata/links

Underlying paid x402 seller manifest remains **13 paid resources**.

Agent402 discovery currently sees a broader set of free/docs/Outcome-Router surfaces in addition to those paid seller resources. Do not describe its discovered-tool count as the number of paid INCOME 2 tools.

Existing discovery includes Agent402, x402 Arena, Market402, and 402Index. Duplicate registration responses are expected and are not revenue.

Agent402's external seller Smart Order Router eligibility is separate from indexing. Our own seller should not be assumed to receive Agent402 external dispatch until its current proven-settlement gate is genuinely met by outside buyers.

## TaskBounty / Task Hunter

Brainbase Task Hunter:

- agent id `66070003-c3eb-4ccc-80e4-4ead96bf402b`
- managed Brainbase/Daytona runtime
- primary market: TaskBounty
- AgentWorld disabled

TaskBounty credentials are stored encrypted in the canonical seller backend vault.

Latest verified posture before this reconciliation:

- connected: true
- authReady: true
- auth HTTP 200
- persistent/configured: true
- open funded tasks observed: 0

Do not wake paid managed compute unless a legitimate candidate is well scoped, safe, gross >= $25, and expected proceeds materially exceed compute cost.

## Human Earn

Human Earn is still the intended consumer earning floor, but funded provider inventory is not live.

Current known provider status:

- Lootably — applied, no approval yet
- TapResearch — applied, no approval yet
- ayeT Studios — acknowledged/reviewing, no approval yet

Do not claim BitLabs, CPX Research, inBrain, or any other provider is applied/approved without fresh verification.

## Moltbook — compliance-first

Agent: `Income2`  
Claim: `claimed`

Current profile is intentionally neutral/non-promotional. Credentials are encrypted at rest.

Hard constraints:

- official supported access patterns only
- no broad scraping/crawling/mass-search
- no harvesting or retaining third-party Moltbook content/identities
- no public republishing of third-party replies
- no automated product promotion, spam, mass-DM, mass-comment, auto-follow, auto-vote, engagement manipulation, duplicate identities, impersonation, or rate-limit evasion

Public Moltbook status is aggregate-only for our own account/post and must keep `thirdPartyContentExposed=false`.

## Working capital

Owner-authorized ceiling: **$10**.

HYDRA buyer jobs must **not** use it. Preserve it unless a separate verified legitimate paid opportunity genuinely requires a small spend and expected economics justify it.

## Autonomous controller

Automation: `INCOME 2 Earn Watch`  
ID: `6a9f2eb7dccc8191a659939d9b47a0f0`  
Enabled: yes  
Frequency: hourly condition watch

Monitor:

- genuine outside settlements / revenue truth
- `/web-extract` health/discovery
- Purchase Guard outside usage/WTP
- HYDRA free and paid Outcome Router activity
- paid HYDRA challenges and externally completed paid fulfillment
- repeated abstract unmet-demand categories
- paid requests blocked only by budget/tier limitations
- TaskBounty auth/inventory
- MCP health / canonical ledger
- Human Earn provider changes
- Moltbook aggregate-only compliance-safe status

For HYDRA, distinguish three metrics:

1. routed requests
2. buyer-paid fulfillment volume
3. **INCOME 2 fee revenue**

Only #3 is INCOME 2 revenue. During the zero-fee beta it remains $0 even if #2 begins occurring.

## Current strategic judgment

The main architecture gap — buyer-side autonomous intent and paid fulfillment — is now implemented in beta form.

Current priorities are no longer "build more plumbing." They are:

**external usage → paid fulfillment proof → repeat demand → monetize the routing layer → scale supply/demand**

Do not add unrelated architecture merely because traffic is initially quiet.

## Continuity rule

When switching chats, read this file, then reconcile it against:

- latest GitHub main
- live Render deploy/service health
- current HYDRA status/self-test/external usage
- canonical ledger / verified settlements
- TaskBounty status
- Human Earn provider inbox/status
- Moltbook claim/rules/account aggregate state
- x402 discovery/routing state
- enabled Earn Watch

Update this file after material architecture, payment-rail, revenue, provider, distribution, Moltbook, TaskBounty, Purchase Guard, HYDRA, or automation changes. Never let stale chat context override verified live state.
