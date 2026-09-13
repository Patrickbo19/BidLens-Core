const launchTruth = require('./income2-launch-truth.cjs');
require('./income2-agent-guide-outer.cjs').install();
require('./income2-agent-network-bridge.cjs').install();
require('./income2-agent-wallet.cjs').install();
require('./income2-personal-gateway.cjs').install();
require('./seller-backend-core.js');
launchTruth.finalize();
require('./income2-agent-network-selftest.cjs').schedule();
require('./income2-agent-wallet-selftest.cjs').schedule();
