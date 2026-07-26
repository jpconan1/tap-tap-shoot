import { PLAYERS, appendEvent, rpsWinner, simultaneousReducer, title } from '../sessionCore.js';
import { complete, continuePhase, stateWithResources } from './shared.js';

const PAIRS = Object.freeze({
  rockPaper: ['rock', 'paper'],
  paperScissors: ['paper', 'scissors'],
  scissorsRock: ['scissors', 'rock'],
});

export const rpsMinusOneDefinition = {
  id: 'rpsMinusOne',
  createState: () => ({
    variantId: 'rpsMinusOne', variantName: 'RPS Minus One', status: 'playing',
    phase: 'choose-pair', activePlayers: [...PLAYERS], prompt: 'Choose a pair.', pending: {},
    pairs: null, scores: { p1: 0, p2: 0 }, round: 1, events: [],
  }),
  getLegalActions: (state, playerId) => {
    if (state.phase === 'choose-pair') return Object.keys(PAIRS);
    if (state.phase === 'keep') return PAIRS[state.pairs[playerId]];
    return ['rock', 'paper', 'scissors'];
  },
  reduce(state, command) {
    return simultaneousReducer({
      state, command,
      resolve: (clean, picks) => {
        if (clean.phase === 'choose-pair') {
          if (picks.p1 === picks.p2) return scoreRound(clean, picks, null, true);
          return {
            ...clean, phase: 'keep', pairs: picks, activePlayers: [...PLAYERS],
            prompt: 'Choose which move to KEEP.',
            scene: `Pairs revealed: ${title(picks.p1)} versus ${title(picks.p2)}.`,
            events: appendEvent(clean, `Pairs: ${title(picks.p1)} / ${title(picks.p2)}`),
          };
        }
        const winner = rpsWinner(picks.p1, picks.p2);
        if (clean.phase === 'sudden-death') {
          return winner
            ? complete(clean, winner, `${picks.p1} versus ${picks.p2}`)
            : continuePhase(clean, 'sudden-death', picks);
        }
        return scoreRound(clean, picks, winner, !winner);
      },
    });
  },
  present: stateWithResources('Pips'),
};

function scoreRound(state, picks, winner, tie) {
  const scores = { ...state.scores };
  if (tie) { scores.p1++; scores.p2++; } else scores[winner] += 2;
  const scene = tie
    ? `${title(picks.p1)} and ${title(picks.p2)} tie. Both gain 1 pip.`
    : `${title(picks[winner])} wins. ${winner} gains 2 pips.`;
  if (scores.p1 >= 6 && scores.p2 >= 6) {
    return {
      ...state, scores, phase: 'sudden-death', activePlayers: [...PLAYERS],
      prompt: 'Sudden death: choose RPS.', scene, pairs: null,
      events: appendEvent(state, scene),
    };
  }
  const matchWinner = scores.p1 >= 6 ? 'p1' : scores.p2 >= 6 ? 'p2' : null;
  if (matchWinner) return complete({ ...state, scores }, matchWinner, scene);
  return {
    ...state, scores, phase: 'choose-pair', activePlayers: [...PLAYERS],
    prompt: 'Choose a pair.', scene, pairs: null, round: state.round + 1,
    events: appendEvent(state, scene),
  };
}
