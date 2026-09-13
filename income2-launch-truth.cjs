'use strict';

// Launch-time truth guard for the current Income 2 architecture.
// Private EARN is owner-only. The 70/30 personal-agent economy lives in
// income2-personal-ledger.cjs and must never inherit legacy seller sharing.
process.env.AGENT_USER_SHARE_BPS = '0';

let finalized = false;

function deepReplace(value) {
  if (typeof value === 'string') {
    return value
      .replace(/0\.003-USDC/gi, '0.001-USDC')
      .replace(/0\.003 USDC/gi, '0.001 USDC')
      .replace(/0\.003-USDC/gi, '0.001-USDC');
  }
  if (Array.isArray(value)) return value.map(deepReplace);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepReplace(v);
    return out;
  }
  return value;
}

function finalize() {
  if (finalized) return;
  finalized = true;

  // Correct any stale public quick-start price text left by older bootstrap copy.
  try {
    const express = require('express');
    const priorSend = express.response.send;
    express.response.send = function income2LaunchTruthSend(body) {
      return priorSend.call(this, deepReplace(body));
    };
    const priorJson = express.response.json;
    express.response.json = function income2LaunchTruthJson(body) {
      return priorJson.call(this, deepReplace(body));
    };
  } catch {}

  // Make legacy ledger status explicitly owner-only. This does not alter the
  // separate Income 2 personal-agent 70/30 ledger.
  try {
    const legacy = require('./ledger.cjs');
    const baseStatus = legacy.status.bind(legacy);
    legacy.status = async function income2PrivateEarnStatus(...args) {
      const status = await baseStatus(...args);
      return {
        ...status,
        economics: {
          ...(status.economics || {}),
          userSharePercent: 0,
          platformSharePercent: 100,
          allocationMode: 'private_earn_owner_only',
          economyScope: 'patrick_private_earn',
          income2PersonalAgentEconomy: 'separate_70_30_ledger',
          privateEarnSharedWithIncome2Users: false,
        },
      };
    };
  } catch {}

  // Patch the already-wrapped Purchase Guard status copy too.
  try {
    const purchaseGuard = require('./purchase-guard.cjs');
    const base = purchaseGuard.status.bind(purchaseGuard);
    purchaseGuard.status = async function income2LaunchTruthPurchaseGuard(...args) {
      return deepReplace(await base(...args));
    };
  } catch {}

  console.log(JSON.stringify({
    type: 'income2_launch_truth_ready',
    privateEarnOwnerOnly: true,
    legacyUserShareBps: 0,
    personalAgentEconomy: 'separate_70_30',
    currentWebExtractPriceUsd: 0.001,
    at: new Date().toISOString(),
  }));
}

module.exports = { finalize, deepReplace };
