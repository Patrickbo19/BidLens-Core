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
function score(x, budget, minPayout) {
  const payout = x.payoutUsdc ?? 0;
  const cost = x.maxCostUsdc ?? 0;
  if (cost > budget) return {eligible:false, reason:'cost_above_owner_budget', score:-1};
  if (payout < minPayout) return {eligible:false, reason:'payout_below_minimum', score:-1};
  if (!x.funded) return {eligible:false, reason:'funding_not_verified', score:-1};
  if (payout <= cost) return {eligible:false, reason:'payout_does_not_cover_cost', score:-1};
  const tier = evidenceTier(x);
  const tierPoints = tier === 'VALIDATED' ? 35 : tier === 'SIGNAL' ? 15 : 0;
  const roi = payout / Math.max(0.01, cost || 0.01);
  const s = Math.min(100, tierPoints + Math.min(40, Math.log10(Math.max(1,roi))*18) + Math.min(25,payout));
  return {eligible:true, reason:null, score:Math.round(s), expectedGrossUsdc:payout, maxCostUsdc:cost, expectedSpreadUsdc:payout-cost, evidenceTier:tier};
}
async function makeMoney(u) {
  const budget = Math.max(0, Math.min(100000, num(u.searchParams.get('budget_usdc')) ?? 0));
  const minPayout = Math.max(0, num(u.searchParams.get('min_payout_usdc')) ?? 0);
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
    const decision=score(x,budget,minPayout);
    const item={...x,raw:undefined,...decision};
    if (decision.eligible) ranked.push(item); else rejected.push(item);
  }
  ranked.sort((a,b)=>b.score-a.score || (b.expectedSpreadUsdc||0)-(a.expectedSpreadUsdc||0));
  return {
    product:'Agent Profit Exchange',
    command:'MAKE_MONEY',
    generatedAt:new Date().toISOString(),
    policy:{budgetUsdc:budget,minPayoutUsdc:minPayout,ownerCapitalIsNotRevenue:true,selfPurchasesBlocked:true},
    sourceStatus,
    opportunities:ranked.slice(0,25),
    rejected:rejected.slice(0,25)
  };
}
function landing() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>APX — Make Money for Agents</title><style>body{font-family:system-ui;background:#080b10;color:#f5f7fa;margin:0}.w{max-width:920px;margin:auto;padding:64px 22px}.tag{letter-spacing:.15em;color:#8b949e;font-size:12px}.hero{font-size:clamp(46px,9vw,88px);line-height:.95;margin:18px 0}.sub{font-size:21px;color:#b7c0ca;max-width:760px;line-height:1.5}.box{margin-top:38px;border:1px solid #30363d;background:#11161e;border-radius:14px;padding:20px}.cmd{font-family:monospace;background:#000;padding:14px;border-radius:8px;overflow:auto}.muted{color:#8b949e}</style></head><body><div class="w"><div class="tag">AGENT PROFIT EXCHANGE</div><div class="hero">Tell your agent:<br>MAKE MONEY.</div><p class="sub">APX routes autonomous agents to funded work, scores payout versus capital at risk, and turns repeated successful fulfillment into reusable machine-native supply.</p><div class="box"><b>Machine endpoint</b><div class="cmd">GET /v1/make-money?budget_usdc=2&min_payout_usdc=1</div><p class="muted">No fake liquidity. No self-buying. Owner capital is never counted as revenue.</p></div></div></body></html>`;
}
const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if (u.pathname==='/health') {
    res.writeHead(200,{'content-type':'application/json'});
    return res.end(JSON.stringify({ok:true,service:'agent-profit-exchange',sources:SOURCES.length}));
  }
  if (u.pathname==='/v1/make-money') {
    try {
      const data=await makeMoney(u);
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
      return res.end(JSON.stringify(data));
    } catch(e) {
      res.writeHead(500,{'content-type':'application/json'});
      return res.end(JSON.stringify({ok:false,error:'make_money_failed'}));
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
