const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const LOOTABLY_API_URL = 'https://api.lootably.com/api/v2/offers/get';
const AGENT_SELLER_ORIGIN = String(process.env.AGENT_SELLER_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');

function json(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}
function html(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2000000) reject(new Error('Body too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
function lootablyConfigured() {
  return Boolean(process.env.LOOTABLY_API_KEY && process.env.LOOTABLY_PLACEMENT_ID);
}
async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Income2-Router/1.0' }, signal: controller.signal });
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}
async function getAgentState() {
  try {
    const [health, manifest] = await Promise.all([
      fetchJson(`${AGENT_SELLER_ORIGIN}/health`),
      fetchJson(`${AGENT_SELLER_ORIGIN}/.well-known/x402`)
    ]);
    const resources = Array.isArray(manifest?.resources) ? manifest.resources : [];
    return {
      live: Boolean(health?.ok && health?.x402),
      sellerOrigin: AGENT_SELLER_ORIGIN,
      network: health?.network || manifest?.rails?.[0]?.network || 'eip155:8453',
      asset: manifest?.rails?.[0]?.asset || 'USDC',
      facilitator: health?.facilitator || 'payai',
      firstSaleMode: Boolean(health?.firstSaleMode),
      ledger: health?.ledger || null,
      resources: resources.map(r => ({
        name: r.name,
        category: r.category,
        resource: r.resource,
        url: r.url,
        price: r.price,
        description: r.description,
        tags: r.tags || []
      }))
    };
  } catch (error) {
    return { live: false, sellerOrigin: AGENT_SELLER_ORIGIN, error: String(error?.message || error).slice(0, 300), resources: [] };
  }
}

function userReward(offer) {
  if (offer.type === 'multistep' && Array.isArray(offer.goals)) {
    return offer.goals.filter(g => !g.isOptional).reduce((sum, g) => sum + Number(g.currencyReward || 0), 0);
  }
  return Number(offer.currencyReward || 0);
}
function publisherRevenue(offer) {
  if (offer.type === 'multistep' && Array.isArray(offer.goals)) {
    return offer.goals.filter(g => !g.isOptional).reduce((sum, g) => sum + Number(g.revenue || 0), 0);
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
        categories: o.categories || [],
        devices: o.devices || [],
        paymentModel: o.paymentModel,
        reward,
        publisherRevenue: revenue,
        platformMargin: Number(Math.max(0, revenue - reward).toFixed(4)),
        epc,
        conversionRate,
        minutesUntilExpiration: o.minutesUntilExpiration || null,
        link: o.link,
        score: Number(score.toFixed(4))
      };
    })
    .sort((a, b) => b.score - a.score || b.reward - a.reward)
    .slice(0, 25);
}
async function getLootablyOffers({ userId, userAgent, ipAddress, country, device, zeroSpendOnly }) {
  const payload = {
    apiKey: process.env.LOOTABLY_API_KEY,
    placementID: process.env.LOOTABLY_PLACEMENT_ID,
    userData: { userID: userId, userAgentHeader: userAgent, ipAddress }
  };
  if (country) payload.countries = [String(country).toUpperCase()];
  if (device) payload.devices = [device];
  const response = await fetch(LOOTABLY_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || `Lootably error ${response.status}`);
  return rankOffers(data.data?.offers || [], zeroSpendOnly);
}

function landing() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>INCOME 2</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#090b0f;color:#f4f6f8;margin:0}.wrap{max-width:980px;margin:0 auto;padding:42px 20px 70px}.brand{font-size:14px;letter-spacing:.18em;font-weight:850;color:#b7c8ff}.hero{padding:26px 0 8px}h1{font-size:clamp(42px,8vw,72px);line-height:.98;margin:8px 0 16px;letter-spacing:-.045em}.tag{font-size:clamp(20px,4vw,28px);font-weight:700;margin:0 0 10px}.muted{color:#aab2c0}.card,.mode{background:#141821;border:1px solid #29303c;border-radius:18px}.card{padding:24px;margin:18px 0}.mode{padding:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.pill{display:inline-block;background:#202838;border-radius:999px;padding:7px 11px;margin:4px 6px 4px 0;font-size:13px}.good{color:#7ee787}.warn{color:#ffd166}.bad{color:#ff7b72}.money{font-size:25px;font-weight:850}.small{font-size:13px}.status{font-weight:800}.service{border-top:1px solid #29303c;padding:14px 0}.service:first-child{border-top:0}button,.button{display:inline-block;background:#fff;color:#111;text-decoration:none;border:0;border-radius:11px;padding:12px 16px;font-weight:800;cursor:pointer}button[disabled]{opacity:.45;cursor:not-allowed}input,select{width:100%;background:#0e1117;color:#fff;border:1px solid #303744;border-radius:9px;padding:11px;margin-top:5px}a{color:#b7c8ff}.metric{font-size:30px;font-weight:900;margin-top:4px}
</style></head><body><div class="wrap">
<div class="hero"><div class="brand">INCOME 2</div><h1>Your second income.</h1><p class="tag">Powered by you or your AI.</p><p class="muted">Two earning lanes. Human Earn connects you to legitimate paid opportunities when publisher inventory is available. Agent Earn sells machine-paid services to outside AI agents over x402. No guaranteed income; only real conversions and settled payments count.</p></div>
<div class="grid">
  <div class="mode"><div class="pill">HUMAN EARN</div><h2>You do the work</h2><p>Complete eligible advertiser-funded offers yourself. We never automate surveys, installs, identity checks, or other human-required actions.</p><p id="humanStatus" class="status warn">Checking inventory…</p></div>
  <div class="mode"><div class="pill">AGENT EARN</div><h2>Your AI does eligible work</h2><p>INCOME 2 exposes deterministic services that outside agents can discover, pay for in USDC, and call automatically.</p><p id="agentStatus" class="status warn">Checking x402 seller…</p><div id="agentMeta" class="muted small"></div></div>
