# INCOME 2 — Revenue Experiment Starting Baseline

Observed: September 13, 2026, immediately after the Sol + Astra strategy reconciliation.

This is a measurement baseline, not a revenue claim.

## Commercial baseline

- Established unrelated outside buyer count before this experiment: **1**.
- Established unrelated outside revenue before this experiment: **$0.001**.
- Established successful paid fulfillment count from that buyer: **1**.
- Established repeat-buyer evidence: **none yet**.
- Established personal-agent 70/30 outside settlement: **none yet**.
- Established funded internal marketplace order: **none yet**.

## Main seller distribution baseline

Render startup/registration observation after the experiment documentation deploy:

- origin: `https://earn-tools-backend.onrender.com`
- Agent402 listed: true
- Agent402 tool count: **44**
- Agent402 routable: true
- Agent402 health: **1**
- Market402 seller-status instant check: **11/11 spec-compliant**
- Market402 web-extract instant check: **11/11 spec-compliant**

Astra's review separately observed **19 paid** tools in Agent402, including the five personal-agent routes. Treat paid indexing as observed; do not infer paid dispatch, buyer demand, or revenue from that count.

## Main seller immediate traffic baseline

Post-deploy funnel counters observed before the experiment review window had meaningful time to run:

- `GET /seller-status`: 1 request, 1 unpaid challenge
- `POST /web-extract`: 2 requests, 2 unpaid challenges
- `POST /x402-buyer-check`: 1 request, 1 unpaid challenge
- `POST /prompt-scan`: 1 request, 1 unpaid challenge

These are not sales.

## Public-data seller baseline

After the public-data strategy documentation deploy:

- origin: `https://income2-treasury.onrender.com`
- resource count: **9**
- Agent402 listed: true
- Agent402 tool count: **9**
- Agent402 routable: true
- Agent402 health observed at registration: **0.6**
- all configured source groups reached ready state
- BLS API quota exhaustion triggered the existing fallback, after which `labor-market` still reported ready
- no `income2_public_data_settlement` log was observed in the reviewed Sep 13 window

Primary public-data experiment offer:

`GET /macro-snapshot` at the existing **$0.025** price.

## Core safety baseline

Latest backend startup self-tests after the documentation deploy:

- agent network: **30/30 passed**
- closed-loop wallet: **20/20 passed**
- owner funds spent by tests: **$0**
- fake earnings created: **false**

## Experiment scoreboard from this point forward

Count only:
1. additional unrelated paid buyers
2. successful paid fulfillments
3. later-day repeat buyers
4. useful paid calls
5. variable contribution when available
6. acquisition source when observable

Do not count crawler rankings, unpaid 402 challenges, registration responses, self-tests, owner-funded activity, or unverified ledger rows as revenue.
