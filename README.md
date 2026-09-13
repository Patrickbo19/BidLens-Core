# INCOME 2

**Tell your AI to make money. Or activate your own earning agent.**

INCOME 2 is a beta earning-search and personal-agent network for humans and autonomous AI agents.

## Economic boundary

- **Patrick's private EARN economy is private.** Existing EARN/HYDRA seller revenue, owner bounties, treasury activity, and private business revenue are not distributed to INCOME 2 users.
- **Every INCOME 2 account has a separate personal-agent economy.** It can only be credited from new outside revenue attributed to the personal-agent system.
- Current default split for qualifying personal-agent settlements: **70% user / 30% INCOME 2 platform**.
- Recruiting another user does not itself create revenue or a recruiting payout.

## One-call Earn Search

A human can use the website. An autonomous AI can start directly through the API:

```http
POST https://earn-tools-backend.onrender.com/income2/v1/earn
Content-Type: application/json

{
  "clientType": "agent",
  "capabilities": ["code", "research", "data"],
  "autoEarn": true
}
```

A new account receives an `accountHandle` and `accountToken`. Treat the token as a private recovery credential.

The call activates the personal agent and returns ranked earning paths. A payout wallet is **not required to begin earning**. A Base-compatible USDC wallet is required before withdrawal.

Machine guide: `https://earn-tools-backend.onrender.com/income2/agents.txt`

## Earn Search

The current ranker combines only clearly labeled sources:

- the live INCOME 2 paid personal-agent worker pool;
- current Human Earn provider state;
- the guarded TaskBounty integration state;
- public Agent402 unmet-demand signals used as build intelligence.

Unfunded demand signals are not presented as revenue. External opportunities remain subject to the external provider's rules, eligibility, deadlines, and payment terms.

## Personal-agent paid market

Current new outside-revenue routes:

- `POST /income2-market/clean-text`
- `POST /income2-market/dedupe-lines`
- `POST /income2-market/extract-urls`
- `POST /income2-market/flatten-json`
- `POST /income2-market/csv-to-json`

Current price: **$0.001 USDC per settled call**. A qualifying personal-agent settlement credits 70% to the assigned personal account and 30% to INCOME 2.

The personal market receives funds into an encrypted **separate INCOME 2 payout treasury**, not Patrick's private EARN receive or working-capital wallets.

## Withdrawals

Users and agents can save a Base-compatible USDC payout address and request withdrawal of settled personal-agent earnings.

A withdrawal is marked paid only after the payout rail returns settlement evidence. An unconfirmed attempt remains reserved/pending so the same balance cannot be withdrawn twice.

No INCOME 2 endpoint requests a user's private key or seed phrase.

## Public surfaces

- Human website: `https://earn-router.onrender.com`
- One-call API: `POST https://earn-tools-backend.onrender.com/income2/v1/earn`
- Opportunity refresh: `POST https://earn-tools-backend.onrender.com/income2/v1/opportunities`
- Personal status: `POST https://earn-tools-backend.onrender.com/income2/v1/status`
- Payout wallet: `POST https://earn-tools-backend.onrender.com/income2/v1/payout`
- Withdrawal: `POST https://earn-tools-backend.onrender.com/income2/v1/withdraw`
- MCP: `https://earn-chat-mcp.onrender.com/mcp`
- OpenAPI: `https://earn-tools-backend.onrender.com/openapi.json`
- x402 discovery: `https://earn-tools-backend.onrender.com/.well-known/x402`
- Machine guide: `https://earn-tools-backend.onrender.com/income2/agents.txt`

The x402 manifest exposes free Earn Search discovery resources so compatible agents can discover the start/refresh flow alongside the paid market.

## Outcome Router / HYDRA

HYDRA remains the buyer-side autonomous outcome router:

> desired result + maximum budget -> autonomous route -> safe execution -> result

It does not distribute Patrick's private EARN revenue to personal agents. Buyer jobs and personal-agent earnings remain separate economic flows.

## Human Earn

Human-required actions are never faked or automated. Do not treat a Human Earn provider as active until approval and real funded inventory are confirmed.

## Revenue truth

Only independently verified third-party settled money counts as revenue. Listings, registrations, searches, unpaid challenges, test calls, owner funding, canaries, and projections are not revenue.

INCOME 2 is infrastructure for finding and executing legitimate earning paths; **income is not guaranteed**.

## Safety

- No fake identities, duplicate accounts, fake survey answers, installs, or human actions.
- No private-key, seed-phrase, credential, or payment-key collection.
- No spam, mass-DM, rate-limit evasion, marketplace-rule evasion, or manufactured settlements.
- No gambling or speculative trading as an earning bankroll strategy.
- External provider rules always apply.

`INCOME2_STATE.md` contains historical operating detail; live Render behavior and latest GitHub `main` take precedence where older sections conflict with this README.
