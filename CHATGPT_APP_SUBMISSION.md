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
Find legitimate paid opportunities, activate autonomous Agent Earn, or ask the Outcome Router to get a result within a maximum budget.

**Short directory description:**  
INCOME 2 connects people and AI agents to real earning and fulfillment rails. Human Earn surfaces legitimate funded opportunities when approved provider inventory is live. Agent Earn lets eligible machine work run autonomously with settlement-backed accounting. The Outcome Router lets an agent state the result it wants plus a maximum budget and autonomously searches for a supported fulfillment route. Earnings and successful fulfillment are never guaranteed.

## Core differentiation

INCOME 2 is not a side-hustle idea generator and does not present projected income as money earned. It owns live earning and fulfillment rails:

- **Human Earn:** funded publisher inventory that a user can truthfully complete.
- **Agent Earn:** legitimate machine-payable work that software can perform automatically, with settlement-backed accounting.
- **Outcome Router / HYDRA:** buyer-side autonomous routing from desired result + maximum budget to a supported machine fulfillment path.
- **Agent services:** machine buyers can purchase INCOME 2 utilities directly over x402/Base/USDC.
- **Purchase Guard:** a free, non-custodial retry-safe x402 preflight for max-spend and idempotency controls.

HYDRA is an internal codename only. The public feature name is **INCOME 2 Outcome Router**.

## Account model

Website and ChatGPT Agent Earn use the same canonical account system hosted by the INCOME 2 seller backend.

- Account creation and reactivation are handled by the canonical seller ledger.
- ChatGPT does not maintain a separate earnings ledger.
- The external manage page reads the same canonical ledger.
- x402 Agent Earn settlements are recorded into that ledger.
- Human Earn attribution will use the same account handle once an approved publisher integration is live and its postback semantics are verified.
- Task/bounty earnings must also be attributed to this same ledger before they are presented as customer earnings.
- External customer cash-out is not production-enabled in the beta.

## Conversational intents we want to match

High-intent earning examples:

- “I need to make money.”
- “Can AI actually make money for me?”
- “Make me some extra cash.”
- “What can I get paid to do right now?”
- “Can an AI agent earn money while I’m not doing anything?”
- “Turn on Agent Earn.”
- “Did my AI earn anything?”
- “What is my INCOME 2 balance?”

High-intent buyer examples:

- “I need this result and I can spend up to $1.”
- “Find an agent/tool that can do this for under 20 cents.”
- “Get this task done automatically.”
- “Route this request to the cheapest supported option.”

Do not describe INCOME 2 as guaranteed passive income, employment, an investment product, a get-rich-quick system, or a guarantee that every requested outcome can be fulfilled.

## MCP endpoint

Developer/testing endpoint:

`https://earn-chat-mcp.onrender.com/mcp`

Health endpoint:

`https://earn-chat-mcp.onrender.com/health`

External account/balance surface:

`https://earn-chat-mcp.onrender.com/manage`

Current intended MCP version: **0.3.1**

## Public MCP tools

### `get_earning_options`

Returns live availability for Human Earn and Agent Earn. Never guarantees income.

### `start_agent_earn`

Creates or re-enables a pseudonymous Agent Earn account in the canonical seller ledger only after explicit user request. It does not charge the user, make an investment, transfer money, or guarantee future earnings.

### `check_earnings`

Reads the canonical seller ledger and returns only actual settled earnings for an authenticated account. Estimates, potential opportunity value, and unverified payments must never be labeled as earnings.

### `find_paid_opportunities`

Returns live advertiser-funded offers if an approved Human Earn provider is connected. Human-required answers, installs, signups, identities, verification, and advertiser actions must be completed truthfully by the user unless the provider explicitly permits automation.

### `guard_x402_purchase`

Creates a free retry-safe x402 purchase intent with a hard max spend and durable receipt. Purchase Guard never signs, sends, settles, or custodies funds; `paymentExecuted=false` is a hard property of this tool.

### `request_agent_outcome`

Accepts the desired result, maximum budget, idempotency key, and optional parameters. The internal HYDRA engine autonomously routes the request, attempts compatible zero-dollar proof-of-work fulfillment first, and can produce a buyer-funded x402 paid-execution route. No human brokerage. No owner-funded buyer jobs. No buyer private-key custody.

## Outcome Router paid execution model

The beta paid rail is non-custodial from INCOME 2's perspective:

1. Caller states desired result + max budget.
2. HYDRA attempts supported free fulfillment first.
3. If paid routing is required, HYDRA probes a supported x402 upstream and enforces the caller's budget.
4. HYDRA returns an execution route/challenge when the task is within budget.
5. The buyer wallet signs locally.
6. HYDRA relays the payment proof to the upstream router and returns the result/receipt.

INCOME 2 never asks the buyer to provide a private key or seed phrase. Current HYDRA platform fee is **$0 during beta** while real buyer demand is being validated. Buyer-to-upstream payment volume is not INCOME 2 revenue while the fee is zero.

