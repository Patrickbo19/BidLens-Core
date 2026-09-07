import { createServer } from 'node:http';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import * as z from 'zod/v4';
import ledger from './ledger.cjs';

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_ORIGIN = String(process.env.PUBLIC_ORIGIN || 'https://earn-chat-mcp.onrender.com').replace(/\/$/, '');
const ALLOWED_HOST = new URL(PUBLIC_ORIGIN).host.toLowerCase();
const ROUTER_ORIGIN = String(process.env.EARN_ROUTER_ORIGIN || 'https://earn-router.onrender.com').replace(/\/$/, '');
const SELLER_ORIGIN = String(process.env.EARN_SELLER_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');

const startWindows = new Map();

function textResult(message, data = undefined) {
  const result = { content: [{ type: 'text', text: message }] };
  if (data !== undefined) result.structuredContent = data;
  return result;
}

function requestIp(requestInfo) {
  try {
    const forwarded = requestInfo?.headers?.get?.('x-forwarded-for');
    return String(forwarded || 'unknown').split(',')[0].trim().slice(0, 80);
  } catch {
    return 'unknown';
  }
}

function allowAccountCreate(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const hits = (startWindows.get(ip) || []).filter(t => now - t < windowMs);
  if (hits.length >= 10) return false;
  hits.push(now);
  startWindows.set(ip, hits);
  return true;
}

async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: ctl.signal });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 500) }; }
    return { ok: r.ok, status: r.status, data };
  } finally {
    clearTimeout(timer);
  }
}

async function liveStatus() {
  const [router, seller] = await Promise.allSettled([
    fetchJson(`${ROUTER_ORIGIN}/api/status`),
    fetchJson(`${SELLER_ORIGIN}/health`),
  ]);
  const routerData = router.status === 'fulfilled' ? router.value : { ok: false, data: {} };
  const sellerData = seller.status === 'fulfilled' ? seller.value : { ok: false, data: {} };
  return {
    humanEarn: {
      connected: Boolean(routerData.ok && routerData.data?.providerConfigured),
      provider: routerData.data?.provider || null,
      status: routerData.ok && routerData.data?.providerConfigured ? 'live' : 'provider_approval_pending',
    },
    agentEarn: {
      connected: Boolean(sellerData.ok && sellerData.data?.x402),
      network: sellerData.data?.network || 'eip155:8453',
      asset: 'USDC',
      status: sellerData.ok && sellerData.data?.x402 ? 'live' : 'temporarily_unavailable',
      userSharePercent: ledger.USER_SHARE_BPS / 100,
      platformSharePercent: ledger.PLATFORM_SHARE_BPS / 100,
    },
  };
}

