# INCOME 2 — Canonical State

Last reconciled: 2026-09-08 17:46 America/New_York

This is the canonical **non-secret** state summary for INCOME 2. Before a material decision, reconcile it against latest GitHub `main`, live Render services, provider messages, external markets, official MCP Registry state, and current Moltbook state. Never place API keys, recovery tokens, private keys, seed phrases, claim secrets, solver keys, passwords, or other credentials here.

## Product

**Brand:** INCOME 2  
**Motto:** Your second income. Powered by you or your AI.  
**Core promise:** Make money yourself — or let your AI earn for you.

Current product surfaces:

- **Human Earn:** legitimate human-required paid opportunities completed truthfully by the user.
- **Agent Earn / Auto Make Me:** eligible machine-doable paid work performed autonomously.
- **Outcome Router:** buyer or agent provides a desired result plus maximum budget; INCOME 2 autonomously finds a supported fulfillment route and executes when possible.
- **Purchase Guard:** free, non-custodial x402 retry/idempotency/max-spend safety layer.

HYDRA is only the internal codename for the Outcome Router inside INCOME 2. The old standalone HYDRA project is retired.

## Revenue truth

Only verified real third-party settled money **earned by INCOME 2** counts as revenue.

Current verified state:

- verified real external INCOME 2 revenue: **$0**
- verified genuine outside Agent Earn settlements: **0 confirmed**
- verified outside paid Outcome Router fulfillments: **0 confirmed**
- Human Earn live provider conversions: **0**
- HYDRA platform fee: **$0 during beta**

The canonical ledger still reports one 0.003 settlement row, but it is not independently proven to be an outside buyer and therefore does **not** count as verified revenue.

Do not count listings, registry publication, directory registration, requests, quotes, self-tests, proof-of-work fulfillment, buyer-to-supplier payment volume, or unverified rows as INCOME 2 revenue.

## Live services

Repository: `Patrickbo19/BidLens-Core`, branch `main`, Render auto-deploy enabled.

- `earn-router` — public website / Human Earn router
- `earn-tools-backend` — canonical ledger, x402 seller, Purchase Guard, Outcome Router, TaskBounty bridge, Moltbook vault/status
- `earn-chat-mcp` — ChatGPT/MCP surface
- `earn-agent-worker` — independent MCP/TaskBounty/discovery verifier

Second closure sweep verified all four live on current `main` after maintenance changes.

Current public router version: **0.6.1**.

## Public website

Website: `https://earn-router.onrender.com`

Public positioning:

> **Earn from work. Or buy the result.**

The page exposes Agent Earn, Outcome Router, Human Earn, live seller resources/prices, direct MCP/REST agent entrypoints, privacy/terms, and machine documentation links. Production source is `robust-router.js`; `server.js` is only a compatibility shim.

The web Outcome Router normalizes paid execution URLs to absolute seller URLs and returns the exact execution body required for a buyer-signed x402 retry.

Lootably `/postback/lootably` exists for compatibility but deliberately does **not** credit the ledger until the provider's exact signing, reversal, attribution, and idempotency semantics are verified.

## Outcome Router / HYDRA

Definition:

> desired result + maximum budget → autonomous routing → safe execution → result, or abstract unmet-demand state

Hard rules:

- autonomous only; no manual brokerage
- never use owner working capital for buyer jobs
- never request or retain buyer private keys/seed phrases
- do not retain raw task or raw params in the demand ledger
- block credential-like inputs from external routing
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

HYDRA first attempts compatible Agent402 proof-of-work execution with **$0 upstream dollar spend**.

### Paid path

Paid beta fulfillment uses Agent402 Smart Order Router basic execution:

`POST https://agent402.tools/api/route/execute`

The buyer wallet signs the x402 challenge locally. HYDRA relays `PAYMENT-REQUIRED`, enforces the budget, accepts the buyer-created `PAYMENT-SIGNATURE`, forwards the proof, and returns the routed result. HYDRA does not receive the private key and does not subsidize the job.

Latest no-payment live self-test:

- upstream: `agent402_route_execute`
- x402 challenge observed: true
- observed quote: **$0.01 USDC**
- owner funds spent: **$0**
- payment signed: false

Current platform fee remains **$0** until real external paid usage demonstrates willingness to pay for the routing layer.

If payment may have settled but fulfillment is unresolved, use `payment_settled_fulfillment_unresolved` and reconcile the original attempt before any new spending authorization.

## Purchase Guard

Free, non-custodial retry-safety wedge:

- `GET /purchase-guard`
- `POST /purchase-guard`
- `GET /purchase-guard/{receiptId}`
- MCP tool `guard_x402_purchase`

MCP supports methods `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`. Machine-facing OpenAPI is runtime-hardened to match this full method set.

Purchase Guard never signs, sends, settles, or custodies funds. `paymentExecuted=false` is a hard property.

## MCP

