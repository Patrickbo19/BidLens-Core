const http = require('http');
const crypto = require('crypto');
const spendVault = require('./earn-spend-vault.cjs');
const evaluator = require('./earn-opportunity-evaluator.cjs');

const SOLVER_KEY = String(process.env.TASKBOUNTY_SOLVER_KEY || '').trim();

function secureEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function authorized(req) {
  return Boolean(SOLVER_KEY && secureEqual(req.headers['x-income2-solver-key'], SOLVER_KEY));
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  res.end(JSON.stringify(data));
}

function readBody(req, max = 32000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > max) reject(new Error('body too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function handleSpendRoute(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/earn/spend/status') {
    try {
      const status = await spendVault.status();
      return sendJson(res, 200, {
        ok: true,
        spend: {
          connected: status.connected,
          signerReady: status.signerReady,
          network: status.network,
          asset: status.asset,
          address: status.address,
          ownerCapUsdc: status.ownerCapUsdc,
          defaultPerActionCapUsdc: status.defaultPerActionCapUsdc,
          usedUsdc: status.usedUsdc,
          remainingUsdc: status.remainingUsdc,
          onchainUsdcBalance: status.onchainUsdcBalance,
          funded: status.funded,
          keyExposure: status.keyExposure,
        },
      });
    } catch (error) {
      return sendJson(res, 503, { ok: false, message: String(error?.message || error).slice(0, 300) });
    }
  }

  if (req.method === 'POST' && url.pathname === '/earn/spend/evaluate') {
    if (!authorized(req)) return sendJson(res, 401, { ok: false, message: 'solver authorization required' });
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const result = await evaluator.evaluate(body);
      console.log(JSON.stringify({
        type: 'earn_spend_opportunity_evaluated',
        opportunityId: result.opportunityId,
        decision: result.decision,
        eligible: result.eligible,
        evidenceTier: result.evidenceTier,
        maxCostUsdc: result.economics.maxCostUsdc,
        payoutFloorUsdc: result.economics.verifiedPayoutFloorUsdc,
        at: new Date().toISOString(),
      }));
      return sendJson(res, 200, { ok: true, result });
    } catch (error) {
      console.log(JSON.stringify({ type: 'earn_spend_opportunity_rejected', error: String(error?.message || error).slice(0, 300), at: new Date().toISOString() }));
      return sendJson(res, 422, { ok: false, message: String(error?.message || error).slice(0, 300) });
    }
  }
  return false;
}

if (!http.__earnSpendPatched) {
  http.__earnSpendPatched = true;
  const originalCreateServer = http.createServer;
  http.createServer = function patchedCreateServer(listener, ...rest) {
    if (typeof listener !== 'function') return originalCreateServer.call(this, listener, ...rest);
    const wrapped = async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://localhost');
        const handled = await handleSpendRoute(req, res, url);
        if (handled !== false) return;
      } catch (error) {
        if (!res.headersSent) return sendJson(res, 500, { ok: false, message: 'spend route error' });
      }
      return listener(req, res);
    };
    return originalCreateServer.call(this, wrapped, ...rest);
  };
}

module.exports = { handleSpendRoute };
