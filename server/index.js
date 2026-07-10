import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { extname, join, normalize, sep } from 'node:path';
import { readFile } from 'node:fs/promises';

import { FallbackPlayerStore, JsonPlayerStore, SupabasePlayerStore } from './playerStore.js';
import { RankedDuelService } from './rankedDuel.js';
import { attachWebSocketServer } from './webSocket.js';

const DEFAULT_ROOT = process.cwd();
const PUBLIC_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.mp3', 'audio/mpeg'],
  ['.ttf', 'font/ttf'],
]);
const PUBLIC_PREFIXES = Object.freeze(['assets/', 'src/']);

export function createTapTapShootServer({
  env = process.env,
  root = DEFAULT_ROOT,
  playerStore = createPlayerStore({ env, root }),
  rankedDuel = new RankedDuelService({
    playerStore,
    onError(error) {
      console.error('Ranked service failed:', getErrorMessage(error));
    },
  }),
} = {}) {
  const server = createServer(createStaticRequestHandler({ root, rankedDuel }));

  attachWebSocketServer(server, {
    path: '/ws',
    maxConnections: Number(env.WS_MAX_CONNECTIONS ?? 2000),
    maxMessageBytes: Number(env.WS_MAX_MESSAGE_BYTES ?? 16 * 1024),
    maxBufferedBytes: Number(env.WS_MAX_BUFFERED_BYTES ?? 256 * 1024),
    heartbeatMs: Number(env.WS_HEARTBEAT_MS ?? 30 * 1000),
    onConnection(connection, request) {
      const params = new URL(request.url, `http://${request.headers.host}`).searchParams;
      rankedDuel.connect(connection, params.get('playerId')).then((session) => {
        connection.onMessage((raw) => {
          try {
            const result = rankedDuel.receive(session, JSON.parse(raw));

            if (result?.catch) {
              result.catch((error) => {
                console.error('Ranked message failed:', getErrorMessage(error));
                connection.send(JSON.stringify({ type: 'error', message: 'server error' }));
              });
            }
          } catch (error) {
            console.error('Bad ranked message:', getErrorMessage(error));
            connection.send(JSON.stringify({ type: 'error', message: 'bad message' }));
          }
        });
        connection.onClose(() => rankedDuel.disconnect(session));
      }).catch((error) => {
        console.error('Ranked connection failed:', getErrorMessage(error));
        connection.send(JSON.stringify({ type: 'error', message: 'server error' }));
        connection.close();
      });
    },
  });

  return { server, rankedDuel };
}

export function createPlayerStore({ env = process.env, root = DEFAULT_ROOT } = {}) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseSecretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  const localStore = new JsonPlayerStore(join(root, '.ranked-players.json'));

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

    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === '/api/ranked-status') {
      writeJson(response, {
        playersOnline: rankedDuel.getOnlinePlayerCount(),
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
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
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
    || publicPath === 'layout-editor.html'
    || publicPath === 'new_layout.json'
    || PUBLIC_PREFIXES.some((prefix) => publicPath.startsWith(prefix));
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return JSON.stringify(error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 8787);
  const { server } = createTapTapShootServer();

  server.listen(port, () => {
    console.log(`Tap Tap Shoot server listening on http://localhost:${port}`);
  });
}
