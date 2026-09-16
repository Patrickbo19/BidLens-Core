const http = require('http');
const { URL } = require('url');

const PORT = process.env.PORT || 10000;
const CHECKOUT_URL = String(process.env.BIDLENS_CHECKOUT_URL || '').trim();
const DEFAULT_KEYWORDS = ['construction','repair','maintenance','renovation','roof','roofing','paint','painting','electrical','concrete','landscaping','hvac','demolition','remodel','building','facility'];
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
    name:'City of Knoxville Bid / Contracting Opportunities',
    url:'https://www.knoxvilletn.gov/cms/One.aspx?pageId=177206&portalId=109562',
    kind:'knoxville'
  }
];

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
function scoreOpportunity(text, profile) {
  const hay=String(text).toLowerCase();
  const kws=profile.keywords.length ? profile.keywords : DEFAULT_KEYWORDS;
  const hits=kws.filter(k=>hay.includes(k.toLowerCase()));
  let score=Math.min(65, hits.length*11);
  if (/knox|east tennessee|knoxville|anderson|blount|loudon|sevier|roane|campbell/i.test(text)) score+=20;
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
    rows.push({source:source.name,title:cells.slice(0,4).join(' — ').slice(0,320),details:text.slice(0,800),score,hits,url:rowLinks[0]?.url || source.url});
  }
  if (rows.length) return rows;
  const links=getLinks(html,source.url);
  for (const link of links) {
    const {score,hits}=scoreOpportunity(link.text,profile);
    if (score < profile.minScore) continue;
    if (!/bid|rfp|rfq|itb|proposal|construction|repair|maintenance|grant|solicitation|project/i.test(link.text)) continue;
    rows.push({source:source.name,title:link.text.slice(0,320),details:link.text,score,hits,url:link.url});
  }
  return rows.slice(0,80);
}
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
function profileFromUrl(u) {
  const keywords=(u.searchParams.get('keywords')||'').split(',').map(s=>s.trim()).filter(Boolean).slice(0,25);
  const minScore=Math.max(0,Math.min(100,Number(u.searchParams.get('min_score')||25)));
  const region=(u.searchParams.get('region')||'East Tennessee').slice(0,100);
  return {keywords,region,minScore};
}
function page() {
  const cta=CHECKOUT_URL
    ? `<a class="cta" href="${escapeHtml(CHECKOUT_URL)}">Start Founding Access — $39/mo</a>`
    : `<a class="cta" href="#demo">See live opportunities</a><p class="tiny">Live checkout is being activated. No card is collected on this preview.</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BidLens Radar — Stop digging through bid portals</title><style>
  body{font-family:Inter,system-ui,Arial;background:#0d1117;color:#e6edf3;margin:0}.wrap{max-width:980px;margin:auto;padding:48px 22px}.hero{padding:48px 0}.eyebrow{color:#8b949e;text-transform:uppercase;letter-spacing:.13em;font-size:12px}.hero h1{font-size:clamp(40px,7vw,72px);line-height:.98;margin:14px 0;max-width:850px}.hero p{font-size:20px;color:#b7c0ca;max-width:760px;line-height:1.55}.cta{display:inline-block;background:#f0f6fc;color:#0d1117;padding:15px 22px;border-radius:9px;text-decoration:none;font-weight:800;margin-top:12px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:18px}.card b{font-size:18px}.demo{margin-top:48px}.controls{display:grid;grid-template-columns:2fr 1fr auto;gap:10px}.controls input,.controls button{padding:13px;border-radius:8px;border:1px solid #30363d;background:#0d1117;color:#fff}.controls button{background:#238636;font-weight:800;cursor:pointer}.result{margin:12px 0;padding:16px;border:1px solid #30363d;border-radius:10px;background:#161b22}.score{float:right;font-weight:800}.muted,.tiny{color:#8b949e}.tiny{font-size:12px}.sources{font-size:13px;color:#8b949e;margin-top:32px}@media(max-width:650px){.controls{grid-template-columns:1fr}.score{float:none;display:block;margin-bottom:8px}}
  </style></head><body><div class="wrap"><section class="hero"><div class="eyebrow">BidLens Radar · Tennessee contractor intelligence</div><h1>Open bids worth chasing. The junk filtered out.</h1><p>BidLens Radar checks public procurement sources, scores opportunities against your trades and region, and surfaces the jobs most likely to be worth your time. No portal-hopping. No giant spreadsheet. No pretending every RFP is a lead.</p>${cta}</section>
  <section class="grid"><div class="card"><b>Daily opportunity scan</b><p class="muted">Public state and local procurement sources checked automatically.</p></div><div class="card"><b>Bid / no-bid scoring</b><p class="muted">Trade-fit, location-fit and procurement signals distilled into a simple score.</p></div><div class="card"><b>Source-linked packets</b><p class="muted">Every result points back to the official posting so nothing important is hidden.</p></div><div class="card"><b>Founding price: $39/mo</b><p class="muted">Built for small contractors that cannot spend hours hunting portals.</p></div></section>
  <section id="demo" class="demo"><h2>Live Tennessee opportunity radar</h2><p class="muted">Try your own trade keywords. Example: roofing, electrical, concrete, painting, landscaping.</p><div class="controls"><input id="kw" value="construction,repair,maintenance,roofing,painting,electrical,concrete,landscaping"><input id="score" type="number" min="0" max="100" value="25"><button onclick="run()">Scan now</button></div><div id="status" class="muted" style="margin-top:12px"></div><div id="results"></div></section>
  <div class="sources">Initial official sources: Tennessee GO-BID grant postings, Tennessee STREAM RFPs, Tennessee CPO RFPs, and City of Knoxville procurement pages. BidLens is an independent alerting/filtering service and is not affiliated with those agencies. Always verify deadlines and submission requirements at the official source.</div></div><script>
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function run(){const kw=document.getElementById('kw').value,ms=document.getElementById('score').value;document.getElementById('status').textContent='Scanning official sources…';document.getElementById('results').innerHTML='';try{const r=await fetch('/api/opportunities?keywords='+encodeURIComponent(kw)+'&min_score='+encodeURIComponent(ms));const j=await r.json();document.getElementById('status').textContent=j.opportunities.length+' matching opportunities found';document.getElementById('results').innerHTML=j.opportunities.map(x=>'<div class="result"><span class="score">'+x.score+'/100</span><b>'+esc(x.title)+'</b><div class="muted">'+esc(x.source)+'</div><p>'+esc(x.details)+'</p><div class="tiny">Matched: '+esc((x.hits||[]).join(', ')||'general fit')+'</div><p><a href="'+esc(x.url)+'" target="_blank" rel="noopener" style="color:#58a6ff">Open official source ↗</a></p></div>').join('')||'<div class="result">No strong matches at this threshold. Try broader keywords or a lower score.</div>'}catch(e){document.getElementById('status').textContent='Scan failed. Try again shortly.'}}
  run();
  </script></body></html>`;
}

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if (u.pathname==='/health') { res.writeHead(200,{'content-type':'application/json'}); return res.end(JSON.stringify({ok:true,service:'bidlens-radar',checkoutConfigured:Boolean(CHECKOUT_URL),sources:SOURCES.length})); }
  if (u.pathname==='/api/opportunities') {
    try { const result=await scan(profileFromUrl(u)); res.writeHead(200,{'content-type':'application/json','cache-control':'public,max-age=300'}); return res.end(JSON.stringify(result)); }
    catch(e){ res.writeHead(500,{'content-type':'application/json'}); return res.end(JSON.stringify({ok:false,error:'scan_failed'})); }
  }
  if (u.pathname==='/') { res.writeHead(200,{'content-type':'text/html; charset=utf-8'}); return res.end(page()); }
  res.writeHead(404,{'content-type':'text/plain'}); res.end('Not found');
});
server.listen(PORT,'0.0.0.0',()=>console.log(JSON.stringify({type:'bidlens_radar_started',port:PORT,sources:SOURCES.length,checkoutConfigured:Boolean(CHECKOUT_URL),at:new Date().toISOString()})));
