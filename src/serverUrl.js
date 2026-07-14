export function getServerHttpUrl(pathname, options = {}) {
  const location = options.location ?? window.location;
  const configuredOrigin = options.serverOrigin
    ?? globalThis.TAP_TAP_SHOOT_SERVER_ORIGIN
    ?? '';

  if (configuredOrigin.trim()) {
    return new URL(pathname, ensureTrailingSlash(configuredOrigin.trim())).toString();
  }

  if (location.protocol === 'file:') {
    return new URL(pathname, 'http://localhost:8787').toString();
  }

  return new URL(pathname, location.origin).toString();
}

export function getServerSocketUrl(pathname = '/ws', options = {}) {
  const url = new URL(getServerHttpUrl(pathname, options));
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}
