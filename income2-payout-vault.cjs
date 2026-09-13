const crypto = require('crypto');
const { Pool } = require('pg');

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const VAULT_KEY_RAW = String(process.env.TASKBOUNTY_VAULT_KEY || '').trim();
const NETWORK = 'eip155:8453';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_RPC_URL = String(process.env.EARN_BASE_RPC_URL || 'https://mainnet.base.org').trim();
const ORIGIN = String(process.env.EARN_PUBLIC_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/,'');
const pool = DATABASE_URL ? new Pool({connectionString:DATABASE_URL,max:2,idleTimeoutMillis:30000,ssl:/localhost|127\.0\.0\.1/.test(DATABASE_URL)?false:{rejectUnauthorized:false}}) : null;
let initPromise = null;

function rawKey(){
  if(!VAULT_KEY_RAW)throw new Error('payout vault encryption key is not configured');
  let b;try{b=Buffer.from(VAULT_KEY_RAW,'base64url')}catch{b=Buffer.alloc(0)}
  if(b.length!==32){try{b=Buffer.from(VAULT_KEY_RAW,'base64')}catch{b=Buffer.alloc(0)}}
  if(b.length!==32)throw new Error('payout vault encryption key must decode to 32 bytes');
  return b;
}
function vaultKey(){return Buffer.from(crypto.hkdfSync('sha256',rawKey(),Buffer.alloc(0),Buffer.from('income2:payout-wallet:v1'),32))}
function encrypt(secret){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',vaultKey(),iv),ct=Buffer.concat([c.update(String(secret),'utf8'),c.final()]);return{ciphertext:ct.toString('base64'),iv:iv.toString('base64'),tag:c.getAuthTag().toString('base64')}}
function decrypt(row){const d=crypto.createDecipheriv('aes-256-gcm',vaultKey(),Buffer.from(row.iv,'base64'));d.setAuthTag(Buffer.from(row.auth_tag,'base64'));return Buffer.concat([d.update(Buffer.from(row.ciphertext,'base64')),d.final()]).toString('utf8')}
async function accountFromKey(key){const {privateKeyToAccount}=await import('viem/accounts');return privateKeyToAccount(key)}
async function generateKey(){for(let i=0;i<8;i++){const k=`0x${crypto.randomBytes(32).toString('hex')}`;try{await accountFromKey(k);return k}catch{}}throw new Error('could not generate payout wallet')}

async function init(){
  if(!initPromise)initPromise=(async()=>{
    if(!pool)throw new Error('payout vault requires Postgres');vaultKey();
    await pool.query(`CREATE TABLE IF NOT EXISTS income2_payout_wallet(id text PRIMARY KEY,address text NOT NULL,ciphertext text NOT NULL,iv text NOT NULL,auth_tag text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())`);
    let row=(await pool.query(`SELECT address FROM income2_payout_wallet WHERE id='primary' LIMIT 1`)).rows[0];
    if(!row){const key=await generateKey(),acct=await accountFromKey(key),enc=encrypt(key);await pool.query(`INSERT INTO income2_payout_wallet(id,address,ciphertext,iv,auth_tag) VALUES('primary',$1,$2,$3,$4) ON CONFLICT(id) DO NOTHING`,[acct.address,enc.ciphertext,enc.iv,enc.tag]);row=(await pool.query(`SELECT address FROM income2_payout_wallet WHERE id='primary' LIMIT 1`)).rows[0];}
    return{ready:Boolean(row?.address),address:row?.address||null,network:NETWORK,asset:'USDC'};
  })();return initPromise;
}
async function getAccount(){await init();const r=await pool.query(`SELECT ciphertext,iv,auth_tag FROM income2_payout_wallet WHERE id='primary' LIMIT 1`);if(!r.rowCount)throw new Error('payout wallet missing');return accountFromKey(decrypt(r.rows[0]))}
function decode(value){if(!value)return null;try{let s=String(value).replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return JSON.parse(Buffer.from(s,'base64').toString('utf8'))}catch{return null}}
function parseChallenge(response){const c=decode(response.headers.get('payment-required')||response.headers.get('x-payment-required'));if(!c||!Array.isArray(c.accepts))throw new Error('payout challenge unavailable');const o=c.accepts.find(x=>String(x?.scheme||'').toLowerCase()==='exact'&&String(x?.network||'')===NETWORK&&String(x?.asset||'').toLowerCase()===USDC_BASE.toLowerCase());if(!o)throw new Error('payout challenge has no Base USDC option');const atomic=BigInt(String(o.amount??o.maxAmountRequired??'0')),amountUsd=Number(atomic)/1_000_000,payTo=String(o.payTo||o.pay_to||'');if(atomic<=0n||!/^0x[a-fA-F0-9]{40}$/.test(payTo))throw new Error('invalid payout challenge');return{amountUsd,payTo}}
async function balance(address){try{const {createPublicClient,http,formatUnits}=await import('viem');const {base}=await import('viem/chains');const c=createPublicClient({chain:base,transport:http(BASE_RPC_URL)});const n=await c.readContract({address:USDC_BASE,abi:[{type:'function',name:'balanceOf',stateMutability:'view',inputs:[{name:'account',type:'address'}],outputs:[{name:'',type:'uint256'}]}],functionName:'balanceOf',args:[address]});return Number(formatUnits(n,6))}catch{return null}}
async function status(){const s=await init();return{...s,onchainUsdcBalance:await balance(s.address),encryptedAtRest:true,keyExposed:false,purpose:'income2_personal_market_only'}}

async function execute(withdrawal){
  const id=String(withdrawal?.withdrawalId||withdrawal?.id||'').trim(),amountUsd=Number(withdrawal?.amountUsd),payoutAddress=String(withdrawal?.payoutAddress||'').trim();
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('invalid withdrawal id');if(!(amountUsd>0))throw new Error('invalid withdrawal amount');if(!/^0x[a-fA-F0-9]{40}$/.test(payoutAddress))throw new Error('invalid withdrawal payout address');
  const s=await status();if(s.onchainUsdcBalance!=null&&s.onchainUsdcBalance+1e-9<amountUsd)throw new Error('Income2 payout treasury does not yet have enough settled USDC');
  const url=`${ORIGIN}/income2-payout/${encodeURIComponent(id)}`;
  const options={method:'POST',headers:{'content-type':'application/json','x-income2-payout-client':'treasury'},body:'{}'};
  const pre=await fetch(url,options);if(pre.status!==402)throw new Error(`payout receiver preflight returned ${pre.status}`);const ch=parseChallenge(pre);if(Math.abs(ch.amountUsd-amountUsd)>0.000001)throw new Error('payout challenge amount mismatch');if(ch.payTo.toLowerCase()!==payoutAddress.toLowerCase())throw new Error('payout challenge address mismatch');
  const acct=await getAccount();const {x402Client}=await import('@x402/core/client');const {registerExactEvmScheme}=await import('@x402/evm/exact/client');const {wrapFetchWithPayment}=await import('@x402/fetch');const client=new x402Client();registerExactEvmScheme(client,{signer:acct});const paid=wrapFetchWithPayment(fetch,client);const response=await paid(url,options);const pr=decode(response.headers.get('payment-response')||response.headers.get('x-payment-response'));const txHash=pr?.transaction||pr?.transactionHash||pr?.txHash||null;if(!response.ok||!pr)throw new Error(`payout settlement not confirmed (${response.status})`);return{paid:true,txHash,paymentResponse:pr,httpStatus:response.status};
}

module.exports={init,status,execute,constants:{network:NETWORK,asset:'USDC',usdc:USDC_BASE}};
