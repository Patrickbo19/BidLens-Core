const ENABLED = String(process.env.PAYANAGENT_READINESS_ON_START || '') === '1' || String(process.env.PAYANAGENT_READINESS_ON_START || '').toLowerCase() === 'true';
const OFFER_ID = 'kh7aj3snq4swt9wp7qez45fv718e3mqy';

async function probe() {
  if (!ENABLED || !/seller-backend\.js$/.test(String(process.argv[1] || ''))) return;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const response = await fetch(`https://payanagent.com/x402/${OFFER_ID}`, {
      method:'POST',
      signal:ctl.signal,
      headers:{ 'content-type':'application/json', accept:'application/json', 'user-agent':'INCOME2-PayanAgent-Readiness/1.0' },
      body:JSON.stringify({ url:'https://example.com', max_chars:60000, include_links:true }),
    });
    const paymentRequired = response.headers.get('payment-required');
    let challenge = null;
    if (paymentRequired) {
      try { challenge = JSON.parse(Buffer.from(paymentRequired, 'base64').toString('utf8')); } catch {}
    }
    const first = Array.isArray(challenge?.accepts) ? challenge.accepts[0] : null;
    console.log(JSON.stringify({
      type:'payanagent_relay_readiness',
      ok:response.status === 402 && Boolean(paymentRequired),
      offerId:OFFER_ID,
      httpStatus:response.status,
      paymentRequiredHeader:Boolean(paymentRequired),
      x402Version:challenge?.x402Version || null,
      network:first?.network || null,
      asset:first?.asset || null,
      payTo:first?.payTo || null,
      amountAtomic:first?.amount || first?.maxAmountRequired || null,
      paymentSigned:false,
      ownerFundsSpentUsd:0,
      at:new Date().toISOString(),
    }));
  } catch (error) {
    console.error(JSON.stringify({
      type:'payanagent_relay_readiness_error',
      offerId:OFFER_ID,
      error:String(error?.message || error).slice(0, 400),
      paymentSigned:false,
      ownerFundsSpentUsd:0,
      at:new Date().toISOString(),
    }));
  } finally {
    clearTimeout(timer);
  }
}

setTimeout(probe, 10000).unref();
