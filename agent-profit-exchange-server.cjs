const crypto = require('crypto');
const http = require('http');

const PORT = Number(process.env.PORT || 10000);
const ORIGIN = String(process.env.PUBLIC_ORIGIN || 'https://agent-profit-exchange.onrender.com').replace(/\/$/,'');
const NETWORK = 'eip155:8453';
const FACILITATOR_URL = String(process.env.X402_FACILITATOR_URL || 'https://facilitator.payai.network').replace(/\/$/,'');
const PAY_TO = String(process.env.EARN_RECEIVE_ADDRESS || '').trim();
const EXECUTION_PACKET_PRICE = '$0.01';
const REGISTER_ON_BOOT = String(process.env.APX_DIRECTORY_REGISTER_ON_BOOT || '') === '1';

const SOURCES = [
  {
    name:'EARN Opportunity Router',
    url:'https://earn-router.onrender.com/api/opportunities',
    method:'POST',
    body:{userId:'apx_public_router',country:'US',device:'windows',zeroSpendOnly:false}
  },
  {name:'TaskBounty',url:'https://earn-tools-backend.onrender.com/taskbounty/status',method:'GET'},
  {name:'Superteam Earn',url:'https://earn-tools-backend.onrender.com/apx/superteam-feed',method:'GET'}
];

const opportunityCache = new Map();

function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function text(v){return typeof v==='string'?v.trim():'';}
function arr(v){return Array.isArray(v)?v.map(x=>text(x)).filter(Boolean).slice(0,50):[];}
function bounded(v,min,max,fallback=0){const n=num(v);return n===null?fallback:Math.max(min,Math.min(max,n));}
function id(prefix='id'){return prefix+'_'+crypto.randomBytes(8).toString('hex');}
function opportunityId(x){return 'opp_'+crypto.createHash('sha256').update([x.source,x.title,x.url||'',x.payoutUsdc??''].join('|')).digest('hex').slice(0,24);}

async function readJson(req){
  return await new Promise((resolve,reject)=>{
    let body='';
    req.on('data',c=>{body+=c;if(body.length>128*1024){reject(new Error('body_too_large'));req.destroy();}});
    req.on('end',()=>{try{resolve(body?JSON.parse(body):{});}catch{reject(new Error('invalid_json'));}});
    req.on('error',reject);
  });
}

function normalizeDelegation(input={}){
  const authority=input.authority&&typeof input.authority==='object'?input.authority:input;
  const agent=input.agent&&typeof input.agent==='object'?input.agent:{};
  const prefs=input.preferences&&typeof input.preferences==='object'?input.preferences:{};
  return {
    rootSessionId:text(input.root_session_id||input.rootSessionId||agent.root_session_id).slice(0,160)||null,
    agentId:text(agent.id||input.agent_id||input.agentId).slice(0,160)||'anonymous-worker',
    parentAgentId:text(agent.parent_id||input.parent_agent_id||input.parentAgentId).slice(0,160)||null,
    lineageDepth:Math.floor(bounded(agent.lineage_depth??input.lineage_depth,0,32,0)),
    capabilities:arr(agent.capabilities||input.capabilities),
    maxSpendUsdc:bounded(authority.max_spend_usdc??input.budget_usdc,0,100000,0),
    maxLossUsdc:bounded(authority.max_loss_usdc,0,100000,0),
    minPayoutUsdc:bounded(prefs.min_payout_usdc??input.min_payout_usdc,0,100000,0),
    maxTimeToPaymentHours:bounded(prefs.max_time_to_payment_hours??input.max_time_to_payment_hours,0,24*365,0)||null,
    expiresAt:text(authority.expires_at||input.expires_at).slice(0,80)||null,
    allowedActions:arr(authority.allowed_actions||input.allowed_actions)
  };
}

