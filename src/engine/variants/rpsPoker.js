const RPS = Object.freeze(['rock', 'paper', 'scissors']);

export function createRpsPokerVariant({ id, moves }) {
  const variant = {
    id,
    label: 'RPS Poker',
    isRanked: false,
    targetRoundWins: 1,
    moveIds: Object.freeze([...RPS, 'check', 'bet', 'fold', 'call', 'raise']),
    moves,
    resourceMax: 0,
    startResource: 0,
    initialPhase: 'lock',
    createRoundData: () => beginHand({
      stacks: { p1: 9, p2: 9 },
      hand: 0,
      firstActor: 'p1',
    }),
    getLegalMovesFromState(state, playerId) {
      if (['lock', 'forcedRps'].includes(state.phase)) return RPS;
      if (state.phase !== 'betting' || state.actor !== playerId) return ['wait'];
      const foe = other(playerId);
      const toCall = state.committed[foe] - state.committed[playerId];
      const maxTotal = state.committed[playerId]
        + Math.min(state.stacks[playerId], state.stacks[foe] + Math.max(0, toCall));
      if (toCall > 0) {
        const actions = ['fold', 'call'];
        if (maxTotal > state.committed[foe]) {
          const min = Math.min(maxTotal, state.committed[foe] + state.minRaise);
          for (let amount = min; amount <= maxTotal; amount++) actions.push(`raise:${amount}`);
        }
        return actions;
      }
      const actions = ['check'];
      const max = Math.min(state.stacks.p1, state.stacks.p2);
      for (let amount = 1; amount <= max; amount++) actions.push(`bet:${amount}`);
      return actions;
    },
  };
  return Object.freeze({ ...variant, resolveTurn: (turn) => resolvePokerTurn({ variant, ...turn }) });
}

function resolvePokerTurn({ variant, state, p1Move, p2Move, p1Resource, p2Resource }) {
  const picks = { p1: p1Move, p2: p2Move };
  for (const player of ['p1', 'p2']) {
    if (!variant.getLegalMovesFromState(state, player).includes(picks[player])) {
      return { ok: false, errors: [`${player} picked illegal poker action: ${picks[player]}`] };
    }
  }

  let next;
  if (state.phase === 'lock') {
    next = {
      ...pokerData(state),
      locked: picks,
      community: randomRps(),
      phase: 'betting',
      actor: state.firstActor,
    };
  } else if (state.phase === 'forcedRps') {
    const winner = rpsWinner(p1Move, p2Move);
    if (!winner) next = { ...pokerData(state), phase: 'forcedRps' };
    else {
      const stacks = { ...state.stacks, [winner]: state.stacks[winner] + state.pot };
      next = stacks[other(winner)] === 0
        ? { ...pokerData(state), stacks, pot: 0, winner }
        : beginHand({ ...pokerData(state), stacks, pot: 0 });
    }
  } else {
    const actor = state.actor;
    next = reduceBetting(state, picks[actor]);
  }

  const winner = next.winner ?? null;
  return {
    ok: true,
    variantId: variant.id,
    p1Move,
    p2Move,
    p1Resource,
    p2Resource,
    resources: { p1: p1Resource, p2: p2Resource },
    p1Hit: winner === 'p1' ? 'won' : null,
    p2Hit: winner === 'p2' ? 'won' : null,
    winner,
    isRoundOver: Boolean(winner),
    isTie: !winner,
    gameWinner: winner,
    scoreAwards: winner ? { p1: winner === 'p1' ? 1 : 0, p2: winner === 'p2' ? 1 : 0 } : { p1: 0, p2: 0 },
    nextPhase: next.phase,
    nextStateData: next,
  };
}

function reduceBetting(state, encodedAction) {
  const player = state.actor;
  const foe = other(player);
  const [action, amountText] = encodedAction.split(':');
  const amount = Number(amountText);
  if (action === 'fold') {
    const stacks = { ...state.stacks, [foe]: state.stacks[foe] + state.pot };
    return stacks[player] === 0
      ? { ...pokerData(state), stacks, pot: 0, winner: foe }
      : beginHand({ ...pokerData(state), stacks, pot: 0 });
  }
  if (action === 'check') {
    if (state.checkedOnce) return showdown(state);
    return { ...pokerData(state), checkedOnce: true, actor: foe };
  }
  if (action === 'call') {
    const callAmount = state.committed[foe] - state.committed[player];
    return showdown({
      ...pokerData(state),
      stacks: { ...state.stacks, [player]: state.stacks[player] - callAmount },
      committed: { ...state.committed, [player]: state.committed[player] + callAmount },
      pot: state.pot + callAmount,
    });
  }
  const oldTarget = state.committed[foe];
  const add = amount - state.committed[player];
  return {
    ...pokerData(state),
    stacks: { ...state.stacks, [player]: state.stacks[player] - add },
    committed: { ...state.committed, [player]: amount },
    pot: state.pot + add,
    minRaise: Math.max(1, amount - oldTarget),
    actor: foe,
    checkedOnce: false,
  };
}

function showdown(state) {
  const strength = (move) => move === state.community ? 1 : rpsWinner(move, state.community) === 'p1' ? 2 : 0;
  const p1 = strength(state.locked.p1);
  const p2 = strength(state.locked.p2);
  const stacks = { ...state.stacks };
  if (p1 === p2) {
    stacks.p1 += state.pot / 2;
    stacks.p2 += state.pot / 2;
  } else stacks[p1 > p2 ? 'p1' : 'p2'] += state.pot;
  const winner = stacks.p1 === 0 ? 'p2' : stacks.p2 === 0 ? 'p1' : null;
  return winner ? { ...pokerData(state), stacks, pot: 0, winner } : beginHand({ ...pokerData(state), stacks, pot: 0 });
}

function beginHand(state) {
  const hand = state.hand + 1;
  const ante = hand;
  const paid = Math.min(ante, state.stacks.p1, state.stacks.p2);
  const stacks = { p1: state.stacks.p1 - paid, p2: state.stacks.p2 - paid };
  const base = {
    ...state,
    hand,
    ante,
    stacks,
    pot: paid * 2,
    committed: { p1: 0, p2: 0 },
    locked: {},
    community: null,
    checkedOnce: false,
    minRaise: 1,
    actor: null,
    winner: null,
    firstActor: hand === 1 ? state.firstActor : other(state.firstActor),
  };
  return {
    ...base,
    phase: stacks.p1 === 0 || stacks.p2 === 0 ? 'forcedRps' : 'lock',
  };
}

function pokerData(state) {
  return {
    stacks: { ...state.stacks },
    hand: state.hand,
    ante: state.ante,
    pot: state.pot,
    committed: { ...state.committed },
    locked: { ...state.locked },
    community: state.community,
    checkedOnce: state.checkedOnce,
    minRaise: state.minRaise,
    actor: state.actor,
    firstActor: state.firstActor,
    winner: state.winner ?? null,
    phase: state.phase,
  };
}

function randomRps() { return RPS[Math.floor(Math.random() * RPS.length)]; }
function other(player) { return player === 'p1' ? 'p2' : 'p1'; }
function rpsWinner(p1, p2) {
  if (p1 === p2) return null;
  return { rock: 'scissors', scissors: 'paper', paper: 'rock' }[p1] === p2 ? 'p1' : 'p2';
}
