const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const LOOTABLY_API_URL = 'https://api.lootably.com/api/v2/offers/get';

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
    req.on('data', c => { body += c; if (body.length > 100000) reject(new Error('Body too large')); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function providerConfigured() {
  return Boolean(process.env.LOOTABLY_API_KEY && process.env.LOOTABLY_PLACEMENT_ID);
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
  return typeof offer.revenue === 'number' ? offer.revenue : 0;
}

function rankOffers(offers, zeroSpendOnly = true) {
  const blocked = new Set(['creditcard', 'deposit', 'freetrial', 'shopping']);
  return offers
    .filter(o => !zeroSpendOnly || !(o.categories || []).some(c => blocked.has(c)))
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
  if (country) payload.countries = [country.toUpperCase()];
  if (device) payload.devices = [device];

  const r = await fetch(LOOTABLY_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!r.ok || !data.success) throw new Error(data.message || `Lootably error ${r.status}`);
  return rankOffers(data.data?.offers || [], zeroSpendOnly);
}

function landing() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Earn Router</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#0b0d10;color:#f4f6f8;margin:0}.wrap{max-width:860px;margin:0 auto;padding:48px 22px}.card{background:#151922;border:1px solid #262c38;border-radius:18px;padding:24px;margin:18px 0}h1{font-size:48px;margin:0 0 8px}h2{margin-top:0}.muted{color:#aab2c0}.pill{display:inline-block;background:#202838;border-radius:999px;padding:8px 12px;margin:4px 6px 4px 0}.good{color:#7ee787}.warn{color:#ffd166}button{background:#fff;color:#111;border:0;border-radius:10px;padding:12px 16px;font-weight:700;cursor:pointer}input,select{background:#0e1117;color:#fff;border:1px solid #303744;border-radius:9px;padding:10px;margin:4px}.offer{padding:14px 0;border-top:1px solid #262c38}.money{font-size:22px;font-weight:800}.small{font-size:13px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}</style></head>
<body><div class="wrap"><div class="pill">Earn Router v0.1</div><h1>Find the best funded earning opportunity available to you.</h1><p class="muted">Earn Router is being built as a live routing layer for verified publisher demand. It ranks real paid opportunities instead of giving generic side-hustle ideas.</p>
<div class="card"><h2>Live inventory status</h2><p id="status">Checking…</p><div class="grid"><div><label>Country</label><br><input id="country" value="US" maxlength="2"></div><div><label>Device</label><br><select id="device"><option value="windows">Windows</option><option value="android">Android</option><option value="iphone">iPhone</option><option value="macos">macOS</option></select></div></div><p><button id="go">Find earning opportunities</button></p><div id="results"></div></div>
<div class="card"><h2>How it works</h2><span class="pill">1. Funded demand</span><span class="pill">2. Eligibility + ranking</span><span class="pill">3. User completes verified action</span><span class="pill">4. Conversion postback</span><span class="pill">5. Revenue split</span><p class="muted small">No income is guaranteed. Users must satisfy each advertiser's eligibility and terms. Earn Router does not fabricate survey responses, fake installs, create false identities, or automate advertiser actions unless a provider explicitly permits automation.</p></div>
<div class="card"><h2>Publisher model</h2><p>Advertiser-funded conversions generate publisher revenue. A configured portion is credited to the user and the remainder funds the routing platform. Conversion accounting is server-side.</p><p class="muted small"><a href="/privacy" style="color:#b7c8ff">Privacy</a> · <a href="/terms" style="color:#b7c8ff">Terms</a></p></div>
</div><script>
const uid=localStorage.earnUserId||(localStorage.earnUserId=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)));
fetch('/api/status').then(r=>r.json()).then(s=>{document.getElementById('status').innerHTML=s.providerConfigured?'<span class="good">Funded inventory connected</span>':'<span class="warn">Publisher inventory activation pending</span>';});
document.getElementById('go').onclick=async()=>{const el=document.getElementById('results');el.textContent='Searching…';const r=await fetch('/api/opportunities',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:uid,country:country.value,device:device.value,zeroSpendOnly:true})});const d=await r.json();if(!r.ok){el.innerHTML='<p class="warn">'+(d.message||'Inventory is not connected yet.')+'</p>';return;}el.innerHTML=(d.offers||[]).map(o=>'<div class="offer"><div class="money">'+o.reward.toFixed(2)+' reward units</div><b>'+o.name+'</b><div class="muted small">EPC $'+o.epc.toFixed(2)+' · '+o.paymentModel+' · '+o.conversionRate.toFixed(1)+'% network conversion</div><p>'+o.description+'</p><a href="'+o.link+'" target="_blank" rel="noopener"><button>Open offer</button></a></div>').join('')||'<p>No eligible offers returned.</p>';};
</script></body></html>`;
}

const privacy = `<!doctype html><html><body style="font-family:system-ui;max-width:800px;margin:50px auto;padding:20px"><h1>Earn Router Privacy</h1><p>Earn Router processes a pseudonymous user ID, device/browser information, IP-derived targeting information, offer interactions, and conversion records needed to retrieve eligible opportunities and attribute rewards. Provider API credentials stay server-side. We do not sell passwords or authentication secrets.</p><p>Third-party earning providers and advertisers may process data under their own policies when a user opens an offer.</p><p>Contact and deletion-request channels will be finalized before public launch.</p></body></html>`;
const terms = `<!doctype html><html><body style="font-family:system-ui;max-width:800px;margin:50px auto;padding:20px"><h1>Earn Router Terms</h1><p>Earn Router is an opportunity-routing service, not an employment offer or income guarantee. Eligibility, completion, payment, reversals, and advertiser requirements vary by opportunity. Users must provide truthful information and follow provider and advertiser terms.</p><p>Fraud, duplicate identities, bots, fabricated survey answers, fake installs, unauthorized automation, and manipulation of tracking or conversions are prohibited.</p><p>Reward and revenue-share terms will be displayed before public launch and may vary by provider.</p></body></html>`;

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && u.pathname === '/') return html(res, 200, landing());
    if (req.method === 'GET' && u.pathname === '/privacy') return html(res, 200, privacy);
    if (req.method === 'GET' && u.pathname === '/terms') return html(res, 200, terms);
    if (req.method === 'GET' && u.pathname === '/health') return json(res, 200, { ok: true, service: 'earn-router', version: '0.1.0' });
    if (req.method === 'GET' && u.pathname === '/api/status') return json(res, 200, { ok: true, providerConfigured: providerConfigured(), provider: providerConfigured() ? 'lootably' : null });
    if (req.method === 'POST' && u.pathname === '/api/opportunities') {
      if (!providerConfigured()) return json(res, 503, { ok: false, code: 'PROVIDER_PENDING', message: 'Publisher inventory activation is pending.' });
      const body = JSON.parse((await readBody(req)) || '{}');
      const userId = String(body.userId || crypto.randomUUID()).slice(0, 128);
      const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      const ipAddress = forwarded || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = String(req.headers['user-agent'] || 'EarnRouter/0.1');
      const offers = await getLootablyOffers({ userId, userAgent, ipAddress, country: body.country, device: body.device, zeroSpendOnly: body.zeroSpendOnly !== false });
      return json(res, 200, { ok: true, provider: 'lootably', offers });
    }
    if (req.method === 'GET' && u.pathname === '/postback/lootably') {
      const expected = process.env.LOOTABLY_POSTBACK_SECRET;
      const hash = u.searchParams.get('hash');
      if (expected && hash) {
        // Lootably hash verification will be enabled against the exact dashboard secret/recipe during provider onboarding.
      }
      console.log(JSON.stringify({ type: 'lootably_postback', query: Object.fromEntries(u.searchParams.entries()), receivedAt: new Date().toISOString() }));
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end('1');
    }
    return json(res, 404, { ok: false, message: 'Not found' });
  } catch (err) {
    console.error(err);
    return json(res, 500, { ok: false, message: 'Internal error' });
  }
});
server.listen(PORT, '0.0.0.0', () => console.log(`Earn Router listening on ${PORT}`));
