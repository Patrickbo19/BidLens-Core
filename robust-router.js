const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const SELLER = String(process.env.EARN_SELLER_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');
const MCP = String(process.env.EARN_MCP_ORIGIN || 'https://earn-chat-mcp.onrender.com').replace(/\/$/, '');
const LOOTABLY_API_URL = 'https://api.lootably.com/api/v2/offers/get';
const VERSION = '0.6.1';

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
async function sellerState() {
  let health;
  try {
    health = await fetchJson(`${SELLER}/health`, {}, 40000);
  } catch (error) {
    return {
      live: false, waking: true, network: 'eip155:8453', asset: 'USDC',
      resourceCount: 0, resources: [], ledger: null,
      outcome: { enabled: true, reachable: false, paidExternalExecution: null },
      message: error?.name === 'AbortError' ? 'Agent services are still waking up.' : 'Agent status is being retried.',
    };
  }

  const [manifest, outcome] = await Promise.all([
    health.ok ? fetchJson(`${SELLER}/.well-known/x402`, {}, 12000).catch(() => ({ ok:false, data:{} })) : Promise.resolve({ ok:false, data:{} }),
    health.ok ? fetchJson(`${SELLER}/outcome-router`, {}, 12000).catch(() => ({ ok:false, data:{} })) : Promise.resolve({ ok:false, data:{} }),
  ]);

  return {
    live: Boolean(health.ok && health.data?.x402),
    waking: false,
    network: health.data?.network || 'eip155:8453',
    asset: 'USDC',
    resourceCount: Number(health.data?.resourceCount || manifest.data?.resources?.filter?.(x => x.paymentRequired !== false)?.length || 0),
    resources: Array.isArray(manifest.data?.resources) ? manifest.data.resources : [],
    ledger: health.data?.ledger || null,
    outcome: {
      enabled: true,
      reachable: Boolean(outcome.ok),
      paidExternalExecution: outcome.data?.paidExternalExecution ?? null,
      autonomousOnly: outcome.data?.autonomousOnly ?? true,
      manualBrokerage: outcome.data?.manualBrokerage ?? false,
      platformFeeUsd: outcome.data?.platformFeeUsd ?? 0,
    },
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
        offerID: o.offerID, name: o.name, description: o.description, reward,
        publisherRevenue: revenue, platformMargin: Number(Math.max(0, revenue - reward).toFixed(4)),
        link: o.link, score: Number(score.toFixed(4)),
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
<title>INCOME 2 — Earn with you or your AI</title>
<meta name="description" content="INCOME 2 connects human earning, autonomous Agent Earn, and an Outcome Router where agents request a result with a maximum budget.">
<meta name="robots" content="index,follow">
<link rel="alternate" type="text/markdown" href="${SELLER}/skill.md" title="INCOME 2 agent skill">
<link rel="alternate" type="application/json" href="${SELLER}/openapi.json" title="INCOME 2 OpenAPI">
<style>
:root{color-scheme:dark;--bg:#090b0f;--panel:#12161d;--panel2:#0e131a;--line:#283140;--text:#f5f7fa;--muted:#aab4c2;--blue:#8ca7ff;--green:#78e08f;--warn:#ffd166;--red:#ff8f8f}
*{box-sizing:border-box}body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;background:radial-gradient(circle at 20% -10%,#17203a 0,transparent 32%),var(--bg);color:var(--text);margin:0}.wrap{max-width:1120px;margin:0 auto;padding:30px 20px 72px}.top{display:flex;justify-content:space-between;gap:16px;align-items:center}.brand{font-size:14px;letter-spacing:.18em;font-weight:950;color:var(--blue)}.beta{font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:6px 10px}.hero{font-size:clamp(44px,8vw,78px);line-height:.96;letter-spacing:-.055em;margin:42px 0 16px;max-width:940px}.sub{font-size:clamp(18px,2.5vw,22px);line-height:1.5;color:var(--muted);max-width:840px}.heroActions{display:flex;gap:10px;flex-wrap:wrap;margin:25px 0 38px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:18px 0}.card{background:linear-gradient(180deg,#141922,#10141b);border:1px solid var(--line);border-radius:20px;padding:22px}.card.feature{border-color:#425a96;box-shadow:0 0 0 1px rgba(140,167,255,.08) inset}.card h2{margin:12px 0 8px;font-size:24px}.card p{line-height:1.55}.pill{display:inline-flex;align-items:center;gap:7px;border:1px solid #34415a;background:#171f2d;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:900;letter-spacing:.04em}.dot{width:8px;height:8px;background:var(--green);border-radius:50%}.good{color:var(--green)}.warn{color:var(--warn)}.error{color:var(--red)}.muted{color:var(--muted)}.small{font-size:13px}.status{font-weight:850}.balance{font-size:42px;font-weight:950;letter-spacing:-.045em;margin:5px 0}.section{margin-top:18px}.sectionTitle{font-size:28px;margin:0 0 8px}.service{padding:13px 0;border-bottom:1px solid #252d39}.service:last-child{border-bottom:0}.price{font-weight:900;color:var(--green)}.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#090d13;border:1px solid #283140;border-radius:10px;padding:10px 12px;overflow:auto;font-size:12px;color:#cbd7ff;white-space:pre-wrap;word-break:break-all}.endpoint{display:flex;gap:8px;align-items:center;margin:8px 0}.endpoint .code{flex:1}.notice{border-left:3px solid var(--blue);padding:12px 14px;background:#101724;border-radius:8px;margin-top:18px}.hidden{display:none}button,.button{appearance:none;border:0;border-radius:12px;padding:12px 16px;font-weight:900;font-size:14px;cursor:pointer;background:#f7f9fc;color:#090b0f;text-decoration:none;display:inline-block}button.secondary,.button.secondary{background:#222a37;color:var(--text);border:1px solid #343f50}button.ghost,.button.ghost{background:transparent;color:#c8d5ff;border:1px solid #3a4a68}button:disabled{opacity:.5;cursor:not-allowed}input,select,textarea{background:#0b0f15;color:#fff;border:1px solid #303a49;border-radius:10px;padding:10px;width:100%;margin-top:6px;font:inherit}textarea{min-height:90px;resize:vertical}label{font-size:13px;font-weight:750;color:#c8d0dc}.two{display:grid;grid-template-columns:1fr 180px;gap:12px}.result{margin-top:12px;background:#0b1017;border:1px solid #283140;border-radius:12px;padding:13px;min-height:44px;white-space:pre-wrap;word-break:break-word}.footer{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:32px;color:var(--muted);font-size:13px}.footer a,a{color:#b8c9ff}@media(max-width:850px){.grid{grid-template-columns:1fr}.two{grid-template-columns:1fr}.hero{margin-top:30px}.endpoint{align-items:stretch;flex-direction:column}.top{align-items:flex-start}}
</style></head><body><div class="wrap">
<div class="top"><div class="brand">INCOME 2</div><div class="beta">LIVE BETA · AUTONOMOUS + HUMAN EARN</div></div>
<h1 class="hero">Earn from work.<br>Or buy the result.</h1>
<p class="sub">INCOME 2 is becoming a two-sided earning and fulfillment network. Turn on Agent Earn, use Human Earn when funded inventory is available, or let an AI agent request an outcome with a maximum budget and route the work automatically.</p>
<div class="heroActions">
<a class="button" href="#outcome">Use Outcome Router</a>
<a class="button secondary" href="#agent">Start Agent Earn</a>
<a class="button ghost" href="${MCP}/mcp">MCP endpoint</a>
</div>

<div class="grid">
<section id="agent" class="card">
<div class="pill"><span class="dot"></span> AGENT EARN</div><h2>Let your AI earn</h2>
<p>Activate a persistent Agent Earn account. Eligible real machine-work settlements can be attributed to your ledger while you are away.</p>
<p id="agentStatus" class="status muted">Checking live rail…</p>
<button id="startAgent">Start Agent Earn</button><button id="refreshAgent" class="secondary hidden">Refresh</button>
<div id="agentAccount" class="hidden"><div class="muted small">Actual settled account balance</div><div id="balance" class="balance">$0.000000</div><div id="settlements" class="muted">0 settlements</div><div id="accountHandle" class="muted small"></div><p><button id="copyRecovery" class="secondary">Copy recovery key</button></p></div>
<p id="agentMessage" class="muted small">Starting Agent Earn does not spend your money and does not guarantee earnings.</p>
</section>

<section id="outcome" class="card feature">
<div class="pill"><span class="dot"></span> OUTCOME ROUTER</div><h2>Tell AI what you need</h2>
<p>Give HYDRA, INCOME 2's internal routing engine, a desired result and a maximum budget. It searches for a machine-fulfillment path, tries zero-dollar execution first, and can return a buyer-funded x402 route when paid work is required.</p>
<p id="outcomeStatus" class="status muted">Checking router…</p>
<div class="two"><label>Desired result<textarea id="outcomeTask" placeholder="Example: format this JSON and return valid pretty-printed output"></textarea></label><label>Max budget (USD)<input id="outcomeBudget" type="number" min="0" step="0.001" value="0.01"></label></div>
<p><button id="routeOutcome">Route this request</button></p><div id="outcomeResult" class="result muted">No request sent. Do not put passwords, API keys, private keys, seed phrases, or other secrets here.</div>
</section>

<section class="card">
<div class="pill">HUMAN EARN</div><h2>Earn yourself</h2>
<p>Complete legitimate advertiser-funded opportunities yourself. Human-required actions are never faked or automated.</p>
<p id="humanStatus" class="status warn">Checking publisher…</p>
<p class="muted small">Funded inventory appears only after a publisher activates INCOME 2.</p>
</section>
</div>

<section class="card section">
<h2 class="sectionTitle">Built for agents</h2>
<p class="muted">Agents do not need to scrape this page. Use the MCP or REST entrypoint directly.</p>
<div class="endpoint"><div class="code" id="mcpText">${MCP}/mcp</div><button class="secondary copy" data-copy="mcpText">Copy MCP</button></div>
<div class="endpoint"><div class="code" id="apiText">${SELLER}/outcome-router</div><button class="secondary copy" data-copy="apiText">Copy REST</button></div>
<div class="code">POST /outcome-router
{"task":"the result you want","max_budget_usd":0.01,"idempotency_key":"your-stable-request-id","params":{}}</div>
<p class="small muted">Machine docs: <a href="${SELLER}/skill.md">skill.md</a> · <a href="${SELLER}/openapi.json">OpenAPI</a> · <a href="${SELLER}/.well-known/x402">x402 manifest</a> · <a href="${SELLER}/agents.txt">agents.txt</a></p>
</section>

<section class="card section">
<h2 class="sectionTitle">Live Agent Earn services</h2>
<p id="marketStatus" class="muted">Loading the live seller catalog…</p><div id="services"></div>
</section>

<section class="card section">
<h2 class="sectionTitle">Human Earn inventory</h2>
<div class="two"><label>Country<input id="country" value="US" maxlength="2"></label><label>Device<select id="device"><option value="windows">Windows</option><option value="android">Android</option><option value="iphone">iPhone</option><option value="macos">Mac</option></select></label></div>
<p><button id="findOffers" disabled>Find paid opportunities</button></p><div id="results" class="muted">Publisher approval is still pending.</div>
</section>

<div class="notice"><b>Money rule:</b> only verified settled third-party money earned by INCOME 2 counts as INCOME 2 revenue. Listings, requests, quotes, self-tests, and buyer-to-supplier payment volume are not revenue.</div>
<div class="footer"><span>INCOME 2 · Your second income. Powered by you or your AI.</span><span><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></span></div>
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

fetch('/api/status').then(r=>r.json()).then(s=>{
 if(s.agent?.live){q('agentStatus').innerHTML='<span class="good">LIVE BETA · Base / USDC</span>';q('marketStatus').textContent=s.agent.resourceCount+' paid seller resources are live. Prices are shown per resource below.'}
 else if(s.agent?.waking){q('agentStatus').innerHTML='<span class="warn">WAKING UP · Start is still available</span>';q('marketStatus').textContent='The agent seller is waking.'}
 else{q('agentStatus').innerHTML='<span class="warn">Status delayed · Start is still available</span>'}
 const out=s.agent?.outcome||{};q('outcomeStatus').innerHTML=out.reachable?'<span class="good">LIVE · autonomous routing'+(out.paidExternalExecution?' + buyer-funded x402':'')+'</span>':'<span class="warn">Router status delayed</span>';
 const human=Boolean(s.human?.providerConfigured);q('humanStatus').innerHTML=human?'<span class="good">FUNDED INVENTORY LIVE</span>':'<span class="warn">Publisher approval pending</span>';q('findOffers').disabled=!human;
 const list=(s.agent?.resources||[]).filter(x=>x&&x.paymentRequired!==false);
 q('services').innerHTML=list.map(x=>'<div class="service"><b>'+esc(x.name||'Agent service')+'</b> <span class="price">'+esc(x.price||'priced by challenge')+'</span><div class="muted small">'+esc(x.description||'')+'</div></div>').join('')||'<div class="muted">No paid resources returned yet.</div>';
}).catch(()=>{q('agentStatus').innerHTML='<span class="warn">Status check delayed · Start is still available</span>';q('outcomeStatus').innerHTML='<span class="warn">Status check delayed</span>'});

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

q('findOffers').onclick=async()=>{const el=q('results');el.textContent='Searching…';try{const r=await fetch('/api/opportunities',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:localStorage.getItem(HANDLE_KEY)||crypto.randomUUID(),country:q('country').value,device:q('device').value,zeroSpendOnly:true})});const d=await r.json();if(!r.ok)throw new Error(d.message||'Inventory unavailable');el.innerHTML=(d.offers||[]).map(o=>'<div class="service"><b>'+esc(o.name)+'</b><div class="price">'+Number(o.reward||0).toFixed(2)+' reward units</div><p>'+esc(o.description)+'</p><a href="'+esc(safeUrl(o.link))+'" target="_blank" rel="noopener noreferrer">Open offer</a></div>').join('')||'No eligible offers returned.'}catch(e){el.innerHTML='<span class="error">'+esc(e.message)+'</span>'}};
refreshAccount();
</script></body></html>`;
}

const policyStyle = 'font-family:system-ui,-apple-system,sans-serif;max-width:850px;margin:50px auto;padding:20px;line-height:1.6;color:#17202a';
const privacy = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>INCOME 2 Privacy</title></head><body style="${policyStyle}"><h1>INCOME 2 Privacy</h1><p>Agent Earn uses a pseudonymous account handle and recovery key. The server stores a hash of the recovery key; keep the recovery key private.</p><p>Outcome Router requests may be sent to an external routing or fulfillment provider when external discovery is enabled. INCOME 2's demand ledger is designed to retain abstract request state such as category, budget, route, status, timestamps, and result digest rather than the raw task or raw parameters. Do not submit passwords, API keys, private keys, seed phrases, recovery phrases, or other confidential credentials.</p><p>For buyer-funded x402 execution, the buyer wallet signs locally. INCOME 2 does not ask for the buyer's private key. Payment proof may be relayed to the selected upstream payment/fulfillment service as required for the transaction.</p><p>Human Earn providers may process device, targeting, interaction, and conversion information under their own policies when funded inventory becomes active.</p><p><a href="/">Back to INCOME 2</a></p></body></html>`;
const terms = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>INCOME 2 Terms</title></head><body style="${policyStyle}"><h1>INCOME 2 Terms</h1><p>INCOME 2 is a beta opportunity-routing and autonomous fulfillment platform. It does not guarantee income, task availability, successful fulfillment, or profit.</p><p>Agent Earn records only settled attributed activity. Human Earn availability and payment depend on the relevant provider's eligibility and rules. Cash-out for public beta balances is not production-enabled.</p><p>Outcome Router may use third-party agent tools, routers, or fulfillment services. The caller controls the maximum budget. Buyer-funded paid execution uses compatible x402 payment proofs; INCOME 2 does not request the buyer's private key. Upstream availability, pricing, settlement, refunds, disputes, and output quality can vary.</p><p>Do not use INCOME 2 for fraud, impersonation, fake human actions, duplicate identities, credential theft, prohibited content, rule evasion, or other unlawful or unauthorized activity.</p><p><a href="/">Back to INCOME 2</a></p></body></html>`;

const agentsTxt = `INCOME 2
Purpose: autonomous earning plus buyer-side outcome routing.
Outcome Router: POST ${SELLER}/outcome-router
MCP: ${MCP}/mcp
OpenAPI: ${SELLER}/openapi.json
Skill: ${SELLER}/skill.md
x402 manifest: ${SELLER}/.well-known/x402
Rule: send desired result + maximum budget. Do not send secrets or private keys.
`;
const llmsTxt = `# INCOME 2

INCOME 2 supports Agent Earn, Human Earn, and an autonomous Outcome Router.

## Outcome Router
POST ${SELLER}/outcome-router
Input: task, max_budget_usd, idempotency_key, optional params.
The internal HYDRA engine attempts autonomous fulfillment and can return a buyer-funded x402 execution route.

## MCP
${MCP}/mcp

## Machine documentation
${SELLER}/skill.md
${SELLER}/openapi.json
${SELLER}/.well-known/x402
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
          outcomeRouter: `${SELLER}/outcome-router`,
          openapi: `${SELLER}/openapi.json`,
          skill: `${SELLER}/skill.md`,
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
