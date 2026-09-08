const origin = String(process.env.PUBLIC_ORIGIN || '').replace(/\/$/, '');
const isSellerProcess = String(process.argv[1] || '').endsWith('seller-backend.js');
const registerOnBoot = String(process.env.EARN_DIRECTORY_REGISTER_ON_BOOT || '') === '1';

function decodeB64Json(value) {
  if (!value) return null;
  try {
    const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
    return JSON.parse(Buffer.from(normalized + pad, 'base64').toString('utf8'));
  } catch { return null; }
}

async function verifyChallenge() {
  try {
    const target = `${origin}/seller-status`;
    const r = await fetch(target, { method: 'GET', redirect: 'manual' });
    const raw = r.headers.get('payment-required') || r.headers.get('x-payment-required');
    const decoded = decodeB64Json(raw);
    console.log(JSON.stringify({
      type: 'earn_live_402_challenge',
      status: r.status,
      target,
      hasPaymentRequiredHeader: Boolean(raw),
      decoded,
      at: new Date().toISOString(),
    }));
  } catch (e) {
    console.error(JSON.stringify({
      type: 'earn_live_402_challenge_failed',
      origin,
      error: String(e.message || e).slice(0, 500),
      at: new Date().toISOString(),
    }));
  }
}

async function registerAgent402() {
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
}

if (isSellerProcess && origin) {
  setTimeout(async () => {
    if (registerOnBoot) await registerAgent402();
    else console.log(JSON.stringify({ type:'agent402_registration_skipped', reason:'registration_on_boot_disabled', at:new Date().toISOString() }));
    await verifyChallenge();
  }, 12000).unref();
}
