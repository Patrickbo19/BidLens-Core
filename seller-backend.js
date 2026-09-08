const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const vault = require('./taskbounty-vault.cjs');

const PORT = Number(process.env.PORT || 3000);
const CORE_PORT = Number(process.env.SELLER_INTERNAL_PORT || 3901);
const TASKBOUNTY_API = 'https://www.task-bounty.com/api/v1';
const BOOTSTRAP_NONCE = String(process.env.TASKBOUNTY_BOOTSTRAP_NONCE || '').trim();
const SOLVER_KEY = String(process.env.TASKBOUNTY_SOLVER_KEY || '').trim();

function sendJson(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
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

function secureEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function solverAuthorized(req) {
  return Boolean(SOLVER_KEY && secureEqual(req.headers['x-income2-solver-key'], SOLVER_KEY));
}

async function taskBountyRequest(path, options = {}) {
  const token = await vault.getToken();
  if (!token) return { ok: false, status: 503, data: { message: 'TaskBounty authentication is not ready.' } };
  const headers = { authorization: `Bearer ${token}`, ...(options.headers || {}) };
  return fetchJson(`${TASKBOUNTY_API}${path}`, { ...options, headers }, options.timeoutMs || 30000);
}

function cleanId(value) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9_-]{1,120}$/.test(id) ? id : null;
}

async function handleSolver(req, res, url) {
  if (!url.pathname.startsWith('/taskbounty/solver/')) return false;
  if (!solverAuthorized(req)) {
    sendJson(res, 401, { ok: false, message: 'solver authorization required' });
    return true;
  }

  const relative = url.pathname.slice('/taskbounty/solver'.length);

  if (req.method === 'GET' && relative === '/status') {
    const status = await taskBountyStatus().catch(error => ({ connected: false, authReady: false, error: String(error?.message || error).slice(0, 300) }));
    sendJson(res, 200, { ok: true, taskBounty: status, capabilities: ['list_open_tasks', 'get_task', 'request_readonly_repo_access', 'submit_patch', 'check_submission'] });
    return true;
  }

  if (req.method === 'GET' && relative === '/tasks') {
    const params = new URLSearchParams();
    params.set('state', 'open');
    const requestedLimit = Number(url.searchParams.get('limit') || 10);
    params.set('limit', String(Math.max(1, Math.min(25, Number.isFinite(requestedLimit) ? requestedLimit : 10))));
    for (const key of ['language', 'platform']) {
      const value = String(url.searchParams.get(key) || '').trim();
      if (value) params.set(key, value.slice(0, 80));
    }
    const upstream = await taskBountyRequest(`/tasks?${params.toString()}`);
    sendJson(res, upstream.status, upstream.data);
    return true;
  }

  const taskMatch = relative.match(/^\/tasks\/([^/]+)$/);
  if (req.method === 'GET' && taskMatch) {
    const taskId = cleanId(decodeURIComponent(taskMatch[1]));
    if (!taskId) { sendJson(res, 400, { ok: false, message: 'invalid task id' }); return true; }
    const upstream = await taskBountyRequest(`/tasks/${encodeURIComponent(taskId)}`);
    sendJson(res, upstream.status, upstream.data);
    return true;
  }

  const accessMatch = relative.match(/^\/tasks\/([^/]+)\/access$/);
  if (req.method === 'POST' && accessMatch) {
    const taskId = cleanId(decodeURIComponent(accessMatch[1]));
    if (!taskId) { sendJson(res, 400, { ok: false, message: 'invalid task id' }); return true; }
    let body = {};
    try { body = JSON.parse(await readBody(req, 4000) || '{}'); } catch {}
    const agentId = body.agent_id ? cleanId(body.agent_id) : null;
    if (body.agent_id && !agentId) { sendJson(res, 400, { ok: false, message: 'invalid agent id' }); return true; }
    const upstream = await taskBountyRequest(`/tasks/${encodeURIComponent(taskId)}/access`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(agentId ? { agent_id: agentId } : {}),
    });
    sendJson(res, upstream.status, upstream.data);
    return true;
  }

  if (req.method === 'POST' && relative === '/submissions/patch') {
    let body;
    try { body = JSON.parse(await readBody(req, 2_500_000) || '{}'); }
    catch { sendJson(res, 400, { ok: false, message: 'invalid JSON body' }); return true; }
    const taskId = cleanId(body.task_id);
    const agentId = cleanId(body.agent_id);
    const resultText = String(body.result_text || '').trim().slice(0, 1000);
    const patch = String(body.patch || '');
    const testOutput = body.test_output == null ? undefined : String(body.test_output).slice(0, 65536);
    if (!taskId || !agentId || !resultText || !patch) {
      sendJson(res, 422, { ok: false, message: 'task_id, agent_id, result_text, and patch are required' });
      return true;
    }
    if (patch.length > 2_000_000) {
      sendJson(res, 413, { ok: false, message: 'patch exceeds 2 MB solver bridge limit' });
      return true;
    }
    const payload = { task_id: taskId, agent_id: agentId, result_text: resultText, patch };
    if (testOutput !== undefined) payload.test_output = testOutput;
    const upstream = await taskBountyRequest('/submissions/patch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: 60000,
    });
    console.log(JSON.stringify({ type: 'taskbounty_patch_submission', taskId, upstreamStatus: upstream.status, accepted: upstream.ok, at: new Date().toISOString() }));
    sendJson(res, upstream.status, upstream.data);
    return true;
  }

  const submissionMatch = relative.match(/^\/submissions\/([^/]+)$/);
  if (req.method === 'GET' && submissionMatch) {
    const submissionId = cleanId(decodeURIComponent(submissionMatch[1]));
    if (!submissionId) { sendJson(res, 400, { ok: false, message: 'invalid submission id' }); return true; }
    const upstream = await taskBountyRequest(`/submissions/${encodeURIComponent(submissionId)}`);
    sendJson(res, upstream.status, upstream.data);
    return true;
  }

  sendJson(res, 404, { ok: false, message: 'solver operation not allowed' });
  return true;
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
  console.log(JSON.stringify({ type: 'taskbounty_vault_init', persistent: vaultState.persistent, configured: vaultState.configured, solverBridge: Boolean(SOLVER_KEY) }));

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
      const url = new URL(req.url || '/', 'http://localhost');
      if (await handleSolver(req, res, url)) return;
      if (await handleVault(req, res, url.pathname)) return;
      proxy(req, res);
    } catch (error) {
      console.error(JSON.stringify({ type: 'seller_wrapper_error', error: String(error?.message || error).slice(0, 500) }));
      if (!res.headersSent) sendJson(res, 500, { ok: false, message: 'internal error' });
      else res.end();
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`INCOME 2 seller gateway listening on ${PORT}; core=${CORE_PORT}; vault=postgres; solverBridge=${SOLVER_KEY ? 'enabled' : 'disabled'}`);
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
