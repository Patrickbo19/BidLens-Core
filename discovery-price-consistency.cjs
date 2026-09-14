'use strict';

const DISCOVERY_PATHS = new Set([
  '/.well-known/x402',
  '/.well-known/x402.json',
  '/llms.txt',
  '/skill.md',
  '/agents.txt',
]);

function normalizeString(value) {
  return String(value)
    .replace(/\$0\.003\b/g, '$0.001')
    .replace(/\b0\.003 USDC\b/g, '0.001 USDC');
}

function normalizeValue(value) {
  if (typeof value === 'string') return normalizeString(value);
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = normalizeValue(item);
    return out;
  }
  return value;
}

function install() {
  const express = require('express');
  if (express.response.__income2DiscoveryPriceConsistencyInstalled) return;
  express.response.__income2DiscoveryPriceConsistencyInstalled = true;

  const originalJson = express.response.json;
  express.response.json = function income2DiscoveryPriceJson(body) {
    if (DISCOVERY_PATHS.has(this.req?.path)) body = normalizeValue(body);
    return originalJson.call(this, body);
  };

  const originalSend = express.response.send;
  express.response.send = function income2DiscoveryPriceSend(body) {
    if (DISCOVERY_PATHS.has(this.req?.path) && typeof body === 'string') body = normalizeString(body);
    return originalSend.call(this, body);
  };
}

module.exports = { install, normalizeValue };
