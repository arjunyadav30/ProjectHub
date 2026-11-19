const http = require('http');
const https = require('https');
const { parsePublicHttpUrl, safeLookup } = require('./urlSafety');

const MAX_REDIRECTS = 3;

const requestOnce = (url, { timeoutMs, lookup }) => new Promise((resolve, reject) => {
  const lib = url.protocol === 'https:' ? https : http;
  const started = Date.now();
  const req = lib.request(url, {
    method: 'GET',
    lookup,
    timeout: timeoutMs,
    headers: { 'User-Agent': 'ProjectHub-HealthMonitor/1.0', Accept: '*/*' },
  }, (res) => {
    const result = { status: res.statusCode, location: res.headers.location, ms: Date.now() - started };
    res.destroy(); // we only need the headers
    resolve(result);
  });
  req.on('timeout', () => req.destroy(new Error('Timed out')));
  req.on('error', reject);
  req.end();
});

/**
 * Checks a public URL. Returns { status: 'up'|'slow'|'down', ok, http_status, response_ms, error }.
 * SSRF-safe: scheme/host validated, private IPs rejected at connect time, redirects re-validated.
 */
const checkUrl = async (rawUrl, { timeoutMs = 10000, slowMs = 3000, lookup = safeLookup } = {}) => {
  const begin = Date.now();
  try {
    let url = parsePublicHttpUrl(rawUrl);
    let last;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      last = await requestOnce(url, { timeoutMs, lookup });
      if (last.status >= 300 && last.status < 400 && last.location) {
        url = parsePublicHttpUrl(new URL(last.location, url).toString());
        continue;
      }
      break;
    }
    const total = Date.now() - begin;
    const reachable = last.status < 400 || last.status === 401 || last.status === 403;
    if (!reachable) return { status: 'down', ok: false, http_status: last.status, response_ms: total, error: `HTTP ${last.status}` };
    return { status: total > slowMs ? 'slow' : 'up', ok: true, http_status: last.status, response_ms: total, error: '' };
  } catch (e) {
    return { status: 'down', ok: false, http_status: 0, response_ms: Date.now() - begin, error: e.message || 'Request failed' };
  }
};

module.exports = { checkUrl };
