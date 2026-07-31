const PLAYERS = Object.freeze(['p1', 'p2']);
const SPECIALS = Object.freeze(['fireball', 'poweredStrike', 'reversal']);

export function createKitchenSinkVariant({ id, moves }) {
  const variant = {
    id,
    label: 'Kitchen Sink!',
    isRanked: true,
    targetRoundWins: 2,
    moveIds: Object.freeze([
      'strike', 'advance', 'bait', 'charge', 'super',
      'fireball', 'poweredStrike', 'reversal',
    ]),
    moves,
    resourceMax: 3,
    startResource: 0,
    persistResourceBetweenRounds: true,
    initialPhase: 'choose',
    createRoundData: () => ({
      hp: { p1: 3, p2: 3 },
      position: 'neutral',
      punished: null,
      freeMoveActor: null,
    }),
    getLegalMovesFromState(state, playerId) {
      if (state.phase === 'freeMove' && state.freeMoveActor !== playerId) return ['wait'];
      const bars = state.players[playerId].resource;
      const actions = ['strike', 'advance', 'bait', bars === 3 ? 'super' : 'charge'];
      if (bars > 0) actions.push(getSpecialName(state, playerId));
      return actions;
    },
  };

  return Object.freeze({
    ...variant,
    resolveTurn: (turn) => resolveKitchenSinkTurn({ variant, ...turn }),
  });
}

function getSpecialName(state, playerId) {
  if (state.position === 'neutral') return 'fireball';
  return state.position === `${playerId}-center` ? 'poweredStrike' : 'reversal';
}

function resolveKitchenSinkTurn({ variant, state, p1Move, p2Move, p1Resource, p2Resource }) {
  const picks = { p1: p1Move, p2: p2Move };
  for (const playerId of PLAYERS) {
    if (!variant.getLegalMovesFromState(state, playerId).includes(picks[playerId])) {
      return { ok: false, errors: [`${playerId} picked illegal move: ${picks[playerId]}`] };
    }
  }

  const next = {
    hp: { ...state.hp },
    bars: { p1: p1Resource, p2: p2Resource },
    position: state.position,
    punished: null,
    freeMoveActor: null,
  };

  if (state.phase === 'freeMove') resolveFreeMove(next, state.freeMoveActor, picks[state.freeMoveActor]);
  else {
    spendBars(next, picks);
    if (state.position === 'neutral') resolveNeutral(next, picks);
    else resolvePosition(next, picks, state.position.startsWith('p1') ? 'p1' : 'p2');
  }

  next.hp.p1 = Math.max(0, next.hp.p1);
  next.hp.p2 = Math.max(0, next.hp.p2);
  const winner = next.hp.p1 <= 0 ? 'p2' : next.hp.p2 <= 0 ? 'p1' : null;
  const freeMoveActor = winner ? null : next.punished ? other(next.punished) : null;

  return {
    ok: true,
    variantId: variant.id,
    p1Move,
    p2Move,
    p1Resource: next.bars.p1,
    p2Resource: next.bars.p2,
    resources: { ...next.bars },
    p1Hit: next.hp.p2 < state.hp.p2 ? 'hit' : null,
    p2Hit: next.hp.p1 < state.hp.p1 ? 'hit' : null,
    winner,
    isRoundOver: Boolean(winner),
    isTie: !winner,
    nextPhase: freeMoveActor ? 'freeMove' : 'choose',
    nextStateData: {
      hp: next.hp,
      position: next.position,
      punished: next.punished,
      freeMoveActor,
    },
  };
}

function spendBars(state, picks) {
  for (const player of PLAYERS) {
    if (SPECIALS.includes(picks[player])) state.bars[player]--;
    if (picks[player] === 'super') state.bars[player] = 0;
  }
}