async function getJson(source){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),15000);
  try{
    const options={method:source.method||'GET',headers:{accept:'application/json','user-agent':'APX/0.3'},signal:ctl.signal};
    if(options.method==='POST'){
      options.headers['content-type']='application/json';
      options.body=JSON.stringify(source.body||{});
    }
    const r=await fetch(source.url,options);
    if(!r.ok)throw new Error('HTTP '+r.status);
    return await r.json();
  }finally{clearTimeout(timer);}
}

function flatten(value,source,out=[],depth=0){
  if(depth>6||out.length>400)return out;
  if(Array.isArray(value)){for(const x of value)flatten(x,source,out,depth+1);return out;}
  if(!value||typeof value!=='object')return out;
  const title=text(value.title||value.name||value.summary||value.task||value.description);
  const payout=num(value.payout_usdc??value.compensationUsd??value.reward_usdc??value.reward??value.payout??value.amount_usdc??value.amount);
  const cost=num(value.cost_usdc??value.max_cost_usdc??value.spend_usdc??value.bond_usdc??value.bond??0);
  const url=text(value.url||value.link||value.href||value.source_url||value.claim_url);
  const status=text(value.status||value.state||value.availability);
  const fundingEvidence=text(value.funding_evidence||value.fundingEvidence);
  const funded=value.funded===true||Boolean(fundingEvidence)||/funded|open|ready|active/i.test(status);
  const verifier=text(value.verifier||value.verification||value.acceptance||value.acceptance_rule);
  const blockers=Array.isArray(value.blockers)?value.blockers.map(x=>text(x)).filter(Boolean).slice(0,12):[];
  const deadline=text(value.deadline||value.submission_deadline||value.submissionDeadline)||null;
  if(title&&(payout!==null||funded||url)){
    out.push({source,title:title.slice(0,300),payoutUsdc:payout,maxCostUsdc:cost===null?0:cost,funded,fundingEvidence:fundingEvidence||null,status:status||null,verifier:verifier||null,blockers,deadline,url:url||null,raw:value});
  }
  for(const v of Object.values(value))if(v&&typeof v==='object')flatten(v,source,out,depth+1);
  return out;
}

function evidenceTier(x){
  if(x.funded&&x.payoutUsdc!==null&&x.verifier)return 'VALIDATED';
  if(x.funded&&x.payoutUsdc!==null)return 'SIGNAL';
  return 'HYPOTHESIS';
}
function specializationFor(x){
  const hay=(x.title+' '+(x.verifier||'')).toLowerCase();
  if(/code|github|bug|api|software|repository|pull request|developer/.test(hay))return 'coding-agent';
  if(/research|report|analysis|data|document|summar/.test(hay))return 'research-agent';
  if(/design|image|creative|video|logo/.test(hay))return 'creative-agent';
  if(/sales|lead|referral|prospect/.test(hay))return 'business-development-agent';
  return 'general-execution-agent';
}
function capabilityFit(x,capabilities){
  if(!capabilities.length)return true;
  const hay=(x.title+' '+(x.verifier||'')+' '+(x.source||'')).toLowerCase();
  return capabilities.some(c=>hay.includes(c.toLowerCase()))||
    (capabilities.some(c=>/code|software|developer/i.test(c))&&/code|github|bug|api|software|repository|developer/i.test(hay))||
    (capabilities.some(c=>/research|analysis|data/i.test(c))&&/research|analysis|data|report|document/i.test(hay));
}
function blockerAllowed(blocker,allowedActions){
  const a=(allowedActions||[]).map(x=>String(x).toLowerCase());
  if(blocker==='social_account_or_content') return a.some(x=>['social_content','social_posting','use_social_account'].includes(x));
  if(blocker==='human_identity_or_signing') return a.includes('human_gate_available');
  if(blocker==='manual_human_interaction') return a.includes('human_interaction_available');
  if(blocker==='telegram_required') return a.includes('telegram_available');
  if(blocker==='owner_funds_or_trading') return false;
  if(blocker==='expired_deadline') return false;
  return false;
}
function score(x,delegation){
  const payout=x.payoutUsdc??0,cost=x.maxCostUsdc??0;
  const blocked=(x.blockers||[]).filter(b=>!blockerAllowed(b,delegation.allowedActions));
  if(blocked.length)return{eligible:false,reason:'delegation_blocked:'+blocked.join(','),score:-1};
  if(x.deadline && Number.isFinite(Date.parse(x.deadline)) && Date.parse(x.deadline)<=Date.now()) return{eligible:false,reason:'expired_deadline',score:-1};
  if(cost>delegation.maxSpendUsdc)return{eligible:false,reason:'cost_above_owner_budget',score:-1};
  if(cost>delegation.maxLossUsdc&&delegation.maxLossUsdc>0)return{eligible:false,reason:'loss_exposure_above_owner_limit',score:-1};
  if(payout<delegation.minPayoutUsdc)return{eligible:false,reason:'payout_below_minimum',score:-1};
  if(!capabilityFit(x,delegation.capabilities))return{eligible:false,reason:'capability_mismatch',score:-1};
  if(!x.funded)return{eligible:false,reason:'funding_not_verified',score:-1};
  if(payout<=cost)return{eligible:false,reason:'payout_does_not_cover_cost',score:-1};
  const tier=evidenceTier(x),tierPoints=tier==='VALIDATED'?35:tier==='SIGNAL'?15:0;
  const roi=payout/Math.max(0.01,cost||0.01);
  const s=Math.min(100,tierPoints+Math.min(40,Math.log10(Math.max(1,roi))*18)+Math.min(25,payout));
  return{eligible:true,reason:null,score:Math.round(s),expectedGrossUsdc:payout,maxCostUsdc:cost,expectedSpreadUsdc:payout-cost,evidenceTier:tier};
}

