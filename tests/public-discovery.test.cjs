const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

test('public discovery exposes A2A, ARD and a read-only capability match', async () => {
  const port = await new Promise(resolve => {
    const socket = net.createServer().listen(0, '127.0.0.1', () => {
      const value = socket.address().port;
      socket.close(() => resolve(value));
    });
  });
  const child = spawn(process.execPath, ['-e', `require('./income2-public-discovery-preload.cjs');require('http').createServer((_q,r)=>{r.writeHead(404);r.end()}).listen(${port},'127.0.0.1')`], {
    cwd:path.resolve(__dirname, '..'),
    stdio:['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', value => { logs += value; });
  child.stderr.on('data', value => { logs += value; });
  const origin = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(logs);
      try { if ((await fetch(`${origin}/magnet`)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    const card = await (await fetch(`${origin}/.well-known/agent-card.json`)).json();
    assert.equal(card.name, 'INCOME 2');
    assert.equal(card.supportedInterfaces[0].protocolVersion, '1.0');
    const ard = await (await fetch(`${origin}/.well-known/ard.json`)).json();
    assert.ok(ard.entries.some(entry => entry.type === 'application/a2a-agent-card+json'));
    const match = await (await fetch(`${origin}/magnet/match`, {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({capabilities:['research', 'code']}),
    })).json();
    assert.deepEqual(match.capabilities, ['research', 'code']);
    assert.ok(match.matches.some(item => item.id === 'research-and-discovery'));
    const a2a = await (await fetch(`${origin}/a2a`, {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({jsonrpc:'2.0', id:'test-1', method:'SendMessage', params:{message:{parts:[{text:'research code'}]}}}),
    })).json();
    assert.equal(a2a.id, 'test-1');
    assert.match(a2a.result.message.parts[0].text, /research-and-discovery/);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await exited;
    }
  }
});
