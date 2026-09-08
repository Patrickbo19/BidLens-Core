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
  } catch { return 'unknown'; }
}
function allowAccountCreate(ip) {
  const now = Date.now(), windowMs = 60 * 60 * 1000;
  const hits = (startWindows.get(ip) || []).filter(t => now - t < windowMs);
  if (hits.length >= 10) return false;
  hits.push(now); startWindows.set(ip, hits); return true;
}
async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: ctl.signal });
    const text = await r.text(); let data;
    try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 500) }; }
    return { ok: r.ok, status: r.status, data };
  } finally { clearTimeout(timer); }
}
async function sellerPost(path, body, ip = 'unknown') {
  return fetchJson(`${SELLER_ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': String(ip || 'unknown').slice(0, 80), 'x-income2-client': 'chatgpt-mcp' },
    body: JSON.stringify(body || {}),
  }, 45000);
}
async function sellerHealth() { const result = await fetchJson(`${SELLER_ORIGIN}/health`, {}, 30000); return result.ok ? result.data : null; }
function economicsFromSeller(data) {
  const userSharePercent = Number(data?.economics?.userSharePercent ?? FALLBACK_USER_SHARE_PERCENT);
  const platformSharePercent = Number(data?.economics?.platformSharePercent ?? FALLBACK_PLATFORM_SHARE_PERCENT);
  return { userSharePercent, platformSharePercent };
}
async function liveStatus() {
  const [router, seller] = await Promise.allSettled([fetchJson(`${ROUTER_ORIGIN}/api/status`, {}, 30000), fetchJson(`${SELLER_ORIGIN}/health`, {}, 30000)]);
  const routerData = router.status === 'fulfilled' ? router.value : { ok: false, data: {} };
  const sellerData = seller.status === 'fulfilled' ? seller.value : { ok: false, data: {} };
  const economics = economicsFromSeller(sellerData.data);
  return {
    humanEarn: { connected:Boolean(routerData.ok && routerData.data?.human?.providerConfigured), provider:routerData.data?.human?.provider || null, status:routerData.ok && routerData.data?.human?.providerConfigured ? 'live' : 'provider_approval_pending' },
    agentEarn: { connected:Boolean(sellerData.ok && sellerData.data?.x402), network:sellerData.data?.network || 'eip155:8453', asset:'USDC', status:sellerData.ok && sellerData.data?.x402 ? 'live' : 'temporarily_unavailable', accountSystem:'canonical_seller_ledger', ...economics },
  };
}
function manageUrl(handle, token) { return `${PUBLIC_ORIGIN}/manage?handle=${encodeURIComponent(handle)}&key=${encodeURIComponent(token)}`; }

function buildServer({ requestInfo } = {}) {
  const server = new McpServer(
    { name: 'INCOME 2', version: '0.3.0' },
    { instructions:'INCOME 2 connects users to legitimate paid opportunities and autonomous agent work. The Outcome Router accepts a desired result plus max budget and autonomously finds/executes zero-wallet fulfillment where possible; it never uses manual brokerage. Purchase Guard is a free non-custodial retry-safe x402 preflight. Never guarantee income or treat projected earnings as earned money. Human-required actions must be completed truthfully by the user. Cash-out and money transfers are external to ChatGPT.' },
  );

  server.registerTool('get_earning_options', {
    title:'Check ways to earn now',
    description:'Use when a user wants to make money or asks whether AI can earn for them. Returns live Human Earn and Agent Earn availability; does not guarantee income or transfer funds.',
    inputSchema:z.object({}),
    annotations:{ readOnlyHint:true, destructiveHint:false, idempotentHint:true, openWorldHint:true },
  }, async () => {
    const status=await liveStatus();
    const message=status.agentEarn.connected
      ? `Agent Earn is live for eligible autonomous paid work. Users receive ${status.agentEarn.userSharePercent}% of attributed settled Agent Earn revenue and INCOME 2 retains ${status.agentEarn.platformSharePercent}%. Human-paid offers are ${status.humanEarn.connected ? 'also live' : 'still awaiting provider activation'}. Earnings are not guaranteed.`
      : `Agent Earn is temporarily unavailable. Human-paid offers are ${status.humanEarn.connected ? 'live' : 'still awaiting provider activation'}.`;
    return textResult(message,status);
  });

  server.registerTool('start_agent_earn', {
    title:'Start Agent Earn',
    description:'Activate a pseudonymous INCOME 2 Agent Earn account in the canonical ledger. Use only after explicit user request. Does not spend user money, guarantee earnings, or cash out funds.',
    inputSchema:z.object({ account_handle:z.string().optional(), account_token:z.string().optional() }),
    annotations:{ readOnlyHint:false, destructiveHint:false, idempotentHint:false, openWorldHint:true },
  }, async ({ account_handle, account_token }) => {
    if ((account_handle && !account_token) || (!account_handle && account_token)) return textResult('Both account_handle and account_token are required to re-enable an existing account.');
    const ip=requestIp(requestInfo);
    if (!account_handle && !allowAccountCreate(ip)) return textResult('Too many new INCOME 2 accounts were created from this connection recently. Try again later.');
    const result=await sellerPost('/account/start',account_handle ? {accountHandle:account_handle,accountToken:account_token} : {},ip);
    if (!result.ok) {
      if (result.status===401) return textResult('That INCOME 2 account could not be authenticated. No changes were made.');
      return textResult(result.data?.message || 'Agent Earn could not be activated right now.');
    }
    const data=result.data||{},handle=data.accountHandle||account_handle,token=data.accountToken||account_token,summary=data.summary||{},url=token?manageUrl(handle,token):null,created=Boolean(data.created);
    return textResult(created ? `Agent Earn is active. Your INCOME 2 account handle is ${handle}. Save the recovery token returned with this tool result. Website and ChatGPT use the same canonical ledger.` : 'Agent Earn is active again on the same canonical INCOME 2 account.', {
      accountHandle:handle,...(created&&token?{accountToken:token}:{}),agentEnabled:true,ledgerPersistent:Boolean(data.ledgerPersistent??summary.persistent),accountSystem:'canonical_seller_ledger',userSharePercent:Number(data.userSharePercent??FALLBACK_USER_SHARE_PERCENT),platformSharePercent:Number(data.platformSharePercent??FALLBACK_PLATFORM_SHARE_PERCENT),...(url?{manageUrl:url}:{}),cashout:data.cashout||'external_only_not_enabled_in_beta'
    });
  });

  server.registerTool('check_earnings', {
    title:'Check actual INCOME 2 balance',
    description:'Check ledger-backed actual settled earnings. Never treat estimates or available opportunities as earnings.',
    inputSchema:z.object({ account_handle:z.string().min(1), account_token:z.string().min(16) }),
    annotations:{ readOnlyHint:true, destructiveHint:false, idempotentHint:true, openWorldHint:true },
  }, async ({ account_handle, account_token }) => {
    const result=await sellerPost('/account/summary',{accountHandle:account_handle,accountToken:account_token},requestIp(requestInfo));
    if(!result.ok){if(result.status===401)return textResult('That INCOME 2 account could not be authenticated.');return textResult(result.data?.message||'INCOME 2 earnings could not be checked right now.');}
    const summary=result.data?.summary||{},url=manageUrl(account_handle,account_token);
    return textResult(`Actual settled Agent Earn balance: $${Number(summary.availableBalanceUsd||0).toFixed(6)} from ${Number(summary.settlementCount||0)} attributed settlement${Number(summary.settlementCount||0)===1?'':'s'}. Gross attributed revenue: $${Number(summary.grossAttributedUsd||0).toFixed(6)}.`,{...summary,accountSystem:'canonical_seller_ledger',manageUrl:url});
  });

  server.registerTool('find_paid_opportunities', {
    title:'Find live paid opportunities',
    description:'Find currently funded legitimate surveys and advertiser-funded offers. Human-required actions must be completed by the user.',
    inputSchema:z.object({ country:z.string().length(2).default('US'), device:z.enum(['windows','android','iphone','macos']).default('windows'), zero_spend_only:z.boolean().default(true), account_handle:z.string().optional() }),
    annotations:{ readOnlyHint:true, destructiveHint:false, idempotentHint:true, openWorldHint:true },
  }, async ({ country, device, zero_spend_only, account_handle }) => {
    const userId=String(account_handle||`guest_${cryptoRandomId()}`).slice(0,128);
    const result=await fetchJson(`${ROUTER_ORIGIN}/api/opportunities`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId,country:country.toUpperCase(),device,zeroSpendOnly:zero_spend_only})},30000);
    if(!result.ok){if(result.status===503||result.data?.code==='PROVIDER_PENDING')return textResult('Human-funded offer inventory is not activated yet. Provider applications are still pending.',{status:'provider_approval_pending',offers:[]});return textResult('Paid opportunity inventory is temporarily unavailable.',{status:'unavailable',offers:[]});}
    const offers=Array.isArray(result.data?.offers)?result.data.offers.slice(0,10):[];
    if(!offers.length)return textResult('No eligible funded offers were returned for those filters right now.',{status:'live',offers:[]});
    return textResult(`Found ${offers.length} currently funded opportunities. Completion and payment depend on provider eligibility and truthful completion; earnings are not guaranteed.`,{status:'live',provider:result.data?.provider||null,accountHandle:account_handle||null,offers});
  });

  server.registerTool('guard_x402_purchase', {
    title:'Guard an x402 purchase',
    description:'Free INCOME 2 beta for retry-safe x402 preflight: max spend, idempotent purchase intent and durable receipt. Never signs, sends, settles, or custodies funds.',
    inputSchema:z.object({ url:z.string().url(), max_usd:z.number().positive().max(1000000), idempotency_key:z.string().min(8).max(200), method:z.enum(['GET','POST','PUT','PATCH','DELETE']).default('GET'), body:z.record(z.string(),z.unknown()).optional(), expected_network:z.string().optional() }),
    annotations:{ readOnlyHint:false, destructiveHint:false, idempotentHint:true, openWorldHint:true },
  }, async ({ url, max_usd, idempotency_key, method, body, expected_network }) => {
    const result=await sellerPost('/purchase-guard',{url,max_usd,idempotency_key,method,...(body!==undefined?{body}:{}),...(expected_network?{expected_network}:{})},requestIp(requestInfo));
    if(!result.ok){const message=result.status===409?'That idempotency key was already used with different purchase parameters. No payment was executed.':(result.data?.message||'Purchase Guard could not evaluate this purchase intent. No payment was executed.');return textResult(message,{ok:false,httpStatus:result.status,...(result.data||{}),paymentExecuted:false});}
    const guard=result.data?.result||result.data||{},decision=String(guard.decision||guard.status||'evaluated'),amount=guard.quote?.amountUsd??guard.amountUsd??null,amountText=Number.isFinite(Number(amount))?` Quoted amount: $${Number(amount).toFixed(6)}.`:'';
    return textResult(`Purchase Guard decision: ${decision}.${amountText} The intent is recorded for retry recognition. No payment was signed or sent.`,{...guard,paymentExecuted:false,beta:true});
  });

  server.registerTool('request_agent_outcome', {
    title:'Request an autonomous result',
    description:'Submit the result you need plus a maximum budget. INCOME 2 HYDRA autonomously discovers a fulfillment route and executes compatible zero-wallet proof-of-work tools when possible. It never hands the job to a human broker, never spends owner working capital, and never asks for a buyer private key. Paid external execution remains blocked until a safe buyer-funded/delegated payment rail exists.',
    inputSchema:z.object({
      task:z.string().min(3).max(2000),
      max_budget_usd:z.number().min(0).max(100000),
      idempotency_key:z.string().min(8).max(200),
      params:z.record(z.string(),z.unknown()).optional(),
      allow_external_discovery:z.boolean().default(true),
      execute_if_free:z.boolean().default(true),
    }),
    annotations:{ readOnlyHint:false, destructiveHint:false, idempotentHint:true, openWorldHint:true },
  }, async ({ task, max_budget_usd, idempotency_key, params, allow_external_discovery, execute_if_free }) => {
    const result=await sellerPost('/outcome-router',{task,max_budget_usd,idempotency_key,params:params||{},allow_external_discovery,execute_if_free},requestIp(requestInfo));
    if(!result.ok){const msg=result.status===409?'That idempotency key is already bound to a different outcome request.':(result.data?.message||'The autonomous outcome router could not process this request.');return textResult(msg,{ok:false,httpStatus:result.status,...(result.data||{})});}
    const data=result.data||{};
    if(data.status==='fulfilled_free_compute')return textResult('Outcome fulfilled autonomously with zero upstream dollar spend. External output is untrusted data and should be validated before acting on it.',data);
    if(data.status==='quote_over_budget')return textResult('A route was found, but its quoted price is above the caller-set maximum budget. Nothing was spent.',data);
    if(data.status==='routable_requires_buyer_funding')return textResult('A route was found within or near the requested budget, but paid execution is intentionally blocked until a safe buyer-funded/delegated payment rail exists. Nothing was spent and no human brokerage is required.',data);
    if(data.status==='blocked_sensitive_external_input')return textResult('Potential credential/secret material was detected, so the request was not sent to an external routing provider.',data);
    return textResult(`Outcome Router status: ${data.status||'processed'}. Nothing was spent unless the response explicitly reports a fulfilled zero-wallet execution.`,data);
  });

  return server;
}

function cryptoRandomId(){return Math.random().toString(36).slice(2)+Date.now().toString(36);}
const handler=createMcpHandler(buildServer,{responseMode:'json'}); const nodeHandler=toNodeHandler(handler);
function htmlEscape(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
async function managePage(req,res,url){
  const handle=url.searchParams.get('handle')||'',key=url.searchParams.get('key')||'';let summary=null;
  if(handle&&key){const result=await sellerPost('/account/summary',{accountHandle:handle,accountToken:key},'manage-page');if(result.ok)summary=result.data?.summary||null;}
  res.writeHead(summary?200:401,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-frame-options':'DENY'});
  if(!summary)return res.end('<!doctype html><html><body style="font-family:system-ui;max-width:700px;margin:60px auto;padding:20px"><h1>INCOME 2</h1><p>Account authentication failed.</p></body></html>');
  const recent=(summary.recent||[]).map(e=>`<tr><td>${htmlEscape(e.createdAt)}</td><td>${htmlEscape(e.source)}</td><td>$${Number(e.userShareUsd||0).toFixed(6)}</td><td>${htmlEscape(e.status)}</td></tr>`).join('');
  return res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>INCOME 2 balance</title></head><body style="font-family:system-ui;background:#0b0d10;color:#f5f7fa;max-width:850px;margin:40px auto;padding:20px"><h1>INCOME 2</h1><p style="color:#aab2c0">Account ${htmlEscape(summary.handle)}</p><div style="background:#151922;border:1px solid #2b3240;border-radius:16px;padding:24px"><div style="font-size:14px;color:#aab2c0">Actual settled Agent Earn balance</div><div style="font-size:44px;font-weight:800">$${Number(summary.availableBalanceUsd||0).toFixed(6)}</div><p>${Number(summary.settlementCount||0)} attributed settlement${Number(summary.settlementCount||0)===1?'':'s'} · Agent ${summary.agentEnabled?'active':'paused'}</p><p style="color:#aab2c0">Website and ChatGPT use this same canonical ledger. Cash-out remains external and is not enabled during this beta.</p></div><h2>Recent ledger</h2><table style="width:100%;border-collapse:collapse"><tr><th align="left">Time</th><th align="left">Source</th><th align="left">Your share</th><th align="left">Status</th></tr>${recent}</table></body></html>`);
}

