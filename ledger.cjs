const crypto = require('crypto');

let Pool;
try { ({ Pool } = require('pg')); } catch { Pool = null; }

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const USER_SHARE_BPS = Number(process.env.AGENT_USER_SHARE_BPS || 7000);
const PLATFORM_SHARE_BPS = 10000 - USER_SHARE_BPS;
const ACCOUNT_PREFIX = 'income2_';
const WORKER_PREFIX = 'worker_';
const INVITE_PREFIX = 'earn_';

const pool = DATABASE_URL && Pool
  ? new Pool({
      connectionString: DATABASE_URL,
      max: 4,
      idleTimeoutMillis: 30_000,
      ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
    })
  : null;

const memory = { accounts: new Map(), entries: new Map() };
let initPromise = null;

function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function money(value) { return Number(Number(value || 0).toFixed(6)); }
function newHandle() { return `${ACCOUNT_PREFIX}${crypto.randomBytes(8).toString('hex')}`; }
function newToken() { return crypto.randomBytes(32).toString('base64url'); }
function newWorkerId() { return `${WORKER_PREFIX}${crypto.randomBytes(8).toString('hex')}`; }
function newInviteCode() { return `${INVITE_PREFIX}${crypto.randomBytes(5).toString('hex')}`; }
function normalizeInviteCode(value) {
  const code = String(value || '').trim().toLowerCase();
  return /^[a-z0-9_-]{4,40}$/.test(code) ? code : null;
}

async function ensureSchema() {
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

    ALTER TABLE earn_accounts ADD COLUMN IF NOT EXISTS worker_id text;
    ALTER TABLE earn_accounts ADD COLUMN IF NOT EXISTS invite_code text;
    ALTER TABLE earn_accounts ADD COLUMN IF NOT EXISTS referred_by_code text;
    ALTER TABLE earn_accounts ADD COLUMN IF NOT EXISTS worker_enabled boolean NOT NULL DEFAULT true;
    ALTER TABLE earn_accounts ADD COLUMN IF NOT EXISTS last_assignment_at timestamptz;
    ALTER TABLE earn_accounts ADD COLUMN IF NOT EXISTS assignment_count integer NOT NULL DEFAULT 0;

    ALTER TABLE earn_ledger_entries ADD COLUMN IF NOT EXISTS worker_id text;
    ALTER TABLE earn_ledger_entries ADD COLUMN IF NOT EXISTS assignment_mode text NOT NULL DEFAULT 'legacy';

    CREATE UNIQUE INDEX IF NOT EXISTS earn_accounts_worker_id_uidx
      ON earn_accounts(worker_id) WHERE worker_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS earn_accounts_invite_code_uidx
      ON earn_accounts(invite_code) WHERE invite_code IS NOT NULL;
    CREATE INDEX IF NOT EXISTS earn_accounts_active_idx
      ON earn_accounts (agent_enabled, worker_enabled, last_assignment_at, created_at);
    CREATE INDEX IF NOT EXISTS earn_accounts_referrer_idx
      ON earn_accounts (referred_by_code);
    CREATE INDEX IF NOT EXISTS earn_ledger_account_idx
      ON earn_ledger_entries (account_id, created_at DESC);
  `);

  const missing = await pool.query(`SELECT id FROM earn_accounts WHERE worker_id IS NULL OR invite_code IS NULL`);
  for (const row of missing.rows) {
    let updated = false;
    for (let attempt = 0; attempt < 8 && !updated; attempt++) {
      try {
        await pool.query(
          `UPDATE earn_accounts
              SET worker_id=COALESCE(worker_id,$1), invite_code=COALESCE(invite_code,$2), worker_enabled=agent_enabled
            WHERE id=$3`,
          [newWorkerId(), newInviteCode(), row.id],
        );
        updated = true;
      } catch (error) {
        if (error?.code !== '23505' || attempt === 7) throw error;
      }
    }
  }
  return { persistent: true, backend: 'postgres' };
}

async function init() {
  if (!initPromise) initPromise = ensureSchema().catch(error => { initPromise = null; throw error; });
  return initPromise;
}

async function resolveReferrer(referralCode) {
  const code = normalizeInviteCode(referralCode);
  if (!code) return null;
  if (!pool) {
    for (const row of memory.accounts.values()) if (row.inviteCode === code) return row;
    return null;
  }
  const result = await pool.query(
    `SELECT id, handle, invite_code FROM earn_accounts WHERE invite_code=$1 LIMIT 1`,
    [code],
  );
  if (!result.rowCount) return null;
  return { id: result.rows[0].id, handle: result.rows[0].handle, inviteCode: result.rows[0].invite_code };
}

async function createAccount({ enableAgent = true, referralCode = null } = {}) {
  await init();
  const id = crypto.randomUUID();
  const handle = newHandle();
  const token = newToken();
  const tokenHash = sha256(token);
  const workerId = newWorkerId();
  const inviteCode = newInviteCode();
  const referrer = await resolveReferrer(referralCode);
  const referredByCode = referrer?.inviteCode || null;
  const now = new Date().toISOString();
  const row = {
    id, handle, tokenHash, workerId, inviteCode, referredByCode,
    agentEnabled: Boolean(enableAgent), workerEnabled: Boolean(enableAgent),
    createdAt: now, updatedAt: now, lastCreditAt: null, lastAssignmentAt: null, assignmentCount: 0,
  };
  if (!pool) {
    memory.accounts.set(handle, row);
  } else {
    await pool.query(
      `INSERT INTO earn_accounts
        (id, handle, token_hash, agent_enabled, worker_id, invite_code, referred_by_code, worker_enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, handle, tokenHash, Boolean(enableAgent), workerId, inviteCode, referredByCode, Boolean(enableAgent)],
    );
  }
  return {
    id, handle, token, workerId, inviteCode, referredByCode,
    agentEnabled: Boolean(enableAgent), workerEnabled: Boolean(enableAgent), persistent: Boolean(pool),
  };
}

function normalizeAccountRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    handle: r.handle,
    tokenHash: r.token_hash ?? r.tokenHash,
    agentEnabled: Boolean(r.agent_enabled ?? r.agentEnabled),
    workerId: r.worker_id ?? r.workerId ?? null,
    inviteCode: r.invite_code ?? r.inviteCode ?? null,
    referredByCode: r.referred_by_code ?? r.referredByCode ?? null,
    workerEnabled: Boolean(r.worker_enabled ?? r.workerEnabled ?? r.agent_enabled ?? r.agentEnabled),
    assignmentCount: Number(r.assignment_count ?? r.assignmentCount ?? 0),
    createdAt: r.created_at ?? r.createdAt ?? null,
    updatedAt: r.updated_at ?? r.updatedAt ?? null,
    lastCreditAt: r.last_credit_at ?? r.lastCreditAt ?? null,
    lastAssignmentAt: r.last_assignment_at ?? r.lastAssignmentAt ?? null,
  };
}

async function authenticate(handle, token) {
  await init();
  handle = String(handle || '').trim();
  token = String(token || '').trim();
  if (!handle || !token) return null;
  const tokenHash = sha256(token);
  if (!pool) {
    const row = memory.accounts.get(handle);
    if (!row || row.tokenHash !== tokenHash) return null;
    return normalizeAccountRow(row);
  }
  const result = await pool.query(
    `SELECT id, handle, token_hash, agent_enabled, worker_id, invite_code, referred_by_code,
            worker_enabled, assignment_count, created_at, updated_at, last_credit_at, last_assignment_at
       FROM earn_accounts WHERE handle=$1 AND token_hash=$2 LIMIT 1`,
    [handle, tokenHash],
  );
  return result.rowCount ? normalizeAccountRow(result.rows[0]) : null;
}

async function setAgentEnabled(handle, token, enabled) {
  const account = await authenticate(handle, token);
  if (!account) return null;
  const on = Boolean(enabled);
  if (!pool) {
    const raw = memory.accounts.get(handle);
    raw.agentEnabled = on;
    raw.workerEnabled = on;
    raw.updatedAt = new Date().toISOString();
    memory.accounts.set(handle, raw);
  } else {
    await pool.query(
      `UPDATE earn_accounts SET agent_enabled=$1, worker_enabled=$1, updated_at=now() WHERE id=$2`,
      [on, account.id],
    );
  }
  return { ...account, agentEnabled: on, workerEnabled: on };
}

async function referralStats(account) {
  if (!account?.inviteCode) return { directReferrals: 0 };
  if (!pool) {
    let directReferrals = 0;
    for (const row of memory.accounts.values()) if (row.referredByCode === account.inviteCode) directReferrals++;
    return { directReferrals };
  }
  const result = await pool.query(
    `SELECT count(*)::int AS direct FROM earn_accounts WHERE referred_by_code=$1`,
    [account.inviteCode],
  );
  return { directReferrals: Number(result.rows[0]?.direct || 0) };
}