function resolveNeutral(state, picks) {
  if (picks.p1 === picks.p2) {
    if (picks.p1 === 'charge') {
      gain(state, 'p1');
      gain(state, 'p2');
    }
    if (picks.p1 === 'super') {
      if (state.hp.p1 === state.hp.p2) {
        state.hp.p1 = 1;
        state.hp.p2 = 1;
      } else {
        damage(state, state.hp.p1 > state.hp.p2 ? 'p2' : 'p1', 3);
      }
    }
    return;
  }

  for (const player of PLAYERS) {
    const foe = other(player);
    const move = picks[player];
    const foeMove = picks[foe];
    if (move === 'charge' && !['strike', 'fireball', 'super'].includes(foeMove)) gain(state, player);
    if (move === 'strike' && ['advance', 'charge'].includes(foeMove)) damage(state, foe, 1);
    if (move === 'fireball' && ['strike', 'advance', 'charge'].includes(foeMove)) damage(state, foe, 1);
    if (move === 'super') damage(state, foe, foeMove === 'bait' ? 1 : 3);
  }
  if ((picks.p1 === 'advance' && ['bait', 'charge'].includes(picks.p2))
    || (picks.p1 === 'bait' && ['strike', 'charge'].includes(picks.p2))) state.position = 'p1-center';
  if ((picks.p2 === 'advance' && ['bait', 'charge'].includes(picks.p1))
    || (picks.p2 === 'bait' && ['strike', 'charge'].includes(picks.p1))) state.position = 'p2-center';
}

function resolvePosition(state, picks, center) {
  const corner = other(center);
  const reset = () => { state.position = 'neutral'; };
  const rows = {
    strike: {
      strike: () => damage(state, corner, 1), advance: () => damage(state, corner, 1),
      bait: reset, charge: () => damage(state, corner, 1),
      reversal: () => { damage(state, center, 1); reset(); },
      super: () => damage(state, center, 3),
    },
    advance: {
      strike: () => damage(state, center, 1), advance: () => {},
      bait: () => damage(state, corner, 1),
      charge: () => damage(state, corner, 1),
      reversal: () => { damage(state, center, 1); reset(); },
      super: () => damage(state, center, 3),
    },
    bait: {
      strike: () => { state.punished = corner; }, advance: reset, bait: () => {},
      charge: () => gain(state, corner),
      reversal: () => { state.punished = corner; },
      super: () => { damage(state, center, 1); reset(); },
    },
    charge: {
      strike: () => damage(state, center, 1),
      advance: () => { gain(state, center); reset(); },
      bait: () => gain(state, center),
      charge: () => { gain(state, center); gain(state, corner); },
      reversal: () => { damage(state, center, 1); reset(); },
      super: () => damage(state, center, 3),
    },
    poweredStrike: {
      strike: () => damage(state, corner, 2), advance: () => damage(state, corner, 2),
      bait: () => {}, charge: () => damage(state, corner, 2),
      reversal: () => { damage(state, center, 1); reset(); },
      super: () => damage(state, center, 3),
    },
    super: {
      strike: () => damage(state, corner, 3), advance: () => damage(state, corner, 3),
      bait: () => damage(state, corner, 1), charge: () => damage(state, corner, 3),
      reversal: () => damage(state, corner, 3),
      super: () => damage(state, state.hp.p1 === state.hp.p2 ? corner : state.hp.p1 > state.hp.p2 ? 'p2' : 'p1', 3),
    },
  };
  rows[picks[center]][picks[corner]]();
}

function resolveFreeMove(state, actor, action) {
  const foe = other(actor);
  if (action === 'strike') damage(state, foe, 1);
  if (action === 'charge') gain(state, actor);
  if (action === 'poweredStrike') { state.bars[actor]--; damage(state, foe, 2); }
  if (action === 'fireball') { state.bars[actor]--; damage(state, foe, 1); }
  if (action === 'reversal') { state.bars[actor]--; damage(state, foe, 1); state.position = 'neutral'; }
  if (action === 'super') { state.bars[actor] = 0; damage(state, foe, 3); }
}

function damage(state, player, amount) { state.hp[player] -= amount; }
function gain(state, player) { state.bars[player] = Math.min(3, state.bars[player] + 1); }
function other(player) { return player === 'p1' ? 'p2' : 'p1'; }
