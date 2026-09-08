# INCOME 2 — Canonical State

Last reconciled: 2026-09-08 17:22 America/New_York

This is the canonical **non-secret** state summary for INCOME 2. Before a material decision, reconcile it against latest GitHub main, live Render services, provider messages, external markets, official MCP Registry state, and current Moltbook state. Never place API keys, recovery tokens, private keys, seed phrases, claim secrets, solver keys, or other credentials here.

## Product

**Brand:** INCOME 2  
**Motto:** Your second income. Powered by you or your AI.  
**Core promise:** Make money yourself — or let your AI earn for you.

Current modes:

- **Human Earn:** legitimate human-required paid opportunities completed truthfully by the user.
- **Agent Earn / Auto Make Me:** eligible machine-doable paid work performed autonomously.
- **Buyer intent / Outcome Router:** an agent states the result it wants plus a maximum budget; INCOME 2 autonomously finds a supported fulfillment route and executes when possible.

INCOME 2 is a two-sided earning/fulfillment thesis: humans and agents can supply work; humans or agents can buy completed outcomes; INCOME 2 sits in the transaction/routing layer.

## HYDRA identity

**HYDRA is only the internal codename for the autonomous Outcome Router inside INCOME 2.** Public feature name: **INCOME 2 Outcome Router**.

The older standalone HYDRA Agent Seller is retired:

- legacy repo `Patrickbo19/promisekeeper` is stripped to a decommission notice + 410 tombstone + minimal dependencies;
- `hydra-agent-seller` was already suspended;
- `hydra-agent-market-clean` was redeployed as the tombstone;
- Git history remains only for audit/recovery;
- never resume development there.

## Revenue truth

Only verified real third-party settled money **earned by INCOME 2** counts as revenue.

Current verified state:

- verified real external INCOME 2 revenue: **$0**
- verified genuine outside Agent Earn settlements: **0 confirmed**
- verified outside paid Outcome Router fulfillments: **0 confirmed**
- Human Earn live provider conversions: **0**
- HYDRA platform fee: **$0 during beta**

Do not count listings, registry publication, requests, quotes, self-tests, proof-of-work calls, buyer-to-supplier/router payment volume, or the existing unverified 0.003 ledger row as INCOME 2 revenue.

## Live INCOME 2 services

Repository: `Patrickbo19/BidLens-Core`, branch `main`, Render auto-deploy enabled.

- `earn-router` — public website / Human Earn router
- `earn-tools-backend` — canonical ledger, x402 seller, Purchase Guard, HYDRA Outcome Router, TaskBounty bridge, Moltbook vault/status
- `earn-chat-mcp` — ChatGPT/MCP surface
- `earn-agent-worker` — MCP/TaskBounty/discovery verifier

All four services were live on the latest sweep deployment.

## Public website — sweep 2026-09-08

Website: `https://earn-router.onrender.com`

Production source of truth is `robust-router.js`; current router version is **0.6.1**. The duplicate old `server.js` implementation was removed and is now only a compatibility shim requiring `robust-router.js`.

The public page now exposes the actual current product instead of the old Agent Earn/Human Earn-only prototype:

- hero positioning: **Earn from work. Or buy the result.**
- Agent Earn card
- highlighted Outcome Router card with desired-result + maximum-budget form
- Human Earn card
- live seller catalog with per-resource prices; removed the false blanket "$0.001 per call" statement
- direct MCP and REST entrypoints for agents
- links to `skill.md`, OpenAPI, x402 manifest and agents.txt
- `/agents.txt`, `/llms.txt`, `/robots.txt`
- updated privacy and terms for external routing and buyer-signed x402
- HTML escaping/safe URL handling for provider/manifest content
- hardened response headers including CSP, nosniff, frame denial and referrer policy
- `/api/outcome` and `/api/outcome/{id}` web proxies
- paid Outcome Router execution links normalized to absolute seller URLs and returned execution body exposed to the web caller
- dormant Lootably `/postback/lootably` compatibility endpoint restored, but deliberately **unattributed** until exact provider signing/reversal/idempotency semantics are known.

Minor non-blocking cleanup: `/robots.txt` currently uses the seller OpenAPI URL as a `Sitemap:` value even though it is not an XML sitemap. This does not affect the app; remove/replace when ordinary SEO becomes a priority.

## HYDRA / Outcome Router

Definition:

> desired result + maximum budget → autonomous routing → safe execution → result, or abstract unmet-demand signal

Hard rules:

- autonomous only; no manual brokerage
- never spend owner working capital on anonymous buyer jobs
- never request or retain a buyer private key/seed phrase
- do not retain raw task or raw params in the demand ledger
- retain only abstract request metadata such as category, budget, route, status, timestamps and result digest
- block credential-like inputs from external routing
- idempotency binds one request to one parameter set
- do not silently raise caller budget or auto-escalate to higher paid tiers

