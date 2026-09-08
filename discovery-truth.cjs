const express = require('express');

const ORIGIN = String(process.env.PUBLIC_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');
const OUTCOME_EXECUTION_PATH = '/outcome-router/execute/{requestId}';
const CURRENT_OUTCOME_DESCRIPTION = 'Submit a desired result plus maximum budget. HYDRA, the internal autonomous engine, tries zero-dollar proof-of-work fulfillment first, then can route supported paid work through buyer-signed non-custodial x402 pass-through to the Agent402 Smart Order Router. The buyer wallet signs locally; HYDRA never receives a buyer private key and never uses owner working capital. Higher paid tiers are not auto-escalated.';
const PAID_BLOCK = `Buyer-signed paid HYDRA execution\n- Outcome request: POST ${ORIGIN}/outcome-router\n- Paid execution: POST ${ORIGIN}/outcome-router/execute/{requestId}\n- First execution call returns the relayed Agent402 Smart Order Router x402 PAYMENT-REQUIRED challenge.\n- An x402-capable buyer wallet signs locally and retries with PAYMENT-SIGNATURE.\n- HYDRA forwards the proof and returns the routed result.\n- HYDRA never receives the buyer private key or uses owner working capital.\n- Current beta platform fee: $0. Higher paid tiers are not auto-escalated.`;

function correctText(text) {
  let out = String(text || '');
  out = out
    .replace(/Paid external execution remains disabled until a safe buyer-funded\/delegated payment rail exists\./gi, 'Paid external execution is enabled through buyer-signed non-custodial x402 pass-through.')
    .replace(/Paid external execution is not yet enabled because INCOME 2 will not custody buyer keys or spend owner working capital\./gi, 'Paid external execution is enabled through buyer-signed non-custodial x402 pass-through; buyer wallets sign locally and HYDRA never receives private keys or uses owner working capital.')
    .replace(/Paid external execution is blocked until a safe buyer-funded\/delegated payment rail exists\./gi, 'Paid external execution is enabled through buyer-signed non-custodial x402 pass-through.')
    .replace(/autonomously discovers\/executes zero-wallet fulfillment where possible/gi, 'autonomously discovers fulfillment, tries zero-dollar proof-of-work first, and supports buyer-signed x402 paid execution where available');
  if (/Outcome Router|HYDRA/i.test(out) && !out.includes('Buyer-signed paid HYDRA execution')) out += `\n\n${PAID_BLOCK}\n`;
  return out;
}

const previousJson = express.response.json;
express.response.json = function income2DiscoveryTruthJson(body) {
  const path = this.req?.path;
  if (path === '/openapi.json' && body && typeof body === 'object') {
    const paths = { ...(body.paths || {}) };
    if (paths['/outcome-router']?.post) {
      paths['/outcome-router'] = {
        ...paths['/outcome-router'],
        post: { ...paths['/outcome-router'].post, description: CURRENT_OUTCOME_DESCRIPTION },
      };
    }
    body = {
      ...body,
      info: {
        ...(body.info || {}),
        description: correctText(body.info?.description || ''),
      },
      paths,
    };
  }
  if ((path === '/.well-known/x402' || path === '/.well-known/x402.json') && body && typeof body === 'object') {
    body = {
      ...body,
      description: correctText(body.description || 'INCOME 2 agent-facing x402 tools and autonomous outcome fulfillment.'),
    };
    if (Array.isArray(body.resources)) {
      body.resources = body.resources.map(resource => {
        if (resource?.name !== 'INCOME 2 Outcome Router beta') return resource;
        return {
          ...resource,
          paidExecution: {
            enabled: true,
            mode: 'buyer_signed_x402_passthrough',
            executionPath: OUTCOME_EXECUTION_PATH,
            upstream: 'Agent402 Smart Order Router',
            platformFeeUsd: 0,
            privateKeyRequiredByHydra: false,
            ownerWorkingCapitalUsed: false,
          },
        };
      });
    }
  }
  return previousJson.call(this, body);
};

const previousSend = express.response.send;
express.response.send = function income2DiscoveryTruthSend(body) {
  const path = this.req?.path;
  if (typeof body === 'string' && ['/skill.md', '/llms.txt', '/agents.txt'].includes(path)) body = correctText(body);
  return previousSend.call(this, body);
};

async function readJsonSafe(response) {
  const text = await response.text();
  try { return { text, data: JSON.parse(text) }; } catch { return { text, data: null }; }
}

async function x402ScanCheckDiscovery() {
  const input = encodeURIComponent(JSON.stringify({ '0': { json: { origin: ORIGIN, bustCache: true } } }));
  const url = `https://www.x402scan.com/api/trpc/public.resources.checkDiscovery?batch=1&input=${input}`;
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'INCOME2-Discovery/1.0' } });
  const parsed = await readJsonSafe(response);
  return { ok: response.ok, status: response.status, ...parsed };
}

async function x402ScanRegister() {
  const batchUrl = 'https://www.x402scan.com/api/trpc/public.resources.registerFromOrigin?batch=1';
  const batchBody = JSON.stringify({ '0': { json: { origin: ORIGIN } } });
  let response = await fetch(batchUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'INCOME2-Discovery/1.0' },
    body: batchBody,
  });
  let parsed = await readJsonSafe(response);
  if (!response.ok) {
    response = await fetch('https://www.x402scan.com/api/trpc/public.resources.registerFromOrigin', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'INCOME2-Discovery/1.0' },
      body: JSON.stringify({ json: { origin: ORIGIN } }),
    });
    parsed = await readJsonSafe(response);
  }
  return { ok: response.ok, status: response.status, ...parsed };
}

if (String(process.env.X402SCAN_REGISTER_ON_BOOT || '').toLowerCase() === 'true' && /seller-core\.js$/.test(String(process.argv[1] || ''))) {
  setTimeout(async () => {
    try {
      const check = await x402ScanCheckDiscovery();
      console.log(JSON.stringify({ type: 'x402scan_discovery_check', ok: check.ok, status: check.status, response: check.text.slice(0, 4000), at: new Date().toISOString() }));
      const registration = await x402ScanRegister();
      console.log(JSON.stringify({ type: 'x402scan_registration', ok: registration.ok, status: registration.status, response: registration.text.slice(0, 6000), at: new Date().toISOString() }));
    } catch (error) {
      console.error(JSON.stringify({ type: 'x402scan_registration_error', error: String(error?.message || error).slice(0, 500), at: new Date().toISOString() }));
    }
  }, 14000).unref();
}
