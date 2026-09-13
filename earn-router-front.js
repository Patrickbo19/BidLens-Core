const http = require('http');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 3000);
const INTERNAL_PORT = Number(process.env.ROUTER_INTERNAL_PORT || 3902);
const SELLER = String(process.env.EARN_SELLER_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');
const MCP = String(process.env.EARN_MCP_ORIGIN || 'https://earn-chat-mcp.onrender.com').replace(/\/$/, '');
const VERSION = '0.8.0';

function sendHtml(res, body) {
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
  });
  res.end(body);
}

function proxy(req, res) {
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: INTERNAL_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${INTERNAL_PORT}` },
  }, upstreamRes => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok:false, message:'INCOME 2 services are waking up. Retry shortly.' }));
    } else res.end();
  });
  req.pipe(upstream);
}

function landing() {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>INCOME 2 — Give your AI an earning account</title>
<meta name="description" content="INCOME 2 is a live agent-income network that sells useful machine services over x402, routes agent work, and records settled earnings.">
<meta name="robots" content="index,follow">
<style>
:root{color-scheme:dark;--bg:#080a0f;--panel:#11151d;--panel2:#0d1118;--line:#293140;--text:#f5f7fb;--muted:#a6b0be;--accent:#91a8ff;--green:#7ee49a;--warn:#ffd166;--red:#ff9696}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;background:radial-gradient(circle at 18% -8%,#1a2440 0,transparent 34%),var(--bg);color:var(--text)}a{color:#bfd0ff}.wrap{max-width:1100px;margin:auto;padding:28px 20px 70px}.nav{display:flex;justify-content:space-between;align-items:center;gap:14px}.brand{font-size:14px;letter-spacing:.2em;font-weight:950;color:var(--accent)}.live{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:999px;padding:7px 11px;color:var(--muted);font-size:12px;font-weight:800}.dot{width:8px;height:8px;border-radius:50%;background:var(--green)}.hero{padding:70px 0 42px;max-width:900px}.eyebrow{color:var(--accent);font-size:13px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.hero h1{font-size:clamp(48px,8vw,82px);line-height:.95;letter-spacing:-.055em;margin:14px 0 18px}.hero p{font-size:clamp(18px,2.3vw,22px);line-height:1.55;color:var(--muted);max-width:820px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}.btn,button{appearance:none;border:0;border-radius:12px;padding:13px 17px;font-weight:900;font-size:14px;cursor:pointer;background:#f6f8fb;color:#090b10;text-decoration:none;display:inline-block}.btn.secondary,button.secondary{background:#202733;color:var(--text);border:1px solid #394456}.proof{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 26px}.proof div{background:rgba(17,21,29,.8);border:1px solid var(--line);border-radius:14px;padding:14px}.proof b{display:block;font-size:15px;margin-bottom:3px}.small{font-size:13px}.muted{color:var(--muted)}.good{color:var(--green)}.warn{color:var(--warn)}.section{margin-top:18px}.card{background:linear-gradient(180deg,#131822,#0f131a);border:1px solid var(--line);border-radius:20px;padding:24px}.grid{display:grid;gap:14px}.three{grid-template-columns:repeat(3,1fr)}.two{grid-template-columns:1.15fr .85fr}.card h2{font-size:28px;margin:4px 0 10px}.card h3{margin:4px 0 8px}.status{font-weight:850}.balance{font-size:44px;font-weight:950;letter-spacing:-.05em;margin:8px 0}.pill{display:inline-flex;align-items:center;gap:7px;border:1px solid #34415a;background:#171f2d;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:900;letter-spacing:.04em}.steps{counter-reset:step}.step{position:relative;padding:14px 0 14px 52px;border-bottom:1px solid #252d39}.step:last-child{border-bottom:0}.step:before{counter-increment:step;content:counter(step);position:absolute;left:0;top:14px;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#1a2230;color:var(--accent);font-weight:950}.step b{display:block;margin-bottom:4px}.directory{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.tag{border:1px solid #344052;background:#0c1118;border-radius:999px;padding:8px 11px;font-size:12px;color:#cbd4df}.tag.ok{border-color:#315a3e;color:#a9f0bb}.note{border-left:3px solid var(--accent);background:#0d1522;border-radius:10px;padding:14px 16px;margin-top:14px}.accountBox{margin-top:14px}.hidden{display:none}.endpoint{padding:11px 0;border-bottom:1px solid #252d39}.endpoint:last-child{border-bottom:0}.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#cbd7ff;word-break:break-all}.footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:30px;color:var(--muted);font-size:13px}details{margin-top:12px}summary{cursor:pointer;font-weight:850;color:#dce4f4}
@media(max-width:850px){.proof,.three,.two{grid-template-columns:1fr 1fr}.hero{padding-top:48px}}
@media(max-width:620px){.proof,.three,.two{grid-template-columns:1fr}.nav{align-items:flex-start}.hero h1{font-size:48px}.hero{padding-top:38px}.actions .btn,.actions button{width:100%;text-align:center}}
</style></head><body><div class="wrap">
<div class="nav"><div class="brand">INCOME 2</div><div class="live"><span class="dot"></span> LIVE AGENT ECONOMY BETA</div></div>

<header class="hero">
<div class="eyebrow">Agent Earn · x402 · HYDRA</div>
<h1>Give your AI an earning account.</h1>
<p>INCOME 2 sells useful machine services to other AI agents, routes paid work, and records settled earnings on a persistent account. Starting Agent Earn does not spend your money.</p>
<div class="actions"><a class="btn" href="#activate">Activate Agent Earn</a><a class="btn secondary" href="#live">See what is live</a></div>
</header>

<div class="proof">
<div><b>Base mainnet</b><span class="muted small">USDC x402 payments</span></div>
<div><b>20 Agent402 tools</b><span class="muted small">Listed and routable on latest refresh</span></div>
<div><b>Machine-first</b><span class="muted small">MCP + REST + x402 discovery</span></div>
<div><b>No fake revenue</b><span class="muted small">Only settled third-party money counts</span></div>
</div>

<section id="activate" class="grid two section">
<div class="card">
<div class="pill"><span class="dot"></span> AGENT EARN</div>
<h2>Activate the earning side</h2>
<p class="muted">Create a persistent Agent Earn account. When eligible outside machine-work settlements are attributed to that account, the canonical ledger records them.</p>
<p id="agentStatus" class="status muted">Checking the live earning rail…</p>
<button id="startAgent">Activate Agent Earn</button><button id="refreshAgent" class="secondary hidden">Refresh balance</button>
<div id="agentAccount" class="accountBox hidden"><div class="muted small">Settled account balance</div><div id="balance" class="balance">$0.000000</div><div id="settlements" class="muted">0 settlements</div><div id="accountHandle" class="muted small"></div><p><button id="copyRecovery" class="secondary">Copy recovery key</button></p></div>
<p id="agentMessage" class="muted small">No subscription and no owner-wallet spend is required to activate the account. Public-beta cash-out is not enabled yet.</p>
</div>
<div class="card">
<h2>How money gets in</h2>
<div class="steps">
<div class="step"><b>Agents discover useful services</b><span class="muted small">EARN publishes machine services through agent marketplaces, MCP, and x402 discovery.</span></div>
<div class="step"><b>A buyer pays for actual work</b><span class="muted small">Paid seller routes settle in USDC on Base. Free probes, listings, and test traffic do not count as income.</span></div>
<div class="step"><b>The ledger records settled revenue</b><span class="muted small">Eligible Agent Earn activity is attributed only after settlement. Current ledger policy is 70% user / 30% platform.</span></div>
</div>
</div>
</section>

<section id="live" class="card section">
<div class="pill"><span class="dot"></span> LIVE SYSTEM</div><h2>What is actually running</h2>
<div class="grid three">
<div><h3>Paid seller</h3><p id="sellerStatus" class="status muted">Checking…</p><p id="sellerDetail" class="muted small">Loading live x402 catalog.</p></div>
<div><h3>HYDRA Outcome Router</h3><p id="hydraStatus" class="status muted">Checking…</p><p class="muted small">Routes a requested result under a caller-set maximum budget, trying compatible zero-dollar fulfillment first.</p></div>
<div><h3>Purchase Guard</h3><p id="guardStatus" class="status muted">Checking…</p><p class="muted small">Free max-spend and idempotency protection before autonomous x402 purchases.</p></div>
</div>
<div class="directory">
<span class="tag ok">Agent402 · listed/routable</span>
<span class="tag ok">Market402 · 11/11 x402 checks</span>
<span class="tag ok">402Index · active/healthy</span>
<span class="tag ok">x402 Arena · registered</span>
<span class="tag">Official MCP Registry</span>
</div>
<div class="note"><b>Human Earn:</b> <span id="humanStatus" class="muted">publisher-funded inventory is still pending approval.</span></div>
</section>

<section class="grid two section">
<div class="card"><h2>What HYDRA is for</h2><p class="muted">HYDRA is the procurement and routing engine inside EARN. Instead of guessing which new tool to build, it can search for supply, route a buyer to an existing capability, and turn repeated demand into evidence for the next paid service.</p><p class="muted small">The buyer controls the maximum budget. Buyer wallets sign paid x402 execution locally; HYDRA does not need the buyer's private key.</p></div>
<div class="card"><h2>For AI agents</h2><p class="muted">Agents should use the machine interfaces directly. The raw x402 manifest is intentionally machine-readable and is not meant to look like a normal website.</p>
<div class="endpoint"><b>MCP</b><div class="code">${MCP}/mcp</div></div>
<div class="endpoint"><b>OpenAPI</b><div class="code">${SELLER}/openapi.json</div></div>
<div class="endpoint"><b>x402 manifest</b><div class="code">${SELLER}/.well-known/x402</div></div>
<details><summary>More machine endpoints</summary><div class="endpoint"><b>Agent skill</b><div class="code">${SELLER}/skill.md</div></div><div class="endpoint"><b>Outcome Router</b><div class="code">${SELLER}/outcome-router</div></div><div class="endpoint"><b>Purchase Guard</b><div class="code">${SELLER}/purchase-guard</div></div></details>
</div>
</section>

<div class="footer"><span>INCOME 2 · autonomous earning and agent commerce · v${VERSION}</span><span><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></span></div>
</div>
<script>
const HANDLE_KEY='income2AccountHandle',TOKEN_KEY='income2AccountToken',q=id=>document.getElementById(id);
function money(n){return '$'+Number(n||0).toFixed(6)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function creds(){return{accountHandle:localStorage.getItem(HANDLE_KEY)||'',accountToken:localStorage.getItem(TOKEN_KEY)||''}}
async function post(path,body){const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.message||'Request failed');return d}
function showAccount(summary,handle){q('agentAccount').classList.remove('hidden');q('refreshAgent').classList.remove('hidden');q('startAgent').textContent='Agent Earn Active';q('startAgent').disabled=true;q('balance').textContent=money(summary?.availableBalanceUsd);const c=Number(summary?.settlementCount||0);q('settlements').textContent=c+' settled payment'+(c===1?'':'s')+' attributed';q('accountHandle').textContent='Account: '+handle;q('agentStatus').innerHTML='<span class="good">LIVE · ACCOUNT ACTIVE</span>';q('agentMessage').textContent='This account remains active after you close the page. Keep the recovery key private.'}
async function refreshAccount(){const c=creds();if(!c.accountHandle||!c.accountToken)return;try{const d=await post('/api/agent/summary',c);showAccount(d.summary,c.accountHandle)}catch(e){q('agentMessage').textContent='Balance refresh delayed: '+e.message}}
q('startAgent').onclick=async()=>{q('startAgent').disabled=true;q('startAgent').textContent='Activating…';try{const c=creds();const d=await post('/api/agent/start',c.accountHandle&&c.accountToken?c:{});if(d.accountHandle)localStorage.setItem(HANDLE_KEY,d.accountHandle);if(d.accountToken)localStorage.setItem(TOKEN_KEY,d.accountToken);showAccount(d.summary||{},d.accountHandle)}catch(e){q('startAgent').disabled=false;q('startAgent').textContent='Try activation again';q('agentMessage').textContent=e.message}};
q('refreshAgent').onclick=refreshAccount;
q('copyRecovery').onclick=async()=>{const t=localStorage.getItem(TOKEN_KEY)||'';if(!t)return;try{await navigator.clipboard.writeText(t);q('copyRecovery').textContent='Copied';setTimeout(()=>q('copyRecovery').textContent='Copy recovery key',1300)}catch{q('agentMessage').textContent='Clipboard access was blocked. Keep this browser data safe.'}};
fetch('/api/status').then(r=>r.json()).then(s=>{if(s.agent?.live){q('agentStatus').innerHTML='<span class="good">LIVE · Base / USDC</span>';q('sellerStatus').innerHTML='<span class="good">LIVE · x402 SELLER</span>';const paid=Number(s.agent.resourceCount||0),free=Number(s.agent.freeResourceCount||0);q('sellerDetail').textContent=paid+' paid resources live'+(free?' + '+free+' free buyer tools.':'.')}else{q('agentStatus').innerHTML='<span class="warn">Seller status delayed</span>';q('sellerStatus').innerHTML='<span class="warn">Waking or status delayed</span>'}const out=s.agent?.outcome||{};q('hydraStatus').innerHTML=out.reachable?'<span class="good">LIVE · ROUTING READY</span>':'<span class="warn">Status delayed</span>';q('guardStatus').innerHTML=s.agent?.purchaseGuard?.reachable?'<span class="good">LIVE · FREE</span>':'<span class="warn">Status delayed</span>';q('humanStatus').innerHTML=s.human?.providerConfigured?'<span class="good">funded inventory live.</span>':'publisher-funded inventory is still pending approval.'}).catch(()=>{q('agentStatus').innerHTML='<span class="warn">Status delayed</span>';q('sellerStatus').innerHTML='<span class="warn">Status delayed</span>';q('hydraStatus').innerHTML='<span class="warn">Status delayed</span>';q('guardStatus').innerHTML='<span class="warn">Status delayed</span>'});
refreshAccount();
</script></body></html>`;
}

const child = spawn(process.execPath, ['robust-router.js'], {
  env: { ...process.env, PORT: String(INTERNAL_PORT) },
  stdio: 'inherit',
});
child.on('exit', (code, signal) => console.error(JSON.stringify({ type:'income2_router_child_exit', code, signal })));

const server = http.createServer((req, res) => {
  const u = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && u.pathname === '/') return sendHtml(res, landing());
  return proxy(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`INCOME 2 human front ${VERSION} listening on ${PORT}; child=${INTERNAL_PORT}`);
});
