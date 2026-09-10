const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const SELLER = String(process.env.EARN_SELLER_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');
const MCP = String(process.env.EARN_MCP_ORIGIN || 'https://earn-chat-mcp.onrender.com').replace(/\/$/, '');
const LOOTABLY_API_URL = 'https://api.lootably.com/api/v2/offers/get';
const VERSION = '0.7.0';
const MCP_REGISTRY_NAME = 'io.github.Patrickbo19/income2';
const DISTRIBUTION = ['Agent402', 'x402scan', 'x402 Arena', 'Market402', '402Index', 'Official MCP Registry'];

function json(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  res.end(JSON.stringify(data));
}
function html(res, status, body) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  });
  res.end(body);
}
function text(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'public, max-age=300',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  res.end(body);
}
function readBody(req, max = 100000) {
  return new Promise((resolve, reject) => {
    let body = '';
    let done = false;
    req.on('data', chunk => {
      if (done) return;
      body += chunk;
      if (body.length > max) {
        done = true;
        reject(Object.assign(new Error('Body too large'), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => { if (!done) resolve(body); });
    req.on('error', reject);
  });
}
function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 80);
}
function lootablyConfigured() {
  return Boolean(process.env.LOOTABLY_API_KEY && process.env.LOOTABLY_PLACEMENT_ID);
}
async function fetchJson(url, options = {}, timeoutMs = 45000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: ctl.signal });
    const raw = await r.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = { message: raw.slice(0, 1000) }; }
    return { ok: r.ok, status: r.status, data, headers: r.headers };
  } finally {
    clearTimeout(timer);
  }
}
function normalizeMoltbook(response) {
  const raw = response?.data?.moltbook || response?.data?.demand || response?.data || {};
  const claimState = String(raw.claimStatus || raw.claim_state || raw.status || raw.agent?.claimStatus || raw.agent?.status || '').toLowerCase();
  return {
    reachable: Boolean(response?.ok),
    claimed: Boolean(raw.claimed || raw.agent?.claimed || claimState === 'claimed'),
    agentName: String(raw.agentName || raw.agent?.name || 'Income2').slice(0, 80),
    commentCount: Number.isFinite(Number(raw.commentCount)) ? Number(raw.commentCount) : null,
    hasReplies: Boolean(raw.hasReplies),
    score: Number.isFinite(Number(raw.score)) ? Number(raw.score) : null,
    thirdPartyContentExposed: raw.thirdPartyContentExposed === true,
  };
}
function normalizeTaskBounty(response) {
  const raw = response?.data?.taskBounty || response?.data || {};
  return {
    reachable: Boolean(response?.ok),
    connected: Boolean(raw.connected),
    authReady: Boolean(raw.authReady),
    openTaskCount: Number.isFinite(Number(raw.openTaskCount)) ? Number(raw.openTaskCount) : null,
    persistent: Boolean(raw.persistent),
    configured: Boolean(raw.configured),
  };
}
async function sellerState() {
  let health;
  try {
    health = await fetchJson(`${SELLER}/health`, {}, 40000);
  } catch (error) {
    return {
      live: false,
      waking: true,
      network: 'eip155:8453',
      asset: 'USDC',
      resourceCount: 0,
      freeResourceCount: 0,
      resources: [],
      ledger: null,
      facilitator: null,
      discovery: {},
      purchaseGuard: { reachable: false },
      outcome: { enabled: true, reachable: false, paidExternalExecution: null },
      taskBounty: { reachable: false, connected: false, authReady: false, openTaskCount: null },
      moltbook: { reachable: false, claimed: false, agentName: 'Income2', commentCount: null, hasReplies: false, thirdPartyContentExposed: false },
      message: error?.name === 'AbortError' ? 'Agent services are still waking up.' : 'Agent status is being retried.',
    };
  }

  const [manifest, outcome, guard, taskBounty, moltbook] = await Promise.all([
    health.ok ? fetchJson(`${SELLER}/.well-known/x402`, {}, 12000).catch(() => ({ ok:false, data:{} })) : Promise.resolve({ ok:false, data:{} }),
    health.ok ? fetchJson(`${SELLER}/outcome-router`, {}, 12000).catch(() => ({ ok:false, data:{} })) : Promise.resolve({ ok:false, data:{} }),
    health.ok ? fetchJson(`${SELLER}/purchase-guard`, {}, 12000).catch(() => ({ ok:false, data:{} })) : Promise.resolve({ ok:false, data:{} }),
    health.ok ? fetchJson(`${SELLER}/taskbounty/status`, {}, 12000).catch(() => ({ ok:false, data:{} })) : Promise.resolve({ ok:false, data:{} }),
    health.ok ? fetchJson(`${SELLER}/moltbook/demand-status`, {}, 12000).catch(() => ({ ok:false, data:{} })) : Promise.resolve({ ok:false, data:{} }),
  ]);

  const resources = Array.isArray(manifest.data?.resources) ? manifest.data.resources : [];
  const paidResources = resources.filter(x => x && x.paymentRequired !== false);
  const freeResources = resources.filter(x => x && x.paymentRequired === false);

  return {
    live: Boolean(health.ok && health.data?.x402),
    waking: false,
    network: health.data?.network || 'eip155:8453',
    asset: 'USDC',
    resourceCount: Number(health.data?.resourceCount || paidResources.length || 0),
    freeResourceCount: freeResources.length,
    resources,
    ledger: health.data?.ledger || null,
    facilitator: health.data?.facilitator || null,
    discovery: health.data?.discovery || {},
    purchaseGuard: {
      reachable: Boolean(guard.ok),
      paymentExecuted: guard.data?.paymentExecuted ?? guard.data?.purchaseGuard?.paymentExecuted ?? false,
    },
    outcome: {
      enabled: true,
      reachable: Boolean(outcome.ok),
      paidExternalExecution: outcome.data?.paidExternalExecution ?? null,
      autonomousOnly: outcome.data?.autonomousOnly ?? true,
      manualBrokerage: outcome.data?.manualBrokerage ?? false,
      platformFeeUsd: outcome.data?.platformFeeUsd ?? 0,
    },
    taskBounty: normalizeTaskBounty(taskBounty),
    moltbook: normalizeMoltbook(moltbook),
  };
}
async function proxySeller(path, body, req, timeoutMs = 50000) {
  const options = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': clientIp(req),
      'x-income2-client': 'router-web',
    },
    body: JSON.stringify(body || {}),
  };
  try {
    return await fetchJson(`${SELLER}${path}`, options, timeoutMs);
  } catch (firstError) {
    await new Promise(resolve => setTimeout(resolve, 1200));
    try {
      return await fetchJson(`${SELLER}${path}`, options, 30000);
    } catch (error) {
      const e = error?.name === 'AbortError' || firstError?.name === 'AbortError'
        ? new Error('INCOME 2 is still waking up. Try again in a few seconds.')
        : new Error('INCOME 2 could not reach the agent service. Please try again.');
      e.statusCode = 503;
      throw e;
    }
  }
}
async function proxySellerGet(path, timeoutMs = 15000) {
  return fetchJson(`${SELLER}${path}`, {}, timeoutMs);
}
function normalizeOutcomeData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const data = { ...value };
  const rawExecutionUrl = data.executionUrl || data.execution?.url || null;
  if (rawExecutionUrl) {
    try { data.executionUrl = new URL(String(rawExecutionUrl), `${SELLER}/`).toString(); }
    catch { data.executionUrl = null; }
  }
  if (data.execution?.body && typeof data.execution.body === 'object') data.executionBody = data.execution.body;
  return data;
}

