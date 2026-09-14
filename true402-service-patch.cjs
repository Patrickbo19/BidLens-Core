'use strict';

function serviceDescriptor() {
  const origin = String(process.env.PUBLIC_ORIGIN || '').replace(/\/$/, '');
  const payTo = String(process.env.EARN_RECEIVE_ADDRESS || '').trim();
  const facilitator = String(process.env.X402_FACILITATOR_URL || 'https://facilitator.payai.network').replace(/\/$/, '');
  const isPublicData = /income2-treasury/i.test(origin);

  if (isPublicData) {
    return {
      x402: '1.0',
      name: 'income2-us-macro-snapshot',
      description: 'Source-backed U.S. macro snapshot for agents: Treasury yield curve, national debt, average Treasury rates, and labor-market indicators in one paid call.',
      capabilities: ['data', 'macro', 'treasury', 'rates', 'debt', 'labor'],
      pricing: { currency: 'USDC', base: '0.025', unit: 'request' },
      payment: { address: payTo, chain: 'base', facilitator },
      endpoint: `${origin}/macro-snapshot`,
    };
  }

  const sellerOrigin = origin || 'https://earn-tools-backend.onrender.com';
  return {
    x402: '1.0',
    name: 'income2-web-extract',
    description: 'Convert a public webpage into clean Markdown plus metadata and links for research, RAG, and agent workflows.',
    capabilities: ['web', 'extract', 'markdown', 'research', 'rag'],
    pricing: { currency: 'USDC', base: '0.001', unit: 'request' },
    payment: { address: payTo, chain: 'base', facilitator },
    endpoint: `${sellerOrigin}/web-extract`,
  };
}

function install() {
  const express = require('express');
  if (express.application.__income2True402Installed) return;
  express.application.__income2True402Installed = true;
  const originalListen = express.application.listen;
  express.application.listen = function income2True402Listen(...args) {
    if (!this.__income2True402Route) {
      this.__income2True402Route = true;
      this.get('/.well-known/x402-service.json', (_req, res) => {
        res.set('cache-control', 'public, max-age=300').json(serviceDescriptor());
      });
    }
    return originalListen.apply(this, args);
  };
}

module.exports = { install, serviceDescriptor };

if (process.env.NODE_OPTIONS && process.env.NODE_OPTIONS.includes('true402-service-patch.cjs')) install();
