const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const vault = require('./taskbounty-vault.cjs');
const moltbookVault = require('./moltbook-vault.cjs');
const superteamVault = require('./superteam-vault.cjs');
const superteamBootstrap = require('./superteam-bootstrap.cjs');

const PORT = Number(process.env.PORT || 3000);
const CORE_PORT = Number(process.env.SELLER_INTERNAL_PORT || 3901);
const TASKBOUNTY_API = 'https://www.task-bounty.com/api/v1';
const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';
const BOOTSTRAP_NONCE = String(process.env.TASKBOUNTY_BOOTSTRAP_NONCE || '').trim();
const SOLVER_KEY = String(process.env.TASKBOUNTY_SOLVER_KEY || '').trim();

function sendJson(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  res.end(JSON.stringify(data));
}

function readBody(req, max = 12000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > max) reject(new Error('body too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: ctl.signal, headers: { accept: 'application/json', ...(options.headers || {}) } });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
    return { ok: r.ok, status: r.status, data };
  } finally { clearTimeout(timer); }
}

function countTasks(data) {
  if (Array.isArray(data)) return data.length;
  for (const key of ['data', 'tasks', 'items', 'results']) if (Array.isArray(data?.[key])) return data[key].length;
  return null;
}

// Moltbook compliance mode: only inspect our own post-level state and expose
// aggregate counters. Do not fetch/re-publish comment bodies, author names,
// profile details, or other third-party Moltbook content through this service.
async function moltbookDemandStatus() {
  const state = await moltbookVault.status();
  if (!state.connected) {
    return {
      connected: false,
      claimStatus: state.claimStatus || null,
      postId: null,
      checkedAt: new Date().toISOString(),
      thirdPartyContentExposed: false,
    };
  }

  const apiKey = await moltbookVault.getApiKey();
  const postId = state.firstPostId;
  if (!apiKey || !postId) {
    return {
      connected: true,
      claimStatus: state.claimStatus || null,
      postId: postId || null,
      checkedAt: new Date().toISOString(),
      thirdPartyContentExposed: false,
    };
  }

  const headers = { authorization: `Bearer ${apiKey}` };
  const postResp = await fetchJson(`${MOLTBOOK_API}/posts/${encodeURIComponent(postId)}`, { headers })
    .catch(error => ({ ok:false, status:null, data:{}, error:String(error?.message || error) }));
  const post = postResp.data?.post || postResp.data?.data?.post || postResp.data?.data || postResp.data || {};
  const commentCount = Number(post?.comment_count ?? post?.comments_count ?? 0) || 0;

  return {
    connected: true,
    claimStatus: state.claimStatus || null,
    agentName: state.agentName || null,
    postId,
    postUrl: `https://www.moltbook.com/post/${postId}`,
    postHttpStatus: postResp.status,
    commentCount,
    hasReplies: commentCount > 0,
    score: post?.score ?? post?.upvotes ?? null,
    checkedAt: new Date().toISOString(),
    thirdPartyContentExposed: false,
  };
}

let superteamFeedCache = { at:0, data:null };
const SUPERTEAM_FEED_CACHE_MS = 5 * 60 * 1000;

