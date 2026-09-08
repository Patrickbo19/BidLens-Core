const http = require('http');

const PORT = Number(process.env.PORT || 3000);
const MCP_URL = String(process.env.EARN_MCP_URL || 'https://earn-chat-mcp.onrender.com/mcp');
const MCP_HEALTH_URL = new URL('/health', MCP_URL).toString();
const CREATE_BETA = String(process.env.EARN_CREATE_BETA_ACCOUNT || '') === '1';
const EARN_SELLER_ORIGIN = String(process.env.EARN_SELLER_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');

const state = {
  ok: false,
  lastCheck: null,
  protocolEra: null,
  tools: [],
  earningOptions: null,
  ledgerStatus: null,
  buyerSearch: null,
  betaAccount: null,
  taskBounty: { connected: false, authReady: false, openTaskCount: null, lastCheck: null, error: null, source: 'canonical_seller_backend' },
  error: null,
};

async function openClient() {
  const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client');
  const client = new Client({ name: 'earn-mcp-verifier', version: '0.8.1' }, { versionNegotiation: { mode: 'auto' } });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await client.connect(transport);
  return client;
}

async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      ...options,
      signal: ctl.signal,
      headers: { accept: 'application/json', ...(options.headers || {}) },
    });
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
    return { ok: r.ok, status: r.status, data };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLedgerStatus() {
  const r = await fetchJson(MCP_HEALTH_URL, {}, 15000);
  if (!r.ok) throw new Error(`MCP health ${r.status}`);
  return r.data?.ledger || null;
}

async function checkBuyerDiscovery() {
  const queries = [
    'sha256 hash hmac base64 jwt decode',
    'prompt injection security scan',
    'json data quality audit',
    'website url health metadata audit',
    'x402 buyer preflight payment challenge audit',
    'outcome routing agent procurement result max budget autonomous fulfillment',
  ];
  const checks = [];
  for (const query of queries) {
    try {
      const r = await fetchJson(`https://agent402.tools/api/find?q=${encodeURIComponent(query)}`, {}, 10000);
      const raw = JSON.stringify(r.data);
      checks.push({ query, earnPresent: raw.includes(EARN_SELLER_ORIGIN), responsePreview: raw.slice(0, 900) });
    } catch (error) {
      checks.push({ query, earnPresent: false, error: String(error?.message || error).slice(0, 300) });
    }
  }
  return checks;
}

async function checkTaskBounty() {
  const checkedAt = new Date().toISOString();
  try {
    const r = await fetchJson(`${EARN_SELLER_ORIGIN}/taskbounty/status`, {}, 15000);
    const upstream = r.data?.taskBounty || {};
    state.taskBounty = {
      connected: Boolean(upstream.connected),
      authReady: Boolean(upstream.authReady),
      openTaskCount: Number.isFinite(Number(upstream.openTaskCount)) ? Number(upstream.openTaskCount) : null,
      lastCheck: checkedAt,
      error: r.ok ? (upstream.error || null) : `canonical TaskBounty status ${r.status}`,
      authHttpStatus: upstream.authHttpStatus ?? null,
      persistent: Boolean(upstream.persistent),
      configured: Boolean(upstream.configured),
      source: 'canonical_seller_backend',
    };
    console.log(JSON.stringify({ type: 'taskbounty_watch', ...state.taskBounty }));
  } catch (error) {
    state.taskBounty = {
      connected: false,
      authReady: false,
      openTaskCount: null,
      lastCheck: checkedAt,
      error: String(error?.message || error).slice(0, 500),
      source: 'canonical_seller_backend',
    };
    console.error(JSON.stringify({ type: 'taskbounty_watch_error', ...state.taskBounty }));
  }
}

async function verifyMcp() {
  let client;
  try {
    client = await openClient();
    const toolResult = await client.listTools();
    const toolNames = (toolResult.tools || []).map(t => t.name).sort();
    const expected = [
      'check_earnings',
      'find_paid_opportunities',
      'get_earning_options',
      'guard_x402_purchase',
      'request_agent_outcome',
      'start_agent_earn',
    ].sort();
    const missing = expected.filter(name => !toolNames.includes(name));
    if (missing.length) throw new Error(`missing MCP tools: ${missing.join(', ')}`);
    const options = await client.callTool({ name: 'get_earning_options', arguments: {} });
    state.ok = true;
    state.lastCheck = new Date().toISOString();
    state.protocolEra = typeof client.getProtocolEra === 'function' ? client.getProtocolEra() : 'connected';
    state.tools = toolNames;
    state.earningOptions = options?.structuredContent || options?.content || null;
    state.ledgerStatus = await fetchLedgerStatus();
    state.buyerSearch = await checkBuyerDiscovery();
    state.error = null;
    console.log(JSON.stringify({
      type: 'earn_mcp_verified',
      ok: state.ok,
      lastCheck: state.lastCheck,
      protocolEra: state.protocolEra,
      tools: state.tools,
      earningOptions: state.earningOptions,
      ledgerStatus: state.ledgerStatus,
      buyerSearch: state.buyerSearch,
      taskBounty: state.taskBounty,
    }));
  } catch (error) {
    state.ok = false;
    state.lastCheck = new Date().toISOString();
    state.error = String(error?.message || error).slice(0, 1000);
    console.error(JSON.stringify({ type: 'earn_mcp_verification_failed', ok: state.ok, lastCheck: state.lastCheck, error: state.error, taskBounty: state.taskBounty }));
  } finally {
    if (client) await client.close().catch(() => {});
  }
}

async function createBetaAccountOnce() {
  if (!CREATE_BETA || state.betaAccount) return;
  let client;
  try {
    client = await openClient();
    const started = await client.callTool({ name: 'start_agent_earn', arguments: {} });
    const created = started?.structuredContent || {};
    if (!created.accountHandle) throw new Error('start_agent_earn did not return an account handle');
    if (!created.ledgerPersistent) throw new Error('new beta account is not using Postgres');
    state.betaAccount = {
      accountHandle: created.accountHandle,
      startingBalanceUsd: 0,
      settlementCount: 0,
      persistent: true,
      agentEnabled: true,
      credentialHandling: 'recovery credential intentionally ignored by verifier',
    };
    console.log(JSON.stringify({ type: 'earn_beta_account_seeded', ...state.betaAccount, at: new Date().toISOString() }));
  } catch (error) {
    console.error(JSON.stringify({ type: 'earn_beta_account_seed_failed', error: String(error?.message || error).slice(0, 1000) }));
  } finally {
    if (client) await client.close().catch(() => {});
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/taskbounty/status') {
    return sendJson(res, 200, { ok: true, taskBounty: state.taskBounty });
  }
  if (path === '/health' || path === '/') {
    return sendJson(res, state.ok ? 200 : 503, { service: 'earn-mcp-verifier', target: MCP_URL, ...state });
  }
  return sendJson(res, 404, { ok: false });
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Earn MCP verifier listening on ${PORT}; target=${MCP_URL}; taskBountySource=canonical_seller_backend`);
  setTimeout(async () => {
    await checkTaskBounty();
    await createBetaAccountOnce();
    await verifyMcp();
  }, 2500);
  setInterval(checkTaskBounty, 10 * 60 * 1000).unref();
  setInterval(verifyMcp, 15 * 60 * 1000).unref();
});
