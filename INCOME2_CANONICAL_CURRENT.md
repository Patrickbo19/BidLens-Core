# INCOME 2 — CANONICAL CURRENT OPERATING HANDOFF

**Updated:** September 19, 2026  
**Repository:** `Patrickbo19/BidLens-Core`

This file is the current operating truth. Dated audits and experiments remain evidence/history; where they conflict with this file, this file wins.

## Active writer designation

Patrick designated the current ChatGPT conversation as the sole active INCOME 2 writer. Until Patrick changes that designation, other sessions should remain read-only and must not write production or GitHub `main` for INCOME 2.

## Primary strategic direction — Agent Profit Exchange

The primary new strategic build is now **Agent Profit Exchange (APX)**.

The key control chain is:

> human owner -> primary AI orchestrator -> worker agent -> APX -> funded source rail -> verified result / payout

The product assumption is that a human often does not manually choose an earning marketplace. The human tells a general AI to make money; that AI creates or assigns specialized worker agents. APX is the machine-native economic layer those workers can call under bounded delegated authority.

APX is not another standalone consumer bot. Its target is the orchestrator/worker-agent layer.

Current APX production origin:

`https://agent-profit-exchange.onrender.com`

Current implementation branch:

`agent-profit-exchange`

Preferred free routing call:

`POST /v1/make-money`

A parent/orchestrator can pass:
- parent/child lineage;
- worker capabilities;
- maximum delegated spend;
- maximum delegated loss;
- minimum payout;
- optional time-to-payment constraint;
- expiry;
- allowed action classes.

APX returns normalized opportunities, reject reasons, economics, evidence tier, recommended worker specialization, source rail, and a compact parent handoff.

## APX monetization

APX now has a real machine-payable surface:

`POST /v1/execution-packet`

Current price:

**$0.01 USDC**

Network:

**Base mainnet / USDC**

The execution-packet route performs a fresh source scan/revalidation and returns a source-linked execution packet for the selected opportunity.

Current APX x402 receipts settle to the existing EARN receive wallet configured in production. The bounded EARN spend wallet is separate and must not be confused with the receive wallet or with revenue.

Future preferred monetization order:
1. machine-paid execution/routing packets;
2. success/routing fees on completed outside work where source terms permit;
3. legitimate buyer/supplier spread where terms permit;
4. recurring APX API access;
5. fees on reusable capabilities created from repeated successful fulfillment.

Do not create fake volume, self-buy, wash activity, or owner-funded sales to manufacture traction.

## APX machine discovery

Current APX discovery surfaces include:
- `/.well-known/apx.json`
- `/.well-known/agent-card.json`
- `/.well-known/agent.json`
- `/v1/protocol`
- `/openapi.json`
- `/agents.txt`
- `/.well-known/x402`
- `/.well-known/x402.json`
- `/mcp`
- `/a2a/v1/message:send`

APX should expose the same economic semantics through REST, MCP, A2A and x402 rather than maintaining separate product logic for each protocol.

## Current APX distribution truth

As of September 19:
- Agent402 accepted APX and reported it listed, Base-enabled and routable.
- Market402 accepted the APX submission. Its latest immediate unpaid-probe self-test reported the APX execution packet as **spec compliant with 11/11 checks passing**. This is a directory self-test, not revenue.
- 402Index registered the APX Fresh Execution Packet as a $0.01 USDC/Base service; current directory state is healthy but still pending verification/review.
- x402 Arena already has the APX name/endpoint registered; repeated registration attempts return duplicate-name conflict and must not be treated as a missing listing.
- Boot-time directory registration is disabled again after the bounded one-time submission. Do not create repeated registration loops.

Discovery/listing state is not revenue.

## Current funded-work ingestion

APX currently consumes agent-oriented work through guarded internal bridges rather than exposing provider credentials.

### Superteam Earn

The existing encrypted Superteam agent identity is reused. APX receives only filtered opportunity fields.

Latest verified feed contained two current agent-eligible listings:
- a $10,000 hackathon track;
- a $1,000 builder/reflection bounty.

Both currently carry the blocker `social_account_or_content`. Patrick's social accounts are explicitly off-limits, so those opportunities are correctly rejected for Patrick's worker delegation. Do not weaken that control to chase payout.

Other APX users may only use such opportunities if their own delegated policy and the source rules allow the required actions.

### TaskBounty

The existing encrypted TaskBounty credential and guarded solver bridge are reused. APX now has a filtered TaskBounty inventory endpoint that can expose open task economics without leaking the credential.

At the latest verified check, no open TaskBounty candidate was available.

### Old EARN human-offer endpoint

`earn-router /api/opportunities` is a Human Earn publisher endpoint and currently returns provider-pending HTTP 503 because that publisher inventory is not activated. It is **not** an APX agent-work source and has been removed from the APX source list.

## Revenue truth

Verified unrelated outside INCOME 2 revenue remains:

**$0.001 Base USDC**

That September 12 Buyer #1 settlement remains the verified baseline.

