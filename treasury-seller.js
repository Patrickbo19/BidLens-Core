const express = require('express');

const PORT = Number(process.env.PORT || 3000);
const NETWORK = 'eip155:8453';
const PAY_TO = String(process.env.EARN_RECEIVE_ADDRESS || '').trim();
const ORIGIN = String(process.env.PUBLIC_ORIGIN || 'https://income2-treasury.onrender.com').replace(/\/$/, '');
const FACILITATOR_URL = String(process.env.X402_FACILITATOR_URL || 'https://facilitator.payai.network').replace(/\/$/, '');
const PRICE = '$0.005';
const TREASURY_URL = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${new Date().getUTCFullYear()}`;
const AGENT402_REGISTER_URL = 'https://agent402.tools/api/index/register';
const CACHE_MS = 15 * 60 * 1000;

let cache = null;
let settlementCount = 0;
let lastSettlementAt = null;

function assertConfig() {
  if (!/^0x[a-fA-F0-9]{40}$/.test(PAY_TO)) throw new Error('EARN_RECEIVE_ADDRESS must be a valid public EVM address');
}

function xmlValue(block, tag) {
  const match = String(block || '').match(new RegExp(`<d:${tag}\\b[^>]*>([^<]*)<\\/d:${tag}>`, 'i'));
  if (!match) return null;
  const value = match[1].trim();
  return value === '' ? null : value;
}

function xmlNumber(block, tag) {
  const value = xmlValue(block, tag);
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseTreasuryFeed(xml) {
  const entries = String(xml || '').match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  const rows = [];
  for (const entry of entries) {
    const dateRaw = xmlValue(entry, 'NEW_DATE');
    if (!dateRaw) continue;
    const date = String(dateRaw).slice(0, 10);
    const yields = {
      mo1: xmlNumber(entry, 'BC_1MONTH'),
      mo2: xmlNumber(entry, 'BC_2MONTH'),
      mo3: xmlNumber(entry, 'BC_3MONTH'),
      mo4: xmlNumber(entry, 'BC_4MONTH'),
      mo6: xmlNumber(entry, 'BC_6MONTH'),
      yr1: xmlNumber(entry, 'BC_1YEAR'),
      yr2: xmlNumber(entry, 'BC_2YEAR'),
      yr3: xmlNumber(entry, 'BC_3YEAR'),
      yr5: xmlNumber(entry, 'BC_5YEAR'),
      yr7: xmlNumber(entry, 'BC_7YEAR'),
      yr10: xmlNumber(entry, 'BC_10YEAR'),
      yr20: xmlNumber(entry, 'BC_20YEAR'),
      yr30: xmlNumber(entry, 'BC_30YEAR'),
    };
    if (Object.values(yields).every(value => value == null)) continue;
    rows.push({ date, yields });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const latest = rows.at(-1);
  if (!latest) throw new Error('Treasury feed contained no yield-curve rows');
  const { yr2, yr10, mo3 } = latest.yields;
  const twoTenSpreadBps = yr2 != null && yr10 != null ? Math.round((yr10 - yr2) * 10000) / 100 : null;
  const threeMonthTenYearSpreadBps = mo3 != null && yr10 != null ? Math.round((yr10 - mo3) * 10000) / 100 : null;
  return {
    recordDate: latest.date,
    unit: 'percent',
    yields: latest.yields,
    spreadsBps: {
      twoTen: twoTenSpreadBps,
      threeMonthTenYear: threeMonthTenYearSpreadBps,
    },
    inversion: {
      twoTen: twoTenSpreadBps == null ? null : twoTenSpreadBps < 0,
      threeMonthTenYear: threeMonthTenYearSpreadBps == null ? null : threeMonthTenYearSpreadBps < 0,
    },
    source: 'U.S. Department of the Treasury — Daily Treasury Par Yield Curve Rates',
    sourceUrl: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve',
    checkedAt: new Date().toISOString(),
  };
}

async function getTreasuryCurve() {
  if (cache && Date.now() - cache.cachedAt < CACHE_MS) return { ...cache.value, cacheHit: true };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(TREASURY_URL, {
      signal: controller.signal,
      headers: {
        accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
        'user-agent': 'INCOME2-Treasury/1.0 (+https://earn-router.onrender.com)',
      },
    });
    if (!response.ok) throw new Error(`Treasury upstream returned HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error('Treasury upstream response exceeded safety limit');
    const value = parseTreasuryFeed(text);
    cache = { cachedAt: Date.now(), value };
    return { ...value, cacheHit: false };
  } finally {
    clearTimeout(timer);
  }
}

