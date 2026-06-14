import { MAX_AP, getMove, isBlockedByApCap, isForcedReload } from './moves.js';

const HIT_TABLE = Object.freeze({
  shoot: Object.freeze({
    stab: 'shot',
    counterstab: 'shot',
    reload: 'shot',
  }),
  stab: Object.freeze({
    block: 'stabbed',
    reload: 'stabbed',
  }),
});

export function resolveTurn({ p1Move, p2Move, p1Ap, p2Ap }) {
  const p1 = validateChoice('p1', p1Move, p1Ap, p2Ap);
  const p2 = validateChoice('p2', p2Move, p2Ap, p1Ap);

  if (!p1.ok || !p2.ok) {
    return {
      ok: false,
      errors: [p1.error, p2.error].filter(Boolean),
    };
  }

  const p1Hit = HIT_TABLE[p1Move]?.[p2Move] ?? null;
  const p2Hit = HIT_TABLE[p2Move]?.[p1Move] ?? null;
  const winner = p1Hit && !p2Hit ? 'p1' : p2Hit && !p1Hit ? 'p2' : null;

  return {
    ok: true,
    p1Move,
    p2Move,
    p1Ap: spendAndGain(p1Ap, p1Move),
    p2Ap: spendAndGain(p2Ap, p2Move),
    p1Hit,
    p2Hit,
    winner,
    isRoundOver: winner !== null,
    isTie: winner === null,
  };
}

function validateChoice(player, moveId, ap, opponentAp) {
  const move = getMove(moveId);

  if (!move) {
    return { ok: false, error: `${player} picked unknown move: ${moveId}` };
  }

  if (isForcedReload(ap, opponentAp) && moveId !== 'reload') {
    return { ok: false, error: `${player} must reload at 0-0` };
  }

  if (isBlockedByApCap(moveId, ap)) {
    return { ok: false, error: `${player} cannot reload at ${MAX_AP}` };
  }

  if (ap < move.cost) {
    return { ok: false, error: `${player} cannot afford ${moveId}` };
  }

  return { ok: true };
}

function spendAndGain(ap, moveId) {
  const move = getMove(moveId);
  return Math.min(MAX_AP, ap - move.cost + move.gain);
}
