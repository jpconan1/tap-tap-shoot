const MATCH_RULES = Object.freeze({
  rockPaperScissors: Object.freeze({
    autoAdvanceRound: true,
  }),
});

const DEFAULT_MATCH_RULES = Object.freeze({
  autoAdvanceRound: false,
});

export function getMatchRules(variantId) {
  return MATCH_RULES[variantId] ?? DEFAULT_MATCH_RULES;
}

export function shouldAutoAdvanceRound(variantId) {
  return getMatchRules(variantId).autoAdvanceRound;
}
