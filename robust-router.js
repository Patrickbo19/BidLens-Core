const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const SELLER = String(process.env.EARN_SELLER_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');
const LOOTABLY_API_URL = 'https://api.lootably.com/api/v2/offers/get';

function json(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  });
  res.end(JSON.stringify(data));
}
function html(res, status, body) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
  });
  res.end(body);
}
function readBody(req, max = 100000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > max) reject(new Error('Body too large'));
    });
    req.on('end', () => resolve(body));
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
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 600) }; }
    return { ok: r.ok, status: r.status, data };
  } finally {
    clearTimeout(timer);
  }
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
      resources: [],
      message: error?.name === 'AbortError' ? 'Agent Earn is still waking up.' : 'Agent Earn status is being retried.',
    };
  }

  let manifest = { ok: false, data: {} };
  if (health.ok) {
    try { manifest = await fetchJson(`${SELLER}/.well-known/x402`, {}, 12000); } catch {}
  }
  return {
    live: Boolean(health.ok && health.data?.x402),
    waking: false,
    network: health.data?.network || 'eip155:8453',
    asset: 'USDC',
    resourceCount: Number(health.data?.resourceCount || manifest.data?.resources?.length || 0),
    resources: Array.isArray(manifest.data?.resources) ? manifest.data.resources : [],
    ledger: health.data?.ledger || null,
  };
}

