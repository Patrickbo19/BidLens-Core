# INCOME 2 Public Data — Live Update

Updated: 2026-09-13 02:20 UTC

## Revenue truth

Verified unrelated outside revenue remains **$0** until independently proven otherwise. Never count owner-funded transfers, test transactions, directory probes, unpaid 402 challenges, or unverified ledger rows as revenue.

## What is live

Production origin: `https://income2-treasury.onrender.com`

The Treasury-only transaction-backed demand experiment has been expanded into a **9-route public-data seller** after researching categories with independent paid x402 activity on Agentic Market.

Live routes and prices:

1. `GET /treasury-yield-curve` — **$0.005**
2. `GET /national-debt` — **$0.005**
3. `GET /treasury-average-rates` — **$0.005**
4. `GET /us-weather` — **$0.002**
5. `GET /federal-awards` — **$0.01**
6. `GET /clinical-trials` — **$0.01**
7. `GET /sec-company-facts` — **$0.01**
8. `GET /labor-market` — **$0.01**
9. `GET /macro-snapshot` — **$0.025**

Official/public upstream sources:
- U.S. Treasury / FiscalData
- National Weather Service
- USAspending.gov
- ClinicalTrials.gov
- SEC EDGAR APIs
- Bureau of Labor Statistics

Latest stable public-data deploy:
- Render service: `income2-treasury`
- service ID: `srv-dair26gae00c73fkhai0`
- branch: `income2-treasury`
- application commit: `f520f77ae678d69c3b896b7c6e49137888addd5a`
- transport-hardening commit: `6ee0785f66f66b9f209524c3fdb7c86d4dc046e9`
- status: **live**

Startup verification after the hardening deploy passed for **all eight independent upstream source groups**:
- treasury-yield-curve: healthy, latest record `2026-09-11`
- national-debt: healthy, latest record `2026-09-10`
- treasury-average-rates: healthy, latest record `2026-08-31`
- us-weather: healthy
- federal-awards: healthy
- clinical-trials: healthy
- sec-company-facts: healthy
- labor-market: healthy

The service keeps privacy-safe per-route aggregate request/payment-header/settlement counts and logs `income2_public_data_settlement` on a successful settlement.

## Why these routes were selected

Fresh Agentic Market evidence showed real paid demand in closely related categories, including:
- generic weather: **114 calls / 44 payers** in the prior 30 days on one seller
- U.S. national debt: **6 calls / 5 payers**
- GDP: **5 calls / 5 payers**
- FOMC calendar: **4 calls / 3 payers**
- money supply: **4 calls / 3 payers**
- Treasury average rates: **2 calls / 2 payers**
- clinical trials: **1 call / 1 payer**
- federal awards: **1 call / 1 payer**
- multiple SEC/regulatory/public-data endpoints with independent payers

This does **not** prove those buyers will use INCOME 2. It is independent evidence that wallet-enabled agents are already paying for these categories, which is materially stronger than adding generic tools from intuition.

## Agent402 state

The origin is listed, routable, and detected on Base. The immediate registration response still reports the older one-tool snapshot because Agent402 is known to refresh existing healthy origins without always doing an immediate full manifest crawl. Do not spam recrawl. Allow the normal crawl to ingest the 9-route manifest and verify the expanded tool count later.

## Operating rule

INCOME 2 should behave as a demand-following seller, not a static catalog.

- Preserve working routes.
- Measure genuine route-specific payment headers and independent settlements.
- Never self-buy or manufacture transaction history.
- Keep researching categories where independent x402 buyers are already paying.
- Add a route only when buyer evidence is real, upstream rights permit use, marginal cost is near zero, pricing has positive margin, and owner labor stays near zero.
- Prefer bundles and adjacent products after a category shows repeat demand.
- Hold/kill weak routes after a reasonable exposure window rather than growing a vanity catalog.
- First real buyer is validation, not scale. Repeat buyers and higher-value pricing are the target.

## Immediate objective

1. Let Agent402 ingest the full 9-route manifest through normal crawling.
2. Watch route-specific requests and payment headers.
3. Verify the first genuine unrelated settlement independently.
4. Identify which category generated it.
5. Expand that category deliberately and test pricing/packaging.
6. Continue transaction-backed discovery until a repeatable buyer cohort appears.
7. Do not call the project finished until genuine external revenue is repeatable.
