# INCOME 2 — Canonical State

Last reconciled: 2026-09-08 18:12 America/New_York

This is the canonical **non-secret** state summary for INCOME 2. Reconcile it against latest GitHub `main`, live Render, provider messages, external discovery markets, the official MCP Registry, and current Moltbook state before material decisions. Never place API keys, recovery tokens, private keys, seed phrases, solver keys, passwords, or other credentials here.

## Mission / operating rule

**Brand:** INCOME 2  
**Motto:** Your second income. Powered by you or your AI.  
**Core promise:** Make money yourself — or let your AI earn for you.

Current product surfaces:

- **Human Earn** — legitimate human-required paid opportunities.
- **Agent Earn / Auto Make Me** — eligible machine-doable paid work.
- **Outcome Router** — buyer/agent supplies desired result + max budget; INCOME 2 finds and executes a supported fulfillment route.
- **Purchase Guard** — free non-custodial x402 max-spend/idempotency/retry safety.

HYDRA is only the internal codename for the Outcome Router inside INCOME 2. The standalone HYDRA project is retired.

The current objective is **maximum legitimate autonomous revenue**, not architecture completion for its own sake. The execution sequence is:

> **distribution → first outside request → first paid fulfillment → second unrelated buyer → repeat demand → add fee/spread → scale**

Do not self-pay, fake demand, spam directories, manipulate rankings, or create duplicate identities to manufacture traction.

## Revenue truth

Only verified real third-party money **earned by INCOME 2** counts as revenue.

Current verified state:

- verified external INCOME 2 revenue: **$0**
- verified genuine outside Agent Earn settlements: **0 confirmed**
- verified outside paid Outcome Router fulfillments: **0 confirmed**
- Human Earn live provider conversions: **0**
- Outcome Router platform fee: **$0 during beta**

The ledger still reports one 0.003 settlement row, but it is not independently proven to be an outside buyer and therefore does **not** count as verified revenue.

Do not count listings, catalog registration, registry publication, requests, quotes, self-tests, proof-of-work calls, buyer-to-supplier payment volume, or unverified ledger rows as revenue.

## Current GitHub / Render truth

Repository: `Patrickbo19/BidLens-Core`, branch `main`.

Latest material discovery commit:

- `293079159c9e17fb9669bc4163f3ed673badf5b1`
- message: `Unify discovery truth with registration-spam guard`

All four production services were verified **live on this commit** after the discovery-only closure pass:

- `earn-router` — public website / Human Earn router
- `earn-tools-backend` — canonical ledger, x402 seller, Purchase Guard, Outcome Router, TaskBounty bridge, Moltbook vault/status
- `earn-chat-mcp` — ChatGPT/MCP surface
- `earn-agent-worker` — independent MCP/TaskBounty/discovery verifier

Current public router version remains **0.6.1**.

## Outcome Router / HYDRA

Definition:

> desired result + maximum budget → autonomous routing → safe execution → result, or abstract unmet-demand state

Hard rules:

- autonomous only; no manual brokerage
- never use owner working capital for anonymous buyer jobs
- never request or retain buyer private keys/seed phrases
- raw task/params are not retained in the demand ledger
- block credential-like input from external routing
- idempotency binds one request to one parameter set
- never silently raise caller budget
- do not auto-escalate higher paid tiers

Seller surfaces:

- `GET /outcome-router`
- `POST /outcome-router`
- `GET /outcome-router/{requestId}`
- `POST /outcome-router/execute/{requestId}`

MCP tool: `request_agent_outcome`.

### Free path

HYDRA first attempts compatible Agent402 proof-of-work execution at **$0 upstream dollar spend**.

### Paid path

Paid beta fulfillment uses Agent402 Smart Order Router basic execution:

`POST https://agent402.tools/api/route/execute`

Buyer wallet signs the x402 challenge locally. HYDRA relays `PAYMENT-REQUIRED`, enforces budget, accepts the buyer-created `PAYMENT-SIGNATURE`, forwards proof, and returns the routed result. HYDRA does not receive private keys and does not subsidize buyer jobs.

Latest live no-payment self-test after the final discovery deploy:

- upstream: `agent402_route_execute`
- x402 challenge observed: true
- observed quote: **$0.01 USDC**
- owner funds spent: **$0**
- payment signed: false

Current platform fee remains **$0** until real external paid demand exists.

## Purchase Guard

Free non-custodial retry-safety wedge:

- `GET /purchase-guard`
- `POST /purchase-guard`
- `GET /purchase-guard/{receiptId}`
- MCP tool `guard_x402_purchase`

It enforces max spend, stable idempotent purchase intent, and durable receipt semantics. It never signs, sends, settles, or custodies funds; `paymentExecuted=false` remains hard.

## MCP

Endpoint: `https://earn-chat-mcp.onrender.com/mcp`  
Registry/MCP version: **0.3.1**

