import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { createStaticRequestHandler } from '../server/index.js';

test('static server only serves public game files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'taptapshoot-static-'));

  try {
    await mkdir(join(root, 'src'));
    await mkdir(join(root, 'assets'));
    await mkdir(join(root, 'server'));
    await mkdir(join(root, 'tools'));
    await writeFile(join(root, 'index.html'), '<main>game</main>');
    await writeFile(join(root, 'server-config.js'), 'globalThis.SERVER = "";');
    await writeFile(join(root, 'new_layout.json'), '{"version":1}');
    await writeFile(join(root, 'src', 'main.js'), 'console.log("game");');
    await writeFile(join(root, 'assets', 'sprite.webp'), 'sprite');
    await writeFile(join(root, '.env'), 'SUPABASE_SECRET_KEY=secret');
    await writeFile(join(root, 'server', 'index.js'), 'secret server code');
    await writeFile(join(root, 'tools', 'layout-editor.html'), '<main>editor</main>');
    await writeFile(join(root, 'package.json'), '{"private":true}');

    const handler = createStaticRequestHandler({
      root,
      rankedDuel: { getOnlinePlayerCount: () => 0 },
    });

    const indexResponse = await request(handler, '/');
    assert.equal(indexResponse.statusCode, 200);
    assert.equal(indexResponse.headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(indexResponse.headers['Referrer-Policy'], 'no-referrer');
    assert.equal(indexResponse.headers['X-Frame-Options'], 'SAMEORIGIN');
    assert.equal((await request(handler, '/new_layout.json')).statusCode, 200);
    assert.equal((await request(handler, '/server-config.js')).statusCode, 200);
    assert.equal((await request(handler, '/src/main.js')).statusCode, 200);
    assert.equal((await request(handler, '/assets/sprite.webp')).statusCode, 200);
    const rankedStatus = await request(handler, '/api/ranked-status');
    assert.equal(rankedStatus.headers['Access-Control-Allow-Origin'], '*');
    assert.equal(rankedStatus.headers['X-Content-Type-Options'], 'nosniff');
    assert.deepEqual(JSON.parse(rankedStatus.body), {
      playersOnline: 0,
    });
    assert.deepEqual(JSON.parse((await request(handler, '/api/debug-tools')).body), {
      winGame: false,
      revealComputerMove: false,
      sceneGallery: false,
    });

    assert.equal((await request(handler, '/.env')).statusCode, 404);
    assert.equal((await request(handler, '/server/index.js')).statusCode, 404);
    assert.equal((await request(handler, '/tools/layout-editor.html')).statusCode, 404);
    assert.equal((await request(handler, '/package.json')).statusCode, 404);
    assert.equal((await request(handler, '/%2e%2e/server/index.js')).statusCode, 404);
    assert.equal((await request(handler, '/%')).statusCode, 404);
    assert.equal((await request(handler, '/', { host: 'not a valid host' })).statusCode, 200);
    assert.equal((await request(handler, 'http://%')).statusCode, 400);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function request(handler, url, headers = { host: 'localhost' }) {
  const response = new TestResponse();
  await handler({
    method: 'GET',
    url,
    headers,
  }, response);

  return response;
}

class TestResponse {
  constructor() {
    this.statusCode = null;
    this.headers = {};
    this.body = '';
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = headers;
    return this;
  }

  end(body = '') {
    this.body = body.toString();
  }
}
