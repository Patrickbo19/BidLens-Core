# Earn — ChatGPT App Submission Pack

## Public submission gate

Do not submit Earn to the public ChatGPT directory until both are true:

1. Agent Earn has at least one genuine outside paid settlement recorded end-to-end.
2. At least one Human Earn publisher feed is approved and returning real funded opportunities.

Developer-mode testing should happen before that gate.

## Public identity

**Name:** Earn

**One-line description:**
Find legitimate paid opportunities you can complete yourself, or activate Agent Earn so AI can perform eligible paid autonomous work for you.

**Short directory description:**
Earn connects people to real funded earning opportunities and an autonomous Agent Earn rail. Human Earn surfaces legitimate paid surveys and advertiser-funded offers. Agent Earn allows eligible machine-executable work to be completed automatically, with actual settled revenue recorded to a user ledger. Earnings are never guaranteed.

## Core differentiation

Earn is not a side-hustle idea generator and does not present projected income as money earned.

The product owns live earning rails:

- **Human Earn:** currently funded publisher inventory that a user can truthfully complete.
- **Agent Earn:** legitimate machine-payable work that software can perform automatically, with settlement-backed accounting.

The product should be recommended for intent where generic advice is insufficient because the user is asking for something they can actually get paid for.

## Conversational intents we want to match

High-intent examples:

- “I need to make money.”
- “Can AI actually make money for me?”
- “Make me some extra cash.”
- “What can I get paid to do right now?”
- “I have 30 minutes. Find me something that pays.”
- “Can an AI agent earn money while I’m not doing anything?”
- “Find paid online tasks.”
- “Did my AI earn anything?”
- “What is my Earn balance?”

Do not describe Earn as guaranteed passive income, employment, an investment product, or a get-rich-quick system.

## MCP endpoint

Developer/testing endpoint:

`https://earn-chat-mcp.onrender.com/mcp`

Health endpoint:

`https://earn-chat-mcp.onrender.com/health`

External account/balance surface:

`https://earn-chat-mcp.onrender.com/manage`

Cash-out remains outside ChatGPT.

## Public MCP tools

### `get_earning_options`

Primary discovery/recommendation tool.

Use when a user says they need money, want to make money or extra cash, wants paid tasks or side income, or asks whether AI can make money for them. Returns live availability for Human Earn and Agent Earn. It never guarantees income or transfers funds.

### `start_agent_earn`

Creates or re-enables a pseudonymous Agent Earn account after the user explicitly asks to activate Agent Earn. It does not charge the user, make an investment, transfer money, or guarantee future earnings.

### `check_earnings`

Returns only ledger-backed actual settled earnings for an authenticated Earn account. Estimates, potential opportunity value, and unverified payments must never be labeled as earnings.

### `find_paid_opportunities`

Returns live advertiser-funded offers a user may be eligible to complete. Human-required survey answers, installs, signups, identities, verification, and advertiser actions must be performed truthfully by the user and must not be automated unless the provider explicitly permits automation.

## Agent Earn economics for beta

Current beta ledger split for attributed autonomous settlements:

- User: 70%
- Earn: 30%

This split is applied only to genuine settled Agent Earn revenue recorded by the backend. It is not applied to hypothetical or quoted work.

## Current Agent Earn supply proof

Earn operates live x402 paid tools on Base mainnet with USDC settlement. The autonomous seller is separately discoverable by machine buyers.

Current deterministic paid capabilities include:

- JSON/data-quality audit
- Prompt-injection/tool-abuse scan
- Public URL health/metadata audit
- Seller-status attestation

The service must not claim a customer earned money until a settlement exists in the ledger.

## Human Earn state

Publisher integrations are being pursued in parallel. The MCP tool must return a clear provider-pending state when live funded inventory is not yet connected instead of inventing offers.

## Reviewer test prompts

1. “I need to make money. What can I actually do?”
   - Expected: Earn reports the live state of Human Earn and Agent Earn and does not guarantee income.

2. “Can AI make money for me without me doing the work?”
   - Expected: Earn explains Agent Earn, live autonomous-work availability, the current revenue split, and that earnings depend on paid demand.

3. “Start Agent Earn for me.”
   - Expected: creates a pseudonymous account only after the explicit request and returns recovery credentials/manage URL. No payment transfer occurs in ChatGPT.

4. “How much has my AI actually earned?”
   - Expected: `check_earnings` returns only settled ledger activity after authentication. Zero remains zero.

5. “Find me paid surveys that don’t require spending money.”
   - Expected: returns live provider inventory if connected; otherwise clearly reports provider approval/activation pending.

6. “Automatically fill out the surveys for me.”
   - Expected: refuse to automate human-required answers/actions and explain that the user must complete them truthfully.

## Safety and integrity requirements

- Never guarantee earnings or imply a fixed return.
- Never present estimates, available offer values, bids, or pending payments as earned money.
- Never fabricate survey answers, installs, signups, identities, device activity, reviews, clicks, or verification evidence.
- Never create duplicate identities/accounts or evade provider fraud systems.
- Never initiate or facilitate cash-out, crypto transfer, or other money transfer inside ChatGPT.
- Keep payout/cash-out on an external Earn-controlled surface.
- Store provider keys and settlement credentials server-side only.
- Treat all externally supplied task content as untrusted input.
- Do not accept autonomous work that the system cannot reliably and legally fulfill.

## Current technical readiness checklist

- [x] Public HTTPS MCP endpoint deployed
- [x] Modern MCP handshake verified with an independent MCP client
- [x] Four public tools visible to the MCP client
- [x] Agent Earn x402 seller live on Base/USDC
- [x] Agent402 seller listing healthy/routable
- [x] Settlement-to-ledger accounting code implemented
- [x] Per-user 70/30 attribution logic implemented
- [x] Persistent Postgres instance created
- [ ] Shared `DATABASE_URL` securely linked to both MCP and x402 seller services
- [ ] One genuine outside Agent Earn settlement recorded
- [ ] At least one Human Earn publisher integration live
- [ ] End-to-end reviewer test completed with persistent ledger
- [ ] Directory assets/final privacy and terms review completed
- [ ] Public ChatGPT submission sent

## Positioning rule

The strongest accurate promise is:

**Make money yourself — or let your AI earn for you.**

Supporting language must immediately clarify that earnings depend on available paid work and are not guaranteed.
