const DEFAULT_POLICY = Object.freeze({
  autoAdvanceRound: false,
  readyScene: 'split',
  roundResult: 'overlay',
  super: false,
});

const POLICIES = Object.freeze({
  rockPaperScissors: Object.freeze({
    ...DEFAULT_POLICY,
    autoAdvanceRound: true,
    roundResult: 'persist-reveal',
  }),
  fireballWar: Object.freeze({
    ...DEFAULT_POLICY,
    super: true,
  }),
});

export function getGameFlowPolicy(variantId) {
  return POLICIES[variantId] ?? DEFAULT_POLICY;
}

export function shouldAutoAdvanceRound(variantId) {
  return getGameFlowPolicy(variantId).autoAdvanceRound;
}
