require('./income2-agent-guide-outer.cjs').install();
require('./income2-agent-network-bridge.cjs').install();
require('./income2-agent-wallet.cjs').install();
require('./income2-personal-gateway.cjs').install();
require('./seller-backend-core.js');
require('./income2-agent-network-selftest.cjs').schedule();
require('./income2-agent-wallet-selftest.cjs').schedule();