Seller surfaces:

- `GET /outcome-router`
- `POST /outcome-router`
- `GET /outcome-router/{requestId}`
- `POST /outcome-router/execute/{requestId}`

MCP tool:

- `request_agent_outcome`

### Free path

HYDRA attempts compatible Agent402 proof-of-work execution where possible with $0 upstream dollar spend.

### Paid path — live beta

Paid fulfillment uses the official Agent402 Smart Order Router basic route:

`POST https://agent402.tools/api/route/execute`

Flow:

1. buyer supplies desired result + max budget + idempotency key + optional params;
2. HYDRA tries free fulfillment first;
3. HYDRA probes paid routing without signing or paying;
4. HYDRA parses the x402 v2 `PAYMENT-REQUIRED` challenge and enforces budget;
5. if within budget, HYDRA returns its execution URL/body;
6. buyer wallet signs locally;
7. buyer retries with `PAYMENT-SIGNATURE`;
8. HYDRA forwards proof and matching request to Agent402;
9. Agent402 routes/executes supplier and returns result/receipt;
10. HYDRA returns the result and records abstract execution state only.

Latest live no-payment safety self-test:

- upstream `agent402_route_execute`
- x402 challenge observed: true
- observed basic quote: **$0.01 USDC**
- owner funds spent: **$0**
- payment signed during test: false

Higher paid Agent402 tiers are not automatically escalated. If payment may have settled but fulfillment is unresolved, use `payment_settled_fulfillment_unresolved` and reconcile the original attempt before any new spending authorization.

Current platform fee: **$0** while real buyer demand is validated.

## Purchase Guard

Free non-custodial retry-safety wedge:

- `GET /purchase-guard`
- `POST /purchase-guard`
- `GET /purchase-guard/{receiptId}`
- MCP tool `guard_x402_purchase`

Purpose: one intended purchase → hard max spend → stable idempotent intent → durable receipt → retry recognition.

It never signs, sends, settles or custodies funds; `paymentExecuted=false` remains hard.

## ChatGPT / MCP

Endpoint: `https://earn-chat-mcp.onrender.com/mcp`  
Health: `https://earn-chat-mcp.onrender.com/health`  
Current intended MCP version: **0.3.1**

Six tools:

1. `get_earning_options`
2. `start_agent_earn`
3. `check_earnings`
4. `find_paid_opportunities`
5. `guard_x402_purchase`
6. `request_agent_outcome`

The worker verifier was hardened during the sweep: all six tools are now required for health. Previously it required only five and could have missed an Outcome Router regression. Current worker verification reports modern MCP, all six tools, Agent Earn live, canonical ledger persistent, and Human Earn provider pending.

Public ChatGPT directory submission has not been sent.

Launch gate remains BOTH:

1. one genuine outside Agent Earn settlement recorded end-to-end;
2. one Human Earn provider approved and returning real funded inventory.

## Official MCP Registry distribution

INCOME 2 now publishes to the **official MCP Registry** as a remote Streamable HTTP server.

Repo metadata file:

- `server.json`
- registry name `io.github.Patrickbo19/income2`
- version `0.3.1`
- remote `https://earn-chat-mcp.onrender.com/mcp`

Automated workflow:

- `.github/workflows/publish-mcp-registry.yml`
- validates with the official publisher
- authenticates using GitHub OIDC (`id-token: write`)
- publishes without a long-lived registry secret

First publication workflow run `34279889558` completed successfully on 2026-09-08. Treat this as successful publication/distribution work, **not revenue**. Registry/UI search indexing can lag and should be monitored separately.

## x402 / Agent402 distribution

Seller origin: `https://earn-tools-backend.onrender.com`  
Network: Base mainnet `eip155:8453`  
Asset: USDC

Primary first-sale route:

- `POST /web-extract`
- 0.003 USDC
- public static page → clean Markdown + metadata/links

Paid seller manifest remains **13 paid resources**. Agent402 may report a larger discovery count because free/docs/Outcome Router surfaces are included; do not conflate discovered surfaces with paid resources.

Existing distribution includes Agent402, x402 Arena, Market402, 402Index and now the official MCP Registry.

### Current discovery bottleneck

Latest verifier search probes found INCOME 2 was **not in the top five Agent402 natural-search results** for tested queries covering hash/encoding, prompt-security, JSON/data audit, URL health, x402 buyer preflight, and outcome routing/procurement.

This means the immediate bottleneck is **distribution/search visibility**, not missing fulfillment architecture. Do not self-pay or manipulate ranking. Improve legitimate standardized discovery and wait for external usage evidence before adding more product plumbing.

