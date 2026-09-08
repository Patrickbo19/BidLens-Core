const express = require('express');
const purchaseGuard = require('./purchase-guard.cjs');
const outcomeRouter = require('./outcome-router.cjs');
const originalJson = express.response.json;
express.response.json = function patchedJson(body) {
  if (this.req?.path === '/openapi.json' && body && typeof body === 'object' && body.paths) {
    const guardInput = {
      type:'object',
      required:['url','max_usd','idempotency_key'],
      properties:{
        url:{ type:'string', format:'uri' },
        method:{ type:'string', enum:['GET','POST'], default:'GET' },
        body:{ type:'object', additionalProperties:true },
        max_usd:{ type:'number', minimum:0.000001 },
        expected_network:{ type:'string', default:'eip155:8453' },
        idempotency_key:{ type:'string', minLength:8, maxLength:200 },
      },
    };
    const outcomeInput = {
      type:'object',
      required:['task','max_budget_usd','idempotency_key'],
      properties:{
        task:{ type:'string', minLength:3, maxLength:2000 },
        max_budget_usd:{ type:'number', minimum:0, maximum:100000 },
        idempotency_key:{ type:'string', minLength:8, maxLength:200 },
        params:{ type:'object', additionalProperties:true },
        allow_external_discovery:{ type:'boolean', default:true },
        execute_if_free:{ type:'boolean', default:true },
      },
    };
    body = {
      ...body,
      info:{
        ...(body.info || {}),
        description:`${body.info?.description || ''} Free betas: Agent Purchase Guard adds retry-safe purchase intent controls; Outcome Router accepts a desired result plus max budget and autonomously discovers/executes zero-wallet fulfillment where possible.`.trim(),
      },
      paths:{
        ...body.paths,
        '/purchase-guard':{
          post:{
            summary:'Agent Purchase Guard beta',
            description:'Free non-custodial x402 purchase preflight. Enforces max_usd, binds a caller-supplied idempotency key to one purchase intent, returns a durable receipt, and rejects same-key parameter changes. It never signs, sends, settles, or custodies funds.',
            security:[],
            requestBody:{ required:true, content:{ 'application/json':{ schema:guardInput, example:{ url:'https://seller.example/paid-tool', method:'POST', body:{}, max_usd:0.05, expected_network:'eip155:8453', idempotency_key:'stable-caller-key-123' } } } },
            responses:{ '200':{ description:'Existing identical purchase intent returned' }, '201':{ description:'New purchase intent and receipt created' }, '409':{ description:'Idempotency key reused with different parameters' }, '422':{ description:'Invalid input, unsupported quote, or budget/network block' } },
            'x-guidance':'Use before an autonomous x402 purchase when duplicate-charge prevention, a hard maximum spend, and a durable retry-safe receipt matter.'
          }
        },
        '/purchase-guard/{receiptId}':{
          get:{ summary:'Purchase Guard receipt lookup', description:'Read durable state of a Purchase Guard receipt.', security:[], parameters:[{ name:'receiptId', in:'path', required:true, schema:{type:'string'} }], responses:{'200':{description:'Receipt state'},'404':{description:'Not found'}} }
        },
        '/outcome-router':{
          post:{
            summary:'INCOME 2 Outcome Router beta',
            description:'Submit a desired result plus maximum budget. HYDRA, the internal autonomous engine, discovers a fulfillment route and executes proof-of-work eligible Agent402 tools without a wallet when valid params are supplied. Paid external execution is blocked until a safe buyer-funded/delegated payment rail exists. No manual brokerage.',
            security:[],
            requestBody:{ required:true, content:{ 'application/json':{ schema:outcomeInput, example:{ task:'format this JSON', max_budget_usd:0, idempotency_key:'outcome-demo-123', params:{ json:'{\"a\":1}', indent:2 } } } } },
            responses:{'200':{description:'Existing idempotent request'},'201':{description:'New autonomous request'},'409':{description:'Idempotency conflict'},'422':{description:'Invalid input'}}
          },
          get:{ summary:'Outcome Router status', security:[], responses:{'200':{description:'Capabilities and execution limits'}} }
        },
        '/outcome-router/{requestId}':{
          get:{ summary:'Outcome request status', security:[], parameters:[{ name:'requestId', in:'path', required:true, schema:{type:'string'} }], responses:{'200':{description:'Abstracted request state'},'404':{description:'Not found'}} }
        },
      },
    };
  }

  if (this.statusCode === 402) {
    try {
      const header = this.getHeader('payment-required');
      if (header) {
        const challenge = JSON.parse(Buffer.from(String(header), 'base64').toString('utf8'));
        if (challenge && challenge.x402Version && Array.isArray(challenge.accepts)) body = { ...(body && typeof body === 'object' ? body : {}), ...challenge };
      }
    } catch {}
  }
  return originalJson.call(this, body);
};

