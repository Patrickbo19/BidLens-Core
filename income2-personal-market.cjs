const crypto = require('crypto');
const express = require('express');
const { Pool } = require('pg');
const personal = require('./income2-personal-ledger.cjs');
const payoutVault = require('./income2-payout-vault.cjs');
const withdrawalStore = require('./income2-withdrawal-store.cjs');

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const NETWORK = 'eip155:8453';
const FACILITATOR_URL = 'https://facilitator.payai.network';
const PRICE = '$0.001';
const PRICE_USD = 0.001;
const pool = DATABASE_URL ? new Pool({connectionString:DATABASE_URL,max:2,idleTimeoutMillis:30000,ssl:/localhost|127\.0\.0\.1/.test(DATABASE_URL)?false:{rejectUnauthorized:false}}) : null;
let runtimePromise = null;

const TOOLS = {
  'clean-text': { description:'Normalize whitespace, line endings and blank lines.', input:{text:' messy   text \n\n here '}, run:b=>({text:cleanText(b?.text)}) },
  'dedupe-lines': { description:'Remove duplicate non-empty lines while preserving order.', input:{text:'alpha\nbeta\nalpha'}, run:b=>({lines:dedupeLines(b?.text)}) },
  'extract-urls': { description:'Extract unique HTTP and HTTPS URLs from text.', input:{text:'See https://example.com and https://openai.com'}, run:b=>({urls:extractUrls(b?.text)}) },
  'flatten-json': { description:'Flatten nested JSON into dotted-key paths.', input:{value:{a:{b:1}}}, run:b=>({flat:flatten(b?.value??b?.json??{})}) },
  'csv-to-json': { description:'Convert CSV text with a header row into JSON rows.', input:{csv:'name,value\nalpha,1\nbeta,2'}, run:b=>({rows:parseCsv(b?.csv)}) },
};

function cleanText(v){return String(v||'').replace(/\r\n?/g,'\n').split('\n').map(x=>x.trim().replace(/[ \t]+/g,' ')).filter((x,i,a)=>x||a[i-1]).join('\n').trim().slice(0,200000)}
function dedupeLines(v){const seen=new Set(),out=[];for(const raw of String(v||'').replace(/\r\n?/g,'\n').split('\n')){const s=raw.trim();if(!s||seen.has(s))continue;seen.add(s);out.push(s);if(out.length>=5000)break;}return out}
function extractUrls(v){const seen=new Set(),out=[];for(const m of String(v||'').matchAll(/https?:\/\/[^\s<>"']+/gi)){const s=m[0].replace(/[),.;]+$/,'');if(!seen.has(s)){seen.add(s);out.push(s)}if(out.length>=500)break;}return out}
function flatten(v,p='',out={}){if(Object.keys(out).length>=5000)return out;if(Array.isArray(v)){v.forEach((x,i)=>flatten(x,p?`${p}.${i}`:String(i),out));return out}if(v&&typeof v==='object'){for(const [k,x] of Object.entries(v))flatten(x,p?`${p}.${k}`:k,out);return out}out[p||'value']=v;return out}
function parseCsv(value){const text=String(value||'');if(!text||text.length>300000)throw new Error('csv must be 1-300000 characters');const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(q&&text[i+1]==='"'){cell+='"';i++}else q=!q}else if(ch===','&&!q){row.push(cell);cell=''}else if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}else cell+=ch}if(cell||row.length){row.push(cell);rows.push(row)}if(!rows.length)return[];const headers=rows[0].map((x,i)=>String(x||`column_${i+1}`).trim()||`column_${i+1}`);return rows.slice(1,1001).filter(r=>r.some(x=>String(x).length)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])))}
function settlementRef(req,tool){const proof=String(req.headers['payment-signature']||req.headers['x-payment']||req.headers['payment']||'').trim()||crypto.randomUUID();return crypto.createHash('sha256').update(`income2|${tool}|${proof}`).digest('hex')}
function priceString(amount){return `$${Number(amount).toFixed(6)}`}

async function runtime(){
  if(!runtimePromise)runtimePromise=(async()=>{const [{paymentMiddleware,x402ResourceServer},{ExactEvmScheme},{HTTPFacilitatorClient}]=await Promise.all([import('@x402/express'),import('@x402/evm/exact/server'),import('@x402/core/server')]);const rs=new x402ResourceServer(new HTTPFacilitatorClient({url:FACILITATOR_URL})).register(NETWORK,new ExactEvmScheme());return{paymentMiddleware,rs}})();
  return runtimePromise;
}
async function workers(){if(!pool)return[];await personal.init();const r=await pool.query(`SELECT p.account_id,p.agent_id,p.payout_address FROM income2_personal_agents p JOIN earn_accounts a ON a.id=p.account_id WHERE p.enabled=true AND a.agent_enabled=true ORDER BY p.last_scan_at ASC NULLS FIRST,p.created_at ASC`);return r.rows}
async function selectWorker(){const list=await workers();return list[0]||null}
async function markPaidAssignment(worker){if(!worker)return;await pool.query(`UPDATE income2_personal_agents SET last_scan_at=now(),opportunity_count=opportunity_count+1,updated_at=now() WHERE account_id=$1`,[worker.account_id])}
function manifestResources(origin){return Object.entries(TOOLS).map(([name,t])=>({resource:`${origin}/income2-market/${name}`,method:'POST',name:`Income2 Personal Agent ${name}`,description:t.description,price:PRICE,asset:'USDC',network:NETWORK,paymentRequired:true,input:t.input,tags:['income2','personal-agent','worker-pool',name]}))}

