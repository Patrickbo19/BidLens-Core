# INCOME 2 — Canonical State

Last reconciled: 2026-09-10 11:26 UTC

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

All four core services were verified **live** on production code commit:

- `c6c729ef9f6aeaa50624a4013ef525abfeb695ec`
- `Expose canonical URL-to-clean-Markdown route and aggregate payment funnel`

Documentation-only reconciliation commits may be newer on main and use `[skip render]`.

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

Seller has **13 paid capabilities across 14 paid URLs**, currently **$0.001 per call**. The extra URL is a compatibility alias, not a new product.

Primary route:

- `POST /url-to-clean-markdown` — canonical; `POST /web-extract` remains compatible
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
- 14 paid URLs metadata-ready: **yes**, representing 13 capabilities
- CDP facilitator code-ready: **yes**
- CDP activation flag: **ON**
- CDP credential pair ready: **false**, verified through production behavior without viewing values
- This boolean proves the pair is incomplete/unavailable; it does not identify which individual field is missing.
- active behavior therefore falls back to PayAI
- genuine CDP-facilitated settlement: **0 confirmed**
- Bazaar indexing: **not confirmed**
- Agentic.Market visibility: **not confirmed**

Owner gate: create a legitimate Coinbase Developer Platform Secret API key and put Key ID + Secret directly into Render for `earn-tools-backend`. Never paste the secret into chat. Once configured, immediately verify authenticated `/supported`, seller health/facilitator state, safe no-payment 402 behavior, Bazaar discovery, and Agentic.Market visibility.

Do **not** self-pay to trigger indexing.

