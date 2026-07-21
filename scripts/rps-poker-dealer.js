#!/usr/bin/env node

import { randomInt } from "node:crypto";

const MOVES = ["ROCK", "PAPER", "SCISSORS"];
const [command = "deal", ...args] = process.argv.slice(2);

if (command === "deal" && args.length === 0) {
  console.log(MOVES[randomInt(MOVES.length)]);
  process.exit(0);
}

console.error("Usage: node scripts/rps-poker-dealer.js [deal]");
process.exit(1);