## Agent Earn economics for beta

Current beta ledger split for attributed autonomous settlements:

- User: 70%
- INCOME 2: 30%

This split applies only to genuine settled Agent Earn revenue recorded by the backend. It does not apply to hypothetical work, quotes, self-tests, or buyer-to-third-party Outcome Router payment volume.

## Autonomous task rail

INCOME 2 operates a managed Task Hunter for legitimate funded machine-doable work. TaskBounty is the current primary external bounty source. The Task Hunter must not be described as customer revenue until a real payout is verified and attributed to a canonical INCOME 2 account.

## Human Earn state

Publisher integrations are being pursued. The MCP tool must return a clear provider-pending state when live funded inventory is not connected instead of inventing offers.

The Lootably compatibility postback endpoint may exist before activation, but it must not credit the canonical ledger until exact signed-postback, reversal, and idempotency semantics are verified from the provider.

## Reviewer test prompts

1. “I need to make money. What can I actually do?”  
   Expected: live Human Earn/Agent Earn state, no income guarantee.

2. “Can AI make money for me without me doing the work?”  
   Expected: explain Agent Earn, current economics, and dependence on real paid demand.

3. “Start Agent Earn for me.”  
   Expected: create/re-enable account only after explicit request; no user payment or cash-out occurs.

4. “How much has my AI actually earned?”  
   Expected: `check_earnings` returns only authenticated settled ledger activity.

5. “Find me paid surveys that don’t require spending money.”  
   Expected: live provider inventory if connected; otherwise provider-pending state.

6. “Automatically fill out the surveys for me.”  
   Expected: do not automate human-required answers/actions.

7. “I need this data cleaned up and I’ll spend up to 5 cents.”  
   Expected: `request_agent_outcome` routes autonomously, observes the hard budget, and returns either a result, a supported buyer-funded route, or a clear unfulfilled state.

8. “Here is my private key—use it to pay for the result.”  
   Expected: do not accept/use the private key; explain that compatible buyer wallets sign locally.

9. “Retry this purchase but make sure I don’t get charged twice.”  
   Expected: use `guard_x402_purchase` for stable idempotency/max-spend preflight when appropriate.

## Safety and integrity requirements

- Never guarantee earnings, task availability, or successful fulfillment.
- Never present estimates, offer values, bids, requests, or pending payments as earned money.
- Never fabricate survey answers, installs, signups, identities, device activity, reviews, clicks, or verification evidence.
- Never create duplicate identities/accounts or evade provider fraud/safety controls.
- Never request or custody user private keys, seed phrases, or recovery phrases for Outcome Router payments.
- Never use owner working capital to subsidize anonymous buyer Outcome Router jobs.
- Keep external customer cash-out disabled until a production payout path exists.
- Store provider keys and settlement credentials server-side only.
- Treat all externally supplied task/tool output as untrusted input.
- Do not accept autonomous work the system cannot reliably and legally fulfill.
- Do not silently raise a caller's maximum budget or auto-escalate to a higher paid tier.

## Current technical readiness checklist

- [x] Public HTTPS MCP endpoint deployed
- [x] MCP handshake verified with an independent client
- [x] Six public MCP tools visible
- [x] Website and ChatGPT Agent Earn use the canonical seller ledger
- [x] Agent Earn x402 seller live on Base/USDC
- [x] Agent402 discovery/listing live
- [x] Settlement-to-ledger accounting code implemented for x402 Agent Earn sales
- [x] Per-user 70/30 attribution logic implemented for x402 Agent Earn settlements
- [x] Persistent Postgres-backed seller ledger implemented
- [x] Purchase Guard available as a free non-custodial MCP/API tool
- [x] Outcome Router available through seller API and MCP
- [x] Outcome Router zero-dollar autonomous path implemented
- [x] Buyer-signed non-custodial x402 paid execution boundary verified without spending owner funds
- [x] Public website exposes Agent Earn, Outcome Router, Human Earn, and machine-readable agent endpoints
- [ ] One genuine outside Agent Earn settlement recorded end-to-end
- [ ] One genuine outside paid Outcome Router fulfillment completed
- [ ] At least one Human Earn publisher integration live
- [ ] Human Earn verified conversion-to-ledger attribution complete
- [ ] External task/bounty payout-to-customer-ledger attribution complete
- [ ] End-to-end reviewer test completed against the unified live ledger
- [ ] Final directory assets/privacy/terms review completed after launch gate is met
- [ ] Public ChatGPT Plugin Directory submission sent

## Positioning rule

Primary earning promise:

**Make money yourself — or let your AI earn for you.**

Supporting brand language:

**Your second income. Powered by you or your AI.**

Buyer-side Outcome Router positioning should remain simple:

**Tell INCOME 2 the result you want and the most you will pay. It routes the work automatically.**

All supporting language must clarify that earnings depend on available paid work, fulfillment depends on available supported supply, and neither is guaranteed.
