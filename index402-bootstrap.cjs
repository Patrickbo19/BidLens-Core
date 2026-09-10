const argv1 = String(process.argv[1] || '');

// Preserve the existing seller-core discovery shim when this file is used as the
// seller service preload. The gateway process gets the 402 Index claim handler;
// the child seller-core process gets the existing discovery/bazaar patches.
if (/seller-core\.js$/.test(argv1)) {
  require('./discovery-truth.cjs');
} else if (/seller-backend\.js$/.test(argv1)) {
  const http = require('http');
  const indexVault = require('./index402-vault.cjs');

  const ORIGIN = String(process.env.PUBLIC_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');
  const DOMAIN = new URL(ORIGIN).hostname;
  const API = 'https://402index.io/api/v1';
  const VERIFY_PATH = '/.well-known/402index-verify.txt';
  const vaultReady = indexVault.init().catch(error => ({ persistent:false, configured:false, error:String(error?.message || error) }));

  async function postJson(path, body, timeoutMs = 12000) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const response = await fetch(`${API}${path}`, {
        method:'POST',
        headers:{ 'content-type':'application/json', accept:'application/json', 'user-agent':'INCOME2-402Index-Verify/1.0' },
        body:JSON.stringify(body),
        signal:ctl.signal,
      });
      const text = await response.text();
      let data = {};
      try { data = JSON.parse(text); } catch {}
      return { ok:response.ok, status:response.status, data };
    } finally {
      clearTimeout(timer);
    }
  }

  async function createOrRotateClaim() {
    const response = await postJson('/claim', { domain:DOMAIN });
    if (![200, 201].includes(response.status)) {
      return { ok:false, status:response.status, reason:response.status === 409 ? 'domain_already_verified' : 'claim_request_failed' };
    }
    const token = String(response.data?.verification_token || '').trim();
    const verificationHash = String(response.data?.verification_hash || '').trim();
    if (!token || !/^[a-f0-9]{64}$/i.test(verificationHash)) return { ok:false, status:response.status, reason:'claim_material_missing' };
    await indexVault.storeClaim({ domain:DOMAIN, token, verificationHash });
    return { ok:true, status:response.status };
  }

  async function bootstrapDomainVerification() {
    const init = await vaultReady;
    if (!init?.persistent || !init?.configured) {
      console.log(JSON.stringify({ type:'index402_domain_verification_skipped', reason:'encrypted_vault_unavailable', at:new Date().toISOString() }));
      return;
    }

    let state = await indexVault.status();
    if (state.verified) {
      console.log(JSON.stringify({ type:'index402_domain_verification_ready', domain:DOMAIN, verified:true, at:new Date().toISOString() }));
      return;
    }

    let claim = await indexVault.getClaim();
    if (!claim) {
      const created = await createOrRotateClaim();
      if (!created.ok) {
        console.log(JSON.stringify({ type:'index402_domain_claim_result', domain:DOMAIN, ok:false, status:created.status, reason:created.reason, tokenExposed:false, at:new Date().toISOString() }));
        return;
      }
      console.log(JSON.stringify({ type:'index402_domain_claim_result', domain:DOMAIN, ok:true, status:created.status, encryptedAtRest:true, tokenExposed:false, at:new Date().toISOString() }));
      claim = await indexVault.getClaim();
    }

    // The verification hash is already available through the gateway route below.
    // Give Render's public edge a moment to observe this running instance before
    // asking 402 Index to fetch it.
    await new Promise(resolve => setTimeout(resolve, 1200));
    let verified = await postJson('/claim/verify', { domain:DOMAIN });

    if (verified.status === 410) {
      const rotated = await createOrRotateClaim();
      if (rotated.ok) {
        await new Promise(resolve => setTimeout(resolve, 1200));
        verified = await postJson('/claim/verify', { domain:DOMAIN });
      }
    }

    if (verified.ok || verified.status === 409) {
      await indexVault.markVerified();
      console.log(JSON.stringify({
        type:'index402_domain_verification_ready',
        domain:DOMAIN,
        verified:true,
        httpStatus:verified.status,
        servicesCount:Number(verified.data?.services_count || 0) || null,
        tokenExposed:false,
        at:new Date().toISOString(),
      }));
      return;
    }

    console.log(JSON.stringify({
      type:'index402_domain_verification_result',
      domain:DOMAIN,
      verified:false,
      httpStatus:verified.status,
      reason:String(verified.data?.error || verified.data?.message || 'verification_failed').slice(0,200),
      tokenExposed:false,
      at:new Date().toISOString(),
    }));
  }

  const originalCreateServer = http.createServer;
  let scheduled = false;
  http.createServer = function income2CreateServer(...args) {
    const listenerIndex = typeof args[0] === 'function' ? 0 : 1;
    const originalListener = args[listenerIndex];
    if (typeof originalListener === 'function') {
      args[listenerIndex] = async function income2GatewayListener(req, res) {
        try {
          const pathname = new URL(req.url || '/', 'http://localhost').pathname;
          if (req.method === 'GET' && pathname === VERIFY_PATH) {
            await vaultReady;
            const state = await indexVault.status();
            const hash = String(state.verificationHash || '').trim();
            if (!/^[a-f0-9]{64}$/i.test(hash)) {
              res.writeHead(404, { 'content-type':'text/plain; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff' });
              res.end('not ready');
              return;
            }
            res.writeHead(200, { 'content-type':'text/plain; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff' });
            res.end(hash);
            return;
          }
        } catch {}
        return originalListener.call(this, req, res);
      };
    }

    const server = originalCreateServer.apply(http, args);
    if (!scheduled) {
      scheduled = true;
      server.once('listening', () => {
        setTimeout(() => bootstrapDomainVerification().catch(error => {
          console.error(JSON.stringify({ type:'index402_domain_verification_error', error:String(error?.message || error).slice(0,300), tokenExposed:false, at:new Date().toISOString() }));
        }), 2500).unref();
      });
    }
    return server;
  };
}
