# BidLens Radar — Handsfree Revenue Pivot

**Date:** September 16, 2026
**Branch:** `bidlens-radar-pivot`

## Why this exists

The passive x402 seller experiment proved basic payment/discovery capability but has not produced enough unrelated paid demand to justify remaining the primary business. It stays live as a background experiment while the active commercial effort pivots to a higher-value recurring outcome sold to businesses that already pay for this category.

## New operating thesis

Build a self-service contractor bid-intelligence subscription that continuously finds public contract opportunities, filters them to a contractor's actual capabilities and geography, and turns each likely match into a decision-ready bid/no-bid packet.

Working product name: **BidLens Radar**.

The customer is not paying for raw procurement data. They are paying to avoid portal hunting and wasted estimating time.

## Core customer outcome

A customer supplies a simple company profile:
- trades / services
- service area
- licensing / certification constraints
- preferred project size
- bonding capability
- public-sector preferences / exclusions

BidLens Radar then automatically:
1. ingests open public opportunities from permitted official/public sources;
2. matches opportunities to the company profile;
3. rejects obvious non-fits;
4. produces a concise fit score and bid/no-bid explanation;
5. extracts deadline, buyer, location, estimated scope, mandatory requirements, bonds/certifications, site-visit requirements, submission method, and source links when available;
6. highlights knockout risks and missing information;
7. sends a daily or immediate digest of only qualified opportunities;
8. tracks amendments/deadline changes for watched opportunities.

## Differentiator

Do not compete as another giant bid database.

The differentiator is **qualification and decision compression**:

> "Show me only the work I could realistically pursue, tell me why it fits, tell me what can disqualify me, and link me to the source."

This should be especially useful to small contractors and subcontractors that do not have a full-time estimator/business-development employee.

## Handsfree requirement

Patrick should not need to cold-call, manually hunt bids, prepare daily reports, or broker customers.

The system should aim for:
- self-service signup and company profile;
- automated ingestion;
- automated matching/scoring;
- automated email delivery;
- self-service billing;
- self-service cancellation;
- low-touch exception handling only.

Automated acquisition may use legitimate low-volume public-data-driven outreach, product-led free previews, SEO/programmatic landing pages, referrals, and marketplace listings. No spam, fake accounts, scraped private data, or rule evasion.

## Revenue model — proposal, not yet activated

Market evidence shows comparable bid-alert products charging roughly $39–$59/month for solo/small contractor plans. BidLens Radar should test a self-service recurring price in that neighborhood only after the MVP produces useful matches.

Initial commercial hypothesis:
- free preview: a small number of current matches or one company-profile scan;
- paid: recurring qualified bid feed + decision packets + change tracking;
- target economics: first 5 paid customers should cover basic infrastructure with margin;
- do not buy infrastructure ahead of paid demand.

No pricing change or customer charge is authorized merely by this document.

## Data strategy

Prefer official/public sources with clear access terms. Federal opportunity data can come from SAM.gov/public GSA data services. Expand state/local sources only where access is permitted and automation is reliable.

Do not build a massive crawler first. Start with a narrow source set sufficient to prove that the qualification layer is worth paying for.

## MVP gate

Before production launch, prove all of the following on a representative contractor profile:
1. retrieve live opportunities from at least one official source;
2. correctly eliminate obvious non-fits;
3. produce useful source-linked decision packets;
4. detect deadline/amendment changes when the source exposes them;
5. run end-to-end without owner labor for a daily cycle;
6. show a believable path to positive contribution at a small number of subscribers.

## What is frozen

Do not spend primary effort on:
- more generic x402 endpoints;
- directory rank chasing;
- generalized agent-marketplace architecture;
- new protocol layers;
- broad procurement crawling before qualification quality is proven;
- paid hosting upgrades before revenue justifies them.

## Old INCOME 2 role

Keep the existing x402 seller live on current free infrastructure where practical. Preserve verified buyer/revenue evidence. Do not represent it as a meaningful revenue engine unless new paid behavior proves otherwise.

## Immediate build sequence

1. Inventory reusable BidLens screening/scoring code in the repository.
2. Add one official opportunity-source adapter.
3. Define contractor profile schema.
4. Build deterministic first-pass knockout filters.
5. Build source-linked bid/no-bid packet output.
6. Add a daily digest job in test mode.
7. Test against real open opportunities without contacting buyers or spending money.
8. Only after quality is acceptable, add self-service acquisition/billing surfaces.

## Success test

This pivot is successful only when unrelated businesses pay recurring money for the automated output and owner time remains low.

The target is not "launch a SaaS." The target is a small recurring machine that can pay its own infrastructure bill and then compound.