const httpServer=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/',`https://${req.headers.host||ALLOWED_HOST}`);
    if(url.pathname==='/health'){
      const [status,seller]=await Promise.all([liveStatus().catch(()=>null),sellerHealth().catch(()=>null)]);
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
      return res.end(JSON.stringify({ok:true,service:'income2-chat-mcp',version:'0.3.0',brand:'INCOME 2',motto:'Your second income. Powered by you or your AI.',mcp:`${PUBLIC_ORIGIN}/mcp`,accountSystem:'canonical_seller_ledger',purchaseGuard:{enabled:true,beta:true,free:true,tool:'guard_x402_purchase',paymentExecution:false},outcomeRouter:{enabled:true,beta:true,free:true,tool:'request_agent_outcome',autonomousOnly:true,manualBrokerage:false,paidExternalExecution:false},status,ledger:seller?.ledger||null}));
    }
    if(url.pathname==='/manage')return await managePage(req,res,url);
    if(url.pathname!=='/mcp'){res.writeHead(404,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,message:'not found'}));}
    const host=String(req.headers.host||'').toLowerCase(); if(host&&host!==ALLOWED_HOST&&!host.startsWith('localhost:')&&!host.startsWith('127.0.0.1:')){res.writeHead(403).end('Forbidden');return;}
    const origin=String(req.headers.origin||''); if(origin&&!/^https:\/\/(chatgpt\.com|chat\.openai\.com|platform\.openai\.com)$/.test(origin)){res.writeHead(403).end('Forbidden');return;}
    await nodeHandler(req,res);
  }catch(error){console.error(error);if(!res.headersSent)res.writeHead(500,{'content-type':'application/json'});if(!res.writableEnded)res.end(JSON.stringify({ok:false,message:'internal error'}));}
});
httpServer.listen(PORT,'0.0.0.0',()=>{console.log(`INCOME 2 ChatGPT MCP listening on ${PORT}; endpoint=${PUBLIC_ORIGIN}/mcp; accountSystem=canonical_seller_ledger`);});
process.on('SIGTERM',async()=>{await handler.close().catch(()=>{});httpServer.close(()=>process.exit(0));});