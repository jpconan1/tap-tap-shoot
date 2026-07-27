import { VARIANT_IDS } from './engine/moves.js';

export const TUTORIAL_VARIANT_ID = VARIANT_IDS.gunKnifeFist;

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
        text: 'A competitive multi-game RPS-with-a-twist arena!',
        style: 'subheader',
      }),
      'You’re playing Gun Knife Fist: it’s like Rock Paper Scissors with HP.',
      Object.freeze({ graphic: 'gun-knife-fist-triangle' }),
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
      Object.freeze({ text: 'Players start with 3 HP. Rounds only end when a player’s HP is reduced to 0.', style: 'bullet' }),
      Object.freeze({ text: 'Fist only deals 1 damage.', style: 'bullet' }),
      Object.freeze({ text: 'Knife deals 2.', style: 'bullet' }),
      Object.freeze({ text: 'Gun ends the round instantly by dealing 3.', style: 'bullet' }),
    ]),
    box: Object.freeze({
      x: 150,
      y: 76,
      width: 660,
      height: 388,
      portrait: Object.freeze({ x: 35, y: 250, width: 470, height: 460 }),
    }),
    navigation: Object.freeze({ back: true, next: true, escape: 'none' }),
  }),
]);
