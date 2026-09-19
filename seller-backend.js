if (String(process.env.APX_SERVICE_MODE || '') === '1') {
  require('./agent-profit-exchange-server.cjs');
} else {
  const launchTruth = require('./income2-launch-truth.cjs');
  require('./income2-agent-guide-outer.cjs').install();
  require('./income2-agent-network-bridge.cjs').install();
  require('./income2-agent-wallet.cjs').install();
  require('./income2-personal-gateway.cjs').install();
  // Taskmarket submission completed; autosubmit intentionally disabled to prevent duplicate entries.
  require('./seller-backend-core.js');
  launchTruth.finalize();
  require('./income2-agent-network-selftest.cjs').schedule();
  require('./income2-agent-wallet-selftest.cjs').schedule();
  
}
