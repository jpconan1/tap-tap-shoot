export const ONLINE_FLOW_SEQUENCE = Object.freeze({
  MATCH_FOUND: Object.freeze([
    Object.freeze({ type: 'commit' }),
    Object.freeze({ type: 'show', stage: 'match-found' }),
    Object.freeze({ type: 'openCurtains' }),
    Object.freeze({ type: 'waitBeats', beats: 2 }),
    Object.freeze({ type: 'closeCurtains' }),
  ]),
  VARIANT_SELECTION_STARTED: Object.freeze([
    Object.freeze({ type: 'closeCurtains' }),
    Object.freeze({ type: 'commit' }),
    Object.freeze({ type: 'show', stage: 'variant-select' }),
    Object.freeze({ type: 'openCurtains' }),
  ]),
  VARIANTS_CHOSEN: Object.freeze([
    Object.freeze({ type: 'cancelMailbox' }),
    Object.freeze({ type: 'closeCurtains' }),
    Object.freeze({ type: 'commit' }),
    Object.freeze({ type: 'show', stage: 'scoreboard' }),
    Object.freeze({ type: 'openCurtains' }),
    Object.freeze({ type: 'waitBeats', beats: 5 }),
    Object.freeze({ type: 'spikeWipe', stage: 'playing' }),
    Object.freeze({ type: 'openingCues' }),
  ]),
  NEXT_VARIANT_STARTED: Object.freeze([
    Object.freeze({ type: 'closeCurtains' }),
    Object.freeze({ type: 'commit' }),
    Object.freeze({ type: 'show', stage: 'playing' }),
    Object.freeze({ type: 'openCurtains' }),
    Object.freeze({ type: 'openingCues' }),
  ]),
  VARIANT_GAME_FINISHED: Object.freeze([
    Object.freeze({ type: 'commit' }),
    Object.freeze({ type: 'show', stage: 'playing' }),
    Object.freeze({ type: 'waitBeats', beats: 2 }),
    Object.freeze({ type: 'closeCurtains' }),
    Object.freeze({ type: 'show', stage: 'scoreboard' }),
    Object.freeze({ type: 'openCurtains' }),
  ]),
  MATCH_FINISHED: Object.freeze([
    Object.freeze({ type: 'commit' }),
    Object.freeze({ type: 'spikeWipe', stage: 'playing' }),
    Object.freeze({ type: 'disconnect' }),
  ]),
  FINAL_SCOREBOARD: Object.freeze([
    Object.freeze({ type: 'closeCurtains' }),
    Object.freeze({ type: 'show', stage: 'scoreboard' }),
    Object.freeze({ type: 'openCurtains' }),
  ]),
  RETURN_TO_TITLE: Object.freeze([
    Object.freeze({ type: 'closeCurtains' }),
    Object.freeze({ type: 'exitRanked' }),
    Object.freeze({ type: 'show', stage: 'title' }),
    Object.freeze({ type: 'openCurtains' }),
  ]),
});

export function interpretOnlineSnapshot(previous, next, transitionId = null) {
  if (!previous && next?.phase === 'countdown') return 'MATCH_FOUND';
  if (transitionId === 'variant-set-started') return 'VARIANTS_CHOSEN';
  if (transitionId === 'round-ended' && next?.pendingNextVariant) return 'VARIANT_GAME_FINISHED';
  if (
    transitionId === 'match-ended'
    && next?.phase === 'gameOver'
    && next?.gameResults?.length === 2
    && next?.gameWins?.[next.winner] === 2
  ) return 'MATCH_FINISHED';
  if (transitionId === 'next-turn-started' && previous?.pendingNextVariant) return 'NEXT_VARIANT_STARTED';
  if (next?.phase === 'variantSelection' && previous?.phase !== 'variantSelection') {
    return 'VARIANT_SELECTION_STARTED';
  }
  return 'SNAPSHOT_UPDATED';
}
