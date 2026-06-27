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
    await writeFile(join(root, 'index.html'), '<main>game</main>');
    await writeFile(join(root, 'new_layout.json'), '{"version":1}');
    await writeFile(join(root, 'src', 'main.js'), 'console.log("game");');
    await writeFile(join(root, 'assets', 'sprite.webp'), 'sprite');
    await writeFile(join(root, '.env'), 'SUPABASE_SECRET_KEY=secret');
    await writeFile(join(root, 'server', 'index.js'), 'secret server code');
    await writeFile(join(root, 'package.json'), '{"private":true}');

    const handler = createStaticRequestHandler({
      root,
      rankedDuel: { getOnlinePlayerCount: () => 0 },
    });

    assert.equal((await request(handler, '/')).statusCode, 200);
    assert.equal((await request(handler, '/new_layout.json')).statusCode, 200);
    assert.equal((await request(handler, '/src/main.js')).statusCode, 200);
    assert.equal((await request(handler, '/assets/sprite.webp')).statusCode, 200);
    assert.deepEqual(JSON.parse((await request(handler, '/api/ranked-status')).body), {
      playersOnline: 0,
    });

    assert.equal((await request(handler, '/.env')).statusCode, 404);
    assert.equal((await request(handler, '/server/index.js')).statusCode, 404);
    assert.equal((await request(handler, '/package.json')).statusCode, 404);
    assert.equal((await request(handler, '/%2e%2e/server/index.js')).statusCode, 404);
    assert.equal((await request(handler, '/%')).statusCode, 404);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function request(handler, url) {
  const response = new TestResponse();
  await handler({
    method: 'GET',
    url,
    headers: {
      host: 'localhost',
    },
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
