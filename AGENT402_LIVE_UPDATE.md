# INCOME 2 — Agent402 Live Update

Last updated: 2026-09-10 04:03 UTC

This file captures the newest verified Agent402 production facts from Mike Petrillo / Agent402.tools and supersedes older assumptions in `INCOME2_STATE.md` and `WORK_ASTRA_HANDOFF.md` wherever they conflict.

## Work verification after deployment

Production commit `c6c729ef9f6aeaa50624a4013ef525abfeb695ec` is live on all four core services. `/url-to-clean-markdown` is now a callable canonical paid route; `/web-extract` remains compatible. Shared validation, payment gating and fulfillment preserve the $0.001 price. Live no-payment checks passed for both, and aggregate funnel telemetry is live. There are 14 paid URLs for 13 capabilities.

One registration refresh initially returned 19 surfaces / 13 paid and the old `fetchedAt=2026-09-10T03:29:33.588Z`. The normal full crawl subsequently updated at **03:59:25.240 UTC**, and the 04:02 read confirmed **20 surfaces / 14 paid URLs** with the new route. Live search results after ingestion:

| Query, with `include=external` | INCOME 2 result |
| --- | --- |
| `extract clean markdown from webpage url` | **#1**, canonical route, score 30 |
| `web extract markdown` | Outside top five |
| `convert url to markdown` | Outside top five |

The exact query improved from outside the top five before deployment. This is not #1 overall seller rank and does not establish traffic or sales.

**Correction to the earlier email:** [current Agent402 source](https://github.com/MikeyPetrillo/Agent402/blob/main/src/x402-index.js) shows that `registerOrigin` on a known healthy origin refreshes existing live price quotes and returns without fetching its manifest. The earlier immediate-full-recrawl statement is incorrect for this code path and conflicts with observed behavior. Full crawling runs on a nominal 30-minute cadence with rotation/budgets. No second registration was needed: the normal crawl consumed the alias. Preserve the new 20-surface / 14-priced baseline and monitor conversion.

Dispatch remains blocked by the legitimate 50-settlement / 3-payer gate. Verified external revenue is still $0; the seventeen unclassified unpaid challenges seen by 04:03 UTC after deployment may be directory probes and had no payment attempts.

## Earlier maintainer crawl / index report

Agent402 checked production directly.

- Origin is being read from `https://earn-tools-backend.onrender.com/.well-known/x402` on the normal cycle.
- Last successful read reported by Agent402: 01:09 UTC on 2026-09-10.
- 19 routes seen.
- 13 priced routes.
- health = 1.
- routable = true.
- network = Base only.
- payTo = `0x5a9d3c8e3f0634f56966268c19bc5f8355944650`.
- There is no separate seed/fresh-read mechanism required.
- The maintainer described `POST https://agent402.tools/api/index/register` as an immediate recrawl (5/hour/IP); the Work/source verification above corrects this: known-origin registration refreshes existing quotes, not the full manifest.

## Critical dispatch gate

Although the origin is crawled and globally marked routable, every INCOME 2 seller row is currently `routerDispatchEligible:false` with reason `settlement_required`.

For Base, Agent402's Smart Order Router will pay a seller on a buyer's behalf only after the `payTo` address named in the seller's live 402 challenge has:

- at least 50 on-chain settlements, and
- at least 3 distinct payers.

Agent402 reports that the INCOME 2 `payTo` currently has 3 inbound USDC transfers from 3 senders since 2026-09-07, so the distinct-payer breadth threshold clears but the settlement-count threshold does not.

This is NOT the same as 3 verified customer sales. Continue to apply INCOME 2 revenue-truth rules: owner funding, tests, mistaken transfers, or otherwise unverified inbound activity are not customer revenue.

The 50-settlement threshold is re-read automatically each cycle. Once it is legitimately crossed, rows should flip to eligible and `executeVia` should appear without a separate manual action.

Do not manufacture settlements, self-buy, split owner funds among wallets, or otherwise game this gate. The requirement must be crossed through genuine independent usage if INCOME 2 is to treat it as meaningful traction.

## Free/unpriced routes

Six routes, including Purchase Guard and Outcome Router family routes, come from OpenAPI only, return 422 rather than 402 to an unpaid call, and are listed as unpriced. Agent402 does not dispatch to these as paid seller routes. This behavior is expected for free routes.

## Exact search ranking facts

Agent402 checked live buyer-style searches and reported:

- `extract clean markdown from webpage url` → INCOME 2 `/web-extract` ranks #6.
- `web extract markdown` → #7.
- `convert url to markdown` → outside top 10.

The current Agent402 lexical scorer weights fields in this order:

1. slug — highest weight
2. name
3. description

Tie-breakers then use:

1. health
2. Bazaar payer count
3. price
4. slug length

The competing rows above INCOME 2 use task-explicit slugs such as `url-to-markdown` and `url_to_clean_markdown` and are priced around $0.005. INCOME 2 is cheaper at $0.001 and healthy, but the slug `web-extract` is lexically weaker.

Agent402 explicitly advised that a slug like `url-to-markdown` or `url-to-clean-markdown`, with matching task words in the name, should score above the current leaders at INCOME 2's present price.

The same pattern affects security utilities: `prompt-scan` ranks behind routes whose slug says `prompt-injection-scan`.

## Highest-value implication

The task-explicit route experiment is implemented. Keep the canonical `/url-to-clean-markdown` and compatible `/web-extract` on the same origin, with one fulfillment implementation and unchanged economics. Full index ingestion and a #1 exact-query result are now verified. Broader searches remain outside the top five and no buyer demand is established. Do not add further aliases or change descriptions without economic evidence.

## Official self-check endpoints supplied by Agent402

Agent402 said the same live verdicts/reasons can be inspected at:

- `https://agent402.tools/api/index?seller=earn-tools-backend.onrender.com`
- `https://agent402.tools/api/route?q=<task>&include=external`

Use these for fresh measurements.

## Work / Astra instruction

A fresh Work/Astra session MUST read this file after `INCOME2_STATE.md` and `WORK_ASTRA_HANDOFF.md`, because it contains a newer Agent402 maintainer response.

Priority after reconciling live state:

1. Preserve the deliberately enabled CDP flag. The credential pair is still incomplete/unavailable; the owner must enter both fields directly in Render, never in chat.
2. Preserve the already-live `/url-to-clean-markdown` canonical route and compatible `/web-extract`; do not reimplement the alias.
3. Preserve the confirmed 20-surface index and #1 exact-query baseline; monitor payment conversion instead of repeating the indexing experiment.
4. Read aggregate funnel data, excluding diagnostic traffic and distinguishing crawlers from evidence of real payment intent.
5. Do not claim paid dispatch eligibility before the legitimate settlement/payer threshold is met. Never self-pay or manufacture volume.

Verified external INCOME 2 revenue remains $0 unless separate independent evidence proves otherwise.
