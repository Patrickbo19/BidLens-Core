'use strict';

const express = require('express');

function install() {
  if (express.application.__income2WalletDiscoveryInstalled) return;
  express.application.__income2WalletDiscoveryInstalled = true;

  const prior = express.response.json;
  express.response.json = function income2WalletDiscoveryJson(body) {
    try {
      const path = this.req?.path;
      if (path === '/openapi.json' && body && body.paths) {
        body = {
          ...body,
          paths: {
            ...body.paths,
            '/income2/wallet/status': { post:{ summary:'Read closed-loop Income 2 agent wallet status', description:'Agent-only authenticated wallet balance, limits, freeze state, and boundary flags.', responses:{ '200':{description:'Wallet status'}, '401':{description:'Authentication required'}, '403':{description:'Agent-only wallet'} } } },
            '/income2/wallet/statement': { post:{ summary:'Read Income 2 agent wallet statement', description:'Combined settled earnings, network activity, withdrawals, and transfer activity without transfer double-counting.', responses:{ '200':{description:'Wallet statement'} } } },
            '/income2/wallet/pay': { post:{ summary:'Pay another Income 2 agent from settled balance', description:'Closed-loop idempotent agent-to-agent transfer under wallet limits. Applies the current Income 2 network fee.', responses:{ '201':{description:'Transfer settled'}, '402':{description:'Insufficient settled balance'}, '423':{description:'Wallet frozen'} } } },
            '/income2/wallet/controls': { post:{ summary:'Set Income 2 agent wallet controls', description:'Freeze/unfreeze outgoing commerce and set per-transfer and rolling 24-hour limits.', responses:{ '200':{description:'Wallet controls updated'} } } },
            '/income2/wallet/deposit': { post:{ summary:'External deposits are disabled', description:'Income 2 closed-loop agent wallets cannot accept arbitrary external deposits.', responses:{ '409':{description:'External deposits disabled'} } } },
          },
        };
      }
      if ((path === '/.well-known/x402' || path === '/.well-known/x402.json') && body && typeof body === 'object') {
        body = {
          ...body,
          agentWallet: {
            type:'income2_closed_loop',
            agentsOnly:true,
            startsAtZero:true,
            externalDeposits:false,
            externalSigning:false,
            privateEarnExcluded:true,
            platformFundsExcluded:true,
            internalNetworkFeePercent:3,
            routes:{
              status:'/income2/wallet/status',
              statement:'/income2/wallet/statement',
              pay:'/income2/wallet/pay',
              controls:'/income2/wallet/controls',
            },
          },
        };
      }
    } catch {}
    return prior.call(this, body);
  };

  console.log(JSON.stringify({ type:'income2_wallet_discovery_installed', openapi:true, manifestMetadata:true, at:new Date().toISOString() }));
}

module.exports = { install };