async function collect(){
  const collected=[],sourceStatus=[];
  await Promise.all(SOURCES.map(async source=>{
    try{
      const json=await getJson(source);
      const found=flatten(json,source.name);
      collected.push(...found);
      sourceStatus.push({source:source.name,ok:true,candidates:found.length});
    }catch(e){sourceStatus.push({source:source.name,ok:false,error:String(e.message||e).slice(0,200)});}
  }));
  return{collected,sourceStatus};
}

async function makeMoneyFromDelegation(delegation){
  const {collected,sourceStatus}=await collect();
  const seen=new Set(),ranked=[],rejected=[];
  for(const x of collected){
    const key=(x.title+'|'+(x.url||'')).toLowerCase();
    if(seen.has(key))continue;seen.add(key);
    const oppId=opportunityId(x),decision=score(x,delegation);
    const item={...x,raw:undefined,opportunityId:oppId,...decision,recommendedWorker:specializationFor(x)};
    opportunityCache.set(oppId,{at:Date.now(),item});
    if(decision.eligible)ranked.push(item);else rejected.push(item);
  }
  ranked.sort((a,b)=>b.score-a.score||(b.expectedSpreadUsdc||0)-(a.expectedSpreadUsdc||0));
  if(opportunityCache.size>500){
    for(const [k,v] of [...opportunityCache.entries()].sort((a,b)=>a[1].at-b[1].at).slice(0,150))opportunityCache.delete(k);
  }
  return{
    product:'Agent Profit Exchange',version:'0.3',command:'MAKE_MONEY',generatedAt:new Date().toISOString(),delegation,
    policy:{budgetUsdc:delegation.maxSpendUsdc,minPayoutUsdc:delegation.minPayoutUsdc,maxLossUsdc:delegation.maxLossUsdc,ownerCapitalIsNotRevenue:true,selfPurchasesBlocked:true},
    sourceStatus,
    opportunities:ranked.slice(0,25).map((x,i)=>({...x,handoff:{rank:i+1,agentId:delegation.agentId,parentAgentId:delegation.parentAgentId,rootSessionId:delegation.rootSessionId,action:'evaluate_and_execute_on_source_rail',sourceUrl:x.url,executionPacket:{method:'POST',url:ORIGIN+'/v1/execution-packet',priceUsdc:0.01,opportunityId:x.opportunityId}}})),
    rejected:rejected.slice(0,25)
  };
}

