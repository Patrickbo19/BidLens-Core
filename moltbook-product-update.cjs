// Moltbook compliance safeguard.
//
// The current Moltbook Terms prohibit unauthorized advertising, marketing,
// spam, and commercial sales content. Keep product promotion out of automated
// Moltbook activity. Any future product mention must be a deliberate,
// context-specific decision after a fresh rules review.

async function run() {
  console.log(JSON.stringify({
    type: 'moltbook_product_update_skipped',
    reason: 'disabled_for_policy_compliance',
    at: new Date().toISOString(),
  }));
  return { skipped: true, reason: 'disabled_for_policy_compliance' };
}

module.exports = { run };
