const express = require('express');
const crypto = require('crypto');

const ORIGIN = String(process.env.PUBLIC_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');
const OUTCOME_EXECUTION_PATH = '/outcome-router/execute/{requestId}';
const PAYAI_FACILITATOR = 'https://facilitator.payai.network';
const CDP_FACILITATOR = 'https://api.cdp.coinbase.com/platform/v2/x402';
const CDP_ENABLED = String(process.env.EARN_CDP_FACILITATOR_ENABLED || '').toLowerCase() === 'true';
const CDP_CONFIGURED = Boolean(String(process.env.CDP_API_KEY_ID || '').trim() && String(process.env.CDP_API_KEY_SECRET || '').trim());

// Agent402 ranks by lexical match first, then rolling health, then price.
// Keep discovery language compact and task-level instead of stuffing broad synonyms.
const DISCOVERY_NAMES = {
  webExtract: 'Extract Clean Markdown from Webpage URL',
  buyerCheck: 'x402 Payment Challenge Preflight Audit',
  purchaseGuard: 'x402 Duplicate Payment Retry Guard',
  outcomeRouter: 'Find and Execute Agent or Tool Under Budget',
};
const WEB_EXTRACT_DESCRIPTION = 'Fetch a live public webpage URL and convert the page or article to clean Markdown with title, description, author, canonical URL and useful links. Unlike HTML-only conversion, this endpoint fetches the URL itself; redirects are SSRF-checked and external content is marked untrusted.';
const BUYER_CHECK_DESCRIPTION = 'Audit an x402 payment challenge before paying. Probe a public endpoint without sending payment and report whether the 402 challenge is parseable, which network/asset/payTo it requests, and whether the response is HTTPS-canonical and cache-safe.';
const PURCHASE_GUARD_DESCRIPTION = 'Prevent duplicate x402 charges on retries with a stable idempotency key, hard max-spend limit and durable receipt. This free preflight never signs, sends, settles or custodies payment; paymentExecuted=false.';
const BUYER_INTENTS = [
  'find an agent to complete this task',
  'find and execute a tool under budget',
  'buy a completed result from an agent',
  'get this result for a maximum budget',
  'extract clean markdown from webpage url',
  'convert webpage article to clean markdown',
  'x402 payment challenge preflight audit',
  'prevent duplicate x402 payment',
  'retry x402 payment safely',
  'prompt injection security scan',
  'json data quality audit',
  'website metadata audit',
];
const OUTCOME_TAGS = [
  'agent', 'tool', 'find', 'execute', 'budget', 'task', 'result', 'procurement', 'routing', 'x402',
];
const CURRENT_OUTCOME_DESCRIPTION = `Find and execute a supported agent or tool for a desired result under a maximum budget. Give INCOME 2 the task/result plus max budget; HYDRA attempts compatible zero-dollar proof-of-work fulfillment first and can return a buyer-signed non-custodial x402 paid route when supported and within budget. Use this when you need an agent to complete a task, want a supported tool under budget, or want to buy a completed result without manual brokerage. The buyer wallet signs locally; HYDRA never receives a private key and never uses owner working capital. Higher paid tiers are not auto-escalated.`;
const PAID_BLOCK = `Buyer-signed paid HYDRA execution\n- Outcome request: POST ${ORIGIN}/outcome-router\n- Paid execution: POST ${ORIGIN}/outcome-router/execute/{requestId}\n- First execution call returns the relayed Agent402 Smart Order Router x402 PAYMENT-REQUIRED challenge.\n- An x402-capable buyer wallet signs locally and retries with PAYMENT-SIGNATURE.\n- HYDRA forwards the proof and returns the routed result.\n- HYDRA never receives the buyer private key or uses owner working capital.\n- Current beta platform fee: $0. Higher paid tiers are not auto-escalated.`;

const directoryRegistrationUrls = new Set([
  'https://agent402.tools/api/index/register',
  'https://core.x402arena.gg/register',
  'https://market402.com/submit',
  'https://402index.io/api/v1/register',
]);
const nativeFetch = global.fetch;
let josePromise = null;

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

async function buildCdpJwt({ method, host, path }) {
  if (!josePromise) josePromise = import('jose');
  const { SignJWT, importJWK } = await josePromise;
  const keyId = String(process.env.CDP_API_KEY_ID || '').trim();
  const secret = String(process.env.CDP_API_KEY_SECRET || '').replace(/\\n/g, '\n').trim();
  if (!keyId || !secret) throw new Error('CDP credentials are not configured');

  let alg;
  let key;
  if (secret.includes('BEGIN')) {
    const nodeKey = crypto.createPrivateKey(secret);
    const jwk = nodeKey.export({ format:'jwk' });
    alg = jwk.kty === 'OKP' && jwk.crv === 'Ed25519' ? 'EdDSA' : 'ES256';
    key = await importJWK(jwk, alg);
  } else {
    const raw = Buffer.from(secret, 'base64');
    if (raw.length !== 64) throw new Error('Unsupported CDP API key secret format');
    alg = 'EdDSA';
    key = await importJWK({
      kty:'OKP',
      crv:'Ed25519',
      d:b64url(raw.subarray(0, 32)),
      x:b64url(raw.subarray(32, 64)),
    }, alg);
  }

  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss:'cdp',
    sub:keyId,
    nbf:now,
    exp:now + 120,
    uri:`${method} ${host}${path}`,
  })
    .setProtectedHeader({ alg, typ:'JWT', kid:keyId, nonce:crypto.randomBytes(16).toString('hex') })
    .sign(key);
}

