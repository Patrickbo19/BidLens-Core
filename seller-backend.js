const http = require('http');
const { spawn } = require('child_process');
const vault = require('./taskbounty-vault.cjs');

const PORT = Number(process.env.PORT || 3000);
const CORE_PORT = Number(process.env.SELLER_INTERNAL_PORT || 3901);
const TASKBOUNTY_API = 'https://www.task-bounty.com/api/v1';
const BOOTSTRAP_NONCE = String(process.env.TASKBOUNTY_BOOTSTRAP_NONCE || '').trim();

function sendJson(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}

function readBody(req, max = 12000) {
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

async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: ctl.signal, headers: { accept: 'application/json', ...(options.headers || {}) } });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
    return { ok: r.ok, status: r.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function countTasks(data) {
  if (Array.isArray(data)) return data.length;
  for (const key of ['data', 'tasks', 'items', 'results']) if (Array.isArray(data?.[key])) return data[key].length;
  return null;
}

async function taskBountyStatus() {
  const status = await vault.status();
  if (!status.connected) return { ...status, authReady: false, openTaskCount: null };
  const token = await vault.getToken();
  const check = await fetchJson(`${TASKBOUNTY_API}/tasks?state=open&limit=50`, { headers: { authorization: `Bearer ${token}` } });
  if (check.ok) await vault.markVerified();
  return { ...status, authReady: check.ok, openTaskCount: check.ok ? countTasks(check.data) : null, authHttpStatus: check.status };
}

async function handleVault(req, res, path) {
  if (path === '/taskbounty/status') {
    const status = await taskBountyStatus().catch(error => ({ connected: false, authReady: false, error: String(error?.message || error).slice(0, 300) }));
    sendJson(res, 200, { ok: true, taskBounty: status });
    return true;
  }

  if (!BOOTSTRAP_NONCE || path !== `/taskbounty/bootstrap/${BOOTSTRAP_NONCE}`) return false;
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, message: 'POST required' });
    return true;
  }

  try {
    const existing = await vault.status();
    if (existing.connected) {
      sendJson(res, 409, { ok: false, message: 'TaskBounty credential already stored; bootstrap closed.' });
      return true;
    }
    const raw = await readBody(req);
    let body;
    try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
    const accessToken = String(body.access_token || '').trim();
    const taskbountyUserId = String(body.taskbounty_user_id || '').trim() || null;
    if (!accessToken) {
      sendJson(res, 422, { ok: false, message: 'access_token required' });
      return true;
    }
    const verify = await fetchJson(`${TASKBOUNTY_API}/tasks?state=open&limit=1`, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!verify.ok) {
      sendJson(res, 401, { ok: false, message: `TaskBounty credential validation failed (${verify.status}).` });
      return true;
    }
    await vault.storeToken(accessToken, taskbountyUserId);
    const status = await taskBountyStatus();
    console.log(JSON.stringify({ type: 'taskbounty_credential_stored', encryptedAtRest: true, taskbountyUserIdPresent: Boolean(taskbountyUserId), authReady: status.authReady, at: new Date().toISOString() }));
    sendJson(res, 201, { ok: true, stored: true, encryptedAtRest: true, taskBounty: status });
  } catch (error) {
    console.error(JSON.stringify({ type: 'taskbounty_bootstrap_error', error: String(error?.message || error).slice(0, 500) }));
    sendJson(res, 500, { ok: false, message: 'TaskBounty credential bootstrap failed.' });
  }
  return true;
}

function proxy(req, res) {
  const headers = {
    ...req.headers,
    host: req.headers.host || 'earn-tools-backend.onrender.com',
    'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'https',
  };
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: CORE_PORT,
    path: req.url,
    method: req.method,
    headers,
  }, upstreamRes => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', error => {
    console.error(JSON.stringify({ type: 'seller_proxy_error', error: String(error?.message || error).slice(0, 300) }));
    if (!res.headersSent) sendJson(res, 503, { ok: false, message: 'Seller core is waking up.' });
    else res.end();
  });
  req.pipe(upstream);
}

(async () => {
  const vaultState = await vault.init();
  console.log(JSON.stringify({ type: 'taskbounty_vault_init', persistent: vaultState.persistent, configured: vaultState.configured }));

  const core = spawn(process.execPath, ['seller-core.js'], {
    env: { ...process.env, PORT: String(CORE_PORT) },
    stdio: 'inherit',
  });
  core.on('exit', (code, signal) => {
    console.error(JSON.stringify({ type: 'seller_core_exit', code, signal }));
    process.exit(code || 1);
  });

  const server = http.createServer(async (req, res) => {
    try {
      const path = new URL(req.url || '/', 'http://localhost').pathname;
      if (await handleVault(req, res, path)) return;
      proxy(req, res);
    } catch (error) {
      console.error(JSON.stringify({ type: 'seller_wrapper_error', error: String(error?.message || error).slice(0, 500) }));
      if (!res.headersSent) sendJson(res, 500, { ok: false, message: 'internal error' });
      else res.end();
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`INCOME 2 seller gateway listening on ${PORT}; core=${CORE_PORT}; vault=postgres`);
  });

  const stop = () => {
    try { core.kill('SIGTERM'); } catch {}
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
