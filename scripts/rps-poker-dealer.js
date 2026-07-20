#!/usr/bin/env node

import { randomInt } from "node:crypto";

const MOVES = ["ROCK", "PAPER", "SCISSORS"];
const [command = "deal", ...args] = process.argv.slice(2);

if (command === "deal") {
  const omittedMove = randomInt(MOVES.length);
  const pair = MOVES.filter((_, index) => index !== omittedMove);
  console.log(pair.join(" + "));
  process.exit(0);
}

if (command === "reveal") {
  const pair = args.map((move) => move.toUpperCase());
  const validPair =
    pair.length === 2 &&
    pair[0] !== pair[1] &&
    pair.every((move) => MOVES.includes(move));

  if (!validPair) {
    console.error("Usage: node scripts/rps-poker-dealer.js reveal <move> <different-move>");
    process.exit(1);
  }

  console.log(pair[randomInt(pair.length)]);
  process.exit(0);
}

console.error("Usage: node scripts/rps-poker-dealer.js [deal | reveal <move> <different-move>]");
process.exit(1);
