const net = require('net');
const dns = require('dns');
const { URL } = require('url');

/** True if the IP is not a public, routable address. */
const isPrivateIp = (ip) => {
  const family = net.isIP(ip);
  if (family === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (family === 6) {
    const v = ip.toLowerCase();
    if (v === '::' || v === '::1') return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff');
  }
  return true; // not an IP -> refuse
};

/** Validates scheme/credentials/host syntax only (no DNS). Returns a URL object or throws. */
const parsePublicHttpUrl = (raw) => {
  let u;
  try { u = new URL(String(raw).trim()); } catch { throw new Error('Invalid URL'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http/https URLs are allowed');
  if (u.username || u.password) throw new Error('URLs with credentials are not allowed');
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Local addresses are not allowed');
  }
  if (net.isIP(host) && isPrivateIp(host.replace(/^\[|\]$/g, ''))) throw new Error('Private addresses are not allowed');
  return u;
};

/** dns.lookup replacement that rejects private addresses at connect time (blocks DNS rebinding). */
const safeLookup = (hostname, options, callback) => {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err);
    const list = Array.isArray(address) ? address : [{ address, family }];
    if (list.some((a) => isPrivateIp(a.address))) return callback(new Error('Resolved to a private address'));
    return callback(null, address, family);
  });
};

module.exports = { isPrivateIp, parsePublicHttpUrl, safeLookup };