async function freshOpportunity(oppId,delegation){
  const data=await makeMoneyFromDelegation(delegation);
  const match=[...data.opportunities,...data.rejected].find(x=>x.opportunityId===oppId);
  return{data,match};
}
function executionPacket(match,delegation){
  if(!match)return{ok:false,status:'not_found_or_expired',verifiedAt:new Date().toISOString(),note:'The paid packet includes a fresh rescan; absence means the opportunity was not present in the latest source response.'};
  return{
    ok:true,status:match.eligible?'execution_candidate':'rejected_on_fresh_check',verifiedAt:new Date().toISOString(),
    opportunity:match,
    delegation,
    economics:{grossPayoutUsdc:match.expectedGrossUsdc??match.payoutUsdc??null,maxCostUsdc:match.maxCostUsdc??0,expectedSpreadUsdc:match.expectedSpreadUsdc??null},
    acceptance:{verifier:match.verifier||null,evidenceTier:match.evidenceTier||evidenceTier(match)},
    execution:{sourceRail:match.source,sourceUrl:match.url,recommendedWorker:match.recommendedWorker,nextAction:match.eligible?'Open the source rail, confirm current terms/deadline, then execute only within delegated authority.':'Do not execute under this delegation.'},
    warning:'APX routes and revalidates public/funded work; the source platform controls final acceptance and payout.'
  };
}

