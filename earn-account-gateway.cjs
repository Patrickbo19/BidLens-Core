const http = require('http');
const ledger = require('./ledger.cjs');

let installed = false;
let initPromise = null;
const createWindows = new Map();

function ensureInit() {
  if (!initPromise) initPromise = ledger.init().catch(error => { initPromise = null; throw error; });
  return initPromise;
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

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 80);
}

function allowAccountCreate(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const hits = (createWindows.get(ip) || []).filter(t => now - t < windowMs);
  if (hits.length >= 10) return false;
  hits.push(now);
  createWindows.set(ip, hits);
  return true;
}

function readJson(req, max = 24000) {
  return new Promise((resolve, reject) => {
    let body = '';
    let done = false;
    req.on('data', chunk => {
      if (done) return;
      body += chunk;
      if (body.length > max) {
        done = true;
        reject(Object.assign(new Error('body too large'), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (done) return;
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(Object.assign(new Error('invalid JSON body'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

function accountResponse(summary, extra = {}) {
  return {
    ok: true,
    ...extra,
    summary,
    worker: summary?.worker || null,
    referral: summary?.referral || null,
    userSharePercent: ledger.USER_SHARE_BPS / 100,
    platformSharePercent: ledger.PLATFORM_SHARE_BPS / 100,
    earningModel: 'isolated_worker_lane_shared_marketplace_demand',
    cashout: 'external_cashout_not_enabled_in_beta',
  };
}

async function handleAccount(req, res) {
  const u = new URL(req.url || '/', 'http://localhost');
  if (!['/account/start', '/account/summary'].includes(u.pathname)) return false;
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok:false, message:'POST required' });
    return true;
  }
  await ensureInit();
  if (!ledger.persistent) {
    sendJson(res, 503, { ok:false, message:'Persistent account storage is required for multi-user Agent Earn.' });
    return true;
  }

  const body = await readJson(req);
  const handle = String(body.accountHandle || '').trim();
  const token = String(body.accountToken || '').trim();

  if (u.pathname === '/account/summary') {
    if (!handle || !token) {
      sendJson(res, 422, { ok:false, message:'accountHandle and accountToken are required.' });
      return true;
    }
    const summary = await ledger.getSummary(handle, token);
    if (!summary) {
      sendJson(res, 401, { ok:false, message:'Account authentication failed.' });
      return true;
    }
    sendJson(res, 200, accountResponse(summary));
    return true;
  }

  if (handle || token) {
    if (!handle || !token) {
      sendJson(res, 422, { ok:false, message:'Both accountHandle and accountToken are required.' });
      return true;
    }
    const updated = await ledger.setAgentEnabled(handle, token, true);
    if (!updated) {
      sendJson(res, 401, { ok:false, message:'Account authentication failed.' });
      return true;
    }
    const summary = await ledger.getSummary(handle, token);
    sendJson(res, 200, accountResponse(summary, {
      created: false,
      accountHandle: handle,
      agentEnabled: true,
      workerId: summary?.worker?.workerId || null,
      inviteCode: summary?.referral?.inviteCode || null,
    }));
    return true;
  }

  const ip = clientIp(req);
  if (!allowAccountCreate(ip)) {
    sendJson(res, 429, { ok:false, message:'Too many new accounts from this connection. Try again later.' });
    return true;
  }

  const referralCode = ledger.normalizeInviteCode(body.referralCode || body.ref || body.referrer || '');
  const account = await ledger.createAccount({ enableAgent:true, referralCode });
  const summary = await ledger.getSummary(account.handle, account.token);
  sendJson(res, 201, accountResponse(summary, {
    created: true,
    accountHandle: account.handle,
    accountToken: account.token,
    agentEnabled: true,
    ledgerPersistent: account.persistent,
    workerId: account.workerId,
    inviteCode: account.inviteCode,
    referredByCode: account.referredByCode,
  }));
  return true;
}

function install() {
  if (installed) return;
  installed = true;
  const originalCreateServer = http.createServer;
  http.createServer = function earnAccountAwareCreateServer(options, listener) {
    let opts = options;
    let handler = listener;
    if (typeof options === 'function') {
      handler = options;
      opts = undefined;
    }
    if (typeof handler !== 'function') {
      return opts === undefined
        ? originalCreateServer.call(http)
        : originalCreateServer.call(http, opts);
    }
    const wrapped = async (req, res) => {
      try {
        if (await handleAccount(req, res)) return;
      } catch (error) {
        console.error(JSON.stringify({
          type:'earn_account_gateway_error',
          error:String(error?.message || error).slice(0, 500),
          at:new Date().toISOString(),
        }));
        if (!res.headersSent) sendJson(res, Number(error?.statusCode || 500), { ok:false, message:String(error?.message || 'account service failed').slice(0, 200) });
        else res.end();
        return;
      }
      return handler(req, res);
    };
    return opts === undefined
      ? originalCreateServer.call(http, wrapped)
      : originalCreateServer.call(http, opts, wrapped);
  };
  console.log(JSON.stringify({ type:'earn_account_gateway_installed', persistentLedgerRequired:true, at:new Date().toISOString() }));
}

module.exports = { install };