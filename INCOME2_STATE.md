# INCOME 2 — Canonical State

Last reconciled: 2026-09-08 10:06 America/New_York

This file is the canonical non-secret state summary for INCOME 2. Reconcile it against live services, provider messages, current external markets, and current Moltbook state before changing a material status. Never put API keys, private credentials, recovery tokens, seed phrases, solver capability keys, claim secrets, or other secrets here.

## Product

**Brand:** INCOME 2

**Motto:** Your second income. Powered by you or your AI.

**Core promise:** Make money yourself — or let your AI earn for you.

A human user may use both modes at the same time:

- **Human Earn:** the user completes legitimate human-required paid opportunities truthfully.
- **Agent Earn / Auto Make Me:** AI performs eligible machine-doable paid work.

INCOME 2 is also agent-native: outside AI agents can discover and pay for machine services programmatically.

### Launch positioning

Do not rely on autonomous-agent work alone to make the consumer product useful at launch.

Current intended economic shape:

- **Human Earn = dependable earning floor.** Build redundant funded human-work supply so supported users can usually find something legitimate to do even while agent-native demand is still thin.
- **Agent Earn = autonomous upside.** Keep growing x402, paid agent services, bounties, and future agent-to-agent work so more of the earning can become automated over time.
- **Both can run simultaneously.** A customer should be able to earn manually while Auto Make Me continues looking for legitimate machine-doable paid work.

The product should never imply that autonomous work is guaranteed or already abundant. The early goal is enough total paid demand across all rails to make INCOME 2 useful now while the agent economy grows.

## Business model

INCOME 2 earns when legitimate paid activity flows through the platform.

Current Agent Earn beta split for attributed settled autonomous revenue:

- User: 70%
- INCOME 2: 30%

Human Earn economics may use provider-specific user reward / publisher margin rather than the Agent Earn 70/30 split. Do not assume Human Earn is 70/30 unless explicitly configured.

Only real settled third-party payments count as revenue. Listings, available tasks, estimates, simulated rewards, submissions, accepted-but-unpaid work, canaries/self-payments, and projections are not revenue.

## Canonical account system

The canonical Agent Earn account/ledger is the seller backend ledger on `earn-tools-backend`.

Current state:

- Website Agent Earn creates/reactivates/checks accounts through the seller backend.
- ChatGPT MCP creates/reactivates/checks accounts through the same seller backend.
- ChatGPT no longer maintains a separate earnings ledger.
- ChatGPT `/manage` reads the canonical seller ledger.
- x402 Agent Earn settlements write to the canonical seller ledger.
- Account handles use the `income2_` prefix.
- Ledger persistence is Postgres-backed in the live seller.

Still required before all revenue rails are fully unified:

- Human Earn verified provider postbacks must be attributed into the canonical ledger after a publisher is approved and its exact reward currency/postback configuration is known.
- External task/bounty payouts must be independently verified and attributed to a canonical INCOME 2 account before being shown as customer earnings.

## Live services

All are sourced from `Patrickbo19/BidLens-Core` main branch and configured for Render auto-deploy on commit.

- `earn-router` — customer-facing INCOME 2 website / Human Earn router
- `earn-tools-backend` — canonical account ledger, x402 seller, TaskBounty vault/solver bridge, Moltbook credential vault/demand worker, and Agent Purchase Guard beta
- `earn-chat-mcp` — ChatGPT MCP/plugin surface; uses canonical seller ledger
- `earn-agent-worker` — older autonomous worker service; not the primary TaskBounty managed solver

Latest reconciled seller deployment is live and includes the first-sale `/web-extract` route, the claimed Moltbook integration/demand launch, and the free Agent Purchase Guard demand-validation beta.

## Customer-facing website

Customer brand: INCOME 2

Primary modes:

- AGENT EARN — Let your AI earn
- HUMAN EARN — Earn yourself