function capabilityCard(){
  return{
    name:'Agent Profit Exchange',
    short_name:'APX',
    description:'Economic routing layer for AI-orchestrated worker agents. A parent AI delegates bounded authority; APX returns funded work compatible with that worker.',
    commands:['MAKE_MONEY'],
    endpoints:{make_money:ORIGIN+'/v1/make-money',execution_packet:ORIGIN+'/v1/execution-packet',protocol:ORIGIN+'/v1/protocol',a2a:ORIGIN+'/a2a/v1',mcp:ORIGIN+'/mcp'},
    transports:['https-json','a2a-http-json','mcp'],
    agent_model:{supports_parent_child:true,supports_delegated_budget:true,supports_capability_filtering:true},
    payments:{protocol:'x402',network:NETWORK,asset:'USDC',paid_route:ORIGIN+'/v1/execution-packet',price_usdc:0.01},
    custody:false
  };
}
function protocol(){
  return{
    name:'Agent Profit Exchange',version:'0.3',
    controlChain:['human_owner','primary_ai_orchestrator','worker_agent','APX','funded_source_rail'],
    preferredCall:{method:'POST',path:'/v1/make-money',body:{root_session_id:'opaque-parent-generated-id',agent:{id:'worker-1',parent_id:'orchestrator-1',lineage_depth:1,capabilities:['research','coding']},authority:{max_spend_usdc:2,max_loss_usdc:2,expires_at:null,allowed_actions:['public_research','code_submission']},preferences:{min_payout_usdc:1,max_time_to_payment_hours:168}}},
    paidExecutionPacket:{method:'POST',path:'/v1/execution-packet',priceUsdc:0.01,payment:'x402 Base USDC'},
    discovery:{apx:'/.well-known/apx.json',a2a:'/.well-known/agent-card.json',openapi:'/openapi.json',agents:'/agents.txt',x402:'/.well-known/x402'},
    note:'Delegation is declared policy in the MVP, not cryptographic authority. Execution and settlement remain on authorized source rails.'
  };
}
function a2aCard(){
  return{
    name:'Agent Profit Exchange',
    description:'Find funded work for AI-created worker agents operating under bounded delegated authority.',
    supportedInterfaces:[{url:ORIGIN+'/a2a/v1',protocolBinding:'HTTP+JSON',protocolVersion:'1.0'}],
    provider:{organization:'APX'},
    version:'0.3.0',
    documentationUrl:ORIGIN+'/v1/protocol',
    capabilities:{streaming:false,pushNotifications:false},
    defaultInputModes:['application/json','text/plain'],
    defaultOutputModes:['application/json','text/plain'],
    skills:[{id:'make-money',name:'Make Money',description:'Route a delegated worker agent to current funded economic work within its capabilities and owner-defined risk budget.',tags:['earn','money','bounties','funded-work','delegation','agent-commerce'],examples:['Find funded work I can do with a $2 maximum risk budget.']}]
  };
}
function x402Manifest(){
  return{
    x402Version:2,version:2,name:'Agent Profit Exchange',
    resources:[{
      name:'APX Fresh Execution Packet',
      category:'agent-commerce',
      resource:'POST /v1/execution-packet',
      url:ORIGIN+'/v1/execution-packet',
      price:EXECUTION_PACKET_PRICE,
      description:'Freshly revalidate a funded opportunity selected by an AI worker and return a source-linked execution packet with economics, acceptance evidence and next action.',
      tags:['make-money','funded-work','agent','execution','bounty','delegation'],
      accepts:[{scheme:'exact',network:NETWORK,asset:'USDC',payTo:PAY_TO,price:EXECUTION_PACKET_PRICE}]
    }]
  };
}
function openApi(){
  return{
    openapi:'3.1.0',
    info:{title:'Agent Profit Exchange API',version:'0.3.0',description:'Machine-native funded-work routing for AI-created worker agents.'},
    servers:[{url:ORIGIN}],
    paths:{
      '/v1/make-money':{post:{summary:'Find funded work under delegated authority',requestBody:{required:true,content:{'application/json':{schema:{type:'object'}}}},responses:{'200':{description:'Ranked funded opportunities'}}}},
      '/v1/execution-packet':{post:{summary:'Fresh revalidation and execution packet',description:'x402 paid route: $0.01 USDC on Base.',requestBody:{required:true,content:{'application/json':{schema:{type:'object',required:['opportunity_id'],properties:{opportunity_id:{type:'string'},agent:{type:'object'},authority:{type:'object'},preferences:{type:'object'}}}}}},responses:{'200':{description:'Execution packet'},'402':{description:'x402 payment required'}}}}
    }
  };
}
function landing(){
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>APX — Make Money for Agents</title><style>body{font-family:system-ui;background:#080b10;color:#f5f7fa;margin:0}.w{max-width:920px;margin:auto;padding:64px 22px}.tag{letter-spacing:.15em;color:#8b949e;font-size:12px}.hero{font-size:clamp(46px,9vw,88px);line-height:.95;margin:18px 0}.sub{font-size:21px;color:#b7c0ca;max-width:760px;line-height:1.5}.box{margin-top:38px;border:1px solid #30363d;background:#11161e;border-radius:14px;padding:20px}.cmd{font-family:monospace;background:#000;padding:14px;border-radius:8px;overflow:auto}.muted{color:#8b949e}</style></head><body><div class="w"><div class="tag">AGENT PROFIT EXCHANGE</div><div class="hero">Tell your AI:<br>MAKE MONEY.</div><p class="sub">Your AI can spawn specialized workers. APX is the economic layer those workers call to discover funded work, respect delegated risk limits, and obtain fresh execution packets.</p><div class="box"><b>Free opportunity routing</b><div class="cmd">POST /v1/make-money</div><p class="muted">Then purchase a fresh source-linked execution packet for a selected opportunity through x402 for $0.01 USDC.</p><b>Machine discovery</b><div class="cmd">/.well-known/agent-card.json · /.well-known/apx.json · /openapi.json · /mcp</div></div></div></body></html>`;
}

async function logRegistration(type,url,body){
  try{
    const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const response=(await r.text()).slice(0,1200);
    console.log(JSON.stringify({type,ok:r.ok,status:r.status,response,at:new Date().toISOString()}));
  }catch(e){console.log(JSON.stringify({type:type+'_failed',error:String(e.message||e).slice(0,300),at:new Date().toISOString()}));}
}
async function registerDirectories(){
  if(!REGISTER_ON_BOOT)return console.log(JSON.stringify({type:'apx_directory_registration_skipped',reason:'disabled',at:new Date().toISOString()}));
  await logRegistration('apx_agent402_registration','https://agent402.tools/api/index/register',{origin:ORIGIN});
  await logRegistration('apx_x402_arena_registration','https://core.x402arena.gg/register',{name:'agent-profit-exchange',endpoint:ORIGIN+'/v1/execution-packet',description:'Fresh funded-work execution packets for AI-created worker agents.',niche:'agent-commerce',walletAddress:PAY_TO,method:'POST',resourceType:'http'});
  await logRegistration('apx_market402_registration','https://market402.com/submit',{resource:ORIGIN+'/v1/execution-packet'});
  await logRegistration('apx_402index_registration','https://402index.io/api/v1/register',{protocol:'x402',provider:'Agent Profit Exchange',payment_asset:'USDC',payment_network:'Base',price_usd:0.01,url:ORIGIN+'/v1/execution-packet',name:'APX Fresh Execution Packet',http_method:'POST',probe_body:JSON.stringify({opportunity_id:'opp_example',agent:{id:'worker-1'},authority:{max_spend_usdc:2,max_loss_usdc:2},preferences:{min_payout_usdc:1}}),description:'Freshly revalidate a funded opportunity and return an AI-worker execution packet.',category:'agent-commerce'});
}

(async()=>{
  if(!/^0x[a-fA-F0-9]{40}$/.test(PAY_TO))throw new Error('EARN_RECEIVE_ADDRESS must be configured for APX paid routes');

  const express=require('express');
  const expressModule=await import('@x402/express');
  const evmModule=await import('@x402/evm/exact/server');
  const coreModule=await import('@x402/core/server');
  const bazaarModule=await import('@x402/extensions/bazaar');
  const {paymentMiddleware,x402ResourceServer}=expressModule;
  const {ExactEvmScheme}=evmModule;
  const {HTTPFacilitatorClient}=coreModule;
  const {declareDiscoveryExtension,bazaarResourceServerExtension}=bazaarModule;

  const app=express();
  app.disable('x-powered-by');
  app.set('trust proxy',true);
  app.use(express.json({limit:'256kb'}));

  app.get('/health',(_req,res)=>res.json({ok:true,service:'agent-profit-exchange',version:'0.3',origin:ORIGIN,sources:SOURCES.length,x402:true,network:NETWORK,paidRoute:'/v1/execution-packet',paidRoutePriceUsdc:0.01,discovery:{a2a:true,apx:true,openapi:true,x402:true,mcp:true}}));
  app.get('/.well-known/apx.json',(_req,res)=>res.set('cache-control','public,max-age=300').json(capabilityCard()));
  app.get('/.well-known/agent-card.json',(_req,res)=>res.type('application/a2a+json').set('cache-control','public,max-age=300').send(JSON.stringify(a2aCard())));
  app.get('/.well-known/agent.json',(_req,res)=>res.type('application/a2a+json').set('cache-control','public,max-age=300').send(JSON.stringify(a2aCard())));
  app.get('/v1/protocol',(_req,res)=>res.set('cache-control','public,max-age=300').json(protocol()));
  app.get('/openapi.json',(_req,res)=>res.json(openApi()));
  app.get('/.well-known/x402',(_req,res)=>res.json(x402Manifest()));
  app.get('/.well-known/x402.json',(_req,res)=>res.json(x402Manifest()));
  app.get('/agents.txt',(_req,res)=>res.type('text/plain').send(`Agent Profit Exchange (APX)\nPurpose: economic routing for AI-created worker agents\nFree discovery: POST ${ORIGIN}/v1/make-money\nPaid fresh execution packet: POST ${ORIGIN}/v1/execution-packet ($0.01 USDC via x402)\nA2A card: ${ORIGIN}/.well-known/agent-card.json\nProtocol: ${ORIGIN}/v1/protocol\nOpenAPI: ${ORIGIN}/openapi.json\nMCP: ${ORIGIN}/mcp\n`));

  app.get('/v1/make-money',async(req,res)=>{
    const d=normalizeDelegation({budget_usdc:req.query.budget_usdc,min_payout_usdc:req.query.min_payout_usdc,max_loss_usdc:req.query.max_loss_usdc,capabilities:String(req.query.capabilities||'').split(',').map(x=>x.trim()).filter(Boolean),agent_id:req.query.agent_id,parent_agent_id:req.query.parent_agent_id,root_session_id:req.query.root_session_id});
    res.set('cache-control','no-store').json(await makeMoneyFromDelegation(d));
  });
  app.post('/v1/make-money',async(req,res)=>res.set('cache-control','no-store').json(await makeMoneyFromDelegation(normalizeDelegation(req.body||{}))));

  app.post('/a2a/v1/message:send',async(req,res)=>{
    const body=req.body||{},message=body.message||{},parts=Array.isArray(message.parts)?message.parts:[];
    let delegation=body.delegation||body.metadata?.delegation||{};
    for(const part of parts){
      const raw=text(part?.text||part?.textPart?.text||'');
      if(raw.startsWith('{')){try{delegation=JSON.parse(raw);}catch{}}
    }
    const data=await makeMoneyFromDelegation(normalizeDelegation(delegation));
    const taskId=id('task'),contextId=text(body.contextId)||id('ctx');
    res.type('application/a2a+json').json({task:{id:taskId,contextId,status:{state:'TASK_STATE_COMPLETED',timestamp:new Date().toISOString()},artifacts:[{artifactId:id('artifact'),name:'APX funded-work routing result',parts:[{text:JSON.stringify(data)}]}]}});
  });

  const facilitatorClient=new HTTPFacilitatorClient({url:FACILITATOR_URL});
  const resourceServer=new x402ResourceServer(facilitatorClient).register(NETWORK,new ExactEvmScheme()).registerExtension(bazaarResourceServerExtension);
  resourceServer.onAfterSettle(async ctx=>{
    try{
      const requirements=ctx?.requirements||ctx?.paymentRequirements||{},result=ctx?.result||ctx?.settleResponse||{};
      console.log(JSON.stringify({type:'apx_paid_execution_packet',price:EXECUTION_PACKET_PRICE,payer:result.payer||ctx?.paymentPayload?.payer||null,transaction:result.transaction||result.transactionHash||result.txHash||null,network:requirements.network||NETWORK,at:new Date().toISOString()}));
    }catch(e){console.log(JSON.stringify({type:'apx_settlement_log_error',error:String(e.message||e).slice(0,300),at:new Date().toISOString()}));}
  });
  const discovery=declareDiscoveryExtension({
    bodyType:'json',
    input:{opportunity_id:'opp_...',agent:{id:'worker-1',parent_id:'orchestrator-1',capabilities:['coding']},authority:{max_spend_usdc:2,max_loss_usdc:2},preferences:{min_payout_usdc:1}},
    inputSchema:{properties:{opportunity_id:{type:'string'},agent:{type:'object'},authority:{type:'object'},preferences:{type:'object'}},required:['opportunity_id']},
    output:{example:{ok:true,status:'execution_candidate',verifiedAt:'2026-09-19T00:00:00.000Z',execution:{sourceRail:'funded market',sourceUrl:'https://example.com/task',recommendedWorker:'coding-agent',nextAction:'Open the source rail and execute within delegated authority.'}}}
  });
  app.use(paymentMiddleware({
    'POST /v1/execution-packet':{
      accepts:[{scheme:'exact',price:EXECUTION_PACKET_PRICE,network:NETWORK,payTo:PAY_TO}],
      description:'Freshly revalidate a funded opportunity and return a source-linked execution packet for an AI worker.',
      mimeType:'application/json',
      extensions:discovery
    }
  },resourceServer));

  app.post('/v1/execution-packet',async(req,res)=>{
    const oppId=text(req.body?.opportunity_id||req.body?.opportunityId);
    if(!oppId)return res.status(422).json({ok:false,message:'opportunity_id is required'});
    const delegation=normalizeDelegation(req.body||{});
    const {match}=await freshOpportunity(oppId,delegation);
    return res.set('cache-control','no-store').json(executionPacket(match,delegation));
  });

  // Stateless MCP 2026-07-28 surface for orchestrators that discover tools rather than A2A agents.
  app.post('/mcp',async(req,res)=>{
    const method=text(req.headers['mcp-method']||req.body?.method),name=text(req.headers['mcp-name']||req.body?.params?.name);
    const rpcId=req.body?.id??null;
    if(method==='server/discover'){
      return res.json({jsonrpc:'2.0',id:rpcId,result:{name:'Agent Profit Exchange',version:'0.3.0',capabilities:{tools:{listChanged:false}}}});
    }
    if(method==='tools/list'){
      return res.json({jsonrpc:'2.0',id:rpcId,result:{tools:[{name:'make_money',title:'Make Money',description:'Find current funded work for an AI-created worker agent under delegated budget, loss and capability limits.',inputSchema:{type:'object',properties:{root_session_id:{type:'string'},agent:{type:'object'},authority:{type:'object'},preferences:{type:'object'}},additionalProperties:true}}]}});
    }
    if(method==='tools/call'&&name==='make_money'){
      const args=req.body?.params?.arguments||{};
      const data=await makeMoneyFromDelegation(normalizeDelegation(args));
      return res.json({jsonrpc:'2.0',id:rpcId,result:{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data}});
    }
    return res.status(404).json({jsonrpc:'2.0',id:rpcId,error:{code:-32601,message:'Method or tool not found'}});
  });

  app.get('/',(_req,res)=>res.type('html').send(landing()));
  app.use((err,_req,res,_next)=>{
    console.error(err);
    if(res.headersSent)return;
    const msg=String(err?.message||'internal_error');
    res.status(/invalid_json|body_too_large/i.test(msg)?400:500).json({ok:false,error:msg.slice(0,200)});
  });

  const server=http.createServer(app);
  server.listen(PORT,'0.0.0.0',()=>{
    console.log(JSON.stringify({type:'apx_started',version:'0.3',port:PORT,origin:ORIGIN,paidRoute:'/v1/execution-packet',price:EXECUTION_PACKET_PRICE,network:NETWORK,at:new Date().toISOString()}));
    setTimeout(registerDirectories,5000).unref();
    setTimeout(()=>makeMoneyFromDelegation(normalizeDelegation({budget_usdc:2,max_loss_usdc:2,min_payout_usdc:0,agent:{id:'apx-startup-check',capabilities:[]}}))
      .then(r=>console.log(JSON.stringify({type:'apx_startup_scan',opportunities:r.opportunities.length,rejected:r.rejected.length,sourceStatus:r.sourceStatus,top:r.opportunities.slice(0,3).map(x=>({id:x.opportunityId,title:x.title,payout:x.payoutUsdc,cost:x.maxCostUsdc,tier:x.evidenceTier,source:x.source})),at:new Date().toISOString()})))
      .catch(e=>console.log(JSON.stringify({type:'apx_startup_scan_failed',error:String(e.message||e).slice(0,300),at:new Date().toISOString()}))),8000).unref();
  });
})().catch(error=>{console.error(error);process.exit(1);});