function manifest() {
  return {
    x402Version: 2,
    version: 1,
    name: 'INCOME 2 Treasury Data',
    description: 'Official U.S. Treasury yield-curve data for AI agents. Pay per call in USDC on Base; no API key.',
    homepage: 'https://earn-router.onrender.com',
    openapi: `${ORIGIN}/openapi.json`,
    ownershipProofs: [PAY_TO],
    resources: [{
      name: 'US Treasury Yield Curve + Spreads',
      category: 'market-data',
      resource: 'GET /treasury-yield-curve',
      url: `${ORIGIN}/treasury-yield-curve`,
      price: PRICE,
      description: 'Latest official U.S. Treasury par yield curve, plus 2s10s and 3m10y spreads and inversion flags. Government source, cached briefly for reliability.',
      tags: ['treasury','yield-curve','interest-rates','fixed-income','macro','market-data','government-data'],
      outputExample: {
        recordDate: '2026-09-11',
        unit: 'percent',
        yields: { mo1: 4.1, mo3: 4.0, mo6: 3.9, yr1: 3.8, yr2: 3.7, yr5: 3.9, yr10: 4.2, yr30: 4.8 },
        spreadsBps: { twoTen: 50, threeMonthTenYear: 20 },
        inversion: { twoTen: false, threeMonthTenYear: false },
      },
      accepts: [{ scheme:'exact', price:PRICE, network:NETWORK, payTo:PAY_TO }],
    }],
  };
}

function openApi() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'INCOME 2 Treasury Data',
      version: '1.0.0',
      description: 'Machine-payable official U.S. Treasury yield-curve data over x402.',
    },
    servers: [{ url: ORIGIN }],
    paths: {
      '/treasury-yield-curve': {
        get: {
          summary: 'Latest U.S. Treasury yield curve and key spreads',
          description: 'Returns the latest published Daily Treasury Par Yield Curve Rates and derived 2s10s / 3m10y spreads. x402 payment required.',
          responses: {
            '200': { description: 'Latest curve and derived spreads' },
            '402': { description: 'x402 payment required' },
            '502': { description: 'Treasury upstream unavailable' },
          },
        },
      },
    },
  };
}

async function registerAgent402(attempt = 1) {
  try {
    const response = await fetch(AGENT402_REGISTER_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ origin: ORIGIN }),
    });
    const text = (await response.text()).slice(0, 1200);
    console.log(JSON.stringify({ type:'agent402_registration', ok:response.ok, status:response.status, attempt, response:text, at:new Date().toISOString() }));
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}
    if ((!response.ok || parsed?.listed === false) && attempt < 4) {
      setTimeout(() => registerAgent402(attempt + 1), attempt * 15000).unref();
    }
  } catch (error) {
    console.error(JSON.stringify({ type:'agent402_registration_error', attempt, error:String(error?.message || error).slice(0,400), at:new Date().toISOString() }));
    if (attempt < 4) setTimeout(() => registerAgent402(attempt + 1), attempt * 15000).unref();
  }
}

