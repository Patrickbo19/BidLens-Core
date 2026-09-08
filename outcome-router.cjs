const crypto = require('crypto');
const { Pool } = require('pg');

const AGENT402 = 'https://agent402.tools';
const BASE = 'eip155:8453';
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase();
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
let pool = null;
let initPromise = null;
const memory = new Map();

function now(){return new Date().toISOString();}
function sha(v){return crypto.createHash('sha256').update(String(v)).digest('hex');}
function canonical(v){
  if(Array.isArray(v)) return '['+v.map(canonical).join(',')+']';
  if(v&&typeof v==='object') return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
function newId(){return `outcome_${crypto.randomBytes(16).toString('hex')}`;}
function category(task){
  const t=String(task||'').toLowerCase();
  if(/\b(pdf|web|url|website|page|article|crawl|scrap|html)\b/.test(t))return'web_research';
  if(/\b(json|csv|xml|yaml|data|transform|convert|parse|format)\b/.test(t))return'data';
  if(/\b(code|python|javascript|typescript|debug|test|regex|sql)\b/.test(t))return'code';
  if(/\b(security|risk|audit|prompt injection|malware|vulnerab)\b/.test(t))return'security';
  if(/\b(crypto|token|wallet|market|price|finance|stock|yield)\b/.test(t))return'finance';
  if(/\b(image|video|audio|ocr|media)\b/.test(t))return'media';
  if(/\b(research|summar|report|compare|find|search)\b/.test(t))return'research';
  return'general';
}
function looksSensitive(task,params){return /\b(seed phrase|mnemonic|private key|api[_ -]?key|access token|password|recovery token|secret key)\b/i.test(`${task}\n${canonical(params||{})}`);}
function normalize(input={}){
  const task=String(input.task||'').trim();
  const maxBudgetUsd=Number(input.max_budget_usd??input.maxBudgetUsd??0);
  const key=String(input.idempotency_key||input.idempotencyKey||'').trim();
  const params=(input.params&&typeof input.params==='object'&&!Array.isArray(input.params))?input.params:{};
  const allowExternal=input.allow_external_discovery!==false&&input.allowExternalDiscovery!==false;
  const executeIfFree=input.execute_if_free!==false&&input.executeIfFree!==false;
  if(task.length<3||task.length>2000)throw Object.assign(new Error('task must be 3-2000 characters'),{code:'INVALID_INPUT'});
  if(!Number.isFinite(maxBudgetUsd)||maxBudgetUsd<0||maxBudgetUsd>100000)throw Object.assign(new Error('max_budget_usd must be between 0 and 100000'),{code:'INVALID_INPUT'});
  if(key.length<8||key.length>200)throw Object.assign(new Error('idempotency_key must be 8-200 characters'),{code:'INVALID_INPUT'});
  return {task,maxBudgetUsd,key,params,allowExternal,executeIfFree,fingerprint:sha(canonical({task,maxBudgetUsd,params,allowExternal,executeIfFree}))};
}

async function init(){
  if(initPromise)return initPromise;
  initPromise=(async()=>{
    if(!DATABASE_URL)return{persistent:false,configured:false};
    pool=new Pool({connectionString:DATABASE_URL,ssl:DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false},max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:8000});
    await pool.query(`CREATE TABLE IF NOT EXISTS earn_outcome_requests (
      request_id TEXT PRIMARY KEY,key_hash TEXT UNIQUE NOT NULL,fingerprint TEXT NOT NULL,task_hash TEXT NOT NULL,category TEXT NOT NULL,max_budget_usd NUMERIC NOT NULL,status TEXT NOT NULL,route_provider TEXT,route_slug TEXT,route_url TEXT,quoted_price_usd NUMERIC,execution_mode TEXT,result_digest TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    return{persistent:true,configured:true};
  })().catch(error=>{console.error(JSON.stringify({type:'outcome_router_init_error',error:String(error?.message||error).slice(0,300),at:now()}));pool=null;return{persistent:false,configured:Boolean(DATABASE_URL),error:String(error?.message||error).slice(0,200)};});
  return initPromise;
}
function publicRow(r){if(!r)return null;return{requestId:r.request_id||r.requestId,category:r.category,maxBudgetUsd:Number(r.max_budget_usd??r.maxBudgetUsd??0),status:r.status,routeProvider:r.route_provider??r.routeProvider??null,routeSlug:r.route_slug??r.routeSlug??null,routeUrl:r.route_url??r.routeUrl??null,quotedPriceUsd:(r.quoted_price_usd==null&&r.quotedPriceUsd==null)?null:Number(r.quoted_price_usd??r.quotedPriceUsd),executionMode:r.execution_mode??r.executionMode??null,resultDigest:r.result_digest??r.resultDigest??null,createdAt:r.created_at?new Date(r.created_at).toISOString():(r.createdAt||null),updatedAt:r.updated_at?new Date(r.updated_at).toISOString():(r.updatedAt||null),rawTaskRetained:false,rawParamsRetained:false,paymentSignatureRetained:false};}
async function byKey(h){await init();if(pool)return(await pool.query('SELECT * FROM earn_outcome_requests WHERE key_hash=$1 LIMIT 1',[h])).rows[0]||null;return memory.get(`key:${h}`)||null;}
async function byId(id){await init();if(pool)return(await pool.query('SELECT * FROM earn_outcome_requests WHERE request_id=$1 LIMIT 1',[id])).rows[0]||null;return memory.get(`id:${id}`)||null;}
async function insert(row){await init();if(pool){await pool.query('INSERT INTO earn_outcome_requests (request_id,key_hash,fingerprint,task_hash,category,max_budget_usd,status) VALUES ($1,$2,$3,$4,$5,$6,$7)',[row.requestId,row.keyHash,row.fingerprint,row.taskHash,row.category,row.maxBudgetUsd,row.status]);return;}const m={request_id:row.requestId,key_hash:row.keyHash,fingerprint:row.fingerprint,task_hash:row.taskHash,category:row.category,max_budget_usd:row.maxBudgetUsd,status:row.status,createdAt:now(),updatedAt:now()};memory.set(`key:${row.keyHash}`,m);memory.set(`id:${row.requestId}`,m);}
async function update(id,p={}){const n={status:p.status||'unknown',routeProvider:p.routeProvider||null,routeSlug:p.routeSlug||null,routeUrl:p.routeUrl||null,quotedPriceUsd:Number.isFinite(Number(p.quotedPriceUsd))?Number(p.quotedPriceUsd):null,executionMode:p.executionMode||null,resultDigest:p.resultDigest||null};await init();if(pool){await pool.query('UPDATE earn_outcome_requests SET status=$2,route_provider=$3,route_slug=$4,route_url=$5,quoted_price_usd=$6,execution_mode=$7,result_digest=$8,updated_at=NOW() WHERE request_id=$1',[id,n.status,n.routeProvider,n.routeSlug,n.routeUrl,n.quotedPriceUsd,n.executionMode,n.resultDigest]);return;}const r=memory.get(`id:${id}`);if(!r)return;Object.assign(r,{status:n.status,route_provider:n.routeProvider,route_slug:n.routeSlug,route_url:n.routeUrl,quoted_price_usd:n.quotedPriceUsd,execution_mode:n.executionMode,result_digest:n.resultDigest,updatedAt:now()});}

async function fetchJson(url,options={},timeoutMs=12000){
  const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),timeoutMs);
  try{
    const r=await fetch(url,{...options,signal:ctl.signal,headers:{accept:'application/json',...(options.headers||{})}});
    const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={raw:text.slice(0,4000)}};
    return{ok:r.ok,status:r.status,data,paymentRequired:r.headers.get('payment-required'),paymentResponse:r.headers.get('payment-response'),contentType:r.headers.get('content-type')};
  }finally{clearTimeout(timer);}
}
function objects(v,out=[],depth=0){if(depth>6||v==null)return out;if(Array.isArray(v)){for(const x of v.slice(0,30))objects(x,out,depth+1);return out;}if(typeof v==='object'){out.push(v);for(const x of Object.values(v))objects(x,out,depth+1);}return out;}
function num(v){if(typeof v==='number'&&Number.isFinite(v))return v;if(typeof v==='string'){const m=v.match(/\$?\s*(\d+(?:\.\d+)?)/);if(m)return Number(m[1]);}return null;}
function candidate(data){const ranked=objects(data).map(o=>{const slug=String(o.slug||o.toolSlug||o.tool_slug||'').trim();const route=String(o.route||o.path||o.endpoint||o.url||'').trim();const price=num(o.priceUsd??o.price_usd??o.underlyingPriceUsd??o.paidUsd??o.price??o.cost);let score=0;if(slug)score+=5;if(route)score+=4;if(/\/api\/|https?:\/\//i.test(route))score+=2;if(price!=null)score+=2;if(o.inputSchema||o.input_schema||o.example||o.params)score++;return{slug,route,price,score};}).filter(x=>x.score>=5).sort((a,b)=>b.score-a.score);if(!ranked.length)return null;return{slug:ranked[0].slug||null,route:ranked[0].route||null,priceUsd:ranked[0].price};}
function target(route){const r=String(route||'').trim();if(!r)return null;if(/^https:\/\//i.test(r)){try{const u=new URL(r);if(u.hostname!=='agent402.tools')return null;return{method:'POST',url:u.toString()};}catch{return null;}}const m=r.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)$/i);if(m){const u=new URL(m[2],AGENT402);if(u.hostname!=='agent402.tools')return null;return{method:m[1].toUpperCase(),url:u.toString()};}if(r.startsWith('/'))return{method:'POST',url:new URL(r,AGENT402).toString()};return null;}
function requestOptions(t,params,headers={}){const h={'content-type':'application/json',...headers};if(t.method==='GET'){const u=new URL(t.url);for(const[k,v]of Object.entries(params||{})){if(v==null)continue;u.searchParams.set(k,typeof v==='object'?JSON.stringify(v):String(v));}return{url:u.toString(),options:{method:'GET',headers:h}};}return{url:t.url,options:{method:t.method,headers:h,body:JSON.stringify(params||{})}};}
function leadingZeroBits(buf){let n=0;for(const b of buf){if(b===0){n+=8;continue;}n+=Math.clz32(b)-24;break;}return n;}
function solvePow(challenge,difficulty){const start=Date.now();for(let nonce=0;nonce<2500000&&Date.now()-start<3500;nonce++){if(leadingZeroBits(crypto.createHash('sha256').update(`${challenge}:${nonce}`).digest())>=difficulty)return nonce;}return null;}
async function findRoute(task){const q=encodeURIComponent(task);const route=await fetchJson(`${AGENT402}/api/route?q=${q}&include=external`,{},12000).catch(()=>null);const c1=route?.ok?candidate(route.data):null;if(c1)return{source:'agent402_route',candidate:c1};const find=await fetchJson(`${AGENT402}/api/find?q=${q}`,{},12000).catch(()=>null);return{source:'agent402_find',candidate:find?.ok?candidate(find.data):null};}
async function tryFree(c,params,key){if(!c?.slug||!c?.route)return{attempted:false};const ch=await fetchJson(`${AGENT402}/api/pow/challenge?slug=${encodeURIComponent(c.slug)}`,{},8000).catch(()=>null);const x=ch?.data||{},token=String(x.token||'').trim(),puzzle=String(x.challenge||'').trim(),difficulty=Number(x.difficulty);if(!ch?.ok||!token||!puzzle||!Number.isFinite(difficulty)||difficulty<1||difficulty>28)return{attempted:false};const nonce=solvePow(puzzle,difficulty);if(nonce==null)return{attempted:true,fulfilled:false,reason:'pow_budget_exceeded'};const t=target(c.route);if(!t)return{attempted:false};const built=requestOptions(t,params,{'x-pow-solution':`${token}:${nonce}`,'idempotency-key':String(key).slice(0,200)});const r=await fetchJson(built.url,built.options,20000).catch(error=>({ok:false,status:null,data:{message:String(error?.message||error).slice(0,300)}}));if(!r.ok)return{attempted:true,fulfilled:false,reason:`provider_http_${r.status||'error'}`};return{attempted:true,fulfilled:true,result:r.data,resultDigest:sha(canonical(r.data))};}
function decodePaymentRequired(header){if(!header)return null;try{const x=JSON.parse(Buffer.from(String(header),'base64').toString('utf8'));return x&&x.x402Version===2&&Array.isArray(x.accepts)?x:null;}catch{return null;}}
function selectBaseUsdc(challenge){const rows=(challenge?.accepts||[]).filter(x=>String(x.network||'')===BASE&&String(x.asset||'').toLowerCase()===BASE_USDC&&String(x.scheme||'').toLowerCase()==='exact').map(x=>{const atomic=Number(x.amount||x.maxAmountRequired||0);return{requirements:x,amountUsd:Number.isFinite(atomic)&&atomic>0?atomic/1e6:null};}).filter(x=>x.amountUsd!=null).sort((a,b)=>a.amountUsd-b.amountUsd);return rows[0]||null;}
async function probePaid(routeUrl,params,key){const t=target(routeUrl);if(!t)return{ok:false,reason:'unsupported_route'};const built=requestOptions(t,params,{'idempotency-key':String(key).slice(0,200)});const r=await fetchJson(built.url,built.options,20000).catch(error=>({ok:false,status:null,data:{message:String(error?.message||error).slice(0,300)}}));if(r.status!==402)return{ok:false,reason:r.ok?'provider_did_not_require_payment':`provider_http_${r.status||'error'}`,providerResponse:r};const challenge=decodePaymentRequired(r.paymentRequired);const selected=selectBaseUsdc(challenge);if(!challenge||!selected)return{ok:false,reason:'unsupported_or_unparseable_x402_challenge',providerResponse:r};return{ok:true,challenge,paymentRequired:r.paymentRequired,amountUsd:selected.amountUsd,requirements:selected.requirements,target:t};}

async function create(input={}){
  const n=normalize(input);const keyHash=sha(n.key);const old=await byKey(keyHash);
  if(old){if(old.fingerprint!==n.fingerprint)throw Object.assign(new Error('idempotency key reused with different request parameters'),{code:'IDEMPOTENCY_CONFLICT'});return{ok:true,reused:true,...publicRow(old),autonomous:true,manualBrokerage:false,ownerFundsSpentUsd:0,result:null,executionUrl:(old.route_url&&['payment_signature_required','paid_execution_ready','payment_retry_required'].includes(old.status))?`/outcome-router/execute/${old.request_id}`:null,note:old.status==='fulfilled_free_compute'?'Already fulfilled; result bodies are not retained after delivery for privacy.':'Existing request returned without creating a duplicate.'};}
  const id=newId(),base={requestId:id,keyHash,fingerprint:n.fingerprint,taskHash:sha(n.task),category:category(n.task),maxBudgetUsd:n.maxBudgetUsd,status:'routing'};await insert(base);
  if(!n.allowExternal){const p={status:'unmatched_external_disabled',executionMode:'none'};await update(id,p);return{ok:true,reused:false,...publicRow({...base,...p}),autonomous:true,manualBrokerage:false,ownerFundsSpentUsd:0,result:null};}
  if(looksSensitive(n.task,n.params)){const p={status:'blocked_sensitive_external_input',executionMode:'none'};await update(id,p);return{ok:true,reused:false,...publicRow({...base,...p}),autonomous:true,manualBrokerage:false,ownerFundsSpentUsd:0,result:null,note:'Potential credential/secret material detected, so nothing was sent to an external router.'};}
  const q=await findRoute(n.task).catch(()=>({candidate:null})),c=q.candidate;
  if(!c){const p={status:'unmatched',routeProvider:'agent402',executionMode:'none'};await update(id,p);return{ok:true,reused:false,...publicRow({...base,...p}),autonomous:true,manualBrokerage:false,ownerFundsSpentUsd:0,result:null};}
  if(n.executeIfFree){const free=await tryFree(c,n.params,n.key);if(free.fulfilled){const p={status:'fulfilled_free_compute',routeProvider:'agent402',routeSlug:c.slug,routeUrl:c.route,quotedPriceUsd:0,executionMode:'proof_of_work',resultDigest:free.resultDigest};await update(id,p);return{ok:true,reused:false,...publicRow({...base,...p}),autonomous:true,manualBrokerage:false,ownerFundsSpentUsd:0,upstreamSpendUsd:0,result:free.result,provenance:{provider:'Agent402',slug:c.slug,route:c.route,untrustedExternalOutput:true}};}}
  const paid=await probePaid(c.route,n.params,n.key);
  if(paid.ok){const within=paid.amountUsd<=n.maxBudgetUsd;if(!within){const p={status:'quote_over_budget',routeProvider:'agent402',routeSlug:c.slug,routeUrl:c.route,quotedPriceUsd:paid.amountUsd,executionMode:'none'};await update(id,p);return{ok:true,reused:false,...publicRow({...base,...p}),autonomous:true,manualBrokerage:false,ownerFundsSpentUsd:0,result:null,withinBudget:false};}const p={status:'payment_signature_required',routeProvider:'agent402',routeSlug:c.slug,routeUrl:c.route,quotedPriceUsd:paid.amountUsd,executionMode:'buyer_signed_x402_passthrough'};await update(id,p);return{ok:true,reused:false,...publicRow({...base,...p}),autonomous:true,manualBrokerage:false,ownerFundsSpentUsd:0,result:null,withinBudget:true,fundingState:'buyer_wallet',execution:{url:`/outcome-router/execute/${id}`,method:'POST',body:{task:n.task,max_budget_usd:n.maxBudgetUsd,idempotency_key:n.key,params:n.params,allow_external_discovery:n.allowExternal,execute_if_free:n.executeIfFree},protocol:'x402',buyerSignsLocally:true,privateKeyRequiredByHydra:false,note:'Call this execution URL with an x402-capable buyer wallet. The first call returns the selected supplier payment challenge; the wallet signs locally and retries automatically.'}};}
  const quoted=Number.isFinite(Number(c.priceUsd))?Number(c.priceUsd):null;const within=quoted==null?null:quoted<=n.maxBudgetUsd;const p={status:within===false?'quote_over_budget':'route_not_x402_passthrough_ready',routeProvider:'agent402',routeSlug:c.slug,routeUrl:c.route,quotedPriceUsd:quoted,executionMode:'none'};await update(id,p);return{ok:true,reused:false,...publicRow({...base,...p}),autonomous:true,manualBrokerage:false,ownerFundsSpentUsd:0,result:null,withinBudget:within,note:`Route found but could not produce a supported Base-USDC x402 challenge (${paid.reason}).`};
}

async function execute(requestId,input={},paymentSignature=''){
  const id=String(requestId||'').trim();const row=await byId(id);if(!row)throw Object.assign(new Error('outcome request not found'),{code:'NOT_FOUND'});const n=normalize(input);if(sha(n.key)!==row.key_hash||n.fingerprint!==row.fingerprint)throw Object.assign(new Error('execution parameters do not match the routed request'),{code:'IDEMPOTENCY_CONFLICT'});if(looksSensitive(n.task,n.params))throw Object.assign(new Error('credential-like input blocked from external execution'),{code:'INVALID_INPUT'});if(!row.route_url)throw Object.assign(new Error('outcome request has no executable route'),{code:'NOT_READY'});
  const probe=await probePaid(row.route_url,n.params,n.key);if(!probe.ok)throw Object.assign(new Error(`supplier payment challenge unavailable: ${probe.reason}`),{code:'NOT_READY'});if(probe.amountUsd>n.maxBudgetUsd){await update(id,{status:'quote_over_budget',routeProvider:row.route_provider,routeSlug:row.route_slug,routeUrl:row.route_url,quotedPriceUsd:probe.amountUsd,executionMode:'none'});throw Object.assign(new Error('supplier quote now exceeds max budget'),{code:'OVER_BUDGET'});}
  if(!paymentSignature){await update(id,{status:'payment_signature_required',routeProvider:row.route_provider,routeSlug:row.route_slug,routeUrl:row.route_url,quotedPriceUsd:probe.amountUsd,executionMode:'buyer_signed_x402_passthrough'});return{paymentRequired:true,httpStatus:402,paymentRequiredHeader:probe.paymentRequired,challenge:probe.challenge,amountUsd:probe.amountUsd,requestId:id};}
  const t=target(row.route_url);const built=requestOptions(t,n.params,{'idempotency-key':n.key.slice(0,200),'payment-signature':String(paymentSignature)});const r=await fetchJson(built.url,built.options,45000).catch(error=>({ok:false,status:null,data:{message:String(error?.message||error).slice(0,500)}}));
  if(r.status===402){const ch=decodePaymentRequired(r.paymentRequired);await update(id,{status:'payment_retry_required',routeProvider:row.route_provider,routeSlug:row.route_slug,routeUrl:row.route_url,quotedPriceUsd:probe.amountUsd,executionMode:'buyer_signed_x402_passthrough'});return{paymentRequired:true,httpStatus:402,paymentRequiredHeader:r.paymentRequired||probe.paymentRequired,challenge:ch||probe.challenge,amountUsd:probe.amountUsd,requestId:id,error:'supplier rejected or could not verify the payment proof'};}
  const digest=sha(canonical(r.data));if(r.ok){await update(id,{status:'fulfilled_paid_direct',routeProvider:row.route_provider,routeSlug:row.route_slug,routeUrl:row.route_url,quotedPriceUsd:probe.amountUsd,executionMode:'buyer_signed_x402_passthrough',resultDigest:digest});return{ok:true,httpStatus:r.status,...publicRow({...row,status:'fulfilled_paid_direct',quoted_price_usd:probe.amountUsd,execution_mode:'buyer_signed_x402_passthrough',result_digest:digest}),autonomous:true,manualBrokerage:false,ownerFundsSpentUsd:0,buyerPaidSupplierDirectly:true,platformFeeUsd:0,beta:true,result:r.data,paymentResponse:r.paymentResponse||null,provenance:{provider:'Agent402',slug:row.route_slug,route:row.route_url,untrustedExternalOutput:true}};}
  const settled=Boolean(r.paymentResponse);await update(id,{status:settled?'payment_settled_fulfillment_unresolved':'supplier_execution_failed',routeProvider:row.route_provider,routeSlug:row.route_slug,routeUrl:row.route_url,quotedPriceUsd:probe.amountUsd,executionMode:'buyer_signed_x402_passthrough',resultDigest:digest});return{ok:false,httpStatus:r.status||502,...publicRow({...row,status:settled?'payment_settled_fulfillment_unresolved':'supplier_execution_failed'}),autonomous:true,manualBrokerage:false,ownerFundsSpentUsd:0,buyerPaidSupplierDirectly:settled,platformFeeUsd:0,beta:true,result:r.data,paymentResponse:r.paymentResponse||null,note:settled?'Payment may have settled but fulfillment did not complete cleanly. HYDRA will not create a new spending authorization automatically.':'Supplier execution failed before a settlement response was observed.'};
}

async function status(){const db=await init();return{ok:true,name:'INCOME 2 Outcome Router',internalCodename:'HYDRA',beta:true,autonomousOnly:true,manualBrokerage:false,upstreams:['Agent402'],canExecuteNow:['Agent402 proof-of-work eligible tools','paid x402 routes through buyer-signed non-custodial pass-through'],paidExternalExecution:true,paymentModel:'buyer wallet signs supplier x402 challenge locally; HYDRA forwards payment proof and never receives buyer private keys or owner funds',platformFeeUsd:0,platformFeeMode:'free beta while paid fulfillment demand is validated',ownerWorkingCapitalUsedForBuyerJobs:false,privacy:{rawTaskRetained:false,rawParamsRetained:false,paymentSignatureRetained:false,externalRoutingSharesTaskWhenEnabled:true,credentialLikeInputsBlockedFromExternalRouting:true},persistence:db};}
async function get(id){return publicRow(await byId(String(id||'').trim()));}
async function selfTest(){const route=await findRoute('jwt decode').catch(()=>({candidate:null}));if(!route.candidate)return{ok:false,reason:'no_route'};const p=await probePaid(route.candidate.route,{token:'eyJhbGciOiJub25lIn0.eyJzdWIiOiJoeWRyYS1zZWxmLXRlc3QifQ.'},'hydra-selftest-0001').catch(error=>({ok:false,reason:String(error?.message||error)}));return{ok:Boolean(p.ok),routeSlug:route.candidate.slug||null,challenge402:Boolean(p.paymentRequired),amountUsd:p.amountUsd??null,ownerFundsSpentUsd:0,paymentSigned:false};}

function installExpressBridge(){
  try{
    const express=require('express');
    if(express.application.__hydraPaidBridgePatched)return;
    express.application.__hydraPaidBridgePatched=true;
    const previousListen=express.application.listen;
    express.application.listen=function hydraPaidBridgeListen(...args){
      if(!this.__hydraPaidBridgeInjected){
        this.__hydraPaidBridgeInjected=true;
        this.post('/outcome-router/execute/:requestId',async(req,res)=>{
          res.set('cache-control','no-store');
          try{
            const signature=String(req.get('payment-signature')||req.get('x-payment')||'').trim();
            const result=await execute(req.params.requestId,req.body||{},signature);
            if(result.paymentRequired&&result.paymentRequiredHeader){
              res.set('payment-required',result.paymentRequiredHeader);
              const body={...result};delete body.paymentRequiredHeader;
              return res.status(402).json(body);
            }
            if(result.paymentResponse)res.set('payment-response',result.paymentResponse);
            return res.status(result.httpStatus|| (result.ok===false?502:200)).json(result);
          }catch(error){
            const message=String(error?.message||'outcome paid execution failed').slice(0,300);
            const status=error?.code==='NOT_FOUND'?404:error?.code==='IDEMPOTENCY_CONFLICT'?409:error?.code==='OVER_BUDGET'?422:error?.code==='INVALID_INPUT'?422:error?.code==='NOT_READY'?409:500;
            return res.status(status).json({ok:false,message});
          }
        });
      }
      return previousListen.apply(this,args);
    };
  }catch{}
}
installExpressBridge();
setTimeout(()=>selfTest().then(x=>console.log(JSON.stringify({type:'hydra_paid_rail_selftest',...x,at:now()}))).catch(error=>console.error(JSON.stringify({type:'hydra_paid_rail_selftest',ok:false,error:String(error?.message||error).slice(0,300),at:now()}))),12000).unref();

module.exports={init,status,create,execute,get,selfTest};