async function proxyAccount(path, body, req) {
  const options = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': clientIp(req),
      'x-income2-client': 'router',
    },
    body: JSON.stringify(body || {}),
  };
  let firstError;
  try {
    return await fetchJson(`${SELLER}${path}`, options, 50000);
  } catch (error) {
    firstError = error;
  }
  await new Promise(resolve => setTimeout(resolve, 1500));
  try {
    return await fetchJson(`${SELLER}${path}`, options, 30000);
  } catch (error) {
    const e = error?.name === 'AbortError' || firstError?.name === 'AbortError'
      ? new Error('Agent Earn is still waking up. Wait a few seconds and tap Start again.')
      : new Error('Agent Earn could not be reached. Please try again.');
    e.statusCode = 503;
    throw e;
  }
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
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>INCOME 2</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#0b0d10;color:#f4f6f8;margin:0}.wrap{max-width:920px;margin:0 auto;padding:34px 20px 70px}.brand{font-size:14px;letter-spacing:.16em;font-weight:900;color:#8da7ff}.hero{font-size:clamp(40px,8vw,70px);line-height:.95;margin:14px 0}.sub{font-size:19px;color:#aab2c0;max-width:720px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:26px 0}.card,.mode{background:#151922;border:1px solid #29303d;border-radius:18px;padding:22px}.mode{background:#11151c}.good{color:#7ee787}.warn{color:#ffd166}.muted{color:#aab2c0}.small{font-size:13px}.error{color:#ff8f8f}.balance{font-size:44px;font-weight:900;letter-spacing:-.04em;margin:4px 0}.pill{display:inline-flex;align-items:center;gap:7px;border:1px solid #33405a;background:#182033;border-radius:999px;padding:7px 11px;font-size:13px;font-weight:800}.dot{width:8px;height:8px;background:#7ee787;border-radius:50%}button{appearance:none;border:0;border-radius:12px;padding:13px 17px;font-weight:850;font-size:15px;cursor:pointer;background:#fff;color:#0b0d10;margin:4px 7px 4px 0}button.secondary{background:#242b38;color:#f4f6f8;border:1px solid #343d4d}button:disabled{opacity:.55;cursor:not-allowed}.hidden{display:none}.service{padding:13px 0;border-bottom:1px solid #252c38}.service:last-child{border-bottom:0}.price{font-weight:850;color:#7ee787}.notice{border-left:3px solid #8da7ff;padding:10px 13px;background:#101622;border-radius:8px}a{color:#b7c8ff}input,select{background:#0e1117;color:#fff;border:1px solid #303744;border-radius:9px;padding:10px;width:100%;margin-top:5px}
</style></head><body><div class="wrap">
<div class="brand">INCOME 2</div><h1 class="hero">Your second income.<br>Powered by you or your AI.</h1><p class="sub">Start Agent Earn once. Your account remains active after you close the page and can receive attributed shares of real settled AI-agent service payments.</p>
<div class="grid"><div class="mode"><div class="pill"><span class="dot"></span> AGENT EARN</div><h2>Let your AI earn</h2><p id="agentStatus" class="muted">Waking Agent Earn…</p><button id="startAgent">Start Agent Earn</button><button id="refreshAgent" class="secondary hidden">Refresh earnings</button><div id="agentAccount" class="hidden"><div class="muted small">Actual settled account balance</div><div id="balance" class="balance">$0.000000</div><div id="settlements" class="muted">0 settlements</div><div id="accountHandle" class="muted small"></div><p><button id="copyRecovery" class="secondary">Copy recovery key</button></p></div><p id="agentMessage" class="muted small">If the free service is asleep, the first start can take 20–40 seconds while it wakes. Do not close the page during activation.</p></div>
<div class="mode"><div class="pill">HUMAN EARN</div><h2>Earn yourself</h2><p>Human-paid opportunities will appear here after a publisher approves INCOME 2.</p><p id="humanStatus" class="warn">Checking publisher…</p></div></div>
<div class="card"><h2>Agent Earn marketplace</h2><p id="marketStatus" class="muted">Waking the paid-service catalog…</p><div id="services"></div></div>
<div class="card"><h2>Human Earn inventory</h2><div class="grid"><label>Country<input id="country" value="US" maxlength="2"></label><label>Device<select id="device"><option value="windows">Windows</option><option value="android">Android</option><option value="iphone">iPhone</option><option value="macos">Mac</option></select></label></div><p><button id="findOffers" disabled>Find paid opportunities</button></p><div id="results" class="muted">Publisher approval is still pending.</div></div>
<div class="notice"><b>Money rule:</b> only settled third-party payments count as earnings. Starting Agent Earn itself does not create revenue.</div><p class="muted small"><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
</div><script>
const HANDLE_KEY='income2AccountHandle',TOKEN_KEY='income2AccountToken',q=id=>document.getElementById(id);
function money(n){return '$'+Number(n||0).toFixed(6)}
function creds(){return{accountHandle:localStorage.getItem(HANDLE_KEY)||'',accountToken:localStorage.getItem(TOKEN_KEY)||''}}
async function post(path,body){const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.message||'Request failed');return d}
function showAccount(summary,handle){q('agentAccount').classList.remove('hidden');q('refreshAgent').classList.remove('hidden');q('startAgent').textContent='Agent Earn Active';q('startAgent').disabled=true;q('balance').textContent=money(summary?.availableBalanceUsd);const c=Number(summary?.settlementCount||0);q('settlements').textContent=c+' settled payment'+(c===1?'':'s')+' attributed';q('accountHandle').textContent='Account: '+handle;q('agentStatus').innerHTML='<span class="good">LIVE · ACCOUNT ACTIVE</span>';q('agentMessage').textContent='Your account stays active after you close this page. Earnings are not guaranteed.'}
async function refreshAccount(){const c=creds();if(!c.accountHandle||!c.accountToken)return;try{const d=await post('/api/agent/summary',c);showAccount(d.summary,c.accountHandle)}catch(e){q('agentMessage').textContent='Could not refresh yet: '+e.message}}
q('startAgent').onclick=async()=>{q('startAgent').disabled=true;q('startAgent').textContent='Waking & activating…';q('agentMessage').textContent='Please keep this page open. A sleeping free-tier service can take 20–40 seconds to wake.';try{const c=creds();const d=await post('/api/agent/start',c.accountHandle&&c.accountToken?c:{});if(d.accountHandle)localStorage.setItem(HANDLE_KEY,d.accountHandle);if(d.accountToken)localStorage.setItem(TOKEN_KEY,d.accountToken);showAccount(d.summary||{},d.accountHandle)}catch(e){q('startAgent').disabled=false;q('startAgent').textContent='Try Start Agent Earn again';q('agentMessage').innerHTML='<span class="error">'+e.message+'</span>'}}
q('refreshAgent').onclick=refreshAccount;
q('copyRecovery').onclick=async()=>{const t=localStorage.getItem(TOKEN_KEY)||'';if(!t)return;try{await navigator.clipboard.writeText(t);q('copyRecovery').textContent='Copied';setTimeout(()=>q('copyRecovery').textContent='Copy recovery key',1500)}catch{q('agentMessage').textContent='Browser blocked clipboard access. Keep this device/browser data safe.'}};
fetch('/api/status').then(r=>r.json()).then(s=>{if(s.agent?.live){q('agentStatus').innerHTML='<span class="good">LIVE BETA · Base / USDC</span>';q('marketStatus').textContent=s.agent.resourceCount+' paid agent services are live at $0.001 per call.'}else if(s.agent?.waking){q('agentStatus').innerHTML='<span class="warn">WAKING UP · Start is still available</span>';q('marketStatus').textContent='The free seller is waking. You can still press Start Agent Earn.'}else{q('agentStatus').innerHTML='<span class="warn">Status delayed · Start is still available</span>'}const human=Boolean(s.human?.providerConfigured);q('humanStatus').innerHTML=human?'<span class="good">FUNDED INVENTORY LIVE</span>':'<span class="warn">Publisher approval pending</span>';q('findOffers').disabled=!human;const list=s.agent?.resources||[];q('services').innerHTML=list.map(x=>'<div class="service"><b>'+x.name+'</b> <span class="price">'+x.price+'</span><div class="muted small">'+x.description+'</div></div>').join('')}).catch(()=>{q('agentStatus').innerHTML='<span class="warn">Status check delayed · Start is still available</span>'});
q('findOffers').onclick=async()=>{const el=q('results');el.textContent='Searching…';try{const r=await fetch('/api/opportunities',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:localStorage.getItem(HANDLE_KEY)||crypto.randomUUID(),country:q('country').value,device:q('device').value,zeroSpendOnly:true})});const d=await r.json();if(!r.ok)throw new Error(d.message||'Inventory unavailable');el.innerHTML=(d.offers||[]).map(o=>'<div class="service"><b>'+o.name+'</b><div class="price">'+Number(o.reward||0).toFixed(2)+' reward units</div><p>'+o.description+'</p><a href="'+o.link+'" target="_blank" rel="noopener">Open offer</a></div>').join('')||'No eligible offers returned.'}catch(e){el.innerHTML='<span class="error">'+e.message+'</span>'}};
refreshAccount();
</script></body></html>`;
}

const privacy = '<!doctype html><html><body style="font-family:system-ui;max-width:800px;margin:50px auto;padding:20px"><h1>INCOME 2 Privacy</h1><p>Agent Earn uses a pseudonymous account handle and recovery key. The server stores a hash of the recovery key. Keep the recovery key private.</p></body></html>';
const terms = '<!doctype html><html><body style="font-family:system-ui;max-width:800px;margin:50px auto;padding:20px"><h1>INCOME 2 Terms</h1><p>INCOME 2 does not guarantee income. Agent Earn records only settled attributed activity. Cash-out is not enabled in this beta.</p></body></html>';

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && u.pathname === '/') return html(res, 200, landing());
    if (req.method === 'GET' && u.pathname === '/privacy') return html(res, 200, privacy);
    if (req.method === 'GET' && u.pathname === '/terms') return html(res, 200, terms);
    if (req.method === 'GET' && u.pathname === '/health') return json(res, 200, { ok: true, service: 'income2-router', version: '0.5.0' });
    if (req.method === 'GET' && u.pathname === '/api/status') {
      const agent = await sellerState();
      return json(res, 200, {
        ok: true,
        human: { providerConfigured: lootablyConfigured(), provider: lootablyConfigured() ? 'lootably' : null, status: lootablyConfigured() ? 'live' : 'provider_approval_pending' },
        agent,
      });
    }
    if (req.method === 'POST' && u.pathname === '/api/agent/start') {
      const body = JSON.parse((await readBody(req, 20000)) || '{}');
      const result = await proxyAccount('/account/start', body, req);
      return json(res, result.status, result.data);
    }
    if (req.method === 'POST' && u.pathname === '/api/agent/summary') {
      const body = JSON.parse((await readBody(req, 20000)) || '{}');
      const result = await proxyAccount('/account/summary', body, req);
      return json(res, result.status, result.data);
    }
    if (req.method === 'POST' && u.pathname === '/api/opportunities') {
      if (!lootablyConfigured()) return json(res, 503, { ok: false, code: 'PROVIDER_PENDING', message: 'Human Earn publisher inventory activation is pending.' });
      const body = JSON.parse((await readBody(req)) || '{}');
      const offers = await getLootablyOffers({ userId: String(body.userId || crypto.randomUUID()).slice(0, 128), userAgent: String(req.headers['user-agent'] || 'Income2Router/0.5'), ipAddress: clientIp(req), country: body.country, device: body.device, zeroSpendOnly: body.zeroSpendOnly !== false });
      return json(res, 200, { ok: true, provider: 'lootably', offers });
    }
    return json(res, 404, { ok: false, message: 'Not found' });
  } catch (error) {
    console.error(error);
    return json(res, Number(error.statusCode || 500), { ok: false, message: String(error.message || 'Internal error').slice(0, 300) });
  }
});
server.listen(PORT, '0.0.0.0', () => console.log(`INCOME 2 robust router listening on ${PORT}; seller=${SELLER}`));