Ordinary web search indexing of the `onrender.com` site is also weak/new. Do not expect consumer SEO to produce immediate agent buyers.

## Canonical account / ledger

Website and MCP share the Postgres-backed canonical seller ledger.

Latest verified worker view:

- persistent true
- activeAccounts 2
- activeIncome2Accounts 1
- settlements 1
- grossUsd 0.003

That 0.003 remains **unverified as a genuine outside settlement** and therefore does not count as revenue.

Cash-out is not production-enabled.

## Human Earn

Funded provider inventory is not live.

Known provider state:

- Lootably — applied, no approval confirmed
- TapResearch — applied, no approval confirmed
- ayeT Studios — acknowledged/reviewing, no approval confirmed

Do not claim any other provider is applied/approved without fresh verification.

The production router now again exposes `/postback/lootably`, but conversion attribution remains intentionally disabled until the provider's exact security/reversal/idempotency contract is known.

## TaskBounty / Task Hunter

Brainbase Task Hunter ID: `66070003-c3eb-4ccc-80e4-4ead96bf402b`

Latest verified posture:

- connected true
- authReady true
- HTTP 200
- persistent/configured true
- openTaskCount 0

Only wake paid managed compute for a legitimate, well-scoped, safe candidate with gross >= $25 and expected proceeds materially above compute cost.

## Moltbook

Agent `Income2` remains claimed. Compliance-first rules remain hard:

- official supported access only
- no broad scraping/crawling/mass-search
- no third-party content/identity harvesting or republication
- no automated promotion/spam/mass-DM/comment/follow/vote
- no duplicate identities, impersonation or safety/rate-limit evasion

Current automated product promotion remains disabled.

## Repo/document cleanup from sweep

The following stale/conflicting instructions were removed or corrected:

- `server.js` duplicate router → compatibility shim only
- root README → current three-part INCOME 2 product
- `CHATGPT_APP_SUBMISSION.md` → current six MCP tools + Outcome Router + Purchase Guard
- `AGENT_EARN_BOOTSTRAP.md` → old the402 auto-bid plan marked historical/non-production
- `ACTIVATION_OWNER_GATE.md` → obsolete the402 account gate removed
- `package.json` description → current product

One remaining external metadata mismatch: the GitHub repository description shown in GitHub metadata still contains the old BidLens/RFP description. The connected GitHub controls available in this session do not expose repository-description editing. Update that metadata manually in GitHub when convenient; it does not affect runtime.

## Working capital

Owner-authorized ceiling: **$10**.

HYDRA buyer jobs must never use it. Preserve it unless a separate verified legitimate earning opportunity genuinely requires a small spend and expected economics justify it.

## Autonomous controller

Automation: `INCOME 2 Earn Watch`  
ID: `6a9f2eb7dccc8191a659939d9b47a0f0`  
Enabled: yes  
Frequency: hourly condition watch

Monitor:

- genuine outside settlements / revenue truth
- `/web-extract` health/discovery
- Purchase Guard outside usage/WTP
- HYDRA free and paid usage
- external paid fulfillment and payment uncertainty
- repeated abstract unmet-demand categories
- requests blocked only by budget/tier limitations
- TaskBounty status/inventory
- all-six-tool MCP health
- Human Earn provider changes
- Moltbook aggregate compliance-safe status
- official MCP Registry publication/visibility regressions
- meaningful discovery changes, especially natural Agent402 visibility

For HYDRA distinguish:

1. routed requests
2. buyer-paid fulfillment volume
3. **INCOME 2 fee revenue**

Only #3 is INCOME 2 revenue. During zero-fee beta it remains $0 even if #2 starts.

## Current strategic judgment

The architecture sweep did not reveal another major missing subsystem. The central buyer-side routing/payment architecture is implemented in beta form.

The immediate priorities are now:

**distribution → first outside request → first paid fulfillment → second unrelated buyer → repeat demand → add fee/spread → scale**

Do not return to architecture-building simply because traffic is initially quiet. If external requests arrive but do not convert, fix conversion. If no requests arrive despite meaningful discovery exposure, improve distribution. If paid use occurs but does not repeat, revisit product fit.

## Continuity rule

When switching chats, read this file and then reconcile against:

- latest GitHub main
- live Render health/deploys
- official MCP Registry publication/visibility
- HYDRA request/payment state
- canonical ledger / verified settlements
- Agent402/x402 discovery
- TaskBounty
- Human Earn provider inbox/status
- Moltbook aggregate state
- enabled Earn Watch

Update this file after material architecture, payment, revenue, provider, distribution, Moltbook, TaskBounty, Purchase Guard, HYDRA, website, or automation changes. Never let stale chat context override verified live state.
