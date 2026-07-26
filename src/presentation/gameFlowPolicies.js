import { shouldAutoAdvanceRound } from '../engine/matchRules.js';

const DEFAULT_POLICY = Object.freeze({
  readyScene: 'split',
  roundResult: 'overlay',
  super: false,
});

const POLICIES = Object.freeze({
  rockPaperScissors: Object.freeze({
    ...DEFAULT_POLICY,
    roundResult: 'persist-reveal',
  }),
  rpsDragonSpear: Object.freeze({
    ...DEFAULT_POLICY,
    roundResult: 'persist-reveal',
  }),
  fireballWar: Object.freeze({
    ...DEFAULT_POLICY,
    super: true,
  }),
});

export function getGameFlowPolicy(variantId) {
  const presentation = POLICIES[variantId] ?? DEFAULT_POLICY;
  return {
    ...presentation,
    autoAdvanceRound: shouldAutoAdvanceRound(variantId),
  };
}

export { shouldAutoAdvanceRound } from '../engine/matchRules.js';
