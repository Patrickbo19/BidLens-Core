const express = require('express');

const PORT = Number(process.env.PORT || 3000);
const NETWORK = 'eip155:8453';
const PAY_TO = String(process.env.EARN_RECEIVE_ADDRESS || '').trim();
const ORIGIN = String(process.env.PUBLIC_ORIGIN || 'https://income2-treasury.onrender.com').replace(/\/$/, '');
const FACILITATOR_URL = String(process.env.X402_FACILITATOR_URL || 'https://facilitator.payai.network').replace(/\/$/, '');
const AGENT402_REGISTER_URL = 'https://agent402.tools/api/index/register';
const USER_AGENT = 'INCOME2-PublicData/2.0 (+https://earn-router.onrender.com)';

const PRICES = {
  treasuryYieldCurve: '$0.005',
  nationalDebt: '$0.005',
  treasuryAverageRates: '$0.005',
  usWeather: '$0.002',
  federalAwards: '$0.01',
  clinicalTrials: '$0.01',
  secCompanyFacts: '$0.01',
  laborMarket: '$0.01',
  macroSnapshot: '$0.025',
};

const cache = new Map();
const sourceReadiness = {};
const routeStats = {};
let settlementCount = 0;
let lastSettlementAt = null;

function assertConfig() {
  if (!/^0x[a-fA-F0-9]{40}$/.test(PAY_TO)) throw new Error('EARN_RECEIVE_ADDRESS must be a valid public EVM address');
}