async function superteamFeed() {
  if (superteamFeedCache.data && Date.now() - superteamFeedCache.at < SUPERTEAM_FEED_CACHE_MS) return superteamFeedCache.data;
  const state = await superteamVault.init();
  const status = await superteamVault.status();
  if (!state.persistent || !status.connected) {
    const data = { ok:false, connected:false, candidates:[], checkedAt:new Date().toISOString() };
    superteamFeedCache = { at:Date.now(), data };
    return data;
  }
  const agent = await superteamVault.getAgent();
  if (!agent) {
    const data = { ok:false, connected:false, candidates:[], checkedAt:new Date().toISOString() };
    superteamFeedCache = { at:Date.now(), data };
    return data;
  }
  let scan = await superteamBootstrap.scan(agent);
  for (let attempt=0; scan?.skipped && attempt<4; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    scan = await superteamBootstrap.scan(agent);
  }
  if (scan?.skipped) {
    return { ok:false, connected:true, busy:true, candidates:[], checkedAt:new Date().toISOString() };
  }
  const candidates = (scan.candidates || []).map(item => ({
    id:item.id || null,
    slug:item.slug || null,
    title:item.title || null,
    type:item.type || null,
    agentAccess:item.agentAccess || null,
    payout_usdc:Number.isFinite(Number(item.compensationUsd)) ? Number(item.compensationUsd) : null,
    deadline:item.deadline || null,
    expired:Boolean(item.expired),
    blockers:Array.isArray(item.blockers) ? item.blockers : [],
    autonomousCandidate:Boolean(item.autonomousCandidate),
    source_url:item.slug ? `https://superteam.fun/earn/listing/${encodeURIComponent(item.slug)}` : 'https://superteam.fun/earn/agents',
    funding_evidence:'platform-listed-reward',
    status:item.expired ? 'expired' : 'open'
  }));
  const data = {
    ok:true,
    connected:true,
    source:'Superteam Earn',
    agentEligibleOnly:true,
    listingCount:scan.listingCount || 0,
    currentListingCount:scan.currentListingCount || 0,
    autonomousCandidateCount:scan.autonomousCandidateCount || 0,
    candidates,
    checkedAt:new Date().toISOString()
  };
  superteamFeedCache = { at:Date.now(), data };
  return data;
}

function taskRows(data) {
  if (Array.isArray(data)) return data;
  for (const key of ['data','tasks','items','results']) {
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data?.[key])) return data.data[key];
  }
  return [];
}

function safeTaskBountyCandidate(row = {}) {
  const id = String(row.id || row.task_id || row.taskId || '').trim().slice(0,120) || null;
  const title = String(row.title || row.name || row.summary || row.description || 'TaskBounty task').trim().slice(0,300);
  const payoutRaw = row.payout_usdc ?? row.reward_usdc ?? row.reward ?? row.payout ?? row.amount_usdc ?? row.amount ?? row.bounty;
  const payout = Number(payoutRaw);
  const bondRaw = row.bond_usdc ?? row.bond ?? row.required_bond ?? row.solver_bond ?? row.deposit ?? 0;
  const bond = Number(bondRaw);
  const deadline = String(row.deadline || row.expires_at || row.expiresAt || row.submission_deadline || row.submissionDeadline || '').trim().slice(0,100) || null;
  const state = String(row.state || row.status || 'open').trim().slice(0,60);
  const platform = String(row.platform || row.source_platform || '').trim().slice(0,80) || null;
  const language = String(row.language || row.programming_language || '').trim().slice(0,80) || null;
  const verifier = String(row.verifier || row.verification || row.acceptance_rule || row.acceptance || '').trim().slice(0,500) || null;
  const repo = String(row.repo_url || row.repository_url || row.repository || '').trim().slice(0,500) || null;
  const sourceUrl = String(row.url || row.task_url || row.link || '').trim().slice(0,500) || (id ? `https://www.task-bounty.com/tasks/${encodeURIComponent(id)}` : 'https://www.task-bounty.com/');
  return {
    id,
    title,
    payout_usdc:Number.isFinite(payout) ? payout : null,
    bond_usdc:Number.isFinite(bond) && bond > 0 ? bond : 0,
    deadline,
    status:state,
    platform,
    language,
    verifier,
    repository_url:repo,
    source_url:sourceUrl,
    funded:Boolean(row.funded === true || row.escrowed === true || row.funding_status === 'funded' || row.fundingStatus === 'funded'),
    funding_evidence:row.funded === true || row.escrowed === true || row.funding_status === 'funded' || row.fundingStatus === 'funded' ? 'taskbounty-reported-funded' : null
  };
}

async function taskBountyFeed() {
  const status = await vault.status();
  if (!status.connected) return { ok:false, connected:false, candidates:[], checkedAt:new Date().toISOString() };
  const token = await vault.getToken();
  if (!token) return { ok:false, connected:true, authReady:false, candidates:[], checkedAt:new Date().toISOString() };
  const check = await fetchJson(`${TASKBOUNTY_API}/tasks?state=open&limit=50`, { headers: { authorization: `Bearer ${token}` } }, 30000);
  if (check.ok) await vault.markVerified();
  return {
    ok:check.ok,
    connected:true,
    authReady:check.ok,
    source:'TaskBounty',
    candidates:check.ok ? taskRows(check.data).map(safeTaskBountyCandidate).slice(0,50) : [],
    authHttpStatus:check.status,
    checkedAt:new Date().toISOString()
  };
}

