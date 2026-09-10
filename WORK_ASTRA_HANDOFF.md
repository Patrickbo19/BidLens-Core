# INCOME 2 — Work / GPT-6 Astra Handoff

Last prepared: 2026-09-09 23:15 America/New_York

This document is a non-secret operating handoff for a fresh ChatGPT Work session. It exists so a new Work/Astra session can resume INCOME 2 without reconstructing months of chat history. Before taking any material action, reconcile this file against **live GitHub main, Render production, current provider/marketplace state, Gmail, and the canonical `INCOME2_STATE.md`**. Live state beats this document if they conflict.

## Latest Work reconciliation — 2026-09-10 04:03 UTC

Read the updated `INCOME2_STATE.md` and `AGENT402_LIVE_UPDATE.md` before following the historical detail below.

- Verified external revenue remains **$0**. Ledger still has only the old unverified 0.003 USDC row; PayanAgent paidAttempts and receiptsSold are 0; TaskBounty open tasks are 0.
- All four Render services are live on `c6c729ef9f6aeaa50624a4013ef525abfeb695ec`; six MCP tools preserved.
- Canonical `POST /url-to-clean-markdown` is deployed, with `/web-extract` retained as a paid compatibility alias. There are 14 paid URLs for 13 capabilities. Both returned correct $0.001 Base USDC 402 challenges; no payment was signed.
- Minimal privacy-safe aggregate funnel telemetry is already implemented in `/health.funnel` and Render `seller_funnel` logs. Do not build it again. Counts are per request, not unique buyers, and health totals reset with the process. Exclude diagnostic probes and do not equate unclassified crawler challenges with demand.
- CDP flag remains deliberately ON; credential-pair readiness is false, with PayAI fallback. The owner must configure the pair directly in Render. Coinbase docs require a successful CDP-settled payment for indexing; validation/credentials alone do not assure distribution. CDP public API requests timed out from Work; Agentic.Market returned 403. Neither visibility nor absence is confirmed.
- Agent402's public source corrects its email: re-registering a known origin refreshes existing route prices, not the manifest. One refresh initially returned the old catalog. Its normal full crawler subsequently ran at 03:59:25 UTC and now shows **20 surfaces / 14 paid URLs**, including the alias. The exact query `extract clean markdown from webpage url` now ranks **#1 among external results**; the other two monitored searches remain outside the top five. Do not repeat registration or confuse this with overall seller rank or sales. Paid dispatch still requires 50 legitimate settlements / 3 payers.
- Current buyer checks did not find worthwhile funded work. PayanAgent's latest 50 request rows contained no escrow-marked tasks or >=$25 budgets, and 48 were from one promotional poster. Query-specific funded requests were only $0.04/$0.05. A public sample of 20 receipt rows totaled $0.16 over August 31–September 8; outside provenance was not verified. Do not infer substantial buyer volume from the catalog size.
- Existing hourly `INCOME 2 Earn Watch` was updated, remains enabled, and now follows the new funnel and corrected gates. No duplicate automation. Keep recurring monitoring quiet except for real conversion evidence, outside receipts, qualified funded demand, or material failures.

## Primary mission

Turn **INCOME 2** from a technically functional system with **$0 verified external revenue** into a real autonomous money-making network that gets its **first genuine unrelated buyer**, then a second unrelated buyer, then repeated demand, then scalable recurring/usage revenue.

Do not optimize for the appearance of activity. Optimize for **real outside money earned legally and repeatably with minimal owner labor**.

The execution sequence is:

> distribution → real buyer intent → first paid fulfillment → second unrelated buyer → repeat demand → fee/spread/recurring monetization → scale

Do not create another product subsystem merely because building is easier than distribution. Architecture is already substantial. The bottleneck is buyer discovery, trust, conversion, and marketplace distribution.

## Owner preferences and hard constraints

The owner strongly prefers autonomous, low-touch business models. Do not design a plan around cold calls, networking, sales calls, manual prospect chasing, constant customer service, or labor that scales linearly with revenue. Prefer self-service acquisition, public/machine-native discovery, automated fulfillment, marketplace distribution, product-led growth, API/agent usage, recurring usage, and transaction-led revenue.

