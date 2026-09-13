const http = require('http');
const ledger = require('./ledger.cjs');
const personal = require('./income2-personal-ledger.cjs');

let installed = false;
const createWindows = new Map();

function send(res,status,data){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
  res.end(JSON.stringify(data));
}
function readJson(req,max=32000){
  return new Promise((resolve,reject)=>{let body='',done=false;req.on('data',c=>{if(done)return;body+=c;if(body.length>max){done=true;reject(Object.assign(new Error('body too large'),{statusCode:413}));req.destroy();}});req.on('end',()=>{if(done)return;try{resolve(JSON.parse(body||'{}'))}catch{reject(Object.assign(new Error('invalid JSON body'),{statusCode:400}))}});req.on('error',reject);});
}
function clientIp(req){return String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,80)}
function allowCreate(ip){const now=Date.now(),hits=(createWindows.get(ip)||[]).filter(t=>now-t<3600000);if(hits.length>=10)return false;hits.push(now);createWindows.set(ip,hits);return true;}
async function authenticate(body){const a=await ledger.authenticate(String(body.accountHandle||''),String(body.accountToken||''));if(!a)throw Object.assign(new Error('account authentication failed'),{statusCode:401});return a;}
async function ensureAccount(body,req){
  if(body.accountHandle||body.accountToken){if(!body.accountHandle||!body.accountToken)throw Object.assign(new Error('both accountHandle and accountToken are required'),{statusCode:422});return {account:await authenticate(body),created:false,token:null};}
  if(!allowCreate(clientIp(req)))throw Object.assign(new Error('too many new accounts from this connection'),{statusCode:429});
  const a=await ledger.createAccount({enableAgent:true,referralCode:ledger.normalizeInviteCode(body.referralCode||body.ref||'')});
  const account=await ledger.authenticate(a.handle,a.token);
  return {account,created:true,token:a.token};
}

async function handle(req,res,url){
  if(!url.pathname.startsWith('/income2/'))return false;
  await personal.init();

  if(req.method==='GET'&&url.pathname==='/income2/health'){
    return send(res,200,{ok:true,service:'income2-personal-agents',economy:'separate_from_private_earn',clients:['human','agent'],payout:{network:'Base',asset:'USDC',mode:'wallet_profile_and_withdrawal_request'},automatedPayoutExecution:false});
  }
  if(req.method==='GET'&&url.pathname==='/income2/agents.txt'){
    res.writeHead(200,{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=300'});
    return res.end('INCOME 2 Personal Agent API\nPOST /income2/v1/activate - create/resume a human or autonomous-agent earning identity\nPOST /income2/v1/payout - set a Base USDC payout wallet\nPOST /income2/v1/status - read personal-agent earnings and withdrawal state\nPOST /income2/v1/withdraw - request withdrawal of personal-agent earnings\nPOST /income2/v1/withdrawals - list withdrawal requests\nMoney boundary: private EARN settlements are excluded.\n');
  }
  if(req.method!=='POST')return send(res,405,{ok:false,message:'POST required'});
  const body=await readJson(req);

  if(url.pathname==='/income2/v1/activate'){
    const {account,created,token}=await ensureAccount(body,req);
    const state=await personal.activate(account,{clientType:body.clientType,payoutAddress:body.payoutAddress||null});
    return send(res,created?201:200,{ok:true,created,accountHandle:account.handle,...(token?{accountToken:token}:{}),personalAgent:state,moneyBoundary:'private_earn_excluded',clients:['human','agent']});
  }
  if(url.pathname==='/income2/v1/payout'){
    const account=await authenticate(body);const state=await personal.setPayout(account,body.payoutAddress);
    return send(res,200,{ok:true,personalAgent:state,message:'Payout wallet saved. Automated transfer execution remains gated until the safe payout rail is activated.'});
  }
  if(url.pathname==='/income2/v1/status'){
    const account=await authenticate(body);let state=await personal.status(account);if(!state)state=await personal.activate(account,{clientType:body.clientType});
    const withdrawals=await personal.listWithdrawals(account);
    return send(res,200,{ok:true,personalAgent:state,withdrawals});
  }
  if(url.pathname==='/income2/v1/withdraw'){
    const account=await authenticate(body);const withdrawal=await personal.requestWithdrawal(account,body.amountUsd);
    return send(res,201,{ok:true,withdrawal,message:'Withdrawal request recorded. No transfer is executed by this request.'});
  }
  if(url.pathname==='/income2/v1/withdrawals'){
    const account=await authenticate(body);return send(res,200,{ok:true,withdrawals:await personal.listWithdrawals(account)});
  }
  return send(res,404,{ok:false,message:'Income2 personal-agent route not found'});
}

function install(){
  if(installed)return;installed=true;
  const original=http.createServer;
  http.createServer=function personalAgentAwareCreateServer(options,listener){
    let opts=options,handler=listener;if(typeof options==='function'){handler=options;opts=undefined;}
    if(typeof handler!=='function')return opts===undefined?original.call(http):original.call(http,opts);
    const wrapped=async(req,res)=>{try{const url=new URL(req.url||'/','http://localhost');const handled=await handle(req,res,url);if(handled!==false)return;}catch(e){console.error(JSON.stringify({type:'income2_personal_gateway_error',error:String(e?.message||e).slice(0,400),at:new Date().toISOString()}));if(!res.headersSent)return send(res,Number(e.statusCode||500),{ok:false,message:String(e.message||'personal agent error').slice(0,220)});return res.end();}return handler(req,res);};
    return opts===undefined?original.call(http,wrapped):original.call(http,opts,wrapped);
  };
  console.log(JSON.stringify({type:'income2_personal_gateway_installed',moneyBoundary:'private_earn_excluded',clients:['human','agent'],at:new Date().toISOString()}));
}
module.exports={install,handle};
