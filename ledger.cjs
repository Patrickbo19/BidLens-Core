const crypto = require('crypto');

let Pool;
try { ({ Pool } = require('pg')); } catch { Pool = null; }

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const USER_SHARE_BPS = Number(process.env.AGENT_USER_SHARE_BPS || 7000);
const PLATFORM_SHARE_BPS = 10000 - USER_SHARE_BPS;
const ACCOUNT_PREFIX = 'income2_';

const pool = DATABASE_URL && Pool
  ? new Pool({
      connectionString: DATABASE_URL,
      max: 4,
      idleTimeoutMillis: 30_000,
      ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
    })
  : null;

const memory = { accounts: new Map(), entries: new Map() };

function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function money(value) { return Number(Number(value || 0).toFixed(6)); }
function newHandle() { return `${ACCOUNT_PREFIX}${crypto.randomBytes(8).toString('hex')}`; }
function newToken() { return crypto.randomBytes(32).toString('base64url'); }

async function init() {
  if (!pool) return { persistent: false, backend: 'memory' };
  await pool.query(`
    CREATE TABLE IF NOT EXISTS earn_accounts (
      id uuid PRIMARY KEY,
      handle text UNIQUE NOT NULL,
      token_hash text NOT NULL,
      agent_enabled boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      last_credit_at timestamptz
    );
    CREATE TABLE IF NOT EXISTS earn_ledger_entries (
      id uuid PRIMARY KEY,
      account_id uuid REFERENCES earn_accounts(id) ON DELETE SET NULL,
      source text NOT NULL,
      source_ref text UNIQUE NOT NULL,
      status text NOT NULL DEFAULT 'settled',
      gross_usd numeric(20,6) NOT NULL DEFAULT 0,
      user_share_usd numeric(20,6) NOT NULL DEFAULT 0,
      platform_share_usd numeric(20,6) NOT NULL DEFAULT 0,
      payer text,
      network text,
      asset text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS earn_accounts_active_idx
      ON earn_accounts (agent_enabled, last_credit_at, created_at);
    CREATE INDEX IF NOT EXISTS earn_ledger_account_idx
      ON earn_ledger_entries (account_id, created_at DESC);
  `);
  return { persistent: true, backend: 'postgres' };
}

async function createAccount({ enableAgent = true } = {}) {
  const id = crypto.randomUUID();
  const handle = newHandle();
  const token = newToken();
  const tokenHash = sha256(token);
  const now = new Date().toISOString();
  if (!pool) {
    memory.accounts.set(handle, { id, handle, tokenHash, agentEnabled: Boolean(enableAgent), createdAt: now, updatedAt: now, lastCreditAt: null });
  } else {
    await pool.query(
      `INSERT INTO earn_accounts (id, handle, token_hash, agent_enabled) VALUES ($1,$2,$3,$4)`,
      [id, handle, tokenHash, Boolean(enableAgent)],
    );
  }
  return { id, handle, token, agentEnabled: Boolean(enableAgent), persistent: Boolean(pool) };
}

async function authenticate(handle, token) {
  handle = String(handle || '').trim();
  token = String(token || '').trim();
  if (!handle || !token) return null;
  const tokenHash = sha256(token);
  if (!pool) {
    const row = memory.accounts.get(handle);
    if (!row || row.tokenHash !== tokenHash) return null;
    return row;
  }
  const result = await pool.query(
    `SELECT id, handle, token_hash, agent_enabled, created_at, updated_at, last_credit_at
       FROM earn_accounts WHERE handle=$1 AND token_hash=$2 LIMIT 1`,
    [handle, tokenHash],
  );
  if (!result.rowCount) return null;
  const r = result.rows[0];
  return { id: r.id, handle: r.handle, tokenHash: r.token_hash, agentEnabled: r.agent_enabled, createdAt: r.created_at, updatedAt: r.updated_at, lastCreditAt: r.last_credit_at };
}

