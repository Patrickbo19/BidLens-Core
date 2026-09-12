// Narrow transport shim for the standalone INCOME 2 Treasury service.
// Treasury's full-year XML feed can be slow from cloud hosts. Limit the
// official feed request to the current month and give it a bounded 30 seconds.
// No third-party data source or proxy is introduced.
const nativeFetch = global.fetch;
if (typeof nativeFetch === 'function') {
  global.fetch = async function income2TreasuryFetch(input, init = {}) {
    let url = String(input);
    if (url.startsWith('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?') && url.includes('data=daily_treasury_yield_curve')) {
      const now = new Date();
      const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const parsed = new URL(url);
      parsed.searchParams.delete('field_tdr_date_value');
      parsed.searchParams.set('field_tdr_date_value_month', month);
      url = parsed.toString();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        return await nativeFetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    }
    return nativeFetch(input, init);
  };
}
