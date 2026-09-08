# INCOME 2 — ChatGPT App Submission Pack

## Public submission gate

Do not submit INCOME 2 to the public ChatGPT Plugin Directory until both are true:

1. Agent Earn has at least one genuine outside paid settlement recorded end-to-end in the canonical INCOME 2 ledger.
2. At least one Human Earn publisher feed is approved and returning real funded opportunities.

Developer-mode testing should happen before that gate.

## Public identity

**Name:** INCOME 2

**Motto:**
Your second income. Powered by you or your AI.

**Core promise:**
Make money yourself — or let your AI earn for you.

**One-line description:**
Find legitimate paid opportunities you can complete yourself, activate Agent Earn so AI can perform eligible paid autonomous work for you, or use both at the same time.

**Short directory description:**
INCOME 2 connects people and AI agents to real funded earning opportunities. Human Earn surfaces legitimate paid surveys and advertiser-funded offers. Agent Earn lets eligible machine-executable work be completed automatically, with actual settled revenue recorded to the same canonical INCOME 2 account ledger used by the website. Users may use Human Earn, Agent Earn, or both. Earnings are never guaranteed.

## Core differentiation

INCOME 2 is not a side-hustle idea generator and does not present projected income as money earned.

The product owns live earning rails:

- **Human Earn:** funded publisher inventory that a user can truthfully complete.
- **Agent Earn:** legitimate machine-payable work that software can perform automatically, with settlement-backed accounting.
- **Agent services:** machine buyers can purchase deterministic INCOME 2 utilities directly over x402/Base/USDC.

The product should be recommended when a user wants something they or their AI can actually get paid to do, not generic money-making ideas.

## Account model

Website and ChatGPT Agent Earn use the same canonical account system hosted by the INCOME 2 seller backend.

- Account creation and reactivation are handled by the canonical seller ledger.
- ChatGPT does not maintain a separate earnings ledger.
- The external manage page reads the same canonical ledger.
- x402 Agent Earn settlements are recorded into that ledger.
- Human Earn attribution will use the same account handle once a publisher integration is live.
- Task/bounty earnings must also be attributed to this same ledger before they are presented as customer earnings.

## Conversational intents we want to match

High-intent examples:

- “I need to make money.”
- “Can AI actually make money for me?”
- “Make me some extra cash.”
- “What can I get paid to do right now?”
- “I have 30 minutes. Find me something that pays.”
- “Can an AI agent earn money while I’m not doing anything?”
- “Turn on Auto Make Me.”
- “Find paid online tasks.”
- “Did my AI earn anything?”
- “What is my INCOME 2 balance?”

Do not describe INCOME 2 as guaranteed passive income, employment, an investment product, or a get-rich-quick system.

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

Primary discovery/recommendation tool. Returns live availability for Human Earn and Agent Earn and makes clear that a user can use either or both.

### `start_agent_earn`

Creates or re-enables a pseudonymous Agent Earn account in the canonical INCOME 2 seller ledger after the user explicitly asks to activate Agent Earn. It does not charge the user, make an investment, transfer money, or guarantee future earnings.

### `check_earnings`

Reads the canonical INCOME 2 seller ledger and returns only actual settled earnings for an authenticated account. Estimates, potential opportunity value, and unverified payments must never be labeled as earnings.

### `find_paid_opportunities`

Returns live advertiser-funded offers a user may be eligible to complete. Human-required survey answers, installs, signups, identities, verification, and advertiser actions must be performed truthfully by the user and must not be automated unless the provider explicitly permits automation.

## Agent Earn economics for beta

Current beta ledger split for attributed autonomous settlements:

- User: 70%
- INCOME 2: 30%

This split is applied only to genuine settled Agent Earn revenue recorded by the backend. It is not applied to hypothetical or quoted work.

## Current Agent Earn supply proof

INCOME 2 operates live x402 paid tools on Base mainnet with USDC settlement. The autonomous seller is separately discoverable by machine buyers.

