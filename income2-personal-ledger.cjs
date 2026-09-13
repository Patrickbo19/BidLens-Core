const crypto = require('crypto');
const { Pool } = require('pg');
const ledger = require('./ledger.cjs');

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const USER_SHARE_BPS = Number(process.env.INCOME2_USER_SHARE_BPS || 7000);
const PLATFORM_SHARE_BPS = 10000 - USER_SHARE_BPS;
const pool = DATABASE_URL ? new Pool({
  connectionString:DATABASE_URL,
  max:3,
  idleTimeoutMillis:30000,
  ssl:/localhost|127\.0\.0\.1/.test(DATABASE_URL)?false:{rejectUnauthorized:false},
}) : null;
let initPromise = null;

function money(v){ return Number(Number(v||0).toFixed(6)); }
function validAddress(v){ return /^0x[a-fA-F0-9]{40}$/.test(String(v||'').trim()); }
function newAgentId(){ return `i2_${crypto.randomBytes(8).toString('hex')}`; }

async function init(){
  if(!initPromise) initPromise=(async()=>{
    await ledger.init();
    if(!pool) throw new Error('DATABASE_URL required for Income2 personal agents');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS income2_personal_agents(
        account_id uuid PRIMARY KEY REFERENCES earn_accounts(id) ON DELETE CASCADE,
        agent_id text UNIQUE NOT NULL,
        client_type text NOT NULL DEFAULT 'human',
        payout_address text,
        enabled boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        last_scan_at timestamptz,
        opportunity_count integer NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS income2_personal_earnings(
        id uuid PRIMARY KEY,
        account_id uuid NOT NULL REFERENCES earn_accounts(id) ON DELETE CASCADE,
        agent_id text NOT NULL,
        source text NOT NULL,
        source_ref text UNIQUE NOT NULL,
        status text NOT NULL DEFAULT 'settled',
        gross_usd numeric(20,6) NOT NULL,
        user_share_usd numeric(20,6) NOT NULL,
        platform_share_usd numeric(20,6) NOT NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS income2_withdrawals(
        id uuid PRIMARY KEY,
        account_id uuid NOT NULL REFERENCES earn_accounts(id) ON DELETE CASCADE,
        amount_usd numeric(20,6) NOT NULL,
        payout_address text NOT NULL,
        status text NOT NULL DEFAULT 'requested',
        tx_hash text,
        requested_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz
      );
      CREATE INDEX IF NOT EXISTS income2_earnings_account_idx ON income2_personal_earnings(account_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS income2_withdrawals_account_idx ON income2_withdrawals(account_id,requested_at DESC);
    `);
    return {persistent:true};
  })();
  return initPromise;
}

async function activate(account,{clientType='human',payoutAddress=null}={}){
  await init();
  const type=clientType==='agent'?'agent':'human';
  const existing=await pool.query(`SELECT agent_id FROM income2_personal_agents WHERE account_id=$1`,[account.id]);
  if(!existing.rowCount){
    await pool.query(`INSERT INTO income2_personal_agents(account_id,agent_id,client_type) VALUES($1,$2,$3)`,[account.id,newAgentId(),type]);
  } else {
    await pool.query(`UPDATE income2_personal_agents SET client_type=$1,enabled=true,updated_at=now() WHERE account_id=$2`,[type,account.id]);
  }
  if(payoutAddress){
    if(!validAddress(payoutAddress)) throw new Error('payoutAddress must be a Base-compatible 0x address');
    await pool.query(`UPDATE income2_personal_agents SET payout_address=$1,updated_at=now() WHERE account_id=$2`,[String(payoutAddress).trim(),account.id]);
  }
  return status(account);
}

async function setPayout(account,address){
  await init();
  if(!validAddress(address)) throw new Error('valid Base-compatible 0x payoutAddress required');
  await activate(account);
  await pool.query(`UPDATE income2_personal_agents SET payout_address=$1,updated_at=now() WHERE account_id=$2`,[String(address).trim(),account.id]);
  return status(account);
}

async function recordEarning(account,{source,sourceRef,grossUsd,metadata={}}){
  await init();
  const p=await activate(account);
  const gross=money(grossUsd);
  if(!sourceRef || !(gross>0)) return {recorded:false,reason:'missing_reference_or_amount'};
  const user=money(gross*USER_SHARE_BPS/10000);
  const platform=money(gross-user);
  try{
    await pool.query(`INSERT INTO income2_personal_earnings(id,account_id,agent_id,source,source_ref,status,gross_usd,user_share_usd,platform_share_usd,metadata) VALUES($1,$2,$3,$4,$5,'settled',$6,$7,$8,$9::jsonb)`,[crypto.randomUUID(),account.id,p.agentId,String(source||'personal_agent'),String(sourceRef),gross,user,platform,JSON.stringify(metadata||{})]);
    return {recorded:true,grossUsd:gross,userShareUsd:user,platformShareUsd:platform};
  }catch(e){ if(e?.code==='23505')return {recorded:false,reason:'duplicate'}; throw e; }
}

async function status(account){
  await init();
  const [p,e,w]=await Promise.all([
    pool.query(`SELECT agent_id,client_type,payout_address,enabled,created_at,last_scan_at,opportunity_count FROM income2_personal_agents WHERE account_id=$1 LIMIT 1`,[account.id]),
    pool.query(`SELECT COALESCE(sum(user_share_usd),0)::numeric AS earned, count(*)::int AS settlements FROM income2_personal_earnings WHERE account_id=$1 AND status='settled'`,[account.id]),
    pool.query(`SELECT COALESCE(sum(amount_usd),0)::numeric AS withdrawn FROM income2_withdrawals WHERE account_id=$1 AND status IN ('requested','approved','paid')`,[account.id]),
  ]);
  if(!p.rowCount) return null;
  const x=p.rows[0],earned=money(e.rows[0].earned),reserved=money(w.rows[0].withdrawn);
  return {
    agentId:x.agent_id,
    clientType:x.client_type,
    enabled:Boolean(x.enabled),
    payoutAddress:x.payout_address,
    payoutNetwork:'Base',
    payoutAsset:'USDC',
    grossUserEarningsUsd:earned,
    availableToWithdrawUsd:money(Math.max(0,earned-reserved)),
    settlementCount:Number(e.rows[0].settlements||0),
    opportunityCount:Number(x.opportunity_count||0),
    lastScanAt:x.last_scan_at,
    economy:'personal_agent_only_private_earn_excluded',
    userSharePercent:USER_SHARE_BPS/100,
    platformSharePercent:PLATFORM_SHARE_BPS/100,
    withdrawalRail:'request_queue_pending_automated_safe_payout',
  };
}

async function requestWithdrawal(account,amountUsd){
  await init();
  const s=await status(account);
  if(!s) throw new Error('personal agent not activated');
  if(!s.payoutAddress) throw new Error('set payoutAddress before requesting withdrawal');
  const amount=money(amountUsd==null?s.availableToWithdrawUsd:amountUsd);
  if(!(amount>0)) throw new Error('withdrawal amount must be greater than zero');
  if(amount>s.availableToWithdrawUsd) throw new Error('withdrawal exceeds available personal-agent balance');
  const id=crypto.randomUUID();
  await pool.query(`INSERT INTO income2_withdrawals(id,account_id,amount_usd,payout_address) VALUES($1,$2,$3,$4)`,[id,account.id,amount,s.payoutAddress]);
  return {withdrawalId:id,amountUsd:amount,payoutAddress:s.payoutAddress,status:'requested'};
}

async function listWithdrawals(account){
  await init();
  const r=await pool.query(`SELECT id,amount_usd,payout_address,status,tx_hash,requested_at,completed_at FROM income2_withdrawals WHERE account_id=$1 ORDER BY requested_at DESC LIMIT 20`,[account.id]);
  return r.rows.map(x=>({withdrawalId:x.id,amountUsd:Number(x.amount_usd),payoutAddress:x.payout_address,status:x.status,txHash:x.tx_hash,requestedAt:x.requested_at,completedAt:x.completed_at}));
}

module.exports={init,activate,setPayout,recordEarning,status,requestWithdrawal,listWithdrawals,validAddress,USER_SHARE_BPS,PLATFORM_SHARE_BPS};
