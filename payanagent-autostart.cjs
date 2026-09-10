const argv1 = String(process.argv[1] || '');

// This file is used as a Render preload. Only the public seller gateway owns
// marketplace registration state; the child seller-core process must not create
// a second marketplace identity.
if (/seller-backend\.js$/.test(argv1)) {
  const bootstrap = require('./payanagent-bootstrap.cjs');
  setTimeout(() => bootstrap.launch().catch(error => {
    console.error(JSON.stringify({
      type:'payanagent_bootstrap_error',
      error:String(error?.message || error).slice(0, 500),
      apiKeyExposed:false,
      ownerFundsSpentUsd:0,
      at:new Date().toISOString(),
    }));
  }), 8000).unref();
}
