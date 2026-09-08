# INCOME 2 — Canonical State

Last reconciled: 2026-09-08 13:26 America/New_York

This file is the canonical non-secret state summary for INCOME 2. Reconcile it against live services, provider messages, current external markets, Moltbook account state, and the latest GitHub main branch before changing a material status. Never place API keys, recovery tokens, private keys, seed phrases, solver capability keys, claim secrets, or other credentials here.

## Product

**Brand:** INCOME 2

**Motto:** Your second income. Powered by you or your AI.

**Core promise:** Make money yourself — or let your AI earn for you.

A user may use both modes at once:

- **Human Earn:** legitimate human-required paid opportunities completed truthfully by the user.
- **Agent Earn / Auto Make Me:** eligible machine-doable paid work performed autonomously.

INCOME 2 is also agent-native: outside AI agents can discover and pay for machine services programmatically.

### Current launch posture

- **Human Earn = intended dependable earning floor.** Funded provider inventory is not live yet.
- **Agent Earn = autonomous upside.** x402 seller rails, agent-facing tools, TaskBounty, and future machine work provide the autonomous side.
- **Both can coexist.** Do not imply autonomous earnings are guaranteed or already abundant.

## Business model and revenue truth

Current Agent Earn beta split for attributed settled autonomous revenue:

- User: 70%
- INCOME 2: 30%

Human Earn may use provider-specific reward/publisher economics rather than the 70/30 Agent Earn split.

Only verified real third-party settled money counts as revenue. Do not count listings, available tasks, estimated rewards, submissions, simulated activity, canaries, self-payments, free Purchase Guard calls, or unverified ledger records as revenue.

As of this reconciliation:

- Verified real external INCOME 2 revenue: **$0**
- Verified real outside Agent Earn settlements: **0 confirmed**
- An existing small settlement record may be present in the ledger, but it is not counted as external revenue unless independently verified as a genuine outside buyer payment.
- Human Earn live provider conversions: **0**
- TaskBounty funded/open code tasks observed in the latest check: **0**
- AgentWorld historical reward: simulation-only and excluded.

## Canonical account system

The canonical Agent Earn account/ledger lives on `earn-tools-backend`.

Current state:

- Website Agent Earn uses the seller backend account system.
- ChatGPT MCP uses the same seller backend account system.
- ChatGPT no longer maintains a separate earnings ledger.
- ChatGPT `/manage` reads the canonical seller ledger.
- x402 Agent Earn settlements write to the canonical seller ledger.
- Account handles use the `income2_` prefix.
- Live persistence is Postgres-backed.

Still required before all revenue rails are fully unified:

- Human Earn verified provider postbacks → canonical customer ledger attribution.
- External task/bounty payout → canonical customer ledger attribution.
- Production-safe customer cash-out/redeemability.

## Live services

Repository: `Patrickbo19/BidLens-Core`

All current Render services use the main branch and auto-deploy on commit:

- `earn-router` — customer-facing INCOME 2 / Human Earn router
- `earn-tools-backend` — canonical ledger, x402 seller, TaskBounty vault/bridge, Moltbook vault/status, Purchase Guard
- `earn-chat-mcp` — ChatGPT MCP surface using the canonical ledger
- `earn-agent-worker` — verifier/worker that checks MCP, buyer discovery, and canonical TaskBounty status

Latest material code before this reconciliation includes the Moltbook compliance hardening through commit `ae1237db6aae5cfb83af6e5b91fcb2f8a139212d` (`Stop republishing Moltbook user content`).

At the latest live check, the core Render services were deployed and healthy.

## ChatGPT MCP

Live MCP endpoint:

`https://earn-chat-mcp.onrender.com/mcp`

Health:

`https://earn-chat-mcp.onrender.com/health`

Manage surface:

`https://earn-chat-mcp.onrender.com/manage`

Current MCP version: **0.2.1**

Expected health identity:

- brand: `INCOME 2`
- accountSystem: `canonical_seller_ledger`

Current public tools:

1. `get_earning_options`
2. `start_agent_earn`
3. `check_earnings`
4. `find_paid_opportunities`
5. `guard_x402_purchase`

`guard_x402_purchase` is the free, non-custodial Purchase Guard tool. It never signs, sends, settles, or custodies funds.

Public ChatGPT Plugin Directory submission has **not** been sent.

### Public ChatGPT launch gate

Do not submit publicly until BOTH are true:

1. At least one genuine outside Agent Earn settlement is recorded end-to-end in the canonical ledger.
2. At least one Human Earn publisher feed is approved and returning real funded opportunities.

Additional pre-submission work:

- Human Earn conversion-to-ledger attribution
- external bounty payout-to-ledger attribution
- reviewer test against unified ledger
- final privacy/terms/assets review

## Agent-native x402 seller

Origin:

`https://earn-tools-backend.onrender.com`

Network: Base mainnet (`eip155:8453`)

Asset: USDC

### Primary first-sale route

`POST /web-extract`

**Name:** Webpage to Clean Markdown

**Price:** 0.003 USDC

Purpose: convert a public static webpage/article into clean markdown and useful metadata for research, retrieval, summarization, indexing, or RAG.

Safety properties include public HTTP/HTTPS-only targets, DNS/private-network blocking, redirect validation, size/time limits, and explicit treatment of extracted content as untrusted.

### Seller/discovery state

The paid x402 manifest remains **13 paid resources**.

Purchase Guard remains free and intentionally outside the paid manifest.

Current external-discovery posture from the latest checks:

- Agent402 has indexed the broader INCOME 2 surface and has shown **15 discovered tools/surfaces** while the seller itself still has 13 paid x402 routes.
- x402 Arena has the `income2-web-extract` listing active/verified.
- Market402 accepted the exact web-extract route and previously passed 11/11 compatibility checks.
- 402Index has the Webpage to Clean Markdown listing in its review/health flow.

Do not manufacture activity through self-payments or duplicate registrations.

## Agent Purchase Guard — free demand-validation beta

Live endpoints:

- `GET /purchase-guard`
- `POST /purchase-guard`
- `GET /purchase-guard/{receiptId}`

Purpose:

**one intended x402 purchase → stable intent → hard max-spend ceiling → retry/idempotency protection → durable receipt**

Required input:

- `url`
- `max_usd`
- `idempotency_key`

Optional:

- method
- body
- expected network (defaults to Base)

Behavior:

- probes the unpaid x402 challenge
- parses a supported quote
- enforces `max_usd`
- persists an intent/receipt
- hashes the idempotency key and request body rather than storing raw values
- same key + same parameters returns the same intent
- same key + changed parameters is rejected
- never signs, sends, settles, or custodies funds
- `paymentExecuted` remains false

### Discovery/onboarding

Purchase Guard is exposed through:

- `/.well-known/x402`
- `/.well-known/x402.json`
- `/openapi.json`
- `/skill.md`
- `/llms.txt`
- `/agents.txt`
- MCP tool `guard_x402_purchase`

A no-payment quickstart is exposed through the INCOME 2 discovery/docs surfaces and preflights INCOME 2's own 0.003-USDC `/web-extract` route without signing or sending payment.

### Current strategy

**Keep the basic beta free during initial validation.**

Do not keep adding features merely because there is no immediate traffic.

Act when one of these appears:

1. meaningful outside agent use
2. repeat use/integration
3. explicit willingness to pay
4. repeated requests for the same missing capability, especially reconciliation/execution/fulfillment proof
5. enough real exposure with no interest to become a credible negative signal

If eventual monetization is justified, likely paid value should be above the free guard layer: persistent reconciliation, execution protection, seller verification, fulfillment proof, policy controls, or guarded transaction execution.

As of the latest check, **no confirmed outside Purchase Guard user has been observed yet**.

## Moltbook — compliance-first state

INCOME 2 has a claimed Moltbook agent identity:

- Agent name: `Income2`
- Claim status: `claimed`
- Credential storage: encrypted at rest in the existing Postgres-backed vault
- API key must never be exposed in chat, GitHub, logs intended for users, or public docs

First verified demand post:

`https://www.moltbook.com/post/c5e9a29c-a2f8-4d2a-8115-2c07cc895c49`

A one-time Purchase Guard follow-up comment was previously published and verified. Automated product-update behavior is now disabled for policy compliance.

### Current Moltbook profile

Current automation-owned profile description is intentionally neutral/non-promotional:

`INCOME 2 research agent focused on agent-workflow reliability, transaction safety, and practical machine-to-machine coordination.`

The profile updater only migrates descriptions previously owned by our automation and must not overwrite an unexpected/manual owner-authored description.

### Hard compliance posture

Moltbook account safety is a hard constraint.

Use official supported API patterns only. Do not:

- scrape/crawl Moltbook broadly
- mass-search or harvest posts/profiles
- build or retain datasets of Moltbook content
- retain/copy third-party comment bodies, author names, profile details, identities, or contact data
- republish third-party Moltbook content through INCOME 2
- auto-post product promotions/advertising/commercial sales content
- mass-DM, mass-comment, auto-follow, auto-vote, or create engagement bait
- create duplicate identities to evade restrictions
- impersonate people or agents
- evade rate limits or safety controls

The current public Moltbook status path is aggregate-only for our own post/account state. It must keep `thirdPartyContentExposed=false` and expose only safe aggregate signals such as claim state, our post ID, comment count, score, and whether activity changed.

The old broad automated demand-harvesting loop is no longer the operating model.

If aggregate Moltbook activity changes, notify the owner that activity exists. Interpretation of a specific reply or broader research should be deliberate, minimal, non-retentive, and preceded by a fresh policy check when appropriate.

## TaskBounty / Task Hunter

Brainbase Task Hunter:

- title: `INCOME 2 Task Hunter`
- agent id: `66070003-c3eb-4ccc-80e4-4ead96bf402b`
- runtime: managed Brainbase/Daytona
- primary current market: TaskBounty
- AgentWorld disabled

TaskBounty credentials live in the canonical backend vault. The worker no longer tries to maintain a duplicate TaskBounty vault.

Current worker behavior reads:

`https://earn-tools-backend.onrender.com/taskbounty/status`

Latest verified auth posture:

- connected: **true**
- authReady: **true**
- auth check: HTTP 200
- vault persistent/configured: **true**
- open funded tasks observed: **0**

Do not wake billable managed compute unless a funded candidate is worthwhile. Current target is gross bounty at least $25 with expected proceeds materially above likely managed compute cost.

## Human Earn

Human Earn remains the intended consumer earning floor, but funded provider inventory is not live yet.

Applications/status:

- Lootably — application sent; no approval yet
- TapResearch — application sent; no approval yet
- ayeT Studios — request acknowledged and under review; no approval yet

Potential additional supply includes BitLabs, CPX Research, and inBrain, but do not claim they are applied/approved unless verified.

Lootably integration code can fetch/rank offers once credentials exist.

Before crediting real Human Earn balances, configure the approved provider's actual economics, currency relationship, and postback signature/reversal semantics.

External customer cash-out is still **not production-enabled**.

## Autonomous controller

Automation:

- Title: `INCOME 2 Earn Watch`
- ID: `6a9f2eb7dccc8191a659939d9b47a0f0`
- Enabled: yes
- Frequency: hourly
- Mode: condition watch
- Timezone: America/New_York

Current watch priorities:

- `/web-extract` seller health and genuine external settlement
- x402/discovery visibility
- Purchase Guard availability and credible external usage/WTP
- canonical TaskBounty auth and funded-task inventory
- MCP health and unified ledger architecture
- Human Earn provider readiness/inbox changes
- public ChatGPT launch-gate conditions
- Moltbook **aggregate-only compliance-safe monitoring**

Moltbook watch must not scrape, mass-search, collect, retain, republish, or automatically promote.

## Working capital

Owner-authorized working-capital ceiling: **$10**.

Preserve it unless a verified legitimate paid opportunity genuinely requires a small spend and expected economics justify it. Do not spend merely to test the system.

## Current strategic judgment

INCOME 2 is no longer primarily blocked by architecture. It is blocked by:

- genuine demand/usage proof
- first verified outside payment
- Human Earn provider supply
- eventual payout/cash-out readiness

Priority:

**traffic → observe → validate repeated pain → build narrowly → distribute → verify real payment → repeat**

For Purchase Guard specifically, the current posture is:

**leave it alone and let the market respond unless new evidence justifies a change.**

Do not confuse indexing, discussion, free calls, or internal probes with product-market fit.

## Continuity rule

When switching chats, start by reading this file and then reconcile it against live state before acting materially.

Before a material INCOME 2 decision, reconcile against:

- latest GitHub main
- live Render deploy/service health
- Moltbook claim/account aggregate status and current official rules
- Purchase Guard availability/use evidence
- TaskBounty auth/inventory
- Brainbase Task Hunter configuration/tasks
- enabled Earn Watch automation
- provider inbox/status
- x402 marketplace/discovery visibility and settlement evidence
- ChatGPT Plugin Directory state when launch status matters

Update this file after material architecture, launch-gate, provider, revenue, distribution, Moltbook, Purchase Guard, TaskBounty, or automation changes. Never let stale chat context override verified live state.