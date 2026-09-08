const crypto = require('crypto');
let Pool;
try { ({ Pool } = require('pg')); } catch { Pool = null; }

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const VAULT_KEY_RAW = String(process.env.TASKBOUNTY_VAULT_KEY || '').trim();
const pool = DATABASE_URL && Pool ? new Pool({
  connectionString: DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 30000,
  ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
}) : null;

function keyBuffer() {
  if (!VAULT_KEY_RAW) throw new Error('TASKBOUNTY_VAULT_KEY is not configured');
  let buf;
  try { buf = Buffer.from(VAULT_KEY_RAW, 'base64url'); } catch { buf = Buffer.alloc(0); }
  if (buf.length !== 32) {
    try { buf = Buffer.from(VAULT_KEY_RAW, 'base64'); } catch { buf = Buffer.alloc(0); }
  }
  if (buf.length !== 32) throw new Error('TASKBOUNTY_VAULT_KEY must decode to 32 bytes');
  return buf;
}

function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(token), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function decryptToken(row) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer(), Buffer.from(row.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

async function init() {
  if (!pool) return { persistent: false, configured: Boolean(VAULT_KEY_RAW) };
  await pool.query(`
    CREATE TABLE IF NOT EXISTS earn_taskbounty_credentials (
      id text PRIMARY KEY,
      ciphertext text NOT NULL,
      iv text NOT NULL,
      auth_tag text NOT NULL,
      taskbounty_user_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      last_verified_at timestamptz
    );
  `);
  keyBuffer();
  return { persistent: true, configured: true };
}

async function storeToken(token, taskbountyUserId = null) {
  if (!pool) throw new Error('TaskBounty vault requires Postgres');
  token = String(token || '').trim();
  if (!token) throw new Error('TaskBounty token is empty');
  const enc = encryptToken(token);
  await pool.query(`
    INSERT INTO earn_taskbounty_credentials
      (id, ciphertext, iv, auth_tag, taskbounty_user_id, last_verified_at)
    VALUES ('primary', $1, $2, $3, $4, now())
    ON CONFLICT (id) DO UPDATE SET
      ciphertext=EXCLUDED.ciphertext,
      iv=EXCLUDED.iv,
      auth_tag=EXCLUDED.auth_tag,
      taskbounty_user_id=COALESCE(EXCLUDED.taskbounty_user_id, earn_taskbounty_credentials.taskbounty_user_id),
      updated_at=now(),
      last_verified_at=now()
  `, [enc.ciphertext, enc.iv, enc.tag, taskbountyUserId || null]);
  return { stored: true, persistent: true };
}

async function getToken() {
  if (!pool) return null;
  const r = await pool.query(`SELECT ciphertext, iv, auth_tag FROM earn_taskbounty_credentials WHERE id='primary' LIMIT 1`);
  if (!r.rowCount) return null;
  return decryptToken(r.rows[0]);
}

async function markVerified() {
  if (!pool) return;
  await pool.query(`UPDATE earn_taskbounty_credentials SET last_verified_at=now(), updated_at=now() WHERE id='primary'`);
}

async function status() {
  if (!pool) return { connected: false, persistent: false, configured: Boolean(VAULT_KEY_RAW) };
  const r = await pool.query(`SELECT taskbounty_user_id, created_at, updated_at, last_verified_at FROM earn_taskbounty_credentials WHERE id='primary' LIMIT 1`);
  if (!r.rowCount) return { connected: false, persistent: true, configured: Boolean(VAULT_KEY_RAW) };
  const row = r.rows[0];
  return {
    connected: true,
    persistent: true,
    configured: true,
    taskbountyUserIdPresent: Boolean(row.taskbounty_user_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastVerifiedAt: row.last_verified_at,
  };
}

module.exports = { init, storeToken, getToken, markVerified, status };
