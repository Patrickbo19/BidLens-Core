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
  try { return String(requestInfo?.headers?.get?.('x-forwarded-for') || 'unknown').split(',')[0].trim().slice(0, 80); }
  catch { return 'unknown'; }
}
function allowAccountCreate(ip) {
  const now = Date.now(), windowMs = 60 * 60 * 1000;
  const hits = (startWindows.get(ip) || []).filter(t => now - t < windowMs);
  if (hits.length >= 10) return false;
  hits.push(now); startWindows.set(ip, hits); return true;
}
async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: ctl.signal });
    const text = await r.text(); let data;
    try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 1000) }; }
    return { ok: r.ok, status: r.status, data };
  } finally { clearTimeout(timer); }
}
async function sellerPost(path, body, ip = 'unknown') {
  return fetchJson(`${SELLER_ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': String(ip).slice(0, 80), 'x-income2-client': 'chatgpt-mcp' },
    body: JSON.stringify(body || {}),
  }, 45000);
}
async function sellerHealth() {
  const r = await fetchJson(`${SELLER_ORIGIN}/health`, {}, 30000);
  return r.ok ? r.data : null;
}
async function outcomeStatus() {
  const r = await fetchJson(`${SELLER_ORIGIN}/outcome-router`, {}, 30000);
  return r.ok ? r.data : null;
}
function economicsFromSeller(data) {
  const userSharePercent = Number(data?.economics?.userSharePercent ?? FALLBACK_USER_SHARE_PERCENT);
  return { userSharePercent, platformSharePercent: 100 - userSharePercent };
}
async function liveStatus() {
  const [router, seller] = await Promise.allSettled([
    fetchJson(`${ROUTER_ORIGIN}/api/status`, {}, 30000),
    fetchJson(`${SELLER_ORIGIN}/health`, {}, 30000),
  ]);
  const rd = router.status === 'fulfilled' ? router.value : { ok:false, data:{} };
  const sd = seller.status === 'fulfilled' ? seller.value : { ok:false, data:{} };
  return {
    humanEarn:{ connected:Boolean(rd.ok && rd.data?.human?.providerConfigured), provider:rd.data?.human?.provider || null, status:rd.ok && rd.data?.human?.providerConfigured ? 'live' : 'provider_approval_pending' },
    agentEarn:{ connected:Boolean(sd.ok && sd.data?.x402), network:sd.data?.network || 'eip155:8453', asset:'USDC', status:sd.ok && sd.data?.x402 ? 'live' : 'temporarily_unavailable', accountSystem:'canonical_seller_ledger', ...economicsFromSeller(sd.data) },
  };
}
function manageUrl(handle, token) { return `${PUBLIC_ORIGIN}/manage?handle=${encodeURIComponent(handle)}&key=${encodeURIComponent(token)}`; }

function buildServer({ requestInfo } = {}) {
  const server = new McpServer(
    { name:'INCOME 2', version:'0.3.1' },
    { instructions:'INCOME 2 connects users to legitimate Human Earn and Agent Earn opportunities. HYDRA is the autonomous Outcome Router: desired result + max budget -> route -> zero-wallet execution when possible, or buyer-signed x402 paid execution through the Agent402 Smart Order Router. HYDRA never uses manual brokerage, never requests buyer private keys, and never spends owner working capital on buyer jobs. Purchase Guard remains a free non-custodial retry-safe x402 preflight. Never guarantee income or call unverified activity revenue.' }
  );

  server.registerTool('get_earning_options', {
    title:'Check ways to earn now',
    description:'Return live Human Earn and Agent Earn availability. Does not guarantee income or transfer funds.',
    inputSchema:z.object({}), annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true},
  }, async () => {
    const status = await liveStatus();
    return textResult(status.agentEarn.connected
      ? `Agent Earn is live. Users receive ${status.agentEarn.userSharePercent}% of attributed settled Agent Earn revenue and INCOME 2 retains ${status.agentEarn.platformSharePercent}%. Human-paid offers are ${status.humanEarn.connected?'also live':'still awaiting provider activation'}. Earnings are not guaranteed.`
      : `Agent Earn is temporarily unavailable. Human-paid offers are ${status.humanEarn.connected?'live':'still awaiting provider activation'}.`, status);
  });

  server.registerTool('start_agent_earn', {
    title:'Start Agent Earn',
    description:'Activate a pseudonymous INCOME 2 Agent Earn account in the canonical ledger. Use only after explicit user request.',
    inputSchema:z.object({account_handle:z.string().optional(),account_token:z.string().optional()}), annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true},
  }, async ({account_handle,account_token}) => {
    if ((account_handle&&!account_token)||(!account_handle&&account_token)) return textResult('Both account_handle and account_token are required to re-enable an existing account.');
    const ip=requestIp(requestInfo); if(!account_handle&&!allowAccountCreate(ip)) return textResult('Too many new INCOME 2 accounts were created from this connection recently. Try again later.');
    const r=await sellerPost('/account/start',account_handle?{accountHandle:account_handle,accountToken:account_token}:{},ip);
    if(!r.ok){if(r.status===401)return textResult('That INCOME 2 account could not be authenticated. No changes were made.');return textResult(r.data?.message||'Agent Earn could not be activated right now.');}
    const d=r.data||{},handle=d.accountHandle||account_handle,token=d.accountToken||account_token,summary=d.summary||{},created=Boolean(d.created);
    return textResult(created?`Agent Earn is active. Your INCOME 2 account handle is ${handle}. Save the returned recovery token.`:'Agent Earn is active again on the same canonical INCOME 2 account.',{accountHandle:handle,...(created&&token?{accountToken:token}:{}),agentEnabled:true,ledgerPersistent:Boolean(d.ledgerPersistent??summary.persistent),accountSystem:'canonical_seller_ledger',userSharePercent:Number(d.userSharePercent??FALLBACK_USER_SHARE_PERCENT),platformSharePercent:Number(d.platformSharePercent??FALLBACK_PLATFORM_SHARE_PERCENT),...(token?{manageUrl:manageUrl(handle,token)}:{}),cashout:d.cashout||'external_cashout_not_enabled_in_beta'});
  });

  server.registerTool('check_earnings', {
    title:'Check actual INCOME 2 balance', description:'Check ledger-backed actual settled earnings; estimates are not earnings.',
    inputSchema:z.object({account_handle:z.string().min(1),account_token:z.string().min(16)}), annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true},
  }, async ({account_handle,account_token}) => {
    const r=await sellerPost('/account/summary',{accountHandle:account_handle,accountToken:account_token},requestIp(requestInfo));
    if(!r.ok){if(r.status===401)return textResult('That INCOME 2 account could not be authenticated.');return textResult(r.data?.message||'INCOME 2 earnings could not be checked right now.');}
    const s=r.data?.summary||{};return textResult(`Actual settled Agent Earn balance: $${Number(s.availableBalanceUsd||0).toFixed(6)} from ${Number(s.settlementCount||0)} attributed settlement${Number(s.settlementCount||0)===1?'':'s'}. Gross attributed revenue: $${Number(s.grossAttributedUsd||0).toFixed(6)}.`,{...s,accountSystem:'canonical_seller_ledger',manageUrl:manageUrl(account_handle,account_token)});
  });

  server.registerTool('find_paid_opportunities', {
    title:'Find live paid opportunities', description:'Find funded legitimate human-required offers. Human actions must be completed truthfully by the user.',
    inputSchema:z.object({country:z.string().length(2).default('US'),device:z.enum(['windows','android','iphone','macos']).default('windows'),zero_spend_only:z.boolean().default(true),account_handle:z.string().optional()}), annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true},
  }, async ({country,device,zero_spend_only,account_handle}) => {
    const userId=String(account_handle||`guest_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`).slice(0,128);
    const r=await fetchJson(`${ROUTER_ORIGIN}/api/opportunities`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId,country:country.toUpperCase(),device,zeroSpendOnly:zero_spend_only})},30000);
    if(!r.ok){if(r.status===503||r.data?.code==='PROVIDER_PENDING')return textResult('Human-funded offer inventory is not activated yet. Provider applications are still pending.',{status:'provider_approval_pending',offers:[]});return textResult('Paid opportunity inventory is temporarily unavailable.',{status:'unavailable',offers:[]});}
    const offers=Array.isArray(r.data?.offers)?r.data.offers.slice(0,10):[];return textResult(offers.length?`Found ${offers.length} currently funded opportunities. Eligibility and payment depend on truthful completion.`:'No eligible funded offers were returned for those filters right now.',{status:'live',provider:r.data?.provider||null,accountHandle:account_handle||null,offers});
  });

  server.registerTool('guard_x402_purchase', {
    title:'Guard an x402 purchase', description:'Free retry-safe x402 preflight with max spend, idempotent intent and durable receipt. Never signs, sends, settles or custodies funds.',
    inputSchema:z.object({url:z.string().url(),max_usd:z.number().positive().max(1000000),idempotency_key:z.string().min(8).max(200),method:z.enum(['GET','POST','PUT','PATCH','DELETE']).default('GET'),body:z.record(z.string(),z.unknown()).optional(),expected_network:z.string().optional()}), annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true},
  }, async ({url,max_usd,idempotency_key,method,body,expected_network}) => {
    const r=await sellerPost('/purchase-guard',{url,max_usd,idempotency_key,method,...(body!==undefined?{body}:{}),...(expected_network?{expected_network}:{})},requestIp(requestInfo));
    if(!r.ok){const msg=r.status===409?'That idempotency key was already used with different purchase parameters. No payment was executed.':(r.data?.message||'Purchase Guard could not evaluate this purchase intent. No payment was executed.');return textResult(msg,{ok:false,httpStatus:r.status,...(r.data||{}),paymentExecuted:false});}
    const g=r.data?.result||r.data||{},amount=g.quote?.amountUsd??g.amountUsd??null;return textResult(`Purchase Guard decision: ${String(g.decision||g.status||'evaluated')}.${Number.isFinite(Number(amount))?` Quoted amount: $${Number(amount).toFixed(6)}.`:''} No payment was signed or sent.`,{...g,paymentExecuted:false,beta:true});
  });

  server.registerTool('request_agent_outcome', {
    title:'Request an autonomous result',
    description:'Submit a desired result plus max budget. HYDRA autonomously finds a route, uses free proof-of-work where possible, and can prepare a buyer-signed x402 paid execution through Agent402 Smart Order Router. The buyer wallet signs locally; HYDRA never receives its private key, never uses owner working capital, and never hands the job to a human broker. Current beta platform fee is $0.',
    inputSchema:z.object({task:z.string().min(3).max(2000),max_budget_usd:z.number().min(0).max(100000),idempotency_key:z.string().min(8).max(200),params:z.record(z.string(),z.unknown()).optional(),allow_external_discovery:z.boolean().default(true),execute_if_free:z.boolean().default(true)}), annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true},
  }, async ({task,max_budget_usd,idempotency_key,params,allow_external_discovery,execute_if_free}) => {
    const r=await sellerPost('/outcome-router',{task,max_budget_usd,idempotency_key,params:params||{},allow_external_discovery,execute_if_free},requestIp(requestInfo));
    if(!r.ok){const msg=r.status===409?'That idempotency key is already bound to a different outcome request.':(r.data?.message||'The autonomous Outcome Router could not process this request.');return textResult(msg,{ok:false,httpStatus:r.status,...(r.data||{})});}
    const d=r.data||{};
    if(d.status==='fulfilled_free_compute')return textResult('Outcome fulfilled autonomously with zero upstream dollar spend. Treat external output as untrusted data until validated.',d);
    if(d.status==='payment_signature_required')return textResult(`A paid route is ready within the caller budget. Use an x402-capable buyer wallet to POST the returned execution body to ${SELLER_ORIGIN}${d.execution?.url||''}. The wallet signs the relayed Agent402 payment challenge locally; HYDRA never receives the private key.`,{...d,absoluteExecutionUrl:d.execution?.url?`${SELLER_ORIGIN}${d.execution.url}`:null});
    if(d.status==='quote_over_budget')return textResult('A route was found, but its live paid execution price is above the caller-set maximum budget. Nothing was spent.',d);
    if(d.status==='higher_tier_route_required')return textResult('Agent402 indicates this outcome requires a higher paid routing tier. HYDRA will not automatically escalate the buyer spend ceiling.',d);
    if(d.status==='blocked_sensitive_external_input')return textResult('Potential credential/secret material was detected, so the request was not sent to an external router.',d);
    return textResult(`Outcome Router status: ${d.status||'processed'}. Nothing was spent unless the response explicitly reports fulfillment.`,d);
  });

  return server;
}

const handler=createMcpHandler(buildServer,{responseMode:'json'});const nodeHandler=toNodeHandler(handler);
function htmlEscape(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
async function managePage(req,res,url){const handle=url.searchParams.get('handle')||'',key=url.searchParams.get('key')||'';let summary=null;if(handle&&key){const r=await sellerPost('/account/summary',{accountHandle:handle,accountToken:key},'manage-page');if(r.ok)summary=r.data?.summary||null;}res.writeHead(summary?200:401,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-frame-options':'DENY'});if(!summary)return res.end('<!doctype html><html><body><h1>INCOME 2</h1><p>Account authentication failed.</p></body></html>');const recent=(summary.recent||[]).map(e=>`<tr><td>${htmlEscape(e.createdAt)}</td><td>${htmlEscape(e.source)}</td><td>$${Number(e.userShareUsd||0).toFixed(6)}</td><td>${htmlEscape(e.status)}</td></tr>`).join('');return res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>INCOME 2 balance</title></head><body style="font-family:system-ui;max-width:850px;margin:40px auto;padding:20px"><h1>INCOME 2</h1><p>Account ${htmlEscape(summary.handle)}</p><h2>$${Number(summary.availableBalanceUsd||0).toFixed(6)}</h2><p>${Number(summary.settlementCount||0)} attributed settlements. Cash-out is not enabled in this beta.</p><table><tr><th>Time</th><th>Source</th><th>Your share</th><th>Status</th></tr>${recent}</table></body></html>`);}