Agent Earn activation persists after the page is closed. The browser stores the pseudonymous account handle and recovery token locally; the server stores only the token hash.

Human Earn UI exists but funded provider inventory is not live yet.

## ChatGPT plugin / MCP

Live MCP endpoint:

`https://earn-chat-mcp.onrender.com/mcp`

Health endpoint:

`https://earn-chat-mcp.onrender.com/health`

External balance/manage surface:

`https://earn-chat-mcp.onrender.com/manage`

Current public tools:

1. `get_earning_options`
2. `start_agent_earn`
3. `check_earnings`
4. `find_paid_opportunities`

Current live MCP version after unification: 0.2.0

Expected health identity:

- brand: INCOME 2
- accountSystem: `canonical_seller_ledger`

Public ChatGPT Plugin Directory submission has NOT been sent yet.

## ChatGPT public launch gate

Do not submit publicly until BOTH are true:

1. At least one genuine outside Agent Earn settlement is recorded end-to-end in the canonical ledger.
2. At least one Human Earn publisher feed is approved and returning real funded opportunities.

Additional pre-submission work:

- verified Human Earn conversion-to-ledger attribution
- external task/bounty payout-to-ledger attribution before such earnings are customer-facing
- end-to-end reviewer test against the unified live ledger
- final directory assets/privacy/terms review

## Agent-native x402 seller

Live origin:

`https://earn-tools-backend.onrender.com`

Network: Base mainnet (`eip155:8453`)

Asset: USDC

Baseline utility routes remain $0.001 per call.

### First-sale primary route

`POST /web-extract`

**Name:** Webpage to Clean Markdown

**Price:** $0.003 / 0.003 USDC per successful x402 call

Purpose: fetch a public static HTML/text page and return clean markdown plus title, description, author, published date when available, canonical URL, useful links, word count, and an `untrustedContent` marker.

Buyer intents targeted:

- webpage extraction
- article to markdown
- web content extraction
- scrape page to markdown
- website text extraction
- research/RAG ingestion
- URL to clean text/markdown

Why this was chosen: current buyer-market evidence shows article/page extraction as a paid machine need, while generic hashing/encoding is heavily commoditized. INCOME 2 intentionally undercuts comparable article extraction while avoiding a paid upstream dependency.

Safety/quality properties:

- public HTTP/HTTPS only
- DNS private/local targets blocked
- every redirect is revalidated to reduce SSRF risk
- capped response size and time budget
- static HTML/text only; no claim of JavaScript rendering
- external page content explicitly marked untrusted

The URL-audit route also uses the redirect-safe public fetch helper.

Current live seller manifest reports **13 paid resources**. Existing generic capabilities remain available, including status, hashes/encoding, JSON QA, prompt scan, URL audit, and x402 buyer preflight. The free Agent Purchase Guard beta is intentionally outside the paid manifest while demand is being validated.

### Buyer visibility / routing state

- **Agent402:** origin is currently listed, routable, health 1, and reports **13 paid tools**.
- **x402 Arena:** `income2-web-extract` was accepted as active/verified at 0.003 USDC on Base. Later duplicate-name 409 responses are expected because the registration already exists.
- **Market402:** the exact `/web-extract` resource is submitted and passes **11/11** instant spec-compliance checks. A compatibility shim mirrors the valid x402 v2 challenge into the HTTP 402 JSON body as well as the payment header.
- **402Index:** `INCOME 2 Webpage to Clean Markdown` is accepted as healthy and self-registered, currently pending review/domain verification.

Do not self-pay to manufacture activity. First revenue requires a genuine outside buyer settlement.

## Moltbook — agent demand/distribution loop

INCOME 2 now has a claimed Moltbook agent identity.

- **Agent name:** `Income2`
- **Claim status:** `claimed`
- **Credential storage:** API key is encrypted at rest in the existing Postgres-backed INCOME 2 vault. Never expose it in chat, logs intended for users, GitHub, or public docs.
- Moltbook status is checked through its authenticated agent status API using the encrypted key.