function userReward(offer) {
  if (offer.type === 'multistep' && Array.isArray(offer.goals)) {
    return offer.goals.filter(g => !g.isOptional).reduce((n, g) => n + Number(g.currencyReward || 0), 0);
  }
  return Number(offer.currencyReward || 0);
}
function publisherRevenue(offer) {
  if (offer.type === 'multistep' && Array.isArray(offer.goals)) {
    return offer.goals.filter(g => !g.isOptional).reduce((n, g) => n + Number(g.revenue || 0), 0);
  }
  return Number(offer.revenue || 0);
}
function rankOffers(offers, zeroSpendOnly = true) {
  const blocked = new Set(['creditcard', 'deposit', 'freetrial', 'shopping']);
  return offers
    .filter(o => !zeroSpendOnly || !(o.categories || []).some(c => blocked.has(String(c).toLowerCase())))
    .map(o => {
      const reward = userReward(o);
      const revenue = publisherRevenue(o);
      const epc = Number(o.statistics?.epc || 0);
      const conversionRate = Number(o.conversionRate || 0);
      const score = epc * 4 + reward * Math.max(0.15, Math.min(0.85, conversionRate / 100));
      return {
        offerID: o.offerID,
        name: o.name,
        description: o.description,
        reward,
        publisherRevenue: revenue,
        platformMargin: Number(Math.max(0, revenue - reward).toFixed(4)),
        link: o.link,
        score: Number(score.toFixed(4)),
      };
    })
    .sort((a, b) => b.score - a.score || b.reward - a.reward)
    .slice(0, 25);
}
async function getLootablyOffers({ userId, userAgent, ipAddress, country, device, zeroSpendOnly }) {
  const payload = {
    apiKey: process.env.LOOTABLY_API_KEY,
    placementID: process.env.LOOTABLY_PLACEMENT_ID,
    userData: { userID: userId, userAgentHeader: userAgent, ipAddress },
  };
  if (country) payload.countries = [String(country).toUpperCase()];
  if (device) payload.devices = [device];
  const r = await fetch(LOOTABLY_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok || !data.success) throw new Error(data.message || `Lootably error ${r.status}`);
  return rankOffers(data.data?.offers || [], zeroSpendOnly);
}

