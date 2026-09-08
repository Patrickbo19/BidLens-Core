const crypto = require('crypto');
let Pool;
try { ({ Pool } = require('pg')); } catch { Pool = null; }

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const MASTER_KEY_RAW = String(process.env.TASKBOUNTY_VAULT_KEY || '').trim();
const pool = DATABASE_URL && Pool ? new Pool({
  connectionString: DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 30000,
  ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
}) : null;

function masterKeyBuffer() {
  if (!MASTER_KEY_RAW) throw new Error('vault master key is not configured');
  let buf;
  try { buf = Buffer.from(MASTER_KEY_RAW, 'base64url'); } catch { buf = Buffer.alloc(0); }
  if (buf.length !== 32) {
    try { buf = Buffer.from(MASTER_KEY_RAW, 'base64'); } catch { buf = Buffer.alloc(0); }
  }
  if (buf.length !== 32) throw new Error('vault master key must decode to 32 bytes');
  return buf;
}

function keyBuffer() {
  return crypto.createHash('sha256')
    .update(masterKeyBuffer())
    .update('income2:moltbook:v1', 'utf8')
    .digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: tag.toString('base64') };
}

function decrypt(row) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer(), Buffer.from(row.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

async function init() {
  if (!pool) return { persistent: false, configured: Boolean(MASTER_KEY_RAW) };
  keyBuffer();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS earn_moltbook_credentials (
      id text PRIMARY KEY,
      ciphertext text NOT NULL,
      iv text NOT NULL,
      auth_tag text NOT NULL,
      agent_name text NOT NULL,
      claim_url text,
      verification_code text,
      claim_status text NOT NULL DEFAULT 'pending_claim',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      last_checked_at timestamptz
    );
  `);
  return { persistent: true, configured: true };
}

async function storeRegistration({ apiKey, agentName, claimUrl = null, verificationCode = null }) {
  if (!pool) throw new Error('Moltbook vault requires Postgres');
  if (!apiKey || !agentName) throw new Error('Moltbook apiKey and agentName are required');
  const enc = encrypt(apiKey);
  await pool.query(`
    INSERT INTO earn_moltbook_credentials
      (id, ciphertext, iv, auth_tag, agent_name, claim_url, verification_code, claim_status)
    VALUES ('primary', $1, $2, $3, $4, $5, $6, 'pending_claim')
    ON CONFLICT (id) DO UPDATE SET
      ciphertext=EXCLUDED.ciphertext,
      iv=EXCLUDED.iv,
      auth_tag=EXCLUDED.auth_tag,
      agent_name=EXCLUDED.agent_name,
      claim_url=EXCLUDED.claim_url,
      verification_code=EXCLUDED.verification_code,
      updated_at=now()
  `, [enc.ciphertext, enc.iv, enc.tag, agentName, claimUrl, verificationCode]);
  return { stored: true, persistent: true };
}

async function getApiKey() {
  if (!pool) return null;
  const r = await pool.query(`SELECT ciphertext, iv, auth_tag FROM earn_moltbook_credentials WHERE id='primary' LIMIT 1`);
  if (!r.rowCount) return null;
  return decrypt(r.rows[0]);
}

async function setClaimStatus(claimStatus) {
  if (!pool) return;
  await pool.query(`UPDATE earn_moltbook_credentials SET claim_status=$1, last_checked_at=now(), updated_at=now() WHERE id='primary'`, [String(claimStatus || 'unknown').slice(0,80)]);
}

async function status({ includeClaim = false } = {}) {
  if (!pool) return { connected: false, persistent: false, configured: Boolean(MASTER_KEY_RAW) };
  const r = await pool.query(`SELECT agent_name, claim_url, verification_code, claim_status, created_at, updated_at, last_checked_at FROM earn_moltbook_credentials WHERE id='primary' LIMIT 1`);
  if (!r.rowCount) return { connected: false, persistent: true, configured: Boolean(MASTER_KEY_RAW) };
  const row = r.rows[0];
  return {
    connected: true,
    persistent: true,
    configured: true,
    agentName: row.agent_name,
    claimStatus: row.claim_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastCheckedAt: row.last_checked_at,
    ...(includeClaim ? { claimUrl: row.claim_url, verificationCode: row.verification_code } : {}),
  };
}

module.exports = { init, storeRegistration, getApiKey, setClaimStatus, status };
