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

function vaultKey() {
  return crypto.createHmac('sha256', rootKey()).update('income2:payanagent:api-key:v1').digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', vaultKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return { ciphertext:ciphertext.toString('base64'), iv:iv.toString('base64'), tag:cipher.getAuthTag().toString('base64') };
}

function decrypt(row) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', vaultKey(), Buffer.from(row.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

async function init() {
  if (!pool) return { persistent:false, configured:Boolean(ROOT_KEY_RAW) };
  rootKey();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS earn_payanagent_credentials (
      id text PRIMARY KEY,
      agent_id text NOT NULL,
      api_key_prefix text,
      ciphertext text NOT NULL,
      iv text NOT NULL,
      auth_tag text NOT NULL,
      primary_offer_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  return { persistent:true, configured:true };
}

async function storeAgent({ agentId, apiKey, apiKeyPrefix = null }) {
  if (!pool) throw new Error('PayanAgent vault requires Postgres');
  agentId = String(agentId || '').trim();
  apiKey = String(apiKey || '').trim();
  if (!agentId || !apiKey) throw new Error('invalid PayanAgent credential material');
  const enc = encrypt(apiKey);
  await pool.query(`
    INSERT INTO earn_payanagent_credentials
      (id, agent_id, api_key_prefix, ciphertext, iv, auth_tag)
    VALUES ('primary', $1, $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE SET
      agent_id=EXCLUDED.agent_id,
      api_key_prefix=EXCLUDED.api_key_prefix,
      ciphertext=EXCLUDED.ciphertext,
      iv=EXCLUDED.iv,
      auth_tag=EXCLUDED.auth_tag,
      updated_at=now()
  `, [agentId, apiKeyPrefix ? String(apiKeyPrefix).slice(0, 32) : null, enc.ciphertext, enc.iv, enc.tag]);
  return { stored:true, persistent:true };
}

async function getAgent() {
  if (!pool) return null;
  const r = await pool.query(`SELECT agent_id, api_key_prefix, ciphertext, iv, auth_tag, primary_offer_id FROM earn_payanagent_credentials WHERE id='primary' LIMIT 1`);
  if (!r.rowCount) return null;
  const row = r.rows[0];
  return {
    agentId:row.agent_id,
    apiKeyPrefix:row.api_key_prefix || null,
    apiKey:decrypt(row),
    primaryOfferId:row.primary_offer_id || null,
  };
}

async function setPrimaryOfferId(offerId) {
  if (!pool) throw new Error('PayanAgent vault requires Postgres');
  offerId = String(offerId || '').trim();
  if (!offerId) throw new Error('offer id is required');
  await pool.query(`UPDATE earn_payanagent_credentials SET primary_offer_id=$1, updated_at=now() WHERE id='primary'`, [offerId]);
  return { stored:true };
}

async function status() {
  if (!pool) return { connected:false, persistent:false, configured:Boolean(ROOT_KEY_RAW) };
  const r = await pool.query(`SELECT agent_id, api_key_prefix, primary_offer_id, created_at, updated_at FROM earn_payanagent_credentials WHERE id='primary' LIMIT 1`);
  if (!r.rowCount) return { connected:false, persistent:true, configured:true };
  const row = r.rows[0];
  return {
    connected:true,
    persistent:true,
    configured:true,
    agentId:row.agent_id,
    apiKeyPrefix:row.api_key_prefix || null,
    primaryOfferId:row.primary_offer_id || null,
    createdAt:row.created_at,
    updatedAt:row.updated_at,
  };
}

module.exports = { init, storeAgent, getAgent, setPrimaryOfferId, status };
