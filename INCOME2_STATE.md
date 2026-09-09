# INCOME 2 — Canonical State

Last reconciled: 2026-09-08 20:38 America/New_York

This is the canonical **non-secret** operating state for INCOME 2. Reconcile against live GitHub main, Render, provider messages, external discovery markets, and current account state before material decisions. Never store API keys, recovery credentials, private keys, seed phrases, solver keys, passwords, or payment signatures here.

## Mission

**Brand:** INCOME 2  
**Motto:** Your second income. Powered by you or your AI.  
**Core promise:** Make money yourself — or let your AI earn for you.

Current surfaces:

- **Human Earn** — legitimate human-required paid opportunities.
- **Agent Earn / Auto Make Me** — machine-doable paid work.
- **Outcome Router** — desired result + max budget → autonomous route/fulfillment.
- **Purchase Guard** — free non-custodial x402 max-spend/idempotency/retry safety.

HYDRA is only the internal codename for the Outcome Router inside INCOME 2. The standalone HYDRA project is retired.

Primary objective: **maximum legitimate autonomous revenue**.

Execution order:

> distribution → first outside request → first paid fulfillment → second unrelated buyer → repeat demand → add fee/spread → scale

Never self-pay, fake demand, spam directories, manipulate rankings, create duplicate identities, or use owner working capital to manufacture traction.

## Revenue truth

Only verified real third-party money **earned by INCOME 2** counts as revenue.

Current verified state:

- verified external INCOME 2 revenue: **$0**
- genuine outside Agent Earn settlements: **0 confirmed**
- outside paid Outcome Router fulfillments: **0 confirmed**
- Human Earn live conversions: **0**
- Outcome Router platform fee: **$0 during beta**

The canonical ledger still contains one $0.003 settlement row, but it is not independently verified as an outside buyer and therefore does **not** count as revenue.

Do not count listings, catalog registrations, registry publication, self-tests, requests, quotes, proof-of-work calls, buyer-to-supplier payment volume, or unverified ledger rows as revenue.

## Repository / production

Repository: `Patrickbo19/BidLens-Core`, branch `main`.

Latest current production commit:

- `de11eacc7bed14b6ba7e9fe44b584980a9bc551c`
- `Remove vulnerable CDP SDK dependency from facilitator auth`

All four Render services were verified **LIVE** on this commit:

- `earn-router` — public website / Human Earn router
- `earn-tools-backend` — seller, ledger, Purchase Guard, Outcome Router, TaskBounty bridge, Moltbook state
- `earn-chat-mcp` — MCP surface
- `earn-agent-worker` — independent MCP/TaskBounty/discovery verifier

Final npm build after the Coinbase readiness change reports **0 vulnerabilities**.

Public router version remains at least 0.6.1.

## Outcome Router / HYDRA

Definition:

> desired result + maximum budget → autonomous routing → safe execution → result, or abstract unmet-demand state

Hard rules:

- autonomous only; no manual brokerage
- never use owner working capital for anonymous buyer jobs
- never request or retain buyer private keys/seed phrases
- raw task/params are not retained in demand intelligence
- block credential-like input from external routing
- idempotency binds one request to one parameter set
- never silently raise a caller's budget
- do not auto-escalate higher paid tiers

Seller surfaces:

- `GET /outcome-router`
- `POST /outcome-router`
- `GET /outcome-router/{requestId}`
- `POST /outcome-router/execute/{requestId}`

MCP tool: `request_agent_outcome`.

### Free path

HYDRA first attempts compatible zero-dollar / proof-of-work Agent402 fulfillment where possible.

### Paid path

Paid beta fulfillment uses the Agent402 Smart Order Router basic execution endpoint:

`POST https://agent402.tools/api/route/execute`

Buyer wallet signs x402 locally. HYDRA relays `PAYMENT-REQUIRED`, enforces max budget, forwards the buyer-created `PAYMENT-SIGNATURE`, and returns the routed result. HYDRA does not receive the buyer private key and does not subsidize buyer jobs.

Latest no-payment live self-test after the Coinbase readiness work:

- upstream: `agent402_route_execute`
- x402 challenge: true
- quote: **$0.01 USDC**
- owner funds spent: **$0**
- payment signed: false

