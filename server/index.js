import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { extname, join, normalize, sep } from 'node:path';
import { readFile } from 'node:fs/promises';

import { FallbackPlayerStore, JsonPlayerStore, SupabasePlayerStore } from './playerStore.js';
import { RankedDuelService } from './rankedDuel.js';
import { attachWebSocketServer } from './webSocket.js';
import { createGuestTokenServiceFromEnv } from './guestToken.js';
import { NullAnalyticsStore, SupabaseAnalyticsStore } from './analyticsStore.js';

const DEFAULT_ROOT = process.cwd();
const PUBLIC_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.mp3', 'audio/mpeg'],
  ['.png', 'image/png'],
  ['.ttf', 'font/ttf'],
]);
const PUBLIC_PREFIXES = Object.freeze(['assets/', 'src/']);
const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'SAMEORIGIN',
});

export function createTapTapShootServer({
  env = process.env,
  root = DEFAULT_ROOT,
  playerStore = createPlayerStore({ env, root }),
  analyticsStore = createAnalyticsStore({ env }),
  rankedDuel = new RankedDuelService({
    playerStore,
    analyticsStore,
    allowDebugWinGame: getAllowDebugWinGame(env),
    onError(error) {
      console.error('Ranked service failed:', getErrorMessage(error));
    },
  }),
  guestTokens = createGuestTokenServiceFromEnv(env),
} = {}) {
  const server = createServer(createStaticRequestHandler({ root, rankedDuel }));

  attachWebSocketServer(server, {
    path: '/ws',
    maxConnections: readPositiveNumber(env.WS_MAX_CONNECTIONS, 2000),
    maxMessageBytes: readPositiveNumber(env.WS_MAX_MESSAGE_BYTES, 16 * 1024),
    maxBufferedBytes: readPositiveNumber(env.WS_MAX_BUFFERED_BYTES, 256 * 1024),
    heartbeatMs: readPositiveNumber(env.WS_HEARTBEAT_MS, 30 * 1000),
    maxConnectionsPerIp: readPositiveNumber(env.WS_MAX_CONNECTIONS_PER_IP, 25),
    maxConnectionsPerMinute: readPositiveNumber(env.WS_CONNECTIONS_PER_MINUTE, 30),
    maxMessagesPerSecond: readPositiveNumber(env.WS_MESSAGES_PER_SECOND, 20),
    trustProxy: env.NODE_ENV === 'production',
    originMode: env.WS_ORIGIN_MODE ?? (env.NODE_ENV === 'production' ? 'report' : 'off'),
    allowedOrigins: readAllowedOrigins(env.WS_ALLOWED_ORIGINS),
    originSummaryMs: readPositiveNumber(env.WS_ORIGIN_SUMMARY_MS, 5 * 60 * 1000),
    onConnection(connection) {
      attachRankedConnection(connection, { rankedDuel, guestTokens });
    },
  });

  return { server, rankedDuel };
}

export function createAnalyticsStore({ env = process.env } = {}) {
  const url = env.SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  return url && secretKey ? new SupabaseAnalyticsStore({ url, secretKey }) : new NullAnalyticsStore();
}

export function attachRankedConnection(connection, { rankedDuel, guestTokens, authenticationMs = 10_000 }) {
  let session = null;
  let authenticating = false;
  const authenticationTimer = setTimeout(() => connection.close(), authenticationMs);
  authenticationTimer.unref?.();

  connection.onMessage(async (raw) => {
    try {
      const message = JSON.parse(raw);

      if (!session) {
        if (authenticating || message?.type !== 'authenticateGuest') {
          return;
        }
        authenticating = true;
        const identity = guestTokens.authenticate(message.token);
        session = await rankedDuel.connect(connection, identity.playerId, identity.token);
        clearTimeout(authenticationTimer);
        return;
      }

      await rankedDuel.receive(session, message);
    } catch (error) {
      console.error('Ranked message failed:', getErrorMessage(error));
      const authenticationFailed = !session && authenticating;
      connection.send(JSON.stringify({
        type: 'error',
        code: authenticationFailed ? 'ranked_unavailable' : 'server_error',
        message: authenticationFailed ? 'ranked service temporarily unavailable' : 'server error',
      }));
      connection.close(authenticationFailed ? 1013 : 1011, authenticationFailed ? 'try again later' : 'server error');
    }
  });
  connection.onClose(() => {
    clearTimeout(authenticationTimer);
    if (session) {
      rankedDuel.disconnect(session);
    }
  });
}

