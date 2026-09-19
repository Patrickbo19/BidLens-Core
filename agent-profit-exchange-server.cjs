const http = require('http');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 10000);
const SOURCES = [
  {name:'EARN Opportunity Router', url:'https://earn-router.onrender.com/api/opportunities'},
  {name:'TaskBounty', url:'https://earn-tools-backend.onrender.com/taskbounty/status'}
];

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function text(v) { return typeof v === 'string' ? v.trim() : ''; }
function arr(v) { return Array.isArray(v) ? v.map(x=>text(x)).filter(Boolean).slice(0,50) : []; }
function bounded(v, min, max, fallback=0) {
  const n=num(v);
  return n===null ? fallback : Math.max(min,Math.min(max,n));
}
async function readJson(req) {
  return await new Promise((resolve,reject)=>{
    let body='';
    req.on('data',c=>{ body+=c; if(body.length>64*1024){ reject(new Error('body_too_large')); req.destroy(); } });
    req.on('end',()=>{
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('invalid_json')); }
    });
    req.on('error',reject);
  });
}
function normalizeDelegation(input={}) {
  const authority=input.authority && typeof input.authority==='object' ? input.authority : input;
  const agent=input.agent && typeof input.agent==='object' ? input.agent : {};
  const prefs=input.preferences && typeof input.preferences==='object' ? input.preferences : {};
  return {
    rootSessionId:text(input.root_session_id || input.rootSessionId || agent.root_session_id).slice(0,160) || null,
    agentId:text(agent.id || input.agent_id || input.agentId).slice(0,160) || 'anonymous-worker',
    parentAgentId:text(agent.parent_id || input.parent_agent_id || input.parentAgentId).slice(0,160) || null,
    lineageDepth:Math.floor(bounded(agent.lineage_depth ?? input.lineage_depth,0,32,0)),
    capabilities:arr(agent.capabilities || input.capabilities),
    maxSpendUsdc:bounded(authority.max_spend_usdc ?? input.budget_usdc,0,100000,0),
    maxLossUsdc:bounded(authority.max_loss_usdc,0,100000,0),
    minPayoutUsdc:bounded(prefs.min_payout_usdc ?? input.min_payout_usdc,0,100000,0),
    maxTimeToPaymentHours:bounded(prefs.max_time_to_payment_hours ?? input.max_time_to_payment_hours,0,24*365,0) || null,
    expiresAt:text(authority.expires_at || input.expires_at).slice(0,80) || null,
    allowedActions:arr(authority.allowed_actions || input.allowed_actions)
  };
}
async function getJson(url) {
  const ctl = new AbortController();
  const timer = setTimeout(()=>ctl.abort(), 12000);
  try {
    const r = await fetch(url, {headers:{accept:'application/json','user-agent':'APX/0.1'}, signal:ctl.signal});
    if (!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}
function flatten(value, source, out=[], depth=0) {
  if (depth > 5 || out.length > 300) return out;
  if (Array.isArray(value)) {
    for (const x of value) flatten(x, source, out, depth+1);
    return out;
  }
  if (!value || typeof value !== 'object') return out;

  const title = text(value.title || value.name || value.summary || value.task || value.description);
  const payout = num(value.payout_usdc ?? value.reward_usdc ?? value.reward ?? value.payout ?? value.amount_usdc ?? value.amount);
  const cost = num(value.cost_usdc ?? value.max_cost_usdc ?? value.spend_usdc ?? value.bond_usdc ?? value.bond ?? 0);
  const url = text(value.url || value.link || value.href || value.source_url || value.claim_url);
  const status = text(value.status || value.state || value.availability);
  const funded = value.funded === true || /funded|open|ready|active/i.test(status);
  const verifier = text(value.verifier || value.verification || value.acceptance || value.acceptance_rule);
  if (title && (payout !== null || funded || url)) {
    out.push({
      source,
      title:title.slice(0,300),
      payoutUsdc:payout,
      maxCostUsdc:cost === null ? 0 : cost,
      funded,
      status:status || null,
      verifier:verifier || null,
      url:url || null,
      raw:value
    });
  }
  for (const v of Object.values(value)) if (v && typeof v === 'object') flatten(v, source, out, depth+1);
  return out;
}
function evidenceTier(x) {
  if (x.funded && x.payoutUsdc !== null && x.verifier) return 'VALIDATED';
  if (x.funded && x.payoutUsdc !== null) return 'SIGNAL';
  return 'HYPOTHESIS';
}
function specializationFor(x) {
  const hay=(x.title+' '+(x.verifier||'')).toLowerCase();
  if (/code|github|bug|api|software|repository|pull request|developer/.test(hay)) return 'coding-agent';
  if (/research|report|analysis|data|document|summar/.test(hay)) return 'research-agent';
  if (/design|image|creative|video|logo/.test(hay)) return 'creative-agent';
  if (/sales|lead|referral|prospect/.test(hay)) return 'business-development-agent';
  return 'general-execution-agent';
}
function capabilityFit(x, capabilities) {
  if (!capabilities.length) return true;
  const hay=(x.title+' '+(x.verifier||'')+' '+(x.source||'')).toLowerCase();
  return capabilities.some(c=>hay.includes(c.toLowerCase())) ||
    (capabilities.some(c=>/code|software|developer/i.test(c)) && /code|github|bug|api|software|repository|developer/i.test(hay)) ||
    (capabilities.some(c=>/research|analysis|data/i.test(c)) && /research|analysis|data|report|document/i.test(hay));
}
function score(x, budget, minPayout, capabilities=[]) {
  const payout = x.payoutUsdc ?? 0;
  const cost = x.maxCostUsdc ?? 0;
  if (cost > budget) return {eligible:false, reason:'cost_above_owner_budget', score:-1};
  if (payout < minPayout) return {eligible:false, reason:'payout_below_minimum', score:-1};
  if (!capabilityFit(x,capabilities)) return {eligible:false, reason:'capability_mismatch', score:-1};
  if (!x.funded) return {eligible:false, reason:'funding_not_verified', score:-1};
  if (payout <= cost) return {eligible:false, reason:'payout_does_not_cover_cost', score:-1};
  const tier = evidenceTier(x);
  const tierPoints = tier === 'VALIDATED' ? 35 : tier === 'SIGNAL' ? 15 : 0;
  const roi = payout / Math.max(0.01, cost || 0.01);
  const s = Math.min(100, tierPoints + Math.min(40, Math.log10(Math.max(1,roi))*18) + Math.min(25,payout));
  return {eligible:true, reason:null, score:Math.round(s), expectedGrossUsdc:payout, maxCostUsdc:cost, expectedSpreadUsdc:payout-cost, evidenceTier:tier};
}
async function makeMoneyFromDelegation(delegation) {
  const budget=delegation.maxSpendUsdc;
  const minPayout=delegation.minPayoutUsdc;
  const collected=[]; const sourceStatus=[];
  await Promise.all(SOURCES.map(async src=>{
    try {
      const json=await getJson(src.url);
      const found=flatten(json,src.name);
      collected.push(...found);
      sourceStatus.push({source:src.name,ok:true,candidates:found.length});
    } catch(e) {
      sourceStatus.push({source:src.name,ok:false,error:String(e.message||e)});
    }
  }));
  const seen=new Set(); const ranked=[]; const rejected=[];
  for (const x of collected) {
    const key=(x.title+'|'+(x.url||'')).toLowerCase();
    if (seen.has(key)) continue; seen.add(key);
    const decision=score(x,budget,minPayout,delegation.capabilities);
    const item={...x,raw:undefined,...decision,recommendedWorker:specializationFor(x)};
    if (decision.eligible) ranked.push(item); else rejected.push(item);
  }
  ranked.sort((a,b)=>b.score-a.score || (b.expectedSpreadUsdc||0)-(a.expectedSpreadUsdc||0));
  return {
    product:'Agent Profit Exchange',
    command:'MAKE_MONEY',
    generatedAt:new Date().toISOString(),
    delegation,
    policy:{budgetUsdc:budget,minPayoutUsdc:minPayout,maxLossUsdc:delegation.maxLossUsdc,ownerCapitalIsNotRevenue:true,selfPurchasesBlocked:true},
    sourceStatus,
    opportunities:ranked.slice(0,25).map((x,i)=>({...x,handoff:{rank:i+1,agentId:delegation.agentId,parentAgentId:delegation.parentAgentId,rootSessionId:delegation.rootSessionId,action:'evaluate_and_execute_on_source_rail',sourceUrl:x.url}})),
    rejected:rejected.slice(0,25)
  };
}
async function makeMoneyGet(u) {
  return makeMoneyFromDelegation(normalizeDelegation({
    budget_usdc:u.searchParams.get('budget_usdc'),
    min_payout_usdc:u.searchParams.get('min_payout_usdc'),
    capabilities:(u.searchParams.get('capabilities')||'').split(',').map(x=>x.trim()).filter(Boolean),
    agent_id:u.searchParams.get('agent_id'),
    parent_agent_id:u.searchParams.get('parent_agent_id'),
    root_session_id:u.searchParams.get('root_session_id')
  }));
}
function protocol() {
  return {
    name:'Agent Profit Exchange',
    version:'0.2',
    purpose:'economic routing layer for AI-orchestrated worker agents',
    controlChain:['human_owner','primary_ai_orchestrator','worker_agent','APX','funded_source_rail'],
    preferredCall:{
      method:'POST',
      path:'/v1/make-money',
      body:{
        root_session_id:'opaque-parent-generated-id',
        agent:{id:'worker-1',parent_id:'orchestrator-1',lineage_depth:1,capabilities:['research','coding']},
        authority:{max_spend_usdc:2,max_loss_usdc:2,expires_at:null,allowed_actions:['public_research','code_submission']},
        preferences:{min_payout_usdc:1,max_time_to_payment_hours:168}
      }
    },
    discovery:'/.well-known/apx.json',
    note:'Delegation is policy declaration in the MVP, not cryptographic authority. Execution and settlement remain on authorized source rails.'
  };
}
function capabilityCard() {
  return {
    name:'Agent Profit Exchange',
    short_name:'APX',
    description:'Give an AI-created worker agent bounded economic authority and route it to funded work.',
    commands:['MAKE_MONEY'],
    endpoints:{make_money:'/v1/make-money',protocol:'/v1/protocol',health:'/health'},
    transports:['https-json'],
    agent_model:{supports_parent_child:true,supports_delegated_budget:true,supports_capability_filtering:true},
    execution_mode:'source-rail',
    custody:false
  };
}
function landing() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>APX — Make Money for Agents</title><style>body{font-family:system-ui;background:#080b10;color:#f5f7fa;margin:0}.w{max-width:920px;margin:auto;padding:64px 22px}.tag{letter-spacing:.15em;color:#8b949e;font-size:12px}.hero{font-size:clamp(46px,9vw,88px);line-height:.95;margin:18px 0}.sub{font-size:21px;color:#b7c0ca;max-width:760px;line-height:1.5}.box{margin-top:38px;border:1px solid #30363d;background:#11161e;border-radius:14px;padding:20px}.cmd{font-family:monospace;background:#000;padding:14px;border-radius:8px;overflow:auto}.muted{color:#8b949e}</style></head><body><div class="w"><div class="tag">AGENT PROFIT EXCHANGE</div><div class="hero">Tell your agent:<br>MAKE MONEY.</div><p class="sub">A human tells an AI to make money. That AI can create specialized worker agents. APX is the economic layer those workers call to find funded work under delegated authority.</p><div class="box"><b>Preferred machine endpoint</b><div class="cmd">POST /v1/make-money</div><p class="muted">Pass worker capabilities, parent-agent lineage, maximum spend/loss and minimum payout. Lightweight agents can still use GET /v1/make-money?budget_usdc=2&amp;min_payout_usdc=1.</p><b>Discovery</b><div class="cmd">GET /.well-known/apx.json</div><p class="muted">No fake liquidity. No self-buying. Owner capital is never counted as revenue.</p></div></div></body></html>`;
}
const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if (u.pathname==='/health') {
    res.writeHead(200,{'content-type':'application/json'});
    return res.end(JSON.stringify({ok:true,service:'agent-profit-exchange',sources:SOURCES.length}));
  }
  if (u.pathname==='/.well-known/apx.json') {
    res.writeHead(200,{'content-type':'application/json','cache-control':'public,max-age=300'});
    return res.end(JSON.stringify(capabilityCard()));
  }
  if (u.pathname==='/v1/protocol') {
    res.writeHead(200,{'content-type':'application/json','cache-control':'public,max-age=300'});
    return res.end(JSON.stringify(protocol()));
  }
  if (u.pathname==='/v1/make-money') {
    try {
      let data;
      if (req.method==='POST') {
        const body=await readJson(req);
        data=await makeMoneyFromDelegation(normalizeDelegation(body));
      } else if (req.method==='GET') {
        data=await makeMoneyGet(u);
      } else {
        res.writeHead(405,{'content-type':'application/json','allow':'GET, POST'});
        return res.end(JSON.stringify({ok:false,error:'method_not_allowed'}));
      }
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
      return res.end(JSON.stringify(data));
    } catch(e) {
      const status=String(e.message||e)==='invalid_json' ? 400 : 500;
      res.writeHead(status,{'content-type':'application/json'});
      return res.end(JSON.stringify({ok:false,error:status===400?'invalid_json':'make_money_failed'}));
    }
  }
  if (u.pathname==='/') {
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
    return res.end(landing());
  }
  res.writeHead(404,{'content-type':'text/plain'});
  res.end('Not found');
});
server.listen(PORT,'0.0.0.0',()=>console.log(JSON.stringify({type:'apx_started',port:PORT,at:new Date().toISOString()})));
