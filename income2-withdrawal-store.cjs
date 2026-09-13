const { Pool } = require('pg');
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const pool = DATABASE_URL ? new Pool({connectionString:DATABASE_URL,max:2,idleTimeoutMillis:30000,ssl:/localhost|127\.0\.0\.1/.test(DATABASE_URL)?false:{rejectUnauthorized:false}}) : null;

async function get(id){
  if(!pool)throw new Error('withdrawal store requires Postgres');
  const r=await pool.query(`SELECT id,account_id,amount_usd,payout_address,status,tx_hash,requested_at,completed_at FROM income2_withdrawals WHERE id=$1 LIMIT 1`,[String(id)]);
  if(!r.rowCount)return null;const x=r.rows[0];return{withdrawalId:x.id,accountId:x.account_id,amountUsd:Number(x.amount_usd),payoutAddress:x.payout_address,status:x.status,txHash:x.tx_hash,requestedAt:x.requested_at,completedAt:x.completed_at};
}
async function markPaid(id,txHash=null){
  if(!pool)throw new Error('withdrawal store requires Postgres');
  await pool.query(`UPDATE income2_withdrawals SET status='paid',tx_hash=COALESCE($2,tx_hash),completed_at=COALESCE(completed_at,now()) WHERE id=$1 AND status IN ('requested','approved','paid')`,[String(id),txHash||null]);
  return get(id);
}
async function markFailed(id,detail=null){
  if(!pool)throw new Error('withdrawal store requires Postgres');
  await pool.query(`UPDATE income2_withdrawals SET status='failed' WHERE id=$1 AND status='requested'`,[String(id)]);
  return {...await get(id),detail:detail?String(detail).slice(0,300):null};
}
module.exports={get,markPaid,markFailed};
