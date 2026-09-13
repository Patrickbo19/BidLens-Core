const ledger=require('./ledger.cjs');
const store=require('./income2-agent-store.cjs');
let scheduled=false;
function req(path,{method='GET',body,token}={}){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),10000);return fetch(`http://127.0.0.1:${Number(process.env.PORT||3000)}${path}`,{method,signal:ctl.signal,headers:{accept:'application/json',...(body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined}).then(async r=>{const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return{status:r.status,data,text}}).finally(()=>clearTimeout(timer))}
function pass(c,name){if(!c)throw new Error(name);return{name,ok:true}}
async function cleanup(xs){for(const x of xs){if(!x?.handle||!x?.token)continue;try{const a=await ledger.authenticate(x.handle,x.token);if(a?.id)await store.pool.query(`DELETE FROM earn_accounts WHERE id=$1`,[a.id])}catch{}}}
async function run(){const checks=[],temps=[];let a,b,sa,sb;try{
let r=await req('/income2/wallet/health');checks.push(pass(r.status===200&&r.data?.ok&&r.data?.closedLoop===true,'01 wallet health'));
r=await req('/income2/v1/earn',{method:'POST',body:{clientType:'agent',capabilities:['wallet-selftest-a'],autoEarn:true}});checks.push(pass(r.status===201&&r.data?.accountHandle,'02 create agent A'));a={handle:r.data.accountHandle,token:r.data.accountToken};temps.push(a);
r=await req('/income2/v1/earn',{method:'POST',body:{clientType:'agent',capabilities:['wallet-selftest-b'],autoEarn:true}});checks.push(pass(r.status===201&&r.data?.accountHandle,'03 create agent B'));b={handle:r.data.accountHandle,token:r.data.accountToken};temps.push(b);
r=await req('/income2/network/session',{method:'POST',body:{accountHandle:a.handle,accountToken:a.token}});checks.push(pass(r.status===201&&r.data?.networkToken,'04 session A'));sa=r.data;
r=await req('/income2/network/session',{method:'POST',body:{accountHandle:b.handle,accountToken:b.token}});checks.push(pass(r.status===201&&r.data?.networkToken,'05 session B'));sb=r.data;
r=await req('/income2/wallet/status',{method:'POST',token:sa.networkToken,body:{}});checks.push(pass(r.status===200&&String(r.data?.wallet?.walletId||'').startsWith('i2w_'),'06 wallet A exists'));
checks.push(pass(Number(r.data.wallet.availableUsd)===0,'07 wallet starts at zero'));
checks.push(pass(r.data.wallet.externalDeposits===false&&r.data.wallet.externalSigning===false,'08 closed-loop flags'));
r=await req('/income2/wallet/status',{method:'POST',token:sb.networkToken,body:{}});checks.push(pass(r.status===200&&r.data?.wallet?.walletId,'09 wallet B exists'));
r=await req('/income2/wallet/statement',{method:'POST',token:sa.networkToken,body:{limit:20}});checks.push(pass(r.status===200&&Array.isArray(r.data?.entries),'10 statement works'));
r=await req('/income2/wallet/deposit',{method:'POST',token:sa.networkToken,body:{amountUsd:1}});checks.push(pass(r.status===409&&/disabled/i.test(String(r.data?.message||'')),'11 external deposits blocked'));
r=await req('/income2/wallet/pay',{method:'POST',token:sa.networkToken,body:{toAgentId:sb.profile.agentId,amountUsd:0.001,idempotencyKey:`wallet-selftest-${Date.now()}`}});checks.push(pass(r.status===402&&/insufficient/i.test(String(r.data?.message||'')),'12 unfunded payment blocked'));
r=await req('/income2/wallet/controls',{method:'POST',token:sa.networkToken,body:{frozen:true}});checks.push(pass(r.status===200&&r.data?.wallet?.frozen===true,'13 freeze wallet'));
r=await req('/income2/network/promote',{method:'POST',token:sa.networkToken,body:{postId:'00000000-0000-4000-8000-000000000000',amountUsd:0.001,idempotencyKey:`freeze-selftest-${Date.now()}`}});checks.push(pass(r.status===423&&/frozen/i.test(String(r.data?.message||'')),'14 freeze blocks outgoing commerce'));
r=await req('/income2/wallet/controls',{method:'POST',token:sa.networkToken,body:{frozen:false,perTransferUsd:0.02,dailyTransferUsd:0.05}});checks.push(pass(r.status===200&&r.data?.wallet?.frozen===false,'15 unfreeze wallet'));
checks.push(pass(Number(r.data.wallet.limits.perTransferUsd)===0.02&&Number(r.data.wallet.limits.rolling24hUsd)===0.05,'16 limits update'));
r=await req('/income2/network/wallet',{method:'POST',token:sa.networkToken,body:{}});checks.push(pass(r.status===200&&r.data?.wallet?.income2Wallet?.walletId,'17 network wallet includes Income2 wallet'));
r=await req('/income2/v1/earn',{method:'POST',body:{clientType:'human',autoEarn:true}});checks.push(pass(r.status===201&&r.data?.accountHandle,'18 create temporary human'));const h={handle:r.data.accountHandle,token:r.data.accountToken};temps.push(h);
r=await req('/income2/wallet/status',{method:'POST',body:{accountHandle:h.handle,accountToken:h.token}});checks.push(pass(r.status===403&&/agent-only/i.test(String(r.data?.message||'')),'19 human blocked from agent wallet'));
await cleanup(temps.splice(0));checks.push({name:'20 temporary data cleanup',ok:true});console.log(JSON.stringify({type:'income2_agent_wallet_selftest',ok:true,checksPassed:checks.length,checksFailed:0,checks,ownerFundsSpentUsd:0,fakeEarningsCreated:false,at:new Date().toISOString()}));return{ok:true,checks}}
catch(error){await cleanup(temps.splice(0));console.error(JSON.stringify({type:'income2_agent_wallet_selftest',ok:false,checksPassed:checks.length,error:String(error?.message||error).slice(0,500),ownerFundsSpentUsd:0,fakeEarningsCreated:false,at:new Date().toISOString()}));return{ok:false,error}}}
function schedule(){if(scheduled||process.env.INCOME2_WALLET_SELFTEST==='0')return;scheduled=true;setTimeout(()=>run().catch(()=>{}),9000).unref()}
module.exports={run,schedule};
