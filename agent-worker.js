const http = require('http');

const PORT = Number(process.env.PORT || 3000);
const MCP_URL = String(process.env.EARN_MCP_URL || 'https://earn-chat-mcp.onrender.com/mcp');
const MCP_HEALTH_URL = new URL('/health', MCP_URL).toString();
const CREATE_BETA = String(process.env.EARN_CREATE_BETA_ACCOUNT || '') === '1';
const EARN_SELLER_ORIGIN = 'https://earn-tools-backend.onrender.com';

const state = { ok: false, lastCheck: null, protocolEra: null, tools: [], earningOptions: null, ledgerStatus: null, buyerSearch: null, betaAccount: null, error: null };

async function openClient() {
  const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client');
  const client = new Client({ name: 'earn-mcp-verifier', version: '0.6.0' }, { versionNegotiation: { mode: 'auto' } });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await client.connect(transport);
  return client;
}
async function fetchJson(url, timeoutMs = 8000) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`${new URL(url).host} status ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}
async function fetchLedgerStatus() { const data = await fetchJson(MCP_HEALTH_URL); return data?.ledger || null; }
async function checkBuyerDiscovery() {
  const queries = ['sha256 hash hmac base64 jwt decode', 'prompt injection security scan', 'json data quality audit', 'website url health metadata audit'];
  const checks = [];
  for (const query of queries) {
    try {
      const data = await fetchJson(`https://agent402.tools/api/find?q=${encodeURIComponent(query)}`, 10000);
      const raw = JSON.stringify(data);
      checks.push({ query, earnPresent: raw.includes(EARN_SELLER_ORIGIN), responsePreview: raw.slice(0, 900) });
    } catch (error) { checks.push({ query, earnPresent: false, error: String(error?.message || error).slice(0, 300) }); }
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
    console.log(JSON.stringify({ type: 'earn_mcp_verified', ...state }));
  } catch (error) {
    state.ok = false;
    state.lastCheck = new Date().toISOString();
    state.error = String(error?.message || error).slice(0, 1000);
    console.error(JSON.stringify({ type: 'earn_mcp_verification_failed', ...state }));
  } finally { if (client) await client.close().catch(() => {}); }
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
  } catch (error) { console.error(JSON.stringify({ type: 'earn_beta_account_seed_failed', error: String(error?.message || error).slice(0, 1000) })); }
  finally { if (client) await client.close().catch(() => {}); }
}
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(state.ok ? 200 : 503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ service: 'earn-mcp-verifier', target: MCP_URL, ...state }));
  }
  res.writeHead(404, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false }));
});
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Earn MCP verifier listening on ${PORT}; target=${MCP_URL}`);
  setTimeout(async () => { await createBetaAccountOnce(); await verifyMcp(); }, 2500);
  setInterval(verifyMcp, 15 * 60 * 1000).unref();
});
