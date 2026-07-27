const BEATS = Object.freeze({
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
});

export const RPS_POKER_MOVES = Object.freeze(Object.keys(BEATS));

export function getRpsPokerAnte(hand) {
  return Math.ceil(hand / 2);
}

export function getRpsPokerAnteLoser(stacks, ante) {
  const p1CanPay = stacks.p1 >= ante;
  const p2CanPay = stacks.p2 >= ante;
  if (p1CanPay && p2CanPay) return null;
  if (!p1CanPay && p2CanPay) return 'p1';
  if (p1CanPay && !p2CanPay) return 'p2';
  if (stacks.p1 === stacks.p2) return null;
  return stacks.p1 < stacks.p2 ? 'p1' : 'p2';
}

export function getRpsPokerAntePayment(stacks, ante) {
  return Math.min(ante, stacks.p1, stacks.p2);
}

export function shouldPlayRpsPokerTopper({ stacks, hand }) {
  const nextAnte = getRpsPokerAnte(hand + 1);
  return stacks.p1 < nextAnte || stacks.p2 < nextAnte;
}

export function getRpsPokerStrength(move, community) {
  if (move === community) return 1;
  return BEATS[move] === community ? 2 : 0;
}

export function getRpsPokerShowdownWinner(locked, community) {
  const p1Strength = getRpsPokerStrength(locked.p1, community);
  const p2Strength = getRpsPokerStrength(locked.p2, community);
  if (p1Strength === p2Strength) return null;
  return p1Strength > p2Strength ? 'p1' : 'p2';
}

export function distributeRpsPokerPot(stacks, pot, winner) {
  if (winner) {
    return { ...stacks, [winner]: stacks[winner] + pot };
  }
  if (pot % 2 !== 0) {
    throw new Error('RPS Poker tied pot must be even');
  }
  return {
    p1: stacks.p1 + (pot / 2),
    p2: stacks.p2 + (pot / 2),
  };
}
