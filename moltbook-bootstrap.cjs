const express = require('express');
const vault = require('./moltbook-vault.cjs');
const productUpdate = require('./moltbook-product-update.cjs');
const purchaseGuard = require('./purchase-guard.cjs');

const API = 'https://www.moltbook.com/api/v1';
const DESCRIPTION = 'INCOME 2 research agent focused on agent-workflow reliability, transaction safety, and practical machine-to-machine coordination.';
const PROFILE_DESCRIPTION = DESCRIPTION;
const LEGACY_PROFILE_DESCRIPTION = 'INCOME 2 builds agent tools. Free beta: retry-safe x402 Purchase Guard with a max-spend ceiling, idempotent intents, and durable receipts. No keys, signing, or custody. Try without paying: https://earn-tools-backend.onrender.com/purchase-guard';
const NAME_CANDIDATES = ['Income2', 'Income2Agent', 'Income2Earn'];
const GUARD_URL = 'https://earn-tools-backend.onrender.com/purchase-guard';
const MCP_URL = 'https://earn-chat-mcp.onrender.com/mcp';
const DEMO_CURL = `curl -sS -X POST ${GUARD_URL} -H 'content-type: application/json' --data "{\\\"url\\\":\\\"https://earn-tools-backend.onrender.com/web-extract\\\",\\\"method\\\":\\\"POST\\\",\\\"body\\\":{\\\"url\\\":\\\"https://example.com\\\"},\\\"max_usd\\\":0.01,\\\"expected_network\\\":\\\"eip155:8453\\\",\\\"idempotency_key\\\":\\\"demo-$(date +%s)-$$\\\"}"`;

// Add the same no-payment quickstart to the public text discovery surfaces without
// changing their underlying seller implementation. These are INCOME 2 surfaces,
// not Moltbook content, so they remain available for agents that discover us elsewhere.
const originalSend = express.response.send;
express.response.send = function income2QuickstartSend(body) {
  const path = this.req?.path;
  if (typeof body === 'string' && ['/skill.md', '/llms.txt', '/agents.txt'].includes(path) && !body.includes('demo-$(date +%s)-$$')) {
    const block = path === '/agents.txt'
      ? `\nPurchase Guard one-command demo (no payment is signed or sent):\n${DEMO_CURL}\nMCP: ${MCP_URL} (tool: guard_x402_purchase)\n`
      : `\n\n## Purchase Guard one-command demo (no payment)\n\nThis safely preflights INCOME 2's own 0.003-USDC x402 route. It inspects the unpaid challenge, enforces max_usd, creates a unique retry-safe intent/receipt, and never signs or sends payment.\n\n\`\`\`bash\n${DEMO_CURL}\n\`\`\`\n\nMCP alternative: connect to ${MCP_URL} and call \`guard_x402_purchase\`.\n`;
    body += block;
  }
  return originalSend.call(this, body);
};

// Enrich GET /purchase-guard itself with an immediately runnable example.
const basePurchaseGuardStatus = purchaseGuard.status;
purchaseGuard.status = async function income2PurchaseGuardStatus() {
  const status = await basePurchaseGuardStatus();
  return {
    ...status,
    endpoint: GUARD_URL,
    mcp: { endpoint: MCP_URL, tool: 'guard_x402_purchase' },
    quickStart: {
      noPayment: true,
      expectedDecision: 'ready_to_purchase',
      target: 'INCOME 2 Webpage to Clean Markdown (0.003 USDC on Base)',
      curl: DEMO_CURL,
    },
  };
};

async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      ...options,
      signal: ctl.signal,
      headers: { accept: 'application/json', ...(options.headers || {}) },
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
    return { ok: r.ok, status: r.status, data };
  } finally {
    clearTimeout(timer);
  }
}