Endpoint: `https://earn-chat-mcp.onrender.com/mcp`  
Health: `https://earn-chat-mcp.onrender.com/health`  
Registry/MCP version: **0.3.1**

All six tools are required by the independent verifier:

1. `get_earning_options`
2. `start_agent_earn`
3. `check_earnings`
4. `find_paid_opportunities`
5. `guard_x402_purchase`
6. `request_agent_outcome`

Latest verifier state:

- modern MCP: true
- all six tools present
- Agent Earn live
- canonical ledger persistent
- Human Earn provider pending
- TaskBounty authenticated

`zod` was upgraded from 4.1.5 to **4.2.0** during the second sweep to satisfy the current MCP SDK JSON-schema capability. The prior `~standard.jsonSchema` compatibility warning no longer appears on the current MCP startup.

Public ChatGPT directory submission is still gated on BOTH:

1. one genuine outside Agent Earn settlement recorded end-to-end;
2. one Human Earn provider approved and returning real funded inventory.

## Official MCP Registry

INCOME 2 is published as:

- name: `io.github.Patrickbo19/income2`
- version: `0.3.1`
- remote: `https://earn-chat-mcp.onrender.com/mcp`

Files:

- `server.json`
- `.github/workflows/publish-mcp-registry.yml`

The first official publish workflow completed successfully using GitHub OIDC with no long-lived registry secret. Treat publication as distribution, not revenue.

## x402 seller / distribution

Seller: `https://earn-tools-backend.onrender.com`  
Network: Base mainnet `eip155:8453`  
Asset: USDC

Primary first-sale route:

- `POST /web-extract`
- **0.003 USDC**
- public static webpage/article → clean Markdown + metadata/links

Underlying paid seller manifest remains **13 paid resources**. Free Purchase Guard and Outcome Router surfaces are additional discovery capabilities, not paid seller resources.

Current legitimate discovery rails include Agent402, x402 Arena, Market402, 402Index, and the official MCP Registry.

### Second sweep: directory registration hardening

The second sweep found that `seller-v2.js` re-submitted directory registration requests on every Render deploy. This caused unnecessary Agent402/Market402/402Index rate-limit responses and x402 Arena duplicate-name responses.

This is now hardened:

- `seller-startup-hardening.cjs` is preloaded on `earn-tools-backend` through `NODE_OPTIONS`;
- `EARN_DIRECTORY_REGISTER_ON_BOOT=0` is the production default;
- known directory-registration POSTs are skipped locally instead of sent on each boot;
- existing external listings are **not** removed;
- explicit intentional registration can still be enabled with `EARN_DIRECTORY_REGISTER_ON_BOOT=1` when a real refresh is needed;
- `agent402-register.cjs` was also changed to require the same explicit opt-in.

Fresh production logs confirm Agent402, x402 Arena, Market402, and 402Index registration attempts are now reported as `registration_on_boot_disabled` instead of hitting the external services.

The live seller 402 challenge and HYDRA no-spend paid-rail self-test still pass after this change.

### Machine-facing discovery truth

The second sweep found stale base strings in `seller-core.js` that predated buyer-signed paid HYDRA and could describe paid external execution as disabled. Production output is now hardened at startup so public OpenAPI, x402 descriptor, `skill.md`, `llms.txt`, and `agents.txt` reflect the current truth:

- free proof-of-work first;
- buyer-signed x402 paid execution supported within caller budget;
- buyer signs locally;
- no owner working capital;
- no private-key custody;
- no manual brokerage;
- beta platform fee $0.

The production x402 descriptor also exposes free Purchase Guard and Outcome Router discovery resources in addition to the 13 paid resources.

## Discovery bottleneck

Latest independent Agent402 natural-search probes still do **not** place INCOME 2 in the top five for tested buyer phrases covering encoding, prompt security, JSON audit, URL health, x402 preflight, or outcome procurement.

That means the present bottleneck remains **distribution/search visibility**, not missing fulfillment architecture.

Do not self-pay, spam directories, mass-submit duplicate listings, or manipulate rankings. Improve legitimate standardized discovery and measure outside requests.

## Canonical ledger

Website and MCP share the same Postgres-backed seller ledger.

Latest worker view:

- persistent: true
- activeAccounts: 2
- activeIncome2Accounts: 1
- settlements: 1
- grossUsd: 0.003

Again: the existing 0.003 row remains unverified as genuine outside revenue.

Customer cash-out is not production-enabled.

## Human Earn

Fresh Gmail sweep on 2026-09-08:

- Lootably — application sent; no approval/rejection response found
- TapResearch — application sent; no approval/rejection response found
- ayeT Studios — request acknowledged and under review; no approval yet
- no new approval or action-required message found for BitLabs, CPX, or inBrain

Funded Human Earn inventory therefore remains **not live**.

## TaskBounty / Task Hunter

Brainbase Task Hunter ID: `66070003-c3eb-4ccc-80e4-4ead96bf402b`

Latest verified production state:

- connected: true
- authReady: true
- auth HTTP: 200
- persistent/configured: true
- openTaskCount: **0**