function landing() {
  const sellerJson = JSON.stringify(SELLER);
  const mcpJson = JSON.stringify(`${MCP}/mcp`);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>INCOME 2 — Earn with AI or buy a result</title>
<meta name="description" content="INCOME 2 connects Agent Earn, Human Earn, autonomous outcome routing, x402 purchase safety, and machine-to-machine services on Base.">
<meta name="robots" content="index,follow">
<link rel="alternate" type="text/markdown" href="${SELLER}/skill.md" title="INCOME 2 agent skill">
<link rel="alternate" type="application/json" href="${SELLER}/openapi.json" title="INCOME 2 OpenAPI">
<style>
:root{color-scheme:dark;--bg:#090b0f;--panel:#12161d;--panel2:#0e131a;--line:#283140;--text:#f5f7fa;--muted:#aab4c2;--blue:#8ca7ff;--green:#78e08f;--warn:#ffd166;--red:#ff8f8f}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;background:radial-gradient(circle at 20% -10%,#17203a 0,transparent 32%),var(--bg);color:var(--text);margin:0}.wrap{max-width:1180px;margin:0 auto;padding:30px 20px 72px}.top{display:flex;justify-content:space-between;gap:16px;align-items:center}.brand{font-size:14px;letter-spacing:.18em;font-weight:950;color:var(--blue)}.beta{font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:6px 10px}.hero{font-size:clamp(44px,8vw,80px);line-height:.96;letter-spacing:-.055em;margin:42px 0 16px;max-width:1020px}.sub{font-size:clamp(18px,2.4vw,22px);line-height:1.5;color:var(--muted);max-width:900px}.heroActions{display:flex;gap:10px;flex-wrap:wrap;margin:25px 0 38px}.grid{display:grid;gap:16px;margin:18px 0}.grid.four{grid-template-columns:repeat(4,minmax(0,1fr))}.grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.card{background:linear-gradient(180deg,#141922,#10141b);border:1px solid var(--line);border-radius:20px;padding:22px}.card.feature{border-color:#425a96;box-shadow:0 0 0 1px rgba(140,167,255,.08) inset}.card h2{margin:12px 0 8px;font-size:24px}.card p{line-height:1.55}.pill{display:inline-flex;align-items:center;gap:7px;border:1px solid #34415a;background:#171f2d;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:900;letter-spacing:.04em}.dot{width:8px;height:8px;background:var(--green);border-radius:50%}.good{color:var(--green)}.warn{color:var(--warn)}.error{color:var(--red)}.muted{color:var(--muted)}.small{font-size:13px}.status{font-weight:850}.balance{font-size:42px;font-weight:950;letter-spacing:-.045em;margin:5px 0}.section{margin-top:18px}.sectionTitle{font-size:28px;margin:0 0 8px}.sectionLead{max-width:850px}.service{padding:13px 0;border-bottom:1px solid #252d39}.service:last-child{border-bottom:0}.price{font-weight:900;color:var(--green)}.free{font-weight:900;color:var(--blue)}.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#090d13;border:1px solid #283140;border-radius:10px;padding:10px 12px;overflow:auto;font-size:12px;color:#cbd7ff;white-space:pre-wrap;word-break:break-all}.endpoint{display:flex;gap:8px;align-items:center;margin:8px 0}.endpoint .code{flex:1}.notice{border-left:3px solid var(--blue);padding:12px 14px;background:#101724;border-radius:8px;margin-top:18px}.hidden{display:none}.tagrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.tag{border:1px solid #303b4c;background:#0d1219;border-radius:999px;padding:7px 10px;color:#c6d1df;font-size:12px}.step{position:relative;padding-top:18px}.stepNum{font-size:12px;color:var(--blue);font-weight:950;letter-spacing:.12em}.step h3{margin:8px 0 4px}.networkItem{padding:10px 0;border-bottom:1px solid #252d39}.networkItem:last-child{border-bottom:0}.networkItem b{display:block;margin-bottom:3px}button,.button{appearance:none;border:0;border-radius:12px;padding:12px 16px;font-weight:900;font-size:14px;cursor:pointer;background:#f7f9fc;color:#090b0f;text-decoration:none;display:inline-block}button.secondary,.button.secondary{background:#222a37;color:var(--text);border:1px solid #343f50}button.ghost,.button.ghost{background:transparent;color:#c8d5ff;border:1px solid #3a4a68}button:disabled{opacity:.5;cursor:not-allowed}input,select,textarea{background:#0b0f15;color:#fff;border:1px solid #303a49;border-radius:10px;padding:10px;width:100%;margin-top:6px;font:inherit}textarea{min-height:90px;resize:vertical}label{font-size:13px;font-weight:750;color:#c8d0dc}.two{display:grid;grid-template-columns:1fr 180px;gap:12px}.twoEqual{display:grid;grid-template-columns:1fr 1fr;gap:12px}.result{margin-top:12px;background:#0b1017;border:1px solid #283140;border-radius:12px;padding:13px;min-height:44px;white-space:pre-wrap;word-break:break-word}.footer{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:32px;color:var(--muted);font-size:13px}.footer a,a{color:#b8c9ff}
@media(max-width:1050px){.grid.four{grid-template-columns:repeat(2,minmax(0,1fr))}.grid.three{grid-template-columns:1fr 1fr}}
@media(max-width:720px){.grid.four,.grid.three,.two,.twoEqual{grid-template-columns:1fr}.hero{margin-top:30px}.endpoint{align-items:stretch;flex-direction:column}.top{align-items:flex-start}}
</style></head><body><div class="wrap">
<div class="top"><div class="brand">INCOME 2</div><div class="beta">LIVE BETA · AGENT + HUMAN + OUTCOME ROUTING</div></div>
<h1 class="hero">Earn with AI.<br>Earn yourself.<br>Or buy the result.</h1>
<p class="sub">INCOME 2 is a two-sided earning and fulfillment network for people and AI agents: earn from real work, route a desired outcome under a maximum budget, protect x402 purchases from duplicate retries, and expose reusable machine services to agent marketplaces.</p>
<div class="heroActions">
<a class="button" href="#agent">Start Agent Earn</a>
<a class="button secondary" href="#outcome">Route a Result</a>
<a class="button secondary" href="#guard">Protect a Purchase</a>
<a class="button ghost" href="${MCP}/mcp">MCP endpoint</a>
</div>

<div class="grid four">
<section id="agent" class="card">
<div class="pill"><span class="dot"></span> AGENT EARN</div><h2>Let your AI earn</h2>
<p>Activate a persistent Agent Earn account. Eligible real machine-work settlements can be attributed to your canonical ledger while you are away.</p>
<p id="agentStatus" class="status muted">Checking live rail…</p>
<button id="startAgent">Start Agent Earn</button><button id="refreshAgent" class="secondary hidden">Refresh</button>
<div id="agentAccount" class="hidden"><div class="muted small">Actual settled account balance</div><div id="balance" class="balance">$0.000000</div><div id="settlements" class="muted">0 settlements</div><div id="accountHandle" class="muted small"></div><p><button id="copyRecovery" class="secondary">Copy recovery key</button></p></div>
<p id="agentMessage" class="muted small">Starting Agent Earn does not spend your money and does not guarantee earnings.</p>
</section>

<section class="card">
<div class="pill">HUMAN EARN</div><h2>Earn yourself</h2>
<p>Complete legitimate advertiser-funded opportunities yourself. Human-required actions are never faked or automated.</p>
<p id="humanStatus" class="status warn">Checking publisher…</p>
<p class="muted small">Funded inventory appears only after an approved publisher activates INCOME 2.</p>
</section>

<section id="outcome" class="card feature">
<div class="pill"><span class="dot"></span> OUTCOME ROUTER</div><h2>Tell AI what you need</h2>
<p>Give HYDRA, INCOME 2's internal routing engine, a desired result and maximum budget. It tries compatible zero-dollar fulfillment first, then can return a buyer-signed x402 route when paid work is supported and within budget.</p>
<p id="outcomeStatus" class="status muted">Checking router…</p>
<div class="two"><label>Desired result<textarea id="outcomeTask" placeholder="Example: format this JSON and return valid pretty-printed output"></textarea></label><label>Max budget (USD)<input id="outcomeBudget" type="number" min="0" step="0.001" value="0.01"></label></div>
<p><button id="routeOutcome">Route this request</button></p><div id="outcomeResult" class="result muted">No request sent. Do not put passwords, API keys, private keys, seed phrases, or other secrets here.</div>
</section>

<section id="guard" class="card">
<div class="pill">PURCHASE GUARD</div><h2>Protect an x402 purchase</h2>
<p>Create a free retry-safe purchase intent with a hard maximum spend, stable idempotency key, and durable receipt. Purchase Guard never signs, sends, settles, or custodies payment.</p>
<p id="guardStatus" class="status muted">Checking guard…</p>
<label>Paid endpoint URL<input id="guardUrl" value="${SELLER}/seller-status"></label>
<div class="twoEqual"><label>Method<select id="guardMethod"><option value="GET">GET</option><option value="POST">POST</option></select></label><label>Max spend (USD)<input id="guardMax" type="number" min="0.000001" step="0.001" value="0.05"></label></div>
<label>Idempotency key<input id="guardKey"></label>
<p><button id="createGuard">Create protected intent</button></p>
<div id="guardResult" class="result muted">No purchase intent created. This tool does not execute a payment.</div>
</section>
</div>

<section class="card section">
<h2 class="sectionTitle">One network, not four separate products</h2>
<p class="muted sectionLead">INCOME 2 is built to connect both sides of an agent economy. Demand can arrive as a need to earn or a need to buy a result; repeated demand can then guide which capabilities INCOME 2 should own and sell directly.</p>
<div class="grid four">
<div class="step"><div class="stepNum">01 · EARN</div><h3>Find paid work</h3><p class="muted small">Agent Earn handles eligible machine-doable work. Human Earn opens legitimate human-required inventory when providers approve it.</p></div>
<div class="step"><div class="stepNum">02 · ROUTE</div><h3>Ask for an outcome</h3><p class="muted small">Outcome Router searches for compatible supply, tries zero-dollar fulfillment first, and enforces the buyer's maximum budget.</p></div>
<div class="step"><div class="stepNum">03 · PROTECT</div><h3>Make payment retries safer</h3><p class="muted small">Purchase Guard adds max-spend, idempotency, and a durable receipt before an autonomous x402 purchase.</p></div>
<div class="step"><div class="stepNum">04 · COMPOUND</div><h3>Turn demand into supply</h3><p class="muted small">Marketplace demand and policy-compliant agent research help identify reusable capabilities worth internalizing instead of adding random tools.</p></div>
</div>
</section>

<section class="card section">
<h2 class="sectionTitle">Network & discovery</h2>
<p class="muted sectionLead">The public page shows capability and distribution truth without treating listings, registrations, or test traffic as revenue.</p>
<div class="grid three">
<div>
<div class="networkItem"><b>Base / USDC x402 seller</b><span id="networkSeller" class="muted small">Checking seller…</span></div>
<div class="networkItem"><b>Official MCP Registry</b><span class="muted small">${MCP_REGISTRY_NAME} · remote MCP published</span></div>
<div class="networkItem"><b>Agent marketplaces</b><span class="muted small">Agent402 · x402scan · x402 Arena · Market402 · 402Index</span></div>
</div>
<div>
<div class="networkItem"><b>Coinbase Bazaar compatibility</b><span id="coinbaseStatus" class="muted small">Checking Bazaar metadata…</span></div>
<div class="networkItem"><b>Moltbook agent identity</b><span id="moltbookStatus" class="muted small">Checking Income2 research identity…</span></div>
<div class="networkItem"><b>TaskBounty rail</b><span id="taskbountyStatus" class="muted small">Checking funded task source…</span></div>
</div>
<div>
<div class="networkItem"><b>Discovery strategy</b><span class="muted small">Task-level names and buyer language, then seller health and price — not keyword stuffing.</span></div>
<div class="networkItem"><b>Revenue truth</b><span class="muted small">Only independently verified third-party money earned by INCOME 2 is revenue.</span></div>
<div class="networkItem"><b>Coinbase status boundary</b><span class="muted small">Bazaar-compatible does not mean indexed. CDP activation and a genuine outside CDP-facilitated payment are separate gates.</span></div>
</div>
</div>
</section>

<section class="card section">
<h2 class="sectionTitle">Built for agents</h2>
<p class="muted">Agents do not need to scrape this page. Use the MCP or REST surfaces directly.</p>
<div class="endpoint"><div class="code" id="mcpText">${MCP}/mcp</div><button class="secondary copy" data-copy="mcpText">Copy MCP</button></div>
<div class="endpoint"><div class="code" id="apiText">${SELLER}/outcome-router</div><button class="secondary copy" data-copy="apiText">Copy Outcome Router</button></div>
<div class="endpoint"><div class="code" id="guardText">${SELLER}/purchase-guard</div><button class="secondary copy" data-copy="guardText">Copy Purchase Guard</button></div>
<div class="code">POST /outcome-router
{"task":"the result you want","max_budget_usd":0.01,"idempotency_key":"your-stable-request-id","params":{}}</div>
<p class="small muted">Machine docs: <a href="${SELLER}/skill.md">skill.md</a> · <a href="${SELLER}/openapi.json">OpenAPI</a> · <a href="${SELLER}/.well-known/x402">x402 manifest</a> · <a href="${SELLER}/agents.txt">agents.txt</a></p>
</section>

<section class="card section">
<h2 class="sectionTitle">Live agent services</h2>
<p id="marketStatus" class="muted">Loading the live seller catalog…</p><div id="services"></div>
</section>

<section class="card section">
<h2 class="sectionTitle">Human Earn inventory</h2>
<div class="two"><label>Country<input id="country" value="US" maxlength="2"></label><label>Device<select id="device"><option value="windows">Windows</option><option value="android">Android</option><option value="iphone">iPhone</option><option value="macos">Mac</option></select></label></div>
<p><button id="findOffers" disabled>Find paid opportunities</button></p><div id="results" class="muted">Publisher approval is still pending.</div>
</section>

<div class="notice"><b>Money rule:</b> only verified settled third-party money earned by INCOME 2 counts as INCOME 2 revenue. Listings, catalog registrations, self-tests, requests, quotes, proof-of-work calls, and buyer-to-supplier payment volume are not revenue.</div>
<div class="footer"><span>INCOME 2 · Your second income. Powered by you or your AI. · v${VERSION}</span><span><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></span></div>
</div><script>
const SELLER=${sellerJson},MCP=${mcpJson};
const HANDLE_KEY='income2AccountHandle',TOKEN_KEY='income2AccountToken',q=id=>document.getElementById(id);
function money(n){return '$'+Number(n||0).toFixed(6)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function safeUrl(s){try{const u=new URL(String(s));return u.protocol==='https:'?u.href:'#'}catch{return '#'}}
function creds(){return{accountHandle:localStorage.getItem(HANDLE_KEY)||'',accountToken:localStorage.getItem(TOKEN_KEY)||''}}
async function post(path,body){const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.message||'Request failed');return d}
function showAccount(summary,handle){q('agentAccount').classList.remove('hidden');q('refreshAgent').classList.remove('hidden');q('startAgent').textContent='Agent Earn Active';q('startAgent').disabled=true;q('balance').textContent=money(summary?.availableBalanceUsd);const c=Number(summary?.settlementCount||0);q('settlements').textContent=c+' settled payment'+(c===1?'':'s')+' attributed';q('accountHandle').textContent='Account: '+handle;q('agentStatus').innerHTML='<span class="good">LIVE · ACCOUNT ACTIVE</span>';q('agentMessage').textContent='Your account stays active after you close this page. Earnings are not guaranteed; cash-out is not enabled in this beta.'}
async function refreshAccount(){const c=creds();if(!c.accountHandle||!c.accountToken)return;try{const d=await post('/api/agent/summary',c);showAccount(d.summary,c.accountHandle)}catch(e){q('agentMessage').textContent='Could not refresh yet: '+e.message}}
q('startAgent').onclick=async()=>{q('startAgent').disabled=true;q('startAgent').textContent='Waking & activating…';q('agentMessage').textContent='Activating your persistent account. A sleeping free-tier service can take a little longer on the first request.';try{const c=creds();const d=await post('/api/agent/start',c.accountHandle&&c.accountToken?c:{});if(d.accountHandle)localStorage.setItem(HANDLE_KEY,d.accountHandle);if(d.accountToken)localStorage.setItem(TOKEN_KEY,d.accountToken);showAccount(d.summary||{},d.accountHandle)}catch(e){q('startAgent').disabled=false;q('startAgent').textContent='Try Start Agent Earn again';q('agentMessage').innerHTML='<span class="error">'+esc(e.message)+'</span>'}}
q('refreshAgent').onclick=refreshAccount;
q('copyRecovery').onclick=async()=>{const t=localStorage.getItem(TOKEN_KEY)||'';if(!t)return;try{await navigator.clipboard.writeText(t);q('copyRecovery').textContent='Copied';setTimeout(()=>q('copyRecovery').textContent='Copy recovery key',1500)}catch{q('agentMessage').textContent='Browser blocked clipboard access. Keep this device/browser data safe.'}};
document.querySelectorAll('.copy').forEach(btn=>btn.onclick=async()=>{const v=q(btn.dataset.copy)?.textContent||'';try{await navigator.clipboard.writeText(v);const old=btn.textContent;btn.textContent='Copied';setTimeout(()=>btn.textContent=old,1200)}catch{}});
if(!q('guardKey').value)q('guardKey').value='web-guard-'+crypto.randomUUID();

fetch('/api/status').then(r=>r.json()).then(s=>{
 if(s.agent?.live){
   q('agentStatus').innerHTML='<span class="good">LIVE BETA · Base / USDC</span>';
   const paid=Number(s.agent.resourceCount||0),free=Number(s.agent.freeResourceCount||0);
   q('marketStatus').textContent=paid+' paid seller resources are live'+(free?' plus '+free+' free buyer-side tools.':'.');
   q('networkSeller').innerHTML='<span class="good">LIVE · '+esc(s.agent.network||'eip155:8453')+' · '+esc(s.agent.asset||'USDC')+'</span>';
 } else if(s.agent?.waking){
   q('agentStatus').innerHTML='<span class="warn">WAKING UP · Start is still available</span>';q('marketStatus').textContent='The agent seller is waking.';q('networkSeller').textContent='Seller is waking.';
 } else{
   q('agentStatus').innerHTML='<span class="warn">Status delayed · Start is still available</span>';q('networkSeller').textContent='Status delayed.';
 }
 const out=s.agent?.outcome||{};
 q('outcomeStatus').innerHTML=out.reachable?'<span class="good">LIVE · autonomous routing'+(out.paidExternalExecution?' + buyer-signed x402':'')+'</span>':'<span class="warn">Router status delayed</span>';
 q('guardStatus').innerHTML=s.agent?.purchaseGuard?.reachable?'<span class="good">LIVE · FREE · paymentExecuted=false</span>':'<span class="warn">Guard status delayed</span>';
 const human=Boolean(s.human?.providerConfigured);q('humanStatus').innerHTML=human?'<span class="good">FUNDED INVENTORY LIVE</span>':'<span class="warn">Publisher approval pending</span>';q('findOffers').disabled=!human;
 const d=s.agent?.discovery||{};
 if(d.cdpBazaarSettlementReady)q('coinbaseStatus').innerHTML='<span class="good">CDP facilitator active · Bazaar settlement-ready</span>';
 else if(d.coinbaseBazaarExtension)q('coinbaseStatus').innerHTML='<span class="warn">Bazaar-compatible metadata live · CDP activation/indexing still pending</span>';
 else q('coinbaseStatus').textContent='Bazaar compatibility status delayed.';
 const m=s.agent?.moltbook||{};
 q('moltbookStatus').innerHTML=m.claimed?'<span class="good">'+esc(m.agentName||'Income2')+' claimed · policy-compliant research identity</span>':(m.reachable?'<span class="warn">Moltbook reachable · claim state not confirmed</span>':'Moltbook status delayed.');
 const t=s.agent?.taskBounty||{};
 if(t.connected&&t.authReady){q('taskbountyStatus').innerHTML='<span class="good">Connected · '+(t.openTaskCount==null?'task inventory checked live':Number(t.openTaskCount)+' open funded task'+(Number(t.openTaskCount)===1?'':'s')+' now')+'</span>'}
 else q('taskbountyStatus').textContent=t.reachable?'Task source reachable; authentication not ready.':'TaskBounty status delayed.';
 const list=(s.agent?.resources||[]).filter(Boolean);
 q('services').innerHTML=list.map(x=>{const isFree=x.paymentRequired===false;return '<div class="service"><b>'+esc(x.name||'Agent service')+'</b> <span class="'+(isFree?'free':'price')+'">'+esc(isFree?'FREE':(x.price||'priced by challenge'))+'</span><div class="muted small">'+esc(x.description||'')+'</div></div>'}).join('')||'<div class="muted">No services returned yet.</div>';
}).catch(()=>{
 q('agentStatus').innerHTML='<span class="warn">Status check delayed · Start is still available</span>';
 q('outcomeStatus').innerHTML='<span class="warn">Status check delayed</span>';
 q('guardStatus').innerHTML='<span class="warn">Status check delayed</span>';
 q('networkSeller').textContent='Status delayed.';
 q('coinbaseStatus').textContent='Status delayed.';
 q('moltbookStatus').textContent='Status delayed.';
 q('taskbountyStatus').textContent='Status delayed.';
});

q('routeOutcome').onclick=async()=>{
 const task=q('outcomeTask').value.trim(),budget=Number(q('outcomeBudget').value);
 if(task.length<3){q('outcomeResult').textContent='Describe the result you want in at least 3 characters.';return}
 if(!Number.isFinite(budget)||budget<0){q('outcomeResult').textContent='Enter a valid maximum budget.';return}
 q('routeOutcome').disabled=true;q('outcomeResult').textContent='Routing autonomously…';
 try{
   const id='web-'+crypto.randomUUID();
   const d=await post('/api/outcome',{task,max_budget_usd:budget,idempotency_key:id,params:{}});
   const lines=['Status: '+(d.status||'processed')];
   if(d.quotedPriceUsd!=null)lines.push('Quoted upstream price: $'+Number(d.quotedPriceUsd).toFixed(6));
   if(d.status==='fulfilled_free_compute')lines.push('Fulfilled with $0 upstream spend.');
   if(d.executionUrl)lines.push('Buyer-funded execution URL: '+d.executionUrl);
   if(d.executionBody)lines.push('Execution body: '+JSON.stringify(d.executionBody));
   if(d.fundingState)lines.push('Funding: '+d.fundingState);
   if(d.note)lines.push(String(d.note));
   if(d.result!=null)lines.push('Result: '+JSON.stringify(d.result,null,2).slice(0,4000));
   q('outcomeResult').textContent=lines.join('\n');
 }catch(e){q('outcomeResult').textContent='Router error: '+e.message}
 finally{q('routeOutcome').disabled=false}
};

q('createGuard').onclick=async()=>{
 const url=q('guardUrl').value.trim(),method=q('guardMethod').value,max=Number(q('guardMax').value),key=q('guardKey').value.trim();
 if(!url){q('guardResult').textContent='Enter the paid endpoint URL you want to protect.';return}
 if(!Number.isFinite(max)||max<=0){q('guardResult').textContent='Enter a maximum spend greater than zero.';return}
 if(key.length<8){q('guardResult').textContent='Use an idempotency key of at least 8 characters.';return}
 q('createGuard').disabled=true;q('guardResult').textContent='Creating retry-safe purchase intent…';
 try{
   const d=await post('/api/purchase-guard',{url,method,body:{},max_usd:max,expected_network:'eip155:8453',idempotency_key:key});
   q('guardResult').textContent=JSON.stringify(d.result||d,null,2).slice(0,5000);
 }catch(e){q('guardResult').textContent='Purchase Guard error: '+e.message}
 finally{q('createGuard').disabled=false}
};

q('findOffers').onclick=async()=>{const el=q('results');el.textContent='Searching…';try{const r=await fetch('/api/opportunities',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:localStorage.getItem(HANDLE_KEY)||crypto.randomUUID(),country:q('country').value,device:q('device').value,zeroSpendOnly:true})});const d=await r.json();if(!r.ok)throw new Error(d.message||'Inventory unavailable');el.innerHTML=(d.offers||[]).map(o=>'<div class="service"><b>'+esc(o.name)+'</b><div class="price">'+Number(o.reward||0).toFixed(2)+' reward units</div><p>'+esc(o.description)+'</p><a href="'+esc(safeUrl(o.link))+'" target="_blank" rel="noopener noreferrer">Open offer</a></div>').join('')||'No eligible offers returned.'}catch(e){el.innerHTML='<span class="error">'+esc(e.message)+'</span>'}};
refreshAccount();
</script></body></html>`;
}

const policyStyle = 'font-family:system-ui,-apple-system,sans-serif;max-width:850px;margin:50px auto;padding:20px;line-height:1.6;color:#17202a';
const privacy = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>INCOME 2 Privacy</title></head><body style="${policyStyle}"><h1>INCOME 2 Privacy</h1><p>Agent Earn uses a pseudonymous account handle and recovery key. The server stores a hash of the recovery key; keep the recovery key private.</p><p>Outcome Router requests may be sent to an external routing or fulfillment provider when external discovery is enabled. INCOME 2's demand intelligence is designed to retain abstract request state such as category, budget, route, status, timestamps, and result digest rather than raw task text or raw parameters. Do not submit passwords, API keys, private keys, seed phrases, recovery phrases, or other confidential credentials.</p><p>For buyer-funded x402 execution, the buyer wallet signs locally. INCOME 2 does not ask for the buyer's private key. Payment proof may be relayed to the selected upstream payment or fulfillment service as required for the transaction.</p><p>Purchase Guard stores the durable purchase-intent and receipt state required for idempotency and retry safety. It does not sign, send, settle, or custody payment. Do not place secrets in Purchase Guard inputs.</p><p>Human Earn providers may process device, targeting, interaction, and conversion information under their own policies when funded inventory becomes active.</p><p><a href="/">Back to INCOME 2</a></p></body></html>`;
const terms = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>INCOME 2 Terms</title></head><body style="${policyStyle}"><h1>INCOME 2 Terms</h1><p>INCOME 2 is a beta opportunity-routing and autonomous fulfillment platform. It does not guarantee income, task availability, successful fulfillment, or profit.</p><p>Agent Earn records only settled attributed activity. Human Earn availability and payment depend on the relevant provider's eligibility and rules. Cash-out for public beta balances is not production-enabled.</p><p>Outcome Router may use third-party agent tools, routers, or fulfillment services. The caller controls the maximum budget. Buyer-funded paid execution uses compatible x402 payment proofs; INCOME 2 does not request the buyer's private key. Upstream availability, pricing, settlement, refunds, disputes, and output quality can vary.</p><p>Purchase Guard is a free safety control for purchase intent, max spend, idempotency, and retry receipts. It does not execute payment and does not guarantee an upstream seller's behavior.</p><p>Do not use INCOME 2 for fraud, impersonation, fake human actions, duplicate identities, credential theft, prohibited content, rule evasion, or other unlawful or unauthorized activity.</p><p><a href="/">Back to INCOME 2</a></p></body></html>`;

