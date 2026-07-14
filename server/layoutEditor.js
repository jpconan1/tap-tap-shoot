import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const root = process.cwd();
const host = '127.0.0.1';
const port = Number(process.env.EDITOR_PORT ?? 8790);
const types = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webp', 'image/webp'],
]);

const server = createServer(async (request, response) => {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end();
      return;
    }

    const url = new URL(request.url, 'http://localhost');
    const pathname = url.pathname === '/' ? '/tools/layout-editor/index.html' : url.pathname;
    const decoded = decodeURIComponent(pathname);
    const normalized = normalize(decoded).replace(/^[/\\]+/, '').split(sep).join('/');

    if (!isEditorFile(normalized)) {
      response.writeHead(404).end('Not found');
      return;
    }

    const filePath = join(root, normalized);
    if (!filePath.startsWith(`${root}${sep}`)) {
      response.writeHead(404).end('Not found');
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': types.get(extname(filePath)) ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

server.listen(port, host, () => {
  console.log(`Layout editor: http://${host}:${port}`);
});

function isEditorFile(pathname) {
  if (pathname.split('/').some((part) => part.startsWith('.'))) {
    return false;
  }

  return pathname === 'new_layout.json'
    || pathname.startsWith('tools/layout-editor/')
    || pathname.startsWith('assets/');
}
