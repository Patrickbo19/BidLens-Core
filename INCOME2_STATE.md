# INCOME 2 — Canonical State

Last reconciled: 2026-09-09 23:15 America/New_York

This is the canonical **non-secret** operating state for INCOME 2. Reconcile against live GitHub `main`, Render production, current marketplace/provider state, Gmail, and verified settlement evidence before material decisions. Never store API keys, private keys, seed phrases, passwords, 2FA codes, recovery credentials, solver keys, or payment signatures here.

## Mission

**Brand:** INCOME 2  
**Motto:** Your second income. Powered by you or your AI.  
**Promise:** Make money yourself — or let your AI earn for you.

Surfaces:

- **Human Earn** — legitimate human-required funded opportunities.
- **Agent Earn / Auto Make Me** — machine-doable paid work.
- **Outcome Router** — desired result + max budget → autonomous discovery/fulfillment.
- **Purchase Guard** — free non-custodial x402 max-spend/idempotency/retry safety.

HYDRA is only the internal codename for the Outcome Router. Standalone HYDRA is retired.

Primary objective: **maximum legitimate autonomous revenue with minimal owner labor**.

Execution sequence:

> distribution → real buyer intent → first paid fulfillment → second unrelated buyer → repeat demand → fee/spread/recurring monetization → scale

Do not self-pay, fake demand/revenue, manipulate rankings, spam directories, create duplicate identities, or use owner working capital to manufacture traction.

## Revenue truth

Only independently verified real third-party money earned by INCOME 2 counts as revenue.

Current verified state:

- verified external INCOME 2 revenue: **$0**
- genuine outside Agent Earn settlements: **0 confirmed**
- outside paid Outcome Router fulfillments: **0 confirmed**
- Human Earn conversions: **0**
- Outcome Router platform fee: **$0 beta**

The canonical ledger contains one historical 0.003 USDC row with a 70/30 split, but outside-payer provenance is not independently verified; do **not** count it as revenue.

Historical 0.01 USDC to the wrong recipient is not INCOME 2 revenue. Owner-funded Coinbase/Base transfers, including the owner's 2 USDC transfer into the receive wallet, are funding/working capital and never revenue.

Do not count listings, registrations, #1 search relevance, self-tests, canaries, registry publication, free calls, quotes, proof-of-work calls, buyer-to-supplier routing volume, or unverified ledger rows as revenue.

## Source precedence

When facts conflict:

1. live Render / production behavior
2. latest GitHub `main`
3. this file
4. current marketplace/provider/account state
5. current Gmail/provider correspondence
6. `WORK_ASTRA_HANDOFF.md`
7. older chats/screenshots/backups

## Repository / production

Repository: `Patrickbo19/BidLens-Core`  
Branch: `main`

Latest known commit after this reconciliation will be the state/handoff updates; immediately before them production was running:

- `d820ffb6a49a8a1b1c3cd16e5106c027deec8581`
- `Add PayanAgent relay readiness probe`

Core Render workspace: `tea-daf1c48n74is73ft7drg`.

Core services:

- `earn-router` — `srv-dafgmmvqj5pc73f9eoj0`
- `earn-tools-backend` — `srv-dafhgbuq1p3s73bosl5g`
- `earn-agent-worker` — `srv-dafha5e7bikc738jr8pg`
- `earn-chat-mcp` — `srv-dafhvbu7bikc738m3s40`

All four were verified not suspended at the latest service check.

Legacy:

- `hydra-agent-seller` suspended; do not revive
- `hydra-agent-market-clean` tombstone only
- `base-morpho-watch` is a separate experiment/branch; never mix its accounting or wallet logic with INCOME 2

## Paid x402 seller

Origin: `https://earn-tools-backend.onrender.com`  
Network: Base mainnet `eip155:8453`  
Asset: USDC  
Receive: `0x5a9d3c8e3f0634f56966268c19bc5f8355944650`

Seller has **13 paid resources**, currently **$0.001 each**.

Primary route:

- `POST /web-extract`
- discovery name: **Extract Clean Markdown from Webpage URL**
- price: **0.001 USDC**
- live public webpage/article → clean Markdown + title/description/author/canonical/link metadata
- hardened against private/local targets, unsafe redirects, oversized responses, and timeouts

Other paid deterministic utilities include seller status, x402 buyer challenge audit, SHA-256/SHA-512, HMAC-SHA256, Base64 encode/decode, JWT decode, hash operations, JSON QA, prompt injection scan, and URL audit.

Do not add random paid utilities without demand evidence. Distribution/conversion is the bottleneck.

Machine surfaces include `/.well-known/x402`, `/.well-known/x402.json`, `/openapi.json`, `/agents.txt`, `/llms.txt`, and `/skill.md`.

## Coinbase CDP Bazaar / Agentic.Market — active top priority

The seller already declares the standard `@x402/extensions/bazaar` discovery metadata on paid routes.

Optional CDP facilitator target:

