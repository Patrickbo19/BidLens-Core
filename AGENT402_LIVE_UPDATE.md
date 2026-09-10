# INCOME 2 — Agent402 Live Update

Last updated: 2026-09-10 01:45 UTC / 2026-09-09 21:45 America/New_York

This file captures the newest verified Agent402 production facts from Mike Petrillo / Agent402.tools and supersedes older assumptions in `INCOME2_STATE.md` and `WORK_ASTRA_HANDOFF.md` wherever they conflict.

## Verified crawl / index state

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
- `POST https://agent402.tools/api/index/register` with the origin forces an immediate recrawl and is limited to 5/hour/IP, but routine repeated refresh is unnecessary and should not be spammed.

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

This is new actionable evidence and changes the prior diagnosis.

For Agent402 search, the next legitimate lever is not another description rewrite. It is a task-explicit route slug while preserving backward compatibility. A sensible implementation path is to add a canonical/alias paid route such as `/url-to-markdown` (or `/url-to-clean-markdown`) that uses the exact same safe fulfillment logic and economics as `/web-extract`, keep `/web-extract` working for existing integrations, expose the task-explicit slug in the live x402 manifest/OpenAPI, then perform one intentional recrawl and measure rank.

Do not create duplicate marketplace identities or artificial offers merely for ranking. A compatibility alias on the same real seller/origin is acceptable if it is a genuine callable route for the same product.

## Official self-check endpoints supplied by Agent402

Agent402 said the same live verdicts/reasons can be inspected at:

- `https://agent402.tools/api/index?seller=earn-tools-backend.onrender.com`
- `https://agent402.tools/api/route?q=<task>&include=external`

Use these for fresh measurements.

## Work / Astra instruction

A fresh Work/Astra session MUST read this file after `INCOME2_STATE.md` and `WORK_ASTRA_HANDOFF.md`, because it contains a newer Agent402 maintainer response.

Priority after reconciling live state:

1. Preserve the Coinbase/CDP credential gate work already in progress.
2. Implement a backward-compatible task-explicit Agent402 route slug for Web Extract if not already done, preferably `/url-to-markdown` or `/url-to-clean-markdown`, without duplicating business logic or breaking `/web-extract`.
3. Expose that real route in discovery metadata.
4. Perform one intentional Agent402 recrawl, not a spam loop.
5. Measure the three live searches above plus seller index state.
6. Do not claim Smart Order Router paid dispatch eligibility until the legitimate 50-settlement / 3-payer gate is actually met.
7. Never self-pay or manufacture settlement volume to cross that gate.

Verified external INCOME 2 revenue remains $0 unless separate independent evidence proves otherwise.
