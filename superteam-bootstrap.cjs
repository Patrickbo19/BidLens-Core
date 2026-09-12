const vault = require('./superteam-vault.cjs');

const BASE = 'https://superteam.fun';
const ENABLED = ['1','true','yes'].includes(String(process.env.SUPERTEAM_AGENT_ENABLED || '').trim().toLowerCase());
const AGENT_NAME = String(process.env.SUPERTEAM_AGENT_NAME || 'Income2').trim() || 'Income2';
const SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000;
const TAKE = 50;

let interval = null;
let scanInFlight = false;

async function request(path, options = {}, timeoutMs = 20000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE}${path}`, {
      ...options,
      signal: ctl.signal,
      headers: { accept:'application/json', ...(options.headers || {}) },
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw:text.slice(0, 1000) }; }
    return { ok:response.ok, status:response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function safeError(data) {
  return String(data?.error || data?.message || data?.raw || 'unknown error').slice(0, 300);
}

function pick(data, keys) {
  for (const key of keys) {
    if (data && data[key] != null) return data[key];
    if (data?.data && data.data[key] != null) return data.data[key];
  }
  return null;
}

function listingArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  for (const key of ['listings','items','results']) {
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data?.[key])) return data.data[key];
  }
  return [];
}

function cleanString(value, max = 220) {
  return typeof value === 'string' ? value.trim().slice(0, max) : null;
}

function listingIdentity(row) {
  return {
    id:String(row?.id || row?._id || row?.listingId || '').trim() || null,
    slug:cleanString(row?.slug || row?.listingSlug, 160),
    title:cleanString(row?.title || row?.name, 180),
    type:cleanString(row?.type || row?.listingType, 40),
    agentAccess:cleanString(row?.agentAccess || row?.agent_access, 40),
  };
}

function moneyNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function compensationUsd(row) {
  const directKeys = ['rewardAmount','totalPrize','totalReward','amount','compensation','payment','budget','prize'];
  for (const key of directKeys) {
    const n = moneyNumber(row?.[key]);
    if (n != null) return n;
  }
  const rewards = Array.isArray(row?.rewards) ? row.rewards : [];
  const sum = rewards.reduce((total, reward) => total + (moneyNumber(reward?.amount ?? reward?.value) || 0), 0);
  return sum > 0 ? Number(sum.toFixed(6)) : null;
}

function candidateAssessment(detail) {
  const text = JSON.stringify(detail || {}).toLowerCase();
  const type = String(detail?.type || detail?.listingType || '').toLowerCase();
  const blockers = [];
  const add = value => { if (!blockers.includes(value)) blockers.push(value); };

  if (type === 'project') add('telegram_required');
  if (/\b(tweet|twitter|x\.com|post on x|x thread|social post|youtube|tiktok|video)\b/.test(text)) add('social_account_or_content');
  if (/\b(trade|trading|swap|stake|staking|deposit|fund your|fund the|volume requirement|buy token|sell token|inference vault)\b/.test(text)) add('owner_funds_or_trading');
  if (/\b(connect x|oauth|kyc|identity verification|wallet signing|sign with wallet)\b/.test(text)) add('human_identity_or_signing');
  if (/\b(interview|sales call|zoom call|meeting required|phone call)\b/.test(text)) add('manual_human_interaction');
  if (/\b(referral link|refer users|recruit users)\b/.test(text)) add('manual_growth_or_referral');

  return {
    blockers,
    autonomousCandidate:blockers.length === 0,
  };
}

async function ensureAgent() {
  let agent = await vault.getAgent();
  if (agent) return { agent, created:false };

  const response = await request('/api/agents', {
    method:'POST',
    headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ name:AGENT_NAME }),
  });
  if (!response.ok) {
    throw new Error(`Superteam agent registration failed (${response.status}): ${safeError(response.data)}. No alternate identity was created.`);
  }

  const agentId = String(pick(response.data, ['agentId','id']) || '').trim();
  const username = String(pick(response.data, ['username']) || '').trim() || null;
  const apiKey = String(pick(response.data, ['apiKey']) || '').trim();
  const claimCode = String(pick(response.data, ['claimCode']) || '').trim();
  if (!agentId || !apiKey || !claimCode) throw new Error('Superteam registration response missing agentId, apiKey, or claimCode');

  await vault.storeAgent({ agentId, username, apiKey, claimCode });
  agent = await vault.getAgent();
  console.log(JSON.stringify({
    type:'superteam_agent_registered',
    ok:true,
    agentId,
    username,
    apiKeyStoredEncrypted:true,
    claimCodeStoredEncrypted:true,
    secretsExposed:false,
    ownerFundsSpentUsd:0,
    at:new Date().toISOString(),
  }));
  return { agent, created:true };
}

async function getDetails(agent, row) {
  const identity = listingIdentity(row);
  if (!identity.slug) return row;
  const response = await request(`/api/agents/listings/details/${encodeURIComponent(identity.slug)}`, {
    headers:{ authorization:`Bearer ${agent.apiKey}` },
  });
  if (!response.ok) return row;
  return response.data?.data || response.data?.listing || response.data;
}

async function scan(agent) {
  if (scanInFlight) return { ok:true, skipped:true, reason:'scan_in_flight' };
  scanInFlight = true;
  try {
    const response = await request(`/api/agents/listings/live?take=${TAKE}`, {
      headers:{ authorization:`Bearer ${agent.apiKey}` },
    }, 25000);
    if (!response.ok) throw new Error(`Superteam live listings failed (${response.status}): ${safeError(response.data)}`);

    const rows = listingArray(response.data);
    const candidates = [];
    for (const row of rows.slice(0, 30)) {
      const detail = await getDetails(agent, row);
      const identity = listingIdentity({ ...row, ...detail });
      const assessment = candidateAssessment(detail);
      const amount = compensationUsd(detail) ?? compensationUsd(row);
      const deadline = cleanString(detail?.deadline || detail?.submissionDeadline || row?.deadline || row?.submissionDeadline, 80);
      candidates.push({
        ...identity,
        compensationUsd:amount,
        deadline,
        autonomousCandidate:assessment.autonomousCandidate,
        blockers:assessment.blockers,
      });
    }

    const ranked = candidates
      .sort((a, b) => Number(b.autonomousCandidate) - Number(a.autonomousCandidate) || (b.compensationUsd || 0) - (a.compensationUsd || 0))
      .slice(0, 12);
    const autonomous = candidates.filter(item => item.autonomousCandidate);

    console.log(JSON.stringify({
      type:'superteam_earn_scan',
      ok:true,
      agentId:agent.agentId,
      username:agent.username || null,
      listingCount:rows.length,
      inspectedCount:candidates.length,
      autonomousCandidateCount:autonomous.length,
      topCandidates:ranked,
      noSubmissionCreated:true,
      ownerFundsSpentUsd:0,
      at:new Date().toISOString(),
    }));
    return { ok:true, listingCount:rows.length, inspectedCount:candidates.length, autonomousCandidateCount:autonomous.length, candidates:ranked };
  } finally {
    scanInFlight = false;
  }
}

async function launch() {
  const state = await vault.init();
  if (!ENABLED) {
    console.log(JSON.stringify({ type:'superteam_bootstrap_skipped', reason:'disabled', persistent:state.persistent, configured:state.configured, at:new Date().toISOString() }));
    return { ok:true, skipped:true };
  }
  if (!state.persistent) throw new Error('Superteam agent integration requires persistent Postgres vault');

  const { agent, created } = await ensureAgent();
  const result = await scan(agent);
  if (!interval) {
    interval = setInterval(() => scan(agent).catch(error => {
      console.error(JSON.stringify({
        type:'superteam_scan_error',
        error:String(error?.message || error).slice(0, 500),
        secretsExposed:false,
        ownerFundsSpentUsd:0,
        at:new Date().toISOString(),
      }));
    }), SCAN_INTERVAL_MS);
    interval.unref();
  }
  return { ...result, agentId:agent.agentId, username:agent.username || null, agentCreated:created };
}

module.exports = { launch, scan };