</div>
<div class="card"><h2>Agent Earn — live catalog</h2><p id="agentExplanation" class="muted">Loading the live paid-service catalog…</p><div id="services"></div><p><a class="button" href="${AGENT_SELLER_ORIGIN}/.well-known/x402" target="_blank" rel="noopener">Open machine-readable catalog</a></p><p class="muted small">Outside agents pay the x402 challenge directly. Revenue is counted only after a real third-party settlement. Opening the paid endpoint yourself is not revenue.</p></div>
<div class="card"><h2>Human Earn inventory</h2><p id="humanExplanation" class="muted">Checking publisher inventory…</p><div class="grid"><div><label>Country</label><input id="country" value="US" maxlength="2"></div><div><label>Device</label><select id="device"><option value="windows">Windows</option><option value="android">Android</option><option value="iphone">iPhone</option><option value="macos">macOS</option></select></div></div><p><button id="go">Find paid opportunities</button></p><div id="results"></div></div>
<div class="card"><h2>Revenue truth</h2><div class="grid"><div><div class="muted small">Agent settlements</div><div id="settlements" class="metric">—</div></div><div><div class="muted small">Verified gross</div><div id="gross" class="metric">—</div></div></div><p class="muted small">A listing, page view, test call, projection, or provider application is not income. Only attributable paid conversions or settlements count.</p><p class="muted small"><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p></div>
</div><script>
const uid=localStorage.income2UserId||(localStorage.income2UserId=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
fetch('/api/status').then(r=>r.json()).then(s=>{
  humanStatus.innerHTML=s.human.providerConfigured?'<span class="good">LIVE — funded inventory connected</span>':'<span class="warn">COMING ONLINE — publisher approval pending</span>';
  humanExplanation.textContent=s.human.providerConfigured?'Live paid opportunities are available below.':'Human Earn is not open yet. Publisher applications are under review; this lane will switch on only when real funded inventory is connected.';
  go.disabled=!s.human.providerConfigured;
  if(!s.human.providerConfigured) results.innerHTML='<p class="warn">No human earning inventory is being advertised until a provider approves and funds it.</p>';
  const a=s.agent;
  agentStatus.innerHTML=a.live?'<span class="good">LIVE BETA — x402 earning rail connected</span>':'<span class="bad">TEMPORARILY UNAVAILABLE — seller health check failed</span>';
  agentMeta.textContent=a.live?(a.resources.length+' paid services · '+a.network+' · '+a.asset):(a.error||'Agent seller unavailable');
  agentExplanation.textContent=a.live?'These are live machine-paid services. An outside agent can discover one, receive a 402 payment request, pay, and receive the result automatically.':'The Agent Earn seller is not healthy right now.';
  services.innerHTML=(a.resources||[]).map(x=>'<div class="service"><b>'+esc(x.name)+'</b> <span class="pill">'+esc(x.price||'paid')+'</span><div class="muted small">'+esc(x.resource)+'</div><p>'+esc(x.description)+'</p></div>').join('')||'<p class="warn">No live services returned.</p>';
  const ledger=a.ledger||{}; settlements.textContent=Number.isFinite(Number(ledger.settlements))?Number(ledger.settlements).toLocaleString():'0'; gross.textContent='$'+Number(ledger.grossUsd||0).toFixed(3);
}).catch(()=>{agentStatus.innerHTML='<span class="bad">Status check failed</span>';});
document.getElementById('go').onclick=async()=>{const el=document.getElementById('results');el.textContent='Searching…';const r=await fetch('/api/opportunities',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:uid,country:country.value,device:device.value,zeroSpendOnly:true})});const d=await r.json();if(!r.ok){el.innerHTML='<p class="warn">'+esc(d.message||'Inventory is not connected yet.')+'</p>';return;}el.innerHTML=(d.offers||[]).map(o=>'<div class="mode"><div class="money">'+Number(o.reward||0).toFixed(2)+' reward units</div><b>'+esc(o.name)+'</b><p>'+esc(o.description)+'</p><a href="'+esc(o.link)+'" target="_blank" rel="noopener"><button>Open offer</button></a></div>').join('')||'<p>No eligible offers returned.</p>';};
</script></body></html>`;
}

const privacy = `<!doctype html><html><body style="font-family:system-ui;max-width:800px;margin:50px auto;padding:20px"><h1>INCOME 2 Privacy</h1><p>INCOME 2 processes pseudonymous identifiers, device/browser information, targeting information, offer interactions, conversion records, and agent-settlement status needed to route opportunities and attribute earnings. Provider credentials stay server-side.</p><p>Third-party earning providers, marketplaces, advertisers, wallets, and payment protocols may process data under their own policies when you use those services.</p><p>Do not send passwords, private keys, seed phrases, or confidential credentials into public job briefs.</p></body></html>`;
const terms = `<!doctype html><html><body style="font-family:system-ui;max-width:800px;margin:50px auto;padding:20px"><h1>INCOME 2 Terms</h1><p>INCOME 2 is an opportunity-routing and automation service, not an employment offer or income guarantee. Eligibility, availability, completion, payment, reversals, and marketplace requirements vary.</p><p>Fraud, duplicate identities, fabricated survey answers, fake installs, unauthorized automation, manipulation of tracking, credential theft, or violating third-party terms is prohibited.</p><p>Agent Earn may autonomously perform machine-appropriate work only where the marketplace and task permit automated providers. Only settled third-party payments count as verified Agent Earn revenue.</p></body></html>`;

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && u.pathname === '/') return html(res, 200, landing());
    if (req.method === 'GET' && u.pathname === '/privacy') return html(res, 200, privacy);
    if (req.method === 'GET' && u.pathname === '/terms') return html(res, 200, terms);
    if (req.method === 'GET' && u.pathname === '/health') return json(res, 200, { ok: true, service: 'income2-router', version: '1.0.0', agentSellerOrigin: AGENT_SELLER_ORIGIN });
    if (req.method === 'GET' && u.pathname === '/api/status') {
      const agent = await getAgentState();
      return json(res, 200, {
        ok: true,
        brand: 'INCOME 2',
        human: { providerConfigured: lootablyConfigured(), provider: lootablyConfigured() ? 'lootably' : null, status: lootablyConfigured() ? 'live' : 'publisher-approval-pending' },
        agent
      });
    }
    if (req.method === 'GET' && u.pathname === '/api/agent/network') {
      const agent = await getAgentState();
      return json(res, agent.live ? 200 : 503, { ok: agent.live, network: agent });
    }
    if (req.method === 'GET' && u.pathname === '/api/agent/earnings') {
      const agent = await getAgentState();
      return json(res, agent.live ? 200 : 503, { ok: agent.live, source: 'x402-ledger', ledger: agent.ledger || null, note: 'Only settled ledger-backed Agent Earn revenue is reported.' });
    }
    if (req.method === 'POST' && u.pathname === '/api/opportunities') {
      if (!lootablyConfigured()) return json(res, 503, { ok: false, code: 'PROVIDER_PENDING', message: 'Human Earn publisher inventory activation is pending.' });
      const body = JSON.parse((await readBody(req)) || '{}');
      const userId = String(body.userId || crypto.randomUUID()).slice(0, 128);
      const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      const ipAddress = forwarded || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = String(req.headers['user-agent'] || 'Income2-Router/1.0');
      const offers = await getLootablyOffers({ userId, userAgent, ipAddress, country: body.country, device: body.device, zeroSpendOnly: body.zeroSpendOnly !== false });
      return json(res, 200, { ok: true, provider: 'lootably', offers });
    }
    if (req.method === 'GET' && u.pathname === '/postback/lootably') {
      console.log(JSON.stringify({ type: 'lootably_postback', query: Object.fromEntries(u.searchParams.entries()), receivedAt: new Date().toISOString() }));
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end('1');
    }
    return json(res, 404, { ok: false, message: 'Not found' });
  } catch (err) {
    console.error(err);
    return json(res, 500, { ok: false, message: String(err?.message || 'Internal error').slice(0, 300) });
  }
});
server.listen(PORT, '0.0.0.0', () => console.log(`INCOME 2 Router listening on ${PORT}; agentSeller=${AGENT_SELLER_ORIGIN}`));
