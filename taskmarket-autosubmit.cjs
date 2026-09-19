const crypto=require('crypto');
const TASKMARKET_API='https://api.taskmarket.dev/api';
const PRIVATE_KEY=String(process.env.TASKMARKET_WORKER_PRIVATE_KEY||'').trim();
const VERIFICATION_MD_B64=String(process.env.TASKMARKET_VERIFICATION_MD_B64||'').trim();
const OPERATOR_AGREED=String(process.env.TASKMARKET_OPERATOR_AGREED||'')==='1';
const ACCEPTED_BUNDLE_VERSION='2026-07-draft-2';
const ACCEPTED_DOC_HASHES=new Set([
  'sha256:764bef2617acce2570e261f1748ed0b8b9b22e52feb320213e4f5179a4e3d2df',
  'sha256:74e9f270919439f0d800f2b29ea95620fb829ebf137bfbe924654635c64b4afc',
  'sha256:23487ba68aab1278616ed3f5c89924d2b0b70eeb8b530b741a56e897ffe4e547',
  'sha256:768b41e7e1cc7a93b7279d6d4bac3b2b707d95c1b58b8a3cdd0e24af537f74c7'
]);

function rows(data){
  if(Array.isArray(data)) return data;
  for(const k of ['tasks','data','items','results']){
    if(Array.isArray(data?.[k])) return data[k];
    if(Array.isArray(data?.data?.[k])) return data.data[k];
  }
  return [];
}
async function json(url,options={}){
  const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),25000);
  try{
    const r=await fetch(url,{...options,signal:ctl.signal,headers:{accept:'application/json',...(options.headers||{})}});
    const raw=await r.text(); let data={};
    try{data=JSON.parse(raw)}catch{data={raw:raw.slice(0,1500)}}
    return {ok:r.ok,status:r.status,data,headers:r.headers};
  }finally{clearTimeout(timer)}
}
function isTarget(task){
  const t=String(task?.description||task?.title||task?.name||'');
  return /improve a coding agent.?s verification procedure/i.test(t) ||
    (/verification procedure/i.test(t) && /public examples/i.test(t) && /broken fixture/i.test(t));
}
function normalizeHash(v){
  const s=String(v||'').trim().toLowerCase();
  if(!s) return '';
  return s.startsWith('sha256:')?s:'sha256:'+s.replace(/^0x/,'');
}
function legalBundle(current){
  const d=current?.data&&typeof current.data==='object'?current.data:current||{};
  const version=String(d.bundleVersion||d.bundle_version||d.version||'').trim();
  const digest=String(d.bundleDigest||d.bundle_digest||d.digest||'').trim();
  const documents=Array.isArray(d.documents)?d.documents:[];
  const hashes=documents.map(x=>normalizeHash(x?.contentHash||x?.content_hash||x?.hash)).filter(Boolean);
  return {version,digest,documents,hashes,raw:d};
}
function assertReviewedBundle(bundle){
  if(!OPERATOR_AGREED) throw new Error('operator acceptance flag missing');
  if(bundle.version!==ACCEPTED_BUNDLE_VERSION) throw new Error('Taskmarket legal bundle changed since operator review');
  if(bundle.hashes.length!==4 || bundle.hashes.some(h=>!ACCEPTED_DOC_HASHES.has(h)) || ACCEPTED_DOC_HASHES.size!==new Set(bundle.hashes).size){
    throw new Error('Taskmarket legal document hashes changed since operator review');
  }
}
function receiptFrom(data){
  const d=data?.data&&typeof data.data==='object'?data.data:data||{};
  return String(d.receipt||d.acceptanceReceipt||d.legalReceipt||d.legal_receipt||d.token||'').trim();
}
async function ensureLegalAcceptance(account,workerAddress){
  const currentRes=await json(`${TASKMARKET_API}/legal/current`);
  if(!currentRes.ok) throw new Error(`legal current failed (${currentRes.status})`);
  const bundle=legalBundle(currentRes.data);
  assertReviewedBundle(bundle);
  console.log(JSON.stringify({type:'taskmarket_legal_bundle_verified',bundleVersion:bundle.version,bundleDigest:bundle.digest,documents:bundle.documents.map(x=>({title:x.title||null,version:x.version||null,contentHash:x.contentHash||x.content_hash||x.hash||null,url:x.url||null})),workerAddress,at:new Date().toISOString()}));

  const challengeKey=crypto.randomUUID();
  const challengeRes=await json(`${TASKMARKET_API}/legal/challenge`,{
    method:'POST',
    headers:{'content-type':'application/json','X-Taskmarket-Idempotency-Key':challengeKey},
    body:JSON.stringify({walletAddress:workerAddress})
  });
  if(!challengeRes.ok) throw new Error(`legal challenge failed (${challengeRes.status}): ${JSON.stringify(challengeRes.data).slice(0,500)}`);
  const ch=challengeRes.data?.data&&typeof challengeRes.data.data==='object'?challengeRes.data.data:challengeRes.data||{};
  const message=String(ch.message||'');
  const nonce=String(ch.nonce||'');
  const challengeVersion=String(ch.bundleVersion||ch.bundle_version||bundle.version);
  const challengeDigest=String(ch.bundleDigest||ch.bundle_digest||bundle.digest);
  if(!message||!nonce) throw new Error('legal challenge missing message or nonce');
  if(challengeVersion!==bundle.version || challengeDigest!==bundle.digest) throw new Error('legal challenge does not match reviewed bundle');
  const signature=await account.signMessage({message});
  const acceptKey=crypto.randomUUID();
  const acceptRes=await json(`${TASKMARKET_API}/legal/accept/wallet`,{
    method:'POST',
    headers:{'content-type':'application/json','X-Taskmarket-Idempotency-Key':acceptKey},
    body:JSON.stringify({
      walletAddress:workerAddress,
      signature,
      nonce,
      bundleVersion:bundle.version,
      bundleDigest:bundle.digest,
      agreedToTerms:true,
      agreedToAcceptableUse:true,
      acknowledgedRisk:true,
      receivedPrivacyNotice:true
    })
  });
  if(!acceptRes.ok) throw new Error(`legal accept failed (${acceptRes.status}): ${JSON.stringify(acceptRes.data).slice(0,700)}`);
  const receipt=receiptFrom(acceptRes.data);
  if(!receipt) throw new Error(`legal accept succeeded but receipt missing: ${JSON.stringify(acceptRes.data).slice(0,700)}`);
  console.log(JSON.stringify({type:'taskmarket_legal_acceptance_completed',bundleVersion:bundle.version,bundleDigest:bundle.digest,workerAddress,acceptedAt:acceptRes.data?.acceptedAt||acceptRes.data?.data?.acceptedAt||null,at:new Date().toISOString()}));
  return receipt;
}
async function worker(){
  if(!/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)||!VERIFICATION_MD_B64){
    console.log(JSON.stringify({type:'taskmarket_autosubmit_skipped',reason:'worker_key_or_artifact_missing',at:new Date().toISOString()}));
    return;
  }
  if(!OPERATOR_AGREED){
    console.log(JSON.stringify({type:'taskmarket_autosubmit_skipped',reason:'operator_legal_acceptance_not_recorded',at:new Date().toISOString()}));
    return;
  }
  const {privateKeyToAccount}=await import('viem/accounts');
  const {recoverMessageAddress}=await import('viem');
  const account=privateKeyToAccount(PRIVATE_KEY);
  const workerAddress=account.address.toLowerCase();

  const listing=await json(`${TASKMARKET_API}/tasks?status=open&limit=50&sort=reward_desc`);
  if(!listing.ok) throw new Error(`task list failed (${listing.status})`);
  const tasks=rows(listing.data);
  const task=tasks.find(isTarget);
  if(!task){
    console.log(JSON.stringify({type:'taskmarket_autosubmit_skipped',reason:'target_not_found',openTasks:tasks.length,workerAddress,at:new Date().toISOString()}));
    return;
  }
  const taskId=String(task.id||task.taskId||task.task_id||'').trim();
  if(!/^0x[0-9a-fA-F]{64}$/.test(taskId)) throw new Error('target task id invalid');

  // Fresh side-effect gate immediately before legal acceptance/submission.
  const detailRes=await json(`${TASKMARKET_API}/tasks/${encodeURIComponent(taskId)}`);
  if(!detailRes.ok) throw new Error(`task detail failed (${detailRes.status})`);
  const detail=detailRes.data?.data&&typeof detailRes.data.data==='object'?detailRes.data.data:detailRes.data||{};
  const status=String(detail.status||task.status||'').toLowerCase();
  const mode=String(detail.mode||task.mode||'').toLowerCase();
  const expiry=detail.expiryTime||detail.expiry_time||task.expiryTime||task.expiry_time||null;
  if(status!=='open') throw new Error(`target is no longer open (status=${status||'unknown'})`);
  if(mode && !['bounty','benchmark'].includes(mode)) throw new Error(`unexpected task mode ${mode}`);
  if(expiry && Date.parse(expiry)<=Date.now()) throw new Error('target task expired before submission');

  const mine=await json(`${TASKMARKET_API}/submissions/mine?workerAddress=${encodeURIComponent(workerAddress)}`);
  const mineRows=rows(mine.data);
  if(mine.ok && mineRows.some(x=>String(x.taskId||x.task_id||'')===taskId && !x.rejectedAt && !x.rejected_at)){
    console.log(JSON.stringify({type:'taskmarket_autosubmit_skipped',reason:'already_submitted',taskId,workerAddress,at:new Date().toISOString()}));
    return;
  }

  const legalReceipt=await ensureLegalAcceptance(account,workerAddress);

  // Re-fetch after legal write so task state is current at the actual submission boundary.
  const finalDetail=await json(`${TASKMARKET_API}/tasks/${encodeURIComponent(taskId)}`);
  const fd=finalDetail.data?.data&&typeof finalDetail.data.data==='object'?finalDetail.data.data:finalDetail.data||{};
  if(!finalDetail.ok || String(fd.status||'').toLowerCase()!=='open') throw new Error('target changed before final submission');

  const message=`taskmarket:submit:${taskId}`;
  const signature=await account.signMessage({message});
  const recovered=(await recoverMessageAddress({message,signature})).toLowerCase();
  if(recovered!==workerAddress) throw new Error('local submission signature recovery mismatch');

  const payload={
    taskId,
    workerAddress,
    artifacts:[{fileName:'verification.md',mimeType:'text/markdown',role:'final',file:VERIFICATION_MD_B64}],
    signature
  };
  const submitKey=crypto.randomUUID();
  async function submitWith(sig){
    return json(`${TASKMARKET_API}/tasks/${encodeURIComponent(taskId)}/submissions`,{
      method:'POST',
      headers:{
        'content-type':'application/json',
        'X-Taskmarket-Legal-Receipt':legalReceipt,
        'X-Taskmarket-Idempotency-Key':submitKey
      },
      body:JSON.stringify({...payload,signature:sig})
    });
  }
  function paritySignature(sig){
    const v=sig.slice(-2).toLowerCase();
    if(v==='1b') return sig.slice(0,-2)+'00';
    if(v==='1c') return sig.slice(0,-2)+'01';
    return sig;
  }
  let submit=await submitWith(signature);
  let signatureFormat='eip191-v27';
  if(submit.status===401 && /signature does not match worker address/i.test(String(submit.data?.message||submit.data?.error||''))){
    const parity=paritySignature(signature);
    if(parity!==signature){
      // Same logical operation, same idempotency key, exact same artifact/body except signature encoding.
      submit=await submitWith(parity);
      signatureFormat='eip191-v-parity';
    }
  }
  if(!submit.ok) throw new Error(`submission failed (${submit.status}): ${JSON.stringify(submit.data).slice(0,900)}`);
  console.log(JSON.stringify({
    type:'taskmarket_submission_created',
    taskId,
    submissionId:submit.data?.submissionId||submit.data?.data?.submissionId||null,
    workerAddress,
    signatureFormat,
    rewardBaseUnits:detail.reward||task.reward||null,
    netRewardBaseUnits:detail.netReward||detail.net_reward||task.netReward||task.net_reward||null,
    expiryTime:expiry,
    idempotencyKey:submitKey,
    at:new Date().toISOString()
  }));
}
function launch(){
  setTimeout(()=>worker().catch(error=>console.error(JSON.stringify({type:'taskmarket_autosubmit_error',error:String(error?.message||error).slice(0,1200),at:new Date().toISOString()}))),12000).unref();
}
module.exports={launch};
