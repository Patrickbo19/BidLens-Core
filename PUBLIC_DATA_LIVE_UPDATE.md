# INCOME 2 Public Data — Live Update

Updated: 2026-09-13 after Sol + Astra strategy review

## Revenue truth

INCOME 2 has one verified unrelated outside buyer from the separate private seller path: **$0.001**, with successful fulfillment recorded in the canonical audit.

This public-data service itself still has **0 established settlements** in the latest reviewed state.

Never count owner-funded transfers, test transactions, directory probes, unpaid 402 challenges, or unverified ledger rows as revenue.

## What is live

Production origin:

`https://income2-treasury.onrender.com`

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

Official/public upstream sources include U.S. Treasury/FiscalData, National Weather Service, USAspending.gov, ClinicalTrials.gov, SEC EDGAR APIs, and Bureau of Labor Statistics.

The service maintains privacy-safe per-route aggregate request/payment-header/settlement counters and settlement logs.

## Current commercial decision

For the next bounded revenue test, **`/macro-snapshot` is the primary public-data offer**.

Reason:
- already deployed
- higher-value bundle than single commodity transforms
- recurring official/public source updates
- plausible later-day repeat use by briefing/research/reporting agents
- low owner labor once running

The other eight routes remain available, but do not expand the catalog during this test merely to increase route count.

## Experiment success criteria

Primary scoreboard:
- additional unrelated paid buyers
- successful paid fulfillments
- later-day repeat buyers
- useful paid calls
- positive measured variable contribution
- acquisition source when observable

Do not use crawler rank, manifest size, unpaid challenges, or probe traffic as the commercial success metric.

## External demand evidence behind this catalog

Prior category research found independent paid x402 activity in related categories such as weather, U.S. debt, GDP/macro, Treasury rates, clinical trials, federal awards, and SEC/regulatory data.

That evidence supports testing these categories. It does **not** prove INCOME 2 will capture those buyers.

## Operating rule

INCOME 2 should behave as a demand-following seller, not a vanity catalog.

- Preserve working routes.
- Never self-buy or manufacture transaction history.
- Prefer repeated paid use over route count.
- Add or bundle adjacent products only after real buyer evidence.
- Hold or retire weak routes after a bounded exposure window.
- Treat buyer #1 as validation, not scale.

## Immediate objective

1. Test `/macro-snapshot` as the primary public-data offer.
2. Measure real paid buyers and later-day repeats.
3. Compare its behavior with the existing extraction benchmark on the main seller.
4. Do not build new public-data products until the current test produces evidence.
5. If recurring research demand appears, consider a higher-value source-backed change packet as the next gated experiment.
6. Do not call the public-data line successful until unrelated paid demand repeats.
