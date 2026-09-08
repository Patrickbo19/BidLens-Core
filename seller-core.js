const express = require('express');
const originalJson = express.response.json;
express.response.json = function patchedJson(body) {
  if (this.statusCode === 402) {
    try {
      const header = this.getHeader('payment-required');
      if (header) {
        const challenge = JSON.parse(Buffer.from(String(header), 'base64').toString('utf8'));
        if (challenge && challenge.x402Version && Array.isArray(challenge.accepts)) {
          body = { ...(body && typeof body === 'object' ? body : {}), ...challenge };
        }
      }
    } catch {}
  }
  return originalJson.call(this, body);
};

const baseFetch = global.fetch;
global.fetch = async (url, options = {}) => {
  if (String(url) === 'https://market402.com/submit' && options.body) {
    try {
      const payload = JSON.parse(options.body);
      if (payload.url && !payload.resource) {
        payload.resource = payload.url;
        delete payload.url;
        options = { ...options, body: JSON.stringify(payload) };
      }
    } catch {}
  }
  return baseFetch(url, options);
};
require('./seller-v2.js');
