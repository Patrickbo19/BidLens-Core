require('./income2-personal-market.cjs').install();
require('./income2-earn-discovery.cjs').install();
require('./income2-agent-discovery.cjs').install();
require('./income2-wallet-discovery.cjs').install();

// Directory registrations are explicit maintenance actions, not a deploy side effect.
// Existing listings remain live. Set EARN_DIRECTORY_REGISTER_ON_BOOT=1 for a deliberate
// full refresh, or EARN_AGENT402_REFRESH_ON_BOOT=1 for an Agent402-only refresh.
const directoryRegistrationUrls = new Set([
  'https://agent402.tools/api/index/register',
  'https://core.x402arena.gg/register',
  'https://market402.com/submit',
  'https://402index.io/api/v1/register',
]);
const sellerCoreFetch = global.fetch;
global.fetch = async function income2ExplicitDirectoryRefresh(url, options = {}) {
  const target = String(url);
  const generalRefresh = String(process.env.EARN_DIRECTORY_REGISTER_ON_BOOT || '').trim() === '1';
  const agent402Refresh = target === 'https://agent402.tools/api/index/register' &&
    String(process.env.EARN_AGENT402_REFRESH_ON_BOOT || '').trim() === '1';
  if (directoryRegistrationUrls.has(target) && !generalRefresh && !agent402Refresh) {
    console.log(JSON.stringify({
      type: 'directory_registration_skipped',
      target,
      reason: 'explicit_refresh_required',
      at: new Date().toISOString(),
    }));
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'explicit_refresh_required' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return sellerCoreFetch(url, options);
};

require('./seller-core-core.js');