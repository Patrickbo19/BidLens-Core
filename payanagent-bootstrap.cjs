const vault = require('./payanagent-vault.cjs');

const API = 'https://payanagent.com/api/v1';
const ORIGIN = String(process.env.PUBLIC_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');
const PAY_TO = String(process.env.EARN_RECEIVE_ADDRESS || '').trim();
const ENABLED = String(process.env.PAYANAGENT_BOOTSTRAP_ON_START || '').toLowerCase() === 'true' || String(process.env.PAYANAGENT_BOOTSTRAP_ON_START || '') === '1';
const PRIMARY_TITLE = 'Extract Clean Markdown from Webpage URL';
const PRIMARY_DESCRIPTION = 'Fetch a live public webpage URL and return clean Markdown plus title, description, author, canonical URL and useful links. Built for agent research, RAG ingestion and summarization; redirects are SSRF-checked and external content is marked untrusted.';
const PRIMARY_TAGS = ['webpage','url','markdown','extract','research','rag'];
const SEARCH_QUERY = 'extract clean markdown from webpage url';
const INPUT_SCHEMA = JSON.stringify({
  type:'object',
  required:['url'],
  properties:{
    url:{ type:'string', format:'uri', description:'Public http/https webpage URL to fetch and convert.' },
    max_chars:{ type:'integer', minimum:1000, maximum:150000, default:60000, description:'Maximum Markdown characters returned.' },
    include_links:{ type:'boolean', default:true, description:'Include up to 50 useful links found in the extracted page.' },
  },
});
const OUTPUT_SCHEMA = JSON.stringify({
  type:'object',
  properties:{
    requestedUrl:{type:'string'}, finalUrl:{type:'string'}, status:{type:'integer'}, ok:{type:'boolean'},
    contentType:{type:'string'}, title:{type:'string'}, description:{type:'string'}, author:{type:['string','null']},
    publishedAt:{type:['string','null']}, canonicalUrl:{type:['string','null']}, wordCount:{type:'integer'},
    markdown:{type:'string'}, truncated:{type:'boolean'}, links:{type:'array'}, untrustedContent:{type:'boolean'},
    extractionMode:{type:'string'}, checkedAt:{type:'string'},
  },
});
const PREVIEW = 'Input a public webpage URL. Output is static-page Markdown plus metadata and links, with redirect-by-redirect SSRF checks and external content explicitly marked untrusted.';

async function request(path, options = {}, timeoutMs = 15000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const response = await fetch(`${API}${path}`, {
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

function findOfferRank(data, offerId) {
  const offers = Array.isArray(data?.offers) ? data.offers : [];
  const index = offers.findIndex(item => String(item?._id || item?.id || item?.offerId || '') === String(offerId));
  return { found:index >= 0, rank:index >= 0 ? index + 1 : null, returned:offers.length };
}

async function ensureAgent() {
  let agent = await vault.getAgent();
  if (agent) return { agent, created:false };

  const payload = {
    name:'INCOME 2 Agent Tools',
    description:'INCOME 2 sells low-cost x402 agent tools on Base USDC, led by live webpage URL to clean Markdown extraction plus payment-security and data utilities.',
    walletAddress:PAY_TO,
    chain:'base',
    tags:['x402','web','markdown','agent-tools','base-usdc'],
    providerType:'api',
    agentUrl:ORIGIN,
  };
  const response = await request('/agents', {
    method:'POST',
    headers:{ 'content-type':'application/json' },
    body:JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`PayanAgent agent registration failed (${response.status}): ${safeError(response.data)}`);

  const agentId = String(response.data?.agentId || response.data?.id || '').trim();
  const apiKey = String(response.data?.apiKey || '').trim();
  const apiKeyPrefix = String(response.data?.apiKeyPrefix || '').trim() || null;
  if (!agentId || !apiKey) throw new Error('PayanAgent registration response did not include agentId and one-time apiKey');
  await vault.storeAgent({ agentId, apiKey, apiKeyPrefix });
  agent = await vault.getAgent();
  console.log(JSON.stringify({
    type:'payanagent_agent_registered', ok:true, agentId,
    apiKeyStoredEncrypted:true, apiKeyExposed:false, apiKeyPrefix:apiKeyPrefix || null,
    at:new Date().toISOString(),
  }));
  return { agent, created:true };
}

async function ensurePrimaryOffer(agent) {
  if (agent.primaryOfferId) return { offerId:agent.primaryOfferId, created:false };

  const response = await request('/offers', {
    method:'POST',
    headers:{ 'content-type':'application/json', authorization:`Bearer ${agent.apiKey}` },
    body:JSON.stringify({
      title:PRIMARY_TITLE,
      description:PRIMARY_DESCRIPTION,
      category:'Web',
      tags:PRIMARY_TAGS,
      offerType:'api',
      externalUrl:`${ORIGIN}/web-extract`,
      httpMethod:'POST',
      verificationBody:{ url:'https://example.com', max_chars:60000, include_links:true },
      inputSchema:INPUT_SCHEMA,
      outputSchema:OUTPUT_SCHEMA,
      estimatedDurationSeconds:8,
      previewDescription:PREVIEW,
    }),
  }, 20000);
  if (!response.ok) throw new Error(`PayanAgent offer registration failed (${response.status}): ${safeError(response.data)}`);

  const offerId = String(response.data?.offerId || response.data?.id || response.data?.offer?.id || '').trim();
  if (!offerId) throw new Error('PayanAgent offer response did not include offerId');
  await vault.setPrimaryOfferId(offerId);
  console.log(JSON.stringify({
    type:'payanagent_offer_registered', ok:true, offerId, title:PRIMARY_TITLE,
    externalUrl:`${ORIGIN}/web-extract`, priceSource:'x402_challenge', ownerFundsSpentUsd:0,
    at:new Date().toISOString(),
  }));
  return { offerId, created:true };
}

async function enrichPrimaryOffer(agent, offerId) {
  const response = await request(`/offers/${encodeURIComponent(offerId)}`, {
    method:'PATCH',
    headers:{ 'content-type':'application/json', authorization:`Bearer ${agent.apiKey}` },
    body:JSON.stringify({
      title:PRIMARY_TITLE,
      description:PRIMARY_DESCRIPTION,
      category:'Web',
      tags:PRIMARY_TAGS,
      httpMethod:'POST',
      inputSchema:INPUT_SCHEMA,
      outputSchema:OUTPUT_SCHEMA,
      estimatedDurationSeconds:8,
      previewDescription:PREVIEW,
      isActive:true,
    }),
  }, 15000);
  console.log(JSON.stringify({
    type:'payanagent_offer_metadata_refresh',
    ok:response.ok,
    status:response.status,
    offerId,
    inputSchemaPresent:true,
    outputSchemaPresent:true,
    ownerFundsSpentUsd:0,
    ...(response.ok ? {} : { reason:safeError(response.data) }),
    at:new Date().toISOString(),
  }));
  if (!response.ok) throw new Error(`PayanAgent offer metadata refresh failed (${response.status}): ${safeError(response.data)}`);
}

async function checkDiscovery(offerId) {
  const checks = [
    ['search', `/offers?q=${encodeURIComponent(SEARCH_QUERY)}&limit=100`],
    ['top', '/offers?sort=top&limit=100'],
    ['new', '/offers?sort=new&limit=100'],
  ];
  for (const [surface, path] of checks) {
    const response = await request(path, {}, 12000);
    if (!response.ok) {
      console.log(JSON.stringify({ type:'payanagent_discovery_check', surface, ok:false, status:response.status, reason:safeError(response.data), at:new Date().toISOString() }));
      continue;
    }
    const rank = findOfferRank(response.data, offerId);
    console.log(JSON.stringify({
      type:'payanagent_discovery_check', surface, ok:true,
      ...(surface === 'search' ? { query:SEARCH_QUERY } : {}),
      offerId, offerPresent:rank.found, offerRank:rank.rank, returnedOffers:rank.returned,
      at:new Date().toISOString(),
    }));
  }
}

async function launch() {
  const state = await vault.init();
  if (!ENABLED) {
    console.log(JSON.stringify({ type:'payanagent_bootstrap_skipped', reason:'disabled', persistent:state.persistent, configured:state.configured, at:new Date().toISOString() }));
    return { ok:true, skipped:true };
  }
  if (!state.persistent) throw new Error('PayanAgent onboarding requires persistent Postgres vault');
  if (!/^0x[a-fA-F0-9]{40}$/.test(PAY_TO)) throw new Error('EARN_RECEIVE_ADDRESS must be a valid public EVM address for PayanAgent registration');

  const { agent, created:agentCreated } = await ensureAgent();
  const { offerId, created:offerCreated } = await ensurePrimaryOffer(agent);
  await enrichPrimaryOffer(agent, offerId);
  await checkDiscovery(offerId);
  return { ok:true, agentId:agent.agentId, offerId, agentCreated, offerCreated };
}

module.exports = { launch };