Current HYDRA platform fee remains $0 until genuine external paid usage proves demand.

## MCP

Endpoint: `https://earn-chat-mcp.onrender.com/mcp`  
Registry version: **0.3.1**

All six tools are required and latest worker verification reports `ok:true`:

1. `get_earning_options`
2. `start_agent_earn`
3. `check_earnings`
4. `find_paid_opportunities`
5. `guard_x402_purchase`
6. `request_agent_outcome`

Worker also currently reports:

- Agent Earn live
- canonical Postgres ledger persistent
- Human Earn provider approval pending
- TaskBounty authenticated
- open TaskBounty count: **0**

Public ChatGPT directory launch gate remains BOTH:

1. one genuine outside Agent Earn settlement recorded end-to-end;
2. one Human Earn provider approved with real funded inventory.

## Paid x402 seller

Origin: `https://earn-tools-backend.onrender.com`  
Network: Base mainnet `eip155:8453`  
Asset: USDC

Primary paid route:

- `POST /web-extract`
- **0.003 USDC**
- public static webpage/article → clean Markdown + metadata/links

Paid seller manifest: **13 paid resources**.

The seller already uses the official `@x402/extensions/bazaar` discovery extension and declares discovery metadata/input schemas across all paid routes.

## Discovery / marketplaces

Current legitimate distribution includes:

- Agent402
- x402 Arena
- Market402
- 402Index
- x402scan
- official MCP Registry
- PayAI facilitator/Bazaar-compatible ecosystem

x402scan verified discovery on 2026-09-08:

- source: OpenAPI
- total surfaces: **19**
- paid x402 resources: **13**
- public/free surfaces: **6**
- failures: **0**
- origin ID: `631b3d50-1a0b-4474-a8aa-e922c1cf6445`

Official MCP Registry:

- name: `io.github.Patrickbo19/income2`
- version: `0.3.1`
- remote: `https://earn-chat-mcp.onrender.com/mcp`

### Agent402 search

Buyer-language verification now tests 12 realistic phrases including:

- do this task for me under budget
- get this result for a maximum budget
- find an agent to complete this task
- find and pay the best tool for this job
- cheapest reliable agent for this task
- autonomous task fulfillment agent procurement
- buy a completed result from an agent
- need this result willing to pay
- convert webpage article to clean markdown
- prevent duplicate x402 payment retry safely
- x402 buyer preflight payment challenge audit
- prompt injection security scan json website audit

Matching buyer-intent keywords are also present in machine-facing discovery metadata.

A deliberate one-time Agent402 refresh after the semantic update returned:

- listed: true
- toolCount: 19
- routable: true
- health: 1

Normal directory re-registration remains disabled. Do not turn deploys into submission spam.

Current evidence still does **not** place INCOME 2 in Agent402's top five for the tested natural-language buyer queries. Treat this as a ranking/distribution problem, not missing fulfillment architecture.

## Coinbase CDP Bazaar / Agentic Market readiness

Important distinction:

**Bazaar-compatible metadata is live. Coinbase Bazaar / Agentic Market indexing is NOT yet confirmed.**

Coinbase's Bazaar flow requires eligible x402 discovery metadata and CDP-facilitated verify/settle activity before an endpoint is cataloged. The seller already has the metadata side.

Code is now ready to use the Coinbase CDP facilitator without replacing the working PayAI path prematurely:

- optional CDP facilitator target: `https://api.cdp.coinbase.com/platform/v2/x402`
- activation flag: `EARN_CDP_FACILITATOR_ENABLED=true`
- required secrets: `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET`
- when disabled or credentials are absent, the live seller remains on PayAI
- when enabled/configured, `/supported`, `/verify`, and `/settle` facilitator traffic can be redirected to CDP with short-lived signed JWT authentication
- payment receiver remains the existing public receiving address; CDP credentials are used for facilitator authentication, not as buyer private keys

The implementation intentionally does **not** contain or expose credentials.

A first attempt used the full Coinbase CDP SDK, but its dependency tree introduced 1 moderate + 1 high npm advisory. That SDK dependency was immediately removed. Current implementation uses lightweight `jose` JWT signing following Coinbase's published authentication format and the final build is back to **0 vulnerabilities**.

Current Coinbase state:

