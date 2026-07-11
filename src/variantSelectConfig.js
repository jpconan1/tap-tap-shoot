import { VARIANT_IDS } from './engine/moves.js';

export const VARIANT_SELECT_PAGE_SIZE = 6;

export const VARIANT_SELECT_VARIANTS = Object.freeze([
  Object.freeze({
    id: VARIANT_IDS.chargeBlockFireball,
    name: 'Fireball War',
    buttonDoodle: 'fireball-war_button_w',
    copy: Object.freeze([
      'TWO WAYS TO WIN: Land a Fireball OR Charge 3 Bars.',
      'Fireball beats Charge (Costs 1 Bar).',
      'Block neutralizes Fireball.',
      'Charge grants 1 Bar.',
    ]),
  }),
  Object.freeze({
    id: VARIANT_IDS.rps,
    name: 'Rock Paper Scissors',
    buttonDoodle: 'rps_button_w',
    copy: Object.freeze([
      "THE ORIGINAL CLASSIC. You're probably familiar.",
      'Rock beats Scissors.',
      'Scissors beats Paper.',
      'Paper beats Rock.',
    ]),
  }),
  Object.freeze({
    id: VARIANT_IDS.shootStabDuck,
    name: 'Tap Tap Shoot Y',
    buttonDoodle: 'tts-y_button_w',
    copy: Object.freeze([
      'FOUR MOVES, ONE RESOURCE. Win by landing a Shoot or Stab.',
      'Shoot beats Stab and Reload (Costs 1 Bullet).',
      'Stab beats Duck.',
      'Reload neutralizes Stab AND grants 1 Bullet.',
      'Duck neutralizes Shoot.',
    ]),
  }),
  Object.freeze({
    id: VARIANT_IDS.punchStabShoot,
    name: 'Gun Knife Fist',
    buttonDoodle: 'gkf_button_w',
    copy: Object.freeze([
      'ROCK PAPER SCISSORS WITH HP. First to deal 3 damage wins.',
      'Punch beats Shoot (Deals 1 damage).',
      'Stab beats Punch (Deals 2 damage).',
      'Shoot beats Stab (Deals a lethal 3 damage).',
    ]),
  }),
  Object.freeze({
    id: VARIANT_IDS.tapTapShoot,
    name: 'Tap Tap Shoot X',
    buttonDoodle: 'tts-x_button_w',
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
