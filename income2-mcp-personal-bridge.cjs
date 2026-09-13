'use strict';

const TARGET = 'https://earn-tools-backend.onrender.com/health';
const originalFetch = globalThis.fetch;

if (typeof originalFetch === 'function' && !globalThis.__income2McpPersonalBridge) {
  globalThis.__income2McpPersonalBridge = true;
  globalThis.fetch = async function income2McpFetch(input, init) {
    const url = typeof input === 'string' ? input : input?.url;
    const response = await originalFetch(input, init);
    if (String(url || '') !== TARGET) return response;
    try {
      const text = await response.clone().text();
      const data = JSON.parse(text);
      const patched = {
        ...data,
        economics: {
          ...(data.economics || {}),
          userSharePercent: 70,
          platformSharePercent: 30,
          scope: 'income2_personal_agent_new_external_revenue',
          privateEarnExcluded: true,
        },
      };
      return new Response(JSON.stringify(patched), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch {
      return response;
    }
  };
}
