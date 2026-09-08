const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
let Pool;
try { ({ Pool } = require('pg')); } catch { Pool = null; }

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase();
const pool = DATABASE_URL && Pool ? new Pool({
  connectionString: DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 30000,
  ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
}) : null;
const memory = new Map();
let initPromise = null;

function sha(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function privateIp(ip) {
  if (!net.isIP(ip)) return false;
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true;
  if (ip.startsWith('172.')) { const n = Number(ip.split('.')[1]); if (n >= 16 && n <= 31) return true; }
  return ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80');
}
async function safeUrl(raw) {
  let u;
  try { u = new URL(String(raw || '')); } catch { throw new Error('public http/https URL required'); }
  if (!['http:', 'https:'].includes(u.protocol) || !u.hostname || u.hostname === 'localhost' || u.hostname.endsWith('.local')) throw new Error('public http/https URL required');
  const addrs = await dns.lookup(u.hostname, { all: true });
  if (!addrs.length || addrs.some(a => privateIp(a.address))) throw new Error('private/local target blocked');
  return u;
}
function decodeChallenge(value) {
  if (!value) return null;
  try { return JSON.parse(Buffer.from(String(value).trim(), 'base64').toString('utf8')); } catch { return null; }
}
function cleanIdempotency(value) {
  const v = String(value || '').trim();
  if (v.length < 8 || v.length > 160) throw new Error('idempotency_key must be 8-160 characters');
  return v;
}
function cleanMethod(value) {
  const method = String(value || 'GET').trim().toUpperCase();
  if (!['GET', 'POST'].includes(method)) throw new Error('method must be GET or POST');
  return method;
}
function cleanMaxUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 1000) throw new Error('max_usd must be greater than 0 and at most 1000');
  return Number(n.toFixed(6));
}
function normalizeNetwork(value) {
  const n = String(value || 'eip155:8453').trim();
  if (!/^eip155:\d+$/.test(n)) throw new Error('expected_network must use CAIP-2 format such as eip155:8453');
  return n;
}
function assetLabel(asset, network) {
  const a = String(asset || '').trim();
  if (!a) return null;
  if (/^usdc$/i.test(a)) return 'USDC';
  if (network === 'eip155:8453' && a.toLowerCase() === BASE_USDC) return 'USDC';
  return a;
}
function amountUsd(accept) {
  if (!accept) return null;
  const raw = accept.amount ?? accept.maxAmountRequired ?? null;
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  const asset = assetLabel(accept.asset, accept.network);
  if (asset !== 'USDC') return null;
  return Number((n / 1_000_000).toFixed(6));
}
async function probe(rawUrl, method, body) {
  let current = await safeUrl(rawUrl);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  const started = Date.now();
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const options = {
        method,
        redirect: 'manual',
        signal: ctl.signal,
        headers: { accept:'application/json', 'user-agent':'INCOME2-PurchaseGuard/0.1' },
      };
      if (method === 'POST') {
        options.headers['content-type'] = 'application/json';
        options.body = JSON.stringify(body ?? {});
      }
      const r = await fetch(current, options);
      if ([301,302,303,307,308].includes(r.status)) {
        const location = r.headers.get('location');
        if (!location) break;
        if (redirects === 3) throw new Error('too many redirects');
        current = await safeUrl(new URL(location, current).toString());
        continue;
      }
      const challenge = decodeChallenge(r.headers.get('payment-required'));
      return {
        requestedUrl: String(rawUrl),
        finalUrl: current.toString(),
        status: r.status,
        responseMs: Date.now() - started,
        challenge,
        cacheControl: r.headers.get('cache-control') || null,
      };
    }
    throw new Error('redirect could not be resolved safely');
  } finally {
    clearTimeout(timer);
  }
}
function evaluate(preflight, maxUsd, expectedNetwork) {
  const challenge = preflight.challenge;
  const reasons = [];
  if (preflight.status !== 402) reasons.push(`endpoint returned HTTP ${preflight.status}, not 402`);
  if (!challenge) reasons.push('PAYMENT-REQUIRED challenge was missing or unreadable');
  const accepts = Array.isArray(challenge?.accepts) ? challenge.accepts : [];
  if (!accepts.length && challenge) reasons.push('challenge has no accepted payment requirements');

  const candidates = accepts.map((a, i) => ({
    index: i,
    scheme: a?.scheme || null,
    network: a?.network || null,
    asset: assetLabel(a?.asset, a?.network),
    assetRaw: a?.asset || null,
    amountAtomic: a?.amount ?? a?.maxAmountRequired ?? null,
    amountUsd: amountUsd(a),
    payTo: a?.payTo || null,
    maxTimeoutSeconds: a?.maxTimeoutSeconds || null,
  }));
  const suitable = candidates.filter(c => c.scheme === 'exact' && c.network === expectedNetwork && c.asset === 'USDC' && c.amountUsd != null);
  const withinBudget = suitable.filter(c => c.amountUsd <= maxUsd);
  let decision = 'blocked';
  if (challenge && preflight.status === 402 && withinBudget.length) decision = 'ready_to_purchase';
  else if (challenge && preflight.status === 402 && suitable.length && !withinBudget.length) reasons.push(`quoted price exceeds max_usd ${maxUsd}`);
  else if (challenge && preflight.status === 402 && !suitable.length) reasons.push(`no exact USDC option found on ${expectedNetwork}`);

  const selected = withinBudget.sort((a,b) => a.amountUsd - b.amountUsd)[0] || suitable.sort((a,b) => a.amountUsd - b.amountUsd)[0] || candidates[0] || null;
  return { decision, reasons, selected, candidates };
}
async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!pool) return { persistent:false };
    await pool.query(`
      CREATE TABLE IF NOT EXISTS earn_purchase_guard_intents (
        intent_id text PRIMARY KEY,
        receipt_id text UNIQUE NOT NULL,
        idempotency_hash text UNIQUE NOT NULL,
        fingerprint text NOT NULL,
        endpoint_url text NOT NULL,
        http_method text NOT NULL,
        request_body_hash text,
        max_usd numeric(18,6) NOT NULL,
        expected_network text NOT NULL,
        decision text NOT NULL,
        selected_quote jsonb,
        reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
        candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
        response_status integer,
        response_ms integer,
        payment_executed boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS earn_purchase_guard_receipt_idx ON earn_purchase_guard_intents(receipt_id);
    `);
    return { persistent:true };
  })();
  return initPromise;
}
function publicRecord(row, reused=false) {
  return {
    intentId: row.intent_id,
    receiptId: row.receipt_id,
    reused,
    decision: row.decision,
    endpointUrl: row.endpoint_url,
    method: row.http_method,
    requestBodySha256: row.request_body_hash || null,
    maxUsd: Number(row.max_usd),
    expectedNetwork: row.expected_network,
    selectedQuote: row.selected_quote || null,
    reasons: row.reasons || [],
    candidates: row.candidates || [],
    probeStatus: row.response_status,
    responseMs: row.response_ms,
    paymentExecuted: false,
    beta: true,
    nextAction: row.decision === 'ready_to_purchase'
      ? 'Safe to consider payment under this intent. This beta does not execute or sign the payment.'
      : 'Do not pay under this intent unless the blocking condition is resolved.',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
async function byIdempotency(hashValue) {
  if (pool) {
    const r = await pool.query('SELECT * FROM earn_purchase_guard_intents WHERE idempotency_hash=$1 LIMIT 1', [hashValue]);
    return r.rows[0] || null;
  }
  return memory.get(`idem:${hashValue}`) || null;
}
async function byReceipt(receiptId) {
  if (pool) {
    const r = await pool.query('SELECT * FROM earn_purchase_guard_intents WHERE receipt_id=$1 LIMIT 1', [receiptId]);
    return r.rows[0] || null;
  }
  return memory.get(`receipt:${receiptId}`) || null;
}
async function createIntent(input) {
  await init();
  const idempotencyKey = cleanIdempotency(input?.idempotency_key);
  const method = cleanMethod(input?.method);
  const maxUsd = cleanMaxUsd(input?.max_usd);
  const expectedNetwork = normalizeNetwork(input?.expected_network);
  const endpoint = (await safeUrl(input?.url)).toString();
  const requestBody = method === 'POST' ? (input?.body ?? {}) : null;
  const requestBodyHash = method === 'POST' ? sha(canonical(requestBody)) : null;
  const fingerprint = sha(canonical({ endpoint, method, requestBodyHash, maxUsd, expectedNetwork }));
  const idemHash = sha(idempotencyKey);
  const existing = await byIdempotency(idemHash);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      const err = new Error('idempotency_key was already used for different purchase parameters');
      err.code = 'IDEMPOTENCY_CONFLICT';
      throw err;
    }
    return publicRecord(existing, true);
  }

  const preflight = await probe(endpoint, method, requestBody);
  const evaluation = evaluate(preflight, maxUsd, expectedNetwork);
  const now = new Date().toISOString();
  const row = {
    intent_id: crypto.randomUUID(),
    receipt_id: `guard_${crypto.randomBytes(16).toString('hex')}`,
    idempotency_hash: idemHash,
    fingerprint,
    endpoint_url: endpoint,
    http_method: method,
    request_body_hash: requestBodyHash,
    max_usd: maxUsd,
    expected_network: expectedNetwork,
    decision: evaluation.decision,
    selected_quote: evaluation.selected,
    reasons: evaluation.reasons,
    candidates: evaluation.candidates,
    response_status: preflight.status,
    response_ms: preflight.responseMs,
    payment_executed: false,
    created_at: now,
    updated_at: now,
  };
  if (pool) {
    try {
      const r = await pool.query(`
        INSERT INTO earn_purchase_guard_intents
          (intent_id,receipt_id,idempotency_hash,fingerprint,endpoint_url,http_method,request_body_hash,max_usd,expected_network,decision,selected_quote,reasons,candidates,response_status,response_ms,payment_executed)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,false)
        RETURNING *
      `, [row.intent_id,row.receipt_id,row.idempotency_hash,row.fingerprint,row.endpoint_url,row.http_method,row.request_body_hash,row.max_usd,row.expected_network,row.decision,row.selected_quote,row.reasons,row.candidates,row.response_status,row.response_ms]);
      return publicRecord(r.rows[0], false);
    } catch (error) {
      if (error?.code === '23505') {
        const raced = await byIdempotency(idemHash);
        if (raced && raced.fingerprint === fingerprint) return publicRecord(raced, true);
      }
      throw error;
    }
  }
  memory.set(`idem:${idemHash}`, row);
  memory.set(`receipt:${row.receipt_id}`, row);
  return publicRecord(row, false);
}
async function getReceipt(receiptId) {
  await init();
  const id = String(receiptId || '').trim();
  if (!/^guard_[a-f0-9]{32}$/.test(id)) return null;
  const row = await byReceipt(id);
  return row ? publicRecord(row, true) : null;
}
async function status() {
  const state = await init();
  return {
    ok:true,
    product:'INCOME 2 Agent Purchase Guard',
    beta:true,
    persistent:state.persistent,
    paymentExecution:false,
    purpose:'Preflight an x402 purchase, enforce a maximum spend, and make retries idempotent before an agent signs or sends money.',
  };
}

module.exports = { init, createIntent, getReceipt, status };