const agentsTxt = `INCOME 2
Purpose: autonomous earning, buyer-side outcome routing, and x402 purchase safety.
Agent Earn: persistent canonical-ledger account for eligible machine-work settlements.
Human Earn: legitimate human-required inventory only after provider activation.
Outcome Router: POST ${SELLER}/outcome-router
Purchase Guard: POST ${SELLER}/purchase-guard
MCP: ${MCP}/mcp
Official MCP Registry: ${MCP_REGISTRY_NAME}
OpenAPI: ${SELLER}/openapi.json
Skill: ${SELLER}/skill.md
x402 manifest: ${SELLER}/.well-known/x402
Paid seller: Base mainnet / USDC; 13 paid resources.
Distribution: ${DISTRIBUTION.join(', ')}.
Moltbook: Income2 is a policy-compliant agent research identity; no broad scraping or harvesting.
Coinbase: Bazaar-compatible metadata is implemented; CDP activation/indexing must not be assumed until verified.
Rule: send desired result + maximum budget. Do not send secrets or private keys.
Revenue rule: listings, registrations, self-tests, requests, quotes, and buyer-to-supplier volume are not INCOME 2 revenue.
`;
const llmsTxt = `# INCOME 2

INCOME 2 is a two-sided earning and fulfillment network for people and AI agents.

## Earn
Agent Earn supports persistent machine-work accounts on the canonical ledger.
Human Earn exposes legitimate human-required inventory only after an approved provider is live.

## Outcome Router
POST ${SELLER}/outcome-router
Input: task, max_budget_usd, idempotency_key, optional params.
HYDRA attempts compatible zero-dollar fulfillment first and can return a buyer-signed non-custodial x402 paid route when supported and within budget.

## Purchase Guard
POST ${SELLER}/purchase-guard
Free retry-safe x402 purchase intent with hard max spend, stable idempotency, and a durable receipt.
Purchase Guard never signs, sends, settles, or custodies funds.

## Seller and discovery
Base mainnet / USDC x402 seller with 13 paid resources.
Distribution includes ${DISTRIBUTION.join(', ')}.
Coinbase Bazaar-compatible metadata is implemented, but CDP activation and indexing are separate verification gates.
Moltbook Income2 is a policy-compliant agent research identity, not an automated promotional or scraping bot.

## MCP
${MCP}/mcp
Registry name: ${MCP_REGISTRY_NAME}

## Machine documentation
${SELLER}/skill.md
${SELLER}/openapi.json
${SELLER}/.well-known/x402

## Revenue truth
Only independently verified third-party money earned by INCOME 2 is revenue.
`;
const robots = `User-agent: *
Allow: /
Sitemap: ${SELLER}/openapi.json
`;

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && u.pathname === '/') return html(res, 200, landing());
    if (req.method === 'GET' && u.pathname === '/privacy') return html(res, 200, privacy);
    if (req.method === 'GET' && u.pathname === '/terms') return html(res, 200, terms);
    if (req.method === 'GET' && u.pathname === '/agents.txt') return text(res, 200, agentsTxt);
    if (req.method === 'GET' && u.pathname === '/llms.txt') return text(res, 200, llmsTxt);
    if (req.method === 'GET' && u.pathname === '/robots.txt') return text(res, 200, robots);
    if (req.method === 'GET' && u.pathname === '/health') return json(res, 200, { ok: true, service: 'income2-router', version: VERSION });

    if (req.method === 'GET' && u.pathname === '/api/status') {
      const agent = await sellerState();
      return json(res, 200, {
        ok: true,
        version: VERSION,
        human: {
          providerConfigured: lootablyConfigured(),
          provider: lootablyConfigured() ? 'lootably' : null,
          status: lootablyConfigured() ? 'live' : 'provider_approval_pending',
        },
        agent,
        machine: {
          mcp: `${MCP}/mcp`,
          registryName: MCP_REGISTRY_NAME,
          outcomeRouter: `${SELLER}/outcome-router`,
          purchaseGuard: `${SELLER}/purchase-guard`,
          openapi: `${SELLER}/openapi.json`,
          skill: `${SELLER}/skill.md`,
          distribution: DISTRIBUTION,
          bazaarCompatible: Boolean(agent.discovery?.coinbaseBazaarExtension),
          cdpBazaarSettlementReady: Boolean(agent.discovery?.cdpBazaarSettlementReady),
        },
      });
    }

    if (req.method === 'POST' && u.pathname === '/api/agent/start') {
      const body = JSON.parse((await readBody(req, 20000)) || '{}');
      const result = await proxySeller('/account/start', body, req);
      return json(res, result.status, result.data);
    }
    if (req.method === 'POST' && u.pathname === '/api/agent/summary') {
      const body = JSON.parse((await readBody(req, 20000)) || '{}');
      const result = await proxySeller('/account/summary', body, req);
      return json(res, result.status, result.data);
    }
    if (req.method === 'POST' && u.pathname === '/api/outcome') {
      const body = JSON.parse((await readBody(req, 120000)) || '{}');
      const result = await proxySeller('/outcome-router', body, req, 60000);
      return json(res, result.status, normalizeOutcomeData(result.data));
    }
    if (req.method === 'GET' && u.pathname.startsWith('/api/outcome/')) {
      const id = u.pathname.slice('/api/outcome/'.length).trim();
      if (!/^outcome_[a-f0-9]{32}$/i.test(id)) return json(res, 400, { ok:false, message:'Invalid outcome request id' });
      const result = await proxySellerGet(`/outcome-router/${encodeURIComponent(id)}`);
      return json(res, result.status, normalizeOutcomeData(result.data));
    }
    if (req.method === 'POST' && u.pathname === '/api/purchase-guard') {
      const body = JSON.parse((await readBody(req, 120000)) || '{}');
      const result = await proxySeller('/purchase-guard', body, req, 45000);
      return json(res, result.status, result.data);
    }
    if (req.method === 'POST' && u.pathname === '/api/opportunities') {
      if (!lootablyConfigured()) return json(res, 503, { ok: false, code: 'PROVIDER_PENDING', message: 'Human Earn publisher inventory activation is pending.' });
      const body = JSON.parse((await readBody(req)) || '{}');
      const offers = await getLootablyOffers({
        userId: String(body.userId || crypto.randomUUID()).slice(0, 128),
        userAgent: String(req.headers['user-agent'] || `Income2Router/${VERSION}`),
        ipAddress: clientIp(req),
        country: body.country,
        device: body.device,
        zeroSpendOnly: body.zeroSpendOnly !== false,
      });
      return json(res, 200, { ok: true, provider: 'lootably', offers });
    }

    // Compatibility endpoint retained before publisher activation. It deliberately
    // does not credit the canonical ledger until Lootably's exact signed postback,
    // reversal, and idempotency semantics are verified.
    if (req.method === 'GET' && u.pathname === '/postback/lootably') {
      console.log(JSON.stringify({
        type: 'lootably_postback_unattributed',
        query: Object.fromEntries(u.searchParams.entries()),
        receivedAt: new Date().toISOString(),
      }));
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      return res.end('1');
    }

    return json(res, 404, { ok: false, message: 'Not found' });
  } catch (error) {
    console.error(error);
    return json(res, Number(error.statusCode || 500), { ok: false, message: String(error.message || 'Internal error').slice(0, 300) });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`INCOME 2 robust router ${VERSION} listening on ${PORT}; seller=${SELLER}; mcp=${MCP}`));