Hard rules:

- legal activity only
- no fake identities
- no duplicate marketplace accounts
- no fake demand, fake buyers, fake reviews, fake receipts, fake revenue, or manufactured transaction volume
- no self-paying x402 purchases to simulate traction, build leaderboard volume, or trigger marketplace indexing
- no automated voting or ranking manipulation
- no spam, mass DM, indiscriminate promotion, or rate-limit/safety evasion
- no scraping/harvesting where platform policy forbids it
- never ask the owner to paste passwords, private keys, seed phrases, recovery phrases, 2FA codes, or API secrets into chat
- secrets should be entered directly into the relevant provider/Render environment by the owner when unavoidable
- never use owner working capital for anonymous Outcome Router/HYDRA buyer jobs
- never count owner-funded transactions or unverified ledger events as revenue
- historical general working-capital ceiling was $10; the current owner instruction requires explicit approval before any unavoidable spend or financial commitment. HYDRA buyer jobs get $0 owner subsidy.
- ask the owner only for unavoidable gates: login/2FA, KYC/identity, terms acceptance, account authorization, credential creation, payment/spend authorization, or final publication when the tool cannot perform it

## Brand and product

Brand: **INCOME 2**

Motto: **Your second income. Powered by you or your AI.**

Promise: **Make money yourself — or let your AI earn for you.**

Public surfaces:

1. **Human Earn** — legitimate human-required funded opportunities.
2. **Agent Earn / Auto Make Me** — machine-doable paid work settled to the canonical ledger.
3. **Outcome Router** — desired result + maximum budget → autonomous discovery/fulfillment. HYDRA is only the internal codename.
4. **Purchase Guard** — free, non-custodial x402 max-spend/idempotency/retry safety.

Standalone HYDRA is retired. Do not revive the old standalone HYDRA project.

The long-term concept is larger than a tool shop: a demand marketplace for AI agents where a buyer/agent states the result it needs and maximum budget; the network routes to existing supply, assembles/builds fulfillment when profitable, records unmet demand in abstract form, turns repeat demand into reusable paid capabilities, and eventually earns a transaction fee, spread, or royalty. Think "Google / market maker for agent capabilities," but prove real buyer demand before expanding architecture.

## Revenue truth — never inflate

Verified external INCOME 2 revenue: **$0** as of this handoff.

Confirmed genuine outside Agent Earn settlements: **0**.

Confirmed outside paid Outcome Router fulfillments: **0**.

Human Earn conversions: **0**.

Current HYDRA platform fee: **$0 beta**.

The ledger contains a historical 0.003 USDC row with a 70/30 split, but outside-payer provenance is not independently verified. Do not count it.

A historical 0.01 USDC transaction went to the wrong recipient and is not INCOME 2 revenue.

Owner-funded Coinbase/Base transfers are never revenue. In particular, the owner's 2 USDC transfer into the receiving wallet is working capital / funding, not a customer payment.

Only independently verified third-party money earned for a provided service, bounty, fee, commission, royalty, or funded opportunity counts as revenue.

## Source precedence

When facts conflict, use this order:

1. live production / current Render state
2. latest GitHub `main`
3. current `INCOME2_STATE.md`
4. current provider marketplace/account state
5. current Gmail/provider correspondence
6. this handoff
7. older chats/screenshots/backups

Never let stale prose override live production.

## Repository and deployment

Canonical repository: `Patrickbo19/BidLens-Core`

Default branch: `main`

Known latest production commit at handoff:

- `d820ffb6a49a8a1b1c3cd16e5106c027deec8581`
- message: `Add PayanAgent relay readiness probe`

Core Render workspace: `My Workspace`, workspace ID `tea-daf1c48n74is73ft7drg`.

Core services:

- `earn-router` — `srv-dafgmmvqj5pc73f9eoj0` — public website/router — auto deploy main
- `earn-tools-backend` — `srv-dafhgbuq1p3s73bosl5g` — x402 seller, ledger, Outcome Router, Purchase Guard, TaskBounty bridge, Moltbook aggregate status — auto deploy main
- `earn-agent-worker` — `srv-dafha5e7bikc738jr8pg` — verifier/worker — auto deploy main
- `earn-chat-mcp` — `srv-dafhvbu7bikc738m3s40` — MCP server — auto deploy main

All four were not suspended at the last live check.

Legacy unrelated/retired resources:

- `hydra-agent-seller` is suspended by admin; do not revive
- `hydra-agent-market-clean` is a tombstone/retired standalone HYDRA surface; do not develop it
- `base-morpho-watch` is a separate adjacent experiment on its own branch; never mix its accounting, wallet logic, or code with INCOME 2

## Public website

Public site: `https://earn-router.onrender.com/`

Current public positioning is INCOME 2 as a two-sided earning + fulfillment network:

- Agent Earn
- Human Earn
- Outcome Router
- Purchase Guard
- machine entrypoints / MCP

The public website is not the current engineering bottleneck. Do not spend a Work session redesigning it unless live evidence shows a conversion defect or broken route.

## Seller/x402

Seller origin: `https://earn-tools-backend.onrender.com`

Network: Base mainnet `eip155:8453`

Asset: USDC

Canonical receiving address:

`0x5a9d3c8e3f0634f56966268c19bc5f8355944650`

The seller has **13 paid resources**, currently priced at the floor **$0.001** each. Primary route:

- `POST /web-extract`
- discovery name: **Extract Clean Markdown from Webpage URL**
- price: **0.001 USDC**
- fetches a live public webpage/article and returns clean Markdown plus useful metadata/links
- hardened for SSRF/private/local targets, redirect checks, response caps, timeouts, etc.

Other paid deterministic utilities include seller status, x402 buyer challenge audit, SHA-256/SHA-512, HMAC-SHA256, Base64 encode/decode, JWT decode, hash operations, JSON QA, prompt-injection scan, and URL audit.

Do not add random paid utilities without demand evidence. The current bottleneck is distribution/conversion, not catalog size.

Seller machine metadata includes `/.well-known/x402`, OpenAPI, `/agents.txt`, `/llms.txt`, and `/skill.md`.

## Coinbase CDP / Bazaar / Agentic.Market — current top priority

This is the **highest-value immediate owner gate**.

The seller already declares the standard `@x402/extensions/bazaar` metadata on the paid routes. Code exists to route facilitator `/supported`, `/verify`, and `/settle` traffic through Coinbase CDP when enabled and authenticated.

CDP target:

`https://api.cdp.coinbase.com/platform/v2/x402`

Current production activation flag:

`EARN_CDP_FACILITATOR_ENABLED=true`

The flag was deliberately switched on on 2026-09-09. The subsequent production deployment completed successfully. Live seller logs then showed:

`cdp_facilitator_fallback` with reason `credentials_not_configured`

Therefore the authoritative state at handoff is:

- Bazaar metadata extension: **live**
- 13 paid endpoints metadata-ready: **yes**
- CDP facilitator code-ready: **yes**
- CDP activation flag: **ON**
- `CDP_API_KEY_ID`: **not configured / not available to the model**
- `CDP_API_KEY_SECRET`: **not configured / not available to the model**
- active settlement rail therefore still falls back to PayAI
- Coinbase/Bazaar indexing: **not confirmed**
- Agentic.Market visibility: **not confirmed**
- genuine CDP-facilitated outside settlement: **0**

The owner must create a legitimate Coinbase Developer Platform Secret API key and put the Key ID and Secret **directly into Render** on `earn-tools-backend`; never ask the owner to paste the secret into chat. Once that is done, immediately verify authenticated `/supported`, confirm facilitator status in `/health`, test a no-payment 402 challenge safely, and inspect Bazaar/Agentic.Market discovery. Do not self-pay merely to force indexing.

Current CDP auth implementation uses lightweight `jose` JWT signing rather than the full CDP SDK because the earlier SDK dependency tree introduced npm advisories. Current dependency set was restored to 0 known vulnerabilities after removing the SDK.

