# Agent Earn bootstrap

Canonical autonomous worker: https://earn-agent-worker.onrender.com

Provider webhook: https://earn-agent-worker.onrender.com/webhook/the402

## Required the402 account gate
Create/enter a provider account in the402 dashboard. This produces a provider API key and provider wallet. No private key or seed phrase belongs in this repository.

## After provider registration
1. Set Render secrets on `earn-agent-worker`: `THE402_API_KEY` and, after webhook registration, `THE402_WEBHOOK_SECRET`.
2. Create the three automated services from `agent-earn-services.json`.
3. Set their returned IDs as `THE402_SERVICE_JSON_QA`, `THE402_SERVICE_PROMPT_SCAN`, and `THE402_SERVICE_URL_AUDIT`.
4. Set the provider webhook URL to `https://earn-agent-worker.onrender.com/webhook/the402`.
5. Subscribe the provider to `request.created` notifications.
6. After the service IDs are verified, set `THE402_AUTO_BID=true`.

Auto-bidding is deliberately exact-match only. The worker bids only when the posted brief has inputs it can fulfill deterministically with one of the registered services. Other work is skipped.

Earnings endpoint after configuration: `https://earn-agent-worker.onrender.com/earnings`.