function install(){
  if(express.application.__income2MarketInstalled)return;
  express.application.__income2MarketInstalled=true;
  const priorJson=express.response.json;
  express.response.json=function income2MarketJson(body){
    try{
      if((this.req?.path==='/.well-known/x402'||this.req?.path==='/.well-known/x402.json')&&body&&typeof body==='object'){
        const proto=String(this.req.headers['x-forwarded-proto']||'https').split(',')[0];const host=String(this.req.headers['x-forwarded-host']||this.req.headers.host||'earn-tools-backend.onrender.com').split(',')[0];const origin=`${proto}://${host}`;const existing=Array.isArray(body.resources)?body.resources:[];const extra=manifestResources(origin);body={...body,resources:[...existing,...extra],personalAgentMarket:{separateEconomy:true,userRevenueOnly:true,privateEarnExcluded:true,bootstrapActive:true,payoutTreasury:'separate',payoutWalletRequiredForAssignments:false}};
      }
      if(this.req?.path==='/openapi.json'&&body&&body.paths){const extra={};for(const [name,t] of Object.entries(TOOLS)){extra[`/income2-market/${name}`]={post:{summary:`Income2 personal-agent ${name}`,description:t.description,responses:{'200':{description:'Paid worker result'},'402':{description:'x402 payment required'}}}}}body={...body,paths:{...body.paths,...extra}}}
    }catch{}
    return priorJson.call(this,body);
  };

  const priorListen=express.application.listen;
  express.application.listen=function income2MarketListen(...args){
    if(!this.__income2MarketRoutes){
      this.__income2MarketRoutes=true;
      this.get('/income2-market/status',async(_req,res)=>{const [list,treasury]=await Promise.all([workers().catch(()=>[]),payoutVault.status().catch(()=>({ready:false,address:null,onchainUsdcBalance:null}))]);res.json({ok:true,service:'income2-personal-agent-market',paidTools:Object.keys(TOOLS),activeWorkers:list.length,bootstrapActive:true,network:NETWORK,asset:'USDC',priceUsd:PRICE_USD,privateEarnExcluded:true,payoutWalletRequiredForAssignments:false,payoutTreasury:{ready:Boolean(treasury.ready),address:treasury.address||null,balanceUsdc:treasury.onchainUsdcBalance}})});

      this.post('/income2-payout/:withdrawalId',async(req,res,next)=>{
        try{
          const withdrawal=await withdrawalStore.get(req.params.withdrawalId);
          if(!withdrawal)return res.status(404).json({ok:false,message:'withdrawal not found'});
          if(!['requested','approved'].includes(withdrawal.status))return res.status(409).json({ok:false,message:`withdrawal is ${withdrawal.status}`});
          const {paymentMiddleware,rs}=await runtime();
          const mw=paymentMiddleware({[`POST ${req.path}`]:{accepts:[{scheme:'exact',price:priceString(withdrawal.amountUsd),network:NETWORK,payTo:withdrawal.payoutAddress}],description:`Income2 withdrawal ${withdrawal.withdrawalId}`,mimeType:'application/json'}},rs);
          return mw(req,res,err=>{if(err)return next(err);return res.json({ok:true,withdrawalId:withdrawal.withdrawalId,amountUsd:withdrawal.amountUsd,payoutAddress:withdrawal.payoutAddress,settlementAccepted:true})});
        }catch(e){return next(e)}
      });

      for(const [name,tool] of Object.entries(TOOLS)){
        this.post(`/income2-market/${name}`,async(req,res,next)=>{
          try{
            const treasury=await payoutVault.init();
            if(!treasury.ready||!/^0x[a-fA-F0-9]{40}$/.test(treasury.address||''))return res.status(503).json({ok:false,message:'Income2 payout treasury unavailable'});
            const worker=await selectWorker();
            const {paymentMiddleware,rs}=await runtime();
            const mw=paymentMiddleware({[`POST ${req.path}`]:{accepts:[{scheme:'exact',price:PRICE,network:NETWORK,payTo:treasury.address}],description:tool.description,mimeType:'application/json'}},rs);
            return mw(req,res,async err=>{if(err)return next(err);try{
              const result=tool.run(req.body||{});
              let recorded={recorded:false,reason:'platform_bootstrap'};
              if(worker){
                recorded=await personal.recordEarning({id:worker.account_id},{source:`income2_market:${name}`,sourceRef:settlementRef(req,name),grossUsd:PRICE_USD,metadata:{agentId:worker.agent_id,route:req.path,treasury:treasury.address}});
                if(recorded.recorded)await markPaidAssignment(worker);
              }
              return res.json({ok:true,result,workerAgentId:worker?.agent_id||'income2_bootstrap',personalEarningRecorded:Boolean(recorded.recorded),assignmentMode:worker?'personal_agent':'platform_bootstrap',priceUsd:PRICE_USD});
            }catch(e){return next(e)}});
          }catch(e){return next(e)}
        });
      }
      Promise.all([personal.init(),payoutVault.init()]).then(([,treasury])=>console.log(JSON.stringify({type:'income2_personal_market_ready',tools:Object.keys(TOOLS).length,priceUsd:PRICE_USD,bootstrapActive:true,payoutWalletRequiredForAssignments:false,payoutTreasury:treasury.address,privateEarnExcluded:true,at:new Date().toISOString()}))).catch(e=>console.error(JSON.stringify({type:'income2_personal_market_init_error',error:String(e.message).slice(0,300),at:new Date().toISOString()})));
    }
    return priorListen.apply(this,args);
  };
}

module.exports={install};
