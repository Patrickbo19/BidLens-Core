const DIRECTORY_REGISTER_ON_BOOT = String(process.env.EARN_DIRECTORY_REGISTER_ON_BOOT || '') === '1';
const DIRECTORY_URLS = new Set([
  'https://agent402.tools/api/index/register',
  'https://core.x402arena.gg/register',
  'https://market402.com/submit',
  'https://402index.io/api/v1/register',
]);

const baseFetch = global.fetch;
if (typeof baseFetch === 'function' && !global.__income2DirectoryFetchGuard) {
  global.__income2DirectoryFetchGuard = true;
  global.fetch = async function income2DirectoryFetchGuard(url, options = {}) {
    const target = String(url);
    const method = String(options?.method || 'GET').toUpperCase();
    if (!DIRECTORY_REGISTER_ON_BOOT && method === 'POST' && DIRECTORY_URLS.has(target)) {
      console.log(JSON.stringify({
        type: 'directory_registration_skipped',
        target,
        reason: 'registration_on_boot_disabled',
        at: new Date().toISOString(),
      }));
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'registration_on_boot_disabled' }), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    return baseFetch(url, options);
  };
}

function guardResource(origin) {
  return {
    name: 'Agent Purchase Guard beta',
    method: 'POST',
    url: `${origin}/purchase-guard`,
    price: 'free',
    paymentRequired: false,
    tags: ['x402', 'buyer', 'purchase-safety', 'idempotency', 'retry', 'receipt', 'budget'],
    input: {
      url: 'https://seller.example/paid-tool',
      method: 'POST',
      body: {},
      max_usd: 0.05,
      expected_network: 'eip155:8453',
      idempotency_key: 'stable-caller-key-123',
    },
    output: 'retry-safe purchase intent and receipt; paymentExecuted=false',
  };
}

function outcomeResource(origin) {
  return {
    name: 'INCOME 2 Outcome Router beta',
    method: 'POST',
    url: `${origin}/outcome-router`,
    price: 'free routing beta',
    paymentRequired: false,
    tags: ['outcome', 'buyer-intent', 'procurement', 'routing', 'autonomous', 'budget', 'demand', 'x402'],
    input: {
      task: 'the result you want',
      max_budget_usd: 0.01,
      idempotency_key: 'stable-outcome-request-123',
      params: {},
    },
    output: 'free proof-of-work result when available, otherwise budget-enforced buyer-signed x402 execution route',
    paidExecution: {
      enabled: true,
      mode: 'buyer_signed_x402_passthrough',
      executionPath: '/outcome-router/execute/{requestId}',
      upstream: 'Agent402 Smart Order Router',
      platformFeeUsd: 0,
      buyerSignsLocally: true,
      privateKeyRequiredByHydra: false,
      ownerWorkingCapitalUsed: false,
    },
  };
}