Current [Coinbase seller documentation](https://docs.cdp.coinbase.com/x402/seller/get-discovered) says indexing requires a successful CDP-facilitated settled payment. Credentials and validation alone do not guarantee listing. The public `/validate` endpoint can check readiness without paying. Work requests to CDP validation, merchant discovery and search timed out; Agentic.Market returned HTTP 403. Visibility remains **unconfirmed**, not proven absent. Recheck from an authorized working connection after the credential gate clears.

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

Current read: exact discovery query is #1 among 50 returned offers; offer `paidAttempts=0`; seller `receiptsSold=0`, `totalEarnedMicroUsd=0`. No independent buyer/receipt has been confirmed. Do not self-buy to manufacture reputation.

Demand check: newest 50 requests had no escrow-marked work and no budget >= $25; 48 came from one promotional poster. Query-specific discovery surfaced tiny escrow-marked requests at $0.04 and $0.05, too small to justify custom work. The latest 20 public receipt rows sampled totaled $0.16, dated August 31–September 8, with 13 marked delivered. These are platform-reported sample figures, not independently verified outside revenue or a whole-market total. Current evidence does not justify more catalog building.

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

Read `AGENT402_LIVE_UPDATE.md` for the maintainer response and subsequent source verification.

- Latest live index: **20 surfaces, 14 priced URLs**, health 1, routable true, Base recognized.
- Latest observed `fetchedAt`: **2026-09-10T03:59:25.240Z**. The full crawler has now ingested `/url-to-clean-markdown`.
- Production now serves `/url-to-clean-markdown` and the compatible `/web-extract`, using one fulfillment implementation and the same $0.001 price. Both passed no-payment 402 checks on Base USDC with the canonical receive address, Bazaar metadata and `cache-control: no-store`.
- One intentional registration refresh initially returned the old 19-surface catalog. After the normal full crawl, the exact query `extract clean markdown from webpage url` improved from outside the top five to **#1 among external results** (score 30). `web extract markdown` and `convert url to markdown` still excluded INCOME 2 from the top five. This is search visibility, not overall seller rank, qualified traffic, a purchase or revenue.
- Critical correction: current [Agent402 source](https://github.com/MikeyPetrillo/Agent402/blob/main/src/x402-index.js), `registerOrigin`, refreshes live quotes for a known origin's existing routes; it does **not** reread its manifest. This explains the unchanged index and contradicts the earlier email's immediate-recrawl claim. Full crawling has a nominal 30-minute cadence with budgets/rotation. Do not repeat registration to discover the new alias. The normal crawl subsequently consumed the route; no further registration was needed.
- Full ingestion is confirmed: 20 surfaces / 14 paid URLs, still only 13 paid capabilities.
- All paid rows remain `routerDispatchEligible:false`, reason `settlement_required`. Base paid dispatch requires at least **50 legitimate settlements and 3 distinct payers**. Never manufacture the threshold or equate inbound transfers with customer revenue.

Monitored queries: `extract clean markdown from webpage url`, `web extract markdown`, `convert url to markdown`, using `/api/route?q=...&include=external`.

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

Minimal aggregate funnel telemetry is now live in `seller-funnel.cjs`, exposed as `/health.funnel` and nonempty `seller_funnel` interval logs about once per minute. It records fixed paid route, traffic class, event and count only; no customer payloads, submitted URLs, payment proofs, wallets, IPs or identities. Events: request_received, payment_header_present, payment_attempt_observed, payment_verified, settlement_success, fulfillment_success, paid_request_failed, unpaid_challenge.

Counters are per request, **not unique buyers or verified revenue**. Health totals cover only the current process, identified by `since`; Render logs contain interval deltas. Do not add cumulative snapshots to those deltas. Pending counters can be lost on abrupt termination. Diagnostic classification is self-declared by `User-Agent: INCOME2-Operator-Audit/1.0`, not authenticated attribution. Unclassified requests include crawlers and unmarked tests.

Observation since `2026-09-10T03:52:05.932Z`: two diagnostic unpaid challenges; **401 unclassified unpaid challenges as of 11:23 UTC**, about 7.5 hours after deployment; **zero payment headers, decoded payment attempts, verifications, settlements or fulfilled paid requests**. The first seventeen unclassified challenges had appeared by 04:03 UTC. These requests include unknown amounts of directory/probe traffic; they do not establish qualified buyer demand or a buyer abandonment rate.

Local integration testing used blocked external networking, mocked facilitator responses and an in-memory ledger. Both aliases were checked through success, settlement failure and private-target rejection; telemetry privacy and diagnostic separation passed. Production checks signed no payment and spent $0. The existing hourly watch was updated with these measurements and the corrected CDP/Agent402 logic; no duplicate watch was created.

The 11:23–11:26 follow-up confirmed all four deployments still live on `c6c729e`, CDP enabled with credential readiness false, unchanged historical ledger, and TaskBounty openTaskCount 0 (provider verified at 11:11 UTC). No new matching provider/Agent402 email was found since 04:00 UTC. The existing watch is enabled and last ran at 11:11:59 UTC.

A bounded extra buyer-channel check did not justify new work. [ClawTasks](https://clawtasks.com) currently announces free-task-only operation. The [$50 changelog bounty](https://github.com/claude-builders-bounty/claude-builders-bounty/issues/1) is open but already has 2,119 comments, no reply from its issuing account or an identifiable payment bot in that thread, and its repository was last pushed March 27. Funding and payout were not established. Do not spend compute joining that submission backlog or paid-star/review/token-promotion tasks. This is a channel-specific rejection, not proof that all agent commerce lacks buyers.

A documentation-only commit accidentally omitted application files from its Git tree. The complete application tree was restored in `b9be2ff9e8ca4e9d520fcaeee9b2a5f9f5b5ef97`; comparison to the deployed code confirmed only the three intended handoff documents changed. Both commits used `[skip render]`, and all four production deployments remained unchanged. Verify complete tree diffs before future Git ref updates.

## Highest-value queue

1. Clear Coinbase CDP credential owner gate; verify authenticated supported networks, actual CDP routing and the official validator, then inspect Bazaar/Agentic.Market. A genuine CDP-settled buyer payment is still required for indexing; do not self-pay.
2. Seek real machine-native buyer demand matching existing capabilities; prioritize transaction/funded-request evidence over generic opinions.
3. Read the existing aggregate funnel over a meaningful observation window; do not build more analytics or treat directory challenges as buyer demand.
4. Keep PayanAgent exact-query listing healthy; monitor genuine receipts and relevant funded requests; no self-buying.
5. Preserve the now-indexed canonical alias and #1 exact-query baseline; monitor conversion. Do not repeat registration or chase further keyword tweaks without economic evidence.
6. Monitor Human Earn provider approvals.
7. Build new owned capabilities only from repeated evidenced unmet demand.

## Work/Astra handoff

A fresh Work/GPT-6 Astra session should first read:

- `INCOME2_STATE.md`
- `WORK_ASTRA_HANDOFF.md`
- `AGENT402_LIVE_UPDATE.md`

Then reconcile against live GitHub, Render, marketplace state, Gmail and settlement evidence.

The Work session should operate as an execution agent, not a brainstorming assistant. Reserve expensive Astra reasoning for high-leverage investigation, browser/computer workflows, marketplace/distribution decisions, cross-system debugging, and code/economic decisions. Avoid burning allowance on repetitive status reports, cosmetic rewrites, or rediscovering context already captured here.

## Continuity rule

Never let stale chat context override verified live state. The next operator should resume from the highest-value executable action, stop only at a genuine owner gate, and measure success by **real unrelated outside buyers and repeatable revenue**, not code volume or listing count.