## PayanAgent — useful but not enough by itself

A legitimate PayanAgent seller and primary offer are live.

Seller agent ID:

`j5731mg2ydga6s0z9gbk1vt8hs8e3sdr`

Primary offer ID:

`kh7aj3snq4swt9wp7qez45fv718e3mqy`

Offer: **Extract Clean Markdown from Webpage URL**

Last measured marketplace state after launch/metadata enrichment:

- exact search `extract clean markdown from webpage url`: **#1**
- `sort=new`: **#1** at launch
- general `sort=top`: about **#60 of 87** returned offers

Interpret correctly: #1 exact-query relevance does **not** mean #1 seller overall and does not imply meaningful traffic. The marketplace has large supply and thin transaction density. The cold-start reputation tier is driven by genuine settled buyer receipts. Do not self-buy to manufacture a receipt.

The PayanAgent purchase relay has been tested without payment. It correctly returned HTTP 402 / x402 v2 / Base / USDC / canonical receive wallet / 1000 atomic units = $0.001. Payment was not signed and owner funds spent were $0.

PayanAgent is a real distribution channel but has not yet produced an independent buyer.

## 402Index

The INCOME 2 domain/origin was successfully domain-verified on 402Index, covering the registered listings. 402Index indicates verified services receive priority treatment in search. Treat this as a distribution/trust signal only, not revenue.

Do not repeatedly re-register or manipulate rankings.

## Market402 / x402 Arena / x402scan

Market402 previously re-probed Web Extract successfully; the readiness checks passed at the new $0.001 price.

x402 Arena / Market402 / 402Index registrations should remain intentional, not repeated on every deploy.

x402scan previously verified the INCOME 2 origin with:

- origin ID `631b3d50-1a0b-4474-a8aa-e922c1cf6445`
- 19 seller surfaces
- 13 paid
- 6 public/free
- failures 0
- discovery source OpenAPI

Re-check if useful, but do not spend a Work run repeatedly refreshing directories unless there is evidence of a stale index.

## Agent402

Agent402 listing state after the most recent deliberate refresh:

- listed: true
- toolCount: 19
- networks: Base
- routable: true
- health: 1

Discovery was deliberately tuned around literal task-level buyer phrases and price floor. Important primary names include:

- Extract Clean Markdown from Webpage URL
- x402 Payment Challenge Preflight Audit
- x402 Duplicate Payment Retry Guard
- Find and Execute Agent or Tool Under Budget

Agent402 publicly ranks by lexical/task match first, rolling health second, price third. We have improved all three visible inputs, yet the latest verifier still had INCOME 2 absent from the top five for the monitored natural-language buyer queries.

Do not endlessly rewrite metadata without evidence. A maintainer email was sent requesting a crawl/ranking check; no reply was seen by the last inbox check. Re-measure natural ranking after enough time, but prioritize channels with real buyer traffic.

Agent402 leaderboard volume is based on real onchain settlement volume. Do not manufacture it.

## Outcome Router / HYDRA

Public name: Outcome Router. HYDRA is internal only.

Concept:

> desired result + max budget → route → execute safely → return result

Endpoints:

- `GET /outcome-router`
- `POST /outcome-router`
- `GET /outcome-router/{requestId}`
- `POST /outcome-router/execute/{requestId}`

MCP: `request_agent_outcome`

Behavior:

- accepts task/result + max budget + stable idempotency + optional params
- zero-dollar/proof-of-work Agent402 fulfillment first when compatible
- paid beta route uses official Agent402 `POST https://agent402.tools/api/route/execute`
- buyer signs x402 locally
- HYDRA relays payment-required challenge and buyer-created payment signature
- hard budget check
- no buyer private key custody
- no owner working-capital subsidy
- no silent budget escalation
- no automatic higher-tier escalation
- raw tasks/params are not retained in the demand-intelligence layer
- credential-like inputs are blocked from unsafe routing
- if payment may have settled but fulfillment becomes uncertain, do not create a second authorization; reconcile first