All six tools are required and latest independent worker verification reports `ok:true`:

1. `get_earning_options`
2. `start_agent_earn`
3. `check_earnings`
4. `find_paid_opportunities`
5. `guard_x402_purchase`
6. `request_agent_outcome`

Latest worker verification after the discovery pass also reports:

- modern MCP
- Agent Earn live
- canonical ledger persistent
- Human Earn provider pending
- TaskBounty authenticated
- open TaskBounty count: **0**

`zod` is 4.2.0; the earlier MCP JSON-schema compatibility warning is resolved.

Public ChatGPT directory launch gate remains BOTH:

1. one genuine outside Agent Earn settlement recorded end-to-end;
2. one Human Earn provider approved and returning real funded inventory.

## Official MCP Registry

Published remote server:

- name: `io.github.Patrickbo19/income2`
- version: `0.3.1`
- remote: `https://earn-chat-mcp.onrender.com/mcp`

`server.json` and `.github/workflows/publish-mcp-registry.yml` use the official publisher and GitHub OIDC. Publication is distribution, not revenue.

## x402 seller

Seller origin: `https://earn-tools-backend.onrender.com`  
Network: Base mainnet `eip155:8453`  
Asset: USDC

Primary first-sale route:

- `POST /web-extract`
- **0.003 USDC**
- public static webpage/article → clean Markdown + metadata/links

Paid seller manifest remains **13 paid resources**.

## Discovery-only closure pass — 2026-09-08

The third pass focused only on what external buyers/catalogs can actually see. It found and corrected two material discovery risks.

### 1. Stale machine-facing Outcome Router truth

`seller-core.js` still contained pre-paid-rail wording saying paid Outcome Router execution was disabled. Even though downstream runtime patches corrected some surfaces, stale base text could leak into machine discovery.

Production now preloads `discovery-truth.cjs` on `earn-tools-backend` through `NODE_OPTIONS`.

It hardens public machine-facing output so OpenAPI, x402 descriptor, `skill.md`, `llms.txt`, and `agents.txt` describe the current truth:

- free proof-of-work first
- buyer-signed non-custodial x402 paid execution supported where routed and within caller budget
- buyer signs locally
- HYDRA never receives the buyer private key
- owner working capital is not used
- higher paid tiers are not silently escalated
- beta platform fee is $0

x402scan's fresh server-side OpenAPI discovery confirmed the public origin now exposes **19 surfaces**, including `POST /outcome-router/execute/{requestId}` described as buyer-signed x402 execution.

### 2. Registration-spam regression prevention

The discovery pass briefly revealed that replacing the prior preload could re-enable deploy-time directory submissions. That interaction was caught before closure.

`discovery-truth.cjs` now contains both protections in one preload:

- truthful machine discovery metadata
- local interception of boot-time registration POSTs to Agent402, x402 Arena, Market402, and 402Index unless explicitly enabled

Production defaults:

- `EARN_DIRECTORY_REGISTER_ON_BOOT=0`
- `X402SCAN_REGISTER_ON_BOOT=false`

Existing directory listings are preserved. A deliberate refresh can be explicitly enabled when needed; normal Render deploys must not resubmit directories.

Fresh final production logs confirm all four legacy directory registration attempts are again returned locally as `registration_on_boot_disabled` rather than sent externally.

### x402scan — new verified discovery channel

A one-time public origin registration was intentionally performed using x402scan's own public `registerFromOrigin` flow after validating the OpenAPI discovery document.

Result on 2026-09-08:

- discovery source: `openapi`
- discovered surfaces: **19**
- paid x402 resources registered: **13**
- public/free surfaces cataloged: **6**
- failed: **0**
- skipped: **0**
- x402scan origin ID: `631b3d50-1a0b-4474-a8aa-e922c1cf6445`

The six public/free surfaces include Purchase Guard and Outcome Router/status/execution surfaces. The 13 paid resources are the actual seller resources.

After successful registration, `X402SCAN_REGISTER_ON_BOOT` was turned back to `false` so x402scan registration is not repeated on deploy.

Search-engine indexing of the x402scan page may lag the registry write; the successful server-side registration result is the authoritative current evidence.

### Other discovery rails

Current legitimate distribution includes:

- Agent402
- x402 Arena
- Market402
- 402Index
- x402scan
- official MCP Registry

During the transient preload interaction, one restart retried some legacy directories before the unified guard was restored. Agent402 returned rate-limit, x402 Arena duplicate-name, Market402 confirmed already-listed/spec-compliant, and 402Index refreshed its existing pending entries. No listing was removed. The final production instance blocks these repeat submissions again.

## Current discovery bottleneck

Latest independent Agent402 natural-search probes still do **not** place INCOME 2 in the top five for tested buyer phrases covering encoding, prompt security, JSON audit, URL health, x402 preflight, or outcome procurement.