Do not wake paid managed compute unless a legitimate, well-scoped, safe candidate has gross >= $25 and expected proceeds materially above compute cost.

## Moltbook

Agent `Income2` remains claimed. Fresh seller logs show the neutral profile unchanged, claim HTTP 200, original research post already present, and automated product promotion still skipped for policy compliance.

Hard rules remain:

- official supported access only
- no broad scraping/crawling/mass-search
- no harvesting or republishing third-party content/identities
- no automated promotion/spam/mass-DM/comment/follow/vote
- no duplicate identities, impersonation, rate-limit evasion, or safety-control evasion

## Repo cleanup from the second sweep

Second sweep changes:

- added `seller-startup-hardening.cjs` for discovery truth + directory-registration control;
- changed `agent402-register.cjs` to explicit opt-in registration;
- upgraded `zod` to 4.2.0;
- fixed the Docker fallback so it installs dependencies and starts canonical `robust-router.js` directly;
- deleted retired `agent-earn-services-v2.json` the402 configuration;
- retained `server.js` only as the compatibility shim;
- official MCP registry automation remains active and successful.

One external metadata mismatch still exists: the GitHub repository description shown by GitHub still contains the old BidLens/RFP description. The connected GitHub controls available in this session do not expose repository-description editing. This does not affect runtime or MCP/x402 behavior, but should be manually changed in GitHub repository settings when convenient.

## Benign startup notices deliberately not changed

Two startup-only notices remain and were judged non-blocking:

1. a brief wrapper-to-core `ECONNREFUSED 127.0.0.1:3901` can occur while the internal seller core is still starting; the core then comes up and Render marks the service live;
2. the x402 discovery/schema validator logs that JSON Schema `format: "uri"` is unknown/ignored for some nested fields; URL safety is still enforced by application code and this does not break service startup or routing.

Do not destabilize production merely to silence these notices unless they begin causing failed health checks, user-visible errors, or discovery rejection.

## Legacy HYDRA

Legacy repo: `Patrickbo19/promisekeeper`.

- `hydra-agent-seller` is suspended;
- `hydra-agent-market-clean` is deployed as a tombstone;
- current legacy app returns HTTP 410 and points callers to INCOME 2;
- never resume standalone HYDRA development there.

## Working capital

Owner-authorized ceiling: **$10**.

HYDRA buyer jobs must never use it. Preserve it unless a separate verified legitimate earning opportunity genuinely requires a small spend and expected economics justify it.

## Autonomous controller

Canonical automation: `INCOME 2 Earn Watch`  
ID: `6a9f2eb7dccc8191a659939d9b47a0f0`  
Enabled: yes  
Frequency: hourly condition watch

Monitor:

- verified outside revenue/settlements
- `/web-extract` health and discovery
- Purchase Guard outside usage/WTP
- free and paid Outcome Router activity
- externally completed paid fulfillment
- payment/fulfillment uncertainty
- repeated abstract unmet-demand categories
- TaskBounty status/inventory
- all-six-tool MCP health
- Human Earn provider changes
- Moltbook aggregate compliance-safe state
- official MCP Registry publication/visibility
- natural Agent402 discovery changes

Do not treat intentionally skipped per-boot directory registration as a failure.

The old standalone `HYDRA Earnings Watch` automation (`6a9ec31ed1048191bd39afb6f538012b`) was found still enabled during the second closure sweep and was **disabled on 2026-09-08**. It targeted the retired standalone HYDRA tombstone and must not be re-enabled. The unified `INCOME 2 Earn Watch` is the authoritative HYDRA/INCOME 2 monitor.

For HYDRA distinguish:

1. routed requests
2. buyer-paid fulfillment volume
3. **INCOME 2 fee revenue**

Only #3 is INCOME 2 revenue. During the zero-fee beta it remains $0 even if #2 starts.

## Current strategic judgment

After **two full closure sweeps**, no additional major missing subsystem has been identified.

The product/payment architecture is sufficient to test the thesis. The immediate sequence is:

> **distribution → first outside request → first paid fulfillment → second unrelated buyer → repeat demand → add fee/spread → scale**

Do not return to architecture-building because traffic is quiet. If discovery exposure rises but requests do not, fix positioning/distribution. If requests arrive but paid execution does not convert, fix conversion. If paid use happens but does not repeat, revisit product fit.

## Continuity rule

When switching chats, read this file and reconcile it against:

- latest GitHub `main`
- all four Render services/deploys/logs
- official MCP Registry publication
- HYDRA request/payment state
- canonical ledger / verified external settlements
- Agent402/x402 discovery
- TaskBounty
- Human Earn provider inbox/status
- Moltbook aggregate state
- enabled `INCOME 2 Earn Watch`

Update this file after material architecture, payment, revenue, provider, distribution, Moltbook, TaskBounty, Purchase Guard, HYDRA, website, registry, or automation changes. Never let stale chat context override verified live state.