function round(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

function cacheKey(name, params = {}) {
  return `${name}:${JSON.stringify(params, Object.keys(params).sort())}`;
}

async function cached(name, params, ttlMs, fn) {
  const key = cacheKey(name, params);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return { ...hit.value, cacheHit: true };
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return { ...value, cacheHit: false };
}

async function fetchText(url, options = {}, timeoutMs = 15000, maxBytes = 2_500_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: '*/*',
        'user-agent': USER_AGENT,
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    if (text.length > maxBytes) throw new Error(`upstream response exceeded ${maxBytes} byte limit`);
    if (!response.ok) throw new Error(`upstream returned HTTP ${response.status}: ${text.slice(0, 180)}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}, timeoutMs = 15000, maxBytes = 2_500_000) {
  const text = await fetchText(url, {
    ...options,
    headers: { accept: 'application/json', ...(options.headers || {}) },
  }, timeoutMs, maxBytes);
  try { return JSON.parse(text); } catch { throw new Error('upstream returned invalid JSON'); }
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
      mo1: xmlNumber(entry, 'BC_1MONTH'), mo2: xmlNumber(entry, 'BC_2MONTH'),
      mo3: xmlNumber(entry, 'BC_3MONTH'), mo4: xmlNumber(entry, 'BC_4MONTH'),
      mo6: xmlNumber(entry, 'BC_6MONTH'), yr1: xmlNumber(entry, 'BC_1YEAR'),
      yr2: xmlNumber(entry, 'BC_2YEAR'), yr3: xmlNumber(entry, 'BC_3YEAR'),
      yr5: xmlNumber(entry, 'BC_5YEAR'), yr7: xmlNumber(entry, 'BC_7YEAR'),
      yr10: xmlNumber(entry, 'BC_10YEAR'), yr20: xmlNumber(entry, 'BC_20YEAR'),
      yr30: xmlNumber(entry, 'BC_30YEAR'),
    };
    if (Object.values(yields).every(value => value == null)) continue;
    rows.push({ date, yields });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const latest = rows.at(-1);
  if (!latest) throw new Error('Treasury feed contained no yield-curve rows');
  const { yr2, yr10, mo3 } = latest.yields;
  const twoTenSpreadBps = yr2 != null && yr10 != null ? round((yr10 - yr2) * 100, 2) : null;
  const threeMonthTenYearSpreadBps = mo3 != null && yr10 != null ? round((yr10 - mo3) * 100, 2) : null;
  return {
    recordDate: latest.date,
    unit: 'percent',
    yields: latest.yields,
    spreadsBps: { twoTen: twoTenSpreadBps, threeMonthTenYear: threeMonthTenYearSpreadBps },
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
  return cached('treasury-yield-curve', {}, 15 * 60 * 1000, async () => {
    const now = new Date();
    const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=${month}`;
    const xml = await fetchText(url, { headers: { accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1' } }, 30000);
    return parseTreasuryFeed(xml);
  });
}

async function getNationalDebt(limit = 30) {
  limit = Math.max(2, Math.min(90, Number(limit) || 30));
  return cached('national-debt', { limit }, 30 * 60 * 1000, async () => {
    const url = `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=${limit}`;
    const json = await fetchJson(url);
    const rows = (json.data || []).map(row => ({
      date: row.record_date,
      totalPublicDebt: Number(row.tot_pub_debt_out_amt),
      debtHeldByPublic: Number(row.debt_held_public_amt),
      intragovernmentalHoldings: Number(row.intragov_hold_amt),
    })).filter(row => row.date && Number.isFinite(row.totalPublicDebt));
    if (!rows.length) throw new Error('Debt to the Penny returned no rows');
    const latest = rows[0], prior = rows[1] || null;
    return {
      latest,
      prior,
      dayChange: prior ? round(latest.totalPublicDebt - prior.totalPublicDebt, 2) : null,
      dayChangePercent: prior ? round(((latest.totalPublicDebt / prior.totalPublicDebt) - 1) * 100, 6) : null,
      history: rows,
      currency: 'USD',
      source: 'U.S. Treasury FiscalData — Debt to the Penny',
      sourceUrl: 'https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/',
      checkedAt: new Date().toISOString(),
    };
  });
}

async function getTreasuryAverageRates() {
  return cached('treasury-average-rates', {}, 6 * 60 * 60 * 1000, async () => {
    const url = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=100';
    const json = await fetchJson(url);
    const rows = (json.data || []).filter(row => row.record_date && row.avg_interest_rate_amt != null);
    if (!rows.length) throw new Error('Average Treasury rates returned no rows');
    const latestDate = rows[0].record_date;
    const latestRows = rows.filter(row => row.record_date === latestDate).map(row => ({
      securityType: row.security_type_desc,
      security: row.security_desc,
      averageInterestRatePercent: Number(row.avg_interest_rate_amt),
    })).filter(row => Number.isFinite(row.averageInterestRatePercent));
    return {
      recordDate: latestDate,
      rates: latestRows,
      source: 'U.S. Treasury FiscalData — Average Interest Rates on U.S. Treasury Securities',
      sourceUrl: 'https://fiscaldata.treasury.gov/datasets/average-interest-rates-treasury-securities/',
      checkedAt: new Date().toISOString(),
    };
  });
}

async function getUsWeather(lat, lon) {
  lat = Number(lat); lon = Number(lon);
  if (!Number.isFinite(lat) || lat < 18 || lat > 72 || !Number.isFinite(lon) || lon < -180 || lon > -60) {
    throw Object.assign(new Error('lat/lon must be valid coordinates in the NWS coverage area'), { statusCode: 422 });
  }
  const rounded = { lat: round(lat, 4), lon: round(lon, 4) };
  return cached('us-weather', rounded, 5 * 60 * 1000, async () => {
    const point = await fetchJson(`https://api.weather.gov/points/${rounded.lat},${rounded.lon}`, {}, 12000);
    const forecastUrl = point?.properties?.forecast;
    if (!forecastUrl) throw new Error('NWS point lookup did not return a forecast URL');
    const forecast = await fetchJson(forecastUrl, {}, 12000);
    const periods = (forecast?.properties?.periods || []).slice(0, 10).map(p => ({
      name: p.name,
      startTime: p.startTime,
      endTime: p.endTime,
      isDaytime: p.isDaytime,
      temperature: p.temperature,
      temperatureUnit: p.temperatureUnit,
      windSpeed: p.windSpeed,
      windDirection: p.windDirection,
      shortForecast: p.shortForecast,
      detailedForecast: p.detailedForecast,
      probabilityOfPrecipitation: p.probabilityOfPrecipitation?.value ?? null,
    }));
    return {
      location: {
        lat: rounded.lat,
        lon: rounded.lon,
        city: point?.properties?.relativeLocation?.properties?.city || null,
        state: point?.properties?.relativeLocation?.properties?.state || null,
        forecastOffice: point?.properties?.forecastOffice || null,
      },
      updated: forecast?.properties?.updated || null,
      periods,
      source: 'U.S. National Weather Service API',
      sourceUrl: 'https://api.weather.gov',
      checkedAt: new Date().toISOString(),
    };
  });
}

function isoDateDaysAgo(days) {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().slice(0, 10);
}

async function getFederalAwards({ days = 30, minAmount = 1000000, limit = 20, awardType = 'all' } = {}) {
  days = Math.max(1, Math.min(365, Number(days) || 30));
  minAmount = Math.max(0, Number(minAmount) || 0);
  limit = Math.max(1, Math.min(50, Number(limit) || 20));
  awardType = ['all','contracts','grants'].includes(String(awardType)) ? String(awardType) : 'all';
  return cached('federal-awards', { days, minAmount, limit, awardType }, 15 * 60 * 1000, async () => {
    const contractCodes = ['A','B','C','D'];
    const grantCodes = ['02','03','04','05'];
    const awardTypeCodes = awardType === 'contracts' ? contractCodes : awardType === 'grants' ? grantCodes : [...contractCodes, ...grantCodes];
    const payload = {
      filters: {
        time_period: [{ start_date: isoDateDaysAgo(days), end_date: new Date().toISOString().slice(0, 10) }],
        award_type_codes: awardTypeCodes,
        award_amounts: [{ lower_bound: minAmount }],
      },
      fields: ['Award ID','Recipient Name','Start Date','End Date','Award Amount','Awarding Agency','Awarding Sub Agency','Award Type'],
      page: 1,
      limit,
      sort: 'Award Amount',
      order: 'desc',
      subawards: false,
    };
    const json = await fetchJson('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }, 20000, 3_000_000);
    const results = Array.isArray(json.results) ? json.results : [];
    return {
      filters: { days, minAmount, limit, awardType },
      count: results.length,
      awards: results,
      source: 'USAspending.gov API',
      sourceUrl: 'https://api.usaspending.gov/',
      checkedAt: new Date().toISOString(),
    };
  });
}

async function getClinicalTrials({ sponsor = '', query = '', limit = 20 } = {}) {
  sponsor = String(sponsor || '').trim().slice(0, 160);
  query = String(query || '').trim().slice(0, 240);
  limit = Math.max(1, Math.min(50, Number(limit) || 20));
  if (!sponsor && !query) throw Object.assign(new Error('sponsor or query is required'), { statusCode: 422 });
  return cached('clinical-trials', { sponsor, query, limit }, 15 * 60 * 1000, async () => {
    const url = new URL('https://clinicaltrials.gov/api/v2/studies');
    if (sponsor) url.searchParams.set('query.spons', sponsor);
    if (query) url.searchParams.set('query.term', query);
    url.searchParams.set('pageSize', String(limit));
    url.searchParams.set('format', 'json');
    url.searchParams.set('countTotal', 'true');
    const json = await fetchJson(url.toString(), {}, 15000, 4_000_000);
    const studies = (json.studies || []).slice(0, limit).map(study => {
      const p = study.protocolSection || {};
      const id = p.identificationModule || {};
      const status = p.statusModule || {};
      const sponsorModule = p.sponsorCollaboratorsModule || {};
      const design = p.designModule || {};
      const conditions = p.conditionsModule || {};
      return {
        nctId: id.nctId || null,
        briefTitle: id.briefTitle || null,
        officialTitle: id.officialTitle || null,
        overallStatus: status.overallStatus || null,
        startDate: status.startDateStruct?.date || null,
        completionDate: status.completionDateStruct?.date || null,
        lastUpdateSubmitDate: status.lastUpdateSubmitDate || null,
        phases: design.phases || [],
        enrollment: design.enrollmentInfo?.count ?? null,
        leadSponsor: sponsorModule.leadSponsor?.name || null,
        conditions: conditions.conditions || [],
        url: id.nctId ? `https://clinicaltrials.gov/study/${id.nctId}` : null,
      };
    });
    return {
      filters: { sponsor: sponsor || null, query: query || null, limit },
      totalCount: json.totalCount ?? null,
      count: studies.length,
      studies,
      source: 'ClinicalTrials.gov API',
      sourceUrl: 'https://clinicaltrials.gov/data-api/about-api',
      checkedAt: new Date().toISOString(),
    };
  });
}

let secTickerMap = null;
let secTickerMapAt = 0;
async function getSecTickerMap() {
  if (secTickerMap && Date.now() - secTickerMapAt < 24 * 60 * 60 * 1000) return secTickerMap;
  const json = await fetchJson('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'user-agent': 'INCOME2 Public Data contact bpgrimes1997@gmail.com' },
  }, 15000, 6_000_000);
  const map = new Map();
  for (const row of Object.values(json || {})) {
    if (row?.ticker && row?.cik_str) map.set(String(row.ticker).toUpperCase(), { cik:Number(row.cik_str), title:row.title });
  }
  secTickerMap = map; secTickerMapAt = Date.now();
  return map;
}

function latestSecFact(companyFacts, tag) {
  const fact = companyFacts?.facts?.['us-gaap']?.[tag];
  if (!fact?.units) return null;
  const candidates = [];
  for (const [unit, rows] of Object.entries(fact.units)) {
    for (const row of rows || []) {
      if (row?.val == null || !row?.filed) continue;
      candidates.push({ unit, value:row.val, filed:row.filed, end:row.end || null, form:row.form || null, frame:row.frame || null, accession:row.accn || null });
    }
  }
  candidates.sort((a,b) => String(b.filed).localeCompare(String(a.filed)) || String(b.end || '').localeCompare(String(a.end || '')));
  return candidates[0] || null;
}

async function getSecCompanyFacts(ticker) {
  ticker = String(ticker || '').trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '').slice(0, 12);
  if (!ticker) throw Object.assign(new Error('ticker is required'), { statusCode: 422 });
  return cached('sec-company-facts', { ticker }, 60 * 60 * 1000, async () => {
    const map = await getSecTickerMap();
    const match = map.get(ticker);
    if (!match) throw Object.assign(new Error('ticker not found in SEC company ticker map'), { statusCode: 404 });
    const cik = String(match.cik).padStart(10, '0');
    const json = await fetchJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: { 'user-agent': 'INCOME2 Public Data contact bpgrimes1997@gmail.com' },
    }, 15000, 12_000_000);
    const tags = ['Assets','Liabilities','StockholdersEquity','Revenues','SalesRevenueNet','NetIncomeLoss','EarningsPerShareDiluted','CashAndCashEquivalentsAtCarryingValue'];
    const facts = {};
    for (const tag of tags) {
      const value = latestSecFact(json, tag);
      if (value) facts[tag] = value;
    }
    return {
      ticker,
      cik,
      entityName: json.entityName || match.title || null,
      facts,
      source: 'U.S. Securities and Exchange Commission EDGAR Company Facts API',
      sourceUrl: `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
      checkedAt: new Date().toISOString(),
      note: 'Latest reported XBRL facts by filing date; values are issuer-reported and may span different reporting periods/forms.',
    };
  });
}

const BLS_SERIES = {
  unemploymentRate: 'LNS14000000',
  laborForceParticipationRate: 'LNS11300000',
  totalNonfarmPayrollsThousands: 'CES0000000001',
  averageHourlyEarningsPrivate: 'CES0500000003',
};
async function getBlsSeries(seriesId) {
  const json = await fetchJson(`https://api.bls.gov/publicAPI/v1/timeseries/data/${seriesId}`, {}, 15000, 1_000_000);
  const series = json?.Results?.series?.[0];
  if (!series?.data?.length) throw new Error(`BLS series ${seriesId} returned no data`);
  return series.data.slice(0, 14).map(row => ({ year:row.year, period:row.period, periodName:row.periodName, value:Number(row.value), latest:row.latest === 'true' }));
}

async function getLaborMarket() {
  return cached('labor-market', {}, 6 * 60 * 60 * 1000, async () => {
    const entries = await Promise.all(Object.entries(BLS_SERIES).map(async ([name, id]) => [name, await getBlsSeries(id)]));
    const series = Object.fromEntries(entries);
    const latest = {};
    for (const [name, rows] of Object.entries(series)) latest[name] = rows[0] || null;
    return {
      latest,
      series,
      units: {
        unemploymentRate:'percent',
        laborForceParticipationRate:'percent',
        totalNonfarmPayrollsThousands:'thousands of jobs',
        averageHourlyEarningsPrivate:'USD per hour',
      },
      source: 'U.S. Bureau of Labor Statistics Public Data API',
      sourceUrl: 'https://www.bls.gov/developers/',
      checkedAt: new Date().toISOString(),
    };
  });
}

async function getMacroSnapshot() {
  return cached('macro-snapshot', {}, 10 * 60 * 1000, async () => {
    const [yieldCurve, debt, averageRates, labor] = await Promise.all([
      getTreasuryCurve(), getNationalDebt(5), getTreasuryAverageRates(), getLaborMarket(),
    ]);
    return {
      treasuryYieldCurve: yieldCurve,
      nationalDebt: debt,
      treasuryAverageRates: averageRates,
      laborMarket: labor,
      generatedAt: new Date().toISOString(),
      sources: ['U.S. Treasury', 'U.S. Bureau of Labor Statistics'],
    };
  });
}

const RESOURCES = [
  { key:'treasuryYieldCurve', method:'GET', path:'/treasury-yield-curve', price:PRICES.treasuryYieldCurve, name:'US Treasury Yield Curve + Spreads', category:'market-data', description:'Latest official U.S. Treasury par yield curve plus 2s10s and 3m10y spreads and inversion flags.', tags:['treasury','yield-curve','fixed-income','macro','rates'], example:{recordDate:'2026-09-11',yields:{yr2:3.7,yr10:4.2},spreadsBps:{twoTen:50}} },
  { key:'nationalDebt', method:'GET', path:'/national-debt', price:PRICES.nationalDebt, name:'US National Debt to the Penny', category:'macro-data', description:'Latest U.S. public debt outstanding, public/intragovernmental split, daily change and recent history from Treasury FiscalData.', tags:['national-debt','treasury','fiscal','macro','government-data'], example:{latest:{date:'2026-09-11',totalPublicDebt:39000000000000},dayChange:12000000000} },
  { key:'treasuryAverageRates', method:'GET', path:'/treasury-average-rates', price:PRICES.treasuryAverageRates, name:'Average Rates on Treasury Securities', category:'market-data', description:'Latest monthly average interest rates across U.S. Treasury security types from Treasury FiscalData.', tags:['treasury','interest-rates','bills','notes','bonds','macro'], example:{recordDate:'2026-08-31',rates:[{security:'Treasury Bills',averageInterestRatePercent:4.1}]} },
  { key:'usWeather', method:'GET', path:'/us-weather', price:PRICES.usWeather, name:'US Weather Forecast by Coordinates', category:'weather', description:'Current NWS forecast periods for a U.S. latitude/longitude, with temperature, wind, precipitation probability and detailed forecast.', tags:['weather','forecast','nws','noaa','us-weather'], example:{location:{lat:35.96,lon:-83.92,city:'Knoxville',state:'TN'},periods:[{name:'Tonight',temperature:70,temperatureUnit:'F'}]} },
  { key:'federalAwards', method:'GET', path:'/federal-awards', price:PRICES.federalAwards, name:'Recent Large US Federal Awards', category:'government-data', description:'Recent U.S. federal contracts and grants from USAspending.gov, filtered by lookback and minimum award amount.', tags:['federal-awards','contracts','grants','usaspending','government-spending'], example:{filters:{days:30,minAmount:1000000},awards:[{recipient_name:'Example Recipient'}]} },
  { key:'clinicalTrials', method:'GET', path:'/clinical-trials', price:PRICES.clinicalTrials, name:'Clinical Trials by Sponsor or Query', category:'biotech-data', description:'ClinicalTrials.gov studies for a sponsor or search query with status, phase, enrollment, conditions and dates.', tags:['clinical-trials','biotech','pharma','catalysts','clinicaltrials.gov'], example:{count:1,studies:[{nctId:'NCT00000000',overallStatus:'RECRUITING'}]} },
  { key:'secCompanyFacts', method:'GET', path:'/sec-company-facts', price:PRICES.secCompanyFacts, name:'SEC Company Facts by Ticker', category:'financial-data', description:'Latest issuer-reported SEC EDGAR XBRL facts for a U.S. public-company ticker, including assets, liabilities, revenue, net income and EPS when reported.', tags:['sec','edgar','xbrl','company-facts','fundamentals','stocks'], example:{ticker:'AAPL',entityName:'Apple Inc.',facts:{Assets:{unit:'USD',value:1}}} },
  { key:'laborMarket', method:'GET', path:'/labor-market', price:PRICES.laborMarket, name:'US Labor Market Snapshot', category:'macro-data', description:'Latest U.S. unemployment, labor-force participation, nonfarm payrolls and average hourly earnings with recent history from BLS.', tags:['bls','jobs','unemployment','payrolls','wages','macro'], example:{latest:{unemploymentRate:{value:4.2}}} },
  { key:'macroSnapshot', method:'GET', path:'/macro-snapshot', price:PRICES.macroSnapshot, name:'US Macro Snapshot Bundle', category:'macro-data', description:'One-call bundle of Treasury yield curve, national debt, average Treasury borrowing rates and U.S. labor-market indicators.', tags:['macro','treasury','rates','debt','labor','bundle'], example:{generatedAt:'2026-09-12T20:00:00Z',sources:['U.S. Treasury','U.S. Bureau of Labor Statistics']} },
];

function manifest() {
  return {
    x402Version:2,
    version:2,
    name:'INCOME 2 Public Data',
    description:'Transaction-backed public-data APIs for AI agents: U.S. macro, Treasury, weather, federal awards, clinical trials and SEC company facts. Official public sources, pay per call in USDC on Base, no API key.',
    homepage:'https://earn-router.onrender.com',
    openapi:`${ORIGIN}/openapi.json`,
    ownershipProofs:[PAY_TO],
    rails:[{rail:'evm',network:NETWORK,asset:'USDC',payTo:PAY_TO,facilitator:FACILITATOR_URL}],
    resources:RESOURCES.map(r => ({
      name:r.name, category:r.category, resource:`${r.method} ${r.path}`, url:`${ORIGIN}${r.path}`, price:r.price,
      description:r.description, tags:r.tags, outputExample:r.example,
      accepts:[{scheme:'exact',price:r.price,network:NETWORK,payTo:PAY_TO}],
    })),
  };
}

function openApi() {
  const q = (name, description, schema={type:'string'}) => ({ name, in:'query', required:false, description, schema });
  return {
    openapi:'3.1.0',
    info:{title:'INCOME 2 Public Data',version:'2.0.0',description:'Machine-payable public data from official U.S. government sources over x402.'},
    servers:[{url:ORIGIN}],
    paths:{
      '/treasury-yield-curve':{get:{summary:'Latest Treasury yield curve and spreads',responses:{'200':{description:'Yield curve'},'402':{description:'x402 payment required'}}}},
      '/national-debt':{get:{summary:'US national debt to the penny',parameters:[q('limit','History rows (2-90)',{type:'integer',minimum:2,maximum:90,default:30})],responses:{'200':{description:'Debt snapshot'},'402':{description:'x402 payment required'}}}},
      '/treasury-average-rates':{get:{summary:'Average interest rates on Treasury securities',responses:{'200':{description:'Average rates'},'402':{description:'x402 payment required'}}}},
      '/us-weather':{get:{summary:'NWS forecast by coordinates',parameters:[q('lat','Latitude',{type:'number'}),q('lon','Longitude',{type:'number'})],responses:{'200':{description:'Forecast'},'402':{description:'x402 payment required'},'422':{description:'Invalid coordinates'}}}},
      '/federal-awards':{get:{summary:'Recent large US federal awards',parameters:[q('days','Lookback days',{type:'integer',minimum:1,maximum:365,default:30}),q('min_amount','Minimum award USD',{type:'number',minimum:0,default:1000000}),q('limit','Rows',{type:'integer',minimum:1,maximum:50,default:20}),q('award_type','all, contracts, or grants',{type:'string',enum:['all','contracts','grants'],default:'all'})],responses:{'200':{description:'Award results'},'402':{description:'x402 payment required'}}}},
      '/clinical-trials':{get:{summary:'Clinical trials by sponsor or query',parameters:[q('sponsor','Sponsor/collaborator name'),q('query','General study search'),q('limit','Rows',{type:'integer',minimum:1,maximum:50,default:20})],responses:{'200':{description:'Study results'},'402':{description:'x402 payment required'},'422':{description:'Missing query'}}}},
      '/sec-company-facts':{get:{summary:'SEC EDGAR company facts by ticker',parameters:[q('ticker','US public-company ticker')],responses:{'200':{description:'Company facts'},'402':{description:'x402 payment required'},'404':{description:'Ticker not found'}}}},
      '/labor-market':{get:{summary:'US labor market snapshot from BLS',responses:{'200':{description:'Labor market indicators'},'402':{description:'x402 payment required'}}}},
      '/macro-snapshot':{get:{summary:'US macro snapshot bundle',responses:{'200':{description:'Bundled macro data'},'402':{description:'x402 payment required'}}}},
    },
  };
}

async function registerAgent402(attempt = 1) {
  try {
    const response = await fetch(AGENT402_REGISTER_URL, {
      method:'POST', headers:{'content-type':'application/json',accept:'application/json'}, body:JSON.stringify({origin:ORIGIN}),
    });
    const text = (await response.text()).slice(0, 1600);
    console.log(JSON.stringify({type:'agent402_registration',ok:response.ok,status:response.status,attempt,response:text,at:new Date().toISOString()}));
    let parsed = null; try { parsed = JSON.parse(text); } catch {}
    if ((!response.ok || parsed?.listed === false) && attempt < 4) setTimeout(() => registerAgent402(attempt + 1), attempt * 15000).unref();
  } catch (error) {
    console.error(JSON.stringify({type:'agent402_registration_error',attempt,error:String(error?.message || error).slice(0,400),at:new Date().toISOString()}));
    if (attempt < 4) setTimeout(() => registerAgent402(attempt + 1), attempt * 15000).unref();
  }
}

function bumpRoute(req) {
  const path = req.path;
  const stats = routeStats[path] || { requests:0, paymentHeaders:0, settlements:0, lastRequestAt:null, lastSettlementAt:null };
  stats.requests += 1;
  stats.lastRequestAt = new Date().toISOString();
  if (req.get('payment-signature') || req.get('x-payment')) stats.paymentHeaders += 1;
  routeStats[path] = stats;
}

function routeError(res, error, source) {
  const status = error?.statusCode || 502;
  console.error(JSON.stringify({type:'public_data_route_error',source,status,error:String(error?.message || error).slice(0,400),at:new Date().toISOString()}));
  res.status(status).json({ok:false,message:status === 422 || status === 404 ? String(error.message) : `${source} temporarily unavailable`});
}

async function preflight(name, fn) {
  try {
    const value = await fn();
    sourceReadiness[name] = {ok:true,checkedAt:new Date().toISOString(),sampleDate:value?.recordDate || value?.latest?.date || value?.updated || null};
    console.log(JSON.stringify({type:'public_data_source_ready',source:name,ok:true,sampleDate:sourceReadiness[name].sampleDate,at:new Date().toISOString()}));
  } catch (error) {
    sourceReadiness[name] = {ok:false,checkedAt:new Date().toISOString(),error:String(error?.message || error).slice(0,240)};
    console.error(JSON.stringify({type:'public_data_source_ready',source:name,ok:false,error:sourceReadiness[name].error,at:new Date().toISOString()}));
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
  app.disable('x-powered-by'); app.set('trust proxy', true); app.use(express.json({limit:'64kb'}));
  const paidPaths = new Set(RESOURCES.map(r => r.path));
  app.use((req,_res,next) => { if (paidPaths.has(req.path)) bumpRoute(req); next(); });

  const facilitatorClient = new HTTPFacilitatorClient({url:FACILITATOR_URL});
  const resourceServer = new x402ResourceServer(facilitatorClient).register(NETWORK,new ExactEvmScheme()).registerExtension(bazaarResourceServerExtension);
  resourceServer.onAfterSettle(async ctx => {
    settlementCount += 1; lastSettlementAt = new Date().toISOString();
    const result = ctx?.result || ctx?.settleResponse || {};
    const rawRoute = String(ctx?.resource?.url || ctx?.resource || '');
    const matched = RESOURCES.find(r => rawRoute.includes(r.path));
    const route = matched?.path || rawRoute || null;
    if (route && routeStats[route]) { routeStats[route].settlements += 1; routeStats[route].lastSettlementAt = lastSettlementAt; }
    console.log(JSON.stringify({type:'income2_public_data_settlement',route,grossUsd:matched ? Number(matched.price.replace('$','')) : null,transaction:result.transaction || result.transactionHash || result.txHash || null,settlementCount,at:lastSettlementAt}));
  });

  app.get('/health', (_req,res) => res.json({ok:true,service:'income2-public-data',network:NETWORK,resourceCount:RESOURCES.length,settlementCount,lastSettlementAt,sourceReadiness,routeStats}));
  app.get('/.well-known/x402',(_req,res)=>res.set('cache-control','public,max-age=300').json(manifest()));
  app.get('/.well-known/x402.json',(_req,res)=>res.set('cache-control','public,max-age=300').json(manifest()));
  app.get('/openapi.json',(_req,res)=>res.set('cache-control','public,max-age=300').json(openApi()));
  app.get('/llms.txt',(_req,res)=>res.type('text/plain').send(`INCOME 2 Public Data\n${RESOURCES.map(r=>`${r.method} ${ORIGIN}${r.path} — ${r.price} USDC — ${r.description}`).join('\n')}\nOpenAPI: ${ORIGIN}/openapi.json\n`));

  const payConfig = {};
  for (const r of RESOURCES) {
    payConfig[`${r.method} ${r.path}`] = {
      accepts:[{scheme:'exact',price:r.price,network:NETWORK,payTo:PAY_TO}],
      description:r.description,
      mimeType:'application/json',
      extensions:declareDiscoveryExtension({output:{example:r.example}}),
    };
  }
  app.use(paymentMiddleware(payConfig, resourceServer));

  app.get('/treasury-yield-curve', async (_req,res)=>{ try{res.set('cache-control','no-store').json({ok:true,result:await getTreasuryCurve()})}catch(e){routeError(res,e,'Treasury yield curve')} });
  app.get('/national-debt', async (req,res)=>{ try{res.set('cache-control','no-store').json({ok:true,result:await getNationalDebt(req.query.limit)})}catch(e){routeError(res,e,'Treasury national debt')} });
  app.get('/treasury-average-rates', async (_req,res)=>{ try{res.set('cache-control','no-store').json({ok:true,result:await getTreasuryAverageRates()})}catch(e){routeError(res,e,'Treasury average rates')} });
  app.get('/us-weather', async (req,res)=>{ try{res.set('cache-control','no-store').json({ok:true,result:await getUsWeather(req.query.lat,req.query.lon)})}catch(e){routeError(res,e,'National Weather Service')} });
  app.get('/federal-awards', async (req,res)=>{ try{res.set('cache-control','no-store').json({ok:true,result:await getFederalAwards({days:req.query.days,minAmount:req.query.min_amount,limit:req.query.limit,awardType:req.query.award_type})})}catch(e){routeError(res,e,'USAspending')} });
  app.get('/clinical-trials', async (req,res)=>{ try{res.set('cache-control','no-store').json({ok:true,result:await getClinicalTrials({sponsor:req.query.sponsor,query:req.query.query,limit:req.query.limit})})}catch(e){routeError(res,e,'ClinicalTrials.gov')} });
  app.get('/sec-company-facts', async (req,res)=>{ try{res.set('cache-control','no-store').json({ok:true,result:await getSecCompanyFacts(req.query.ticker)})}catch(e){routeError(res,e,'SEC EDGAR')} });
  app.get('/labor-market', async (_req,res)=>{ try{res.set('cache-control','no-store').json({ok:true,result:await getLaborMarket()})}catch(e){routeError(res,e,'BLS')} });
  app.get('/macro-snapshot', async (_req,res)=>{ try{res.set('cache-control','no-store').json({ok:true,result:await getMacroSnapshot()})}catch(e){routeError(res,e,'US macro sources')} });

  app.listen(PORT,'0.0.0.0',()=>{
    console.log(JSON.stringify({type:'income2_public_data_started',port:PORT,origin:ORIGIN,network:NETWORK,resources:RESOURCES.length,payTo:PAY_TO,at:new Date().toISOString()}));
    setTimeout(()=>preflight('treasury-yield-curve',getTreasuryCurve),1000).unref();
    setTimeout(()=>preflight('national-debt',()=>getNationalDebt(5)),2000).unref();
    setTimeout(()=>preflight('treasury-average-rates',getTreasuryAverageRates),3000).unref();
    setTimeout(()=>preflight('us-weather',()=>getUsWeather(35.9606,-83.9207)),4000).unref();
    setTimeout(()=>preflight('federal-awards',()=>getFederalAwards({days:30,minAmount:1000000,limit:5,awardType:'all'})),5000).unref();
    setTimeout(()=>preflight('clinical-trials',()=>getClinicalTrials({sponsor:'Pfizer',limit:3})),6000).unref();
    setTimeout(()=>preflight('sec-company-facts',()=>getSecCompanyFacts('AAPL')),7000).unref();
    setTimeout(()=>preflight('labor-market',getLaborMarket),8000).unref();
    setTimeout(()=>registerAgent402(1),15000).unref();
  });
})().catch(error=>{console.error(error);process.exit(1)});
