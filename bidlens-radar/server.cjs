const http = require('http');
const { URL } = require('url');

const PORT = process.env.PORT || 10000;
const CHECKOUT_URL = String(process.env.BIDLENS_CHECKOUT_URL || '').trim();
const DEFAULT_KEYWORDS = ['construction','repair','maintenance','renovation','roof','roofing','paint','painting','electrical','concrete','landscaping','hvac','demolition','remodel','building','facility'];
const LIVE_OFFERS = {
  handymanKit: 'https://buy.stripe.com/5kQfZb8WA2zKfEs4jT0kE00',
  ideaStressTest: 'https://buy.stripe.com/4gMaERb4I3DO8c017H0kE01'
};
const HANDYMAN_KIT_PATH = '/_delivery/hqsk-v1-f4a7';
const SOURCES = [
  {
    name:'Tennessee GO-BID Grant Postings',
    url:'https://www.tn.gov/generalservices/procurement/central-procurement-office--cpo-/go-bid/current-procurement-opportunities/grants.html',
    kind:'tn-grants'
  },
  {
    name:'Tennessee STREAM RFPs',
    url:'https://www.tn.gov/generalservices/stream/stream/contractors/requests-for-proposal--rfps-.html',
    kind:'stream'
  },
  {
    name:'Tennessee CPO RFP Opportunities',
    url:'https://www.tn.gov/generalservices/procurement/central-procurement-office--cpo-/supplier-information/request-for-proposals--rfp--opportunities1.html',
    kind:'cpo'
  },
  {
    name:'Tennessee CPO Invitations to Bid',
    url:'https://www.tn.gov/generalservices/procurement/central-procurement-office--cpo-/supplier-information/invitations-to-bid--itb-.html.html',
    kind:'cpo-itb'
  },
  {
    name:'City of Knoxville Bid / Contracting Opportunities',
    url:'https://www.knoxvilletn.gov/cms/One.aspx?pageId=177206&portalId=109562',
    kind:'knoxville'
  },
  {
    name:'City of Oak Ridge Bid Postings',
    url:'https://www.oakridgetn.gov/Bids.aspx',
    kind:'oak-ridge'
  },
  {
    name:'Blount County Bid Postings',
    url:'https://www.blounttn.gov/Bids.aspx',
    kind:'blount-county'
  },
  {
    name:'Loudon County Purchasing Solicitations',
    url:'https://loudoncounty-tn.gov/purchasing/',
    kind:'loudon-county'
  },
  {
    name:'City of Sevierville Bid Postings',
    url:'https://www.seviervilletn.org/Bids.aspx',
    kind:'sevierville'
  }
];

const CATEGORY_PAGES = {
  'construction-bids-tennessee': ['construction','repair','renovation','building','facility','demolition'],
  'roofing-bids-tennessee': ['roof','roofing','shingle','metal roof'],
  'painting-bids-tennessee': ['paint','painting','coating','stain'],
  'electrical-bids-tennessee': ['electrical','electric','lighting','wiring'],
  'concrete-bids-tennessee': ['concrete','masonry','sidewalk','paving'],
  'landscaping-bids-tennessee': ['landscaping','grounds','mowing','vegetation','tree']
};
const LOCAL_PAGES = {
  'knoxville-contractor-bids':'Knoxville',
  'oak-ridge-contractor-bids':'Oak Ridge',
  'blount-county-contractor-bids':'Blount County',
  'loudon-county-contractor-bids':'Loudon County',
  'sevierville-contractor-bids':'Sevierville'
};

