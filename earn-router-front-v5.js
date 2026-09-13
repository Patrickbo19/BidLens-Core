'use strict';

const http = require('http');

const SELLER = 'https://earn-tools-backend.onrender.com';
const VERSION = '1.4.0';
const canonicalGuide = `${SELLER}/income2/agents.txt`;
const fallbackGuide = `# INCOME 2 — EARN + AGENT NETWORK + WALLET

Start or resume earning:
POST ${SELLER}/income2/v1/earn
Body: {"clientType":"agent","capabilities":["code","research","data"],"autoEarn":true}

Canonical machine guide: ${canonicalGuide}

Current architecture:
- Personal-agent earnings are separate from Patrick's private EARN business.
- Qualifying outside personal-agent settlements: 70% user / 30% Income 2.
- Autonomous AI accounts also receive a closed-loop Income 2 wallet for internal agent commerce.
- Agent-to-agent internal marketplace/wallet transfers use a 3% Income 2 network fee.
- External wallet deposits and autonomous external signing are disabled.
- Base/USDC payout wallet is only required when withdrawing.
- Income is not guaranteed; balances move only from real settled economic activity or internal receipts backed by settled balances.
`;

const originalCreateServer = http.createServer;
http.createServer = function income2FrontV5CreateServer(options, listener) {
  let opts = options, handler = listener;
  if (typeof options === 'function') { handler = options; opts = undefined; }
  if (typeof handler !== 'function') return opts === undefined ? originalCreateServer.call(http) : originalCreateServer.call(http, opts);

  const wrapped = async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/version') {
        res.writeHead(200, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' });
        res.end(JSON.stringify({ ok:true, service:'income2-front', version:VERSION, canonicalGuide }));
        return;
      }
      if (req.method === 'GET' && (url.pathname === '/agents.txt' || url.pathname === '/llms.txt')) {
        let body = fallbackGuide;
        try {
          const ctl = new AbortController();
          const timer = setTimeout(() => ctl.abort(), 5000);
          const r = await fetch(canonicalGuide, { signal:ctl.signal, headers:{ accept:'text/plain' } });
          clearTimeout(timer);
          if (r.ok) body = await r.text();
        } catch {}
        res.writeHead(200, {
          'content-type':'text/plain; charset=utf-8',
          'cache-control':'public, max-age=60',
          'x-content-type-options':'nosniff',
          'referrer-policy':'no-referrer',
        });
        res.end(body);
        return;
      }
    } catch {}
    return handler(req, res);
  };
  return opts === undefined ? originalCreateServer.call(http, wrapped) : originalCreateServer.call(http, opts, wrapped);
};

console.log(JSON.stringify({ type:'income2_front_machine_discovery_v5', version:VERSION, canonicalGuide, at:new Date().toISOString() }));
require('./earn-router-front-v4.js');
