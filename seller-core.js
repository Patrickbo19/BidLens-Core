require('./income2-personal-market.cjs').install();
require('./income2-earn-discovery.cjs').install();
require('./income2-agent-discovery.cjs').install();
require('./income2-wallet-discovery.cjs').install();
require('./true402-service-patch.cjs').install();
require('./discovery-price-consistency.cjs').install();

// Directory registration is an explicit maintenance action, not a deploy side effect.
// The repo already has an explicit registration workflow; seller boots must not create
// probe traffic that contaminates the paid-buyer experiment.
const directoryBootTimers = new Set([
  'registerAgent402',
  'registerX402Arena',
  'registerMarket402',
  'register402Index',
]);
const sellerCoreSetTimeout = global.setTimeout;
global.setTimeout = function income2NoDirectoryBootTimers(callback, delay, ...args) {
  if (directoryBootTimers.has(callback?.name) && String(process.env.INCOME2_ALLOW_DIRECTORY_BOOT || '') !== '1') {
    console.log(JSON.stringify({
      type: 'directory_registration_skipped',
      registrar: callback.name,
      reason: 'boot_registration_disabled_use_explicit_workflow',
      at: new Date().toISOString(),
    }));
    const skippedTimer = {
      unref() { return this; },
      ref() { return this; },
      hasRef() { return false; },
    };
    return skippedTimer;
  }
  return sellerCoreSetTimeout(callback, delay, ...args);
};

require('./seller-core-core.js');