No APX paid execution-packet settlement has yet been verified.

Do not count any of the following as revenue:
- directory registrations;
- directory health or ranking;
- Market402 probe success;
- unpaid 402 challenges;
- crawls;
- self-tests;
- owner-funded activity;
- internal transfers;
- listed reward amounts that Patrick has not earned;
- unverified ledger entries;
- theoretical commissions or projections.

## Working-capital authorization

A separate bounded EARN Base-mainnet spend wallet currently has a hard owner-principal authorization of **2.00 USDC total**.

Patrick has explicitly authorized use of up to the full remaining 2.00 USDC in one or more actions only when a genuine **PROVEN** or **VALIDATED** opportunity has a credible expected payout exceeding total spend plus fees.

Rules:
- owner principal is never revenue;
- never exceed 2.00 USDC or refill from other owner funds without new approval;
- no gambling, speculative trading, wash activity, self-purchases, fake demand, ranking/indexing/reputation canaries, or junk traffic;
- social accounts remain off-limits without separate specific authorization;
- use only the bounded authorized spend rail.

## Existing economic boundaries

Preserve existing separation:
- Patrick's private EARN receipts remain separate from personal-agent economics.
- Qualifying outside personal-agent settlements retain the established 70% user / 30% platform rule.
- Internal INCOME 2 commerce retains the established 3% network fee where applicable.
- No fake buyers, fabricated settlements, duplicate identities, spam, or rule evasion.

APX fees are a separate product surface and must be tied to genuine outside use.

## Legacy paid-capability experiment

The September 13 Macro Snapshot vs Web Extract experiment remains live as a low-maintenance background revenue surface, but it is no longer the primary strategic build.

Background offers:
- US Macro Snapshot: `/macro-snapshot` at the previously established $0.025 USDC price.
- Web Extract / URL-to-Markdown: `/web-extract` and `/url-to-clean-markdown` at the previously established $0.001 USDC price.

Do not remove working legacy routes. Do not invest major build effort in them unless paid evidence changes.

## BidLens / RevenueOS

BidLens Radar and the existing live Stripe one-off offers remain secondary, low-maintenance cash surfaces. They are not the primary growth thesis.

Do not spend owner money on them, use Patrick's socials, or let them displace APX execution work.

## APX scoreboard

APX is judged in this order:
1. first unrelated external worker/orchestrator reaches a genuine paid result through APX;
2. repeat paid fulfillment;
3. APX itself receives a genuine outside machine payment;
4. additional unrelated payers/solvers;
5. repeat APX usage;
6. positive contribution;
7. transaction-linked recurring revenue.

The long-run thesis is recurring machine-to-machine economic volume, not occasional one-off product purchases.

## Current blockers / priorities

Current priorities:
1. keep APX production healthy and machine-discoverable;
2. ingest more **genuinely funded, agent-eligible** work without pretending unfunded reward promises are escrow;
3. preserve delegation boundaries and source-platform rules;
4. convert APX discovery into an unrelated paid use;
5. only after real use, deepen settlement/success-fee mechanics.

Current known blockers:
- the two latest Superteam opportunities require social activity and are blocked for Patrick;
- TaskBounty currently exposes no open candidate;
- APX still needs more sources of funded autonomous work.

Do not respond to an empty opportunity set by fabricating inventory or by weakening safeguards.

## One-writer rule

Only one active session may write production or GitHub `main` for INCOME 2 at a time.

Before future production writes:
1. inspect latest `main`;
2. read this file;
3. verify the specific production surface;
4. make a bounded change;
5. update this file when commercial or operating truth changes materially.

## Immediate execution sequence

1. Preserve the verified $0.001 baseline.
2. Keep APX live, payable and discoverable.
3. Expand only real funded agent-work ingestion and execution readiness.
4. Route an unrelated worker to a genuine paid result.
5. Obtain the first genuine APX machine payment.
6. Measure repeat usage and contribution.
7. Add success/routing fees, spreads or recurring access only when real transaction behavior supports them.
8. Preserve legacy INCOME 2, BidLens and RevenueOS surfaces as background options without letting them distract from APX.

Current strategic question:

> **Can APX become the default economic layer an AI-created worker calls after its parent AI is told to make money?**

## New-chat order

A fresh operating chat should read:
1. `INCOME2_CANONICAL_CURRENT.md` — current operating truth
2. `AGENT_PROFIT_EXCHANGE.md` on branch `agent-profit-exchange` — APX design and delegated-agent protocol
3. `INCOME2_REVENUE_EXPERIMENT_2026-09-13.md` — legacy paid-capability experiment/history
4. `INCOME2_AUDIT_2026-09-13.md` — evidence-backed audit
5. `INCOME2_STATE.md` — older architecture reference only

Then inspect latest GitHub and live Render state before making a current-status claim.

## Bottom line

> **The primary bet is now APX: machine-native funded-work routing and monetization for worker agents created by AIs whose owners told them to make money. Revenue must come from genuine outside economic activity; everything else is infrastructure or evidence, not success.**
