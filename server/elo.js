export const DEFAULT_RATING = 1000;
export const DEFAULT_K_FACTOR = 32;

export function getExpectedScore(playerRating, opponentRating) {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

export function getNextRating(playerRating, opponentRating, score, kFactor = DEFAULT_K_FACTOR) {
  return Math.round(playerRating + kFactor * (score - getExpectedScore(playerRating, opponentRating)));
}

export function updateRatings(playerRating, opponentRating, didPlayerWin, kFactor = DEFAULT_K_FACTOR) {
  return {
    player: getNextRating(playerRating, opponentRating, didPlayerWin ? 1 : 0, kFactor),
    opponent: getNextRating(opponentRating, playerRating, didPlayerWin ? 0 : 1, kFactor),
  };
}
