// URL validation and SSRF protection.
// Every URL (the initial one and every redirect / sub-request) must pass assertSafeUrl().
const dns = require('node:dns').promises;
const net = require('node:net');

// Error carrying an HTTP-like status so callers can map it (400 = blocked/invalid).
class UrlError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

// IPv4 ranges to block, as [network, prefixLength].
const BLOCKED_V4 = [
  ['0.0.0.0', 8],       // "this" network
  ['10.0.0.0', 8],      // private
  ['100.64.0.0', 10],   // carrier-grade NAT
  ['127.0.0.0', 8],     // loopback
  ['169.254.0.0', 16],  // link-local + cloud metadata (169.254.169.254)
  ['172.16.0.0', 12],   // private
  ['192.168.0.0', 16],  // private
];

function v4ToInt(ip) {
  return ip.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

function isBlockedV4(ip) {
  const n = v4ToInt(ip);
  return BLOCKED_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (v4ToInt(base) & mask);
  });
}

function isBlockedV6(ip) {
  const a = ip.toLowerCase();
  if (a === '::1' || a === '::') return true;
  // IPv4-mapped (::ffff:1.2.3.4 or ::ffff:7f00:1) -> check the embedded IPv4 address.
  const mapped = a.match(/^::ffff:(.+)$/);
  if (mapped) {
    const rest = mapped[1];
    if (net.isIPv4(rest)) return isBlockedV4(rest);
    const hex = rest.split(':');
    if (hex.length === 2) {
      const n = (parseInt(hex[0], 16) << 16) | parseInt(hex[1], 16);
      return isBlockedV4([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'));
    }
    return true;
  }
  const first = parseInt(a.split(':')[0] || '0', 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  return false;
}

function isBlockedIp(ip) {
  if (net.isIPv4(ip)) return isBlockedV4(ip);
  if (net.isIPv6(ip)) return isBlockedV6(ip);
  return true; // not an IP at all: block
}

// Throws UrlError unless `raw` is a public http(s) URL. Returns the parsed URL.
async function assertSafeUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlError('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlError('Only http and https URLs are allowed');
  }

  // URL() keeps brackets around IPv6 hosts and may leave a trailing dot.
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost')) {
    throw new UrlError('Blocked host');
  }

  // Literal IP: check directly. Hostname: resolve and check every address.
  let addresses;
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await dns.lookup(host, { all: true })).map((r) => r.address);
    } catch {
      throw new UrlError('Host could not be resolved');
    }
  }
  if (addresses.length === 0 || addresses.some(isBlockedIp)) {
    throw new UrlError('Blocked address');
  }
  return url;
}

module.exports = { assertSafeUrl, isBlockedIp, UrlError };
