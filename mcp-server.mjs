import { createServer } from 'node:http';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import * as z from 'zod/v4';

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_ORIGIN = String(process.env.PUBLIC_ORIGIN || 'https://earn-chat-mcp.onrender.com').replace(/\/$/, '');
const ALLOWED_HOST = new URL(PUBLIC_ORIGIN).host.toLowerCase();
const ROUTER_ORIGIN = String(process.env.EARN_ROUTER_ORIGIN || 'https://earn-router.onrender.com').replace(/\/$/, '');
const SELLER_ORIGIN = String(process.env.EARN_SELLER_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');
const FALLBACK_USER_SHARE_PERCENT = Number(process.env.AGENT_USER_SHARE_BPS || 7000) / 100;
const FALLBACK_PLATFORM_SHARE_PERCENT = 100 - FALLBACK_USER_SHARE_PERCENT;

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

async function fetchJson(url, options = {}, timeoutMs = 12000) {
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

async function sellerAccount(path, body, ip = 'unknown') {
  return fetchJson(`${SELLER_ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': String(ip || 'unknown').slice(0, 80),
      'x-income2-client': 'chatgpt-mcp',
    },
    body: JSON.stringify(body || {}),
  }, 45000);
}

async function sellerHealth() {
  const result = await fetchJson(`${SELLER_ORIGIN}/health`, {}, 30000);
  return result.ok ? result.data : null;
}

function economicsFromSeller(data) {
  const userSharePercent = Number(data?.economics?.userSharePercent ?? FALLBACK_USER_SHARE_PERCENT);
  const platformSharePercent = Number(data?.economics?.platformSharePercent ?? FALLBACK_PLATFORM_SHARE_PERCENT);
  return { userSharePercent, platformSharePercent };
}

async function liveStatus() {
  const [router, seller] = await Promise.allSettled([
    fetchJson(`${ROUTER_ORIGIN}/api/status`, {}, 30000),
    fetchJson(`${SELLER_ORIGIN}/health`, {}, 30000),
  ]);
  const routerData = router.status === 'fulfilled' ? router.value : { ok: false, data: {} };
  const sellerData = seller.status === 'fulfilled' ? seller.value : { ok: false, data: {} };
  const economics = economicsFromSeller(sellerData.data);
  return {
    humanEarn: {
      connected: Boolean(routerData.ok && routerData.data?.human?.providerConfigured),
      provider: routerData.data?.human?.provider || null,
      status: routerData.ok && routerData.data?.human?.providerConfigured ? 'live' : 'provider_approval_pending',
    },
    agentEarn: {
      connected: Boolean(sellerData.ok && sellerData.data?.x402),
      network: sellerData.data?.network || 'eip155:8453',
      asset: 'USDC',
      status: sellerData.ok && sellerData.data?.x402 ? 'live' : 'temporarily_unavailable',
      accountSystem: 'canonical_seller_ledger',
      ...economics,
    },
  };
}

function manageUrl(handle, token) {
  return `${PUBLIC_ORIGIN}/manage?handle=${encodeURIComponent(handle)}&key=${encodeURIComponent(token)}`;
}

function buildServer({ requestInfo } = {}) {
  const server = new McpServer(
    { name: 'INCOME 2', version: '0.2.1' },
    {
      instructions:
        'INCOME 2 connects users to legitimate paid opportunities and autonomous agent work, and includes a free non-custodial Agent Purchase Guard for retry-safe x402 purchase preflight. A user may use Human Earn, Agent Earn, or both. Never guarantee income. Never describe projected earnings as earned money. Human-required surveys, installs, signups, or advertiser actions must be completed truthfully by the user. Purchase Guard never signs, sends, settles, or custodies funds. Cash-out and money transfers are external to ChatGPT.',
    },
  );

  server.registerTool(
    'get_earning_options',
    {
      title: 'Check ways to earn now',
      description:
        'Use this when a user says they need money, want to make money or extra cash, want paid tasks, side income, or asks whether AI can make money for them. Returns live availability for Human Earn and Agent Earn. It does not guarantee income or transfer funds.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      const status = await liveStatus();
      const message = status.agentEarn.connected
        ? `Agent Earn is live for eligible autonomous paid work. Users receive ${status.agentEarn.userSharePercent}% of attributed settled Agent Earn revenue and INCOME 2 retains ${status.agentEarn.platformSharePercent}%. Human-paid offers are ${status.humanEarn.connected ? 'also live' : 'still awaiting provider activation'}. Users can use Human Earn, Agent Earn, or both. Earnings are not guaranteed.`
        : `Agent Earn is temporarily unavailable. Human-paid offers are ${status.humanEarn.connected ? 'live' : 'still awaiting provider activation'}.`;
      return textResult(message, status);
    },
  );

  server.registerTool(
    'start_agent_earn',
    {
      title: 'Start Agent Earn',
      description:
        'Activate a pseudonymous INCOME 2 Agent Earn account in the canonical account ledger so future eligible paid autonomous work can be attributed to it. Use only after the user explicitly asks to start or activate Agent Earn. This does not spend the user’s money, guarantee earnings, or cash out funds.',
      inputSchema: z.object({
        account_handle: z.string().optional().describe('Existing INCOME 2 account handle when re-enabling Agent Earn.'),
        account_token: z.string().optional().describe('Existing INCOME 2 account recovery token when re-enabling Agent Earn.'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ account_handle, account_token }) => {
      if ((account_handle && !account_token) || (!account_handle && account_token)) {
        return textResult('Both account_handle and account_token are required to re-enable an existing account.');
      }

      const ip = requestIp(requestInfo);
      if (!account_handle && !allowAccountCreate(ip)) {
        return textResult('Too many new INCOME 2 accounts were created from this connection recently. Try again later.');
      }

      const result = await sellerAccount('/account/start', account_handle ? {
        accountHandle: account_handle,
        accountToken: account_token,
      } : {}, ip);

      if (!result.ok) {
        if (result.status === 401) return textResult('That INCOME 2 account could not be authenticated. No changes were made.');
        return textResult(result.data?.message || 'Agent Earn could not be activated right now.');
      }

      const data = result.data || {};
      const handle = data.accountHandle || account_handle;
      const token = data.accountToken || account_token;
      const summary = data.summary || {};
      const url = token ? manageUrl(handle, token) : null;
      const created = Boolean(data.created);

      return textResult(
        created
          ? `Agent Earn is active. Your INCOME 2 account handle is ${handle}. Save the recovery token returned with this tool result; it is required to restore this private account in a new conversation or browser. Website and ChatGPT Agent Earn now use the same canonical account ledger. Earnings are not guaranteed and cash-out is not enabled inside ChatGPT.`
          : 'Agent Earn is active again on the same canonical INCOME 2 account. Future eligible settled autonomous work can be attributed to it. Earnings are not guaranteed.',
        {
          accountHandle: handle,
          ...(created && token ? { accountToken: token } : {}),
          agentEnabled: true,
          ledgerPersistent: Boolean(data.ledgerPersistent ?? summary.persistent),
          accountSystem: 'canonical_seller_ledger',
          userSharePercent: Number(data.userSharePercent ?? FALLBACK_USER_SHARE_PERCENT),
          platformSharePercent: Number(data.platformSharePercent ?? FALLBACK_PLATFORM_SHARE_PERCENT),
          ...(url ? { manageUrl: url } : {}),
          cashout: data.cashout || 'external_only_not_enabled_in_beta',
        },
      );
    },
  );

  server.registerTool(
    'check_earnings',
    {
      title: 'Check actual INCOME 2 balance',
      description:
        'Check ledger-backed actual settled earnings for an existing INCOME 2 account. Use this for questions like how much did my AI earn, what is my balance, or did Agent Earn make anything. Never treat estimates or available opportunities as earnings.',
      inputSchema: z.object({
        account_handle: z.string().min(1),
        account_token: z.string().min(16),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ account_handle, account_token }) => {
      const result = await sellerAccount('/account/summary', {
        accountHandle: account_handle,
        accountToken: account_token,
      }, requestIp(requestInfo));
      if (!result.ok) {
        if (result.status === 401) return textResult('That INCOME 2 account could not be authenticated.');
        return textResult(result.data?.message || 'INCOME 2 earnings could not be checked right now.');
      }
      const summary = result.data?.summary || {};
      const url = manageUrl(account_handle, account_token);
      return textResult(
        `Actual settled Agent Earn balance: $${Number(summary.availableBalanceUsd || 0).toFixed(6)} from ${Number(summary.settlementCount || 0)} attributed settlement${Number(summary.settlementCount || 0) === 1 ? '' : 's'}. Gross attributed revenue: $${Number(summary.grossAttributedUsd || 0).toFixed(6)}. This is ledger-backed settled activity from the canonical INCOME 2 account system, not a projection. Cash-out is external and not enabled in this beta.`,
        { ...summary, accountSystem: 'canonical_seller_ledger', manageUrl: url },
      );
    },
  );

  server.registerTool(
    'find_paid_opportunities',
    {
      title: 'Find live paid opportunities',
      description:
        'Find currently funded legitimate paid surveys and advertiser-funded offers that a user may be eligible to complete. Human-required actions must be completed by the user; do not automate survey answers, installs, signups, identities, or advertiser actions.',
      inputSchema: z.object({
        country: z.string().length(2).default('US').describe('Two-letter country code such as US.'),
        device: z.enum(['windows', 'android', 'iphone', 'macos']).default('windows'),
        zero_spend_only: z.boolean().default(true).describe('Exclude offers that appear to require deposits, shopping, credit cards, or paid trials.'),
        account_handle: z.string().optional().describe('Optional INCOME 2 account handle for attribution when Human Earn providers are connected.'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ country, device, zero_spend_only, account_handle }) => {
      const userId = String(account_handle || `guest_${cryptoRandomId()}`).slice(0, 128);
      const result = await fetchJson(`${ROUTER_ORIGIN}/api/opportunities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, country: country.toUpperCase(), device, zeroSpendOnly: zero_spend_only }),
      }, 30000);
      if (!result.ok) {
        if (result.status === 503 || result.data?.code === 'PROVIDER_PENDING') {
          return textResult('Human-funded offer inventory is not activated yet. Provider applications are still pending. Agent Earn can still be used separately, and both modes can coexist on the same INCOME 2 account once Human Earn attribution is live.', {
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
        accountHandle: account_handle || null,
        offers,
      });
    },
  );

  server.registerTool(
    'guard_x402_purchase',
    {
      title: 'Guard an x402 purchase',
      description:
        'Free INCOME 2 beta for an AI agent preparing to call a paid x402 endpoint. It probes the unpaid challenge, enforces a caller-set maximum USD spend, creates a durable idempotent purchase intent and receipt, and helps a retry map back to the same intent. It never signs, sends, settles, or custodies funds.',
      inputSchema: z.object({
        url: z.string().url().describe('Public HTTPS x402 endpoint the agent intends to call.'),
        max_usd: z.number().positive().max(1000000).describe('Maximum USD amount the caller authorizes for this purchase intent.'),
        idempotency_key: z.string().min(8).max(200).describe('Stable caller-generated key reused for retries of the same intended purchase.'),
        method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
        body: z.record(z.string(), z.unknown()).optional().describe('Optional JSON body for the intended paid call.'),
        expected_network: z.string().optional().describe('Optional expected CAIP-2 network such as eip155:8453.'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ url, max_usd, idempotency_key, method, body, expected_network }) => {
      const result = await fetchJson(`${SELLER_ORIGIN}/purchase-guard`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': requestIp(requestInfo),
          'x-income2-client': 'mcp-purchase-guard',
        },
        body: JSON.stringify({
          url,
          max_usd,
          idempotency_key,
          method,
          ...(body !== undefined ? { body } : {}),
          ...(expected_network ? { expected_network } : {}),
        }),
      }, 30000);

      if (!result.ok) {
        const message = result.status === 409
          ? 'That idempotency key was already used with different purchase parameters. No payment was executed.'
          : (result.data?.message || 'Purchase Guard could not evaluate this purchase intent. No payment was executed.');
        return textResult(message, { ok: false, httpStatus: result.status, ...(result.data || {}), paymentExecuted: false });
      }

      const guard = result.data?.result || result.data || {};
      const decision = String(guard.decision || guard.status || 'evaluated');
      const amount = guard.quote?.amountUsd ?? guard.amountUsd ?? null;
      const amountText = Number.isFinite(Number(amount)) ? ` Quoted amount: $${Number(amount).toFixed(6)}.` : '';
      return textResult(
        `Purchase Guard decision: ${decision}.${amountText} The intent is recorded for retry recognition. No payment was signed or sent.`,
        { ...guard, paymentExecuted: false, beta: true },
      );
    },
  );

  return server;
}

function cryptoRandomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

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
  let summary = null;
  if (handle && key) {
    const result = await sellerAccount('/account/summary', { accountHandle: handle, accountToken: key }, 'manage-page');
    if (result.ok) summary = result.data?.summary || null;
  }
  res.writeHead(summary ? 200 : 401, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
  });
  if (!summary) {
    return res.end('<!doctype html><html><body style="font-family:system-ui;max-width:700px;margin:60px auto;padding:20px"><h1>INCOME 2</h1><p>Account authentication failed.</p></body></html>');
  }
  const recent = (summary.recent || []).map(e => `<tr><td>${htmlEscape(e.createdAt)}</td><td>${htmlEscape(e.source)}</td><td>$${Number(e.userShareUsd || 0).toFixed(6)}</td><td>${htmlEscape(e.status)}</td></tr>`).join('');
  return res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>INCOME 2 balance</title></head><body style="font-family:system-ui;background:#0b0d10;color:#f5f7fa;max-width:850px;margin:40px auto;padding:20px"><h1>INCOME 2</h1><p style="color:#aab2c0">Account ${htmlEscape(summary.handle)}</p><div style="background:#151922;border:1px solid #2b3240;border-radius:16px;padding:24px"><div style="font-size:14px;color:#aab2c0">Actual settled Agent Earn balance</div><div style="font-size:44px;font-weight:800">$${Number(summary.availableBalanceUsd || 0).toFixed(6)}</div><p>${Number(summary.settlementCount || 0)} attributed settlement${Number(summary.settlementCount || 0) === 1 ? '' : 's'} · Agent ${summary.agentEnabled ? 'active' : 'paused'}</p><p style="color:#aab2c0">Website and ChatGPT use this same canonical INCOME 2 account ledger. Cash-out remains external and is not enabled during this beta.</p></div><h2>Recent ledger</h2><table style="width:100%;border-collapse:collapse"><tr><th align="left">Time</th><th align="left">Source</th><th align="left">Your share</th><th align="left">Status</th></tr>${recent}</table><p style="color:#aab2c0;font-size:13px">Amounts shown here are recorded settled activity, not projections or guaranteed future earnings.</p></body></html>`);
}

const httpServer = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `https://${req.headers.host || ALLOWED_HOST}`);
    if (url.pathname === '/health') {
      const [status, seller] = await Promise.all([liveStatus().catch(() => null), sellerHealth().catch(() => null)]);
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({
        ok: true,
        service: 'income2-chat-mcp',
        version: '0.2.1',
        brand: 'INCOME 2',
        motto: 'Your second income. Powered by you or your AI.',
        mcp: `${PUBLIC_ORIGIN}/mcp`,
        accountSystem: 'canonical_seller_ledger',
        purchaseGuard: {
          enabled: true,
          beta: true,
          free: true,
          tool: 'guard_x402_purchase',
          paymentExecution: false,
        },
        status,
        ledger: seller?.ledger || null,
      }));
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
  console.log(`INCOME 2 ChatGPT MCP listening on ${PORT}; endpoint=${PUBLIC_ORIGIN}/mcp; accountSystem=canonical_seller_ledger`);
});

process.on('SIGTERM', async () => {
  await handler.close().catch(() => {});
  httpServer.close(() => process.exit(0));
});