const crypto = require('crypto');
const { Pool } = require('pg');

const AGENT402 = 'https://agent402.tools';
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
let pool = null;
let initPromise = null;
const memory = new Map();

function now() { return new Date().toISOString(); }
function sha(v) { return crypto.createHash('sha256').update(String(v)).digest('hex'); }
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
function newId() { return `outcome_${crypto.randomBytes(16).toString('hex')}`; }
function category(task) {
  const t = String(task || '').toLowerCase();
  if (/\b(pdf|web|url|website|page|article|crawl|scrap|html)\b/.test(t)) return 'web_research';
  if (/\b(json|csv|xml|yaml|data|transform|convert|parse|format)\b/.test(t)) return 'data';
  if (/\b(code|python|javascript|typescript|debug|test|regex|sql)\b/.test(t)) return 'code';
  if (/\b(security|risk|audit|prompt injection|malware|vulnerab)\b/.test(t)) return 'security';
  if (/\b(crypto|token|wallet|market|price|finance|stock|yield)\b/.test(t)) return 'finance';
  if (/\b(image|video|audio|ocr|media)\b/.test(t)) return 'media';
  if (/\b(research|summar|report|compare|find|search)\b/.test(t)) return 'research';
  return 'general';
}
function looksSensitive(task, params) {
  return /\b(seed phrase|mnemonic|private key|api[_ -]?key|access token|password|recovery token|secret key)\b/i.test(`${task}\n${canonical(params || {})}`);
}

