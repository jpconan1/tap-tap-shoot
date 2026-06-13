import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_RATING, updateRatings } from '../server/elo.js';
import { MemoryPlayerStore } from '../server/playerStore.js';
import { RankedDuelService } from '../server/rankedDuel.js';
import { createRoundState } from '../src/engine/gameState.js';

test('matchmaking pairs similarly rated players into a ranked room', async () => {
  const service = createTestService();
  const p1 = await connectTestPlayer(service, 'p1');
  const p2 = await connectTestPlayer(service, 'p2');

  service.receive(p1.session, { type: 'joinRanked' });
  service.receive(p2.session, { type: 'joinRanked' });

  assert.equal(service.queue.length, 0);
  assert.equal(service.rooms.size, 1);
  assert.equal(lastMessage(p1).type, 'matchState');
  assert.equal(lastMessage(p1).phase, 'countdown');
  assert.equal(lastMessage(p2).phase, 'countdown');
});

test('matchmaking waits on rating gaps until search spread widens', async () => {
  let now = 0;
  const store = new MemoryPlayerStore(new Map([
    ['p1', { id: 'p1', rating: 1000, wins: 0, losses: 0, lastPlayed: null }],
    ['p2', { id: 'p2', rating: 1300, wins: 0, losses: 0, lastPlayed: null }],
  ]));
  const service = createTestService({ store, now: () => now });
  const p1 = await connectTestPlayer(service, 'p1');
  const p2 = await connectTestPlayer(service, 'p2');

  service.receive(p1.session, { type: 'joinRanked' });
  service.receive(p2.session, { type: 'joinRanked' });
  assert.equal(service.rooms.size, 0);
  assert.equal(service.queue.length, 2);

  now = 3000;
  service.tryMatchmaking();
  assert.equal(service.rooms.size, 1);
});

test('submitted moves resolve immediately when both players lock in', async () => {
  const { service, p1, p2 } = await createMatchedService();
  const room = onlyRoom(service);

  service.beginChoosing(room);
  service.receive(p1.session, { type: 'submitMove', moveId: 'shoot' });
  service.receive(p2.session, { type: 'submitMove', moveId: 'stab' });

  assert.equal(room.phase, 'revealed');
  assert.equal(room.roundWins.p1, 1);
  assert.equal(lastMessage(p1).revealedMoves.p1, 'shoot');
  assert.equal(lastMessage(p2).revealedMoves.p2, 'stab');
});

test('duplicate submits keep the first move', async () => {
  const { service, p1, p2 } = await createMatchedService();
  const room = onlyRoom(service);

  service.beginChoosing(room);
  service.receive(p1.session, { type: 'submitMove', moveId: 'reload' });
  service.receive(p1.session, { type: 'submitMove', moveId: 'shoot' });
  service.receive(p2.session, { type: 'submitMove', moveId: 'stab' });

  assert.equal(room.phase, 'revealed');
  assert.deepEqual(lastMessage(p1).revealedMoves, { p1: 'reload', p2: 'stab' });
  assert.equal(room.roundWins.p2, 1);
});

test('turn timeout uses fallback legal moves', async () => {
  const { service, p1 } = await createMatchedService({ turnMs: 10 });
  const room = onlyRoom(service);

  service.beginChoosing(room);
  service.receive(p1.session, { type: 'submitMove', moveId: 'shoot' });
  await wait(20);

  assert.equal(room.phase, 'revealed');
  assert.equal(lastMessage(p1).revealedMoves.p2, 'reload');
  assert.equal(room.roundWins.p1, 1);
});

test('first to five ends match and updates Elo once', async () => {
  const { service, p1, p2, store } = await createMatchedService();
  const room = onlyRoom(service);

  for (let win = 0; win < 5; win += 1) {
    service.beginChoosing(room);
    service.receive(p1.session, { type: 'submitMove', moveId: 'shoot' });
    service.receive(p2.session, { type: 'submitMove', moveId: 'stab' });
    await wait(0);

    if (win < 4) {
      room.roundState = service.rooms.get(room.id).roundState.status === 'finished'
        ? createFreshRound(service, room)
        : room.roundState;
    }
  }

  await wait(0);
  const expected = updateRatings(DEFAULT_RATING, DEFAULT_RATING, true);
  assert.equal(room.phase, 'gameOver');
  assert.equal(room.winner, 'p1');
  assert.equal((await store.getPlayer('p1')).rating, expected.player);
  assert.equal((await store.getPlayer('p2')).rating, expected.opponent);
});

test('disconnect forfeits active match', async () => {
  const { service, p1, p2, store } = await createMatchedService();
  const room = onlyRoom(service);

  service.disconnect(p1.session);
  await wait(0);

  assert.equal(room.phase, 'gameOver');
  assert.equal(room.winner, 'p2');
  assert.equal((await store.getPlayer('p2')).wins, 1);
});

function createTestService({ store = new MemoryPlayerStore(), now = () => 0, turnMs = 1000 } = {}) {
  return new RankedDuelService({
    playerStore: store,
    countdownMs: 1000,
    revealMs: 1000,
    turnMs,
    now,
    createId: createIncrementingId(),
  });
}

async function createMatchedService(options) {
  const store = new MemoryPlayerStore();
  const service = createTestService({ ...options, store });
  const p1 = await connectTestPlayer(service, 'p1');
  const p2 = await connectTestPlayer(service, 'p2');

  service.receive(p1.session, { type: 'joinRanked' });
  service.receive(p2.session, { type: 'joinRanked' });

  return { service, p1, p2, store };
}

async function connectTestPlayer(service, playerId) {
  const messages = [];
  const session = await service.connect({
    send(raw) {
      messages.push(JSON.parse(raw));
    },
  }, playerId);

  return { session, messages };
}

function onlyRoom(service) {
  return [...service.rooms.values()][0];
}

function lastMessage(player) {
  return player.messages[player.messages.length - 1];
}

function createIncrementingId() {
  let next = 0;
  return () => `id-${next += 1}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createFreshRound(service, room) {
  service.clearRoomTimer(room);
  room.roundState = createRoundState();
  room.phase = 'choosing';
  return room.roundState;
}
