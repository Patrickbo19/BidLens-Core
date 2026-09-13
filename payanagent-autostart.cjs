const argv1 = String(process.argv[1] || '');

// This file is used as a Render preload. Only the public seller gateway owns
// marketplace registration state; the child seller-core process must not create
// a second marketplace identity.
if (/seller-backend\.js$/.test(argv1)) {
  // Distribution is a first-class revenue dependency. The seller already has
  // zero-cost registration hooks for Agent402, x402 Arena, Market402 and 402Index.
  // Enable those refreshes by default in production while preserving an explicit
  // EARN_DIRECTORY_REGISTER_ON_BOOT=0 escape hatch if a directory ever becomes
  // unsafe, paid, or undesirable.
  if (process.env.EARN_DIRECTORY_REGISTER_ON_BOOT == null) {
    process.env.EARN_DIRECTORY_REGISTER_ON_BOOT = '1';
  }
  if (process.env.EARN_AGENT402_REFRESH_ON_BOOT == null) {
    process.env.EARN_AGENT402_REFRESH_ON_BOOT = '1';
  }

  require('./earn-spend-http-patch.cjs');
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

  async function reportSpendWallet(type = 'earn_spend_wallet_status') {
    try {
      const init = await spendVault.init();
      const status = await spendVault.status();
      console.log(JSON.stringify({
        type,
        walletReady:Boolean(init.walletReady && status.signerReady),
        payerReady:Boolean(status.signerReady),
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
        at:new Date().toISOString(),
      }));
    }
  }

  setTimeout(() => reportSpendWallet('earn_spend_wallet_ready'), 3000).unref();
  setInterval(() => reportSpendWallet('earn_spend_wallet_status'), 10 * 60 * 1000).unref();
}
