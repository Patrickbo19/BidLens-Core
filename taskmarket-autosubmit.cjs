const TASKMARKET_API='https://api.taskmarket.dev/api';
const PRIVATE_KEY=String(process.env.TASKMARKET_WORKER_PRIVATE_KEY||'').trim();
const VERIFICATION_MD_B64=String(process.env.TASKMARKET_VERIFICATION_MD_B64||'').trim();

function rows(data){
  if(Array.isArray(data)) return data;
  for(const k of ['tasks','data','items','results']){
    if(Array.isArray(data?.[k])) return data[k];
    if(Array.isArray(data?.data?.[k])) return data.data[k];
  }
  return [];
}
async function json(url,options={}){
  const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),20000);
  try{
    const r=await fetch(url,{...options,signal:ctl.signal,headers:{accept:'application/json',...(options.headers||{})}});
    const text=await r.text(); let data={};
    try{data=JSON.parse(text)}catch{data={raw:text.slice(0,1000)}}
    return {ok:r.ok,status:r.status,data};
  }finally{clearTimeout(timer)}
}
function isTarget(task){
  const text=String(task?.description||task?.title||task?.name||'');
  return /improve a coding agent.?s verification procedure/i.test(text) ||
    (/verification procedure/i.test(text) && /public examples/i.test(text) && /broken fixture/i.test(text));
}
async function worker(){
  if(!/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)||!VERIFICATION_MD_B64){
    console.log(JSON.stringify({type:'taskmarket_autosubmit_skipped',reason:'worker_key_or_artifact_missing',at:new Date().toISOString()}));
    return;
  }
  const {privateKeyToAccount}=await import('viem/accounts');
  const account=privateKeyToAccount(PRIVATE_KEY);
  const listing=await json(`${TASKMARKET_API}/tasks?status=open&limit=50&sort=reward_desc`);
  if(!listing.ok) throw new Error(`task list failed (${listing.status})`);
  const tasks=rows(listing.data);
  const task=tasks.find(isTarget);
  if(!task){
    console.log(JSON.stringify({type:'taskmarket_autosubmit_skipped',reason:'target_not_found',openTasks:tasks.length,workerAddress:account.address,at:new Date().toISOString()}));
    return;
  }
  const taskId=String(task.id||task.taskId||task.task_id||'').trim();
  if(!taskId) throw new Error('target task missing id');
  const mine=await json(`${TASKMARKET_API}/submissions/mine?workerAddress=${encodeURIComponent(account.address)}`);
  const mineRows=rows(mine.data);
  if(mine.ok && mineRows.some(x=>String(x.taskId||x.task_id||'')===taskId)){
    console.log(JSON.stringify({type:'taskmarket_autosubmit_skipped',reason:'already_submitted',taskId,workerAddress:account.address,at:new Date().toISOString()}));
    return;
  }
  const signature=await account.signMessage({message:`taskmarket:submit:${taskId}`});
  const payload={
    taskId,
    workerAddress:account.address,
    artifacts:[{fileName:'verification.md',mimeType:'text/markdown',role:'final',file:VERIFICATION_MD_B64}],
    signature
  };
  const submit=await json(`${TASKMARKET_API}/tasks/${encodeURIComponent(taskId)}/submissions`,{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)
  });
  if(!submit.ok) throw new Error(`submission failed (${submit.status}): ${JSON.stringify(submit.data).slice(0,500)}`);
  console.log(JSON.stringify({
    type:'taskmarket_submission_created',taskId,submissionId:submit.data?.submissionId||submit.data?.data?.submissionId||null,
    workerAddress:account.address,rewardBaseUnits:task.reward||null,netRewardBaseUnits:task.netReward||null,
    expiryTime:task.expiryTime||null,at:new Date().toISOString()
  }));
}
function launch(){
  setTimeout(()=>worker().catch(error=>console.error(JSON.stringify({type:'taskmarket_autosubmit_error',error:String(error?.message||error).slice(0,800),at:new Date().toISOString()}))),12000).unref();
}
module.exports={launch};
