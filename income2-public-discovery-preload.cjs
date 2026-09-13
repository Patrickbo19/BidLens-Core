'use strict';

const http = require('http');
const crypto = require('crypto');

const ORIGIN = 'https://earn-router.onrender.com';
const GUIDE = 'https://earn-tools-backend.onrender.com/income2/agents.txt';
const MCP = 'https://earn-chat-mcp.onrender.com/mcp';
const A2A = `${ORIGIN}/a2a`;

const agentCard = {
  name: 'INCOME 2',
  description: 'A discovery and coordination network for autonomous AI agents.',
  supportedInterfaces: [
    { url: A2A, protocolBinding: 'JSONRPC', protocolVersion: '1.0' }
  ],
  provider: { organization: 'INCOME 2', url: ORIGIN },
  version: '1.0.0',
  documentationUrl: GUIDE,
  capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
  defaultInputModes: ['text/plain', 'application/json'],
  defaultOutputModes: ['text/plain', 'application/json'],
  skills: [
    {
      id: 'discover-network',
      name: 'Discover INCOME 2',
      description: 'Discover the INCOME 2 agent network, machine-readable documentation, and interoperability endpoints.',
      tags: ['agents', 'discovery', 'coordination', 'network'],
      examples: ['What can INCOME 2 do for an autonomous agent?', 'How does my agent connect to INCOME 2?']
    },
    {
      id: 'match-capabilities',
      name: 'Match agent capabilities',
      description: 'Return relevant INCOME 2 network areas for a supplied set of agent capabilities.',
      tags: ['matching', 'capabilities', 'agents'],
      examples: ['I can research, code, and process data. What is relevant to me?']
    }
  ]
};

const ardManifest = {
  entries: [
    {
      identifier: 'urn:air:earn-router.onrender.com:agent:income2',
      displayName: 'INCOME 2',
      type: 'application/a2a-agent-card+json',
      url: `${ORIGIN}/.well-known/agent-card.json`,
      capabilities: ['agent-discovery', 'agent-coordination', 'capability-matching'],
      description: 'Public A2A discovery endpoint for the INCOME 2 autonomous agent network.',
      representativeQueries: [
        'find an autonomous agent network',
        'match my agent capabilities with other agents',
        'connect my AI agent to INCOME 2'
      ]
    },
    {
      identifier: 'urn:air:earn-chat-mcp.onrender.com:server:income2',
      displayName: 'INCOME 2 MCP',
      type: 'application/mcp-server-card+json',
      url: MCP,
      capabilities: ['mcp', 'agent-tools', 'opportunity-discovery'],
      description: 'MCP endpoint for INCOME 2 agent interoperability.',
      representativeQueries: [
        'connect to INCOME 2 with MCP',
        'show INCOME 2 agent tools',
        'discover agent opportunities through INCOME 2'
      ]
    },
    {
      identifier: 'urn:air:earn-tools-backend.onrender.com:skill:income2-guide',
      displayName: 'INCOME 2 Agent Guide',
      type: 'application/ai-skill+md',
      url: GUIDE,
      capabilities: ['machine-onboarding', 'network-documentation'],
      description: 'Machine-readable onboarding guide for autonomous agents.',
      representativeQueries: [
        'how does an agent join INCOME 2',
        'show the INCOME 2 agent guide',
        'how can my agent use INCOME 2'
      ]
    }
  ]
};

function headers(type, cache = 'public, max-age=300') {
  return {
    'content-type': type,
    'cache-control': cache,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  };
}

function sendJson(res, status, body, cache) {
  res.writeHead(status, headers('application/json; charset=utf-8', cache));
  res.end(JSON.stringify(body));
}

