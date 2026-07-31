import { VARIANT_IDS } from './engine/moves.js';

export const TUTORIAL_VARIANT_ID = VARIANT_IDS.gunKnifeFist;
export const TUTORIAL_STARTING_ROUND_WINS = Object.freeze({ p1: 2, p2: 0 });

const TUTORIAL_LOSING_CPU_MOVES = Object.freeze({
  punch: 'shoot',
  stab: 'punch',
  shoot: 'stab',
});

export function getLocalStartingRoundWins(sessionKind) {
  return sessionKind === 'tutorial'
    ? { ...TUTORIAL_STARTING_ROUND_WINS }
    : { p1: 0, p2: 0 };
}

export function getTutorialForcedOpponentMove({
  sessionKind,
  variantId,
  roundWins,
  playerMove,
}) {
  if (
    sessionKind !== 'tutorial'
    || variantId !== TUTORIAL_VARIANT_ID
    || roundWins?.p1 !== 2
    || roundWins?.p2 !== 2
  ) {
    return undefined;
  }

  return TUTORIAL_LOSING_CPU_MOVES[playerMove];
}

export const TUTORIAL_INTRO_ALERTS = Object.freeze([
  Object.freeze({
    id: 'tutorial-welcome',
    label: 'Welcome to Super Rock Paper Scissors Online',
    body: Object.freeze([
      Object.freeze({
        text: 'Welcome to',
        style: 'subheader',
      }),
      Object.freeze({
        text: 'Super Rock Paper Scissors Online',
        style: 'header',
      }),
      Object.freeze({
        text: "A multi-game 'rps-with-a-twist' competitive arena!",
        style: 'subheader',
      }),
      Object.freeze({
        label: 'You’re playing Gun Knife Fist: it’s like Rock Paper Scissors with HP.',
        parts: Object.freeze([
          Object.freeze({ text: 'You’re playing ' }),
          Object.freeze({ text: 'Gun Knife Fist', tone: 'red' }),
          Object.freeze({ text: ': it’s like ' }),
          Object.freeze({ text: 'Rock Paper Scissors', tone: 'red' }),
          Object.freeze({ text: ' with HP.' }),
        ]),
      }),
      Object.freeze({ graphic: 'rps-gkf-comparison' }),
    ]),
    box: Object.freeze({
      x: 90,
      y: 48,
      width: 780,
      height: 444,
      portrait: Object.freeze({ x: 30, y: 210, width: 480, height: 540 }),
    }),
    navigation: Object.freeze({ back: false, next: true, escape: 'none' }),
  }),
  Object.freeze({
    id: 'tutorial-damage',
    label: 'Gun Knife Fist damage',
    body: Object.freeze([
      Object.freeze({ text: 'Rules', style: 'header' }),
      Object.freeze({
        text: 'Players start with 3 HP. Rounds end when a player runs out of HP. Unlike traditional RPS, the moves are unbalanced:',
        style: 'body-left',
      }),
      Object.freeze({
        text: 'Fist only deals 1 damage.',
        aside: Object.freeze([
          Object.freeze({ doodle: 'gun-knife-fist/fist_button', width: 256, height: 128 }),
          Object.freeze({ text: 'deals' }),
          Object.freeze({ doodle: 'tutorial/hp1', width: 52, height: 49 }),
        ]),
      }),
      Object.freeze({
        text: 'Knife deals 2 damage.',
        aside: Object.freeze([
          Object.freeze({ doodle: 'gun-knife-fist/knife_button', width: 256, height: 128 }),
          Object.freeze({ text: 'deals' }),
          Object.freeze({ doodle: 'tutorial/hp2', width: 82, height: 48 }),
        ]),
      }),
      Object.freeze({
        text: 'Gun is a one-hit KO (3 damage).',
        aside: Object.freeze([
          Object.freeze({ doodle: 'gun-knife-fist/gun_button', width: 256, height: 128 }),
          Object.freeze({ text: 'deals' }),
          Object.freeze({ doodle: 'tutorial/hp3', width: 91, height: 59 }),
        ]),
      }),
      Object.freeze({ text: 'First to win three rounds wins the game.', style: 'bullet' }),
    ]),
    box: Object.freeze({
      x: 90,
      y: 48,
      width: 780,
      height: 444,
      portrait: Object.freeze({ x: 30, y: 210, width: 480, height: 540 }),
    }),
    navigation: Object.freeze({ back: true, next: true, escape: 'none' }),
  }),
  Object.freeze({
    id: 'tutorial-cpu-odds',
    label: 'CPU odds',
    body: Object.freeze([
      Object.freeze({
        text: "You're playing an easy bot. It'll pick between the three moves equally. This might work in RPS but isn't smart in this game.",
        style: 'body',
      }),
    ]),
    box: Object.freeze({
      x: 265,
      y: 340,
      width: 500,
      height: 200,
      portrait: Object.freeze({ x: -15, y: 345, width: 358, height: 220 }),
    }),
    mode: 'guided',
    highlights: Object.freeze([
      Object.freeze({
        x: 810,
        y: 438,
        width: 138,
        height: 76,
        padding: 5,
        portrait: Object.freeze({ x: 388, y: 486, width: 138, height: 76 }),
      }),
    ]),
    navigation: Object.freeze({ back: true, next: true, escape: 'none' }),
  }),
  Object.freeze({
    id: 'tutorial-pick-a-move',
    label: 'Try to beat the bot',
    body: Object.freeze([
      Object.freeze({ text: 'Try to beat the bot!', style: 'subheader' }),
      Object.freeze({ text: 'Hint: pick the strongest move!', style: 'body' }),
    ]),
    box: Object.freeze({
      x: 220,
      y: 145,
      width: 520,
      height: 150,
      portrait: Object.freeze({ x: 20, y: 400, width: 500, height: 180 }),
    }),
    mode: 'guided',
    highlights: Object.freeze([
      Object.freeze({
        x: 248,
        y: 314,
        width: 469,
        height: 208,
        padding: 7,
        portrait: Object.freeze({ x: 25, y: 610, width: 490, height: 226 }),
      }),
    ]),
    navigation: Object.freeze({
      back: true,
      next: true,
      escape: 'none',
      outside: 'next',
    }),
  }),
]);
