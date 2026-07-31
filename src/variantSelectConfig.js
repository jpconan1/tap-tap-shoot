import { VARIANT_IDS } from './engine/moves.js';

export const VARIANT_SELECT_PAGE_SIZE = 9;

export const VARIANT_SELECT_VARIANTS = Object.freeze([
  Object.freeze({
    id: VARIANT_IDS.rockPaperScissors,
    name: 'RPS',
    buttonDoodle: 'rps_button_w',
    buttonArt: Object.freeze({ file: 'variant_screen/rps_button_sheet.webp', width: 321, height: 194 }),
    copy: Object.freeze([
      "THE ORIGINAL CLASSIC. You're probably familiar.",
      'Rock beats Scissors.',
      'Scissors beats Paper.',
      'Paper beats Rock.',
    ]),
  }),
  Object.freeze({
    id: VARIANT_IDS.rpsDragonSpear,
    name: 'RPS Dragon Spear',
    buttonDoodle: 'button_bg_generic2',
    buttonArt: Object.freeze({ file: 'variant_screen/rps_dragon_spear_button_sheet.webp', width: 349, height: 217 }),
    copy: Object.freeze([]),
  }),
  Object.freeze({
    id: VARIANT_IDS.rpsMinusOne,
    name: 'RPS Minus One',
    buttonDoodle: 'button_bg_generic3',
    buttonArt: Object.freeze({ file: 'variant_screen/pick_two_button_sheet.webp', width: 299, height: 106 }),
    copy: Object.freeze([]),
  }),
  Object.freeze({
    id: VARIANT_IDS.gunKnifeFist,
    name: 'Gun Knife Fist',
    buttonDoodle: 'gkf_button_w',
    buttonArt: Object.freeze({ file: 'variant_screen/gkf_button_sheet.webp', width: 196, height: 292 }),
    copy: Object.freeze([
      'ROCK PAPER SCISSORS WITH HP. First to deal 3 damage wins.',
      'Punch beats Shoot (Deals 1 damage).',
      'Stab beats Punch (Deals 2 damage).',
      'Shoot beats Stab (Deals a lethal 3 damage).',
    ]),
  }),
  Object.freeze({
    id: VARIANT_IDS.kitchenSink,
    name: 'Kitchen Sink!',
    buttonDoodle: 'button_bg_generic2',
    buttonArt: Object.freeze({ file: 'variant_screen/kitchen_sink_button_sheet.webp', width: 329, height: 263 }),
    copy: Object.freeze([]),
  }),
  Object.freeze({
    id: VARIANT_IDS.fireballWar,
    name: 'Fireball War',
    buttonDoodle: 'fireball-war_button_w',
    buttonArt: Object.freeze({ file: 'variant_screen/fireball_war_button_sheet.webp', width: 326, height: 80 }),
    copy: Object.freeze([
      'TWO WAYS TO WIN: Land a Fireball OR Charge 3 Bars.',
      'Fireball beats Charge (Costs 1 Bar).',
      'Block neutralizes Fireball.',
      'Charge grants 1 Bar.',
    ]),
  }),
  Object.freeze({
    id: VARIANT_IDS.rpsRpg,
    name: 'RPS RPG',
    buttonDoodle: 'button_bg_generic1',
    buttonArt: Object.freeze({ file: 'variant_screen/rps_rpg_button_sheet.webp', width: 235, height: 192 }),
    copy: Object.freeze([]),
  }),
  Object.freeze({
    id: VARIANT_IDS.rpsPoker,
    name: 'RPS Poker',
    buttonDoodle: 'button_bg_generic2',
    buttonArt: Object.freeze({ file: 'variant_screen/poker_button_sheet.webp', width: 338, height: 235 }),
    copy: Object.freeze([]),
  }),
  Object.freeze({
    id: VARIANT_IDS.tapTapShootX,
    name: 'Tap Tap Shoot',
    buttonDoodle: 'tts-x_button_w',
    buttonArt: Object.freeze({ file: 'variant_screen/tap_tap_shoot_button_sheet.webp', width: 253, height: 251 }),
    copy: Object.freeze([
      'FIVE MOVES AND LAYERED MIXUPS. Win by landing a Shoot or Stab.',
      'Shoot beats Stab, Counter-Stab, and Charge (Costs 1 AP).',
      'Stab beats Duck and Charge (Costs 1 AP).',
      'Counter-Stab neutralizes Stab.',
      'Duck neutralizes Shoot.',
      'Charge grants 1 AP.',
    ]),
  }),
]);