`https://api.cdp.coinbase.com/platform/v2/x402`

Production flag is now:

`EARN_CDP_FACILITATOR_ENABLED=true`

The flag was enabled on 2026-09-09 and the resulting Render deploy finished **live**. The seller then logged:

`cdp_facilitator_fallback` → `credentials_not_configured`

Authoritative Coinbase state:

- Bazaar extension declared: **yes**
- 13 paid routes metadata-ready: **yes**
- CDP facilitator code-ready: **yes**
- CDP activation flag: **ON**
- `CDP_API_KEY_ID`: **not configured / unavailable to model**
- `CDP_API_KEY_SECRET`: **not configured / unavailable to model**
- active behavior therefore falls back to PayAI
- genuine CDP-facilitated settlement: **0 confirmed**
- Bazaar indexing: **not confirmed**
- Agentic.Market visibility: **not confirmed**

Owner gate: create a legitimate Coinbase Developer Platform Secret API key and put Key ID + Secret directly into Render for `earn-tools-backend`. Never paste the secret into chat. Once configured, immediately verify authenticated `/supported`, seller health/facilitator state, safe no-payment 402 behavior, Bazaar discovery, and Agentic.Market visibility.

Do **not** self-pay to trigger indexing.

CDP auth uses lightweight `jose` JWT signing. The full CDP SDK was removed after dependency advisories; current package set was restored to 0 known npm vulnerabilities at that point.

## PayanAgent

Live seller agent:

`j5731mg2ydga6s0z9gbk1vt8hs8e3sdr`

Primary offer:

`kh7aj3snq4swt9wp7qez45fv718e3mqy`

Offer: **Extract Clean Markdown from Webpage URL**.

Last measured state after listing/metadata enrichment:

- exact query `extract clean markdown from webpage url`: **#1**
- `sort=new`: **#1 at launch**
- general `sort=top`: about **#60 of 87** returned offers

Interpretation: #1 exact-query relevance is **not** #1 overall seller rank and does not prove meaningful buyer traffic.

PayanAgent purchase relay was verified without payment:

- HTTP 402
- x402 v2
- Base
- USDC
- correct INCOME 2 receive wallet
- amount = 1000 atomic units = $0.001
- payment signed: false
- owner funds spent: $0

No independent buyer/receipt has been confirmed. Do not self-buy to manufacture reputation.

## 402Index / Market402 / x402scan / x402 Arena

402Index domain/origin verification was successfully completed for the INCOME 2 seller listings. Treat verification/priority search as a trust/distribution signal, not revenue.

Market402 re-probing previously passed the seller/Web Extract checks at $0.001.

x402scan previously verified:

- origin ID `631b3d50-1a0b-4474-a8aa-e922c1cf6445`
- 19 seller surfaces
- 13 paid
- 6 public/free
- failures 0
- source OpenAPI

Directory re-registration on deploy must remain disabled. Refresh intentionally only when evidence warrants it.

## Agent402

Latest deliberate refresh result:

- listed: true
- toolCount: 19
- routable: true
- health: 1
- Base network recognized

Task-level discovery names include:

- Extract Clean Markdown from Webpage URL
- x402 Payment Challenge Preflight Audit
- x402 Duplicate Payment Retry Guard
- Find and Execute Agent or Tool Under Budget

Agent402 ranking inputs publicly described/observed: lexical/task match first, rolling health second, price third. INCOME 2 now has literal task language, health 1, and $0.001 floor pricing, yet the last verifier still showed INCOME 2 absent from top five across monitored buyer queries.

Do not endlessly rewrite metadata. Re-measure after crawl time and pursue maintainer response, but prioritize channels with real demand.

A maintainer email was sent; no meaningful reply was seen at the last relevant inbox check.

## Outcome Router / HYDRA

Definition:

> desired result + maximum budget → autonomous route → safe execution → result

Endpoints:

- `GET /outcome-router`
- `POST /outcome-router`
- `GET /outcome-router/{requestId}`
- `POST /outcome-router/execute/{requestId}`

MCP: `request_agent_outcome`.

Rules:

- no manual brokerage
- zero-dollar/proof-of-work compatible route first
- paid beta route uses official Agent402 `POST https://agent402.tools/api/route/execute`
- buyer wallet signs x402 locally
- HYDRA relays payment-required and buyer-created payment signature
- hard max budget
- no private-key custody
- no owner working-capital subsidy
- no silent budget escalation
- no automatic higher-tier escalation
- raw task/params not retained in demand intelligence
- credential-like unsafe input blocked
- if settlement may have occurred but fulfillment is unresolved, reconcile before any fresh authorization

Latest no-owner-spend self-test after earlier payment-rail work passed with an Agent402 x402 challenge and no signature/owner spend.

Platform fee remains $0 until genuine paid usage proves value.

## Purchase Guard

Free non-custodial x402 safety wedge:

- `GET /purchase-guard`
- `POST /purchase-guard`
- `GET /purchase-guard/{receiptId}`
- MCP `guard_x402_purchase`

Provides max-spend enforcement, stable idempotency, retry safety and durable receipt state. It never signs, sends, settles, or custodies payment; `paymentExecuted=false`.

## MCP

Endpoint: `https://earn-chat-mcp.onrender.com/mcp`  
Registry name: `io.github.Patrickbo19/income2`  
Registry version: `0.3.1`

Required six tools:

1. `get_earning_options`
2. `start_agent_earn`
3. `check_earnings`
4. `find_paid_opportunities`
5. `guard_x402_purchase`
6. `request_agent_outcome`

Public ChatGPT directory gate remains BOTH:

1. one genuine outside Agent Earn settlement recorded end-to-end
2. one Human Earn provider approved with real funded inventory

Do not call directory-ready before both are met.

## Human Earn

Funded provider inventory is still not live.

Known state:

- Lootably — applied; no approval confirmed
- TapResearch — applied; no approval confirmed
- ayeT Studios — acknowledged/reviewing; no approval confirmed
- PayAPI outreach/listing request — no useful response confirmed

Do not invent credentials, accept provider terms automatically, or count applications as revenue.

## TaskBounty

Hunter ID: `66070003-c3eb-4ccc-80e4-4ead96bf402b`

Latest known state:

- connected: true
- authReady: true
- persistent/configured: true
- openTaskCount: **0**

Only wake paid compute for safe, well-scoped gross >= $25 work with expected proceeds materially above compute cost.

## Moltbook

Agent `Income2` remains claimed.

Tracked research post ID:

`c5e9a29c-a2f8-4d2a-8115-2c07cc895c49`

Title:

**Agents: what capability do you repeatedly need — or wish were cheaper?**

Purpose: demand intelligence around recurring workflow pain, price, authentication, latency, retries, reliability, output format, rate limits, and missing capabilities.

Hard constraints:

- official supported access only
- no scraping/crawling/harvesting
- no retaining/republishing third-party posts, profiles, identities, contact data
- no mass-search dataset
- no spam/mass DM/auto promo/follow/vote manipulation
- no impersonation/duplicate identities/rate-limit evasion
- preserve only abstracted derived intelligence such as problem category, independent-signal count, recurrence, urgency, WTP signal, workaround type, opportunity score

Automated product promotion remains disabled. Moltbook is primarily a compliant listening post, not currently proven as a sales channel.

## Automation

Canonical controller:

- `INCOME 2 Earn Watch`
- ID `6a9f2eb7dccc8191a659939d9b47a0f0`
- enabled
- hourly condition watch

It monitors revenue truth, HYDRA/Outcome Router, marketplaces, Coinbase/CDP, PayanAgent, seller/x402, Purchase Guard, TaskBounty, six-tool MCP health, Human Earn/provider inbox, Moltbook aggregate state and public health.

Do not create duplicate watches unless materially distinct.

## Current diagnosis

Architecture is substantially built. **The main bottleneck is distribution → qualified buyer traffic → trust → payment completion.**

The phrase “#1” on PayanAgent referred to exact-query relevance, not the overall seller leaderboard. That does not imply high traffic. The system may currently have a traffic problem rather than a pricing/product defect.

A useful unresolved measurement is whether almost nobody reaches the seller versus buyers reach the 402 challenge but abandon payment. Minimal privacy-safe aggregate funnel telemetry may be justified if existing logs cannot distinguish those cases. Do not build a large analytics subsystem.

## Highest-value queue

1. Clear Coinbase CDP credential owner gate; immediately verify Bazaar/Agentic.Market activation.
2. Seek real machine-native buyer demand matching existing capabilities; prioritize transaction/funded-request evidence over generic opinions.
3. Add only minimal conversion telemetry if needed to distinguish no traffic from payment abandonment.
4. Keep PayanAgent exact-query listing healthy; monitor genuine receipts and relevant funded requests; no self-buying.
5. Re-measure Agent402 after crawl time; avoid metadata churn without evidence.
6. Monitor Human Earn provider approvals.
7. Build new owned capabilities only from repeated evidenced unmet demand.

## Work/Astra handoff

A fresh Work/GPT-6 Astra session should first read:

- `INCOME2_STATE.md`
- `WORK_ASTRA_HANDOFF.md`

Then reconcile against live GitHub, Render, marketplace state, Gmail and settlement evidence.

The Work session should operate as an execution agent, not a brainstorming assistant. Reserve expensive Astra reasoning for high-leverage investigation, browser/computer workflows, marketplace/distribution decisions, cross-system debugging, and code/economic decisions. Avoid burning allowance on repetitive status reports, cosmetic rewrites, or rediscovering context already captured here.

## Continuity rule

Never let stale chat context override verified live state. The next operator should resume from the highest-value executable action, stop only at a genuine owner gate, and measure success by **real unrelated outside buyers and repeatable revenue**, not code volume or listing count.
