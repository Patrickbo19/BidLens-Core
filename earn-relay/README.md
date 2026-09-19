# EARN Relay

**AI agents should not dead-end.**

EARN Relay is a non-web CLI + MCP escalation bus that lets an AI agent turn a blocker into a **sanitized, bounded paid work request** on Gibwork, then resume the parent workflow when outside work returns.

The idea is simple:

```
AI agent working
      |
      | hits a capability gap
      v
EARN Relay
  - strips secrets
  - states the missing output
  - creates acceptance tests
  - caps budget + deadline
      |
      v
Gibwork work market
      |
      | worker / specialist completes missing piece
      v
result -> parent agent resumes
```

This makes Gibwork useful as a **last-mile execution layer for autonomous software**, not just a place humans browse for bounties.

## Why this matters

Today an agent often fails when it needs something outside its tool boundary: a physical-device reproduction, a local observation, a specialist review, a dataset that requires human judgment, a compatibility test, a creative asset, or a task that another worker can complete faster.

Relay turns **"I can't do this"** into **"I can buy the missing capability under policy."**

That is a practical path toward agents becoming economically complete workers.

## Hackathon fit

EARN Relay is designed for the Gibwork Developer Hackathon's non-web requirement.

It uses Gibwork as a core execution rail through `@gibwork/sdk` and provides:

- terminal CLI
- MCP tools for AI agents
- public-task market scan
- deterministic secret redaction
- bounded reward calculation
- explicit acceptance criteria
- dry-run by default
- live posting only with an operator-configured local wallet and `--confirm`

It is intentionally **not** another bounty finder, ranking dashboard, or generic task compiler. Its job is to let an already-running agent **escalate one missing capability to the labor market and continue its original job**.

## Install

```bash
cd earn-relay
npm install
npm run build
npm test
```

Node.js 22+ is required by the current Gibwork SDK.

## Demo

```bash
npm run demo
```

Example:

```
Parent objective:
Ship a production patch before the deployment window closes.

Why the agent escalated:
The parent coding agent cannot reproduce a device-specific Android failure.

Required output:
A reproducible bug report with device model, Android version, exact steps,
logs, and a minimal failing test or patch suggestion.

Budget ceiling: 75.00 USDC
Deadline: 6 hours
```

The demo is a dry run. It creates no bounty and spends no money.

## CLI

Create a blocker file:

```json
{
  "objective": "Finish a cross-platform bug fix",
  "blocker": "The agent cannot test the failure on a physical Android device",
  "context": "Public repo: https://github.com/example/project",
  "requiredOutput": "Reproduction steps, sanitized logs, and a failing test or patch recommendation",
  "acceptance": [
    "Name device model and Android version",
    "Provide exact reproduction steps",
    "Include sanitized logs",
    "Provide a failing test or concrete patch recommendation"
  ],
  "deadlineHours": 6,
  "maxBudgetUsdc": 75,
  "sensitivity": "sanitized-public",
  "tags": ["android", "qa", "reproduction"]
}
```

Preview the escalation:

```bash
earn-relay plan blocker.json
earn-relay escalate blocker.json
```

Inspect the live Gibwork market:

```bash
earn-relay market --limit 10
```

Live posting is intentionally explicit:

```bash
export GIBWORK_PRIVATE_KEY='...'
earn-relay escalate blocker.json --confirm
```

Never commit a private key. Relay does not accept a wallet key as a CLI argument.

## MCP

Run:

```bash
npm run mcp
```

Tools:

| Tool | Purpose |
|---|---|
| `relay_plan_escalation` | blocker -> sanitized paid-work plan |
| `relay_scan_market` | inspect current Gibwork inventory |
| `relay_post_escalation` | explicit-confirm live posting through `@gibwork/sdk` |

Example client config after build:

```json
{
  "mcpServers": {
    "earn-relay": {
      "command": "node",
      "args": ["/absolute/path/to/earn-relay/dist/mcp.js"]
    }
  }
}
```

## Safety boundary

Relay is designed to keep transaction authority outside the task-reading model:

- untrusted task text never receives wallet credentials
- likely credential strings are removed before public escalation
- budgets are capped before any live action
- dry-run is the default
- posting requires an explicit `confirm`
- no private resource should be embedded in a bounty
- acceptance criteria are preserved as deterministic text for downstream verification

## Business model

The open-source wedge is agent escalation.

A hosted version can monetize three layers without depending on ads:

1. **Relay Pro** — policy, audit, organization rules, private execution pools.
2. **Outcome fee** — percentage of successfully completed externally fulfilled jobs.
3. **Enterprise runtime** — SLA, procurement controls, receipt/settlement export, multi-agent budget governance.

The economic thesis is not "sell another AI chatbot." It is:

> When autonomous agents can safely buy the one capability they are missing, every blocked agent becomes a buyer of labor.

## Status

v0.1 implements the core blocker -> sanitized plan -> Gibwork dry-run/live-post boundary.

Next milestones:
- poll task/submission lifecycle
- acceptance-test verifier
- result ingestion back into parent agent
- receipt bundle binding objective -> bounty -> submission -> verification -> payout
- cross-market adapters behind the same escalation contract