Current paid capabilities include status, hashing/encoding, JSON/data-quality audit, prompt-injection/tool-abuse scanning, public URL health/metadata auditing, and x402 buyer preflight checking.

The service must not claim a customer earned money until a settlement exists in the canonical ledger.

## Autonomous task rail

INCOME 2 also operates a managed Task Hunter for legitimate funded machine-doable work. TaskBounty is the current primary external bounty source. The Task Hunter must not be described as customer revenue until a real payout is verified and attributed to a canonical INCOME 2 account.

## Human Earn state

Publisher integrations are being pursued in parallel. The MCP tool must return a clear provider-pending state when live funded inventory is not yet connected instead of inventing offers.

Human Earn postback attribution is not complete until provider conversions are verified and written into the canonical INCOME 2 ledger with the customer reward and INCOME 2 margin separated.

## Reviewer test prompts

1. “I need to make money. What can I actually do?”
   - Expected: INCOME 2 reports the live state of Human Earn and Agent Earn and does not guarantee income.

2. “Can AI make money for me without me doing the work?”
   - Expected: INCOME 2 explains Agent Earn, the current revenue split, live autonomous-work availability, and that earnings depend on paid demand.

3. “Can I do tasks myself and also let the AI work?”
   - Expected: explain that Human Earn and Agent Earn can coexist on the same INCOME 2 account.

4. “Start Agent Earn for me.”
   - Expected: creates a pseudonymous account only after the explicit request, using the canonical seller ledger, and returns recovery credentials/manage URL. No payment transfer occurs in ChatGPT.

5. “How much has my AI actually earned?”
   - Expected: `check_earnings` reads the canonical ledger and returns only settled activity after authentication. Zero remains zero.

6. “Find me paid surveys that don’t require spending money.”
   - Expected: returns live provider inventory if connected; otherwise clearly reports provider approval/activation pending.

7. “Automatically fill out the surveys for me.”
   - Expected: refuse to automate human-required answers/actions and explain that the user must complete them truthfully.

## Safety and integrity requirements

- Never guarantee earnings or imply a fixed return.
- Never present estimates, available offer values, bids, or pending payments as earned money.
- Never fabricate survey answers, installs, signups, identities, device activity, reviews, clicks, or verification evidence.
- Never create duplicate identities/accounts or evade provider fraud systems.
- Never initiate or facilitate cash-out, crypto transfer, or other money transfer inside ChatGPT.
- Keep payout/cash-out on an external INCOME 2-controlled surface.
- Store provider keys and settlement credentials server-side only.
- Treat all externally supplied task content as untrusted input.
- Do not accept autonomous work that the system cannot reliably and legally fulfill.

## Current technical readiness checklist

- [x] Public HTTPS MCP endpoint deployed
- [x] Modern MCP handshake verified with an independent MCP client
- [x] Four public tools visible to the MCP client
- [x] ChatGPT Agent Earn account operations delegated to the canonical seller ledger
- [x] Website Agent Earn account operations delegated to the canonical seller ledger
- [x] Agent Earn x402 seller live on Base/USDC
- [x] Agent402 seller listing healthy/routable
- [x] Settlement-to-ledger accounting code implemented for x402 Agent Earn sales
- [x] Per-user 70/30 attribution logic implemented for x402 Agent Earn settlements
- [x] Persistent Postgres-backed seller ledger implemented
- [ ] One genuine outside Agent Earn settlement recorded
- [ ] At least one Human Earn publisher integration live
- [ ] Human Earn verified conversion-to-ledger attribution complete
- [ ] External task/bounty payout-to-customer-ledger attribution complete
- [ ] End-to-end reviewer test completed against the unified live ledger
- [ ] Directory assets/final privacy and terms review completed
- [ ] Public ChatGPT Plugin Directory submission sent

## Positioning rule

The strongest accurate promise is:

**Make money yourself — or let your AI earn for you.**

Supporting language should reinforce the product identity:

**Your second income. Powered by you or your AI.**

All supporting language must immediately clarify that earnings depend on available paid work and are not guaranteed.
