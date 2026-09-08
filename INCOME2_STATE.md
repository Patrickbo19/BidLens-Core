# INCOME 2 — Canonical State

Last reconciled: 2026-09-08 14:16 America/New_York

This file is the canonical non-secret state summary for INCOME 2. Reconcile it against live services, provider messages, current external markets, Moltbook account state, and latest GitHub main before changing a material status. Never place API keys, recovery tokens, private keys, seed phrases, solver capability keys, claim secrets, or other credentials here.

## Product

**Brand:** INCOME 2

**Motto:** Your second income. Powered by you or your AI.

**Core promise:** Make money yourself — or let your AI earn for you.

Modes:

- **Human Earn:** legitimate human-required paid opportunities completed truthfully by the user.
- **Agent Earn / Auto Make Me:** eligible machine-doable paid work performed autonomously.
- **Buyer intent / Outcome Router:** an agent states the result it needs plus a maximum budget; INCOME 2 autonomously finds a fulfillment path and executes when a safe autonomous path exists.

INCOME 2 is agent-native as well as consumer-facing.

## HYDRA definition

**HYDRA is an internal codename/engine, not a separate public brand or separate fragile service.**

HYDRA means the autonomous buyer-intent and fulfillment engine inside INCOME 2:

`desired result + max budget + constraints -> discover supply -> evaluate price/safety -> execute autonomously when possible -> return result/receipt -> record abstract unmet demand when not fulfilled`

Hard HYDRA rule: **no manual brokerage.** A request must either clear autonomously, remain blocked/quoted for a specific machine-readable reason, or become an abstract unmet-demand signal. It must never turn into "Patrick needs to call/find/chase someone."

Long-term role:

- buyer sends outcome rather than choosing a tool
- route across internal INCOME 2 capabilities and outside agent/service markets
- assemble multiple capabilities when useful
- enforce budget/retry/receipt controls
- learn what buyers repeatedly want but cannot obtain
- turn proven unmet demand into reusable paid capabilities
- monetize through buyer-side routing spread, transaction fees, paid fulfillment, or reusable capability revenue once the payment/fulfillment economics are verified

## Outcome Router — live beta

Live seller surface:

- `GET /outcome-router` — status/capabilities
- `POST /outcome-router` — create an idempotent outcome request
- `GET /outcome-router/{requestId}` — retrieve abstract request state

MCP tool:

- `request_agent_outcome`

Current inputs:

- `task`
- `max_budget_usd`
- `idempotency_key`
- optional `params`
- optional `allow_external_discovery`
- optional `execute_if_free`

Current autonomous behavior:

1. Validate the desired outcome and caller budget.
2. Refuse external routing if the request appears to contain credentials/secrets.
3. Do not retain raw task text or raw params in the demand ledger; persist hashes/category/budget/route state only.
4. Use Agent402 as the first external discovery upstream.
5. If a compatible Agent402 tool exposes proof-of-work and the caller supplied valid params, solve the proof-of-work automatically and execute with **$0 upstream dollar spend**.
6. Return the external result as untrusted data with provenance.
7. If only paid external fulfillment is available, return a machine-readable route/budget state and **do not execute yet**.
8. Never use owner working capital for a buyer job merely to make the beta work.
9. Never request/custody a buyer private key.
10. Never hand the job to a human broker.

Current blocker for fully autonomous paid cross-market fulfillment:

**a safe buyer-funded/delegated payment rail.**

We need a structure where the buyer funds/authorizes the request and HYDRA can pay the selected supplier without owner-fronted working capital and without custody of a raw buyer private key. Until that rail is solved, paid external execution remains deliberately blocked. This is a technical/economic boundary, not a reason to add manual steps.

Current upstream research confirms Agent402 already offers a buyer-side route-and-execute service with free quote resolution and paid execution tiers; INCOME 2 should use existing supply where economical rather than recreate every tool. HYDRA's opportunity is the broader buyer-intent/demand-learning layer and eventual cross-supply fulfillment, not another catalog.

## Business model and revenue truth

Current Agent Earn beta split for attributed settled autonomous revenue:

- User: 70%
- INCOME 2: 30%

Human Earn may use provider-specific economics rather than 70/30.

