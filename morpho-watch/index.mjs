import http from 'node:http';

const PORT = Number(process.env.PORT || 10000);
const API = 'https://api.morpho.org/graphql';
const QUERY = `
query MarketPositions($chainIds: [Int!], $hfLte: Float!, $first: Int!, $skip: Int!) {
  marketPositions(
    where: { chainId_in: $chainIds, healthFactor_lte: $hfLte, marketListed: true }
    orderBy: HealthFactor
    orderDirection: Asc
    first: $first
    skip: $skip
  ) {
    pageInfo { count countTotal }
    items { market { marketId } user { address } }
  }
}`;

let state = {
  service: 'base-morpho-watch',
  chainId: 8453,
  updatedAt: null,
  error: null,
  liquidatableCount: null,
  liquidatable: []
};

async function poll() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'base-morpho-watch/1.0'
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { chainIds: [8453], hfLte: 1.0, first: 100, skip: 0 }
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!response.ok) throw new Error(`Morpho API HTTP ${response.status}`);
    const body = await response.json();
    if (body.errors?.length) throw new Error(body.errors[0].message || 'GraphQL error');
    const mp = body?.data?.marketPositions;
    if (!mp || !Array.isArray(mp.items)) throw new Error('Unexpected API response');

    state = {
      service: 'base-morpho-watch',
      chainId: 8453,
      updatedAt: new Date().toISOString(),
      error: null,
      liquidatableCount: mp.pageInfo?.countTotal ?? mp.items.length,
      liquidatable: mp.items
    };

    console.log(JSON.stringify({
      event: 'poll',
      updatedAt: state.updatedAt,
      liquidatableCount: state.liquidatableCount
    }));
  } catch (err) {
    state = {
      ...state,
      updatedAt: new Date().toISOString(),
      error: String(err?.message || err)
    };
    console.error(JSON.stringify({
      event: 'poll_error',
      updatedAt: state.updatedAt,
      error: state.error
    }));
  }
}

http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  if (req.url === '/health') {
    res.end(JSON.stringify({
      ok: !state.error,
      updatedAt: state.updatedAt,
      error: state.error
    }));
    return;
  }
  res.end(JSON.stringify(state));
}).listen(PORT, '0.0.0.0', () => {
  console.log(`base-morpho-watch listening on ${PORT}`);
  poll();
  setInterval(poll, 60000);
});
