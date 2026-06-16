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

test('online player count tracks connected sessions', async () => {
  const service = createTestService();
  const p1 = await connectTestPlayer(service, 'p1');
  const p2 = await connectTestPlayer(service, 'p2');

  assert.equal(service.getOnlinePlayerCount(), 2);
  service.disconnect(p1.session);
  assert.equal(service.getOnlinePlayerCount(), 1);
  service.disconnect(p2.session);
  assert.equal(service.getOnlinePlayerCount(), 0);
});

test('matchmaking snapshots include guest display names', async () => {
  const service = createTestService();
  const p1 = await connectTestPlayer(service, 'p1');
  const p2 = await connectTestPlayer(service, 'p2');

  service.receive(p1.session, { type: 'joinRanked', displayName: 'JP' });
  service.receive(p2.session, { type: 'joinRanked', displayName: 'Chatman' });

  assert.equal(lastMessage(p1).players.p1.displayName, 'JP');
  assert.equal(lastMessage(p1).players.p2.displayName, 'Chatman');
  assert.equal(lastMessage(p2).players.p1.displayName, 'JP');
  assert.equal(lastMessage(p2).players.p2.displayName, 'Chatman');
});

test('guest display names are session-only and sanitized', async () => {
  const service = createTestService();
  const p1 = await connectTestPlayer(service, 'p1');
  const p2 = await connectTestPlayer(service, 'p2');
  const longName = 'x'.repeat(70);

  service.receive(p1.session, { type: 'joinRanked', displayName: '   ' });
  service.receive(p2.session, { type: 'joinRanked', displayName: `  ${longName}  ` });

  assert.equal(lastMessage(p1).players.p1.displayName, 'Guest');
  assert.equal(lastMessage(p1).players.p2.displayName, 'x'.repeat(50));
  assert.equal(service.playerStore.players.get('p1').displayName, undefined);
  assert.equal(service.playerStore.players.get('p2').displayName, undefined);
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

test('matchmaking does not pair two sessions for the same player', async () => {
  const service = createTestService();
  const firstSession = await connectTestPlayer(service, 'p1');
  const secondSession = await connectTestPlayer(service, 'p1');

  service.receive(firstSession.session, { type: 'joinRanked' });
  service.receive(secondSession.session, { type: 'joinRanked' });

  assert.equal(service.rooms.size, 0);
  assert.equal(service.queue.length, 2);
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

test('first submitted move starts server-owned waiting deadline', async () => {
  const { service, p1, p2 } = await createMatchedService();
  const room = onlyRoom(service);

  service.beginChoosing(room);
  service.receive(p1.session, { type: 'submitMove', moveId: 'reload' });

  assert.equal(room.readyPlayerKey, 'p1');
  assert.equal(room.waitingPlayerKey, 'p2');
  assert.equal(lastMessage(p2).readyPlayerKey, 'p1');
  assert.equal(lastMessage(p2).waitingPlayerKey, 'p2');
});

test('opponent first submit broadcasts ready state to waiting player', async () => {
  const { service, p1, p2 } = await createMatchedService();
  const room = onlyRoom(service);

  service.beginChoosing(room);
  service.receive(p2.session, { type: 'submitMove', moveId: 'reload' });

  assert.equal(room.readyPlayerKey, 'p2');
  assert.equal(room.waitingPlayerKey, 'p1');
  assert.equal(lastMessage(p1).readyPlayerKey, 'p2');
  assert.equal(lastMessage(p1).waitingPlayerKey, 'p1');
});

test('turn timeout gives the ready player the round', async () => {
  const { service, p1 } = await createMatchedService({ turnMs: 10 });
  const room = onlyRoom(service);

  service.beginChoosing(room);
  service.receive(p1.session, { type: 'submitMove', moveId: 'shoot' });
  await wait(20);

  assert.equal(room.phase, 'revealed');
  assert.deepEqual(lastMessage(p1).timeout, { loser: 'p2', winner: 'p1', strikes: 1 });
  assert.equal(room.roundWins.p1, 1);
  assert.equal(room.timeoutStrikes.p2, 1);
});

test('finished round waits for both players to continue', async () => {
  const { service, p1, p2 } = await createMatchedService({ revealMs: 1 });
  const room = onlyRoom(service);

  service.beginChoosing(room);
  service.receive(p1.session, { type: 'submitMove', moveId: 'shoot' });
  service.receive(p2.session, { type: 'submitMove', moveId: 'stab' });
  await wait(10);

  assert.equal(room.phase, 'roundOver');
  assert.equal(lastMessage(p1).players.p1.canContinue, true);

  service.receive(p1.session, { type: 'submitContinue' });
  assert.equal(room.phase, 'roundOver');
  assert.equal(room.readyPlayerKey, 'p1');
  assert.equal(room.waitingPlayerKey, 'p2');
  assert.equal(lastMessage(p2).waitingPlayerKey, 'p2');

  service.receive(p2.session, { type: 'submitContinue' });
  assert.equal(room.phase, 'choosing');
  assert.equal(room.roundState.status, 'playing');
});

test('third timeout loses match regardless of score', async () => {
  const { service, p1, p2, store } = await createMatchedService({ turnMs: 10 });
  const room = onlyRoom(service);

  room.roundWins.p2 = 4;

  for (let strike = 0; strike < 3; strike += 1) {
    service.beginChoosing(room);
    service.receive(p1.session, { type: 'submitMove', moveId: 'shoot' });
    await wait(20);

    if (strike < 2) {
      room.roundState = createFreshRound(service, room);
    }
  }

  await wait(0);
  assert.equal(room.phase, 'gameOver');
  assert.equal(room.winner, 'p1');
  assert.equal(room.timeoutStrikes.p2, 3);
  assert.equal(lastMessage(p2).timeoutStrikes.p2, 3);
  assert.equal((await store.getPlayer('p1')).wins, 1);
  assert.equal((await store.getPlayer('p2')).losses, 1);
});

test('no selections on tied score ends match with no rating change', async () => {
  const { service, p1, p2, store } = await createMatchedService({
    noSelectionGraceMs: 1,
    noContestWaitingMs: 1,
    noContestCountdownMs: 1,
  });
  const room = onlyRoom(service);

  service.beginChoosing(room);
  await wait(10);

  assert.equal(room.phase, 'gameOver');
  assert.equal(room.winner, null);
  assert.equal(room.noContest, true);
  assert.equal(lastMessage(p1).noContest, true);
  assert.equal(lastMessage(p2).winner, null);
  assert.equal((await store.getPlayer('p1')).rating, DEFAULT_RATING);
  assert.equal((await store.getPlayer('p2')).rating, DEFAULT_RATING);
  assert.equal((await store.getPlayer('p1')).wins, 0);
  assert.equal((await store.getPlayer('p2')).losses, 0);
});

test('no contest awards match to current round leader', async () => {
  const { service, p1, p2, store } = await createMatchedService({
    noSelectionGraceMs: 1,
    noContestWaitingMs: 1,
    noContestCountdownMs: 1,
  });
  const room = onlyRoom(service);

  room.roundWins.p2 = 2;
  service.beginChoosing(room);
  await wait(10);

  assert.equal(room.phase, 'gameOver');
  assert.equal(room.winner, 'p2');
  assert.equal(room.noContest, true);
  assert.equal(lastMessage(p1).winner, 'p2');
  assert.equal((await store.getPlayer('p2')).wins, 1);
  assert.equal((await store.getPlayer('p1')).losses, 1);
});

test('first to five ends match and updates Elo once', async () => {
  const { service, p1, p2, store } = await createMatchedService({ revealMs: 1 });
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

  await wait(10);
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

test('finished matches are removed from active rooms', async () => {
  const { service, p1, p2 } = await createMatchedService({ revealMs: 1 });
  const room = onlyRoom(service);

  room.roundWins.p1 = 4;
  service.beginChoosing(room);
  service.receive(p1.session, { type: 'submitMove', moveId: 'shoot' });
  service.receive(p2.session, { type: 'submitMove', moveId: 'stab' });
  await wait(10);

  assert.equal(room.phase, 'gameOver');
  assert.equal(service.rooms.size, 0);
  assert.equal(p1.session.roomId, null);
  assert.equal(p2.session.roomId, null);
});

test('no-contest matches are removed from active rooms', async () => {
  const { service, p1, p2 } = await createMatchedService({
    noSelectionGraceMs: 1,
    noContestWaitingMs: 1,
    noContestCountdownMs: 1,
  });
  const room = onlyRoom(service);

  service.beginChoosing(room);
  await wait(10);

  assert.equal(room.phase, 'gameOver');
  assert.equal(service.rooms.size, 0);
  assert.equal(p1.session.roomId, null);
  assert.equal(p2.session.roomId, null);
});

function createTestService({
  store = new MemoryPlayerStore(),
  now = () => 0,
  turnMs = 1000,
  revealMs = 1000,
  noSelectionGraceMs = 1000,
  noContestWaitingMs = 1000,
  noContestCountdownMs = 1000,
} = {}) {
  return new RankedDuelService({
    playerStore: store,
    countdownMs: 1000,
    revealMs,
    turnMs,
    noSelectionGraceMs,
    noContestWaitingMs,
    noContestCountdownMs,
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
