import { PLAYERS, appendEvent, basePresentation, title } from '../sessionCore.js';

export function scoreFirstTo(state, picks, winner, target) {
  const scores = { ...state.scores };
  if (winner) scores[winner]++;
  const scene = winner
    ? `${title(picks.p1)} versus ${title(picks.p2)}. ${winner} scores.`
    : `${title(picks.p1)} versus ${title(picks.p2)}. Tie.`;
  if (winner && scores[winner] >= target) return complete({ ...state, scores }, winner, scene);
  return {
    ...state, scores, pending: {}, activePlayers: [...PLAYERS],
    round: state.round + 1, prompt: 'Both players choose.', scene,
    events: appendEvent(state, scene),
  };
}

export function scoreExistingRound(state, picks, winner, resetState) {
  const scores = { ...state.scores, [winner]: state.scores[winner] + 1 };
  const scene = `${title(picks.p1)} versus ${title(picks.p2)}. ${winner} wins round.`;
  if (scores[winner] >= 3) return complete({ ...state, scores }, winner, scene);
  return {
    ...state, ...resetState, scores, pending: {}, activePlayers: [...PLAYERS],
    round: state.round + 1, prompt: 'Both players choose.', scene,
    events: appendEvent(state, scene),
  };
}

export function continuePhase(state, phase, picks, prompt = 'Tie. Choose again.') {
  const scene = `${title(picks.p1)} versus ${title(picks.p2)}. Tie.`;
  return { ...state, phase, pending: {}, activePlayers: [...PLAYERS], prompt, scene, events: appendEvent(state, scene) };
}

export function complete(state, winner, scene) {
  return {
    ...state, status: 'complete', winner, activePlayers: [], pending: {},
    prompt: `${winner} wins.`, scene, events: appendEvent(state, scene),
  };
}

export function stateWithResources(label) {
  return (state) => {
    const resource = state.bars ?? state.hp ?? state.ap ?? state.scores;
    return basePresentation(state, state.scene ?? `${state.variantName}: waiting.`, [
      `${label}: P1 ${resource.p1}, P2 ${resource.p2}`,
      `Score: ${state.scores.p1}-${state.scores.p2}`,
    ]);
  };
}