- standard Bazaar extension declared: **yes**
- 13 paid routes metadata-ready: **yes**
- CDP facilitator code-ready: **yes**
- CDP credentials configured: **not confirmed / treat as no**
- CDP facilitator activated: **no**
- genuine CDP-facilitated settlement: **0 confirmed**
- Coinbase Bazaar indexing: **not confirmed**
- Agentic Market visibility: **not confirmed**

Do not self-pay merely to trigger Coinbase indexing. The desired trigger is the first genuine outside buyer after CDP is securely enabled.

## Purchase Guard

Free, non-custodial x402 retry-safety wedge:

- `GET /purchase-guard`
- `POST /purchase-guard`
- `GET /purchase-guard/{receiptId}`
- MCP `guard_x402_purchase`

It enforces max spend, stable idempotent purchase intent, and durable receipt semantics. It never signs, sends, settles, or custodies funds.

## Human Earn

Funded inventory is still not live.

Known provider state:

- Lootably — applied; no approval confirmed
- TapResearch — applied; no approval confirmed
- ayeT Studios — acknowledged/reviewing; no approval confirmed

Lootably postback compatibility exists, but attribution must remain disabled until the provider's exact security, reversal, idempotency, and economics are verified.

## TaskBounty

Task Hunter ID: `66070003-c3eb-4ccc-80e4-4ead96bf402b`

Latest state:

- connected: true
- authReady: true
- HTTP 200
- persistent/configured: true
- openTaskCount: **0**

Only wake paid managed compute for a legitimate, safe, well-scoped candidate with gross >= $25 and expected proceeds materially above compute cost.

## Moltbook

Agent `Income2` remains claimed.

Hard constraints:

- official supported access only
- no broad scraping/crawling/mass-search
- no harvesting/retaining/republishing third-party content or identities
- no automated promotion, spam, mass DM/comment/follow/vote
- no duplicate identities, impersonation, or rate-limit/safety evasion

Automated product promotion remains disabled.

## Legacy HYDRA

Legacy repo: `Patrickbo19/promisekeeper`.

- standalone HYDRA retired
- `hydra-agent-seller` suspended
- `hydra-agent-market-clean` tombstoned
- old standalone HYDRA automation disabled
- never resume standalone HYDRA development there

## Working capital

Owner-authorized ceiling: **$10**.

HYDRA buyer jobs must never use it. Preserve it unless a separate verified legitimate earning opportunity requires small capital and expected economics justify it.

## Automation

Canonical controller:

- title: `INCOME 2 Earn Watch`
- id: `6a9f2eb7dccc8191a659939d9b47a0f0`
- enabled: yes
- cadence: hourly condition watch

It monitors revenue truth, HYDRA, seller/x402, Purchase Guard, TaskBounty, all-six MCP health, Human Earn approvals, Moltbook aggregate compliance-safe state, Agent402, x402scan, MCP Registry, existing directories, and Coinbase/CDP Bazaar readiness.

For Coinbase it must notify on:

- unexpected CDP facilitator activation/failure
- first genuine outside CDP-facilitated settlement
- Coinbase Bazaar indexing
- Agentic Market visibility

It must never self-pay to generate indexing.

## Current judgment

No major new product subsystem is justified right now.

The best next growth work is legitimate distribution and conversion. Coinbase Bazaar/Agentic Market is a worthwhile additional buyer channel, and the code side is now prepared without weakening the current production payment rail.

The one unavoidable missing input for CDP settlement activation is a legitimate Coinbase Developer Platform API Key ID + API Key Secret stored securely in the seller environment. Until those exist, keep PayAI active and do not falsely claim Coinbase indexing.

Next sequence:

> get more buyer visibility → first genuine request/payment → second unrelated buyer → repeat use → monetize Outcome Router → scale the highest-demand capability

## Continuity rule

When switching chats, reconcile against:

- latest GitHub main
- all four Render services
- canonical ledger / verified settlements
- Agent402 buyer-search state
- x402scan resources
- official MCP Registry
- Coinbase/CDP Bazaar readiness and Agentic Market visibility
- Outcome Router payment state
- TaskBounty
- Human Earn provider inbox/status
- Moltbook aggregate state
- canonical Earn Watch automation

Never let stale chat context override verified live state.