(async () => {
  assertConfig();
  const expressModule = await import('@x402/express');
  const evmModule = await import('@x402/evm/exact/server');
  const coreModule = await import('@x402/core/server');
  const bazaarModule = await import('@x402/extensions/bazaar');
  const { paymentMiddleware, x402ResourceServer } = expressModule;
  const { ExactEvmScheme } = evmModule;
  const { HTTPFacilitatorClient } = coreModule;
  const { declareDiscoveryExtension, bazaarResourceServerExtension } = bazaarModule;

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(express.json({ limit:'32kb' }));

  const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(NETWORK, new ExactEvmScheme())
    .registerExtension(bazaarResourceServerExtension);

  resourceServer.onAfterSettle(async ctx => {
    settlementCount += 1;
    lastSettlementAt = new Date().toISOString();
    const result = ctx?.result || ctx?.settleResponse || {};
    console.log(JSON.stringify({
      type:'income2_treasury_settlement',
      grossUsd:0.005,
      transaction:result.transaction || result.transactionHash || result.txHash || null,
      settlementCount,
      at:lastSettlementAt,
    }));
  });

  const discovery = declareDiscoveryExtension({
    output: {
      example: {
        recordDate:'2026-09-11', unit:'percent',
        yields:{mo1:4.1,mo3:4.0,mo6:3.9,yr1:3.8,yr2:3.7,yr5:3.9,yr10:4.2,yr30:4.8},
        spreadsBps:{twoTen:50,threeMonthTenYear:20},
        inversion:{twoTen:false,threeMonthTenYear:false},
      },
    },
  });

  app.get('/health', (_req, res) => res.json({
    ok:true,
    service:'income2-treasury',
    network:NETWORK,
    price:PRICE,
    source:'U.S. Department of the Treasury',
    settlementCount,
    lastSettlementAt,
    cachedRecordDate:cache?.value?.recordDate || null,
  }));
  app.get('/.well-known/x402', (_req, res) => res.set('cache-control','public,max-age=300').json(manifest()));
  app.get('/.well-known/x402.json', (_req, res) => res.set('cache-control','public,max-age=300').json(manifest()));
  app.get('/openapi.json', (_req, res) => res.set('cache-control','public,max-age=300').json(openApi()));
  app.get('/llms.txt', (_req, res) => res.type('text/plain').send(`INCOME 2 Treasury Data\nGET ${ORIGIN}/treasury-yield-curve — ${PRICE} USDC on Base — latest official U.S. Treasury par yield curve plus 2s10s and 3m10y spreads.\nOpenAPI: ${ORIGIN}/openapi.json\n`));

  app.use(paymentMiddleware({
    'GET /treasury-yield-curve': {
      accepts: [{ scheme:'exact', price:PRICE, network:NETWORK, payTo:PAY_TO }],
      description:'Latest official U.S. Treasury par yield curve plus 2s10s and 3m10y spreads and inversion flags.',
      mimeType:'application/json',
      extensions:discovery,
    },
  }, resourceServer));

  app.get('/treasury-yield-curve', async (_req, res) => {
    try {
      const result = await getTreasuryCurve();
      res.set('cache-control','no-store').json({ ok:true, result });
    } catch (error) {
      console.error(JSON.stringify({ type:'treasury_upstream_error', error:String(error?.message || error).slice(0,400), at:new Date().toISOString() }));
      res.status(502).json({ ok:false, message:'Treasury source temporarily unavailable' });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(JSON.stringify({ type:'income2_treasury_started', port:PORT, origin:ORIGIN, network:NETWORK, price:PRICE, payTo:PAY_TO, at:new Date().toISOString() }));
    setTimeout(() => getTreasuryCurve().then(result => {
      console.log(JSON.stringify({ type:'treasury_source_ready', ok:true, recordDate:result.recordDate, at:new Date().toISOString() }));
    }).catch(error => {
      console.error(JSON.stringify({ type:'treasury_source_ready', ok:false, error:String(error?.message || error).slice(0,400), at:new Date().toISOString() }));
    }), 1000).unref();
    setTimeout(() => registerAgent402(1), 12000).unref();
  });
})().catch(error => {
  console.error(error);
  process.exit(1);
});
