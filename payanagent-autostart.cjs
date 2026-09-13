const argv1 = String(process.argv[1] || '');

// This file is used as a Render preload. Only the public seller gateway owns
// marketplace registration state; the child seller-core process must not create
// a second marketplace identity.
if (/seller-backend\.js$/.test(argv1)) {
  const payanBootstrap = require('./payanagent-bootstrap.cjs');
  const superteamBootstrap = require('./superteam-bootstrap.cjs');
  const spendVault = require('./earn-spend-vault.cjs');

  setTimeout(() => payanBootstrap.launch().catch(error => {
    console.error(JSON.stringify({
      type:'payanagent_bootstrap_error',
      error:String(error?.message || error).slice(0, 500),
      apiKeyExposed:false,
      ownerFundsSpentUsd:0,
      at:new Date().toISOString(),
    }));
  }), 8000).unref();

  setTimeout(() => superteamBootstrap.launch().catch(error => {
    console.error(JSON.stringify({
      type:'superteam_bootstrap_error',
      error:String(error?.message || error).slice(0, 500),
      secretsExposed:false,
      ownerFundsSpentUsd:0,
      at:new Date().toISOString(),
    }));
  }), 12000).unref();

  setTimeout(async () => {
    try {
      const init = await spendVault.init();
      const account = await spendVault.getAccount();
      const { x402Client } = await import('@x402/core/client');
      const { registerExactEvmScheme } = await import('@x402/evm/exact/client');
      const { wrapFetchWithPayment } = await import('@x402/fetch');
      const payerClient = new x402Client();
      registerExactEvmScheme(payerClient, { signer: account });
      const wrappedFetch = wrapFetchWithPayment(fetch, payerClient);
      if (typeof wrappedFetch !== 'function') throw new Error('x402 paid fetch wrapper not available');

      const status = await spendVault.status();
      console.log(JSON.stringify({
        type:'earn_spend_wallet_ready',
        walletReady:Boolean(init.walletReady && status.signerReady),
        payerReady:true,
        address:status.address || null,
        network:status.network || 'eip155:8453',
        asset:status.asset || 'USDC',
        ownerCapUsdc:status.ownerCapUsdc ?? 2,
        defaultPerActionCapUsdc:status.defaultPerActionCapUsdc ?? 0.5,
        usedUsdc:status.usedUsdc ?? 0,
        remainingUsdc:status.remainingUsdc ?? 2,
        onchainUsdcBalance:status.onchainUsdcBalance ?? null,
        funded:status.funded ?? null,
        privateKeyExposed:false,
        encryptedAtRest:Boolean(status.persistent),
        testPaymentSent:false,
        at:new Date().toISOString(),
      }));
    } catch (error) {
      console.error(JSON.stringify({
        type:'earn_spend_wallet_error',
        error:String(error?.message || error).slice(0, 500),
        privateKeyExposed:false,
        testPaymentSent:false,
        at:new Date().toISOString(),
      }));
    }
  }, 3000).unref();
}