Only verified real third-party settled money counts as revenue. Do not count listings, tasks, estimates, submissions, simulations, self-payments, internal canaries, free Purchase Guard calls, or free Outcome Router requests as revenue.

As of this reconciliation:

- Verified real external INCOME 2 revenue: **$0**
- Verified real outside Agent Earn settlements: **0 confirmed**
- Existing small ledger settlement record is not counted as external revenue without independent outside-buyer verification.
- Human Earn live provider conversions: **0**
- TaskBounty funded/open tasks observed: **0**
- AgentWorld historical reward: simulation-only, excluded.

## Canonical account system

Canonical Agent Earn ledger lives on `earn-tools-backend` and is Postgres-backed.

- Website and ChatGPT use the same ledger.
- ChatGPT `/manage` reads the canonical ledger.
- x402 Agent Earn settlements write there.
- Account handles use `income2_`.

Still required:

- Human Earn provider postbacks -> canonical customer ledger attribution
- external bounty payout -> canonical customer ledger attribution
- production-safe customer cash-out/redeemability

## Live services

Repository: `Patrickbo19/BidLens-Core`

Render services auto-deploy from main:

- `earn-router`
- `earn-tools-backend`
- `earn-chat-mcp`
- `earn-agent-worker`

Outcome Router was launched through commits:

- `f819945ca169b9655cbe90631008bb419edb3a8d` — Add autonomous INCOME 2 outcome router beta
- `59889836a90e82c867da97ec917877634fa67886` — Expose autonomous outcome router through seller
- `677ec6a0521e03ef80e942cfaedcf8f8b34aad5e` — Add autonomous outcome routing to INCOME 2 MCP

Seller and MCP deployments for `677ec6a...` were verified **LIVE**. Seller startup showed Postgres ledger persistence; Moltbook remained claimed/neutral; TaskBounty remained configured. The normal one-time seller-core warmup produced a transient local proxy ECONNREFUSED before the child core was listening, then the core came up normally.

## ChatGPT MCP

Endpoint:

`https://earn-chat-mcp.onrender.com/mcp`

Health:

`https://earn-chat-mcp.onrender.com/health`

Current MCP version: **0.3.0**

Expected identity:

- brand: INCOME 2
- accountSystem: `canonical_seller_ledger`

Current public tools:

1. `get_earning_options`
2. `start_agent_earn`
3. `check_earnings`
4. `find_paid_opportunities`
5. `guard_x402_purchase`
6. `request_agent_outcome`

Public ChatGPT Plugin Directory submission has not been sent.

### Public ChatGPT launch gate

Do not submit publicly until BOTH are true:

1. at least one genuine outside Agent Earn settlement is recorded end-to-end
2. at least one Human Earn publisher feed is approved with real funded inventory

Additional pre-submission work includes Human Earn conversion attribution, bounty payout attribution, reviewer testing, and final privacy/terms/assets review.

## Agent-native x402 seller

Origin: `https://earn-tools-backend.onrender.com`

Network: Base mainnet (`eip155:8453`)

Asset: USDC

Primary paid route:

`POST /web-extract` — 0.003 USDC

Paid seller manifest remains **13 paid x402 resources**. Free buyer-side betas are outside the paid manifest.

Latest discovery state:

- Agent402 origin indexed/routable; latest registration response reported 15 discovered tools/surfaces and health 1.
- x402 Arena existing names return expected duplicate-name responses because listings already exist.
- Market402 rechecks remain spec-compliant; `/web-extract` has passed 11/11 checks.
- 402Index registrations remain in its review/health flow.

Do not manufacture activity with self-payments or duplicate accounts/listings.

## Agent Purchase Guard — free validation beta

Live:

- `GET /purchase-guard`
- `POST /purchase-guard`
- `GET /purchase-guard/{receiptId}`
- MCP: `guard_x402_purchase`

Purpose:

`one intended x402 purchase -> stable intent -> hard max-spend -> retry/idempotency protection -> durable receipt`

It never signs, sends, settles, or custodies funds; `paymentExecuted` remains false.

Keep the basic beta free while usage is unproven. Do not keep adding features because traffic is low. Act on meaningful outside use, repeat use, WTP, or repeated requests for reconciliation/execution/fulfillment proof.

No confirmed outside Purchase Guard user has been observed yet.

## Moltbook — compliance-first state