async function fetchViaCdp(target, options = {}) {
  if (!CDP_ENABLED || !target.startsWith(PAYAI_FACILITATOR)) return null;
  if (!CDP_CONFIGURED) {
    console.log(JSON.stringify({ type:'cdp_facilitator_fallback', reason:'credentials_not_configured', at:new Date().toISOString() }));
    return null;
  }
  const suffix = target.slice(PAYAI_FACILITATOR.length) || '';
  if (!['/supported', '/verify', '/settle'].some(path => suffix === path || suffix.startsWith(`${path}?`))) return null;
  const cdpTarget = `${CDP_FACILITATOR}${suffix}`;
  const parsed = new URL(cdpTarget);
  const method = String(options.method || 'GET').toUpperCase();
  const requestPath = `${parsed.pathname}${parsed.search}`;
  const token = await buildCdpJwt({ method, host:parsed.host, path:requestPath });
  const headers = new Headers(options.headers || {});
  headers.set('authorization', `Bearer ${token}`);
  headers.set('accept', headers.get('accept') || 'application/json');
  console.log(JSON.stringify({ type:'cdp_facilitator_request', method, path:parsed.pathname, at:new Date().toISOString() }));
  return nativeFetch(cdpTarget, { ...options, headers });
}

global.fetch = async function income2DiscoveryFetch(url, options = {}) {
  const target = String(url);
  const cdpResponse = await fetchViaCdp(target, options);
  if (cdpResponse) return cdpResponse;
  const generalRefresh = String(process.env.EARN_DIRECTORY_REGISTER_ON_BOOT || '') === '1';
  const agent402Refresh = target === 'https://agent402.tools/api/index/register' && String(process.env.EARN_AGENT402_REFRESH_ON_BOOT || '') === '1';
  if (directoryRegistrationUrls.has(target) && !generalRefresh && !agent402Refresh) {
    console.log(JSON.stringify({ type:'directory_registration_skipped', target, reason:'registration_on_boot_disabled', at:new Date().toISOString() }));
    return new Response(JSON.stringify({ ok:true, skipped:true, reason:'registration_on_boot_disabled' }), {
      status:200,
      headers:{ 'content-type':'application/json' },
    });
  }
  return nativeFetch(url, options);
};

function correctText(text) {
  let out = String(text || '');
  out = out
    .replace(/Paid external execution remains disabled until a safe buyer-funded\/delegated payment rail exists\./gi, 'Paid external execution is enabled through buyer-signed non-custodial x402 pass-through.')
    .replace(/Paid external execution is not yet enabled because INCOME 2 will not custody buyer keys or spend owner working capital\./gi, 'Paid external execution is enabled through buyer-signed non-custodial x402 pass-through; buyer wallets sign locally and HYDRA never receives private keys or uses owner working capital.')
    .replace(/Paid external execution is blocked until a safe buyer-funded\/delegated payment rail exists\./gi, 'Paid external execution is enabled through buyer-signed non-custodial x402 pass-through.')
    .replace(/autonomously discovers\/executes zero-wallet fulfillment where possible/gi, 'autonomously discovers fulfillment, tries zero-dollar proof-of-work first, and supports buyer-signed x402 paid execution where available');
  if (/Outcome Router|HYDRA/i.test(out) && !out.includes('Buyer-signed paid HYDRA execution')) out += `\n\n${PAID_BLOCK}\n`;
  return out;
}

function resourcePath(resource) {
  try {
    if (resource?.url) return new URL(resource.url).pathname;
  } catch {}
  const declared = String(resource?.resource || '');
  const match = declared.match(/\s(\/[^\s]*)$/);
  return match?.[1] || '';
}