const TASKMARKET_API = 'https://api.taskmarket.dev/api';
const APX_ORIGIN = String(process.env.PUBLIC_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/,'');

function apxText(v, max=500) { return v == null ? '' : String(v).trim().slice(0,max); }
function apxNum(v) { const n=Number(v); return Number.isFinite(n) ? n : null; }
function apxId(parts) { return 'opp_' + crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0,24); }
function apxDelegation(input={}) {
  const agent=input.agent && typeof input.agent==='object' ? input.agent : {};
  const authority=input.authority && typeof input.authority==='object' ? input.authority : input;
  const preferences=input.preferences && typeof input.preferences==='object' ? input.preferences : input;
  return {
    rootSessionId:apxText(input.root_session_id || agent.root_session_id,160) || null,
    agentId:apxText(agent.id || input.agent_id,160) || 'anonymous-worker',
    parentAgentId:apxText(agent.parent_id || input.parent_agent_id,160) || null,
    lineageDepth:Math.max(0,Math.min(32,Math.floor(apxNum(agent.lineage_depth ?? input.lineage_depth) || 0))),
    capabilities:Array.isArray(agent.capabilities || input.capabilities) ? (agent.capabilities || input.capabilities).map(x=>apxText(x,80)).filter(Boolean).slice(0,50) : [],
    maxSpendUsdc:Math.max(0,Math.min(100000,apxNum(authority.max_spend_usdc ?? input.budget_usdc) || 0)),
    maxLossUsdc:Math.max(0,Math.min(100000,apxNum(authority.max_loss_usdc) || 0)),
    minPayoutUsdc:Math.max(0,Math.min(100000,apxNum(preferences.min_payout_usdc ?? input.min_payout_usdc) || 0)),
    maxTimeToPaymentHours:Math.max(0,Math.min(8760,apxNum(preferences.max_time_to_payment_hours ?? input.max_time_to_payment_hours) || 0)) || null,
    expiresAt:apxText(authority.expires_at || input.expires_at,100) || null,
    allowedActions:Array.isArray(authority.allowed_actions || input.allowed_actions) ? (authority.allowed_actions || input.allowed_actions).map(x=>apxText(x,80)).filter(Boolean).slice(0,50) : []
  };
}
function apxCapabilityFit(item,caps) {
  if (!caps.length) return true;
  const hay=[item.title,item.description,item.language,item.platform,...(item.tags||[])].join(' ').toLowerCase();
  return caps.some(c=>hay.includes(c.toLowerCase())) ||
    (caps.some(c=>/code|software|developer/i.test(c)) && /code|github|software|developer|cuda|program|repo|verification/i.test(hay)) ||
    (caps.some(c=>/research|analysis|data/i.test(c)) && /research|analysis|data|report|document|benchmark/i.test(hay));
}
function apxBlockerAllowed(blocker,allowed) {
  const a=(allowed||[]).map(x=>String(x).toLowerCase());
  if (blocker==='social_account_or_content') return a.some(x=>['social_content','social_posting','use_social_account'].includes(x));
  if (blocker==='human_identity_or_signing') return a.includes('human_gate_available');
  if (blocker==='manual_human_interaction') return a.includes('human_interaction_available');
  if (blocker==='telegram_required') return a.includes('telegram_available');
  return false;
}
function apxEvaluate(item,d) {
  const payout=Number(item.payoutUsdc || 0), cost=Number(item.maxCostUsdc || 0);
  const blockers=(item.blockers||[]).filter(x=>!apxBlockerAllowed(x,d.allowedActions));
  if (blockers.length) return {...item,eligible:false,reason:'delegation_blocked:'+blockers.join(','),score:-1};
  if (item.deadline && Number.isFinite(Date.parse(item.deadline)) && Date.parse(item.deadline)<=Date.now()) return {...item,eligible:false,reason:'expired_deadline',score:-1};
  if (cost>d.maxSpendUsdc) return {...item,eligible:false,reason:'cost_above_owner_budget',score:-1};
  if (d.maxLossUsdc>0 && cost>d.maxLossUsdc) return {...item,eligible:false,reason:'loss_exposure_above_owner_limit',score:-1};
  if (payout<d.minPayoutUsdc) return {...item,eligible:false,reason:'payout_below_minimum',score:-1};
  if (!apxCapabilityFit(item,d.capabilities)) return {...item,eligible:false,reason:'capability_mismatch',score:-1};
  if (!item.funded) return {...item,eligible:false,reason:'funding_not_verified',score:-1};
  if (payout<=cost) return {...item,eligible:false,reason:'payout_does_not_cover_cost',score:-1};
  const tier=item.verifier ? 'VALIDATED' : 'SIGNAL';
  const roi=payout/Math.max(0.01,cost||0.01);
  const score=Math.min(100,Math.round((tier==='VALIDATED'?35:15)+Math.min(40,Math.log10(Math.max(1,roi))*18)+Math.min(25,payout)));
  return {...item,eligible:true,reason:null,evidenceTier:tier,score,expectedGrossUsdc:payout,expectedSpreadUsdc:payout-cost};
}
async function taskmarketFeed() {
  const r=await fetchJson(`${TASKMARKET_API}/tasks?status=open&limit=50&sort=reward_desc`,{},30000);
  const tasks=Array.isArray(r.data?.tasks)?r.data.tasks:[];
  return {
    ok:r.ok,
    source:'Taskmarket',
    candidates:tasks.map(task=>{
      const payout=apxNum(task.reward);
      const escrow=apxText(task.escrowTxHash,180);
      const taskId=apxText(task.id,180);
      return {
        source:'Taskmarket',
        sourceTaskId:taskId||null,
        title:apxText(task.description || 'Taskmarket task',300).split('\n')[0],
        description:apxText(task.description,3000)||null,
        tags:Array.isArray(task.tags)?task.tags.map(x=>apxText(x,80)).filter(Boolean).slice(0,20):[],
        mode:apxText(task.mode,80)||null,
        payoutUsdc:payout===null?null:payout/1e6,
        maxCostUsdc:0,
        funded:Boolean(escrow),
        fundingEvidence:escrow ? 'base-usdc-escrow:'+escrow : null,
        verifier:task.mode==='benchmark' ? 'Taskmarket benchmark/metric settlement' : 'Taskmarket requester acceptance / contract settlement',
        deadline:apxText(task.expiryTime,100)||null,
        blockers:[],
        url:taskId ? `${TASKMARKET_API}/tasks/${encodeURIComponent(taskId)}` : 'https://taskmarket.dev'
      };
    }),
    checkedAt:new Date().toISOString()
  };
}
function superteamApxItems(feed) {
  return (feed.candidates||[]).map(x=>({
    source:'Superteam Earn',
    sourceTaskId:x.id||x.slug||null,
    title:apxText(x.title,300)||'Superteam opportunity',
    description:null,
    tags:[],
    mode:apxText(x.type,80)||null,
    payoutUsdc:apxNum(x.payout_usdc),
    maxCostUsdc:0,
    funded:false,
    fundingEvidence:null,
    verifier:null,
    deadline:x.deadline||null,
    blockers:Array.isArray(x.blockers)?x.blockers:[],
    url:x.source_url||null
  }));
}
function taskBountyApxItems(feed) {
  return (feed.candidates||[]).map(x=>({
    source:'TaskBounty',
    sourceTaskId:x.id||null,
    title:apxText(x.title,300)||'TaskBounty task',
    description:null,
    tags:[x.language,x.platform].filter(Boolean),
    mode:'bounty',
    payoutUsdc:apxNum(x.payout_usdc),
    maxCostUsdc:Math.max(0,apxNum(x.bond_usdc)||0),
    funded:Boolean(x.funded),
    fundingEvidence:x.funding_evidence||null,
    verifier:x.verifier||null,
    deadline:x.deadline||null,
    blockers:[],
    url:x.source_url||null
  }));
}
async function apxMakeMoney(input={}) {
  const delegation=apxDelegation(input);
  const [tm,tb,st]=await Promise.all([
    taskmarketFeed().catch(error=>({ok:false,source:'Taskmarket',candidates:[],error:String(error?.message||error).slice(0,250)})),
    taskBountyFeed().catch(error=>({ok:false,source:'TaskBounty',candidates:[],error:String(error?.message||error).slice(0,250)})),
    superteamFeed().catch(error=>({ok:false,source:'Superteam Earn',candidates:[],error:String(error?.message||error).slice(0,250)}))
  ]);
  const items=[...(tm.candidates||[]),...taskBountyApxItems(tb),...superteamApxItems(st)].map(x=>({...x,opportunityId:apxId([x.source,x.sourceTaskId||'',x.title,x.url||'',String(x.payoutUsdc??'')])}));
  const evaluated=items.map(x=>apxEvaluate(x,delegation));
  const opportunities=evaluated.filter(x=>x.eligible).sort((a,b)=>b.score-a.score || (b.payoutUsdc||0)-(a.payoutUsdc||0));
  const rejected=evaluated.filter(x=>!x.eligible);
  return {
    ok:true,
    product:'Agent Profit Exchange',
    version:'0.4',
    command:'MAKE_MONEY',
    generatedAt:new Date().toISOString(),
    delegation,
    sourceStatus:[
      {source:'Taskmarket',ok:Boolean(tm.ok),candidates:(tm.candidates||[]).length,error:tm.error||null},
      {source:'TaskBounty',ok:Boolean(tb.ok),candidates:(tb.candidates||[]).length,error:tb.error||null},
      {source:'Superteam Earn',ok:Boolean(st.ok),candidates:(st.candidates||[]).length,error:st.error||null}
    ],
    opportunities:opportunities.slice(0,25).map((x,i)=>({...x,handoff:{rank:i+1,agentId:delegation.agentId,parentAgentId:delegation.parentAgentId,rootSessionId:delegation.rootSessionId,sourceUrl:x.url,paidExecutionPacket:{method:'POST',url:`${APX_ORIGIN}/apx/execution-packet`,priceUsdc:0.01,opportunityId:x.opportunityId}}})),
    rejected:rejected.slice(0,50)
  };
}