Agent402 routing/search evidence indicates buyer-side ranking is driven primarily by task match, then health, then price. With a very large external seller index, the immediate business problem remains **legitimate discovery and real buyer traffic**, not missing fulfillment architecture.

Do not self-pay or game ranking. Improve truthful semantic match only when evidence shows it helps; prioritize real external distribution and buyer conversion.

## Human Earn

Funded provider inventory is still not live.

Known state from the latest provider sweep:

- Lootably — application sent; no approval confirmed
- TapResearch — application sent; no approval confirmed
- ayeT Studios — acknowledged/reviewing; no approval confirmed

Do not claim other provider approval without fresh verification.

## TaskBounty

Brainbase Task Hunter ID: `66070003-c3eb-4ccc-80e4-4ead96bf402b`

Latest verified state:

- connected: true
- authReady: true
- HTTP: 200
- persistent/configured: true
- openTaskCount: **0**

Only wake paid managed compute for a legitimate, well-scoped, safe candidate with gross >= $25 and expected proceeds materially above compute cost.

## Moltbook

Agent `Income2` remains claimed. Compliance hard rules remain:

- official supported access only
- no broad scraping/crawling/mass-search
- no harvesting or republishing third-party content/identities
- no automated promotion/spam/mass-DM/comment/follow/vote
- no duplicate identities, impersonation, rate-limit or safety-control evasion

Automated product promotion remains disabled.

## Canonical ledger

Website and MCP share the Postgres-backed seller ledger.

Latest worker view:

- persistent: true
- activeAccounts: 2
- activeIncome2Accounts: 1
- settlements: 1
- grossUsd: 0.003

The 0.003 row remains unverified as genuine outside revenue.

Customer cash-out is not production-enabled.

## Benign startup notices

Two startup-only notices remain intentionally unchanged because they self-resolve and do not affect production readiness:

1. brief wrapper-to-core `ECONNREFUSED 127.0.0.1:3901` while the internal seller core is starting;
2. JSON Schema validator logs that nested `format: "uri"` is unknown/ignored; application URL validation still enforces public URL safety.

Do not destabilize production merely to silence these unless they begin causing failed health checks or discovery rejection.

## Legacy HYDRA

Legacy repo: `Patrickbo19/promisekeeper`.

- standalone HYDRA remains retired
- `hydra-agent-seller` suspended
- `hydra-agent-market-clean` tombstoned with HTTP 410 replacement notice
- never resume standalone HYDRA development there

The old standalone `HYDRA Earnings Watch` automation was disabled and must not be re-enabled.

## Working capital

Owner-authorized ceiling: **$10**.

HYDRA buyer jobs must never use it. Preserve it unless a separate verified legitimate earning opportunity requires small capital and expected economics justify it.

## Autonomous controller

Canonical intended controller: `INCOME 2 Earn Watch`  
Known ID: `6a9f2eb7dccc8191a659939d9b47a0f0`  
Last peek on 2026-09-08 reported it enabled and hourly.

It should monitor revenue truth, seller/x402 health, Outcome Router, Purchase Guard, TaskBounty, six-tool MCP health, Human Earn approvals, Moltbook compliance-safe aggregate state, official MCP Registry, Agent402 visibility, and x402scan visibility.

A prompt-update attempt during the discovery pass returned `This task is no longer available` despite the same task appearing in a fresh private peek. **Do not create a duplicate automation.** Reconcile this task handle on a later automation check; production discovery/runtime does not depend on the automation.

## Current judgment

After the architecture sweeps plus this discovery-only pass, there is no evidence that another major subsystem should be built before outside demand arrives.

The important discovery defect was real and is now corrected. x402scan adds a verified new machine-discovery surface. The seller remains healthy, the buyer-signed HYDRA rail remains live, and all six MCP tools remain verified.

Next priority:

> **get seen → get one stranger to request/pay → prove a second unrelated buyer → observe repeat demand → monetize the routing layer → scale the highest-demand capability**

If exposure increases but requests remain zero, improve positioning/search match/distribution. If requests arrive but paid conversion fails, fix conversion. If paid use occurs but does not repeat, revisit product fit. Do not respond to quiet traffic by building unrelated plumbing.

## Continuity rule

When switching chats, read this file and reconcile against:

- latest GitHub `main`
- all four Render services/deploys/logs
- official MCP Registry
- x402scan origin/resources
- Agent402/x402 discovery
- Outcome Router request/payment state
- canonical ledger / verified settlements
- TaskBounty
- Human Earn provider inbox/status
- Moltbook aggregate state
- canonical Earn Watch task state

Update this file after material payment, revenue, provider, distribution, Moltbook, TaskBounty, Purchase Guard, Outcome Router, website, registry, or automation changes. Never let stale chat context override verified live state.