function tuneResource(resource) {
  if (!resource || typeof resource !== 'object') return resource;
  const path = resourcePath(resource);
  if (['/web-extract', '/url-to-clean-markdown'].includes(path)) {
    return {
      ...resource,
      name: DISCOVERY_NAMES.webExtract,
      category: 'web-documents',
      description: WEB_EXTRACT_DESCRIPTION,
      tags: ['webpage', 'url', 'article', 'markdown', 'extract', 'fetch', 'document', 'research'],
    };
  }
  if (path === '/x402-buyer-check') {
    return {
      ...resource,
      name: DISCOVERY_NAMES.buyerCheck,
      category: 'payments',
      description: BUYER_CHECK_DESCRIPTION,
      tags: ['x402', 'payment', 'challenge', 'preflight', 'audit', 'buyer', 'security'],
    };
  }
  if (path === '/purchase-guard') {
    return {
      ...resource,
      name: DISCOVERY_NAMES.purchaseGuard,
      category: 'payments',
      description: PURCHASE_GUARD_DESCRIPTION,
      tags: ['x402', 'duplicate-payment', 'retry', 'idempotency', 'max-spend', 'receipt', 'buyer'],
    };
  }
  if (path === '/outcome-router') {
    return {
      ...resource,
      name: DISCOVERY_NAMES.outcomeRouter,
      category: 'agent-procurement',
      tags: OUTCOME_TAGS,
      description: CURRENT_OUTCOME_DESCRIPTION,
      paidExecution: {
        ...(resource.paidExecution || {}),
        enabled: true,
        mode: 'buyer_signed_x402_passthrough',
        executionPath: OUTCOME_EXECUTION_PATH,
        upstream: 'Agent402 Smart Order Router',
        platformFeeUsd: 0,
        privateKeyRequiredByHydra: false,
        ownerWorkingCapitalUsed: false,
      },
    };
  }
  return resource;
}

const previousJson = express.response.json;
express.response.json = function income2DiscoveryTruthJson(body) {
  const path = this.req?.path;
  if (path === '/health' && body && typeof body === 'object') {
    body = {
      ...body,
      facilitator: CDP_ENABLED && CDP_CONFIGURED ? 'cdp' : body.facilitator,
      discovery: {
        ...(body.discovery || {}),
        coinbaseBazaarExtension: true,
        cdpFacilitatorEnabled: CDP_ENABLED,
        cdpCredentialsConfigured: CDP_CONFIGURED,
        cdpBazaarSettlementReady: CDP_ENABLED && CDP_CONFIGURED,
        agent402Strategy: 'task_level_lexical_names_then_health_then_price',
      },
    };
  }
  if (path === '/openapi.json' && body && typeof body === 'object') {
    const paths = { ...(body.paths || {}) };
    for (const extractPath of ['/web-extract', '/url-to-clean-markdown']) {
      if (!paths[extractPath]?.post) continue;
      paths[extractPath] = {
        ...paths[extractPath],
        post: {
          ...paths[extractPath].post,
          summary: DISCOVERY_NAMES.webExtract,
          description: WEB_EXTRACT_DESCRIPTION,
          tags: ['web documents', 'webpage extraction', 'markdown'],
          'x-intents': ['extract clean markdown from webpage url', 'convert webpage article to clean markdown', 'fetch webpage and return markdown'],
        },
      };
    }
    if (paths['/x402-buyer-check']?.post) {
      paths['/x402-buyer-check'] = {
        ...paths['/x402-buyer-check'],
        post: {
          ...paths['/x402-buyer-check'].post,
          summary: DISCOVERY_NAMES.buyerCheck,
          description: BUYER_CHECK_DESCRIPTION,
          tags: ['x402 payments', 'preflight audit'],
          'x-intents': ['x402 payment challenge preflight audit', 'check x402 challenge before paying'],
        },
      };
    }
    if (paths['/purchase-guard']?.post) {
      paths['/purchase-guard'] = {
        ...paths['/purchase-guard'],
        post: {
          ...paths['/purchase-guard'].post,
          summary: DISCOVERY_NAMES.purchaseGuard,
          description: PURCHASE_GUARD_DESCRIPTION,
          tags: ['x402 payments', 'retry safety', 'idempotency'],
          'x-intents': ['prevent duplicate x402 payment', 'retry x402 payment safely', 'hard max spend x402 purchase'],
        },
      };
    }
    if (paths['/outcome-router']?.post) {
      paths['/outcome-router'] = {
        ...paths['/outcome-router'],
        post: {
          ...paths['/outcome-router'].post,
          summary: DISCOVERY_NAMES.outcomeRouter,
          description: CURRENT_OUTCOME_DESCRIPTION,
          tags: ['agent procurement', 'task execution', 'budget routing'],
          'x-intents': BUYER_INTENTS.slice(0, 4),
          'x-keywords': OUTCOME_TAGS,
        },
      };
    }
    body = {
      ...body,
      info: {
        ...(body.info || {}),
        description: correctText(body.info?.description || ''),
      },
      paths,
    };
  }
  if ((path === '/.well-known/x402' || path === '/.well-known/x402.json') && body && typeof body === 'object') {
    body = {
      ...body,
      description: 'INCOME 2 buyer-facing agent tools: extract clean Markdown from a live webpage URL, audit x402 payment challenges, prevent duplicate payment retries, and find/execute a supported agent or tool under a maximum budget.',
      intents: Array.from(new Set([...(Array.isArray(body.intents) ? body.intents : []), ...BUYER_INTENTS])),
      bazaar: {
        extension: true,
        cdpFacilitatorEnabled: CDP_ENABLED,
        cdpCredentialsConfigured: CDP_CONFIGURED,
        note: CDP_ENABLED && CDP_CONFIGURED ? 'CDP facilitator active for verify/settle; eligible Bazaar metadata is declared on paid routes.' : 'Bazaar metadata is declared on paid routes; CDP verify/settle activation still requires CDP API credentials.',
      },
    };
    if (Array.isArray(body.rails) && CDP_ENABLED && CDP_CONFIGURED) {
      body.rails = body.rails.map(rail => rail?.rail === 'evm' ? { ...rail, facilitator:CDP_FACILITATOR } : rail);
    }
    if (Array.isArray(body.resources)) {
      body.resources = body.resources.map(tuneResource);
    }
  }
  return previousJson.call(this, body);
};