async function taskBountyStatus() {
  const status = await vault.status();
  if (!status.connected) return { ...status, authReady: false, openTaskCount: null };
  const token = await vault.getToken();
  const check = await fetchJson(`${TASKBOUNTY_API}/tasks?state=open&limit=50`, { headers: { authorization: `Bearer ${token}` } });
  if (check.ok) await vault.markVerified();
  return { ...status, authReady: check.ok, openTaskCount: check.ok ? countTasks(check.data) : null, authHttpStatus: check.status };
}

function secureEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function solverAuthorized(req) {
  return Boolean(SOLVER_KEY && secureEqual(req.headers['x-income2-solver-key'], SOLVER_KEY));
}

async function taskBountyRequest(path, options = {}) {
  const token = await vault.getToken();
  if (!token) return { ok: false, status: 503, data: { message: 'TaskBounty authentication is not ready.' } };
  const headers = { authorization: `Bearer ${token}`, ...(options.headers || {}) };
  return fetchJson(`${TASKBOUNTY_API}${path}`, { ...options, headers }, options.timeoutMs || 30000);
}

function cleanId(value) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9_-]{1,120}$/.test(id) ? id : null;
}

async function handleSolver(req, res, url) {
  if (!url.pathname.startsWith('/taskbounty/solver/')) return false;
  if (!solverAuthorized(req)) {
    sendJson(res, 401, { ok: false, message: 'solver authorization required' });
    return true;
  }

  const relative = url.pathname.slice('/taskbounty/solver'.length);

  if (req.method === 'GET' && relative === '/status') {
    const status = await taskBountyStatus().catch(error => ({ connected: false, authReady: false, error: String(error?.message || error).slice(0, 300) }));
    sendJson(res, 200, { ok: true, taskBounty: status, capabilities: ['list_open_tasks', 'get_task', 'request_readonly_repo_access', 'submit_patch', 'check_submission'] });
    return true;
  }

  if (req.method === 'GET' && relative === '/tasks') {
    const params = new URLSearchParams();
    params.set('state', 'open');
    const requestedLimit = Number(url.searchParams.get('limit') || 10);
    params.set('limit', String(Math.max(1, Math.min(25, Number.isFinite(requestedLimit) ? requestedLimit : 10))));
    for (const key of ['language', 'platform']) {
      const value = String(url.searchParams.get(key) || '').trim();
      if (value) params.set(key, value.slice(0, 80));
    }
    const upstream = await taskBountyRequest(`/tasks?${params.toString()}`);
    sendJson(res, upstream.status, upstream.data);
    return true;
  }

  const taskMatch = relative.match(/^\/tasks\/([^/]+)$/);
  if (req.method === 'GET' && taskMatch) {
    const taskId = cleanId(decodeURIComponent(taskMatch[1]));
    if (!taskId) { sendJson(res, 400, { ok: false, message: 'invalid task id' }); return true; }
    const upstream = await taskBountyRequest(`/tasks/${encodeURIComponent(taskId)}`);
    sendJson(res, upstream.status, upstream.data);
    return true;
  }

  const accessMatch = relative.match(/^\/tasks\/([^/]+)\/access$/);
  if (req.method === 'POST' && accessMatch) {
    const taskId = cleanId(decodeURIComponent(accessMatch[1]));
    if (!taskId) { sendJson(res, 400, { ok: false, message: 'invalid task id' }); return true; }
    let body = {};
    try { body = JSON.parse(await readBody(req, 4000) || '{}'); } catch {}
    const agentId = body.agent_id ? cleanId(body.agent_id) : null;
    if (body.agent_id && !agentId) { sendJson(res, 400, { ok: false, message: 'invalid agent id' }); return true; }
    const upstream = await taskBountyRequest(`/tasks/${encodeURIComponent(taskId)}/access`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(agentId ? { agent_id: agentId } : {}),
    });
    sendJson(res, upstream.status, upstream.data);
    return true;
  }

  if (req.method === 'POST' && relative === '/submissions/patch') {
    let body;
    try { body = JSON.parse(await readBody(req, 2_500_000) || '{}'); }
    catch { sendJson(res, 400, { ok: false, message: 'invalid JSON body' }); return true; }
    const taskId = cleanId(body.task_id);
    const agentId = cleanId(body.agent_id);
    const resultText = String(body.result_text || '').trim().slice(0, 1000);
    const patch = String(body.patch || '');
    const testOutput = body.test_output == null ? undefined : String(body.test_output).slice(0, 65536);
    if (!taskId || !agentId || !resultText || !patch) {
      sendJson(res, 422, { ok: false, message: 'task_id, agent_id, result_text, and patch are required' });
      return true;
    }
    if (patch.length > 2_000_000) {
      sendJson(res, 413, { ok: false, message: 'patch exceeds 2 MB solver bridge limit' });
      return true;
    }
    const payload = { task_id: taskId, agent_id: agentId, result_text: resultText, patch };
    if (testOutput !== undefined) payload.test_output = testOutput;
    const upstream = await taskBountyRequest('/submissions/patch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: 60000,
    });
    console.log(JSON.stringify({ type: 'taskbounty_patch_submission', taskId, upstreamStatus: upstream.status, accepted: upstream.ok, at: new Date().toISOString() }));
    sendJson(res, upstream.status, upstream.data);
    return true;
  }

  const submissionMatch = relative.match(/^\/submissions\/([^/]+)$/);
  if (req.method === 'GET' && submissionMatch) {
    const submissionId = cleanId(decodeURIComponent(submissionMatch[1]));
    if (!submissionId) { sendJson(res, 400, { ok: false, message: 'invalid submission id' }); return true; }
    const upstream = await taskBountyRequest(`/submissions/${encodeURIComponent(submissionId)}`);
    sendJson(res, upstream.status, upstream.data);
    return true;
  }

  sendJson(res, 404, { ok: false, message: 'solver operation not allowed' });
  return true;
}

