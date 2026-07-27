import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_RATING, updateRatings } from '../server/elo.js';
import { MemoryPlayerStore } from '../server/playerStore.js';
import { RankedDuelService } from '../server/rankedDuel.js';
import { getAllowDebugWinGame } from '../server/index.js';
import { createRoundState } from '../src/engine/gameState.js';
import { DEFAULT_VARIANT_ID, VARIANT_IDS } from '../src/engine/moves.js';
import { MemoryAnalyticsStore } from '../server/analyticsStore.js';

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

test('matchmaking uses one pool across requested variants', async () => {
  const service = createTestService();
  const p1 = await connectTestPlayer(service, 'p1');
  const p2 = await connectTestPlayer(service, 'p2');
  const p3 = await connectTestPlayer(service, 'p3');

  service.receive(p1.session, { type: 'joinRanked', variantId: 'counterstab' });
  service.receive(p2.session, { type: 'joinRanked', variantId: VARIANT_IDS.tapTapShootY });
  service.receive(p3.session, { type: 'joinRanked', variantId: VARIANT_IDS.rockPaperScissors });

  assert.equal(service.rooms.size, 1);
  assert.equal(service.queue.length, 1);
  assert.equal(service.queue[0], p3.session);
  assert.equal(lastMessage(p1).variantId, DEFAULT_VARIANT_ID);
  assert.equal(lastMessage(p2).variantId, DEFAULT_VARIANT_ID);
});

test('variant picks are realtime unique and play first picker first', async () => {
  const { service, p1, p2 } = await createMatchedService();
  const room = onlyRoom(service);

  service.beginBanning(room);
  service.receive(p1.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.rockPaperScissors });
  assert.equal(lastMessage(p2).variantPicks.p1, VARIANT_IDS.rockPaperScissors);

  service.receive(p2.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.rockPaperScissors });
  assert.equal(lastMessage(p2).type, 'error');
  assert.equal(lastMessage(p2).message, 'illegal variant pick');

  service.receive(p2.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.fireballWar });
  assert.equal(room.phase, 'choosing');
  assert.deepEqual(room.remainingVariants, [
    VARIANT_IDS.rockPaperScissors,
    VARIANT_IDS.fireballWar,
  ]);
  assert.equal(lastMessage(p1).currentVariantId, VARIANT_IDS.rockPaperScissors);
  assert.deepEqual(lastMessage(p1).variantPicks, {
    p1: VARIANT_IDS.rockPaperScissors,
    p2: VARIANT_IDS.fireballWar,
  });
});

test('analytics records anonymous match facts, variant picks, turns, games, and completion', async () => {
  const analyticsStore = new MemoryAnalyticsStore();
  const { service, p1, p2 } = await createMatchedService({ analyticsStore, revealMs: 1, allowDebugWinGame: true });
  const room = onlyRoom(service);

  service.beginBanning(room);
  service.receive(p1.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.tapTapShootY });
  service.receive(p2.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.fireballWar });
  room.roundWins.p1 = 2;
  service.receive(p1.session, { type: 'submitMove', moveId: 'shoot' });
  service.receive(p2.session, { type: 'submitMove', moveId: 'stab' });
  await wait(10);
  service.receive(p1.session, { type: 'submitContinue' });
  service.receive(p2.session, { type: 'submitContinue' });
  service.receive(p1.session, { type: 'debugWinGame' });
  await wait(0);
  await service.analyticsQueue;

  assert.equal(analyticsStore.matches.length, 1);
  assert.deepEqual(analyticsStore.matches[0], {
    matchId: room.id,
    startedAt: new Date(0).toISOString(),
    p1Id: 'p1',
    p2Id: 'p2',
  });
  assert.deepEqual(analyticsStore.variantPicks.map(({ variantId, pickOrder }) => ({ variantId, pickOrder })), [
    { variantId: VARIANT_IDS.tapTapShootY, pickOrder: 1 },
    { variantId: VARIANT_IDS.fireballWar, pickOrder: 2 },
  ]);
  assert.equal(analyticsStore.turns.length, 1);
  assert.deepEqual(analyticsStore.turns.map(({ variantGameNumber, turnNumber }) => ({ variantGameNumber, turnNumber })), [
    { variantGameNumber: 1, turnNumber: 1 },
  ]);
  assert.equal(analyticsStore.variantGames.length, 2);
  assert.equal(analyticsStore.matchEnds[0].status, 'completed');
  assert.equal(analyticsStore.matchEnds[0].winnerSlot, 'p1');
});

