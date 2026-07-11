import { DEFAULT_VARIANT_ID, VARIANT_IDS } from './engine/moves.js';

const DEFAULT_RESOURCE_PRESENTATION = Object.freeze({
  labelSlotSuffix: 'bullets-label',
  labelDoodle: '',
  iconSlotPrefix: 'bullet',
  iconDoodle: 'tap-tap-shoot-y/bullet_icon',
  emptyIconDoodle: '',
  mirrorPlayerTwoSlots: false,
  showLabel: false,
});

const RESOURCE_PRESENTATIONS = Object.freeze({
  [VARIANT_IDS.tapTapShootX]: Object.freeze({
    labelSlotSuffix: 'bullets-label',
    labelDoodle: '',
    iconSlotPrefix: 'bullet',
    iconDoodle: 'tap-tap-shoot-x/ap_icon',
    emptyIconDoodle: '',
    mirrorPlayerTwoSlots: false,
    showLabel: false,
  }),
  [VARIANT_IDS.fireballWar]: Object.freeze({
    iconSlotPrefix: 'charge',
    iconDoodle: 'fireball-war/charge icon',
    emptyIconDoodle: 'fireball-war/charge-icon-slot',
    mirrorPlayerTwoSlots: true,
    showLabel: false,
  }),
  [VARIANT_IDS.gunKnifeFist]: Object.freeze({
    iconSlotPrefix: 'health',
    iconDoodle: 'gun-knife-fist/health-icon',
    emptyIconDoodle: '',
    mirrorPlayerTwoSlots: false,
    showLabel: false,
  }),
});

const HIDE_PICK_HISTORY_VARIANTS = Object.freeze(new Set([
  VARIANT_IDS.rockPaperScissors,
  VARIANT_IDS.fireballWar,
  VARIANT_IDS.gunKnifeFist,
]));

export function getResourcePresentation(variantId = DEFAULT_VARIANT_ID) {
  return RESOURCE_PRESENTATIONS[variantId] ?? DEFAULT_RESOURCE_PRESENTATION;
}

export function shouldShowPickHistoryForVariant(variantId = DEFAULT_VARIANT_ID) {
  return !HIDE_PICK_HISTORY_VARIANTS.has(variantId);
}