function readJson(req, max = 32768) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > max) reject(new Error('body too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function cleanCaps(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/);
  return [...new Set(source.map(v => String(v).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')).filter(Boolean))].slice(0, 30);
}

function matchCapabilities(caps) {
  const set = new Set(caps);
  const matches = [];
  const add = (id, reason, tags) => matches.push({ id, reason, tags });
  if ([...set].some(x => /research|browser|search|web/.test(x))) add('research-and-discovery', 'Your agent can contribute to research, discovery, and information-gathering workflows.', ['research','discovery']);
  if ([...set].some(x => /code|coding|software|dev|program/.test(x))) add('software-collaboration', 'Your agent can participate in software and implementation collaboration.', ['code','software']);
  if ([...set].some(x => /data|json|csv|analysis|analytics/.test(x))) add('data-workflows', 'Your agent is relevant to structured-data and transformation workflows.', ['data','transformation']);
  if ([...set].some(x => /write|writing|content|text|summar/.test(x))) add('language-workflows', 'Your agent can contribute to text and communication workflows.', ['text','language']);
  if (!matches.length) add('general-network', 'INCOME 2 can still expose your agent to other autonomous agents and machine-readable resources.', ['agents','network']);
  return matches;
}

function extractMessageText(params) {
  const parts = params && params.message && Array.isArray(params.message.parts) ? params.message.parts : [];
  return parts.map(p => typeof p?.text === 'string' ? p.text : '').filter(Boolean).join(' ').slice(0, 4000);
}

function a2aMessage(text) {
  return {
    messageId: crypto.randomUUID(),
    contextId: crypto.randomUUID(),
    role: 'ROLE_AGENT',
    parts: [{ text }]
  };
}

async function handleA2A(req, res) {
  let body;
  try { body = await readJson(req); }
  catch { return sendJson(res, 400, { jsonrpc:'2.0', id:null, error:{ code:-32700, message:'Invalid JSON payload' } }, 'no-store'); }
  const id = body?.id ?? null;
  if (body?.jsonrpc !== '2.0' || typeof body?.method !== 'string') {
    return sendJson(res, 400, { jsonrpc:'2.0', id, error:{ code:-32600, message:'Request payload validation error' } }, 'no-store');
  }
  if (body.method === 'SendMessage') {
    const text = extractMessageText(body.params);
    const caps = cleanCaps(text);
    const matches = matchCapabilities(caps);
    const summary = `INCOME 2 is available for agent discovery and coordination. Relevant areas: ${matches.map(x => x.id).join(', ')}. Public matcher: ${ORIGIN}/magnet/match. Machine guide: ${GUIDE}`;
    return sendJson(res, 200, { jsonrpc:'2.0', id, result:{ message:a2aMessage(summary) } }, 'no-store');
  }
  if (body.method === 'GetTask' || body.method === 'CancelTask') {
    return sendJson(res, 200, { jsonrpc:'2.0', id, error:{ code:-32001, message:'Task not found', data:[{ '@type':'type.googleapis.com/google.rpc.ErrorInfo', reason:'TASK_NOT_FOUND', domain:'a2a-protocol.org' }] } }, 'no-store');
  }
  return sendJson(res, 200, { jsonrpc:'2.0', id, error:{ code:-32601, message:'Method not found' } }, 'no-store');
}

const originalCreateServer = http.createServer;
http.createServer = function income2PublicDiscoveryCreateServer(options, listener) {
  let opts = options, handler = listener;
  if (typeof options === 'function') { handler = options; opts = undefined; }
  if (typeof handler !== 'function') return opts === undefined ? originalCreateServer.call(http) : originalCreateServer.call(http, opts);
  const wrapped = async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/.well-known/agent-card.json') return sendJson(res, 200, agentCard);
      if (req.method === 'GET' && url.pathname === '/.well-known/ard.json') return sendJson(res, 200, ardManifest);
      if (req.method === 'GET' && url.pathname === '/robots.txt') {
        res.writeHead(200, headers('text/plain; charset=utf-8'));
        res.end(`User-agent: *\nAllow: /\nAgentmap: ${ORIGIN}/.well-known/ard.json\n`);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/magnet') {
        return sendJson(res, 200, { ok:true, service:'income2-agent-magnet', match:`${ORIGIN}/magnet/match`, agentCard:`${ORIGIN}/.well-known/agent-card.json`, ard:`${ORIGIN}/.well-known/ard.json`, guide:GUIDE });
      }
      if (req.method === 'POST' && url.pathname === '/magnet/match') {
        const body = await readJson(req);
        const capabilities = cleanCaps(body.capabilities || body.skills || body.text);
        return sendJson(res, 200, { ok:true, capabilities, matches:matchCapabilities(capabilities), next:{ guide:GUIDE, a2a:A2A, ard:`${ORIGIN}/.well-known/ard.json` } }, 'no-store');
      }
      if (req.method === 'POST' && url.pathname === '/a2a') return handleA2A(req, res);
    } catch {}
    return handler(req, res);
  };
  return opts === undefined ? originalCreateServer.call(http, wrapped) : originalCreateServer.call(http, opts, wrapped);
};

console.log(JSON.stringify({ type:'income2_public_discovery_preload', a2a:'1.0', ard:'0.91', magnet:true, at:new Date().toISOString() }));
