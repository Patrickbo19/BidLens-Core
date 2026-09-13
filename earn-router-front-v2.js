const http = require('http');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 3000);
const INTERNAL_PORT = Number(process.env.ROUTER_INTERNAL_PORT || 3902);
const VERSION = '0.9.0';

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
    hostname: '127.0.0.1', port: INTERNAL_PORT, path: req.url, method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${INTERNAL_PORT}` },
  }, upstreamRes => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(503, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' });
      res.end(JSON.stringify({ ok:false, message:'INCOME 2 services are waking up. Retry shortly.' }));
    } else res.end();
  });
  req.pipe(upstream);
}

function landing() {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>INCOME 2 — Activate your AI earning lane</title>
<meta name="description" content="Create an isolated Agent Earn lane that receives attributed shares of real outside machine-work settlements won by the INCOME 2 network.">
<meta name="robots" content="index,follow">
<style>
:root{color-scheme:dark;--bg:#080a0f;--panel:#11161e;--line:#293241;--text:#f6f8fb;--muted:#a8b2bf;--accent:#94aaff;--green:#7ee49a;--warn:#ffd166}
*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;background:radial-gradient(circle at 18% -8%,#1a2440 0,transparent 34%),var(--bg);color:var(--text)}a{color:#bfd0ff}.wrap{max-width:1080px;margin:auto;padding:28px 20px 70px}.nav{display:flex;justify-content:space-between;gap:14px;align-items:center}.brand{font-size:14px;letter-spacing:.2em;font-weight:950;color:var(--accent)}.live,.pill{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:999px;padding:7px 11px;color:var(--muted);font-size:12px;font-weight:850}.dot{width:8px;height:8px;border-radius:50%;background:var(--green)}.hero{padding:68px 0 36px;max-width:900px}.hero h1{font-size:clamp(46px,8vw,80px);line-height:.96;letter-spacing:-.055em;margin:12px 0 18px}.hero p{font-size:clamp(18px,2.2vw,22px);line-height:1.55;color:var(--muted);max-width:840px}.btn,button{appearance:none;border:0;border-radius:12px;padding:13px 17px;font-weight:900;font-size:14px;cursor:pointer;background:#f6f8fb;color:#090b10;text-decoration:none;display:inline-block}.secondary{background:#202733!important;color:var(--text)!important;border:1px solid #394456!important}.grid{display:grid;gap:14px}.two{grid-template-columns:1.15fr .85fr}.three{grid-template-columns:repeat(3,1fr)}.card{background:linear-gradient(180deg,#131822,#0f131a);border:1px solid var(--line);border-radius:20px;padding:24px}.card h2{font-size:28px;margin:10px 0}.card h3{margin:5px 0}.muted{color:var(--muted)}.small{font-size:13px}.good{color:var(--green)}.warn{color:var(--warn)}.status{font-weight:850}.balance{font-size:44px;font-weight:950;letter-spacing:-.05em;margin:8px 0}.hidden{display:none}.account{margin-top:14px}.line{padding:10px 0;border-bottom:1px solid #252d39}.line:last-child{border-bottom:0}.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;color:#cbd7ff}.note{border-left:3px solid var(--accent);background:#0d1522;border-radius:10px;padding:14px 16px;margin-top:14px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:30px;color:var(--muted);font-size:13px}
@media(max-width:760px){.two,.three{grid-template-columns:1fr}.hero{padding-top:42px}.actions .btn,.actions button{width:100%;text-align:center}.nav{align-items:flex-start}.hero h1{font-size:48px}}
</style></head><body><div class="wrap">
<div class="nav"><div class="brand">INCOME 2</div><div class="live"><span class="dot"></span> LIVE BETA</div></div>
<header class="hero"><div class="pill"><span class="dot"></span> AGENT EARN</div><h1>Activate your own AI earning lane.</h1><p>One click creates a persistent, isolated account and worker ID. Your lane can receive attributed shares of real outside machine-work settlements the EARN network wins. The infrastructure is shared; your credentials, ledger, assignments, and earnings history are separate.</p><div class="actions"><a class="btn" href="#activate">Activate my lane</a><a class="btn secondary" href="#truth">How it really works</a></div></header>
<section id="activate" class="grid two">
<div class="card"><h2>Your Agent Earn lane</h2><p id="agentStatus" class="status muted">Checking live rail…</p><button id="startAgent">Activate Agent Earn</button><button id="refreshAgent" class="secondary hidden">Refresh</button>
<div id="accountBox" class="account hidden"><div class="muted small">Your settled balance</div><div id="balance" class="balance">$0.000000</div><div id="settlements" class="muted">0 settlements</div><div class="line"><b>Worker ID</b><div id="workerId" class="code"></div></div><div class="line"><b>Invite link</b><div id="inviteUrl" class="code"></div></div><div class="actions"><button id="copyInvite" class="secondary">Copy invite link</button><button id="copyRecovery" class="secondary">Copy recovery key</button></div><div id="referrals" class="muted small"></div></div>
<p id="agentMessage" class="muted small">Activation costs $0. Cash-out is not production-enabled yet; beta balances are ledger balances, not a promise of withdrawable income.</p></div>
<div class="card"><h2>What “dedicated” means</h2><div class="line"><b>Separate identity</b><div class="muted small">A unique worker ID, recovery credential, invite code, and ledger.</div></div><div class="line"><b>Separate accounting</b><div class="muted small">Assignments and settled shares are recorded to that worker, not mixed into another user's balance.</div></div><div class="line"><b>Shared infrastructure</b><div class="muted small">We do not waste money running a separate server for every person. The backend isolates tenant state while sharing the compute and marketplace rails.</div></div></div>
</section>
<section id="truth" class="grid three" style="margin-top:14px"><div class="card"><h3>Outside buyers create the money</h3><p class="muted small">Signups do not manufacture revenue. Agent marketplaces and buyers have to purchase real work first.</p></div><div class="card"><h3>Current split</h3><p class="muted small"><b class="good">70% user / 30% platform</b> on eligible attributed settlements under the current ledger policy.</p></div><div class="card"><h3>Fair assignment</h3><p class="muted small">Jobs with an explicit worker owner go directly there. General seller settlements use the active-worker fair pool instead of silently favoring one account.</p></div></section>
<section class="card" style="margin-top:14px"><h2>Invite people without turning this into an MLM</h2><p class="muted">Every account gets a permanent invite code so we can measure who brought whom. The referral layer is one level and currently tracks attribution only—there is no multi-level recruiting payout. Your platform economics still come from the platform share of real external work, not from new people paying to join.</p><div class="note"><b>Important:</b> More users only help the business when buyer demand and funded work grow with them. We should scale acquisition and demand together so user earnings are not diluted by a flood of idle accounts.</div></section>
<section class="card" style="margin-top:14px"><h2>Live network</h2><div class="grid three"><div><h3>Seller</h3><p id="sellerStatus" class="status muted">Checking…</p></div><div><h3>HYDRA</h3><p id="hydraStatus" class="status muted">Checking…</p></div><div><h3>Human Earn</h3><p id="humanStatus" class="status muted">Checking…</p></div></div></section>
<div class="footer"><span>INCOME 2 · isolated earning lanes on shared infrastructure · v${VERSION}</span><span><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></span></div></div>
<script>
const HANDLE_KEY='income2AccountHandle',TOKEN_KEY='income2AccountToken',REF_KEY='income2ReferralCode',q=id=>document.getElementById(id);
const incoming=(new URLSearchParams(location.search).get('ref')||'').trim().toLowerCase();if(/^[a-z0-9_-]{4,40}$/.test(incoming))localStorage.setItem(REF_KEY,incoming);
function money(n){return '$'+Number(n||0).toFixed(6)}
function creds(){return{accountHandle:localStorage.getItem(HANDLE_KEY)||'',accountToken:localStorage.getItem(TOKEN_KEY)||''}}
async function post(path,body){const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.message||'Request failed');return d}
function show(summary){q('accountBox').classList.remove('hidden');q('refreshAgent').classList.remove('hidden');q('startAgent').disabled=true;q('startAgent').textContent='Agent Earn Active';q('balance').textContent=money(summary?.availableBalanceUsd);const c=Number(summary?.settlementCount||0);q('settlements').textContent=c+' settled payment'+(c===1?'':'s')+' attributed';q('workerId').textContent=summary?.worker?.workerId||'pending';const code=summary?.referral?.inviteCode||'';const invite=code?location.origin+'/?ref='+encodeURIComponent(code):location.origin;q('inviteUrl').textContent=invite;q('referrals').textContent='Direct referred accounts: '+Number(summary?.referral?.directReferrals||0)+' · referral payouts are not enabled';q('agentStatus').innerHTML='<span class="good">LIVE · WORKER ACTIVE</span>';q('agentMessage').textContent='Your lane remains active after you close this page. Keep the recovery key private.'}
async function refresh(){const c=creds();if(!c.accountHandle||!c.accountToken)return;try{const d=await post('/api/agent/summary',c);show(d.summary)}catch(e){q('agentMessage').textContent='Refresh delayed: '+e.message}}
q('startAgent').onclick=async()=>{q('startAgent').disabled=true;q('startAgent').textContent='Activating…';try{const c=creds();const body=c.accountHandle&&c.accountToken?c:{referralCode:localStorage.getItem(REF_KEY)||''};const d=await post('/api/agent/start',body);if(d.accountHandle)localStorage.setItem(HANDLE_KEY,d.accountHandle);if(d.accountToken)localStorage.setItem(TOKEN_KEY,d.accountToken);show(d.summary||{})}catch(e){q('startAgent').disabled=false;q('startAgent').textContent='Try activation again';q('agentMessage').textContent=e.message}};
q('refreshAgent').onclick=refresh;
q('copyRecovery').onclick=async()=>{const t=localStorage.getItem(TOKEN_KEY)||'';if(!t)return;try{await navigator.clipboard.writeText(t);q('copyRecovery').textContent='Copied';setTimeout(()=>q('copyRecovery').textContent='Copy recovery key',1200)}catch{q('agentMessage').textContent='Clipboard blocked. Keep this browser data safe.'}};
q('copyInvite').onclick=async()=>{const v=q('inviteUrl').textContent||location.origin;try{await navigator.clipboard.writeText(v);q('copyInvite').textContent='Copied';setTimeout(()=>q('copyInvite').textContent='Copy invite link',1200)}catch{}};
fetch('/api/status').then(r=>r.json()).then(s=>{if(s.agent?.live){q('agentStatus').innerHTML='<span class="good">LIVE · Base / USDC</span>';q('sellerStatus').innerHTML='<span class="good">LIVE · '+Number(s.agent.resourceCount||0)+' paid resources</span>'}else{q('agentStatus').innerHTML='<span class="warn">Status delayed</span>';q('sellerStatus').innerHTML='<span class="warn">Waking/status delayed</span>'}q('hydraStatus').innerHTML=s.agent?.outcome?.reachable?'<span class="good">LIVE · routing ready</span>':'<span class="warn">Status delayed</span>';q('humanStatus').innerHTML=s.human?.providerConfigured?'<span class="good">Funded inventory live</span>':'<span class="warn">Publisher approval pending</span>'}).catch(()=>{});
refresh();
</script></body></html>`;
}

const child = spawn(process.execPath, ['robust-router.js'], { env:{...process.env,PORT:String(INTERNAL_PORT)}, stdio:'inherit' });
child.on('exit',(code,signal)=>console.error(JSON.stringify({type:'income2_router_child_exit',code,signal})));
const server=http.createServer((req,res)=>{const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);if(req.method==='GET'&&u.pathname==='/')return sendHtml(res,landing());return proxy(req,res)});
server.listen(PORT,'0.0.0.0',()=>console.log(`INCOME 2 human front ${VERSION} listening on ${PORT}; child=${INTERNAL_PORT}`));