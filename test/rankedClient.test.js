import assert from 'node:assert/strict';
import test from 'node:test';

import { RankedClient, RankedUpdateQueue } from '../src/rankedClient.js';

test('rapid ordinary snapshots coalesce while transition updates remain ordered', () => {
  const queue = new RankedUpdateQueue();
  queue.push({ revision: 1, phase: 'variantSelection' });
  queue.push({ revision: 2, phase: 'variantSelection' });
  queue.push(
    { revision: 3, phase: 'choosing' },
    { revision: 3, transitionId: 'variant-set-started' },
  );
  queue.push({ revision: 4, phase: 'choosing', readyPlayerKey: 'p1' });
  queue.push({ revision: 5, phase: 'choosing', readyPlayerKey: 'p2' });

  assert.deepEqual(queue.items.map(({ snapshot, transition }) => [
    snapshot.revision,
    transition?.transitionId ?? null,
  ]), [
    [2, null],
    [3, 'variant-set-started'],
    [5, null],
  ]);
});

test('delayed stale snapshots cannot replace newer queued state', () => {
  const queue = new RankedUpdateQueue();
  assert.equal(queue.push({ revision: 4 }), true);
  assert.equal(queue.push({ revision: 3 }), false);
  assert.equal(queue.shift().snapshot.revision, 4);
});

test('client pairs a separate transition event with its authoritative snapshot', () => {
  const received = [];
  const client = new RankedClient({
    onQueue() {},
    onSnapshot(snapshot, transition) { received.push({ snapshot, transition }); },
    onClose() {},
  });

  client.handleMessage({ type: 'matchTransition', revision: 7, transitionId: 'variant-set-started' });
  client.handleMessage({ type: 'matchState', revision: 7, phase: 'choosing' });

  assert.equal(received[0].snapshot.phase, 'choosing');
  assert.equal(received[0].transition.transitionId, 'variant-set-started');
});

test('client surfaces server availability errors', () => {
  const errors = [];
  const client = new RankedClient({
    onQueue() {},
    onSnapshot() {},
    onClose() {},
    onError(message) { errors.push(message); },
  });

  client.handleMessage({
    type: 'error',
    code: 'ranked_unavailable',
    message: 'ranked service temporarily unavailable',
  });

  assert.deepEqual(errors, ['ranked service temporarily unavailable']);
});

test('client routes lobby, roster, chat, whiteboard, and challenge events', () => {
  const events = [];
  const client = new RankedClient({
    onSnapshot() {},
    onClose() {},
    onLobbyState(message) { events.push(['lobby', message.self.playerId]); },
    onRoster(players) { events.push(['roster', players.length]); },
    onChat(message) { events.push(['chat', message.text]); },
    onBoardOperation(operation) { events.push(['board', operation.kind]); },
    onBoardTrim(top) { events.push(['trim', top]); },
    onBoardReset(board) { events.push(['reset', board.top]); },
    onChallenge(message) { events.push(['challenge', message.status]); },
  });
  client.handleMessage({ type: 'lobbyState', self: { playerId: 'p1' }, players: [] });
  client.handleMessage({ type: 'rosterUpdated', players: [{}, {}] });
  client.handleMessage({ type: 'chatMessage', message: { text: 'yo' } });
  client.handleMessage({ type: 'boardOperation', operation: { kind: 'stroke' } });
  client.handleMessage({ type: 'boardTrim', top: 30 });
  client.handleMessage({ type: 'boardReset', board: { top: 0 } });
  client.handleMessage({ type: 'challengeUpdated', status: 'pending', challenge: {} });
  assert.deepEqual(events, [['lobby', 'p1'], ['roster', 2], ['chat', 'yo'], ['board', 'stroke'], ['trim', 30], ['reset', 0], ['challenge', 'pending']]);
});
