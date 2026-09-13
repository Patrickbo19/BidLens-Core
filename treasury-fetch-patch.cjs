// Transport shim for the standalone INCOME 2 Public Data service.
// It keeps slow official public-data sources bounded and normalizes one
// USAspending API constraint without introducing any third-party proxy.
const nativeFetch = global.fetch;

if (typeof nativeFetch === 'function') {
  async function withTimeout(url, init = {}, timeoutMs = 30000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const { signal: _ignoredSignal, ...rest } = init || {};
      return await nativeFetch(url, { ...rest, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  global.fetch = async function income2PublicDataFetch(input, init = {}) {
    let url = String(input);

    // Treasury's full-year XML feed can be slow from cloud hosts. Limit the
    // official request to the current month and allow a bounded 30 seconds.
    if (url.startsWith('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?') && url.includes('data=daily_treasury_yield_curve')) {
      const now = new Date();
      const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const parsed = new URL(url);
      parsed.searchParams.delete('field_tdr_date_value');
      parsed.searchParams.set('field_tdr_date_value_month', month);
      return withTimeout(parsed.toString(), init, 30000);
    }

    // FiscalData occasionally responds slowly from Render. Narrow Debt to the
    // Penny to the fields we actually sell and allow a bounded 35 seconds.
    if (url.startsWith('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny')) {
      const parsed = new URL(url);
      if (!parsed.searchParams.has('fields')) {
        parsed.searchParams.set('fields', 'record_date,debt_held_public_amt,intragov_hold_amt,tot_pub_debt_out_amt');
      }
      return withTimeout(parsed.toString(), init, 35000);
    }

    // USAspending rejects a single search that mixes contract and grant award
    // type groups. When our public-data route asks for "all", split that one
    // logical query into two official API calls, then merge/sort the results.
    if (url === 'https://api.usaspending.gov/api/v2/search/spending_by_award/' && String(init?.method || 'GET').toUpperCase() === 'POST' && init?.body) {
      try {
        const payload = JSON.parse(String(init.body));
        const codes = payload?.filters?.award_type_codes;
        const hasContract = Array.isArray(codes) && codes.some(code => ['A','B','C','D'].includes(code));
        const hasGrant = Array.isArray(codes) && codes.some(code => ['02','03','04','05'].includes(code));
        if (hasContract && hasGrant) {
          const limit = Math.max(1, Math.min(50, Number(payload.limit) || 20));
          const makePayload = award_type_codes => ({
            ...payload,
            limit,
            filters: { ...payload.filters, award_type_codes },
          });
          const [contractsResponse, grantsResponse] = await Promise.all([
            withTimeout(url, { ...init, body: JSON.stringify(makePayload(['A','B','C','D'])) }, 30000),
            withTimeout(url, { ...init, body: JSON.stringify(makePayload(['02','03','04','05'])) }, 30000),
          ]);
          const [contractsText, grantsText] = await Promise.all([contractsResponse.text(), grantsResponse.text()]);
          if (!contractsResponse.ok) return new Response(contractsText, { status: contractsResponse.status, headers: { 'content-type': 'application/json' } });
          if (!grantsResponse.ok) return new Response(grantsText, { status: grantsResponse.status, headers: { 'content-type': 'application/json' } });
          const contracts = JSON.parse(contractsText);
          const grants = JSON.parse(grantsText);
          const results = [...(contracts.results || []), ...(grants.results || [])]
            .sort((a, b) => Number(b['Award Amount'] || 0) - Number(a['Award Amount'] || 0))
            .slice(0, limit);
          const body = JSON.stringify({
            ...contracts,
            results,
            page_metadata: {
              ...(contracts.page_metadata || {}),
              total: Number(contracts?.page_metadata?.total || 0) + Number(grants?.page_metadata?.total || 0),
              hasNext: Boolean(contracts?.page_metadata?.hasNext || grants?.page_metadata?.hasNext),
            },
          });
          return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
        }
      } catch {
        // Fall through to the official call so the application receives the
        // upstream error rather than hiding malformed input.
      }
    }

    return nativeFetch(input, init);
  };
}
