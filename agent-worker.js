const http = require('http');
const vault = require('./taskbounty-vault.cjs');

const PORT = Number(process.env.PORT || 3000);
const MCP_URL = String(process.env.EARN_MCP_URL || 'https://earn-chat-mcp.onrender.com/mcp');
const MCP_HEALTH_URL = new URL('/health', MCP_URL).toString();
const CREATE_BETA = String(process.env.EARN_CREATE_BETA_ACCOUNT || '') === '1';
const EARN_SELLER_ORIGIN = 'https://earn-tools-backend.onrender.com';
const TASKBOUNTY_API = 'https://www.task-bounty.com/api/v1';
const TASKBOUNTY_BOOTSTRAP_NONCE = String(process.env.TASKBOUNTY_BOOTSTRAP_NONCE || '').trim();

const state = {
  ok: false,
  lastCheck: null,
  protocolEra: null,
  tools: [],
  earningOptions: null,
  ledgerStatus: null,
  buyerSearch: null,
  betaAccount: null,
  taskBounty: { connected: false, authReady: false, openTaskCount: null, lastCheck: null, error: null },
  error: null,
};

async function openClient() {
  const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client');
  const client = new Client({ name: 'earn-mcp-verifier', version: '0.7.0' }, { versionNegotiation: { mode: 'auto' } });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await client.connect(transport);
  return client;
}

async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: ctl.signal, headers: { accept: 'application/json', ...(options.headers || {}) } });
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
    return { ok: r.ok, status: r.status, data };
  } finally { clearTimeout(timer); }
}

async function fetchLedgerStatus() {
  const r = await fetchJson(MCP_HEALTH_URL);
  if (!r.ok) throw new Error(`MCP health ${r.status}`);
  return r.data?.ledger || null;
}

async function checkBuyerDiscovery() {
  const queries = ['sha256 hash hmac base64 jwt decode', 'prompt injection security scan', 'json data quality audit', 'website url health metadata audit', 'x402 buyer preflight payment challenge audit'];
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

async function verifyMcp() {
  let client;
  try {
    client = await openClient();
    const toolResult = await client.listTools();
    const toolNames = (toolResult.tools || []).map(t => t.name).sort();
    const expected = ['check_earnings', 'find_paid_opportunities', 'get_earning_options', 'start_agent_earn'].sort();
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
    console.log(JSON.stringify({ type: 'earn_mcp_verified', ok: state.ok, lastCheck: state.lastCheck, protocolEra: state.protocolEra, tools: state.tools, earningOptions: state.earningOptions, ledgerStatus: state.ledgerStatus, buyerSearch: state.buyerSearch, taskBounty: state.taskBounty }));
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
    state.betaAccount = { accountHandle: created.accountHandle, startingBalanceUsd: 0, settlementCount: 0, persistent: true, agentEnabled: true, credentialHandling: 'recovery credential intentionally ignored by verifier' };
    console.log(JSON.stringify({ type: 'earn_beta_account_seeded', ...state.betaAccount, at: new Date().toISOString() }));
  } catch (error) {
    console.error(JSON.stringify({ type: 'earn_beta_account_seed_failed', error: String(error?.message || error).slice(0, 1000) }));
  } finally {
    if (client) await client.close().catch(() => {});
  }
}

function extractOpenCount(data) {
  if (Array.isArray(data)) return data.length;
  for (const k of ['data', 'tasks', 'items', 'results']) if (Array.isArray(data?.[k])) return data[k].length;
  return null;
}

async function checkTaskBounty() {
  const checkedAt = new Date().toISOString();
  try {
    const v = await vault.status();
    const token = v.connected ? await vault.getToken() : null;
    const r = await fetchJson(`${TASKBOUNTY_API}/tasks?state=open&limit=50`, token ? { headers: { authorization: `Bearer ${token}` } } : {}, 12000);
    state.taskBounty = {
      connected: Boolean(v.connected),
      authReady: Boolean(v.connected && r.ok),
      openTaskCount: r.ok ? extractOpenCount(r.data) : null,
      lastCheck: checkedAt,
      error: r.ok ? null : `TaskBounty status ${r.status}`,
    };
    if (v.connected && r.ok) await vault.markVerified();
    console.log(JSON.stringify({ type: 'taskbounty_watch', ...state.taskBounty }));
  } catch (error) {
    state.taskBounty = { connected: false, authReady: false, openTaskCount: null, lastCheck: checkedAt, error: String(error?.message || error).slice(0, 500) };
    console.error(JSON.stringify({ type: 'taskbounty_watch_error', ...state.taskBounty }));
  }
}

function readBody(req, max = 10000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > max) reject(new Error('body too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(data));
}

async function handleTaskBountyBootstrap(req, res, path) {
  if (!TASKBOUNTY_BOOTSTRAP_NONCE || path !== `/taskbounty/bootstrap/${TASKBOUNTY_BOOTSTRAP_NONCE}`) return false;
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, message: 'POST required' });
    return true;
  }
  try {
    const existing = await vault.status();
    if (existing.connected) {
      sendJson(res, 409, { ok: false, message: 'TaskBounty credential already stored; bootstrap is closed.' });
      return true;
    }
    const raw = await readBody(req);
    let body;
    try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
    const accessToken = String(body.access_token || '').trim();
    const taskbountyUserId = String(body.taskbounty_user_id || '').trim() || null;
    if (!accessToken) {
      sendJson(res, 422, { ok: false, message: 'access_token required' });
      return true;
    }
    const verify = await fetchJson(`${TASKBOUNTY_API}/tasks?state=open&limit=1`, { headers: { authorization: `Bearer ${accessToken}` } }, 12000);
    if (!verify.ok) {
      sendJson(res, 401, { ok: false, message: `TaskBounty credential validation failed (${verify.status}).` });
      return true;
    }
    await vault.storeToken(accessToken, taskbountyUserId);
    await checkTaskBounty();
    console.log(JSON.stringify({ type: 'taskbounty_credential_stored', ok: true, taskbountyUserIdPresent: Boolean(taskbountyUserId), at: new Date().toISOString() }));
    sendJson(res, 201, { ok: true, stored: true, encryptedAtRest: true, taskBounty: state.taskBounty });
  } catch (error) {
    console.error(JSON.stringify({ type: 'taskbounty_bootstrap_error', error: String(error?.message || error).slice(0, 500) }));
    sendJson(res, 500, { ok: false, message: 'TaskBounty credential bootstrap failed.' });
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (await handleTaskBountyBootstrap(req, res, path)) return;
  if (path === '/taskbounty/status') {
    return sendJson(res, 200, { ok: true, taskBounty: state.taskBounty, vault: await vault.status().catch(() => ({ connected: false })) });
  }
  if (path === '/health' || path === '/') {
    return sendJson(res, state.ok ? 200 : 503, { service: 'earn-mcp-verifier', target: MCP_URL, ...state });
  }
  return sendJson(res, 404, { ok: false });
});

server.listen(PORT, '0.0.0.0', async () => {
  const vaultState = await vault.init().catch(error => ({ persistent: false, configured: false, error: String(error?.message || error).slice(0, 300) }));
  console.log(`Earn MCP verifier listening on ${PORT}; target=${MCP_URL}; taskBountyVault=${vaultState.persistent ? 'postgres' : 'unavailable'}`);
  setTimeout(async () => {
    await checkTaskBounty();
    await createBetaAccountOnce();
    await verifyMcp();
  }, 2500);
  setInterval(checkTaskBounty, 10 * 60 * 1000).unref();
  setInterval(verifyMcp, 15 * 60 * 1000).unref();
});
