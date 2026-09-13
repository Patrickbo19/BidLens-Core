const crypto = require('crypto');
let Pool;
try { ({ Pool } = require('pg')); } catch { Pool = null; }

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const VAULT_KEY_RAW = String(process.env.TASKBOUNTY_VAULT_KEY || '').trim();
const OWNER_CAP_USDC = 2.0;
const DEFAULT_ACTION_CAP_USDC = 0.5;
const NETWORK = 'eip155:8453';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_RPC_URL = String(process.env.EARN_BASE_RPC_URL || 'https://mainnet.base.org').trim();
const RECEIVE_ADDRESS = String(process.env.EARN_RECEIVE_ADDRESS || '').trim().toLowerCase();
const OWN_HOSTS = new Set([
  'earn-tools-backend.onrender.com',
  'income2-treasury.onrender.com',
  'earn-router.onrender.com',
  'earn-chat-mcp.onrender.com',
]);

const pool = DATABASE_URL && Pool ? new Pool({
  connectionString: DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 30000,
  ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
}) : null;

function rawVaultKey() {
  if (!VAULT_KEY_RAW) throw new Error('TASKBOUNTY_VAULT_KEY is not configured');
  let buf;
  try { buf = Buffer.from(VAULT_KEY_RAW, 'base64url'); } catch { buf = Buffer.alloc(0); }
  if (buf.length !== 32) {
    try { buf = Buffer.from(VAULT_KEY_RAW, 'base64'); } catch { buf = Buffer.alloc(0); }
  }
  if (buf.length !== 32) throw new Error('TASKBOUNTY_VAULT_KEY must decode to 32 bytes');
  return buf;
}

function spendKey() {
  return Buffer.from(crypto.hkdfSync(
    'sha256',
    rawVaultKey(),
    Buffer.alloc(0),
    Buffer.from('income2:spend-wallet:v1', 'utf8'),
    32,
  ));
}

function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', spendKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

function decryptSecret(row) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', spendKey(), Buffer.from(row.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

async function deriveAccount(privateKey) {
  const { privateKeyToAccount } = await import('viem/accounts');
  return privateKeyToAccount(privateKey);
}

async function generatePrivateKey() {
  for (let i = 0; i < 8; i++) {
    const candidate = `0x${crypto.randomBytes(32).toString('hex')}`;
    try {
      await deriveAccount(candidate);
      return candidate;
    } catch {}
  }
  throw new Error('failed to generate valid secp256k1 private key');
}

