export function getWholePercentageDistribution(distribution) {
  return distribution.map(({ moveId, probability }) => ({
    moveId,
    percentage: Math.floor(probability * 100),
  }));
}

export function shouldShowCpuOdds({ playMode, turnPhase, status }) {
  return playMode === 'local' && turnPhase !== 'round-over' && status === 'playing';
}
