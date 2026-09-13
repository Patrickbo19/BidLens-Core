'use strict';

const PUBLIC_DATA_ORIGIN = String(process.env.INCOME2_PUBLIC_DATA_ORIGIN || 'https://income2-treasury.onrender.com').replace(/\/$/, '');
const MAIN_SELLER_ORIGIN = String(process.env.EARN_SELLER_ORIGIN || 'https://earn-tools-backend.onrender.com').replace(/\/$/, '');
const REFRESH_MS = 60 * 60 * 1000;

const QUERIES = [
  { family:'macro', q:'US macro backdrop market brief' },
  { family:'macro', q:'treasury rates debt labor market' },
  { family:'macro', q:'daily economic briefing official sources' },
  { family:'macro', q:'fixed income macro context treasury yield curve jobs' },
  { family:'extraction', q:'extract clean markdown from webpage url' },
  { family:'extraction', q:'webpage research markdown rag' },
];

function own(row) {
  const url = String(row?.url || '');
  const seller = String(row?.seller || row?.origin || '');
  if (url.startsWith(PUBLIC_DATA_ORIGIN) || seller === PUBLIC_DATA_ORIGIN) return 'public_data';
  if (url.startsWith(MAIN_SELLER_ORIGIN) || seller === MAIN_SELLER_ORIGIN) return 'main_seller';
  return null;
}

async function getJson(url, timeoutMs = 12000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers:{ accept:'application/json', 'user-agent':'INCOME2-Demand-Probe/1.0' }, signal:ctl.signal });
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = { raw:text.slice(0,500) }; }
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${String(data?.message || data?.raw || '').slice(0,200)}`);
    return data;
  } finally { clearTimeout(timer); }
}

async function probe() {
  const checkedAt = new Date().toISOString();
  const observations = [];
  for (const item of QUERIES) {
    try {
      const data = await getJson(`https://agent402.tools/api/route?q=${encodeURIComponent(item.q)}&include=external`);
      const rows = Array.isArray(data?.results) ? data.results : [];
      const matches = [];
      rows.forEach((row,index) => {
        const surface = own(row);
        if (!surface) return;
        matches.push({
          surface,
          rank:index + 1,
          name:String(row?.name || row?.displayName || '').slice(0,180) || null,
          url:String(row?.url || '').slice(0,300) || null,
          priceUsd:Number.isFinite(Number(row?.priceUsd ?? row?.price_usd ?? row?.price)) ? Number(row?.priceUsd ?? row?.price_usd ?? row?.price) : null,
          dispatchEligible:typeof row?.routerDispatchEligible === 'boolean' ? row.routerDispatchEligible : null,
          dispatchReason:String(row?.routerDispatchReason || '').slice(0,120) || null,
        });
      });
      observations.push({ family:item.family, query:item.q, ok:true, returnedResults:rows.length, matches });
    } catch (error) {
      observations.push({ family:item.family, query:item.q, ok:false, error:String(error?.message || error).slice(0,300), matches:[] });
    }
  }
  console.log(JSON.stringify({
    type:'income2_agent402_demand_probe',
    checkedAt,
    publicDataOrigin:PUBLIC_DATA_ORIGIN,
    mainSellerOrigin:MAIN_SELLER_ORIGIN,
    observations,
    revenueClaimed:false,
  }));
}

setTimeout(() => probe().catch(() => {}), 12000).unref();
setInterval(() => probe().catch(() => {}), REFRESH_MS).unref();
console.log(JSON.stringify({ type:'income2_agent402_demand_probe_ready', refreshMs:REFRESH_MS, queries:QUERIES.length, at:new Date().toISOString() }));