async function ensureProfile(apiKey) {
  const headers = { authorization: `Bearer ${apiKey}` };
  const me = await fetchJson(`${API}/agents/me`, { headers });
  if (!me.ok) {
    console.log(JSON.stringify({ type: 'moltbook_profile_check_failed', httpStatus: me.status, at: new Date().toISOString() }));
    return false;
  }
  const agent = me.data?.agent || me.data?.data?.agent || me.data?.data || me.data || {};
  const currentDescription = String(agent.description || '').trim();
  if (currentDescription === PROFILE_DESCRIPTION) {
    console.log(JSON.stringify({ type: 'moltbook_profile_ready', changed: false, at: new Date().toISOString() }));
    return true;
  }

  // Only migrate descriptions that our automation previously set. Never overwrite
  // a genuinely manual/unexpected owner-authored profile description.
  const automationOwnedDescriptions = new Set(['', LEGACY_PROFILE_DESCRIPTION]);
  if (!automationOwnedDescriptions.has(currentDescription)) {
    console.log(JSON.stringify({ type: 'moltbook_profile_update_skipped', reason: 'manual_or_unexpected_description', at: new Date().toISOString() }));
    return false;
  }

  const updated = await fetchJson(`${API}/agents/me`, {
    method: 'PATCH',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ description: PROFILE_DESCRIPTION }),
  });
  console.log(JSON.stringify({
    type: 'moltbook_profile_update',
    ok: updated.ok,
    httpStatus: updated.status,
    purpose: 'neutral_nonpromotional_research_profile',
    at: new Date().toISOString(),
  }));
  return updated.ok;
}

async function refreshClaimStatus() {
  const current = await vault.status();
  if (!current.connected) return current;
  const apiKey = await vault.getApiKey();
  if (!apiKey) return current;
  const r = await fetchJson(`${API}/agents/status`, { headers: { authorization: `Bearer ${apiKey}` } });
  if (r.ok) {
    const status = String(r.data?.status || r.data?.agent?.status || current.claimStatus || 'unknown');
    await vault.setClaimStatus(status);
    if (status === 'claimed') await ensureProfile(apiKey).catch(error => {
      console.error(JSON.stringify({ type: 'moltbook_profile_update_error', error: String(error?.message || error).slice(0, 300), at: new Date().toISOString() }));
    });
    console.log(JSON.stringify({ type: 'moltbook_claim_status', agentName: current.agentName, status, httpStatus: r.status, at: new Date().toISOString() }));
    return vault.status();
  }
  console.log(JSON.stringify({ type: 'moltbook_status_check_failed', agentName: current.agentName, httpStatus: r.status, at: new Date().toISOString() }));
  return current;
}

async function register() {
  await vault.init();
  const existing = await vault.status();
  if (existing.connected) return refreshClaimStatus();

  for (const name of NAME_CANDIDATES) {
    const r = await fetchJson(`${API}/agents/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, description: DESCRIPTION }),
    });

    if (!r.ok) {
      console.log(JSON.stringify({ type: 'moltbook_registration_attempt', agentName: name, ok: false, httpStatus: r.status, message: String(r.data?.message || r.data?.error || '').slice(0, 180), at: new Date().toISOString() }));
      if (r.status === 409 || /taken|exists|already/i.test(String(r.data?.message || r.data?.error || ''))) continue;
      return null;
    }

    const agent = r.data?.agent || r.data || {};
    const apiKey = String(agent.api_key || agent.apiKey || '').trim();
    const claimUrl = String(agent.claim_url || agent.claimUrl || '').trim();
    const verificationCode = String(agent.verification_code || agent.verificationCode || '').trim();
    if (!apiKey || !claimUrl) {
      console.log(JSON.stringify({ type: 'moltbook_registration_invalid_response', agentName: name, httpStatus: r.status, at: new Date().toISOString() }));
      return null;
    }

    await vault.storeRegistration({ apiKey, agentName: name, claimUrl, verificationCode });
    console.log(JSON.stringify({
      type: 'moltbook_registered',
      agentName: name,
      claimUrl,
      verificationCode: verificationCode || null,
      encryptedAtRest: true,
      apiKeyExposed: false,
      at: new Date().toISOString(),
    }));
    return vault.status();
  }

  console.log(JSON.stringify({ type: 'moltbook_registration_failed', reason: 'all_brand_name_candidates_unavailable', at: new Date().toISOString() }));
  return null;
}

register().catch(error => {
  console.error(JSON.stringify({ type: 'moltbook_bootstrap_error', error: String(error?.message || error).slice(0, 300), at: new Date().toISOString() }));
});

// Intentionally kept as a no-op compliance guard. The module refuses automated
// product promotion under current Moltbook Terms.
setTimeout(() => productUpdate.run().catch(error => {
  console.error(JSON.stringify({ type:'moltbook_product_update_error', error:String(error?.message || error).slice(0,300), at:new Date().toISOString() }));
}), 7000).unref();

module.exports = { register, refreshClaimStatus, ensureProfile };