test('room revisions increase and variant start is a separate transition event', async () => {
  const { service, p1, p2 } = await createMatchedService();
  const room = onlyRoom(service);
  service.beginBanning(room);
  const banningRevision = lastMessage(p1).revision;

  service.receive(p1.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.rockPaperScissors });
  service.receive(p2.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.fireballWar });

  const transitionIndex = p1.messages.findLastIndex((message) => message.type === 'matchTransition');
  const transition = p1.messages[transitionIndex];
  const snapshot = p1.messages[transitionIndex + 1];
  assert.equal(transition.transitionId, 'variant-set-started');
  assert.equal(snapshot.type, 'matchState');
  assert.equal(snapshot.revision, transition.revision);
  assert.ok(snapshot.revision > banningRevision);
  assert.equal(lastMessage(p2).revision, snapshot.revision);
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

test('newest connection replaces older session for the same player', async () => {
  const service = createTestService();
  const firstSession = await connectTestPlayer(service, 'p1');
  service.receive(firstSession.session, { type: 'joinRanked' });
  const secondSession = await connectTestPlayer(service, 'p1');

  service.receive(secondSession.session, { type: 'joinRanked' });

  assert.equal(firstSession.session.closed, true);
  assert.equal(firstSession.client.closed, true);
  assert.deepEqual(firstSession.client.closeArgs, [4001, 'guest connected elsewhere']);
  assert.equal(service.rooms.size, 0);
  assert.deepEqual(service.queue, [secondSession.session]);
  assert.equal(service.getOnlinePlayerCount(), 1);
});

test('replacement connection forfeits old active match before loading rating', async () => {
  const { service, p1, p2, store } = await createMatchedService();
  const room = onlyRoom(service);
  service.beginBanning(room);
  service.receive(p1.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.rockPaperScissors });
  service.receive(p2.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.fireballWar });

  const replacement = await connectTestPlayer(service, 'p1');

  assert.equal(p1.session.closed, true);
  assert.equal(p1.client.closed, true);
  assert.equal(room.phase, 'gameOver');
  assert.equal(room.winner, 'p2');
  assert.equal(replacement.session.player.losses, 1);
  assert.equal((await store.getPlayer('p2')).wins, 1);
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

test('debug win game awards the current variant game when explicitly enabled', async () => {
  const { service, p1 } = await createMatchedService({ allowDebugWinGame: true });
  const room = onlyRoom(service);
  room.remainingVariants = [VARIANT_IDS.tapTapShootY, VARIANT_IDS.fireballWar];
  room.variantId = VARIANT_IDS.tapTapShootY;
  room.phase = 'choosing';

  service.receive(p1.session, { type: 'debugWinGame' });

  assert.equal(room.gameWins.p1, 1);
  assert.equal(room.gameWins.p2, 0);
  assert.deepEqual(room.gameResults, [{
    variantId: VARIANT_IDS.tapTapShootY,
    roundWins: { p1: 3, p2: 0 },
    winner: 'p1',
  }]);
  assert.equal(room.phase, 'roundOver');
  assert.equal(room.pendingNextVariant, true);
  assert.equal(room.winner, null);
});

