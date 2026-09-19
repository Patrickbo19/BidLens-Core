const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');

const PRIVATE_KEY=String(process.env.TASKMARKET_WORKER_PRIVATE_KEY||'').trim();
const VERIFICATION_MD_B64=String(process.env.TASKMARKET_VERIFICATION_MD_B64||'').trim();
const OPERATOR_AGREED=String(process.env.TASKMARKET_OPERATOR_AGREED||'')==='1';
const API='https://api.taskmarket.dev';
const TASK_ID='0xbfdb2d1c3c32ef7a7e78757ef23212f61b1fd1eac639f68d176c8834a9e5522d';
const HOME_DIR='/tmp/taskmarket-home';
const ARTIFACT='/tmp/verification.md';

function runCli(args,{timeoutMs=120000,importKey=false}={}){
  return new Promise((resolve,reject)=>{
    const env={...process.env,HOME:HOME_DIR,TASKMARKET_API_URL:API};
    if(importKey) env.TASKMARKET_IMPORT_KEY=PRIVATE_KEY;
    else delete env.TASKMARKET_IMPORT_KEY;
    const child=spawn('npx',['-y','@lucid-agents/taskmarket@latest',...args],{
      env,stdio:['ignore','pipe','pipe']
    });
    let out='',err='';
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('taskmarket CLI timed out'));},timeoutMs);
    child.stdout.on('data',d=>{out+=d.toString(); if(out.length>200000) out=out.slice(-200000);});
    child.stderr.on('data',d=>{err+=d.toString(); if(err.length>200000) err=err.slice(-200000);});
    child.on('error',e=>{clearTimeout(timer);reject(e);});
    child.on('close',code=>{
      clearTimeout(timer);
      let parsed=null;
      const candidates=out.trim().split(/\n+/).reverse();
      for(const line of candidates){try{parsed=JSON.parse(line);break}catch{}}
      resolve({code,out:out.trim(),err:err.trim(),parsed});
    });
  });
}
function compact(result){
  return {
    code:result.code,
    parsed:result.parsed||null,
    stderr:String(result.err||'').slice(-1200),
    stdout:result.parsed?undefined:String(result.out||'').slice(-1200)
  };
}
async function main(){
  if(!/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)||!VERIFICATION_MD_B64){
    console.log(JSON.stringify({type:'taskmarket_cli_submit_skipped',reason:'worker_key_or_artifact_missing',at:new Date().toISOString()}));
    return;
  }
  if(!OPERATOR_AGREED){
    console.log(JSON.stringify({type:'taskmarket_cli_submit_skipped',reason:'operator_legal_acceptance_not_recorded',at:new Date().toISOString()}));
    return;
  }
  fs.mkdirSync(HOME_DIR,{recursive:true});
  fs.writeFileSync(ARTIFACT,Buffer.from(VERIFICATION_MD_B64,'base64'),{mode:0o600});

  const imported=await runCli(['wallet','import'],{importKey:true,timeoutMs:180000});
  console.log(JSON.stringify({type:'taskmarket_cli_wallet_import',...compact(imported),at:new Date().toISOString()}));
  if(imported.code!==0) throw new Error('Taskmarket wallet import failed');

  const address=await runCli(['address']);
  console.log(JSON.stringify({type:'taskmarket_cli_address',...compact(address),at:new Date().toISOString()}));
  if(address.code!==0) throw new Error('Taskmarket address check failed');

  const legal=await runCli(['legal','status']);
  console.log(JSON.stringify({type:'taskmarket_cli_legal_status',...compact(legal),at:new Date().toISOString()}));
  if(legal.code!==0) throw new Error('Taskmarket legal status failed');
  const ld=legal.parsed?.data||legal.parsed||{};
  const version=String(ld.bundleVersion||ld.bundle_version||'');
  if(version && version!=='2026-07-draft-2') throw new Error('Taskmarket legal bundle changed after operator review');
  const enforcement=Boolean(ld.enforcementEnabled??ld.enforcement_enabled);
  const accepted=Boolean(ld.accepted);
  if(enforcement && !accepted){
    const accept=await runCli(['legal','accept','--yes'],{timeoutMs:120000});
    console.log(JSON.stringify({type:'taskmarket_cli_legal_accept',...compact(accept),at:new Date().toISOString()}));
    if(accept.code!==0) throw new Error('Taskmarket legal enforcement is active and acceptance did not complete');
  }

  const task=await runCli(['task','get',TASK_ID],{timeoutMs:120000});
  console.log(JSON.stringify({type:'taskmarket_cli_task_get',taskId:TASK_ID,...compact(task),at:new Date().toISOString()}));
  if(task.code!==0) throw new Error('Taskmarket target fetch failed');
  const td=task.parsed?.data||task.parsed||{};
  const status=String(td.status||'').toLowerCase();
  if(status && status!=='open') throw new Error('Taskmarket target no longer open');
  const expiry=td.expiryTime||td.expiry_time||null;
  if(expiry && Date.parse(expiry)<=Date.now()) throw new Error('Taskmarket target expired');

  const mine=await runCli(['submission','list-mine'],{timeoutMs:120000}).catch(()=>null);
  if(mine){
    console.log(JSON.stringify({type:'taskmarket_cli_mine',...compact(mine),at:new Date().toISOString()}));
    const rows=Array.isArray(mine.parsed?.data)?mine.parsed.data:[];
    if(rows.some(x=>String(x.taskId||x.task_id||'')===TASK_ID && !x.rejectedAt && !x.rejected_at)){
      console.log(JSON.stringify({type:'taskmarket_submission_already_exists',taskId:TASK_ID,at:new Date().toISOString()}));
      return;
    }
  }

  const submit=await runCli(['task','submit',TASK_ID,'--file',ARTIFACT],{timeoutMs:240000});
  console.log(JSON.stringify({type:submit.code===0?'taskmarket_submission_created':'taskmarket_cli_submit_failed',taskId:TASK_ID,...compact(submit),at:new Date().toISOString()}));
  if(submit.code!==0) throw new Error('Taskmarket CLI submission failed');
}
function launch(){
  setTimeout(()=>main().catch(error=>console.error(JSON.stringify({type:'taskmarket_cli_worker_error',error:String(error?.message||error).slice(0,1200),at:new Date().toISOString()}))),12000).unref();
}
module.exports={launch};