export function getAllowDebugWinGame(env = process.env) {
  const enabled = env.ALLOW_DEBUG_WIN_GAME === 'true';

  if (enabled && env.NODE_ENV === 'production') {
    throw new Error('ALLOW_DEBUG_WIN_GAME cannot be enabled in production');
  }

  return enabled;
}

export function createPlayerStore({ env = process.env, root = DEFAULT_ROOT } = {}) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseSecretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  const localStore = new JsonPlayerStore(join(root, '.ranked-players.json'));

  if (env.NODE_ENV === 'production' && (!supabaseUrl || !supabaseSecretKey)) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required in production');
  }

  if (env.NODE_ENV === 'production') {
    return new SupabasePlayerStore({
      url: supabaseUrl,
      secretKey: supabaseSecretKey,
    });
  }

  return supabaseUrl && supabaseSecretKey
    ? new FallbackPlayerStore(new SupabasePlayerStore({
      url: supabaseUrl,
      secretKey: supabaseSecretKey,
    }), localStore, {
      onError(error) {
        console.warn('Supabase player store failed; using local ranked player store:', getErrorMessage(error));
      },
    })
    : localStore;
}

export function createStaticRequestHandler({ root = DEFAULT_ROOT, rankedDuel } = {}) {
  return async function handleStaticRequest(request, response) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end();
      return;
    }

    let url;

    try {
      url = new URL(request.url, 'http://localhost');
    } catch {
      response.writeHead(400).end('Bad request');
      return;
    }

    if (url.pathname === '/api/ranked-status') {
      writeJson(response, {
        playersOnline: rankedDuel.getOnlinePlayerCount(),
      });
      return;
    }

    if (url.pathname === '/api/debug-tools') {
      writeJson(response, {
        winGame: Boolean(rankedDuel.allowDebugWinGame),
        revealComputerMove: Boolean(rankedDuel.allowDebugWinGame),
        sceneGallery: Boolean(rankedDuel.allowDebugWinGame),
      });
      return;
    }

    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = getSafePublicPath(root, pathname);

    if (!filePath) {
      response.writeHead(404).end('Not found');
      return;
    }

    try {
      const body = await readFile(filePath);
      response.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': PUBLIC_TYPES.get(extname(filePath)) ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });

      if (request.method === 'HEAD') {
        response.end();
      } else {
        response.end(body);
      }
    } catch {
      response.writeHead(404).end('Not found');
    }
  };
}

function writeJson(response, payload) {
  response.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  response.end(JSON.stringify(payload));
}

function getSafePublicPath(root, pathname) {
  let decoded;

  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const normalized = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const publicPath = normalized.replace(/^[/\\]+/, '').split(sep).join('/');

  if (!isPublicPath(publicPath)) {
    return null;
  }

  const filePath = join(root, publicPath);
  return filePath.startsWith(`${root}${sep}`) ? filePath : null;
}

function isPublicPath(publicPath) {
  if (publicPath.split('/').some((part) => part.startsWith('.'))) {
    return false;
  }

  return publicPath === 'index.html'
    || publicPath === 'server-config.js'
    || publicPath === 'new_layout.json'
    || PUBLIC_PREFIXES.some((prefix) => publicPath.startsWith(prefix));
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return JSON.stringify(error);
}

function readPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readAllowedOrigins(value) {
  const defaults = [
    'https://tap-tap-shoot.onrender.com',
    'https://html-classic.itch.zone',
  ];
  const origins = typeof value === 'string' && value.trim()
    ? value.split(',')
    : defaults;

  return origins.map((origin) => origin.trim()).filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 8787);
  const { server } = createTapTapShootServer();

  server.listen(port, () => {
    console.log(`Tap Tap Shoot server listening on http://localhost:${port}`);
  });
}
