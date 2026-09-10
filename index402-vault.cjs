const crypto = require('crypto');
let Pool;
try { ({ Pool } = require('pg')); } catch { Pool = null; }

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const ROOT_KEY_RAW = String(process.env.TASKBOUNTY_VAULT_KEY || '').trim();
const pool = DATABASE_URL && Pool ? new Pool({
  connectionString: DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 30000,
  ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
}) : null;

function rootKey() {
  if (!ROOT_KEY_RAW) throw new Error('vault root key is not configured');
  let buf;
  try { buf = Buffer.from(ROOT_KEY_RAW, 'base64url'); } catch { buf = Buffer.alloc(0); }
  if (buf.length !== 32) {
    try { buf = Buffer.from(ROOT_KEY_RAW, 'base64'); } catch { buf = Buffer.alloc(0); }
  }
  if (buf.length !== 32) throw new Error('vault root key must decode to 32 bytes');
  return buf;
}

function claimKey() {
  return crypto.createHmac('sha256', rootKey()).update('income2:402index:domain-claim:v1').digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', claimKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return { ciphertext:ciphertext.toString('base64'), iv:iv.toString('base64'), tag:cipher.getAuthTag().toString('base64') };
}

function decrypt(row) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', claimKey(), Buffer.from(row.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

async function init() {
  if (!pool) return { persistent:false, configured:Boolean(ROOT_KEY_RAW) };
  rootKey();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS earn_402index_domain_claim (
      id text PRIMARY KEY,
      domain text NOT NULL,
      ciphertext text NOT NULL,
      iv text NOT NULL,
      auth_tag text NOT NULL,
      verification_hash text NOT NULL,
      verified_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  return { persistent:true, configured:true };
}

async function storeClaim({ domain, token, verificationHash }) {
  if (!pool) throw new Error('402 Index vault requires Postgres');
  domain = String(domain || '').trim();
  token = String(token || '').trim();
  verificationHash = String(verificationHash || '').trim();
  if (!domain || !token || !/^[a-f0-9]{64}$/i.test(verificationHash)) throw new Error('invalid 402 Index claim material');
  const enc = encrypt(token);
  await pool.query(`
    INSERT INTO earn_402index_domain_claim (id, domain, ciphertext, iv, auth_tag, verification_hash, verified_at)
    VALUES ('primary', $1, $2, $3, $4, $5, NULL)
    ON CONFLICT (id) DO UPDATE SET
      domain=EXCLUDED.domain,
      ciphertext=EXCLUDED.ciphertext,
      iv=EXCLUDED.iv,
      auth_tag=EXCLUDED.auth_tag,
      verification_hash=EXCLUDED.verification_hash,
      verified_at=NULL,
      updated_at=now()
  `, [domain, enc.ciphertext, enc.iv, enc.tag, verificationHash]);
  return { stored:true, persistent:true };
}

async function getClaim() {
  if (!pool) return null;
  const r = await pool.query(`SELECT domain, ciphertext, iv, auth_tag, verification_hash, verified_at FROM earn_402index_domain_claim WHERE id='primary' LIMIT 1`);
  if (!r.rowCount) return null;
  const row = r.rows[0];
  return { domain:row.domain, token:decrypt(row), verificationHash:row.verification_hash, verified:Boolean(row.verified_at) };
}

async function markVerified() {
  if (!pool) return;
  await pool.query(`UPDATE earn_402index_domain_claim SET verified_at=now(), updated_at=now() WHERE id='primary'`);
}

async function status() {
  if (!pool) return { connected:false, persistent:false, configured:Boolean(ROOT_KEY_RAW), verified:false, verificationHash:null };
  const r = await pool.query(`SELECT domain, verification_hash, verified_at, created_at, updated_at FROM earn_402index_domain_claim WHERE id='primary' LIMIT 1`);
  if (!r.rowCount) return { connected:false, persistent:true, configured:true, verified:false, verificationHash:null };
  const row = r.rows[0];
  return {
    connected:true,
    persistent:true,
    configured:true,
    domain:row.domain,
    verified:Boolean(row.verified_at),
    verificationHash:row.verification_hash,
    createdAt:row.created_at,
    updatedAt:row.updated_at,
  };
}

module.exports = { init, storeClaim, getClaim, markVerified, status };