async function getSummary(handle, token) {
  const account = await authenticate(handle, token);
  if (!account) return null;
  let entries;
  if (!pool) {
    entries = [...memory.entries.values()]
      .filter(e => e.accountId === account.id)
      .sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  } else {
    const result = await pool.query(
      `SELECT id, source, source_ref, status, gross_usd, user_share_usd, platform_share_usd,
              payer, network, asset, metadata, worker_id, assignment_mode, created_at
         FROM earn_ledger_entries WHERE account_id=$1 ORDER BY created_at DESC LIMIT 100`,
      [account.id],
    );
    entries = result.rows.map(r => ({
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
      workerId: r.worker_id,
      assignmentMode: r.assignment_mode,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  }
  const referrals = await referralStats(account);
  return buildSummary(account, entries, referrals);
}

function buildSummary(account, entries, referrals = { directReferrals: 0 }) {
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
    worker: {
      workerId: account.workerId,
      status: account.workerEnabled && account.agentEnabled ? 'active' : 'paused',
      assignmentCount: Number(account.assignmentCount || settled.length || 0),
      lastAssignmentAt: account.lastAssignmentAt || account.lastCreditAt || null,
      allocationMode: 'explicit_job_owner_else_fair_pool',
      infrastructure: 'shared_backend_isolated_account_state',
    },
    referral: {
      inviteCode: account.inviteCode,
      referredByCode: account.referredByCode || null,
      directReferrals: Number(referrals.directReferrals || 0),
      rewardPolicy: 'tracking_only_no_referral_payout_enabled',
    },
    payoutStatus: 'external_cashout_not_enabled_in_beta',
  };
}

function chooseMemoryActiveAccount({ accountHandle = null, workerId = null } = {}) {
  const active = [...memory.accounts.values()].filter(a => a.agentEnabled && a.workerEnabled);
  if (accountHandle || workerId) {
    return active.find(a => (accountHandle && a.handle === accountHandle) || (workerId && a.workerId === workerId)) || null;
  }
  const preferred = active.filter(a => String(a.handle).startsWith(ACCOUNT_PREFIX));
  const rows = preferred.length ? preferred : active;
  return rows.sort((a,b) => {
    const aLast = a.lastAssignmentAt ? String(a.lastAssignmentAt) : '';
    const bLast = b.lastAssignmentAt ? String(b.lastAssignmentAt) : '';
    if (!aLast && bLast) return -1;
    if (aLast && !bLast) return 1;
    if (aLast !== bLast) return aLast.localeCompare(bLast);
    return String(a.createdAt).localeCompare(String(b.createdAt));
  })[0] || null;
}

async function chooseActiveAccount(client, { accountHandle = null, workerId = null } = {}) {
  if (accountHandle || workerId) {
    const params = [];
    const conditions = [];
    if (accountHandle) { params.push(String(accountHandle)); conditions.push(`handle=$${params.length}`); }
    if (workerId) { params.push(String(workerId)); conditions.push(`worker_id=$${params.length}`); }
    const direct = await client.query(
      `SELECT id, handle, worker_id FROM earn_accounts
        WHERE agent_enabled=true AND worker_enabled=true AND (${conditions.join(' OR ')})
        FOR UPDATE LIMIT 1`,
      params,
    );
    return direct.rows[0] || null;
  }
  const preferred = await client.query(
    `SELECT id, handle, worker_id FROM earn_accounts
      WHERE agent_enabled=true AND worker_enabled=true AND handle LIKE $1
      ORDER BY last_assignment_at ASC NULLS FIRST, created_at ASC
      FOR UPDATE SKIP LOCKED LIMIT 1`,
    [`${ACCOUNT_PREFIX}%`],
  );
  if (preferred.rowCount) return preferred.rows[0];
  const fallback = await client.query(
    `SELECT id, handle, worker_id FROM earn_accounts
      WHERE agent_enabled=true AND worker_enabled=true
      ORDER BY last_assignment_at ASC NULLS FIRST, created_at ASC
      FOR UPDATE SKIP LOCKED LIMIT 1`,
  );
  return fallback.rows[0] || null;
}

async function recordAgentSettlement({
  sourceRef, grossUsd, payer, transaction, network='eip155:8453', asset='USDC', metadata={},
  accountHandle = null, workerId = null,
}) {
  await init();
  sourceRef = String(sourceRef || transaction || '').trim();
  grossUsd = money(grossUsd);
  if (!sourceRef || !(grossUsd > 0)) return { recorded: false, reason: 'missing_reference_or_amount' };
  const directRequested = Boolean(accountHandle || workerId);

  if (!pool) {
    if (memory.entries.has(sourceRef)) return { recorded: false, reason: 'duplicate' };
    const active = chooseMemoryActiveAccount({ accountHandle, workerId });
    const assignmentMode = active ? (directRequested ? 'direct_worker' : 'fair_pool') : 'platform_only_unassigned';
    const userShareUsd = active ? money(grossUsd * USER_SHARE_BPS / 10000) : 0;
    const platformShareUsd = active ? money(grossUsd - userShareUsd) : grossUsd;
    const entry = {
      id: crypto.randomUUID(), accountId: active?.id || null, workerId: active?.workerId || null,
      source: 'x402_agent_service', sourceRef, status: 'settled', grossUsd, userShareUsd, platformShareUsd,
      payer: payer || null, network, asset, metadata, assignmentMode, createdAt: new Date().toISOString(),
    };
    memory.entries.set(sourceRef, entry);
    if (active) {
      active.lastCreditAt = entry.createdAt;
      active.lastAssignmentAt = entry.createdAt;
      active.assignmentCount = Number(active.assignmentCount || 0) + 1;
      active.updatedAt = entry.createdAt;
      memory.accounts.set(active.handle, active);
    }
    return {
      recorded: true, assignedHandle: active?.handle || null, workerId: active?.workerId || null,
      assignmentMode, userShareUsd, platformShareUsd, persistent: false,
    };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dupe = await client.query(`SELECT id FROM earn_ledger_entries WHERE source_ref=$1 LIMIT 1`, [sourceRef]);
    if (dupe.rowCount) { await client.query('ROLLBACK'); return { recorded: false, reason: 'duplicate' }; }
    const active = await chooseActiveAccount(client, { accountHandle, workerId });
    const assignmentMode = active ? (directRequested ? 'direct_worker' : 'fair_pool') : 'platform_only_unassigned';
    const userShareUsd = active ? money(grossUsd * USER_SHARE_BPS / 10000) : 0;
    const platformShareUsd = active ? money(grossUsd - userShareUsd) : grossUsd;
    await client.query(
      `INSERT INTO earn_ledger_entries
        (id, account_id, source, source_ref, status, gross_usd, user_share_usd, platform_share_usd,
         payer, network, asset, metadata, worker_id, assignment_mode)
       VALUES ($1,$2,'x402_agent_service',$3,'settled',$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)`,
      [crypto.randomUUID(), active?.id || null, sourceRef, grossUsd, userShareUsd, platformShareUsd,
       payer || null, network, asset, JSON.stringify(metadata || {}), active?.worker_id || null, assignmentMode],
    );
    if (active) {
      await client.query(
        `UPDATE earn_accounts
            SET last_credit_at=now(), last_assignment_at=now(), assignment_count=assignment_count+1, updated_at=now()
          WHERE id=$1`,
        [active.id],
      );
    }
    await client.query('COMMIT');
    return {
      recorded: true, assignedHandle: active?.handle || null, workerId: active?.worker_id || null,
      assignmentMode, userShareUsd, platformShareUsd, persistent: true,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function systemStatus() {
  await init();
  if (!pool) {
    const accounts = [...memory.accounts.values()];
    const entries = [...memory.entries.values()];
    return {
      persistent: false,
      activeAccounts: accounts.filter(a => a.agentEnabled).length,
      activeWorkers: accounts.filter(a => a.agentEnabled && a.workerEnabled).length,
      activeIncome2Accounts: accounts.filter(a => a.agentEnabled && String(a.handle).startsWith(ACCOUNT_PREFIX)).length,
      accounts: accounts.length,
      referralAccounts: accounts.filter(a => a.referredByCode).length,
      settlements: entries.length,
      grossUsd: money(entries.reduce((n,e) => n + Number(e.grossUsd || 0), 0)),
    };
  }
  const [a,e] = await Promise.all([
    pool.query(`SELECT count(*)::int AS accounts,
                       count(*) FILTER (WHERE agent_enabled)::int AS active,
                       count(*) FILTER (WHERE agent_enabled AND worker_enabled)::int AS active_workers,
                       count(*) FILTER (WHERE agent_enabled AND handle LIKE $1)::int AS active_income2,
                       count(*) FILTER (WHERE referred_by_code IS NOT NULL)::int AS referred
                  FROM earn_accounts`, [`${ACCOUNT_PREFIX}%`]),
    pool.query(`SELECT count(*)::int AS settlements, COALESCE(sum(gross_usd),0)::numeric AS gross FROM earn_ledger_entries WHERE status='settled'`),
  ]);
  return {
    persistent: true,
    activeAccounts: Number(a.rows[0].active || 0),
    activeWorkers: Number(a.rows[0].active_workers || 0),
    activeIncome2Accounts: Number(a.rows[0].active_income2 || 0),
    accounts: Number(a.rows[0].accounts || 0),
    referralAccounts: Number(a.rows[0].referred || 0),
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
  normalizeInviteCode,
  USER_SHARE_BPS,
  PLATFORM_SHARE_BPS,
  ACCOUNT_PREFIX,
  persistent: Boolean(pool),
};