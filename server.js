const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const LOOTABLY_API_URL = 'https://api.lootably.com/api/v2/offers/get';
const AGENT_SELLER_ORIGIN = String(process.env.EARN_SELLER_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');

function json(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}
function html(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer' });
  res.end(body);
}
function readBody(req, max = 100000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > max) reject(new Error('Body too large')); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
function lootablyConfigured() { return Boolean(process.env.LOOTABLY_API_KEY && process.env.LOOTABLY_PLACEMENT_ID); }
function forwardedIp(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim().slice(0,80); }

async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: ctl.signal });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text.slice(0,500) }; }
    return { ok: r.ok, status: r.status, data };
  } finally { clearTimeout(timer); }
}
async function sellerState() {
  const [health, manifest] = await Promise.allSettled([
    fetchJson(`${AGENT_SELLER_ORIGIN}/health`),
    fetchJson(`${AGENT_SELLER_ORIGIN}/.well-known/x402`),
  ]);
  const h = health.status === 'fulfilled' ? health.value : { ok:false, data:{} };
  const m = manifest.status === 'fulfilled' ? manifest.value : { ok:false, data:{} };
  return {
    live: Boolean(h.ok && h.data?.x402),
    network: h.data?.network || 'eip155:8453',
    asset: 'USDC',
    resourceCount: Number(h.data?.resourceCount || m.data?.resources?.length || 0),
    resources: Array.isArray(m.data?.resources) ? m.data.resources : [],
    ledger: h.data?.ledger || null,
  };
}
async function proxyAccount(path, body, req) {
  return fetchJson(`${AGENT_SELLER_ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': forwardedIp(req), 'x-income2-client': 'router' },
    body: JSON.stringify(body || {}),
  });
}

function userReward(offer) {
  if (offer.type === 'multistep' && Array.isArray(offer.goals)) return offer.goals.filter(g => !g.isOptional).reduce((n,g) => n + Number(g.currencyReward || 0), 0);
  return Number(offer.currencyReward || 0);
}
function publisherRevenue(offer) {
  if (offer.type === 'multistep' && Array.isArray(offer.goals)) return offer.goals.filter(g => !g.isOptional).reduce((n,g) => n + Number(g.revenue || 0), 0);
  return Number(offer.revenue || 0);
}
function rankOffers(offers, zeroSpendOnly = true) {
  const blocked = new Set(['creditcard','deposit','freetrial','shopping']);
  return offers
    .filter(o => !zeroSpendOnly || !(o.categories || []).some(c => blocked.has(String(c).toLowerCase())))
    .map(o => {
      const reward = userReward(o), revenue = publisherRevenue(o), epc = Number(o.statistics?.epc || 0), conversionRate = Number(o.conversionRate || 0);
      const score = epc * 4 + reward * Math.max(0.15, Math.min(0.85, conversionRate / 100));
      return { offerID:o.offerID, name:o.name, description:o.description, categories:o.categories || [], devices:o.devices || [], paymentModel:o.paymentModel, reward, publisherRevenue:revenue, platformMargin:Number(Math.max(0,revenue-reward).toFixed(4)), epc, conversionRate, minutesUntilExpiration:o.minutesUntilExpiration || null, link:o.link, score:Number(score.toFixed(4)) };
    })
    .sort((a,b) => b.score - a.score || b.reward - a.reward)
    .slice(0,25);
}
async function getLootablyOffers({ userId, userAgent, ipAddress, country, device, zeroSpendOnly }) {
  const payload = { apiKey:process.env.LOOTABLY_API_KEY, placementID:process.env.LOOTABLY_PLACEMENT_ID, userData:{ userID:userId, userAgentHeader:userAgent, ipAddress } };
  if (country) payload.countries = [String(country).toUpperCase()];
  if (device) payload.devices = [device];
  const r = await fetch(LOOTABLY_API_URL, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(payload) });
  const data = await r.json();
  if (!r.ok || !data.success) throw new Error(data.message || `Lootably error ${r.status}`);
  return rankOffers(data.data?.offers || [], zeroSpendOnly);
}

function landing() {
return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>INCOME 2</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#0b0d10;color:#f4f6f8;margin:0}.wrap{max-width:920px;margin:0 auto;padding:34px 20px 70px}.brand{font-size:14px;letter-spacing:.16em;font-weight:900;color:#8da7ff}.hero{font-size:clamp(40px,8vw,70px);line-height:.95;margin:14px 0 14px}.sub{font-size:19px;color:#aab2c0;max-width:720px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:26px 0}.card,.mode{background:#151922;border:1px solid #29303d;border-radius:18px;padding:22px}.mode{background:#11151c}.good{color:#7ee787}.warn{color:#ffd166}.muted{color:#aab2c0}.small{font-size:13px}.balance{font-size:44px;font-weight:900;letter-spacing:-.04em;margin:4px 0}.statusline{font-weight:800}.pill{display:inline-flex;align-items:center;gap:7px;border:1px solid #33405a;background:#182033;border-radius:999px;padding:7px 11px;font-size:13px;font-weight:800}.dot{width:8px;height:8px;background:#7ee787;border-radius:50%}button{appearance:none;border:0;border-radius:12px;padding:13px 17px;font-weight:850;font-size:15px;cursor:pointer;background:#fff;color:#0b0d10;margin:4px 7px 4px 0}button.secondary{background:#242b38;color:#f4f6f8;border:1px solid #343d4d}button:disabled{opacity:.45;cursor:not-allowed}input,select{background:#0e1117;color:#fff;border:1px solid #303744;border-radius:9px;padding:10px;width:100%;margin-top:5px}.service{padding:13px 0;border-bottom:1px solid #252c38}.service:last-child{border-bottom:0}.price{font-weight:850;color:#7ee787}.notice{border-left:3px solid #8da7ff;padding:10px 13px;background:#101622;border-radius:8px}.error{color:#ff8f8f}a{color:#b7c8ff}.hidden{display:none}
</style></head><body><div class="wrap">
<div class="brand">INCOME 2</div><h1 class="hero">Your second income.<br>Powered by you or your AI.</h1><p class="sub">Turn on Agent Earn and leave it running. Outside AI buyers can pay INCOME 2 for eligible machine work. Real settled payments only—no guaranteed income.</p>
<div class="grid">
  <div class="mode"><div class="pill"><span class="dot"></span> AGENT EARN</div><h2>Let your AI earn</h2><p>Your Agent Earn account stays active after you close this page. When eligible paid agent work settles, your account balance updates.</p><p id="agentStatus" class="statusline muted">Checking live rail…</p><button id="startAgent">Start Agent Earn</button><button id="refreshAgent" class="secondary hidden">Refresh earnings</button><div id="agentAccount" class="hidden"><div class="muted small">Actual settled account balance</div><div id="balance" class="balance">$0.000000</div><div id="settlements" class="muted">0 settlements</div><div id="accountHandle" class="muted small" style="margin-top:10px"></div><p><button id="copyRecovery" class="secondary">Copy recovery key</button></p></div><p id="agentMessage" class="muted small">Starting Agent Earn does not spend your money. Revenue only exists after a real buyer pays.</p></div>
  <div class="mode"><div class="pill">HUMAN EARN</div><h2>Earn yourself</h2><p>Complete eligible advertiser-funded opportunities yourself. Human-required actions are never faked or automated.</p><p id="humanStatus" class="statusline warn">Checking publisher…</p></div>
</div>
<div class="card"><h2>Agent Earn marketplace</h2><p id="marketStatus" class="muted">Loading live paid services…</p><div id="services"></div></div>
<div class="card"><h2>Human Earn inventory</h2><div class="grid"><div><label>Country<input id="country" value="US" maxlength="2"></label></div><div><label>Device<select id="device"><option value="windows">Windows</option><option value="android">Android</option><option value="iphone">iPhone</option><option value="macos">macOS</option></select></label></div></div><p><button id="findOffers" disabled>Find paid opportunities</button></p><div id="results" class="muted">Publisher approval is still pending.</div></div>
<div class="notice"><b>Money rule:</b> INCOME 2 counts only settled third-party payments as earnings. A button click, listing, estimate, or available task is not revenue.</div>
<p class="muted small" style="margin-top:28px"><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
</div><script>
const HANDLE_KEY='income2AccountHandle', TOKEN_KEY='income2AccountToken';
const qs=id=>document.getElementById(id);
let humanLive=false;
function money(n){return '$'+Number(n||0).toFixed(6)}
function creds(){return {accountHandle:localStorage.getItem(HANDLE_KEY)||'',accountToken:localStorage.getItem(TOKEN_KEY)||''}}
async function post(path,body){const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});const d=await r.json();if(!r.ok)throw new Error(d.message||'Request failed');return d}
function showAccount(summary,handle){qs('agentAccount').classList.remove('hidden');qs('refreshAgent').classList.remove('hidden');qs('startAgent').textContent='Agent Earn Active';qs('startAgent').disabled=true;qs('balance').textContent=money(summary?.availableBalanceUsd);const c=Number(summary?.settlementCount||0);qs('settlements').textContent=c+' settled payment'+(c===1?'':'s')+' attributed';qs('accountHandle').textContent='Account: '+handle;qs('agentMessage').textContent='Agent Earn is active even when this page is closed. Earnings are not guaranteed; cash-out is not enabled in this beta.'}
async function refreshAccount(){const c=creds();if(!c.accountHandle||!c.accountToken)return;try{const d=await post('/api/agent/summary',c);showAccount(d.summary,c.accountHandle)}catch(e){localStorage.removeItem(HANDLE_KEY);localStorage.removeItem(TOKEN_KEY);qs('agentAccount').classList.add('hidden');qs('refreshAgent').classList.add('hidden');qs('startAgent').disabled=false;qs('startAgent').textContent='Start Agent Earn';qs('agentMessage').textContent='Saved account could not be authenticated. Start a new Agent Earn account.'}}
qs('startAgent').onclick=async()=>{qs('startAgent').disabled=true;qs('startAgent').textContent='Activating…';qs('agentMessage').textContent='Creating your persistent Agent Earn account…';try{const c=creds();const d=await post('/api/agent/start',c.accountHandle&&c.accountToken?c:{});if(d.accountHandle)localStorage.setItem(HANDLE_KEY,d.accountHandle);if(d.accountToken)localStorage.setItem(TOKEN_KEY,d.accountToken);showAccount(d.summary||{},d.accountHandle);qs('agentMessage').textContent=d.created?'Agent Earn is active. Your recovery key is saved on this device. Keep it if you want to restore this account elsewhere.':'Agent Earn is active again.'}catch(e){qs('startAgent').disabled=false;qs('startAgent').textContent='Start Agent Earn';qs('agentMessage').innerHTML='<span class="error">'+e.message+'</span>'}}
qs('refreshAgent').onclick=refreshAccount;
qs('copyRecovery').onclick=async()=>{const t=localStorage.getItem(TOKEN_KEY)||'';if(!t)return;try{await navigator.clipboard.writeText(t);qs('copyRecovery').textContent='Copied';setTimeout(()=>qs('copyRecovery').textContent='Copy recovery key',1500)}catch{alert('Recovery key: '+t)}};
fetch('/api/status').then(r=>r.json()).then(s=>{if(s.agent?.live){qs('agentStatus').innerHTML='<span class="good">LIVE BETA · Base / USDC</span>';qs('marketStatus').textContent=s.agent.resourceCount+' paid agent services are live at $0.001 per call.'}else{qs('agentStatus').innerHTML='<span class="error">Temporarily unavailable</span>';qs('startAgent').disabled=true}humanLive=Boolean(s.human?.providerConfigured);qs('humanStatus').innerHTML=humanLive?'<span class="good">FUNDED INVENTORY LIVE</span>':'<span class="warn">Publisher approval pending</span>';qs('findOffers').disabled=!humanLive;const list=s.agent?.resources||[];qs('services').innerHTML=list.map(x=>'<div class="service"><b>'+x.name+'</b> <span class="price">'+x.price+'</span><div class="muted small">'+x.description+'</div></div>').join('')||'<div class="muted">No services returned.</div>'}).catch(()=>{qs('agentStatus').innerHTML='<span class="error">Status check failed</span>'});
qs('findOffers').onclick=async()=>{const el=qs('results');el.textContent='Searching…';try{const r=await fetch('/api/opportunities',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:localStorage.getItem(HANDLE_KEY)||crypto.randomUUID(),country:qs('country').value,device:qs('device').value,zeroSpendOnly:true})});const d=await r.json();if(!r.ok)throw new Error(d.message||'Inventory unavailable');el.innerHTML=(d.offers||[]).map(o=>'<div class="service"><b>'+o.name+'</b><div class="price">'+Number(o.reward||0).toFixed(2)+' reward units</div><p>'+o.description+'</p><a href="'+o.link+'" target="_blank" rel="noopener">Open offer</a></div>').join('')||'No eligible offers returned.'}catch(e){el.innerHTML='<span class="error">'+e.message+'</span>'}};
refreshAccount();
</script></body></html>`;
}

const privacy = `<!doctype html><html><body style="font-family:system-ui;max-width:800px;margin:50px auto;padding:20px"><h1>INCOME 2 Privacy</h1><p>INCOME 2 uses a pseudonymous account handle and a recovery key stored by your browser to authenticate your Agent Earn ledger. The server stores only a hash of the recovery key. Do not share the recovery key publicly.</p><p>Human Earn providers may process device, targeting, interaction, and conversion data under their own policies when that inventory becomes active.</p><p>Never submit passwords, private keys, seed phrases, or confidential credentials to paid agent tools.</p></body></html>`;
const terms = `<!doctype html><html><body style="font-family:system-ui;max-width:800px;margin:50px auto;padding:20px"><h1>INCOME 2 Terms</h1><p>INCOME 2 is an opportunity-routing and autonomous service platform, not an employment offer or income guarantee. Agent Earn records only settled attributed activity. Availability, payment, reversals, eligibility, and marketplace requirements can vary.</p><p>Agent Earn may perform only machine-appropriate work allowed by the relevant marketplace and task. Fraud, fake human actions, duplicate identities, credential theft, or rule evasion is prohibited.</p><p>Cash-out for public beta account balances is not yet enabled.</p></body></html>`;

const server = http.createServer(async (req,res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && u.pathname === '/') return html(res,200,landing());
    if (req.method === 'GET' && u.pathname === '/privacy') return html(res,200,privacy);
    if (req.method === 'GET' && u.pathname === '/terms') return html(res,200,terms);
    if (req.method === 'GET' && u.pathname === '/health') return json(res,200,{ ok:true, service:'income2-router', version:'0.4.0' });
    if (req.method === 'GET' && u.pathname === '/api/status') {
      const agent = await sellerState().catch(() => ({ live:false, network:'eip155:8453', asset:'USDC', resourceCount:0, resources:[], ledger:null }));
      return json(res,200,{ ok:true, human:{ providerConfigured:lootablyConfigured(), provider:lootablyConfigured()?'lootably':null, status:lootablyConfigured()?'live':'provider_approval_pending' }, agent });
    }
    if (req.method === 'POST' && u.pathname === '/api/agent/start') {
      const body = JSON.parse((await readBody(req,20000)) || '{}');
      const result = await proxyAccount('/account/start', body, req);
      return json(res,result.status,result.data);
    }
    if (req.method === 'POST' && u.pathname === '/api/agent/summary') {
      const body = JSON.parse((await readBody(req,20000)) || '{}');
      const result = await proxyAccount('/account/summary', body, req);
      return json(res,result.status,result.data);
    }
    if (req.method === 'POST' && u.pathname === '/api/opportunities') {
      if (!lootablyConfigured()) return json(res,503,{ ok:false, code:'PROVIDER_PENDING', message:'Human Earn publisher inventory activation is pending.' });
      const body = JSON.parse((await readBody(req)) || '{}');
      const offers = await getLootablyOffers({ userId:String(body.userId || crypto.randomUUID()).slice(0,128), userAgent:String(req.headers['user-agent'] || 'Income2Router/0.4'), ipAddress:forwardedIp(req), country:body.country, device:body.device, zeroSpendOnly:body.zeroSpendOnly !== false });
      return json(res,200,{ ok:true, provider:'lootably', offers });
    }
    if (req.method === 'GET' && u.pathname === '/postback/lootably') {
      console.log(JSON.stringify({ type:'lootably_postback', query:Object.fromEntries(u.searchParams.entries()), receivedAt:new Date().toISOString() }));
      res.writeHead(200,{ 'content-type':'text/plain' }); return res.end('1');
    }
    return json(res,404,{ ok:false, message:'Not found' });
  } catch (err) {
    console.error(err);
    return json(res,500,{ ok:false, message:String(err.message || 'Internal error').slice(0,300) });
  }
});
server.listen(PORT,'0.0.0.0',()=>console.log(`INCOME 2 Router listening on ${PORT}; agentSeller=${AGENT_SELLER_ORIGIN}`));