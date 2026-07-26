import { PLAYERS, basePresentation, otherPlayer, rpsWinner, simultaneousReducer } from '../sessionCore.js';
import { scoreFirstTo } from './shared.js';

export const rpsDragonSpearDefinition = {
  id: 'rpsDragonSpear',
  createState: () => ({
    variantId: 'rpsDragonSpear', variantName: 'RPS Dragon Spear', status: 'playing',
    phase: 'choose', activePlayers: [...PLAYERS], prompt: 'Both players choose.',
    pending: {}, events: [], scores: { p1: 0, p2: 0 }, round: 1,
    dragonAvailable: { p1: true, p2: true },
  }),
  getLegalActions: (state, playerId) => [
    'rock', 'paper', 'scissors',
    ...(state.dragonAvailable[playerId] ? ['dragon'] : []),
    'spear',
  ],
  reduce: (state, command) => simultaneousReducer({
    state, command,
    resolve: (clean, picks) => {
      let winner = null;
      if (picks.p1 !== picks.p2) {
        if (picks.p1 === 'dragon' || picks.p2 === 'dragon') {
          winner = picks.p1 === 'spear' || picks.p2 === 'spear'
            ? (picks.p1 === 'spear' ? 'p1' : 'p2')
            : (picks.p1 === 'dragon' ? 'p1' : 'p2');
        } else if (picks.p1 === 'spear' || picks.p2 === 'spear') {
          winner = picks.p1 === 'spear' ? 'p2' : 'p1';
        } else {
          winner = rpsWinner(picks.p1, picks.p2);
        }
      }
      const dragonAvailable = { ...clean.dragonAvailable };
      if (winner && picks[otherPlayer(winner)] === 'dragon') dragonAvailable[otherPlayer(winner)] = false;
      return scoreFirstTo({ ...clean, dragonAvailable }, picks, winner, 5);
    },
  }),
  present: (state) => basePresentation(state, state.scene ?? 'Dragon is permanent until Spear defeats it.', [
    `Score: ${state.scores.p1}-${state.scores.p2}`,
    `Dragon: P1 ${state.dragonAvailable.p1 ? 'ready' : 'dead'}, P2 ${state.dragonAvailable.p2 ? 'ready' : 'dead'}`,
  ]),
};