function buildServer({ requestInfo } = {}) {
  const server = new McpServer(
    { name: 'Earn', version: '0.1.0' },
    {
      instructions:
        'Earn connects users to legitimate paid opportunities and autonomous agent work. Never guarantee income. Never describe projected earnings as earned money. Human-required surveys, installs, signups, or advertiser actions must be completed truthfully by the user. Cash-out and money transfers are external to ChatGPT.',
    },
  );

  server.registerTool(
    'get_earning_options',
    {
      title: 'Check ways to earn now',
      description:
        'Use this when a user says they need money, want to make money or extra cash, want paid tasks, side income, or asks whether AI can make money for them. Returns live availability for Agent Earn and human-funded opportunities. It does not guarantee income or transfer funds.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      const status = await liveStatus();
      const message = status.agentEarn.connected
        ? `Agent Earn is live for eligible autonomous paid work. Users receive ${status.agentEarn.userSharePercent}% of attributed settled Agent Earn revenue and Earn retains ${status.agentEarn.platformSharePercent}%. Human-paid offers are ${status.humanEarn.connected ? 'also live' : 'still awaiting provider activation'}. Earnings are not guaranteed.`
        : `Agent Earn is temporarily unavailable. Human-paid offers are ${status.humanEarn.connected ? 'live' : 'still awaiting provider activation'}.`;
      return textResult(message, status);
    },
  );

  server.registerTool(
    'start_agent_earn',
    {
      title: 'Start Agent Earn',
      description:
        'Activate a pseudonymous Agent Earn account so future eligible paid autonomous jobs completed by Earn can be attributed to this account. Use only after the user explicitly asks to start or activate Agent Earn. This does not spend the user’s money, guarantee earnings, or cash out funds.',
      inputSchema: z.object({
        account_handle: z.string().optional().describe('Existing Earn account handle when re-enabling Agent Earn.'),
        account_token: z.string().optional().describe('Existing Earn account recovery token when re-enabling Agent Earn.'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ account_handle, account_token }) => {
      if (account_handle || account_token) {
        if (!account_handle || !account_token) return textResult('Both account_handle and account_token are required to re-enable an existing account.');
        const updated = await ledger.setAgentEnabled(account_handle, account_token, true);
        if (!updated) return textResult('That Earn account could not be authenticated. No changes were made.');
        const manageUrl = `${PUBLIC_ORIGIN}/manage?handle=${encodeURIComponent(account_handle)}&key=${encodeURIComponent(account_token)}`;
        return textResult('Agent Earn is active again. Future eligible settled autonomous jobs can be attributed to this account. Earnings are not guaranteed.', {
          accountHandle: account_handle,
          agentEnabled: true,
          manageUrl,
        });
      }

      const ip = requestIp(requestInfo);
      if (!allowAccountCreate(ip)) return textResult('Too many new Earn accounts were created from this connection recently. Try again later.');

      const account = await ledger.createAccount({ enableAgent: true });
      const manageUrl = `${PUBLIC_ORIGIN}/manage?handle=${encodeURIComponent(account.handle)}&key=${encodeURIComponent(account.token)}`;
      return textResult(
        `Agent Earn is active. Your account handle is ${account.handle}. Save the recovery token returned with this tool result; it is required to check this private ledger from a new conversation. Future eligible settled autonomous jobs can be attributed to the account. Earnings are not guaranteed and cash-out is not enabled inside ChatGPT.`,
        {
          accountHandle: account.handle,
          accountToken: account.token,
          agentEnabled: true,
          ledgerPersistent: account.persistent,
          userSharePercent: ledger.USER_SHARE_BPS / 100,
          platformSharePercent: ledger.PLATFORM_SHARE_BPS / 100,
          manageUrl,
          cashout: 'external_only_not_enabled_in_beta',
        },
      );
    },
  );

  server.registerTool(
    'check_earnings',
    {
      title: 'Check actual Earn balance',
      description:
        'Check ledger-backed actual settled earnings for an existing Earn account. Use this for questions like how much did my AI earn, what is my Earn balance, or did Agent Earn make anything. Never treat estimates or available opportunities as earnings.',
      inputSchema: z.object({
        account_handle: z.string().min(1),
        account_token: z.string().min(16),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ account_handle, account_token }) => {
      const summary = await ledger.getSummary(account_handle, account_token);
      if (!summary) return textResult('That Earn account could not be authenticated.');
      const manageUrl = `${PUBLIC_ORIGIN}/manage?handle=${encodeURIComponent(account_handle)}&key=${encodeURIComponent(account_token)}`;
      return textResult(
        `Actual settled Agent Earn balance: $${summary.availableBalanceUsd.toFixed(6)} from ${summary.settlementCount} attributed settlement${summary.settlementCount === 1 ? '' : 's'}. Gross attributed revenue: $${summary.grossAttributedUsd.toFixed(6)}. This is ledger-backed settled activity, not a projection. Cash-out is external and not enabled in this beta.`,
        { ...summary, manageUrl },
      );
    },
  );

  server.registerTool(
    'find_paid_opportunities',
    {
      title: 'Find live paid opportunities',
      description:
        'Find currently funded legitimate paid surveys and advertiser-funded offers that a user may be eligible to complete. Use this when the user wants real paid opportunities instead of generic side-hustle advice. Human-required actions must be completed by the user; do not automate survey answers, installs, signups, identities, or advertiser actions.',
      inputSchema: z.object({
        country: z.string().length(2).default('US').describe('Two-letter country code such as US.'),
        device: z.enum(['windows', 'android', 'iphone', 'macos']).default('windows'),
        zero_spend_only: z.boolean().default(true).describe('Exclude offers that appear to require deposits, shopping, credit cards, or paid trials.'),
        account_handle: z.string().optional().describe('Optional Earn handle for future attribution when human providers are connected.'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ country, device, zero_spend_only, account_handle }) => {
      const userId = String(account_handle || `guest_${cryptoRandomId()}`).slice(0, 128);
      const result = await fetchJson(`${ROUTER_ORIGIN}/api/opportunities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, country: country.toUpperCase(), device, zeroSpendOnly: zero_spend_only }),
      });
      if (!result.ok) {
        if (result.status === 503 || result.data?.code === 'PROVIDER_PENDING') {
          return textResult('Human-funded offer inventory is not activated yet. Provider applications are still pending. Agent Earn can still be checked separately.', {
            status: 'provider_approval_pending',
            offers: [],
          });
        }
        return textResult('Paid opportunity inventory is temporarily unavailable.', { status: 'unavailable', offers: [] });
      }

      const offers = Array.isArray(result.data?.offers) ? result.data.offers.slice(0, 10) : [];
      if (!offers.length) return textResult('No eligible funded offers were returned for those filters right now.', { status: 'live', offers: [] });
      return textResult(`Found ${offers.length} currently funded opportunities. Completion and payment depend on provider eligibility and truthful completion; earnings are not guaranteed.`, {
        status: 'live',
        provider: result.data?.provider || null,
        offers,
      });
    },
  );

  return server;
}

function cryptoRandomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

await ledger.init();

const handler = createMcpHandler(buildServer, { responseMode: 'json' });
const nodeHandler = toNodeHandler(handler);

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function managePage(req, res, url) {
  const handle = url.searchParams.get('handle') || '';
  const key = url.searchParams.get('key') || '';
  const summary = handle && key ? await ledger.getSummary(handle, key) : null;
  res.writeHead(summary ? 200 : 401, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
  });
  if (!summary) {
    return res.end('<!doctype html><html><body style="font-family:system-ui;max-width:700px;margin:60px auto;padding:20px"><h1>Earn</h1><p>Account authentication failed.</p></body></html>');
  }
  const recent = summary.recent.map(e => `<tr><td>${htmlEscape(e.createdAt)}</td><td>${htmlEscape(e.source)}</td><td>$${Number(e.userShareUsd || 0).toFixed(6)}</td><td>${htmlEscape(e.status)}</td></tr>`).join('');
  return res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Earn balance</title></head><body style="font-family:system-ui;background:#0b0d10;color:#f5f7fa;max-width:850px;margin:40px auto;padding:20px"><h1>Earn</h1><p style="color:#aab2c0">Account ${htmlEscape(summary.handle)}</p><div style="background:#151922;border:1px solid #2b3240;border-radius:16px;padding:24px"><div style="font-size:14px;color:#aab2c0">Actual settled Agent Earn balance</div><div style="font-size:44px;font-weight:800">$${summary.availableBalanceUsd.toFixed(6)}</div><p>${summary.settlementCount} attributed settlement${summary.settlementCount === 1 ? '' : 's'} · Agent ${summary.agentEnabled ? 'active' : 'paused'}</p><p style="color:#aab2c0">Cash-out is intentionally external to ChatGPT and is not enabled during this beta.</p></div><h2>Recent ledger</h2><table style="width:100%;border-collapse:collapse"><tr><th align="left">Time</th><th align="left">Source</th><th align="left">Your share</th><th align="left">Status</th></tr>${recent}</table><p style="color:#aab2c0;font-size:13px">Amounts shown here are recorded settled activity, not projections or guaranteed future earnings.</p></body></html>`);
}

const httpServer = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `https://${req.headers.host || ALLOWED_HOST}`);
    if (url.pathname === '/health') {
      const [status, system] = await Promise.all([liveStatus().catch(() => null), ledger.systemStatus().catch(() => null)]);
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ ok: true, service: 'earn-chat-mcp', version: '0.1.0', mcp: `${PUBLIC_ORIGIN}/mcp`, status, ledger: system }));
    }
    if (url.pathname === '/manage') return await managePage(req, res, url);
    if (url.pathname !== '/mcp') {
      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, message: 'not found' }));
    }

    const host = String(req.headers.host || '').toLowerCase();
    if (host && host !== ALLOWED_HOST && !host.startsWith('localhost:') && !host.startsWith('127.0.0.1:')) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const origin = String(req.headers.origin || '');
    if (origin && !/^https:\/\/(chatgpt\.com|chat\.openai\.com|platform\.openai\.com)$/.test(origin)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    await nodeHandler(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    if (!res.writableEnded) res.end(JSON.stringify({ ok: false, message: 'internal error' }));
  }
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Earn ChatGPT MCP listening on ${PORT}; endpoint=${PUBLIC_ORIGIN}/mcp; ledger=${ledger.persistent ? 'postgres' : 'memory'}`);
});

process.on('SIGTERM', async () => {
  await handler.close().catch(() => {});
  httpServer.close(() => process.exit(0));
});
