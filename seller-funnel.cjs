const { AsyncLocalStorage } = require('node:async_hooks');

// Bounded aggregate counters only: never keep bodies, URLs supplied by callers,
// payment proofs, wallet addresses, IPs, user agents, or request identifiers.
function createSellerFunnel(routes, { log = console.log, intervalMs = 60000 } = {}) {
  const allowed = new Set(routes);
  const context = new AsyncLocalStorage();
  const since = new Date().toISOString();
  const totals = new Map();
  const pending = new Map();

  function record(event, state = context.getStore()) {
    if (!state || !allowed.has(state.route) || state.seen.has(event)) return;
    state.seen.add(event);
    const key = `${state.route}|${state.traffic}|${event}`;
    totals.set(key, (totals.get(key) || 0) + 1);
    pending.set(key, (pending.get(key) || 0) + 1);
  }
  function rows(map) {
    return [...map].map(([key, count]) => {
      const [route, traffic, event] = key.split('|');
      return { route, traffic, event, count };
    });
  }
  function flush() {
    if (!pending.size) return;
    log(JSON.stringify({ type: 'seller_funnel', at: new Date().toISOString(), counts: rows(pending) }));
    pending.clear();
  }
  const timer = setInterval(flush, intervalMs);
  timer.unref();

  return {
    middleware(req, res, next) {
      const route = `${req.method} ${req.path}`;
      if (!allowed.has(route)) return next();
      // Self-declared diagnostics are not authenticated attribution. Everything
      // else stays unclassified: crawlers and repeat calls are not unique buyers.
      const diagnostic = /^INCOME2-Operator-Audit\//.test(req.get('user-agent') || '');
      const state = { route, traffic: diagnostic ? 'diagnostic' : 'unclassified', seen: new Set() };
      context.run(state, () => {
        record('request_received');
        const attempted = Boolean(req.get('payment-signature') || req.get('x-payment'));
        if (attempted) record('payment_header_present');
        res.once('finish', () => {
          if (res.statusCode === 402 && !attempted && res.getHeader('payment-required')) record('unpaid_challenge', state);
          if (res.statusCode >= 400 && attempted) record('paid_request_failed', state);
          if (res.statusCode >= 200 && res.statusCode < 300 && state.seen.has('payment_verified') && state.seen.has('settlement_success')) record('fulfillment_success', state);
        });
        next();
      });
    },
    attach(resourceServer) {
      resourceServer.onBeforeVerify(async () => { record('payment_attempt_observed'); });
      resourceServer.onAfterVerify(async ctx => { if (ctx.result?.isValid) record('payment_verified'); });
      resourceServer.onAfterSettle(async ctx => { if (ctx.result?.success) record('settlement_success'); });
    },
    snapshot() {
      return { since, scope: 'current_process', attribution: 'request_counts_not_unique_buyers_or_verified_revenue', counts: rows(totals) };
    },
    close() { clearInterval(timer); flush(); },
  };
}

module.exports = { createSellerFunnel };
