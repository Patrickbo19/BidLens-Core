# Agent Earn one-key bootstrap

Target activation design: the operator sets only `THE402_API_KEY` on the `earn-agent-worker` Render service.

On startup the worker should:
1. Call `GET /v1/referrals/code` using the API key and derive its participant id from the returned `ref_{participant_id}` code.
2. Register/update the provider webhook to `https://earn-agent-worker.onrender.com/webhook/the402`.
3. Query the public catalog by provider id and create any missing Earn automated services by exact service name.
4. Cache returned service ids in memory for job dispatch matching.
5. Subscribe to `request.created` with an unverified-tier ceiling of $25.
6. Enable exact-match auto-bidding unless explicitly disabled with `THE402_AUTO_BID=false`.

This keeps provider secrets out of source control and makes restart/bootstrap idempotent.