First verified demand post:

`https://www.moltbook.com/post/c5e9a29c-a2f8-4d2a-8115-2c07cc895c49`

- Post id: `c5e9a29c-a2f8-4d2a-8115-2c07cc895c49`
- Community: `m/agent-marketplace`
- Title: `Agents: what capability do you repeatedly need — or wish were cheaper?`
- Status: **verified and published**

The first post flow is idempotent so service restarts should not create duplicates. Moltbook's anti-spam verification challenge is solved only when the math parser is confident; uncertain challenges must not be guessed.

### Moltbook strategy

Use Moltbook primarily as a demand-intelligence and relevant distribution channel, not an ad cannon.

Loop:

1. Read/search existing agent conversations.
2. Ask agents what repetitive capability they currently pay for, cannot do locally, or avoid because the alternative is expensive/annoying.
3. Record exact buyer language, current alternatives, price complaints, auth friction, reliability/retry issues, output-format needs, and concrete willingness-to-pay evidence.
4. Treat repeated independent demand as stronger than one generic suggestion.
5. Cross-check the demand against current agent marketplaces and existing competitor pricing.
6. Build only the strongest low-cost/reliable capability.
7. Publish it through INCOME 2's x402 seller and discovery surfaces.
8. Report back to relevant agents without spam.
9. Measure **real external paid calls**, not engagement, as the success metric.

Do not mass-comment, manufacture engagement, create duplicate posts/accounts, or advertise into unrelated conversations.

### Early Moltbook demand signals

Existing conversations suggest that agents care about more than raw API functionality. Recurring themes now being tested:

- predictable, known pricing before a call
- retries/idempotency so agents do not get charged twice
- receipts / payment reconciliation
- reliable structured outputs
- avoiding annoying authentication/setup
- distribution/routing: merely supporting x402 is not enough if buyers cannot discover the service

These signals were strong enough to justify a **narrow, free demand-validation beta**, not a new standalone app and not a full payment wallet.

## Agent Purchase Guard — demand-validation beta

INCOME 2 now exposes a free beta at:

- `GET /purchase-guard` — beta capability/status
- `POST /purchase-guard` — create/reuse a purchase intent
- `GET /purchase-guard/{receiptId}` — durable receipt lookup

Purpose: make one intended x402 purchase **retry-safe and auditable before any money is signed or sent**.

Required POST inputs:

- `url`
- `max_usd`
- `idempotency_key`

Optional:

- `method` (`GET` or `POST`)
- `body`
- `expected_network` (defaults to Base `eip155:8453`)

Behavior:

1. Validate the target as a public HTTP/HTTPS URL and block private/local targets.
2. Probe the unpaid x402 challenge without paying.
3. Parse exact payment options and normalize Base USDC pricing.
4. Compare the quoted amount with the caller's `max_usd` ceiling.
5. Return `ready_to_purchase` only when an exact Base-USDC quote is parseable and within budget; otherwise return `blocked` with reasons.
6. Hash the idempotency key and request body rather than storing the raw values.
7. Persist an intent + receipt in Postgres.
8. Reusing the same idempotency key with identical purchase parameters returns the same intent instead of creating a second one.
9. Reusing the same key with different purchase parameters is rejected as an idempotency conflict.
10. **The beta never signs, sends, or settles the underlying purchase. `paymentExecuted` is always false.**

This is intentionally free while demand is validated. Do not count beta calls as revenue. Do not add wallet/private-key custody merely to make the demo look more complete.

### Current competitive context for Purchase Guard

The broader x402 ecosystem already contains budget/preflight, wallet-policy, receipt, approval, and pay-and-fetch tooling. Current examples found during validation include agent budget/preflight products priced around $0.02–$0.03 and open-source agent-wallet/receipt infrastructure.

Therefore the differentiation to test is not generic budgeting. It is:

**one-call retry safety + stable purchase intent + max-spend enforcement + durable receipt with almost no integration work.**

If agents do not use that differentiated behavior, do not keep expanding it. If external agents repeatedly use it and ask for execution, reconciliation, merchant reliability, or payment orchestration, then consider a paid version or deeper commerce layer.

## Managed Task Hunter

Brainbase agent:

- Title: `INCOME 2 Task Hunter`
- Agent id: `66070003-c3eb-4ccc-80e4-4ead96bf402b`
- Runtime: managed Brainbase/Daytona
- Primary current market: TaskBounty
- AgentWorld MCP: disabled

TaskBounty access is persistent through the encrypted INCOME 2 backend vault and restricted solver bridge. Raw credentials and solver capability secrets must never be exposed.

Current allowed high-level workflow:

open funded task → inspect → economics/safety check → read-only repo access → reproduce → smallest fix → regression test → run tests → inspect unified diff → submit → poll verification → verify payout

Do not wake managed compute for junk. Current autonomous controller target: gross bounty at least $25 and expected solver proceeds materially above likely managed-agent compute cost.

Latest reconciled TaskBounty public board state: no open code bounties.

TaskBounty publicly supports AI agents, an 80/20 solver/platform split, and multiple payout methods including USDC on Base.

## Historical AgentWorld proof

The worker previously completed the full browse → claim → create deliverable → submit loop on AgentWorld.

The displayed reward was simulation-only (`sim_only` / payout source `sim`). It is NOT verified INCOME 2 revenue.

## Human Earn

Human Earn is now strategically the **consumer earning floor**, not a side feature. The goal is eventually a redundant multi-provider supply layer so one provider's lack of inventory or approval does not make INCOME 2 empty for users.

Current/potential provider stack under consideration:

- Lootably
- TapResearch
- ayeT Studios
- BitLabs
- CPX Research
- inBrain

Do not claim a provider is integrated or approved merely because it is a target. Only live approved funded feeds count.

Latest reconciled inbox state:

- Lootably application sent; no approval received yet.
- TapResearch application sent; no approval received yet.
- ayeT Studios acknowledged the request and said it is under review; no approval yet.

Lootably integration code can fetch/rank offers once credentials exist.

Before crediting real Human Earn USD balances, configure and verify the provider's actual currency/reward relationship and postback signature rules. For Lootably, official postbacks include userID, transactionID, revenue, currencyReward, status, and SHA-256 hash verification using the placement postback secret.

Do not fabricate inventory while provider activation is pending.

### Human Earn product goal

Once multiple feeds are available, build one unified ranking layer that favors:

- legitimate funded opportunities
- zero-spend opportunities where possible
- user eligibility
- realistic reward/time
- provider reliability
- INCOME 2 margin without misleading the user

A supported user should ideally see at least one currently available legitimate earning action before the product says nothing is available.

## Customer payout requirement

External customer cash-out is still **not production-enabled**. Do not claim users can withdraw money yet.

Before broad consumer launch, actual redeemability must be solved. An internal ledger balance alone is not enough for a consumer "make money" product.

## Autonomous controller

ChatGPT automation:

- Title: `INCOME 2 Earn Watch`
- ID: `6a9f2eb7dccc8191a659939d9b47a0f0`
- Enabled: yes
- Frequency: hourly
- Mode: condition watch
- Timezone: America/New_York

It monitors:

- first-sale `/web-extract` health, x402 challenge, marketplace/index visibility, buyer-intent routing and real settlements
- Moltbook first demand post and relevant conversations for substantive replies / repeated agent demand
- Agent Purchase Guard beta availability and evidence of real external use or repeated purchase-safety demand
- TaskBounty auth + current funded public inventory
- Task Hunter duplicate-run prevention and economics gate
- x402 seller/ledger and broader buyer visibility
- ChatGPT MCP health and canonical-ledger architecture
- Human Earn router/provider state
- Gmail for meaningful Lootably/TapResearch/ayeT approval/rejection/action-required messages
- the two-condition public ChatGPT launch gate

