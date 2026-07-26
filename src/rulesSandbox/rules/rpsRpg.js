import { PLAYERS, appendEvent, basePresentation, rpsWinner, simultaneousReducer, title } from '../sessionCore.js';
import { complete, continuePhase } from './shared.js';

const MOVE_STATS = Object.freeze({ sword: 'str', staff: 'int', bow: 'dex' });

export const rpsRpgDefinition = {
  id: 'rpsRpg',
  createState: () => ({
    variantId: 'rpsRpg', variantName: 'RPS RPG', status: 'playing',
    phase: 'level', activePlayers: [...PLAYERS], prompt: 'Choose a stat to level.', pending: {},
    scores: { p1: 0, p2: 0 },
    stats: { p1: { str: 0, int: 0, dex: 0 }, p2: { str: 0, int: 0, dex: 0 } },
    round: 1, events: [],
  }),
  getLegalActions: (state) => state.phase === 'level' ? ['str', 'int', 'dex'] : ['sword', 'staff', 'bow'],
  reduce(state, command) {
    return simultaneousReducer({
      state, command,
      resolve: (clean, picks) => {
        if (clean.phase === 'level') {
          const stats = { p1: { ...clean.stats.p1 }, p2: { ...clean.stats.p2 } };
          for (const player of PLAYERS) stats[player][picks[player]]++;
          return {
            ...clean, stats, phase: 'move', activePlayers: [...PLAYERS], prompt: 'Choose a move.',
            scene: `P1 levels ${picks.p1.toUpperCase()}; P2 levels ${picks.p2.toUpperCase()}.`,
            events: appendEvent(clean, `Level: ${picks.p1} / ${picks.p2}`),
          };
        }
        let winner = rpsWinner(picks.p1, picks.p2, { sword: 'staff', staff: 'bow', bow: 'sword' });
        if (!winner && picks.p1 === picks.p2) {
          const stat = MOVE_STATS[picks.p1];
          if (clean.stats.p1[stat] !== clean.stats.p2[stat]) winner = clean.stats.p1[stat] > clean.stats.p2[stat] ? 'p1' : 'p2';
        }
        if (!winner) return continuePhase(clean, 'move', picks, 'Tie. Choose moves again.');
        const scores = { ...clean.scores, [winner]: clean.scores[winner] + 1 };
        const scene = `${title(picks.p1)} versus ${title(picks.p2)}. ${winner} scores.`;
        if (scores[winner] >= 5) return complete({ ...clean, scores }, winner, scene);
        return {
          ...clean, scores, phase: 'level', activePlayers: [...PLAYERS],
          prompt: 'Choose a stat to level.', round: clean.round + 1, scene,
          events: appendEvent(clean, scene),
        };
      },
    });
  },
  present(state) {
    return basePresentation(state, state.scene ?? 'Stats begin at zero.', [
      `P1 STR/INT/DEX: ${Object.values(state.stats.p1).join('/')}`,
      `P2 STR/INT/DEX: ${Object.values(state.stats.p2).join('/')}`,
      `Score: ${state.scores.p1}-${state.scores.p2}`,
    ]);
  },
};
