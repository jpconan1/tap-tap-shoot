import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { readFile } from 'node:fs/promises';

import { JsonPlayerStore } from './playerStore.js';
import { RankedDuelService } from './rankedDuel.js';
import { attachWebSocketServer } from './webSocket.js';

const PORT = Number(process.env.PORT ?? 8787);
const ROOT = process.cwd();
const PUBLIC_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.wav', 'audio/wav'],
]);

const playerStore = new JsonPlayerStore(join(ROOT, '.ranked-players.json'));
const rankedDuel = new RankedDuelService({ playerStore });
const server = createServer(handleStaticRequest);

attachWebSocketServer(server, {
  path: '/ws',
  onConnection(connection, request) {
    const params = new URL(request.url, `http://${request.headers.host}`).searchParams;
    rankedDuel.connect(connection, params.get('playerId')).then((session) => {
      connection.onMessage((raw) => {
        try {
          rankedDuel.receive(session, JSON.parse(raw));
        } catch {
          connection.send(JSON.stringify({ type: 'error', message: 'bad message' }));
        }
      });
      connection.onClose(() => rankedDuel.disconnect(session));
    });
  },
});

server.listen(PORT, () => {
  console.log(`Tap Tap Shoot server listening on http://localhost:${PORT}`);
});

async function handleStaticRequest(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = getSafePath(pathname);

  if (!filePath) {
    response.writeHead(403).end();
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
}

function getSafePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const normalized = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(ROOT, normalized);

  return filePath.startsWith(ROOT) ? filePath : null;
}