test('debug win game is disabled by default and old skip command stays dead', async () => {
  const { service, p1 } = await createMatchedService();
  const room = onlyRoom(service);
  room.remainingVariants = [VARIANT_IDS.tapTapShootY, VARIANT_IDS.fireballWar];
  room.phase = 'choosing';

  service.receive(p1.session, { type: 'debugWinGame' });
  service.receive(p1.session, { type: 'skipGame' });

  assert.deepEqual(room.gameWins, { p1: 0, p2: 0 });
  assert.equal(room.phase, 'choosing');
});

test('hello only advertises debug win game when server enables it', async () => {
  const disabled = await connectTestPlayer(createTestService(), 'disabled');
  const enabled = await connectTestPlayer(createTestService({ allowDebugWinGame: true }), 'enabled');

  assert.equal(disabled.messages[0].debugTools.winGame, false);
  assert.equal(enabled.messages[0].debugTools.winGame, true);
  assert.equal(disabled.messages[0].debugTools.revealComputerMove, false);
  assert.equal(enabled.messages[0].debugTools.revealComputerMove, true);
  assert.equal(disabled.messages[0].debugTools.sceneGallery, false);
  assert.equal(enabled.messages[0].debugTools.sceneGallery, true);
});

test('production cannot enable debug win game', () => {
  assert.equal(getAllowDebugWinGame({ ALLOW_DEBUG_WIN_GAME: 'true' }), true);
  assert.equal(getAllowDebugWinGame({}), false);
  assert.throws(
    () => getAllowDebugWinGame({ NODE_ENV: 'production', ALLOW_DEBUG_WIN_GAME: 'true' }),
    /cannot be enabled in production/,
  );
});

test('debug win game can win the match when explicitly enabled', async () => {
  const { service, p2 } = await createMatchedService({ allowDebugWinGame: true });
  const room = onlyRoom(service);
  room.remainingVariants = [VARIANT_IDS.tapTapShootY, VARIANT_IDS.fireballWar];
  room.gameWins.p2 = 1;
  room.phase = 'choosing';

  service.receive(p2.session, { type: 'debugWinGame' });

  assert.equal(room.gameWins.p2, 2);
  assert.equal(room.phase, 'gameOver');
  assert.equal(room.winner, 'p2');
});

