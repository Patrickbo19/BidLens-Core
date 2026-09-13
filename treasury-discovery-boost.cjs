const express = require('express');

const ORIGIN = String(process.env.PUBLIC_ORIGIN || 'https://income2-treasury.onrender.com').replace(/\/$/, '');
const MACRO_PATH = '/macro-snapshot';
const MACRO_NAME = 'US Macro Backdrop Brief — Treasury Rates, Debt & Labor';
const MACRO_DESCRIPTION = 'Source-backed one-call US macro brief for autonomous market-research, economic-briefing and pre-trade research workflows. Returns the current U.S. Treasury yield curve and spreads, national debt with recent change, average Treasury borrowing rates, and U.S. unemployment, labor-force participation, payrolls and wages. Each section carries official-source dates/provenance so an agent can check freshness before using the result.';
const MACRO_TAGS = ['macro','market-research','economic-brief','daily-brief','pre-trade-research','treasury','yield-curve','rates','national-debt','labor-market','jobs','payrolls','wages','source-backed','provenance'];
const MACRO_INTENTS = [
  'get a US macro backdrop for a market brief',
  'check treasury rates debt and labor market in one call',
  'prepare a daily economic briefing from official sources',
  'get source-backed macro context before market research',
  'check yield curve debt unemployment payrolls and wages',
];

function resourcePath(resource) {
  try { if (resource?.url) return new URL(resource.url).pathname; } catch {}
  const declared = String(resource?.resource || '');
  return declared.match(/\s(\/[^\s]*)$/)?.[1] || '';
}

function tuneMacroResource(resource) {
  if (!resource || typeof resource !== 'object' || resourcePath(resource) !== MACRO_PATH) return resource;
  return {
    ...resource,
    name: MACRO_NAME,
    category: 'market-research',
    description: MACRO_DESCRIPTION,
    tags: MACRO_TAGS,
    intents: MACRO_INTENTS,
    buyerUseCases: ['daily market brief','economic research','rates backdrop','fixed-income context','pre-trade research'],
  };
}

const previousJson = express.response.json;
express.response.json = function income2TreasuryDiscoveryJson(body) {
  const path = this.req?.path;

  if ((path === '/.well-known/x402' || path === '/.well-known/x402.json') && body && typeof body === 'object') {
    let resources = Array.isArray(body.resources) ? body.resources.map(tuneMacroResource) : body.resources;
    if (Array.isArray(resources)) {
      resources = [...resources].sort((a, b) => Number(resourcePath(b) === MACRO_PATH) - Number(resourcePath(a) === MACRO_PATH));
    }
    body = {
      ...body,
      name: 'INCOME 2 Source-Backed Agent Data',
      description: 'Pay-per-result official-source data for autonomous agents. Primary offer: a one-call US macro backdrop for market and economic research, plus Treasury, labor, SEC, federal-award, clinical-trial and weather data. USDC on Base; no API key.',
      intents: Array.from(new Set([...(Array.isArray(body.intents) ? body.intents : []), ...MACRO_INTENTS])),
      featuredResource: `${ORIGIN}${MACRO_PATH}`,
      resources,
    };
  }

  if (path === '/openapi.json' && body && typeof body === 'object') {
    const paths = { ...(body.paths || {}) };
    if (paths[MACRO_PATH]?.get) {
      paths[MACRO_PATH] = {
        ...paths[MACRO_PATH],
        get: {
          ...paths[MACRO_PATH].get,
          summary: MACRO_NAME,
          description: MACRO_DESCRIPTION,
          tags: ['market research','macro data','official sources'],
          'x-intents': MACRO_INTENTS,
          'x-price-usd': 0.025,
        },
      };
    }
    body = {
      ...body,
      info: {
        ...(body.info || {}),
        description: 'Machine-payable, source-backed public data for autonomous agents. Start with the US Macro Backdrop Brief when you need Treasury rates, debt and labor context in one result.',
      },
      paths,
    };
  }

  return previousJson.call(this, body);
};

const previousSend = express.response.send;
express.response.send = function income2TreasuryDiscoverySend(body) {
  const path = this.req?.path;
  if (path === '/llms.txt' && typeof body === 'string' && !body.includes('PRIMARY BUYER OFFER')) {
    body = `INCOME 2 Source-Backed Agent Data\n\nPRIMARY BUYER OFFER\n${MACRO_NAME}\nGET ${ORIGIN}${MACRO_PATH}\n$0.025 USDC on Base\n${MACRO_DESCRIPTION}\nBuyer intents: ${MACRO_INTENTS.join(' | ')}\n\nOTHER LIVE DATA ROUTES\n${body.replace(/^INCOME 2 Public Data\n?/i, '')}`;
  }
  return previousSend.call(this, body);
};

console.log(JSON.stringify({
  type: 'income2_treasury_discovery_boost_ready',
  featured: MACRO_PATH,
  priceUsd: 0.025,
  paymentLogicChanged: false,
  at: new Date().toISOString(),
}));