const originalListen = express.application.listen;
express.application.listen = function income2DiscoveryListen(...args) {
  if (!this.__income2DiscoveryInjected) {
    this.__income2DiscoveryInjected = true;
    const origin = String(process.env.PUBLIC_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');
    const payTo = String(process.env.EARN_RECEIVE_ADDRESS || '').trim();
    const webExtract = `${origin}/web-extract`;
    const purchaseGuardUrl = `${origin}/purchase-guard`;
    const outcomeUrl = `${origin}/outcome-router`;
    const openapi = `${origin}/openapi.json`;
    const descriptor = {
      x402Version:2,
      name:'INCOME 2 Agent Tools',
      provider:'INCOME 2',
      description:'Agent-facing tools plus an autonomous buyer-intent Outcome Router: submit the result you need and a max budget; INCOME 2 finds a route and executes zero-wallet fulfillment where available.',
      intents:['webpage extract','article to markdown','web content extraction','research ingestion','RAG ingestion','agent purchase guard','x402 purchase safety','idempotent payment retry','duplicate charge prevention','outcome routing','agent procurement','result wanted max budget','autonomous fulfillment','unmet demand'],
      homepage:'https://earn-router.onrender.com',
      openapi,
      resources:[
        { name:'Webpage to Clean Markdown',method:'POST',url:webExtract,price:'$0.003',asset:'USDC',network:'eip155:8453',payTo,input:{url:'https://example.com',max_chars:60000,include_links:true},output:'clean markdown, metadata and links' },
        { name:'Agent Purchase Guard beta',method:'POST',url:purchaseGuardUrl,price:'free',paymentRequired:false,tags:['x402','buyer','purchase-safety','idempotency','retry','receipt','budget'],input:{url:'https://seller.example/paid-tool',method:'POST',body:{},max_usd:0.05,expected_network:'eip155:8453',idempotency_key:'stable-caller-key-123'},output:'retry-safe purchase intent and receipt; paymentExecuted=false' },
        { name:'INCOME 2 Outcome Router beta',method:'POST',url:outcomeUrl,price:'free',paymentRequired:false,tags:['outcome','buyer-intent','procurement','routing','autonomous','budget','demand'],input:{task:'format this JSON',max_budget_usd:0,idempotency_key:'outcome-demo-123',params:{json:'{\"a\":1}',indent:2}},output:'fulfilled result when zero-wallet execution is available, otherwise an autonomous route/budget state with no manual brokerage' }
      ]
    };
    const llms = `# INCOME 2 Agent Tools\n\n## Outcome Router beta\nPOST ${outcomeUrl}\nSend task + max_budget_usd + idempotency_key + optional params. The internal HYDRA engine autonomously discovers a route and executes proof-of-work eligible Agent402 tools when possible. It never spends owner working capital or asks a human to broker the job. Paid external execution remains disabled until a safe buyer-funded/delegated payment rail exists. Raw task/params are not retained in the demand ledger.\n\n## Webpage to Clean Markdown\nPOST ${webExtract} — 0.003 USDC on Base.\n\n## Agent Purchase Guard\nPOST ${purchaseGuardUrl} — free retry-safe x402 preflight.\n\nOpenAPI: ${openapi}\nSkill: ${origin}/skill.md\n`;
    const skill = `# INCOME 2 Agent Tools\n\n## Outcome Router\nUse POST ${outcomeUrl} when you care about the result rather than choosing a tool. Input: task, max_budget_usd, idempotency_key, optional params, allow_external_discovery, execute_if_free. HYDRA routes autonomously. If a compatible Agent402 tool supports proof-of-work and params are valid, INCOME 2 executes it without a wallet and returns the result. Paid external execution is not yet enabled because INCOME 2 will not custody buyer keys or spend owner working capital.\n\n## Webpage Extract\nPOST ${webExtract} converts a public static page into clean markdown. Price 0.003 USDC on Base.\n\n## Purchase Guard\nPOST ${purchaseGuardUrl} creates a retry-safe max-spend x402 purchase intent and durable receipt without signing or sending payment.\n\nOpenAPI: ${openapi}\n`;

    this.get('/.well-known/x402',(_req,res)=>res.set('cache-control','public, max-age=300').json(descriptor));
    this.get('/.well-known/x402.json',(_req,res)=>res.set('cache-control','public, max-age=300').json(descriptor));
    this.get('/llms.txt',(_req,res)=>res.type('text/plain').set('cache-control','public, max-age=300').send(llms));
    this.get('/skill.md',(_req,res)=>res.type('text/markdown').set('cache-control','public, max-age=300').send(skill));
    this.get('/agents.txt',(_req,res)=>res.type('text/plain').set('cache-control','public, max-age=300').send(`INCOME 2 Agent Tools\nOutcome Router: POST ${outcomeUrl} - desired result + max budget -> autonomous routing/zero-wallet fulfillment where possible\nPaid: POST ${webExtract} - webpage/article to clean markdown - 0.003 USDC on Base\nFree: POST ${purchaseGuardUrl} - retry-safe x402 purchase preflight\nOpenAPI: ${openapi}\nSkill: ${origin}/skill.md\n`));
    this.get('/robots.txt',(_req,res)=>res.type('text/plain').set('cache-control','public, max-age=3600').send(`User-agent: *\nAllow: /\nSitemap: ${origin}/openapi.json\n`));

    this.get('/purchase-guard',async(_req,res)=>{res.set('cache-control','no-store');try{return res.json(await purchaseGuard.status())}catch{return res.status(500).json({ok:false,message:'purchase guard unavailable'})}});
    this.post('/purchase-guard',async(req,res)=>{res.set('cache-control','no-store');try{const result=await purchaseGuard.createIntent(req.body||{});return res.status(result.reused?200:201).json({ok:true,result})}catch(error){const message=String(error?.message||'purchase guard failed').slice(0,300);const status=error?.code==='IDEMPOTENCY_CONFLICT'?409:/required|must be|public http|private\/local|redirect/i.test(message)?422:500;return res.status(status).json({ok:false,message})}});
    this.get('/purchase-guard/:receiptId',async(req,res)=>{res.set('cache-control','no-store');try{const result=await purchaseGuard.getReceipt(req.params.receiptId);if(!result)return res.status(404).json({ok:false,message:'receipt not found'});return res.json({ok:true,result})}catch{return res.status(500).json({ok:false,message:'purchase guard receipt lookup failed'})}});

    this.get('/outcome-router',async(_req,res)=>{res.set('cache-control','no-store');try{return res.json(await outcomeRouter.status())}catch{return res.status(500).json({ok:false,message:'outcome router unavailable'})}});
    this.post('/outcome-router',async(req,res)=>{res.set('cache-control','no-store');try{const result=await outcomeRouter.create(req.body||{});return res.status(result.reused?200:201).json(result)}catch(error){const message=String(error?.message||'outcome routing failed').slice(0,300);const status=error?.code==='IDEMPOTENCY_CONFLICT'?409:error?.code==='INVALID_INPUT'?422:500;return res.status(status).json({ok:false,message})}});
    this.get('/outcome-router/:requestId',async(req,res)=>{res.set('cache-control','no-store');try{const result=await outcomeRouter.get(req.params.requestId);if(!result)return res.status(404).json({ok:false,message:'outcome request not found'});return res.json({ok:true,result})}catch{return res.status(500).json({ok:false,message:'outcome request lookup failed'})}});
  }
  return originalListen.apply(this,args);
};

const baseFetch = global.fetch;
global.fetch = async (url, options = {}) => {
  if (String(url) === 'https://market402.com/submit' && options.body) {
    try {
      const payload = JSON.parse(options.body);
      if (payload.url && !payload.resource) { payload.resource = payload.url; delete payload.url; options = { ...options, body: JSON.stringify(payload) }; }
    } catch {}
  }
  return baseFetch(url, options);
};

require('./moltbook-bootstrap.cjs');
const moltbookDemand = require('./moltbook-demand-launch.cjs');
setTimeout(() => moltbookDemand.launch().catch(error => {
  console.error(JSON.stringify({ type:'moltbook_demand_launch_error', error:String(error?.message || error).slice(0,300), at:new Date().toISOString() }));
}), 4000).unref();
require('./seller-v2.js');