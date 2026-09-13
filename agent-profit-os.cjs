const fs = require('fs');
const path = require('path');
const spendVault = require('./earn-spend-vault.cjs');
const evaluator = require('./earn-opportunity-evaluator.cjs');

const QUEUE_PATH = String(process.env.EARN_PROFIT_QUEUE_PATH || path.join(__dirname, 'earn-profit-queue.json'));
const MAX_QUEUE_AGE_MS = 24 * 60 * 60 * 1000;

function asMethod(value) {
  const method = String(value || 'GET').trim().toUpperCase();
  if (!['GET','POST','PUT','PATCH','DELETE'].includes(method)) throw new Error('unsupported method');
  return method;
}

function routeCatalog() {
  return {
    earn: {
      human: 'https://earn-router.onrender.com/api/opportunities',
      agent: 'https://earn-tools-backend.onrender.com/',
      taskBounty: 'https://earn-tools-backend.onrender.com/taskbounty/status',
    },
    buy: {
      outcomeRouter: 'https://earn-tools-backend.onrender.com/outcome-router',
      purchaseGuard: 'https://earn-tools-backend.onrender.com/purchase-guard',
    },
    sell: {
      income2Seller: 'https://earn-tools-backend.onrender.com/',
      publicData: 'https://income2-treasury.onrender.com/',
    },
  };
}

async function status() {
  const wallet = await spendVault.status();
  return {
    product: 'EARN Agent Profit OS',
    objective: 'maximize verified legal profit with minimal owner labor',
    modes: ['EARN_NOW','EARN_TOLL','EARN_ASSET'],
    wallet: {
      connected: wallet.connected,
      signerReady: wallet.signerReady,
      address: wallet.address,
      network: wallet.network,
      asset: wallet.asset,
      ownerCapUsdc: wallet.ownerCapUsdc,
      defaultPerActionCapUsdc: wallet.defaultPerActionCapUsdc,
      usedUsdc: wallet.usedUsdc,
      remainingUsdc: wallet.remainingUsdc,
      onchainUsdcBalance: wallet.onchainUsdcBalance,
      funded: wallet.funded,
    },
    routes: routeCatalog(),
    executionPolicy: {
      ownerCapitalRequiresEvidence: ['PROVEN','VALIDATED'],
      payoutFloorMustCoverSpend: true,
      selfPurchaseBlocked: true,
      idempotencyRequired: true,
      queueMaxAgeHours: 24,
    },
  };
}

function plan(input = {}) {
  const goal = String(input.goal || 'make_money').trim().toLowerCase();
  const zeroSpendOnly = input.zero_spend_only !== false;
  if (goal === 'buy_result' || goal === 'procure') {
    return { goal, recommended: 'OUTCOME_ROUTER', route: routeCatalog().buy.outcomeRouter, why: 'route demand to existing supply before building' };
  }
  if (goal === 'protect_purchase') {
    return { goal, recommended: 'PURCHASE_GUARD', route: routeCatalog().buy.purchaseGuard, why: 'cap spend and make retries idempotent before payment' };
  }
  if (goal === 'sell' || goal === 'monetize_capability') {
    return { goal, recommended: 'INCOME2_SELLER', route: routeCatalog().sell.income2Seller, publicData: routeCatalog().sell.publicData, why: 'reuse existing paid supply surfaces' };
  }
  return {
    goal: 'make_money',
    recommended: zeroSpendOnly ? 'EARN_NOW_ZERO_SPEND_FIRST' : 'EARN_NOW_THEN_TOLL',
    routes: routeCatalog().earn,
    policy: 'prefer funded work and tolls; use owner working capital only when verified payout floor covers cost',
  };
}

async function executeVerifiedOpportunity(input = {}) {
  if (input.approved_for_autonomous_execution !== true) throw new Error('autonomous execution approval flag required');
  const evaluation = await evaluator.evaluate(input);
  if (!evaluation.eligible) throw new Error('opportunity is not execution ready');

  const targetUrl = String(input.target_url || '').trim();
  const idempotencyKey = String(input.idempotency_key || '').trim();
  const reason = String(input.reason || '').trim();
  if (!targetUrl) throw new Error('target_url is required');
  if (idempotencyKey.length < 8) throw new Error('idempotency_key is required');
  if (!reason) throw new Error('reason is required');

  const method = asMethod(input.method);
  const options = { method, headers: { accept: 'application/json' } };
  if (input.body !== undefined && method !== 'GET') {
    options.headers['content-type'] = 'application/json';
    options.body = JSON.stringify(input.body);
  }

  const paid = await spendVault.payX402(targetUrl, options, {
    reason,
    opportunityId: evaluation.opportunityId,
    maxUsd: evaluation.economics.maxCostUsdc,
    idempotencyKey,
  });

  let responseBody = null;
  try {
    const text = await paid.response.text();
    if (text) {
      try { responseBody = JSON.parse(text); }
      catch { responseBody = { text: text.slice(0, 4000) }; }
    }
  } catch {}

  return {
    decision: paid.paid ? 'PAID_EXECUTED' : 'NO_SPEND',
    paid: paid.paid,
    spentUsdc: paid.spentUsdc || 0,
    txHash: paid.txHash || null,
    httpStatus: paid.response?.status || null,
    response: responseBody,
    opportunityId: evaluation.opportunityId,
    evidenceTier: evaluation.evidenceTier,
    economics: evaluation.economics,
  };
}

function readQueue() {
  if (!fs.existsSync(QUEUE_PATH)) return { version: 1, items: [] };
  const raw = fs.readFileSync(QUEUE_PATH, 'utf8');
  const parsed = JSON.parse(raw || '{}');
  return { version: Number(parsed.version || 1), items: Array.isArray(parsed.items) ? parsed.items : [] };
}

function queueItemFresh(item) {
  if (!item.expires_at) return false;
  const expires = Date.parse(item.expires_at);
  if (!Number.isFinite(expires) || expires <= Date.now()) return false;
  const created = Date.parse(item.created_at || '');
  if (!Number.isFinite(created) || Date.now() - created > MAX_QUEUE_AGE_MS) return false;
  return true;
}

async function processQueueOnce() {
  const queue = readQueue();
  const candidate = queue.items.find(item => item && item.state === 'APPROVED' && item.approved_for_autonomous_execution === true && queueItemFresh(item));
  if (!candidate) return { processed: false, reason: 'no_fresh_approved_item' };
  const result = await executeVerifiedOpportunity(candidate);
  console.log(JSON.stringify({
    type: 'agent_profit_os_execution',
    opportunityId: result.opportunityId,
    decision: result.decision,
    spentUsdc: result.spentUsdc,
    txHash: result.txHash,
    at: new Date().toISOString(),
  }));
  return { processed: true, result };
}

module.exports = { status, plan, executeVerifiedOpportunity, processQueueOnce, routeCatalog };