async function init() {
  if (!pool) return { persistent: false, configured: Boolean(VAULT_KEY_RAW), walletReady: false };
  spendKey();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS earn_spend_wallet (
      id text PRIMARY KEY,
      address text NOT NULL,
      ciphertext text NOT NULL,
      iv text NOT NULL,
      auth_tag text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS earn_spend_ledger (
      id text PRIMARY KEY,
      reservation_key text UNIQUE NOT NULL,
      opportunity_id text,
      reason text NOT NULL,
      target_url text NOT NULL,
      pay_to text,
      amount_usdc numeric(20,6) NOT NULL CHECK (amount_usdc > 0),
      state text NOT NULL CHECK (state IN ('reserved','settled','failed','uncertain')),
      http_status integer,
      tx_hash text,
      detail jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  let row = (await pool.query(`SELECT address FROM earn_spend_wallet WHERE id='primary' LIMIT 1`)).rows[0];
  if (!row) {
    const privateKey = await generatePrivateKey();
    const account = await deriveAccount(privateKey);
    const enc = encryptSecret(privateKey);
    await pool.query(`
      INSERT INTO earn_spend_wallet (id,address,ciphertext,iv,auth_tag)
      VALUES ('primary',$1,$2,$3,$4)
      ON CONFLICT (id) DO NOTHING
    `, [account.address, enc.ciphertext, enc.iv, enc.tag]);
    row = (await pool.query(`SELECT address FROM earn_spend_wallet WHERE id='primary' LIMIT 1`)).rows[0];
  }
  return { persistent: true, configured: true, walletReady: Boolean(row?.address), address: row?.address || null };
}

async function getPrivateKey() {
  if (!pool) throw new Error('spend vault requires Postgres');
  const r = await pool.query(`SELECT ciphertext,iv,auth_tag FROM earn_spend_wallet WHERE id='primary' LIMIT 1`);
  if (!r.rowCount) throw new Error('spend wallet not initialized');
  return decryptSecret(r.rows[0]);
}

async function getAccount() {
  return deriveAccount(await getPrivateKey());
}

function decodeBase64Json(value) {
  if (!value) return null;
  try {
    let s = String(value).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return JSON.parse(Buffer.from(s, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function parseChallenge(response) {
  const raw = response.headers.get('payment-required') || response.headers.get('x-payment-required');
  const challenge = decodeBase64Json(raw);
  if (!challenge || !Array.isArray(challenge.accepts)) throw new Error('x402 payment-required challenge missing or invalid');
  const option = challenge.accepts.find(x =>
    String(x?.scheme || '').toLowerCase() === 'exact' &&
    String(x?.network || '') === NETWORK &&
    String(x?.asset || '').toLowerCase() === USDC_BASE.toLowerCase()
  );
  if (!option) throw new Error('no exact Base USDC payment option');
  const atomic = BigInt(String(option.amount ?? option.maxAmountRequired ?? '0'));
  if (atomic <= 0n) throw new Error('invalid x402 amount');
  const amountUsdc = Number(atomic) / 1_000_000;
  const payTo = String(option.payTo || option.pay_to || '').trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) throw new Error('invalid x402 payTo');
  return { challenge, option, atomic, amountUsdc, payTo };
}

function validateTarget(rawUrl) {
  const u = new URL(String(rawUrl));
  if (u.protocol !== 'https:') throw new Error('paid target must use https');
  const host = u.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local')) throw new Error('local target blocked');
  if (OWN_HOSTS.has(host)) throw new Error('self-purchase blocked');
  return u;
}

async function budgetUsage(client = pool) {
  const r = await client.query(`
    SELECT COALESCE(SUM(amount_usdc),0)::numeric AS used
    FROM earn_spend_ledger
    WHERE state IN ('reserved','settled','uncertain')
  `);
  const used = Number(r.rows[0]?.used || 0);
  return { usedUsdc: used, remainingUsdc: Math.max(0, OWNER_CAP_USDC - used) };
}

async function reserveSpend({ amountUsdc, opportunityId, reason, targetUrl, payTo, reservationKey }) {
  if (!pool) throw new Error('spend vault requires Postgres');
  if (!(amountUsdc > 0)) throw new Error('amount must be positive');
  if (amountUsdc > DEFAULT_ACTION_CAP_USDC + 1e-9) throw new Error(`per-action cap exceeded (${DEFAULT_ACTION_CAP_USDC} USDC)`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(82402002)');
    const existing = await client.query(`SELECT * FROM earn_spend_ledger WHERE reservation_key=$1 LIMIT 1`, [reservationKey]);
    if (existing.rowCount) {
      await client.query('COMMIT');
      return { reused: true, row: existing.rows[0] };
    }
    const usage = await budgetUsage(client);
    if (usage.usedUsdc + amountUsdc > OWNER_CAP_USDC + 1e-9) throw new Error('2 USDC owner-principal cap exceeded');
    const id = crypto.randomUUID();
    await client.query(`
      INSERT INTO earn_spend_ledger
        (id,reservation_key,opportunity_id,reason,target_url,pay_to,amount_usdc,state)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'reserved')
    `, [id, reservationKey, opportunityId || null, String(reason).slice(0,500), targetUrl, payTo || null, amountUsdc]);
    await client.query('COMMIT');
    return { reused: false, row: { id, reservation_key: reservationKey, amount_usdc: amountUsdc, state: 'reserved' } };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function finishReservation(id, state, { httpStatus = null, txHash = null, detail = null } = {}) {
  if (!pool) return;
  await pool.query(`
    UPDATE earn_spend_ledger
    SET state=$2,http_status=$3,tx_hash=$4,detail=$5::jsonb,updated_at=now()
    WHERE id=$1
  `, [id, state, httpStatus, txHash, JSON.stringify(detail || {})]);
}

async function baseUsdcBalance(address) {
  try {
    const { createPublicClient, http, formatUnits } = await import('viem');
    const { base } = await import('viem/chains');
    const client = createPublicClient({ chain: base, transport: http(BASE_RPC_URL) });
    const balance = await client.readContract({
      address: USDC_BASE,
      abi: [{ type:'function', name:'balanceOf', stateMutability:'view', inputs:[{name:'account',type:'address'}], outputs:[{name:'',type:'uint256'}] }],
      functionName: 'balanceOf',
      args: [address],
    });
    return Number(formatUnits(balance, 6));
  } catch {
    return null;
  }
}

async function status() {
  if (!pool) return { connected:false, persistent:false, configured:Boolean(VAULT_KEY_RAW), ownerCapUsdc:OWNER_CAP_USDC };
  const r = await pool.query(`SELECT address,created_at,updated_at FROM earn_spend_wallet WHERE id='primary' LIMIT 1`);
  const usage = await budgetUsage();
  if (!r.rowCount) return { connected:false, persistent:true, configured:true, ownerCapUsdc:OWNER_CAP_USDC, ...usage };
  const row = r.rows[0];
  const balanceUsdc = await baseUsdcBalance(row.address);
  return {
    connected:true,
    persistent:true,
    configured:true,
    signerReady:true,
    network:NETWORK,
    asset:'USDC',
    address:row.address,
    ownerCapUsdc:OWNER_CAP_USDC,
    defaultPerActionCapUsdc:DEFAULT_ACTION_CAP_USDC,
    ...usage,
    onchainUsdcBalance:balanceUsdc,
    funded:balanceUsdc == null ? null : balanceUsdc > 0,
    keyExposure:'encrypted_at_rest_never_returned',
    createdAt:row.created_at,
    updatedAt:row.updated_at,
  };
}

async function payX402(url, options = {}, control = {}) {
  const target = validateTarget(url);
  const reason = String(control.reason || '').trim();
  const opportunityId = String(control.opportunityId || '').trim() || null;
  const maxUsd = Math.min(Number(control.maxUsd ?? DEFAULT_ACTION_CAP_USDC), DEFAULT_ACTION_CAP_USDC);
  const reservationKey = String(control.idempotencyKey || '').trim();
  if (!reason) throw new Error('spend reason required');
  if (!reservationKey || reservationKey.length < 8 || reservationKey.length > 200) throw new Error('stable idempotency key required');
  if (!(maxUsd > 0)) throw new Error('maxUsd must be positive');

  const preflight = await fetch(target, { ...options, redirect:'manual' });
  if (preflight.status !== 402) {
    return { paid:false, spentUsdc:0, response:preflight, reason:'payment_not_required' };
  }
  const parsed = parseChallenge(preflight);
  if (parsed.amountUsdc > maxUsd + 1e-9) throw new Error(`quoted price ${parsed.amountUsdc} exceeds maxUsd ${maxUsd}`);
  if (parsed.payTo.toLowerCase() === RECEIVE_ADDRESS && RECEIVE_ADDRESS) throw new Error('self-payment to INCOME 2 receive wallet blocked');

  const reservation = await reserveSpend({
    amountUsdc: parsed.amountUsdc,
    opportunityId,
    reason,
    targetUrl: target.toString(),
    payTo: parsed.payTo,
    reservationKey,
  });
  const id = reservation.row.id;
  if (reservation.reused && reservation.row.state === 'settled') throw new Error('idempotency key already spent');
  if (reservation.reused && reservation.row.state === 'uncertain') throw new Error('idempotency key has uncertain prior spend; reconcile before retry');

  try {
    const account = await getAccount();
    const { x402Client } = await import('@x402/core/client');
    const { registerExactEvmScheme } = await import('@x402/evm/exact/client');
    const { wrapFetchWithPayment } = await import('@x402/fetch');
    const client = new x402Client();
    registerExactEvmScheme(client, { signer: account });
    const paidFetch = wrapFetchWithPayment(fetch, client);
    const response = await paidFetch(target.toString(), options);
    const paymentResponse = decodeBase64Json(response.headers.get('payment-response') || response.headers.get('x-payment-response'));
    const txHash = paymentResponse?.transaction || paymentResponse?.transactionHash || paymentResponse?.txHash || null;
    if (paymentResponse) {
      await finishReservation(id, 'settled', { httpStatus: response.status, txHash, detail:{ paymentResponse } });
      console.log(JSON.stringify({ type:'earn_spend_settled', amountUsdc:parsed.amountUsdc, targetHost:target.hostname, opportunityId, txHash, at:new Date().toISOString() }));
      return { paid:true, spentUsdc:parsed.amountUsdc, response, txHash, paymentResponse };
    }
    if (response.status === 402) {
      await finishReservation(id, 'failed', { httpStatus:response.status, detail:{ reason:'payment_not_accepted' } });
      return { paid:false, spentUsdc:0, response, reason:'payment_not_accepted' };
    }
    await finishReservation(id, 'uncertain', { httpStatus:response.status, detail:{ reason:'missing_payment_response_header' } });
    throw new Error('paid request outcome uncertain; reservation retained against cap');
  } catch (error) {
    const r = await pool.query(`SELECT state FROM earn_spend_ledger WHERE id=$1`, [id]).catch(() => ({rows:[]}));
    const current = r.rows[0]?.state;
    if (current === 'reserved') await finishReservation(id, 'uncertain', { detail:{ error:String(error?.message || error).slice(0,400) } }).catch(() => {});
    throw error;
  }
}

module.exports = {
  init,
  status,
  getAccount,
  payX402,
  constants:{ ownerCapUsdc:OWNER_CAP_USDC, defaultPerActionCapUsdc:DEFAULT_ACTION_CAP_USDC, network:NETWORK, usdc:USDC_BASE },
};