const previousSend = express.response.send;
express.response.send = function income2DiscoveryTruthSend(body) {
  const path = this.req?.path;
  if (typeof body === 'string' && ['/skill.md', '/llms.txt', '/agents.txt'].includes(path)) {
    body = correctText(body)
      .replace(/Outcome Router beta/gi, DISCOVERY_NAMES.outcomeRouter)
      .replace(/## Outcome Router\b/gi, `## ${DISCOVERY_NAMES.outcomeRouter}`)
      .replace(/Agent Purchase Guard beta/gi, DISCOVERY_NAMES.purchaseGuard)
      .replace(/## Agent Purchase Guard\b/gi, `## ${DISCOVERY_NAMES.purchaseGuard}`)
      .replace(/## Purchase Guard\b/gi, `## ${DISCOVERY_NAMES.purchaseGuard}`)
      .replace(/## Webpage to Clean Markdown\b/gi, `## ${DISCOVERY_NAMES.webExtract}`)
      .replace(/## Webpage Extract\b/gi, `## ${DISCOVERY_NAMES.webExtract}`);
  }
  return previousSend.call(this, body);
};

async function readJsonSafe(response) {
  const text = await response.text();
  try { return { text, data: JSON.parse(text) }; } catch { return { text, data: null }; }
}

async function x402ScanCheckDiscovery() {
  const input = encodeURIComponent(JSON.stringify({ '0': { json: { origin: ORIGIN, bustCache: true } } }));
  const url = `https://www.x402scan.com/api/trpc/public.resources.checkDiscovery?batch=1&input=${input}`;
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'INCOME2-Discovery/1.0' } });
  const parsed = await readJsonSafe(response);
  return { ok: response.ok, status: response.status, ...parsed };
}

async function x402ScanRegister() {
  const batchUrl = 'https://www.x402scan.com/api/trpc/public.resources.registerFromOrigin?batch=1';
  const batchBody = JSON.stringify({ '0': { json: { origin: ORIGIN } } });
  let response = await fetch(batchUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'INCOME2-Discovery/1.0' },
    body: batchBody,
  });
  let parsed = await readJsonSafe(response);
  if (!response.ok) {
    response = await fetch('https://www.x402scan.com/api/trpc/public.resources.registerFromOrigin', {
      method: 'POST',
      headers: { 'content-type':'application/json', accept:'application/json', 'user-agent':'INCOME2-Discovery/1.0' },
      body: JSON.stringify({ json: { origin: ORIGIN } }),
    });
    parsed = await readJsonSafe(response);
  }
  return { ok: response.ok, status: response.status, ...parsed };
}

if (String(process.env.X402SCAN_REGISTER_ON_BOOT || '').toLowerCase() === 'true' && /seller-core\.js$/.test(String(process.argv[1] || ''))) {
  setTimeout(async () => {
    try {
      const check = await x402ScanCheckDiscovery();
      console.log(JSON.stringify({ type: 'x402scan_discovery_check', ok: check.ok, status: check.status, response: check.text.slice(0, 4000), at: new Date().toISOString() }));
      const registration = await x402ScanRegister();
      console.log(JSON.stringify({ type: 'x402scan_registration', ok: registration.ok, status: registration.status, response: registration.text.slice(0, 6000), at: new Date().toISOString() }));
    } catch (error) {
      console.error(JSON.stringify({ type: 'x402scan_registration_error', error: String(error?.message || error).slice(0, 500), at: new Date().toISOString() }));
    }
  }, 14000).unref();
}