INCOME 2 Moltbook agent:

- name: `Income2`
- claim status: `claimed`
- API credential encrypted at rest
- neutral automation-owned profile: `INCOME 2 research agent focused on agent-workflow reliability, transaction safety, and practical machine-to-machine coordination.`

First verified demand post:

`https://www.moltbook.com/post/c5e9a29c-a2f8-4d2a-8115-2c07cc895c49`

Automated product promotion is disabled. Current status monitoring is aggregate-only and must keep `thirdPartyContentExposed=false`.

Hard rules:

- official supported API patterns only
- no broad scraping/crawling/mass-search
- no datasets/retention of third-party Moltbook content or identities
- no republishing third-party replies
- no automated ads/promotional spam
- no mass DMs/comments/follows/votes
- no duplicate identities for evasion
- no impersonation or rate-limit/safety-control evasion

If Moltbook aggregate activity changes, notify the owner without copying third-party content. Specific interpretation must be deliberate/minimal and rules-aware.

## TaskBounty / Task Hunter

Brainbase agent:

- `INCOME 2 Task Hunter`
- id `66070003-c3eb-4ccc-80e4-4ead96bf402b`
- managed Brainbase/Daytona
- TaskBounty primary
- AgentWorld disabled

TaskBounty credentials live only in the canonical backend vault. Worker reads canonical status rather than maintaining another vault.

Latest verified:

- connected: true
- authReady: true
- HTTP 200
- persistent/configured: true
- open funded tasks: 0

Do not wake paid managed compute unless a candidate is funded and economically worthwhile; current gross target >= $25 with expected proceeds materially above compute.

## Human Earn

Human Earn remains intended consumer earning floor; funded inventory is not live.

- Lootably — application sent, no approval yet
- TapResearch — application sent, no approval yet
- ayeT Studios — acknowledged/reviewing, no approval yet

Potential future providers include BitLabs, CPX Research and inBrain, but do not claim application/approval without verification.

Before real balance crediting, implement the approved provider's exact economics, currency, signature, idempotency and reversal semantics.

External customer cash-out is not production-enabled.

## Autonomous controller

Automation:

- `INCOME 2 Earn Watch`
- id `6a9f2eb7dccc8191a659939d9b47a0f0`
- enabled
- hourly condition watch
- America/New_York

Priorities:

- genuine x402 outside settlements
- seller/discovery health
- Purchase Guard meaningful external usage/WTP
- TaskBounty auth/funded inventory
- MCP/unified-ledger health
- Human Earn provider status
- launch-gate conditions
- Moltbook aggregate-only compliance-safe state
- Outcome Router availability and any credible external autonomous request/fulfillment signal

Do not count system tests or free Outcome Router activity as revenue.

## Working capital

Owner-authorized ceiling: **$10**.

Preserve it unless a verified legitimate paid opportunity genuinely requires a small spend and economics justify it. HYDRA must not front owner money for anonymous buyer requests merely to make fulfillment appear autonomous.

## Current strategic judgment

The missing high-upside layer is now defined as **buyer-intent ownership**, not another seller utility.

INCOME 2 already has supply/earning infrastructure. HYDRA/Outcome Router turns it into a system where buyers can state a desired result and budget while INCOME 2 learns demand and creates/routs work for Agent Earn.

The immediate product sequence is:

**accept intent -> route autonomously -> execute free/zero-upstream-cost fulfillment where possible -> observe real demand -> solve safe buyer-funded paid execution -> take buyer-side margin -> expand only from repeated demand**

Do not turn HYDRA into a giant separate architecture. Keep it an internal engine within INCOME 2 unless later demand clearly justifies a standalone brand/surface.

## Continuity rule

When switching chats, read this file then reconcile against live state before acting materially.

Reconcile against:

- latest GitHub main
- Render health/deploys
- Outcome Router live state and use evidence
- Moltbook aggregate status/current official rules
- Purchase Guard state/use evidence
- TaskBounty/Task Hunter
- Earn Watch
- provider inbox/status
- x402 discovery/settlement evidence
- ChatGPT Plugin Directory state when relevant

Update this file after material architecture, HYDRA/Outcome Router, launch-gate, provider, revenue, distribution, Moltbook, Purchase Guard, TaskBounty, or automation changes. Never let stale chat context override verified live state.