async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!DATABASE_URL) return { persistent:false, configured:false };
    pool = new Pool({ connectionString:DATABASE_URL, ssl:DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized:false }, max:3, idleTimeoutMillis:10000, connectionTimeoutMillis:8000 });
    await pool.query(`CREATE TABLE IF NOT EXISTS earn_outcome_requests (
      request_id TEXT PRIMARY KEY,
      key_hash TEXT UNIQUE NOT NULL,
      fingerprint TEXT NOT NULL,
      task_hash TEXT NOT NULL,
      category TEXT NOT NULL,
      max_budget_usd NUMERIC NOT NULL,
      status TEXT NOT NULL,
      route_provider TEXT,
      route_slug TEXT,
      route_url TEXT,
      quoted_price_usd NUMERIC,
      execution_mode TEXT,
      result_digest TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    return { persistent:true, configured:true };
  })().catch(error => {
    console.error(JSON.stringify({ type:'outcome_router_init_error', error:String(error?.message || error).slice(0,300), at:now() }));
    pool = null;
    return { persistent:false, configured:Boolean(DATABASE_URL), error:String(error?.message || error).slice(0,200) };
  });
  return initPromise;
}

function publicRow(r) {
  if (!r) return null;
  return {
    requestId:r.request_id || r.requestId,
    category:r.category,
    maxBudgetUsd:Number(r.max_budget_usd ?? r.maxBudgetUsd ?? 0),
    status:r.status,
    routeProvider:r.route_provider ?? r.routeProvider ?? null,
    routeSlug:r.route_slug ?? r.routeSlug ?? null,
    routeUrl:r.route_url ?? r.routeUrl ?? null,
    quotedPriceUsd:(r.quoted_price_usd == null && r.quotedPriceUsd == null) ? null : Number(r.quoted_price_usd ?? r.quotedPriceUsd),
    executionMode:r.execution_mode ?? r.executionMode ?? null,
    resultDigest:r.result_digest ?? r.resultDigest ?? null,
    createdAt:r.created_at ? new Date(r.created_at).toISOString() : (r.createdAt || null),
    updatedAt:r.updated_at ? new Date(r.updated_at).toISOString() : (r.updatedAt || null),
    rawTaskRetained:false,
    rawParamsRetained:false,
  };
}
async function byKey(keyHash) {
  await init();
  if (pool) return (await pool.query('SELECT * FROM earn_outcome_requests WHERE key_hash=$1 LIMIT 1',[keyHash])).rows[0] || null;
  return memory.get(`key:${keyHash}`) || null;
}
async function byId(id) {
  await init();
  if (pool) return (await pool.query('SELECT * FROM earn_outcome_requests WHERE request_id=$1 LIMIT 1',[id])).rows[0] || null;
  return memory.get(`id:${id}`) || null;
}
async function insert(row) {
  await init();
  if (pool) {
    await pool.query('INSERT INTO earn_outcome_requests (request_id,key_hash,fingerprint,task_hash,category,max_budget_usd,status) VALUES ($1,$2,$3,$4,$5,$6,$7)',[row.requestId,row.keyHash,row.fingerprint,row.taskHash,row.category,row.maxBudgetUsd,row.status]);
    return;
  }
  const m={ request_id:row.requestId,key_hash:row.keyHash,fingerprint:row.fingerprint,task_hash:row.taskHash,category:row.category,max_budget_usd:row.maxBudgetUsd,status:row.status,createdAt:now(),updatedAt:now() };
  memory.set(`key:${row.keyHash}`,m); memory.set(`id:${row.requestId}`,m);
}
async function update(id,p={}) {
  const n={ status:p.status || 'unknown',routeProvider:p.routeProvider || null,routeSlug:p.routeSlug || null,routeUrl:p.routeUrl || null,quotedPriceUsd:Number.isFinite(Number(p.quotedPriceUsd)) ? Number(p.quotedPriceUsd) : null,executionMode:p.executionMode || null,resultDigest:p.resultDigest || null };
  await init();
  if (pool) {
    await pool.query('UPDATE earn_outcome_requests SET status=$2,route_provider=$3,route_slug=$4,route_url=$5,quoted_price_usd=$6,execution_mode=$7,result_digest=$8,updated_at=NOW() WHERE request_id=$1',[id,n.status,n.routeProvider,n.routeSlug,n.routeUrl,n.quotedPriceUsd,n.executionMode,n.resultDigest]);
    return;
  }
  const r=memory.get(`id:${id}`); if(!r)return; Object.assign(r,{status:n.status,route_provider:n.routeProvider,route_slug:n.routeSlug,route_url:n.routeUrl,quoted_price_usd:n.quotedPriceUsd,execution_mode:n.executionMode,result_digest:n.resultDigest,updatedAt:now()});
}

async function fetchJson(url,options={},timeoutMs=12000) {
  const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),timeoutMs);
  try {
    const r=await fetch(url,{...options,signal:ctl.signal,headers:{accept:'application/json',...(options.headers||{})}});
    const text=await r.text(); let data; try{data=JSON.parse(text)}catch{data={raw:text.slice(0,1000)}};
    return {ok:r.ok,status:r.status,data};
  } finally { clearTimeout(timer); }
}
function objects(v,out=[],depth=0) {
  if(depth>6||v==null)return out;
  if(Array.isArray(v)){for(const x of v.slice(0,30))objects(x,out,depth+1);return out;}
  if(typeof v==='object'){out.push(v);for(const x of Object.values(v))objects(x,out,depth+1);} return out;
}
function num(v){ if(typeof v==='number'&&Number.isFinite(v))return v; if(typeof v==='string'){const m=v.match(/\$?\s*(\d+(?:\.\d+)?)/);if(m)return Number(m[1]);} return null; }
function candidate(data) {
  const ranked=objects(data).map(o=>{
    const slug=String(o.slug||o.toolSlug||o.tool_slug||'').trim();
    const route=String(o.route||o.path||o.endpoint||o.url||'').trim();
    const price=num(o.priceUsd??o.price_usd??o.underlyingPriceUsd??o.paidUsd??o.price??o.cost);
    let score=0;if(slug)score+=5;if(route)score+=4;if(/\/api\/|https?:\/\//i.test(route))score+=2;if(price!=null)score+=2;if(o.inputSchema||o.input_schema||o.example||o.params)score++;
    return {slug,route,price,score};
  }).filter(x=>x.score>=5).sort((a,b)=>b.score-a.score);
  if(!ranked.length)return null; return {slug:ranked[0].slug||null,route:ranked[0].route||null,priceUsd:ranked[0].price};
}
function target(route) {
  const r=String(route||'').trim(); if(!r)return null;
  if(/^https:\/\//i.test(r))return {method:'POST',url:r};
  const m=r.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)$/i); if(m)return {method:m[1].toUpperCase(),url:new URL(m[2],AGENT402).toString()};
  if(r.startsWith('/'))return {method:'POST',url:new URL(r,AGENT402).toString()}; return null;
}
function leadingZeroBits(buf){let n=0;for(const b of buf){if(b===0){n+=8;continue;}n+=Math.clz32(b)-24;break;}return n;}
function solvePow(challenge,difficulty){const start=Date.now();for(let nonce=0;nonce<2500000&&Date.now()-start<3500;nonce++){if(leadingZeroBits(crypto.createHash('sha256').update(`${challenge}:${nonce}`).digest())>=difficulty)return nonce;}return null;}
async function findRoute(task) {
  const q=encodeURIComponent(task);
  const route=await fetchJson(`${AGENT402}/api/route?q=${q}&include=external`,{},12000).catch(()=>null);
  const c1=route?.ok?candidate(route.data):null; if(c1)return {source:'agent402_route',candidate:c1};
  const find=await fetchJson(`${AGENT402}/api/find?q=${q}`,{},12000).catch(()=>null);
  return {source:'agent402_find',candidate:find?.ok?candidate(find.data):null};
}
async function tryFree(c,params,key) {
  if(!c?.slug||!c?.route||!params||typeof params!=='object'||Array.isArray(params))return {attempted:false};
  const ch=await fetchJson(`${AGENT402}/api/pow/challenge?slug=${encodeURIComponent(c.slug)}`,{},8000).catch(()=>null);
  const x=ch?.data||{},token=String(x.token||'').trim(),puzzle=String(x.challenge||'').trim(),difficulty=Number(x.difficulty);
  if(!ch?.ok||!token||!puzzle||!Number.isFinite(difficulty)||difficulty<1||difficulty>28)return {attempted:false};
  const nonce=solvePow(puzzle,difficulty); if(nonce==null)return {attempted:true,fulfilled:false,reason:'pow_budget_exceeded'};
  const t=target(c.route); if(!t||!t.url.startsWith(AGENT402))return {attempted:false};
  const opts={method:t.method,headers:{'content-type':'application/json','x-pow-solution':`${token}:${nonce}`,'idempotency-key':String(key).slice(0,200)}};
  if(t.method!=='GET')opts.body=JSON.stringify(params);
  const r=await fetchJson(t.url,opts,20000).catch(error=>({ok:false,status:null,data:{message:String(error?.message||error).slice(0,300)}}));
  if(!r.ok)return {attempted:true,fulfilled:false,reason:`provider_http_${r.status||'error'}`};
  return {attempted:true,fulfilled:true,result:r.data,resultDigest:sha(canonical(r.data))};
}

async function create(input={}) {
  const task=String(input.task||'').trim();
  const maxBudgetUsd=Number(input.max_budget_usd??input.maxBudgetUsd??0);
  const key=String(input.idempotency_key||input.idempotencyKey||'').trim();
  const params=(input.params&&typeof input.params==='object'&&!Array.isArray(input.params))?input.params:{};
  const allowExternal=input.allow_external_discovery!==false&&input.allowExternalDiscovery!==false;
  const executeIfFree=input.execute_if_free!==false&&input.executeIfFree!==false;
  if(task.length<3||task.length>2000)throw Object.assign(new Error('task must be 3-2000 characters'),{code:'INVALID_INPUT'});
  if(!Number.isFinite(maxBudgetUsd)||maxBudgetUsd<0||maxBudgetUsd>100000)throw Object.assign(new Error('max_budget_usd must be between 0 and 100000'),{code:'INVALID_INPUT'});
  if(key.length<8||key.length>200)throw Object.assign(new Error('idempotency_key must be 8-200 characters'),{code:'INVALID_INPUT'});

  const keyHash=sha(key),fingerprint=sha(canonical({task,maxBudgetUsd,params,allowExternal,executeIfFree}));
  const old=await byKey(keyHash);
  if(old){if(old.fingerprint!==fingerprint)throw Object.assign(new Error('idempotency key reused with different request parameters'),{code:'IDEMPOTENCY_CONFLICT'});return {ok:true,reused:true,...publicRow(old),autonomous:true,manualBrokerage:false,ownerFundsSpentUsd:0,result:null,note:old.status==='fulfilled_free_compute'?'Already fulfilled; result bodies are not retained after delivery for privacy.':'Existing request returned without creating a duplicate.'};}

  const id=newId(),base={requestId:id,keyHash,fingerprint,taskHash:sha(task),category:category(task),maxBudgetUsd,status:'routing'}; await insert(base);
  if(!allowExternal){const p={status:'unmatched_external_disabled',executionMode:'none'};await update(id,p);return {ok:true,reused:false,...publicRow({...base,...p}),autonomous:true,manualBrokerage:false,ownerFundsSpentUsd:0,result:null};}
  if(looksSensitive(task,params)){const p={status:'blocked_sensitive_external_input',executionMode:'none'};await update(id,p);return {ok:true,reused:false,...publicRow({...base,...p}),autonomous:true,manualBrokerage:false,ownerFundsSpentUsd:0,result:null,note:'Potential credential/secret material detected, so nothing was sent to an external router.'};}

  const q=await findRoute(task).catch(()=>({candidate:null})),c=q.candidate;
  if(!c){const p={status:'unmatched',routeProvider:'agent402',executionMode:'none'};await update(id,p);return {ok:true,reused:false,...publicRow({...base,...p}),autonomous:true,manualBrokerage:false,ownerFundsSpentUsd:0,result:null};}
  const quoted=Number.isFinite(Number(c.priceUsd))?Number(c.priceUsd):null;

  if(executeIfFree){const free=await tryFree(c,params,key);if(free.fulfilled){const p={status:'fulfilled_free_compute',routeProvider:'agent402',routeSlug:c.slug,routeUrl:c.route,quotedPriceUsd:0,executionMode:'proof_of_work',resultDigest:free.resultDigest};await update(id,p);return {ok:true,reused:false,...publicRow({...base,...p}),autonomous:true,manualBrokerage:false,ownerFundsSpentUsd:0,upstreamSpendUsd:0,result:free.result,provenance:{provider:'Agent402',slug:c.slug,route:c.route,untrustedExternalOutput:true}};}}

  const within=quoted==null?null:quoted<=maxBudgetUsd;
  const p={status:within===false?'quote_over_budget':'routable_requires_buyer_funding',routeProvider:'agent402',routeSlug:c.slug,routeUrl:c.route,quotedPriceUsd:quoted,executionMode:'not_executed_no_delegated_buyer_funds'}; await update(id,p);
  return {ok:true,reused:false,...publicRow({...base,...p}),autonomous:true,manualBrokerage:false,ownerFundsSpentUsd:0,result:null,withinBudget:within,fundingState:within===false?'over_budget':'buyer_delegation_required',note:'Paid external execution is deliberately blocked until a safe buyer-funded/delegated payment rail exists. Owner working capital and buyer private keys are not used.'};
}

async function status(){const db=await init();return {ok:true,name:'INCOME 2 Outcome Router',internalCodename:'HYDRA',beta:true,autonomousOnly:true,manualBrokerage:false,upstreams:['Agent402'],canExecuteNow:['Agent402 proof-of-work eligible tools when valid params are supplied'],paidExternalExecution:false,paidExternalExecutionBlocker:'safe buyer-funded/delegated payment rail not enabled',ownerWorkingCapitalUsedForBuyerJobs:false,privacy:{rawTaskRetained:false,rawParamsRetained:false,externalRoutingSharesTaskWhenEnabled:true,credentialLikeInputsBlockedFromExternalRouting:true},persistence:db};}
async function get(id){return publicRow(await byId(String(id||'').trim()));}

module.exports={init,status,create,get};
