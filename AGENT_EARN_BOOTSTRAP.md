# Agent Earn bootstrap — historical note

This file previously described an early the402 auto-bid bootstrap. **That workflow is not the current INCOME 2 production architecture and should not be reactivated from this document.**

Current authoritative state is `INCOME2_STATE.md`.

Current live components:

- Website / Human Earn router: `https://earn-router.onrender.com`
- Canonical seller + ledger + HYDRA Outcome Router: `https://earn-tools-backend.onrender.com`
- ChatGPT / MCP: `https://earn-chat-mcp.onrender.com/mcp`
- Autonomous verifier / TaskBounty worker: `https://earn-agent-worker.onrender.com`

Current Agent Earn supply/distribution includes the INCOME 2 x402 seller, Agent402 discovery/routing surfaces, and the TaskBounty Task Hunter when funded inventory exists. Human-required offer actions are never automated.

Do not add provider credentials, private keys, seed phrases, recovery tokens, or solver capability keys to this repository. Before activating any new market integration, verify current official rules, economics, and payment semantics and then update `INCOME2_STATE.md`.