Current beta platform fee remains $0. Add monetization only after genuine paid usage proves value.

## Purchase Guard

Free acquisition/trust wedge:

- `GET /purchase-guard`
- `POST /purchase-guard`
- `GET /purchase-guard/{receiptId}`
- MCP `guard_x402_purchase`

It provides max-spend enforcement, stable idempotency, retry safety, and durable receipt state. It never signs/sends/settles/custodies payment and reports `paymentExecuted=false`.

Do not monetize it prematurely unless real usage/WTP evidence appears.

## MCP / ChatGPT integration

MCP endpoint:

`https://earn-chat-mcp.onrender.com/mcp`

Official Registry name:

`io.github.Patrickbo19/income2`

Registry version: `0.3.1`

Six required tools:

1. `get_earning_options`
2. `start_agent_earn`
3. `check_earnings`
4. `find_paid_opportunities`
5. `guard_x402_purchase`
6. `request_agent_outcome`

Public ChatGPT directory launch gate remains BOTH:

1. one genuine outside Agent Earn settlement recorded end-to-end
2. one Human Earn provider approved with real funded inventory

Do not declare directory launch-ready before those gates are met.

## Human Earn

No live funded provider inventory yet.

Known applications/status:

- Lootably: application sent, no approval confirmed
- TapResearch: application sent, no approval confirmed
- ayeT Studios: acknowledgement/reviewing, no approval confirmed
- PayAPI listing/outreach: sent, no useful response confirmed

A fresh relevant-inbox check earlier on 2026-09-09 showed no meaningful approval/rejection/action-required response.

Do not invent provider credentials or accept provider terms automatically.

## TaskBounty

Hunter ID:

`66070003-c3eb-4ccc-80e4-4ead96bf402b`

Latest known state:

- connected: true
- authReady: true
- persistent/configured: true
- openTaskCount: 0

Only wake paid compute for a legitimate, safe, well-scoped candidate with gross >= $25 and expected proceeds materially above compute cost. A submission is not revenue until paid; a paid bounty is not customer Agent Earn revenue until properly attributed.

## Moltbook

Agent name: `Income2`

Claim status: claimed.

Tracked research post ID:

`c5e9a29c-a2f8-4d2a-8115-2c07cc895c49`

Post title:

**Agents: what capability do you repeatedly need — or wish were cheaper?**

Purpose: gather recurring agent-workflow pain and willingness-to-pay signals around price, authentication, latency, retries, reliability, output format, rate limits, and missing capabilities.

Moltbook hard policy constraints:

- official supported API/access patterns only
- no scraping/crawling/broad harvesting
- no retaining/republishing third-party Moltbook posts, profiles, identities, or contact info
- no mass search datasets
- no spam, mass DM, automatic promotional blasts, follow/vote manipulation, duplicate identities, impersonation, or rate-limit/safety evasion
- convert observations into abstracted business intelligence only: problem category, independent-signal count, recurrence, urgency, WTP signal, workaround type, opportunity score
- automated product promotion remains disabled

The current Moltbook agent is primarily a demand-listening post, not a high-volume sales channel. Keep it compliant. If a consent-based normal conversation naturally reveals an exact existing need, respond normally and transparently, but do not turn it into spam outreach.

## Automation

Canonical controller:

- title: `INCOME 2 Earn Watch`
- ID: `6a9f2eb7dccc8191a659939d9b47a0f0`
- cadence: hourly condition watch
- enabled: yes

It watches revenue truth, Outcome Router, seller/x402, Purchase Guard, TaskBounty, MCP, Human Earn/provider inbox, Moltbook aggregate state, marketplaces, PayanAgent, Agent402, Coinbase/CDP and public health.

Do not create duplicate watches unless there is a materially distinct need.

## Current diagnosis

The system is technically overbuilt relative to its revenue. That is not a reason to abandon it; it is a reason to stop hiding in engineering.

Current problem:

> distribution → qualified buyer traffic → trust → payment completion

Not current problem:

> lack of another deterministic utility endpoint

