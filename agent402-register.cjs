const origin = String(process.env.PUBLIC_ORIGIN || '').replace(/\/$/, '');
const isSellerProcess = String(process.argv[1] || '').endsWith('seller-backend.js');

if (isSellerProcess && origin) {
  setTimeout(async () => {
    try {
      const r = await fetch('https://agent402.tools/api/index/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ origin }),
      });
      const text = await r.text();
      console.log(JSON.stringify({
        type: 'agent402_registration',
        ok: r.ok,
        status: r.status,
        origin,
        response: text.slice(0, 1500),
        at: new Date().toISOString(),
      }));
    } catch (e) {
      console.error(JSON.stringify({
        type: 'agent402_registration_failed',
        origin,
        error: String(e.message || e).slice(0, 500),
        at: new Date().toISOString(),
      }));
    }
  }, 12000);
}
