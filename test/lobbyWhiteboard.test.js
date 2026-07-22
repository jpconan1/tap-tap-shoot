import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmptyLobbyBoard, LOBBY_BOARD_COLORS } from '../src/lobbyWhiteboard.js';

test('new lobby whiteboards have independent operation lists', () => {
  const first = createEmptyLobbyBoard();
  const second = createEmptyLobbyBoard();
  first.operations.push({ kind: 'stroke' });

  assert.equal(second.operations.length, 0);
  assert.deepEqual(LOBBY_BOARD_COLORS, ['black', 'red', 'blue', 'purple', 'green']);
});