try {
  const express = require('express');
  if (!express.response.__income2StartupHardeningPatched) {
    express.response.__income2StartupHardeningPatched = true;
    const rawJson = express.response.json;
    express.response.json = function income2StartupHardeningJson(body) {
      const path = this.req?.path || '';
      const origin = String(process.env.PUBLIC_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');

      if (path === '/health' && body && typeof body === 'object') {
        body = {
          ...body,
          discovery: {
            ...(body.discovery || {}),
            directoryRegistrationOnBoot: DIRECTORY_REGISTER_ON_BOOT,
          },
        };
      }

      if (path === '/openapi.json' && body && typeof body === 'object' && body.paths) {
        const purchasePost = body.paths?.['/purchase-guard']?.post;
        const purchaseSchema = purchasePost?.requestBody?.content?.['application/json']?.schema;
        if (purchaseSchema?.properties?.method) {
          purchaseSchema.properties.method.enum = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
        }

        const outcomePost = body.paths?.['/outcome-router']?.post;
        if (outcomePost) {
          outcomePost.description = 'Submit a desired result plus maximum budget. HYDRA first attempts compatible zero-dollar proof-of-work fulfillment. When paid execution is required and within budget, HYDRA can return a buyer-signed non-custodial x402 execution route through the Agent402 Smart Order Router. The buyer wallet signs locally; HYDRA never receives private keys, never uses owner working capital, never silently raises the caller budget, and never hands the job to a human broker.';
        }
        body.info = {
          ...(body.info || {}),
          description: `${String(body.info?.description || '').replace(/Paid external execution[^.]*\./gi, '').trim()} INCOME 2 also exposes a free Purchase Guard and a buyer-side Outcome Router with zero-dollar proof-of-work first and buyer-signed x402 paid fulfillment when a supported route is within the caller budget.`.trim(),
        };
      }

      if ((path === '/.well-known/x402' || path === '/.well-known/x402.json') && body && typeof body === 'object') {
        const resources = Array.isArray(body.resources) ? [...body.resources] : [];
        const guardIndex = resources.findIndex(r => r?.name === 'Agent Purchase Guard beta');
        if (guardIndex >= 0) resources[guardIndex] = { ...resources[guardIndex], ...guardResource(origin) };
        else resources.push(guardResource(origin));
        const outcomeIndex = resources.findIndex(r => r?.name === 'INCOME 2 Outcome Router beta');
        if (outcomeIndex >= 0) resources[outcomeIndex] = { ...resources[outcomeIndex], ...outcomeResource(origin) };
        else resources.push(outcomeResource(origin));
        body = {
          ...body,
          description: 'INCOME 2 agent tools plus Purchase Guard and the HYDRA Outcome Router: desired result + max budget -> autonomous proof-of-work or buyer-signed x402 paid fulfillment.',
          resources,
        };
      }

      return rawJson.call(this, body);
    };

    const rawSend = express.response.send;
    express.response.send = function income2StartupHardeningSend(body) {
      const path = this.req?.path || '';
      const origin = String(process.env.PUBLIC_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');
      if (path === '/robots.txt' && typeof body === 'string') {
        body = body.split(/\r?\n/).filter(line => !/^Sitemap:/i.test(line)).join('\n');
      }
      if (typeof body === 'string' && ['/skill.md', '/llms.txt', '/agents.txt'].includes(path)) {
        body = body
          .replace(/Paid external execution is blocked[^\n.]*(?:\.|$)/gi, 'Paid external execution is enabled through buyer-signed non-custodial x402 pass-through.')
          .replace(/Paid external execution remains disabled[^\n.]*(?:\.|$)/gi, 'Paid external execution is enabled through buyer-signed non-custodial x402 pass-through.')
          .replace(/Paid external execution is not yet enabled[^\n.]*(?:\.|$)/gi, 'Paid external execution is enabled through buyer-signed non-custodial x402 pass-through.');
        if (!body.includes('Buyer-signed paid HYDRA execution')) {
          body += `\n\nBuyer-signed paid HYDRA execution\n- Start: POST ${origin}/outcome-router with task + max_budget_usd + idempotency_key.\n- HYDRA tries compatible zero-dollar proof-of-work fulfillment first.\n- When status=payment_signature_required, call POST ${origin}/outcome-router/execute/{requestId} using the exact returned request body.\n- The first execution call relays the Agent402 Smart Order Router x402 PAYMENT-REQUIRED challenge.\n- An x402-capable buyer wallet signs locally and retries with PAYMENT-SIGNATURE.\n- HYDRA forwards the proof and returns the result.\n- HYDRA never receives the buyer private key or uses owner working capital.\n- Current beta platform fee: $0. Higher paid tiers are not auto-escalated.\n`;
        }
        if (!body.includes('Agent Purchase Guard')) {
          body += `\nAgent Purchase Guard\n- POST ${origin}/purchase-guard\n- Free retry-safe x402 preflight with max spend, idempotency, and a durable receipt.\n- It never signs, sends, settles, or custodies funds.\n`;
        }
      }
      return rawSend.call(this, body);
    };
  }
} catch (error) {
  console.error(JSON.stringify({ type: 'seller_startup_hardening_patch_error', error: String(error?.message || error).slice(0, 300) }));
}