async function setAgentEnabled(handle, token, enabled) {
  const account = await authenticate(handle, token);
  if (!account) return null;
  if (!pool) {
    account.agentEnabled = Boolean(enabled);
    account.updatedAt = new Date().toISOString();
    memory.accounts.set(handle, account);
  } else {
    await pool.query(`UPDATE earn_accounts SET agent_enabled=$1, updated_at=now() WHERE id=$2`, [Boolean(enabled), account.id]);
  }
  return { ...account, agentEnabled: Boolean(enabled) };
}

async function getSummary(handle, token) {
  const account = await authenticate(handle, token);
  if (!account) return null;
  if (!pool) {
    const entries = [...memory.entries.values()].filter(e => e.accountId === account.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    return buildSummary(account, entries);
  }
  const result = await pool.query(
    `SELECT id, source, source_ref, status, gross_usd, user_share_usd, platform_share_usd,
            payer, network, asset, metadata, created_at
       FROM earn_ledger_entries WHERE account_id=$1 ORDER BY created_at DESC LIMIT 100`,
    [account.id],
  );
  return buildSummary(account, result.rows.map(r => ({
    id: r.id,
    source: r.source,
    sourceRef: r.source_ref,
    status: r.status,
    grossUsd: Number(r.gross_usd),
    userShareUsd: Number(r.user_share_usd),
    platformShareUsd: Number(r.platform_share_usd),
    payer: r.payer,
    network: r.network,
    asset: r.asset,
    metadata: r.metadata,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  })));
}

function buildSummary(account, entries) {
  const settled = entries.filter(e => e.status === 'settled');
  return {
    handle: account.handle,
    agentEnabled: Boolean(account.agentEnabled),
    persistent: Boolean(pool),
    grossAttributedUsd: money(settled.reduce((n,e) => n + Number(e.grossUsd || 0), 0)),
    availableBalanceUsd: money(settled.reduce((n,e) => n + Number(e.userShareUsd || 0), 0)),
    platformShareUsd: money(settled.reduce((n,e) => n + Number(e.platformShareUsd || 0), 0)),
    settlementCount: settled.length,
    recent: entries.slice(0,20),
    payoutStatus: 'external_cashout_not_enabled_in_beta',
  };
}

function chooseMemoryActiveAccount() {
  const active = [...memory.accounts.values()].filter(a => a.agentEnabled);
  const preferred = active.filter(a => String(a.handle).startsWith(ACCOUNT_PREFIX));
  const poolRows = preferred.length ? preferred : active;
  return poolRows.sort((a,b) => {
    const aLast = a.lastCreditAt ? String(a.lastCreditAt) : '';
    const bLast = b.lastCreditAt ? String(b.lastCreditAt) : '';
    if (!aLast && bLast) return -1;
    if (aLast && !bLast) return 1;
    if (aLast !== bLast) return aLast.localeCompare(bLast);
    return String(a.createdAt).localeCompare(String(b.createdAt));
  })[0] || null;
}

async function chooseActiveAccount(client) {
  const preferred = await client.query(
    `SELECT id, handle FROM earn_accounts
      WHERE agent_enabled=true AND handle LIKE $1
      ORDER BY last_credit_at ASC NULLS FIRST, created_at ASC
      FOR UPDATE SKIP LOCKED LIMIT 1`,
    [`${ACCOUNT_PREFIX}%`],
  );
  if (preferred.rowCount) return preferred.rows[0];
  const fallback = await client.query(
    `SELECT id, handle FROM earn_accounts
      WHERE agent_enabled=true
      ORDER BY last_credit_at ASC NULLS FIRST, created_at ASC
      FOR UPDATE SKIP LOCKED LIMIT 1`,
  );
  return fallback.rows[0] || null;
}

async function recordAgentSettlement({ sourceRef, grossUsd, payer, transaction, network='eip155:8453', asset='USDC', metadata={} }) {
  sourceRef = String(sourceRef || transaction || '').trim();
  grossUsd = money(grossUsd);
  if (!sourceRef || !(grossUsd > 0)) return { recorded: false, reason: 'missing_reference_or_amount' };

  if (!pool) {
    if (memory.entries.has(sourceRef)) return { recorded: false, reason: 'duplicate' };
    const active = chooseMemoryActiveAccount();
    const userShareUsd = active ? money(grossUsd * USER_SHARE_BPS / 10000) : 0;
    const platformShareUsd = active ? money(grossUsd - userShareUsd) : grossUsd;
    const entry = { id: crypto.randomUUID(), accountId: active?.id || null, source: 'x402_agent_service', sourceRef, status: 'settled', grossUsd, userShareUsd, platformShareUsd, payer: payer || null, network, asset, metadata, createdAt: new Date().toISOString() };
    memory.entries.set(sourceRef, entry);
    if (active) { active.lastCreditAt = entry.createdAt; memory.accounts.set(active.handle, active); }
    return { recorded: true, assignedHandle: active?.handle || null, userShareUsd, platformShareUsd, persistent: false };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dupe = await client.query(`SELECT id FROM earn_ledger_entries WHERE source_ref=$1 LIMIT 1`, [sourceRef]);
    if (dupe.rowCount) { await client.query('ROLLBACK'); return { recorded: false, reason: 'duplicate' }; }
    const active = await chooseActiveAccount(client);
    const userShareUsd = active ? money(grossUsd * USER_SHARE_BPS / 10000) : 0;
    const platformShareUsd = active ? money(grossUsd - userShareUsd) : grossUsd;
    await client.query(
      `INSERT INTO earn_ledger_entries
        (id, account_id, source, source_ref, status, gross_usd, user_share_usd, platform_share_usd, payer, network, asset, metadata)
       VALUES ($1,$2,'x402_agent_service',$3,'settled',$4,$5,$6,$7,$8,$9,$10::jsonb)`,
      [crypto.randomUUID(), active?.id || null, sourceRef, grossUsd, userShareUsd, platformShareUsd, payer || null, network, asset, JSON.stringify(metadata || {})],
    );
    if (active) await client.query(`UPDATE earn_accounts SET last_credit_at=now(), updated_at=now() WHERE id=$1`, [active.id]);
    await client.query('COMMIT');
    return { recorded: true, assignedHandle: active?.handle || null, userShareUsd, platformShareUsd, persistent: true };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function systemStatus() {
  if (!pool) {
    const accounts = [...memory.accounts.values()];
    const entries = [...memory.entries.values()];
    return {
      persistent: false,
      activeAccounts: accounts.filter(a => a.agentEnabled).length,
      activeIncome2Accounts: accounts.filter(a => a.agentEnabled && String(a.handle).startsWith(ACCOUNT_PREFIX)).length,
      accounts: accounts.length,
      settlements: entries.length,
      grossUsd: money(entries.reduce((n,e) => n + Number(e.grossUsd || 0), 0)),
    };
  }
  const [a,e] = await Promise.all([
    pool.query(`SELECT count(*)::int AS accounts,
                       count(*) FILTER (WHERE agent_enabled)::int AS active,
                       count(*) FILTER (WHERE agent_enabled AND handle LIKE $1)::int AS active_income2
                  FROM earn_accounts`, [`${ACCOUNT_PREFIX}%`]),
    pool.query(`SELECT count(*)::int AS settlements, COALESCE(sum(gross_usd),0)::numeric AS gross FROM earn_ledger_entries WHERE status='settled'`),
  ]);
  return {
    persistent: true,
    activeAccounts: Number(a.rows[0].active || 0),
    activeIncome2Accounts: Number(a.rows[0].active_income2 || 0),
    accounts: Number(a.rows[0].accounts || 0),
    settlements: Number(e.rows[0].settlements || 0),
    grossUsd: money(e.rows[0].gross || 0),
  };
}

module.exports = {
  init,
  createAccount,
  authenticate,
  setAgentEnabled,
  getSummary,
  recordAgentSettlement,
  systemStatus,
  USER_SHARE_BPS,
  PLATFORM_SHARE_BPS,
  ACCOUNT_PREFIX,
  persistent: Boolean(pool),
};