async function handleVault(req, res, path) {
  if (path === '/apx/card' && req.method === 'GET') {
    sendJson(res,200,{name:'Agent Profit Exchange',short_name:'APX',version:'0.4',description:'Economic routing for AI-created worker agents.',commands:['MAKE_MONEY'],endpoints:{make_money:`${APX_ORIGIN}/apx/make-money`,execution_packet:`${APX_ORIGIN}/apx/execution-packet`,protocol:`${APX_ORIGIN}/apx/protocol`},payments:{protocol:'x402',network:'eip155:8453',asset:'USDC',execution_packet_price_usdc:0.01},custody:false});
    return true;
  }
  if (path === '/apx/protocol' && req.method === 'GET') {
    sendJson(res,200,{name:'Agent Profit Exchange',version:'0.4',controlChain:['human_owner','primary_ai_orchestrator','worker_agent','APX','funded_source_rail'],preferredCall:{method:'POST',path:'/apx/make-money'},delegationFields:['root_session_id','agent.id','agent.parent_id','agent.capabilities','authority.max_spend_usdc','authority.max_loss_usdc','authority.allowed_actions','preferences.min_payout_usdc','preferences.max_time_to_payment_hours'],paidExecutionPacket:{method:'POST',path:'/apx/execution-packet',priceUsdc:0.01,payment:'x402 Base USDC'}});
    return true;
  }
  if (path === '/apx/make-money' && (req.method === 'POST' || req.method === 'GET')) {
    let input={};
    if (req.method === 'POST') {
      try { input=JSON.parse((await readBody(req,128000))||'{}'); }
      catch { sendJson(res,400,{ok:false,message:'invalid JSON'}); return true; }
    } else {
      const u=new URL(req.url||'','http://localhost');
      input={budget_usdc:u.searchParams.get('budget_usdc'),max_loss_usdc:u.searchParams.get('max_loss_usdc'),min_payout_usdc:u.searchParams.get('min_payout_usdc'),agent_id:u.searchParams.get('agent_id'),parent_agent_id:u.searchParams.get('parent_agent_id'),root_session_id:u.searchParams.get('root_session_id'),capabilities:String(u.searchParams.get('capabilities')||'').split(',').map(x=>x.trim()).filter(Boolean)};
    }
    const result=await apxMakeMoney(input).catch(error=>({ok:false,message:String(error?.message||error).slice(0,300)}));
    sendJson(res,result.ok?200:503,result);
    return true;
  }

  if (path === '/apx/taskbounty-feed' && req.method === 'GET') {
    const feed = await taskBountyFeed().catch(error => ({ ok:false, connected:true, authReady:false, candidates:[], error:String(error?.message || error).slice(0,300), checkedAt:new Date().toISOString() }));
    sendJson(res, 200, feed);
    return true;
  }

  if (path === '/apx/superteam-feed' && req.method === 'GET') {
    const feed = await superteamFeed().catch(error => ({ ok:false, connected:true, candidates:[], error:String(error?.message || error).slice(0,300), checkedAt:new Date().toISOString() }));
    sendJson(res, 200, feed);
    return true;
  }

  if (path === '/taskbounty/status') {
    const status = await taskBountyStatus().catch(error => ({ connected: false, authReady: false, error: String(error?.message || error).slice(0, 300) }));
    sendJson(res, 200, { ok: true, taskBounty: status });
    return true;
  }

  if (path === '/moltbook/demand-status' && req.method === 'GET') {
    const status = await moltbookDemandStatus().catch(error => ({
      connected: true,
      error: String(error?.message || error).slice(0, 300),
      checkedAt: new Date().toISOString(),
      thirdPartyContentExposed: false,
    }));
    sendJson(res, 200, { ok: true, moltbook: status });
    return true;
  }

  if (!BOOTSTRAP_NONCE || path !== `/taskbounty/bootstrap/${BOOTSTRAP_NONCE}`) return false;
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, message: 'POST required' });
    return true;
  }

  try {
    const existing = await vault.status();
    if (existing.connected) {
      sendJson(res, 409, { ok: false, message: 'TaskBounty credential already stored; bootstrap closed.' });
      return true;
    }
    const raw = await readBody(req);
    let body;
    try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
    const accessToken = String(body.access_token || '').trim();
    const taskbountyUserId = String(body.taskbounty_user_id || '').trim() || null;
    if (!accessToken) {
      sendJson(res, 422, { ok: false, message: 'access_token required' });
      return true;
    }
    const verify = await fetchJson(`${TASKBOUNTY_API}/tasks?state=open&limit=1`, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!verify.ok) {
      sendJson(res, 401, { ok: false, message: `TaskBounty credential validation failed (${verify.status}).` });
      return true;
    }
    await vault.storeToken(accessToken, taskbountyUserId);
    const status = await taskBountyStatus();
    console.log(JSON.stringify({ type: 'taskbounty_credential_stored', encryptedAtRest: true, taskbountyUserIdPresent: Boolean(taskbountyUserId), authReady: status.authReady, at: new Date().toISOString() }));
    sendJson(res, 201, { ok: true, stored: true, encryptedAtRest: true, taskBounty: status });
  } catch (error) {
    console.error(JSON.stringify({ type: 'taskbounty_bootstrap_error', error: String(error?.message || error).slice(0, 500) }));
    sendJson(res, 500, { ok: false, message: 'TaskBounty credential bootstrap failed.' });
  }
  return true;
}

