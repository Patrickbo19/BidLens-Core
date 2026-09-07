const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const MCP_URL = String(process.env.EARN_MCP_URL || 'https://earn-chat-mcp.onrender.com/mcp');
const CREATE_BETA = String(process.env.EARN_CREATE_BETA_ACCOUNT || '') === '1';
const SEED_KEY_HEX = String(process.env.EARN_SEED_ENCRYPTION_KEY || '');
const BETA_HANDLE = String(process.env.EARN_BETA_ACCOUNT_HANDLE || '');
const BETA_TOKEN = String(process.env.EARN_BETA_ACCOUNT_TOKEN || '');

const state = {
  ok: false,
  lastCheck: null,
  protocolEra: null,
  tools: [],
  earningOptions: null,
  betaAccount: null,
  error: null,
};

async function openClient() {
  const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client');
  const client = new Client(
    { name: 'earn-mcp-verifier', version: '0.2.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await client.connect(transport);
  return client;
}

function encryptSeedToken(token) {
  if (!/^[a-f0-9]{64}$/i.test(SEED_KEY_HEX)) throw new Error('EARN_SEED_ENCRYPTION_KEY must be a 32-byte hex key');
  const key = Buffer.from(SEED_KEY_HEX, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(token), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}.${tag.toString('hex')}.${ciphertext.toString('hex')}`;
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
    state.error = null;

    if (BETA_HANDLE && BETA_TOKEN) {
      const checked = await client.callTool({
        name: 'check_earnings',
        arguments: { account_handle: BETA_HANDLE, account_token: BETA_TOKEN },
      });
      const summary = checked?.structuredContent || null;
      state.betaAccount = summary ? {
        accountHandle: BETA_HANDLE,
        availableBalanceUsd: Number(summary.availableBalanceUsd || 0),
        grossAttributedUsd: Number(summary.grossAttributedUsd || 0),
        settlementCount: Number(summary.settlementCount || 0),
        persistent: Boolean(summary.persistent),
        agentEnabled: Boolean(summary.agentEnabled),
      } : null;
    }

    console.log(JSON.stringify({ type: 'earn_mcp_verified', ...state }));
  } catch (error) {
    state.ok = false;
    state.lastCheck = new Date().toISOString();
    state.error = String(error?.message || error).slice(0, 1000);
    console.error(JSON.stringify({ type: 'earn_mcp_verification_failed', ...state }));
  } finally {
    if (client) await client.close().catch(() => {});
  }
}

async function createBetaAccountOnce() {
  if (!CREATE_BETA || BETA_HANDLE || BETA_TOKEN) return;
  let client;
  try {
    client = await openClient();
    const started = await client.callTool({ name: 'start_agent_earn', arguments: {} });
    const created = started?.structuredContent || {};
    if (!created.accountHandle || !created.accountToken) throw new Error('start_agent_earn did not return account credentials');

    const checked = await client.callTool({
      name: 'check_earnings',
      arguments: { account_handle: created.accountHandle, account_token: created.accountToken },
    });
    const summary = checked?.structuredContent || {};
    if (Number(summary.availableBalanceUsd || 0) !== 0 || Number(summary.settlementCount || 0) !== 0) {
      throw new Error('new beta account did not start at zero');
    }
    if (!summary.persistent) throw new Error('new beta account is not using Postgres');

    const encryptedToken = encryptSeedToken(created.accountToken);
    console.log(JSON.stringify({
      type: 'earn_beta_account_seeded',
      accountHandle: created.accountHandle,
      encryptedToken,
      startingBalanceUsd: 0,
      settlementCount: 0,
      persistent: true,
      agentEnabled: Boolean(summary.agentEnabled),
      at: new Date().toISOString(),
    }));
  } catch (error) {
    console.error(JSON.stringify({ type: 'earn_beta_account_seed_failed', error: String(error?.message || error).slice(0, 1000) }));
  } finally {
    if (client) await client.close().catch(() => {});
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(state.ok ? 200 : 503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ service: 'earn-mcp-verifier', target: MCP_URL, ...state }));
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: false }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Earn MCP verifier listening on ${PORT}; target=${MCP_URL}`);
  setTimeout(async () => {
    await createBetaAccountOnce();
    await verifyMcp();
  }, 2500);
  setInterval(verifyMcp, 15 * 60 * 1000).unref();
});
