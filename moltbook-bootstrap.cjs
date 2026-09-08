const vault = require('./moltbook-vault.cjs');
const productUpdate = require('./moltbook-product-update.cjs');

const API = 'https://www.moltbook.com/api/v1';
const DESCRIPTION = 'INCOME 2 helps humans and AI agents earn through legitimate paid work and provides low-cost x402 pay-per-call tools for autonomous agents.';
const NAME_CANDIDATES = ['Income2', 'Income2Agent', 'Income2Earn'];

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

async function refreshClaimStatus() {
  const current = await vault.status();
  if (!current.connected) return current;
  const apiKey = await vault.getApiKey();
  if (!apiKey) return current;
  const r = await fetchJson(`${API}/agents/status`, { headers: { authorization: `Bearer ${apiKey}` } });
  if (r.ok) {
    const status = String(r.data?.status || r.data?.agent?.status || current.claimStatus || 'unknown');
    await vault.setClaimStatus(status);
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

setTimeout(() => productUpdate.run().catch(error => {
  console.error(JSON.stringify({ type:'moltbook_product_update_error', error:String(error?.message || error).slice(0,300), at:new Date().toISOString() }));
}), 7000).unref();

module.exports = { register, refreshClaimStatus };