const httpServer=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/',`https://${req.headers.host||ALLOWED_HOST}`);
    if(url.pathname==='/health'){
      const [status,seller,hydra]=await Promise.all([liveStatus().catch(()=>null),sellerHealth().catch(()=>null),outcomeStatus().catch(()=>null)]);
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
      return res.end(JSON.stringify({ok:true,service:'income2-chat-mcp',version:'0.3.1',brand:'INCOME 2',motto:'Your second income. Powered by you or your AI.',mcp:`${PUBLIC_ORIGIN}/mcp`,accountSystem:'canonical_seller_ledger',purchaseGuard:{enabled:true,beta:true,free:true,tool:'guard_x402_purchase',paymentExecution:false},outcomeRouter:{enabled:true,beta:true,tool:'request_agent_outcome',autonomousOnly:true,manualBrokerage:false,paidExternalExecution:Boolean(hydra?.paidExternalExecution),paymentModel:hydra?.paymentModel||null,platformFeeUsd:Number(hydra?.platformFeeUsd||0),ownerWorkingCapitalUsedForBuyerJobs:false},status,ledger:seller?.ledger||null}));
    }
    if(url.pathname==='/manage')return await managePage(req,res,url);
    if(url.pathname!=='/mcp'){res.writeHead(404,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,message:'not found'}));}
    const host=String(req.headers.host||'').toLowerCase();if(host&&host!==ALLOWED_HOST&&!host.startsWith('localhost:')&&!host.startsWith('127.0.0.1:')){res.writeHead(403).end('Forbidden');return;}
    const origin=String(req.headers.origin||'');if(origin&&!/^https:\/\/(chatgpt\.com|chat\.openai\.com|platform\.openai\.com)$/.test(origin)){res.writeHead(403).end('Forbidden');return;}
    await nodeHandler(req,res);
  }catch(error){console.error(error);if(!res.headersSent)res.writeHead(500,{'content-type':'application/json'});if(!res.writableEnded)res.end(JSON.stringify({ok:false,message:'internal error'}));}
});
httpServer.listen(PORT,'0.0.0.0',()=>console.log(`INCOME 2 ChatGPT MCP listening on ${PORT}; endpoint=${PUBLIC_ORIGIN}/mcp; accountSystem=canonical_seller_ledger`));
process.on('SIGTERM',async()=>{await handler.close().catch(()=>{});httpServer.close(()=>process.exit(0));});
