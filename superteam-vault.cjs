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
  return crypto.createHmac('sha256', rootKey()).update('income2:superteam:agent-api:v1').digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', vaultKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return { ciphertext:ciphertext.toString('base64'), iv:iv.toString('base64'), tag:cipher.getAuthTag().toString('base64') };
}

function decrypt(ciphertext, iv, tag) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', vaultKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

async function init() {
  if (!pool) return { persistent:false, configured:Boolean(ROOT_KEY_RAW) };
  rootKey();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS earn_superteam_credentials (
      id text PRIMARY KEY,
      agent_id text NOT NULL,
      username text,
      api_key_ciphertext text NOT NULL,
      api_key_iv text NOT NULL,
      api_key_auth_tag text NOT NULL,
      claim_code_ciphertext text NOT NULL,
      claim_code_iv text NOT NULL,
      claim_code_auth_tag text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  return { persistent:true, configured:true };
}

async function storeAgent({ agentId, username = null, apiKey, claimCode }) {
  if (!pool) throw new Error('Superteam vault requires Postgres');
  agentId = String(agentId || '').trim();
  username = String(username || '').trim() || null;
  apiKey = String(apiKey || '').trim();
  claimCode = String(claimCode || '').trim();
  if (!agentId || !apiKey || !claimCode) throw new Error('invalid Superteam credential material');
  const api = encrypt(apiKey);
  const claim = encrypt(claimCode);
  await pool.query(`
    INSERT INTO earn_superteam_credentials
      (id, agent_id, username, api_key_ciphertext, api_key_iv, api_key_auth_tag,
       claim_code_ciphertext, claim_code_iv, claim_code_auth_tag)
    VALUES ('primary', $1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO NOTHING
  `, [agentId, username, api.ciphertext, api.iv, api.tag, claim.ciphertext, claim.iv, claim.tag]);
  return { stored:true, persistent:true };
}

async function getAgent() {
  if (!pool) return null;
  const r = await pool.query(`
    SELECT agent_id, username,
           api_key_ciphertext, api_key_iv, api_key_auth_tag,
           claim_code_ciphertext, claim_code_iv, claim_code_auth_tag,
           created_at, updated_at
    FROM earn_superteam_credentials WHERE id='primary' LIMIT 1
  `);
  if (!r.rowCount) return null;
  const row = r.rows[0];
  return {
    agentId:row.agent_id,
    username:row.username || null,
    apiKey:decrypt(row.api_key_ciphertext, row.api_key_iv, row.api_key_auth_tag),
    claimCode:decrypt(row.claim_code_ciphertext, row.claim_code_iv, row.claim_code_auth_tag),
    createdAt:row.created_at,
    updatedAt:row.updated_at,
  };
}

async function status() {
  if (!pool) return { connected:false, persistent:false, configured:Boolean(ROOT_KEY_RAW) };
  const r = await pool.query(`SELECT agent_id, username, created_at, updated_at FROM earn_superteam_credentials WHERE id='primary' LIMIT 1`);
  if (!r.rowCount) return { connected:false, persistent:true, configured:true };
  const row = r.rows[0];
  return {
    connected:true,
    persistent:true,
    configured:true,
    agentId:row.agent_id,
    username:row.username || null,
    claimCodeStoredEncrypted:true,
    apiKeyStoredEncrypted:true,
    createdAt:row.created_at,
    updatedAt:row.updated_at,
  };
}

module.exports = { init, storeAgent, getAgent, status };