test('Tap Tap Shoot Y rejects counterstab and accepts free stab', async () => {
  const { service, p1, p2 } = await createMatchedService({ variantId: VARIANT_IDS.tapTapShootY });
  const room = onlyRoom(service);

  room.roundState.players.p1.bullets = 0;
  room.roundState.players.p2.bullets = 1;
  service.beginChoosing(room);
  service.receive(p1.session, { type: 'submitMove', moveId: 'counterstab' });
  assert.equal(lastMessage(p1).type, 'error');
  assert.equal(lastMessage(p1).message, 'illegal move');

  service.receive(p1.session, { type: 'submitMove', moveId: 'stab' });
  service.receive(p2.session, { type: 'submitMove', moveId: 'reload' });

  assert.equal(room.phase, 'revealed');
  assert.equal(room.roundWins.p1, 0);
  assert.equal(room.roundWins.p2, 0);
  assert.deepEqual(lastMessage(p1).revealedMoves, { p1: 'stab', p2: 'reload' });
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
  assert.equal(room.roundWins.p2, 0);
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

test('ordinary Rock Paper Scissors wins open the next throw without continues', async () => {
  const { service, p1, p2 } = await createMatchedService({ revealMs: 1000 });
  const room = onlyRoom(service);
  room.variantId = VARIANT_IDS.rockPaperScissors;
  room.roundState = createRoundState({ variantId: room.variantId });

  service.beginChoosing(room);
  service.receive(p1.session, { type: 'submitMove', moveId: 'rock' });
  service.receive(p2.session, { type: 'submitMove', moveId: 'scissors' });
  await wait(10);

  assert.equal(room.roundWins.p1, 1);
  assert.equal(room.phase, 'choosing');
  assert.equal(room.roundState.status, 'playing');
  assert.equal(lastMessage(p1).players.p1.canContinue, false);
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

test('first to three ends match and updates Elo once', async () => {
  const { service, p1, p2, store } = await createMatchedService({ revealMs: 1 });
  const room = onlyRoom(service);

  for (let win = 0; win < 3; win += 1) {
    service.beginChoosing(room);
    service.receive(p1.session, { type: 'submitMove', moveId: 'shoot' });
    service.receive(p2.session, { type: 'submitMove', moveId: 'stab' });
    await wait(0);

    if (win < 2) {
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

test('current rules first to three updates rating records', async () => {
  const { service, p1, p2, store } = await createMatchedService({
    revealMs: 1,
    variantId: VARIANT_IDS.tapTapShootY,
  });
  const room = onlyRoom(service);

  room.roundWins.p1 = 2;
  service.beginChoosing(room);
  service.receive(p1.session, { type: 'submitMove', moveId: 'shoot' });
  service.receive(p2.session, { type: 'submitMove', moveId: 'stab' });
  await wait(10);

  assert.equal(room.phase, 'gameOver');
  assert.equal(room.winner, 'p1');
  assert.notEqual((await store.getPlayer('p1')).rating, DEFAULT_RATING);
  assert.notEqual((await store.getPlayer('p2')).rating, DEFAULT_RATING);
  assert.equal((await store.getPlayer('p1')).wins, 1);
  assert.equal((await store.getPlayer('p2')).losses, 1);
});

test('best of three variant games advances variants and updates Elo once', async () => {
  const { service, p1, p2, store } = await createMatchedService({ revealMs: 1 });
  const room = onlyRoom(service);

  service.beginBanning(room);
  service.receive(p1.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.tapTapShootY });
  service.receive(p2.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.gunKnifeFist });
  assert.equal(room.variantId, VARIANT_IDS.tapTapShootY);

  room.roundWins.p1 = 2;
  service.receive(p1.session, { type: 'submitMove', moveId: 'shoot' });
  service.receive(p2.session, { type: 'submitMove', moveId: 'stab' });
  await wait(10);

  assert.equal(room.phase, 'roundOver');
  assert.equal(room.gameWins.p1, 1);
  assert.equal(room.pendingNextVariant, true);

  service.receive(p1.session, { type: 'submitContinue' });
  service.receive(p2.session, { type: 'submitContinue' });
  assert.equal(room.phase, 'choosing');
  assert.equal(room.variantId, VARIANT_IDS.gunKnifeFist);
  assert.deepEqual(room.roundWins, { p1: 0, p2: 0 });

  room.roundWins.p1 = 2;
  service.receive(p1.session, { type: 'submitMove', moveId: 'shoot' });
  service.receive(p2.session, { type: 'submitMove', moveId: 'stab' });
  await wait(10);

  assert.equal(room.phase, 'gameOver');
  assert.equal(room.winner, 'p1');
  assert.equal(room.gameWins.p1, 2);
  assert.equal((await store.getPlayer('p1')).wins, 1);
  assert.equal((await store.getPlayer('p2')).losses, 1);
});

test('split variant games trigger tiebreaker selection with previous variants banned', async () => {
  const { service, p1, p2 } = await createMatchedService({ revealMs: 1 });
  const room = onlyRoom(service);

  service.beginBanning(room);
  service.receive(p1.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.rockPaperScissors });
  service.receive(p2.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.fireballWar });

  room.roundWins.p1 = 4;
  service.receive(p1.session, { type: 'submitMove', moveId: 'rock' });
  service.receive(p2.session, { type: 'submitMove', moveId: 'scissors' });
  await wait(10);
  service.receive(p1.session, { type: 'submitContinue' });
  service.receive(p2.session, { type: 'submitContinue' });

  room.roundWins.p2 = 2;
  service.receive(p1.session, { type: 'submitMove', moveId: 'charge' });
  service.receive(p2.session, { type: 'submitMove', moveId: 'fireball' });
  await wait(10);

  assert.equal(room.phase, 'roundOver');
  assert.equal(room.pendingTiebreaker, true);
  assert.deepEqual(room.gameWins, { p1: 1, p2: 1 });
  assert.deepEqual(room.bannedVariants, [VARIANT_IDS.rockPaperScissors, VARIANT_IDS.fireballWar]);

  service.receive(p1.session, { type: 'submitContinue' });
  assert.equal(room.phase, 'roundOver');
  service.receive(p2.session, { type: 'submitContinue' });
  assert.equal(room.phase, 'variantSelection');
  assert.equal(room.pendingTiebreaker, false);

  service.receive(p1.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.tapTapShootY });
  service.receive(p2.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.gunKnifeFist });

  assert.equal(room.phase, 'choosing');
  assert.equal(room.variantId, VARIANT_IDS.tapTapShootX);
  assert.deepEqual(room.remainingVariants, [VARIANT_IDS.tapTapShootX]);
});

test('disconnect forfeits active match', async () => {
  const { service, p1, p2, store } = await createMatchedService();
  const room = onlyRoom(service);
  service.beginBanning(room);
  service.receive(p1.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.rockPaperScissors });
  service.receive(p2.session, { type: 'submitVariantPick', variantId: VARIANT_IDS.fireballWar });

  service.disconnect(p1.session);
  await wait(0);

  assert.equal(room.phase, 'gameOver');
  assert.equal(room.winner, 'p2');
  assert.equal(lastMessage(p2).disconnectedPlayerKey, 'p1');
  assert.equal(lastMessage(p2).aborted, false);
  assert.equal((await store.getPlayer('p2')).wins, 1);
});

test('disconnect during initial variant picks aborts without Elo', async () => {
  const { service, p1, p2, store } = await createMatchedService();
  const room = onlyRoom(service);
  service.beginBanning(room);

  service.disconnect(p1.session);
  await wait(0);

  assert.equal(room.phase, 'gameOver');
  assert.equal(room.winner, null);
  assert.equal(lastMessage(p2).disconnectedPlayerKey, 'p1');
  assert.equal(lastMessage(p2).aborted, true);
  assert.equal((await store.getPlayer('p2')).wins, 0);
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

test('lobby presence broadcasts and ready players use ranked matchmaking', async () => {
  const service = createTestService();
  const p1 = await connectTestPlayer(service, 'p1');
  const p2 = await connectTestPlayer(service, 'p2');
  service.receive(p1.session, { type: 'enterLobby', displayName: 'JP' });
  service.receive(p2.session, { type: 'enterLobby', displayName: 'Chatman' });

  service.receive(p1.session, { type: 'setReady', ready: true });
  assert.equal(service.chatMessages.at(-1).text, 'JP is ready to play!');
  assert.equal(service.chatMessages.at(-1).system, true);
  assert.equal(lastMessage(p2).players.find((player) => player.playerId === 'p1').presence, 'ready');
  service.receive(p2.session, { type: 'setReady', ready: true });

  assert.equal(service.rooms.size, 1);
  assert.equal(p1.session.presence, 'in_ranked_match');
  assert.equal(p2.session.presence, 'in_ranked_match');
});

test('ready player stays queued while playing computer and can cancel matchmaking', async () => {
  const service = createTestService();
  const player = await connectTestPlayer(service, 'p1');
  service.receive(player.session, { type: 'enterLobby', displayName: 'JP' });

  service.receive(player.session, { type: 'setReady', ready: true });
  service.receive(player.session, { type: 'setPresence', presence: 'playing_computer' });

  assert.deepEqual(service.queue, [player.session]);
  assert.equal(player.session.presence, 'ready');
  assert.equal(lastMessage(player).players[0].presence, 'ready');

  service.receive(player.session, { type: 'setReady', ready: false });
  assert.deepEqual(service.queue, []);
  assert.equal(player.session.presence, 'idle');
});

test('player playing computer can be matched from the background queue', async () => {
  const service = createTestService();
  const p1 = await connectTestPlayer(service, 'p1');
  const p2 = await connectTestPlayer(service, 'p2');
  service.receive(p1.session, { type: 'enterLobby', displayName: 'JP' });
  service.receive(p2.session, { type: 'enterLobby', displayName: 'Chatman' });

  service.receive(p1.session, { type: 'setReady', ready: true });
  service.receive(p1.session, { type: 'setPresence', presence: 'playing_computer' });
  service.receive(p2.session, { type: 'setReady', ready: true });

  assert.equal(service.queue.length, 0);
  assert.equal(service.rooms.size, 1);
  assert.equal(p1.session.presence, 'in_ranked_match');
  assert.equal(p1.messages.some((message) => message.type === 'matchState'), true);
});

test('lobby chat sanitizes messages and keeps the latest 100', async () => {
  const service = createTestService();
  const player = await connectTestPlayer(service, 'p1');
  service.receive(player.session, { type: 'enterLobby', displayName: 'JP' });
  service.receive(player.session, { type: 'sendChat', text: '  hello   lobby  ' });
  assert.equal(lastMessage(player).message.text, 'hello lobby');

  for (let index = 0; index < 105; index += 1) service.receive(player.session, { type: 'sendChat', text: String(index) });
  assert.equal(service.chatMessages.length, 100);
  assert.equal(service.chatMessages[0].text, '5');
  assert.equal(service.chatMessages.at(-1).text, '104');
});

test('lobby whiteboard assigns colored text rows and shares validated strokes', async () => {
  const service = createTestService();
  const p1 = await connectTestPlayer(service, 'p1');
  const p2 = await connectTestPlayer(service, 'p2');
  service.receive(p1.session, { type: 'enterLobby', displayName: 'JP' });
  service.receive(p2.session, { type: 'enterLobby', displayName: 'Chatman' });

  service.receive(p1.session, { type: 'sendChat', text: 'hello', color: 'red' });
  const chat = lastMessage(p2).message;
  assert.equal(chat.color, 'red');
  assert.equal(chat.rowY, 68);
  assert.equal(chat.rowSpan, 1);

  service.receive(p1.session, {
    type: 'sendBoardStroke',
    color: 'not-a-color',
    points: [{ x: -10, y: -10 }, { x: 900, y: 9999 }],
  });
  const stroke = lastMessage(p2).operation;
  assert.equal(lastMessage(p2).type, 'boardOperation');
  assert.equal(stroke.color, 'black');
  assert.deepEqual(stroke.points, [{ x: 0, y: 0 }, { x: 760, y: 1575 }]);

  service.receive(p1.session, { type: 'sendChat', text: 'purple chat', color: 'purple' });
  assert.equal(lastMessage(p2).message.color, 'purple');
  service.receive(p1.session, {
    type: 'sendBoardStroke',
    color: 'purple',
    points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
  });
  assert.equal(lastMessage(p2).operation.color, 'purple');

  const snapshot = service.getBoardSnapshot();
  assert.equal(snapshot.operations.length, 4);
  assert.equal(snapshot.width, 760);
});

test('whiteboard erasers are shared and excessive stroke bursts are ignored', async () => {
  const service = createTestService();
  const p1 = await connectTestPlayer(service, 'p1');
  const p2 = await connectTestPlayer(service, 'p2');
  service.receive(p1.session, { type: 'enterLobby', displayName: 'JP' });
  service.receive(p2.session, { type: 'enterLobby', displayName: 'Chatman' });

  for (let index = 0; index < 20; index += 1) {
    service.receive(p1.session, { type: 'sendBoardErase', points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] });
  }

  assert.equal(service.boardOperations.length, 12);
  assert.equal(service.boardOperations[0].kind, 'erase');
  assert.equal(lastMessage(p2).operation.width, 120);
});

test('idle player can accept direct ranked challenge', async () => {
  const service = createTestService();
  const p1 = await connectTestPlayer(service, 'p1');
  const p2 = await connectTestPlayer(service, 'p2');
  service.receive(p1.session, { type: 'enterLobby', displayName: 'JP' });
  service.receive(p2.session, { type: 'enterLobby', displayName: 'Chatman' });
  service.receive(p1.session, { type: 'challengePlayer', playerId: 'p2' });
  const challenge = service.challenges.values().next().value;

  service.receive(p2.session, { type: 'respondChallenge', challengeId: challenge.id, accept: true });

  assert.equal(service.challenges.size, 0);
  assert.equal(service.rooms.size, 1);
  assert.equal(p1.session.roomId, p2.session.roomId);
});

test('challenge decline returns both players to idle', async () => {
  const service = createTestService();
  const p1 = await connectTestPlayer(service, 'p1');
  const p2 = await connectTestPlayer(service, 'p2');
  service.receive(p1.session, { type: 'enterLobby' });
  service.receive(p2.session, { type: 'enterLobby' });
  service.receive(p1.session, { type: 'challengePlayer', playerId: 'p2' });
  const challenge = service.challenges.values().next().value;
  service.receive(p2.session, { type: 'respondChallenge', challengeId: challenge.id, accept: false });

  assert.equal(p1.session.challengeId, null);
  assert.equal(p2.session.challengeId, null);
  assert.equal(service.rooms.size, 0);
});

test('challenge expires and releases both players', async () => {
  const service = createTestService({ challengeMs: 2 });
  const p1 = await connectTestPlayer(service, 'p1');
  const p2 = await connectTestPlayer(service, 'p2');
  service.receive(p1.session, { type: 'enterLobby' });
  service.receive(p2.session, { type: 'enterLobby' });
  service.receive(p1.session, { type: 'challengePlayer', playerId: 'p2' });
  await wait(8);
  assert.equal(service.challenges.size, 0);
  assert.equal(p1.session.challengeId, null);
  assert.equal(p2.session.challengeId, null);
  assert.equal(p1.messages.findLast((message) => message.type === 'challengeUpdated').status, 'expired');
});

function createTestService({
  store = new MemoryPlayerStore(),
  now = () => 0,
  turnMs = 1000,
  revealMs = 1000,
  noSelectionGraceMs = 1000,
  noContestWaitingMs = 1000,
  noContestCountdownMs = 1000,
  allowDebugWinGame = false,
  analyticsStore,
  challengeMs,
} = {}) {
  return new RankedDuelService({
    playerStore: store,
    countdownMs: 1000,
    revealMs,
    turnMs,
    noSelectionGraceMs,
    noContestWaitingMs,
    noContestCountdownMs,
    allowDebugWinGame,
    analyticsStore,
    challengeMs,
    now,
    createId: createIncrementingId(),
  });
}

async function createMatchedService(options) {
  const store = new MemoryPlayerStore();
  const service = createTestService({ ...options, store });
  const p1 = await connectTestPlayer(service, 'p1');
  const p2 = await connectTestPlayer(service, 'p2');

  service.receive(p1.session, { type: 'joinRanked', variantId: options?.variantId });
  service.receive(p2.session, { type: 'joinRanked', variantId: options?.variantId });

  return { service, p1, p2, store };
}

async function connectTestPlayer(service, playerId) {
  const messages = [];
  const client = {
    closed: false,
    send(raw) {
      messages.push(JSON.parse(raw));
    },
    close() {
      this.closed = true;
      this.closeArgs = [...arguments];
    },
  };
  const session = await service.connect(client, playerId);

  return { session, messages, client };
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
  room.roundState = createRoundState({ variantId: room.variantId });
  room.phase = 'choosing';
  return room.roundState;
}