function escapeHtml(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function stripTags(s='') { return String(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim(); }
function abs(base, href='') { try { return new URL(href, base).toString(); } catch { return base; } }
function getLinks(html, base) {
  const out=[]; const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while ((m=re.exec(html)) && out.length < 250) {
    const text=stripTags(m[2]); if (!text || text.length < 3) continue;
    out.push({text,url:abs(base,m[1])});
  }
  return out;
}
async function fetchText(url) {
  const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),10000);
  try {
    const r=await fetch(url,{headers:{'user-agent':'BidLens-Radar/0.1 (+public procurement monitor)','accept':'text/html,application/xhtml+xml'}});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(timer); }
}
function requirementFlags(text) {
  const t=String(text).toLowerCase();
  const flags=[];
  if (/mandatory.{0,30}(pre[- ]?bid|site visit|conference)|required.{0,30}(pre[- ]?bid|site visit)/i.test(text)) flags.push('mandatory pre-bid/site visit');
  if (/bid bond|performance bond|payment bond|bonding/i.test(text)) flags.push('bonding');
  if (/contractor.?s? license|licensed contractor|license number/i.test(text)) flags.push('contractor license');
  if (/certificate of insurance|proof of insurance|insurance requirement/i.test(text)) flags.push('insurance');
  if (/prevailing wage|davis[- ]bacon/i.test(text)) flags.push('prevailing wage');
  if (/set[- ]aside|small business|dbe|mbe|wbe|sdvosb|hubzone/i.test(text)) flags.push('certification/set-aside');
  if (/sealed bid|sealed proposal|submit.{0,20}copies|hard cop/i.test(text)) flags.push('physical/sealed submission');
  if (/addendum|amendment/i.test(text)) flags.push('addenda posted');
  return [...new Set(flags)].slice(0,8);
}
function regionMatches(text, region) {
  const hay=String(text).toLowerCase();
  const r=String(region||'').trim().toLowerCase();
  if (!r) return false;
  if (r==='east tennessee') return /knox|knoxville|oak ridge|anderson|blount|loudon|sevier|sevierville|roane|campbell|maryville|lenoir city/i.test(text);
  if (hay.includes(r)) return true;
  const terms=r.split(/[^a-z0-9]+/).filter(x=>x.length>=5 && x!=='county' && x!=='tennessee');
  return terms.length>0 && terms.some(x=>hay.includes(x));
}
function scoreOpportunity(text, profile) {
  const hay=String(text).toLowerCase();
  const kws=profile.keywords.length ? profile.keywords : DEFAULT_KEYWORDS;
  const hits=kws.filter(k=>hay.includes(k.toLowerCase()));
  let score=Math.min(65, hits.length*11);
  if (regionMatches(text,profile.region)) score+=20;
  if (/construction|repair|renovation|maintenance|roof|paint|electrical|concrete|landscap|hvac|demolition|building/i.test(text)) score+=10;
  if (/deadline|response due|bid date|proposal due|solicitation|advertisement for bids|request for quote|rfq|itb|rfp/i.test(text)) score+=5;
  return {score:Math.min(100,score),hits};
}
function parseRows(html, source, profile) {
  const rows=[];
  const trRe=/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi; let m;
  while ((m=trRe.exec(html)) && rows.length < 120) {
    const rowHtml=m[1];
    const cells=[...rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>stripTags(x[1])).filter(Boolean);
    if (cells.length < 2) continue;
    const text=cells.join(' | ');
    const {score,hits}=scoreOpportunity(text,profile);
    if (score < profile.minScore) continue;
    const rowLinks=getLinks(rowHtml,source.url);
    rows.push({source:source.name,title:cells.slice(0,4).join(' — ').slice(0,320),details:text.slice(0,800),score,hits,flags:requirementFlags(text),url:rowLinks[0]?.url || source.url});
  }
  if (rows.length) return rows;
  const links=getLinks(html,source.url);
  for (const link of links) {
    const {score,hits}=scoreOpportunity(link.text,profile);
    if (score < profile.minScore) continue;
    if (!/bid|rfp|rfq|itb|proposal|construction|repair|maintenance|grant|solicitation|project/i.test(link.text)) continue;
    rows.push({source:source.name,title:link.text.slice(0,320),details:link.text,score,hits,flags:requirementFlags(link.text),url:link.url});
  }
  return rows.slice(0,80);
}
const scanCache=new Map();
async function scan(profile) {
  const all=[]; const errors=[];
  await Promise.all(SOURCES.map(async source=>{
    try { const html=await fetchText(source.url); all.push(...parseRows(html,source,profile)); }
    catch(e){ errors.push({source:source.name,error:String(e.message||e)}); }
  }));
  const dedup=[]; const seen=new Set();
  for (const x of all.sort((a,b)=>b.score-a.score)) {
    const key=(x.title+'|'+x.url).toLowerCase(); if (seen.has(key)) continue; seen.add(key); dedup.push(x);
  }
  return {generatedAt:new Date().toISOString(),profile,opportunities:dedup.slice(0,40),errors};
}
async function scanCached(profile) {
  const key=JSON.stringify(profile);
  const now=Date.now();
  const cached=scanCache.get(key);
  if (cached && now-cached.at < 5*60*1000) return cached.value;
  const value=await scan(profile);
  scanCache.set(key,{at:now,value});
  if (scanCache.size>30) {
    const oldest=[...scanCache.entries()].sort((a,b)=>a[1].at-b[1].at).slice(0,10);
    for (const [k] of oldest) scanCache.delete(k);
  }
  return value;
}
function profileFromUrl(u) {
  const keywords=(u.searchParams.get('keywords')||'').split(',').map(s=>s.trim()).filter(Boolean).slice(0,25);
  const minScore=Math.max(0,Math.min(100,Number(u.searchParams.get('min_score')||25)));
  const region=(u.searchParams.get('region')||'East Tennessee').slice(0,100);
  return {keywords,region,minScore};
}
function toolsPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RevenueOS Practical Tools</title><meta name="description" content="Low-cost practical tools for contractors and people pressure-testing business ideas."><style>body{font-family:Inter,system-ui,Arial;background:#0d1117;color:#e6edf3;margin:0}.wrap{max-width:880px;margin:auto;padding:52px 22px}h1{font-size:46px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}.card{background:#161b22;border:1px solid #30363d;border-radius:14px;padding:22px}.price{font-size:32px;font-weight:900}.btn{display:inline-block;background:#f0f6fc;color:#0d1117;padding:13px 18px;border-radius:8px;text-decoration:none;font-weight:800}.muted{color:#8b949e}</style></head><body><div class="wrap"><p><a href="/" style="color:#58a6ff">← BidLens Radar</a></p><h1>Practical tools that save time.</h1><p class="muted">No consulting call required. Pick the result you need and check out securely with Stripe.</p><div class="grid"><div class="card"><h2>Handyman Quote & Scope Kit</h2><div class="price">$9</div><p>Reusable estimate and scope structure for small contracting and handyman jobs: scope, exclusions, materials, change orders, payment schedule, acceptance and closeout.</p><a class="btn" href="${LIVE_OFFERS.handymanKit}">Get the kit</a></div><div class="card"><h2>AI Business Idea Stress Test</h2><div class="price">$19</div><p>Submit one business or side-hustle idea and your first goal. Receive a practical pressure test covering demand, competition, monetization, risks and the fastest low-cost validation path.</p><a class="btn" href="${LIVE_OFFERS.ideaStressTest}">Stress-test my idea</a></div></div><p class="muted" style="margin-top:32px">Secure checkout is handled by Stripe. Digital delivery follows purchase.</p></div></body></html>`;
}
function handymanKitPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Handyman Quote & Scope Kit</title><style>body{font-family:Inter,system-ui,Arial;color:#17202a;background:#f7f7f5;margin:0}.wrap{max-width:850px;margin:auto;background:#fff;padding:44px 48px;box-sizing:border-box}h1{font-size:36px}h2{margin-top:32px;border-bottom:2px solid #222;padding-bottom:7px}.box{border:1px solid #bbb;padding:16px;margin:12px 0;border-radius:6px}li{margin:7px 0}.small{font-size:13px;color:#555}@media print{body{background:#fff}.wrap{max-width:none;padding:0}}</style></head><body><div class="wrap"><h1>Handyman Quote & Scope Kit</h1><p>Use this as a reusable structure for small contracting, repair, installation and improvement work. Copy it into your estimating system or print this page to PDF.</p><h2>1. Estimate / Proposal Structure</h2><div class="box"><b>Customer:</b> ____________________<br><b>Project address:</b> ____________________<br><b>Date / Quote #:</b> ____________________<br><b>Project:</b> ____________________</div><div class="box"><b>Scope Includes</b><ul><li>Describe the exact work area and finished result.</li><li>List demolition/prep separately from installation.</li><li>State who supplies each major material.</li><li>State cleanup/disposal responsibility.</li><li>State ordinary caulk, touch-up and testing included in the price.</li></ul></div><div class="box"><b>Total Project Price:</b> $__________<br><b>Deposit / first payment:</b> $__________ due __________<br><b>Progress payment:</b> $__________ due __________<br><b>Final payment:</b> $__________ due at substantial completion.</div><h2>2. Scope-Writing Checklist</h2><ul><li>Quantity, dimensions and location.</li><li>Existing-condition assumptions.</li><li>Preparation and protection of adjacent surfaces.</li><li>Fasteners, sealants, blocking, trim or minor consumables included.</li><li>Testing/adjustment required before completion.</li><li>Normal jobsite cleanup.</li></ul><h2>3. Exclusions / Assumptions</h2><div class="box">Unless specifically listed in the scope, price excludes concealed damage, structural engineering, major electrical/plumbing/HVAC relocation, asbestos/lead/mold remediation, permits and fees, code upgrades outside the described work, owner-requested changes, material defects in customer-supplied products, and repairs to areas not disturbed by the stated scope.</div><h2>4. Customer-Supplied Material Language</h2><div class="box">Customer-supplied materials must be onsite, complete and suitable for installation when work begins. Delays, missing components, incompatible materials, defects or replacement materials may affect schedule and price. Contractor is not responsible for manufacturer defects or warranty coverage on customer-purchased materials.</div><h2>5. Hidden-Condition / Change-Order Language</h2><div class="box">Pricing is based on visible and reasonably accessible conditions at the time of estimate. If concealed damage, unsafe conditions or work outside this scope is discovered, work affecting that condition will pause and the customer will receive revised scope/pricing before additional work proceeds. Customer-requested additions or changes are treated as change orders.</div><h2>6. Acceptance</h2><div class="box">Customer accepts the scope, price, exclusions and payment schedule above and authorizes the described work.<br><br>Customer signature: ____________________ Date: __________<br>Contractor signature: ____________________ Date: __________</div><h2>7. Closeout / Paid Receipt Checklist</h2><ul><li>Project name and address.</li><li>Original contract amount + approved change orders.</li><li>Total paid and payment date.</li><li>Balance: $0.00 when fully paid.</li><li>Short description of completed work.</li><li>Warranty or manufacturer-document handoff where applicable.</li></ul><p class="small">Template only; adapt it to the project, your licensing status, local law, permit requirements and insurance. This is not legal, tax, engineering or licensing advice.</p></div></body></html>`;
}
function page(opts={}) {
  const pageTitle=opts.pageTitle || 'BidLens Radar — Stop digging through bid portals';
  const pageDescription=opts.pageDescription || 'Tennessee contractor bid intelligence that scans public procurement sources and filters opportunities by trade and region.';
  const presetKeywords=(opts.keywords || DEFAULT_KEYWORDS).join(',');
  const presetRegion=opts.region || 'East Tennessee';
  const canonical=opts.canonical || 'https://bidlens-radar.onrender.com/';
  const cta=CHECKOUT_URL
    ? `<a class="cta" href="${escapeHtml(CHECKOUT_URL)}">Start Founding Access — $39/mo</a>`
    : `<a class="cta" href="#demo">See live opportunities</a><p class="tiny">Live checkout is being activated. No card is collected on this preview.</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(pageTitle)}</title><meta name="description" content="${escapeHtml(pageDescription)}"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:title" content="${escapeHtml(pageTitle)}"><meta property="og:description" content="${escapeHtml(pageDescription)}"><meta property="og:type" content="website"><meta property="og:url" content="${escapeHtml(canonical)}"><style>
  body{font-family:Inter,system-ui,Arial;background:#0d1117;color:#e6edf3;margin:0}.wrap{max-width:980px;margin:auto;padding:48px 22px}.hero{padding:48px 0}.eyebrow{color:#8b949e;text-transform:uppercase;letter-spacing:.13em;font-size:12px}.hero h1{font-size:clamp(40px,7vw,72px);line-height:.98;margin:14px 0;max-width:850px}.hero p{font-size:20px;color:#b7c0ca;max-width:760px;line-height:1.55}.cta{display:inline-block;background:#f0f6fc;color:#0d1117;padding:15px 22px;border-radius:9px;text-decoration:none;font-weight:800;margin-top:12px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:18px}.card b{font-size:18px}.demo{margin-top:48px}.controls{display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:10px}.controls input,.controls button{padding:13px;border-radius:8px;border:1px solid #30363d;background:#0d1117;color:#fff}.controls button{background:#238636;font-weight:800;cursor:pointer}.result{margin:12px 0;padding:16px;border:1px solid #30363d;border-radius:10px;background:#161b22}.score{float:right;font-weight:800}.muted,.tiny{color:#8b949e}.tiny{font-size:12px}.sources{font-size:13px;color:#8b949e;margin-top:32px}@media(max-width:650px){.controls{grid-template-columns:1fr}.score{float:none;display:block;margin-bottom:8px}}
  </style></head><body><div class="wrap"><section class="hero"><div class="eyebrow">BidLens Radar · Tennessee contractor intelligence</div><h1>Open bids worth chasing. The junk filtered out.</h1><p>BidLens Radar checks public procurement sources, scores opportunities against your trades and region, and surfaces the jobs most likely to be worth your time. No portal-hopping. No giant spreadsheet. No pretending every RFP is a lead.</p>${cta}</section>
  <section class="grid"><div class="card"><b>Daily opportunity scan</b><p class="muted">Public state and local procurement sources checked automatically.</p></div><div class="card"><b>Bid / no-bid scoring</b><p class="muted">Trade-fit, location-fit and procurement signals distilled into a simple score.</p></div><div class="card"><b>Source-linked packets</b><p class="muted">Every result points back to the official posting so nothing important is hidden.</p></div><div class="card"><b>Founding price: $39/mo</b><p class="muted">Built for small contractors that cannot spend hours hunting portals.</p></div></section>
  <section id="demo" class="demo"><h2>Live Tennessee opportunity radar</h2><p class="muted">Try your own trade keywords. Example: roofing, electrical, concrete, painting, landscaping.</p><div class="controls"><input id="kw" value="${escapeHtml(presetKeywords)}"><input id="region" value="${escapeHtml(presetRegion)}" aria-label="Region"><input id="score" type="number" min="0" max="100" value="25"><button onclick="run()">Scan now</button></div><div id="status" class="muted" style="margin-top:12px"></div><div id="results"></div></section>
  <div class="sources">Official sources include Tennessee CPO/STREAM plus East Tennessee city and county procurement pages. BidLens is an independent alerting/filtering service and is not affiliated with those agencies. Always verify deadlines and submission requirements at the official source. · <a href="/tools" style="color:#58a6ff">Contractor tools</a></div></div><script>
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function run(){const kw=document.getElementById('kw').value,region=document.getElementById('region').value,ms=document.getElementById('score').value;document.getElementById('status').textContent='Scanning official sources…';document.getElementById('results').innerHTML='';try{const r=await fetch('/api/opportunities?keywords='+encodeURIComponent(kw)+'&region='+encodeURIComponent(region)+'&min_score='+encodeURIComponent(ms));const j=await r.json();document.getElementById('status').textContent=j.opportunities.length+' matching opportunities found';document.getElementById('results').innerHTML=j.opportunities.map(x=>'<div class="result"><span class="score">'+x.score+'/100</span><b>'+esc(x.title)+'</b><div class="muted">'+esc(x.source)+'</div><p>'+esc(x.details)+'</p><div class="tiny">Matched: '+esc((x.hits||[]).join(', ')||'general fit')+'</div>'+((x.flags||[]).length?'<div class="tiny" style="margin-top:6px">Check before bidding: '+esc(x.flags.join(' · '))+'</div>':'')+'<p><a href="'+esc(x.url)+'" target="_blank" rel="noopener" style="color:#58a6ff">Open official source ↗</a></p></div>').join('')||'<div class="result">No strong matches at this threshold. Try broader keywords or a lower score.</div>'}catch(e){document.getElementById('status').textContent='Scan failed. Try again shortly.'}}
  run();
  </script></body></html>`;
}

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if (u.pathname==='/health') { res.writeHead(200,{'content-type':'application/json'}); return res.end(JSON.stringify({ok:true,service:'bidlens-radar',checkoutConfigured:Boolean(CHECKOUT_URL),sources:SOURCES.length})); }
  if (u.pathname==='/api/opportunities') {
    try { const result=await scanCached(profileFromUrl(u)); res.writeHead(200,{'content-type':'application/json','cache-control':'public,max-age=300'}); return res.end(JSON.stringify(result)); }
    catch(e){ res.writeHead(500,{'content-type':'application/json'}); return res.end(JSON.stringify({ok:false,error:'scan_failed'})); }
  }
  if (u.pathname==='/tools') { res.writeHead(200,{'content-type':'text/html; charset=utf-8'}); return res.end(toolsPage()); }
  if (u.pathname===HANDYMAN_KIT_PATH) { res.writeHead(200,{'content-type':'text/html; charset=utf-8','x-robots-tag':'noindex, nofollow'}); return res.end(handymanKitPage()); }
  if (u.pathname==='/robots.txt') {
    res.writeHead(200,{'content-type':'text/plain; charset=utf-8'});
    return res.end('User-agent: *\nAllow: /\nSitemap: https://bidlens-radar.onrender.com/sitemap.xml\n');
  }
  if (u.pathname==='/sitemap.xml') {
    const urls=['',...Object.keys(CATEGORY_PAGES).map(x=>'bids/'+x),...Object.keys(LOCAL_PAGES).map(x=>'bids/'+x)];
    const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(x=>'<url><loc>https://bidlens-radar.onrender.com/'+x+'</loc></url>').join('')+'</urlset>';
    res.writeHead(200,{'content-type':'application/xml; charset=utf-8'});
    return res.end(xml);
  }
  if (u.pathname.startsWith('/bids/')) {
    const slug=u.pathname.slice('/bids/'.length).replace(/\/$/,'');
    const keywords=CATEGORY_PAGES[slug];
    if (keywords) {
      const trade=slug.replace('-bids-tennessee','').replace(/-/g,' ');
      res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
      return res.end(page({
        pageTitle:`${trade.replace(/\b\w/g,c=>c.toUpperCase())} Bids in Tennessee — BidLens Radar`,
        pageDescription:`Live Tennessee public procurement opportunities filtered for ${trade} contractors, with official source links and bid/no-bid scoring.`,
        keywords,
        canonical:`https://bidlens-radar.onrender.com/bids/${slug}`
      }));
    }
    const region=LOCAL_PAGES[slug];
    if (region) {
      res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
      return res.end(page({
        pageTitle:`${region} Contractor Bids — BidLens Radar`,
        pageDescription:`Live public bid opportunities around ${region}, Tennessee, filtered for small construction and trade contractors with official source links.`,
        region,
        canonical:`https://bidlens-radar.onrender.com/bids/${slug}`
      }));
    }
  }
  if (u.pathname==='/') { res.writeHead(200,{'content-type':'text/html; charset=utf-8'}); return res.end(page()); }
  res.writeHead(404,{'content-type':'text/plain'}); res.end('Not found');
});
server.listen(PORT,'0.0.0.0',()=>{
  console.log(JSON.stringify({type:'bidlens_radar_started',port:PORT,sources:SOURCES.length,checkoutConfigured:Boolean(CHECKOUT_URL),at:new Date().toISOString()}));
  scanCached({keywords:DEFAULT_KEYWORDS,region:'East Tennessee',minScore:25})
    .then(r=>console.log(JSON.stringify({type:'bidlens_startup_scan',opportunities:r.opportunities.length,errors:r.errors,top:r.opportunities.slice(0,3).map(x=>({score:x.score,title:x.title,source:x.source})),at:new Date().toISOString()})))
    .catch(e=>console.log(JSON.stringify({type:'bidlens_startup_scan_error',error:String(e.message||e),at:new Date().toISOString()})));
});
