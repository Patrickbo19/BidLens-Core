# INCOME 2 — Canonical State

Last reconciled: 2026-09-08 00:08 America/New_York

This file is the canonical non-secret state summary for INCOME 2. Reconcile it against live services, provider messages, and current external markets before changing a material status. Never put API keys, private credentials, recovery tokens, seed phrases, solver capability keys, or other secrets here.

## Product

**Brand:** INCOME 2

**Motto:** Your second income. Powered by you or your AI.

**Core promise:** Make money yourself — or let your AI earn for you.

A human user may use both modes at the same time:

- **Human Earn:** the user completes legitimate human-required paid opportunities truthfully.
- **Agent Earn / Auto Make Me:** AI performs eligible machine-doable paid work.

INCOME 2 is also agent-native: outside AI agents can discover and pay for machine services programmatically.

## Business model

INCOME 2 earns when legitimate paid activity flows through the platform.

Current Agent Earn beta split for attributed settled autonomous revenue:

- User: 70%
- INCOME 2: 30%

Human Earn economics may use provider-specific user reward / publisher margin rather than the Agent Earn 70/30 split. Do not assume Human Earn is 70/30 unless explicitly configured.

Only real settled third-party payments count as revenue. Listings, available tasks, estimates, simulated rewards, submissions, accepted-but-unpaid work, and projections are not revenue.

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

All are sourced from `Patrickbo19/BidLens-Core` main branch and currently configured for Render auto-deploy on commit.

- `earn-router` — customer-facing INCOME 2 website / Human Earn router
- `earn-tools-backend` — canonical account ledger, x402 seller, TaskBounty vault/solver bridge
- `earn-chat-mcp` — ChatGPT MCP/plugin surface; uses canonical seller ledger
- `earn-agent-worker` — older autonomous worker service; not the primary TaskBounty managed solver

Latest reconciled Render state: all four Earn services deployed successfully from the latest main commit.

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

Current unit price: $0.001 per paid route

Current live tool count: 12

Capabilities include:

- seller status
- SHA-256
- SHA-512
- HMAC-SHA256
- Base64 encode/decode
- JWT decode
- combined hash/encode tool
- JSON data-quality audit
- prompt-injection/tool-abuse scan
- public URL health/metadata audit
- x402 buyer preflight check

Latest reconciled buyer visibility:

- Agent402: listed, routable, 12 tools
- 402Index: INCOME 2 buyer-check and prompt-scan registrations accepted but pending review/domain verification
- x402 Arena re-registration may return `409 Agent name already taken`; treat that as an existing-name condition, not a sale or revenue event

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

TaskBounty currently publicly supports AI agents, an 80/20 solver/platform split, and multiple payout methods including USDC on Base.

## Historical AgentWorld proof

The worker previously completed the full browse → claim → create deliverable → submit loop on AgentWorld.

The displayed reward was simulation-only (`sim_only` / payout source `sim`). It is NOT verified INCOME 2 revenue.

## Human Earn

Current target/provider work includes Lootably plus other publisher applications.

Latest reconciled inbox state:

- Lootably application sent; no approval received yet.
- TapResearch application sent; no approval received yet.
- ayeT Studios acknowledged the request and said it is under review; no approval yet.

Lootably integration code can fetch/rank offers once credentials exist.

Before crediting real Human Earn USD balances, configure and verify the provider's actual currency/reward relationship and postback signature rules. For Lootably, official postbacks include userID, transactionID, revenue, currencyReward, status, and SHA-256 hash verification using the placement postback secret.

Do not fabricate inventory while provider activation is pending.

## Autonomous controller

ChatGPT automation:

- Title: `INCOME 2 Earn Watch`
- Enabled: yes
- Frequency: hourly
- Mode: condition watch

It now monitors:

- TaskBounty auth + current funded public inventory
- Task Hunter duplicate-run prevention and economics gate
- x402 seller/ledger
- buyer visibility
- ChatGPT MCP health and canonical-ledger architecture
- Human Earn router/provider state
- Gmail for meaningful Lootably/TapResearch/ayeT approval/rejection/action-required messages
- the two-condition public ChatGPT launch gate

Do not start billable managed-agent compute unless a qualifying funded task exists.

## Working capital

Owner-authorized working capital ceiling: $10.

Keep it untouched until a verified paid opportunity actually requires a small spend and the expected economics justify it. Do not spend merely to test the system.

## Revenue truth

As of this reconciliation:

- Verified real external INCOME 2 cash/revenue: **$0**
- Verified real outside Agent Earn settlements: **0 observed in seller settlement logs**
- Simulated AgentWorld reward: excluded
- TaskBounty available/public bounties: 0 at latest public-board check
- Human Earn live provider conversions: 0

## Current blockers / next milestones

1. First genuine outside Agent Earn settlement.
2. First Human Earn publisher approval and funded inventory.
3. Complete verified Human Earn conversion → canonical customer ledger attribution using the approved provider's exact economics/security configuration.
4. Complete external task/bounty payout → canonical customer ledger attribution when a real payout path exists.
5. Run end-to-end ChatGPT reviewer tests against the unified live ledger.
6. Submit INCOME 2 to the public ChatGPT Plugin Directory only after the two launch-gate conditions are true.

## Continuity rule

Before making a material INCOME 2 decision, reconcile this file against:

- latest GitHub main commits
- live Render deploy/service health
- current Brainbase Task Hunter configuration/tasks
- enabled INCOME 2 Earn Watch automation
- current provider inbox/status
- current official TaskBounty board/docs
- current ChatGPT Plugin Directory state when launch status matters

Update this file after material architecture, launch-gate, provider, revenue, or automation changes. Never let stale chat context override verified live state.
