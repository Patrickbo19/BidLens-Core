const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');

// All facilitator responses and extraction content in this test are local
// fixtures. No real signature, transfer, external request, or durable ledger.
test('canonical extraction alias keeps payment protection, fulfillment and private aggregate telemetry', async () => {
  const port = await new Promise(resolve => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
  const payTo = `0x${'2'.repeat(40)}`;
  const prelude = `
    require('node:dns').promises.lookup = async host => [{address:require('node:net').isIP(host) ? host : '93.184.215.14',family:4}];
    global.fetch = async (url, options = {}) => {
      const target = String(url);
      const json = value => new Response(JSON.stringify(value), {headers:{'content-type':'application/json'}});
      if (target === 'https://facilitator.payai.network/supported') return json({kinds:[{x402Version:2,scheme:'exact',network:'eip155:8453'}],extensions:[],signers:{}});
      if (target === 'https://facilitator.payai.network/verify') return json({isValid:true,payer:'0x'+'1'.repeat(40)});
      if (target === 'https://facilitator.payai.network/settle') {
        const body = JSON.parse(options.body);
        if (body.paymentPayload.payload.testFailure) return json({success:false,errorReason:'fixture_failure',transaction:'',network:'eip155:8453'});
        return json({success:true,transaction:'local-fixture-only',network:'eip155:8453',payer:'0x'+'1'.repeat(40)});
      }
      if (target === 'https://example.com/') return new Response('<html><title>Fixture</title><main><h1>Hello</h1><p>Useful article.</p><a href="/more">More</a></main></html>', {headers:{'content-type':'text/html'}});
      throw new Error('External network blocked by local test fixture');
    };
    require('./discovery-truth.cjs');
    require('./seller-v2.js');
  `;
  const child = spawn(process.execPath, ['-e', prelude], {
    cwd: path.resolve(__dirname, '..'),
    env: { PATH: process.env.PATH, PORT: String(port), EARN_RECEIVE_ADDRESS: payTo, PUBLIC_ORIGIN: `http://127.0.0.1:${port}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', b => { logs += b; });
  child.stderr.on('data', b => { logs += b; });
  const base = `http://127.0.0.1:${port}`;
  const auditHeaders = {'content-type':'application/json','user-agent':'INCOME2-Operator-Audit/1.0'};
  try {
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(logs);
      try { if ((await fetch(`${base}/health`)).ok) break; } catch {}
      await new Promise(r => setTimeout(r, 50));
    }
    const manifest = await (await fetch(`${base}/.well-known/x402`)).json();
    const openapi = await (await fetch(`${base}/openapi.json`)).json();
    assert.equal(manifest.resources.length, 14);
    const routes = ['/url-to-clean-markdown', '/web-extract'];
    const challenges = [];
    for (const route of routes) {
      assert.ok(manifest.resources.some(r => r.resource === `POST ${route}`));
      assert.ok(openapi.paths[route].post.requestBody.content['application/json'].schema.required.includes('url'));
      const res = await fetch(base+route, {method:'POST',headers:auditHeaders,body:JSON.stringify({url:'https://example.com/'})});
      assert.equal(res.status, 402);
      const challenge = JSON.parse(Buffer.from(res.headers.get('payment-required'), 'base64').toString());
      assert.equal(challenge.x402Version, 2);
      assert.equal(challenge.accepts[0].amount, '1000');
      assert.equal(challenge.accepts[0].payTo, payTo);
      assert.equal(challenge.accepts[0].network, 'eip155:8453');
      assert.equal(challenge.resource.url, base+route);
      assert.ok(challenge.extensions.bazaar);
      challenges.push(challenge);
    }
    const proof = (challenge, testFailure = false) => Buffer.from(JSON.stringify({
      x402Version:2, resource:challenge.resource, accepted:challenge.accepts[0],
      payload:{signature:'local-test-only-not-a-valid-signature', testFailure},
    })).toString('base64');
    const results = [];
    for (const [i, route] of routes.entries()) {
      const headers = {...auditHeaders, 'payment-signature':proof(challenges[i])};
      const res = await fetch(base+route, {method:'POST',headers,body:JSON.stringify({url:'https://example.com/'})});
      assert.equal(res.status, 200, await res.clone().text());
      assert.ok(res.headers.get('payment-response'));
      const data = await res.json();
      assert.equal(data.result.untrustedContent, true);
      assert.equal(data.result.title, 'Fixture');
      results.push(data.result.markdown);
      const privateTarget = await fetch(base+route, {method:'POST',headers,body:JSON.stringify({url:'http://127.0.0.1/private-payload-marker'})});
      assert.equal(privateTarget.status, 422, await privateTarget.text());
    }
    assert.equal(results[0], results[1]);
    const failed = await fetch(base+routes[0], {method:'POST',headers:{...auditHeaders,'payment-signature':proof(challenges[0],true)},body:JSON.stringify({url:'https://example.com/'})});
    assert.equal(failed.status, 402);
    const health = await (await fetch(`${base}/health`)).json();
    assert.equal(health.primaryRevenueRoute, routes[0]);
    assert.equal(health.paidCapabilityCount, 13);
    const count = event => health.funnel.counts.filter(x=>x.event===event).reduce((sum,x)=>sum+x.count,0);
    assert.equal(count('unpaid_challenge'), 2);
    assert.equal(count('payment_header_present'), 5);
    assert.equal(count('payment_attempt_observed'), 3);
    assert.equal(count('payment_verified'), 3);
    assert.equal(count('settlement_success'), 2);
    assert.equal(count('fulfillment_success'), 2);
    assert.equal(count('paid_request_failed'), 3);
    assert.ok(health.funnel.counts.every(x=>x.traffic==='diagnostic'));
    const analytics = JSON.stringify(health.funnel);
    for (const marker of ['private-payload-marker','example.com','local-test-only','127.0.0.1',payTo]) assert.ok(!analytics.includes(marker));
    const other = await fetch(base+'/web-extract', {method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    assert.equal(other.status, 402);
    const after = await (await fetch(`${base}/health`)).json();
    assert.ok(after.funnel.counts.some(x=>x.traffic==='unclassified' && x.event==='unpaid_challenge' && x.count===1));
  } finally {
    child.kill();
    await new Promise(resolve => child.once('exit', resolve));
  }
});
