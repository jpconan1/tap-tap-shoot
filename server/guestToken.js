import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createGuestTokenService({
  secret,
  tokenLifetimeMs = DEFAULT_TOKEN_LIFETIME_MS,
  now = () => Date.now(),
  createId = randomUUID,
} = {}) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('GUEST_TOKEN_SECRET must be at least 32 characters');
  }

  function issue(playerId = createId()) {
    const payload = Buffer.from(JSON.stringify({
      v: 1,
      playerId,
      expiresAt: now() + tokenLifetimeMs,
    })).toString('base64url');
    const signature = sign(payload, secret);
    return {
      playerId,
      token: `${payload}.${signature}`,
    };
  }

  function verify(token) {
    if (typeof token !== 'string' || token.length > 2048) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return null;
    }

    const [payload, receivedSignature] = parts;
    const expectedSignature = sign(payload, secret);
    const receivedBytes = Buffer.from(receivedSignature, 'base64url');
    const expectedBytes = Buffer.from(expectedSignature, 'base64url');

    if (
      receivedBytes.length !== expectedBytes.length
      || !timingSafeEqual(receivedBytes, expectedBytes)
    ) {
      return null;
    }

    try {
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (
        claims.v !== 1
        || typeof claims.playerId !== 'string'
        || !UUID_PATTERN.test(claims.playerId)
        || !Number.isFinite(claims.expiresAt)
        || claims.expiresAt <= now()
      ) {
        return null;
      }
      return claims;
    } catch {
      return null;
    }
  }

  function authenticate(token) {
    const claims = verify(token);
    return issue(claims?.playerId);
  }

  return { authenticate, issue, verify };
}

export function createGuestTokenServiceFromEnv(env = process.env) {
  let secret = env.GUEST_TOKEN_SECRET;

  if (!secret && env.NODE_ENV === 'production') {
    throw new Error('GUEST_TOKEN_SECRET is required in production');
  }

  if (!secret) {
    secret = randomBytes(32).toString('base64url');
  }

  return createGuestTokenService({ secret });
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}