function proxy(req, res) {
  const headers = {
    ...req.headers,
    host: req.headers.host || 'earn-tools-backend.onrender.com',
    'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'https',
  };
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: CORE_PORT,
    path: req.url,
    method: req.method,
    headers,
  }, upstreamRes => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', error => {
    console.error(JSON.stringify({ type: 'seller_proxy_error', error: String(error?.message || error).slice(0, 300) }));
    if (!res.headersSent) sendJson(res, 503, { ok: false, message: 'Seller core is waking up.' });
    else res.end();
  });
  req.pipe(upstream);
}

(async () => {
  const vaultState = await vault.init();
  const moltbookVaultState = await moltbookVault.init().catch(() => ({ persistent:false, configured:false }));
  console.log(JSON.stringify({ type: 'taskbounty_vault_init', persistent: vaultState.persistent, configured: vaultState.configured, solverBridge: Boolean(SOLVER_KEY), moltbookVault: Boolean(moltbookVaultState.persistent) }));

  const core = spawn(process.execPath, ['seller-core.js'], {
    env: { ...process.env, PORT: String(CORE_PORT) },
    stdio: 'inherit',
  });
  core.on('exit', (code, signal) => {
    console.error(JSON.stringify({ type: 'seller_core_exit', code, signal }));
    process.exit(code || 1);
  });

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (await handleSolver(req, res, url)) return;
      if (await handleVault(req, res, url.pathname)) return;
      proxy(req, res);
    } catch (error) {
      console.error(JSON.stringify({ type: 'seller_wrapper_error', error: String(error?.message || error).slice(0, 500) }));
      if (!res.headersSent) sendJson(res, 500, { ok: false, message: 'internal error' });
      else res.end();
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`INCOME 2 seller gateway listening on ${PORT}; core=${CORE_PORT}; vault=postgres; solverBridge=${SOLVER_KEY ? 'enabled' : 'disabled'}`);
    setTimeout(() => apxMakeMoney({
      budget_usdc:10.5,max_loss_usdc:10.5,min_payout_usdc:0,
      agent:{id:'apx-live-scout',capabilities:['coding','research','analysis','data']}
    }).then(result => console.log(JSON.stringify({
      type:'apx_live_scan',sourceStatus:result.sourceStatus,eligibleCount:result.opportunities.length,
      top:result.opportunities.slice(0,10).map(x=>({opportunityId:x.opportunityId,sourceTaskId:x.sourceTaskId,source:x.source,title:x.title,payoutUsdc:x.payoutUsdc,maxCostUsdc:x.maxCostUsdc,deadline:x.deadline,url:x.url,tags:x.tags,mode:x.mode})),
      at:new Date().toISOString()
    }))).catch(error=>console.error(JSON.stringify({type:'apx_live_scan_error',error:String(error?.message||error).slice(0,500),at:new Date().toISOString()}))),15000).unref();
  });

  const stop = () => {
    try { core.kill('SIGTERM'); } catch {}
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