For Moltbook it should group demand by capability, current alternative/provider, pricing complaint, authentication/friction, reliability/retry problem, output-format need, and willingness-to-pay evidence. Notify on repeated independent demand or unusually concrete purchase intent, but do not spam or automatically build from one vague comment.

For Purchase Guard, do not treat internal/self tests as adoption. Notify only on meaningful external-use evidence, repeated independent requests for the capability, or a concrete request to add payment execution/reconciliation that could justify a paid next step.

Do not start billable managed-agent compute unless a qualifying funded task exists.

## Working capital

Owner-authorized working capital ceiling: $10.

Keep it untouched until a verified paid opportunity actually requires a small spend and the expected economics justify it. Do not spend merely to test the system.

## Revenue truth

As of this reconciliation:

- Verified real external INCOME 2 cash/revenue: **$0**
- Verified real outside Agent Earn settlements: **0 observed**
- `/web-extract`: live and distributed, but listing/availability is not revenue
- Agent Purchase Guard: live free beta; calls/intents are not revenue
- Moltbook account/post: active distribution/demand research, but engagement is not revenue
- Simulated AgentWorld reward: excluded
- TaskBounty available/public code bounties: 0 at latest public-board check
- Human Earn live provider conversions: 0

## Current blockers / next milestones

1. Collect real Moltbook replies and broader agent-demand evidence; identify repeated paid pain instead of guessing the next API.
2. Measure whether external agents actually use the free Purchase Guard beta for retry-safe intents; do not monetize or expand it before usage evidence.
3. Let `/web-extract` obtain genuine marketplace exposure and measure real outside demand.
4. First genuine outside Agent Earn settlement through `/web-extract` or another legitimate agent rail.
5. First Human Earn publisher approval and funded inventory.
6. Expand toward redundant Human Earn supply once approvals make that practical.
7. Complete verified Human Earn conversion → canonical customer ledger attribution using the approved provider's exact economics/security configuration.
8. Solve safe, real customer cash-out before broad consumer launch.
9. Complete external task/bounty payout → canonical customer ledger attribution when a real payout path exists.
10. Run end-to-end ChatGPT reviewer tests against the unified live ledger.
11. Submit INCOME 2 to the public ChatGPT Plugin Directory only after the two launch-gate conditions are true.

## Current strategic judgment

INCOME 2 is no longer primarily blocked by architecture. It is blocked by **demand proof, Human Earn supply, and payout readiness**.

Do not respond to weak demand by endlessly adding features. Use this priority:

**traffic → observe demand → validate repeated pain → build narrowly → distribute → verify real payment → repeat**

The Agent Purchase Guard is the first explicit example of this loop: a narrow beta built from Moltbook/market evidence, kept free and non-custodial until agents prove the differentiated retry-safety behavior matters.

The larger long-term thesis remains: INCOME 2 can become a transaction/demand network where humans and agents turn capability into paid results, while INCOME 2 takes a fee or spread. The x402 utilities are one rail and proof mechanism, not the entire business.

## Continuity rule

When switching chats, start by reading this file and then reconcile it against live state before acting materially.

Before making a material INCOME 2 decision, reconcile against:

- latest GitHub main commits
- live Render deploy/service health
- current Moltbook claim/post/reply state
- current Agent Purchase Guard availability/use evidence
- current Brainbase Task Hunter configuration/tasks
- enabled INCOME 2 Earn Watch automation
- current provider inbox/status
- current official TaskBounty board/docs
- current x402 marketplace visibility and settlement evidence
- current ChatGPT Plugin Directory state when launch status matters

Update this file after material architecture, launch-gate, provider, revenue, distribution, Moltbook, Purchase Guard, or automation changes. Never let stale chat context override verified live state.