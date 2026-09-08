const baseFetch = global.fetch;
global.fetch = async (url, options = {}) => {
  if (String(url) === 'https://market402.com/submit' && options.body) {
    try {
      const payload = JSON.parse(options.body);
      if (payload.url && !payload.resource) {
        payload.resource = payload.url;
        delete payload.url;
        options = { ...options, body: JSON.stringify(payload) };
      }
    } catch {}
  }
  return baseFetch(url, options);
};
require('./seller-v2.js');
