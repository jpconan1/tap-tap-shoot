import assert from 'node:assert/strict';
import test from 'node:test';

import { getServerHttpUrl, getServerSocketUrl } from '../src/serverUrl.js';

const renderOrigin = 'https://tap-tap-shoot.onrender.com';
const webLocation = { origin: 'https://play.example.com', protocol: 'https:' };

test('server URLs default to the page origin', () => {
  assert.equal(
    getServerHttpUrl('/api/ranked-status', { location: webLocation, serverOrigin: '' }),
    'https://play.example.com/api/ranked-status',
  );
  assert.equal(
    getServerSocketUrl('/ws', { location: webLocation, serverOrigin: '' }),
    'wss://play.example.com/ws',
  );
});

test('configured server origin overrides the platform host', () => {
  assert.equal(
    getServerHttpUrl('/api/ranked-status', { location: webLocation, serverOrigin: renderOrigin }),
    'https://tap-tap-shoot.onrender.com/api/ranked-status',
  );
  assert.equal(
    getServerSocketUrl('/ws', { location: webLocation, serverOrigin: renderOrigin }),
    'wss://tap-tap-shoot.onrender.com/ws',
  );
});

test('local files use the development server', () => {
  const location = { origin: 'null', protocol: 'file:' };
  assert.equal(
    getServerSocketUrl('/ws', { location, serverOrigin: '' }),
    'ws://localhost:8787/ws',
  );
});