The key unanswered funnel question is whether almost nobody reaches the seller versus buyers hit the 402 challenge but fail to complete payment. Privacy-safe aggregate telemetry may be worth adding if it can distinguish unpaid challenges/payment attempts/settlements without retaining identities or payloads. Do not build a giant analytics subsystem; keep it minimal and decision-useful.

## Highest-value immediate queue

1. **Coinbase CDP owner gate:** after owner creates CDP Secret API Key ID + Secret and stores them directly in Render, verify CDP facilitator and Bazaar/Agentic.Market discovery immediately.
2. **Buyer acquisition:** search machine-native markets and ecosystems for actual current buyer demand matching existing INCOME 2 capabilities. Prefer evidence of transactions, funded requests, active routing, or repeated buyer intent over generic community opinions.
3. **Conversion telemetry:** if current logs cannot distinguish no traffic from payment abandonment, add minimal aggregate counters without retaining payload/user identity.
4. **PayanAgent:** keep the #1 exact-query listing healthy, monitor real receipts, and respond to relevant funded requests if available; no self-buying.
5. **Agent402:** re-measure after crawl time; pursue maintainer response; avoid endless metadata churn.
6. **Human Earn:** monitor provider approvals; activate funded inventory only when legitimately approved.
7. **Build only from demand:** if repeated unmet demand appears and can be fulfilled cheaply/reliably, internalize it as a paid capability. Do not build speculative catalog filler.

## Work-mode operating instructions

A Work/Astra session should behave like an autonomous operator, not a brainstorming assistant.

At the start of every run:

1. Read `INCOME2_STATE.md` and this file from GitHub.
2. Inspect the latest GitHub `main` commits and current source where needed.
3. Inspect all four core Render services/deploy status and recent relevant logs.
4. Check genuine settlement/revenue evidence before claiming progress.
5. Check Coinbase/CDP state first if credentials may have been added.
6. Check the few distribution channels that matter: Coinbase/Bazaar/Agentic.Market, PayanAgent, Agent402, 402Index, Market402/x402scan, MCP Registry.
7. Check TaskBounty/Human Earn/provider messages only for material changes.
8. Use Moltbook only within the compliance boundaries above.

Then execute the single highest expected-value action that can be completed without an owner gate. Prefer actions that materially increase probability of genuine outside revenue. Complete and verify the action instead of stopping at a plan.

Do not burn the Work/Astra allowance on repetitive re-search, giant reports, cosmetic rewrites, or rebuilding context already stored here. Use cheaper/faster models for bulk clerical work if Work allows model switching; reserve Astra for difficult prioritization, browser/computer workflows, marketplace investigation, cross-system debugging, code changes with economic consequences, and high-leverage execution.

If blocked by an owner gate, state exactly one compact gate with:

- what the owner must do
- where
- why it is unavoidable
- what must never be pasted into chat
- what Work will verify/do immediately after completion

Then move to the next independent executable task if one exists.

## Success metrics

Do not call the project successful because of listings, health checks, #1 niche search relevance, deployment count, or code volume.

The milestones are:

- first independently verified unrelated buyer payment
- successful delivery and attributable settlement
- second unrelated buyer
- repeated use of one capability/category
- positive gross margin after infrastructure/payment costs
- evidence a buyer acquisition channel repeats without owner chasing
- then introduce platform fee/spread/recurring pricing
- then scale the capability/channel with the best real economics

## Final directive for Work / Astra

Your job is not to make INCOME 2 look busy. Your job is to make it **earn legitimate outside money**.

Aggressively challenge assumptions. If an existing channel has negligible buyer traffic, say so and move toward a stronger one. If a product has no demand evidence, do not keep polishing it. If a marketplace has real active demand, prioritize getting correctly indexed and trusted there. If the current product is the wrong wedge, use real demand evidence to choose a better wedge while reusing existing infrastructure.

Do not promise profits. Do not fabricate traction. Do not spend owner money without explicit approval. Do not self-buy. Do not break platform rules.

Operate toward the first real buyer, then the second, then repeatability.
