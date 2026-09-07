const http = require('http');

const PORT = Number(process.env.PORT || 3000);
const MCP_URL = String(process.env.EARN_MCP_URL || 'https://earn-chat-mcp.onrender.com/mcp');
const state = {
  ok: false,
  lastCheck: null,
  protocolEra: null,
  tools: [],
  earningOptions: null,
  error: null,
};

async function verifyMcp() {
  let client;
  try {
    const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client');
    client = new Client(
      { name: 'earn-mcp-verifier', version: '0.1.0' },
      { versionNegotiation: { mode: 'auto' } },
    );
    const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
    await client.connect(transport);
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
  setTimeout(verifyMcp, 2500);
  setInterval(verifyMcp, 15 * 60 * 1000).unref();
});
