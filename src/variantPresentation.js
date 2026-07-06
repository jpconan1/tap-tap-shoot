import { DEFAULT_VARIANT_ID, VARIANT_IDS } from './engine/moves.js';

const DEFAULT_RESOURCE_PRESENTATION = Object.freeze({
  labelSlotSuffix: 'bullets-label',
  labelDoodle: '',
  iconSlotPrefix: 'bullet',
  iconDoodle: 'shoot-stab-duck/bullet_icon',
  showLabel: false,
});

const RESOURCE_PRESENTATIONS = Object.freeze({
  [VARIANT_IDS.tapTapShoot]: Object.freeze({
    labelSlotSuffix: 'bullets-label',
    labelDoodle: '',
    iconSlotPrefix: 'bullet',
    iconDoodle: 'tap-tap-shoot/ap_icon',
    showLabel: false,
  }),
  [VARIANT_IDS.chargeBlockFireball]: Object.freeze({
    iconSlotPrefix: 'charge',
    iconDoodle: 'charge-block-fireball/charge icon',
    showLabel: false,
  }),
  [VARIANT_IDS.punchStabShoot]: Object.freeze({
    iconSlotPrefix: 'health',
    iconDoodle: 'punch-stab-shoot/health-icon',
    showLabel: false,
  }),
});

const HIDE_PICK_HISTORY_VARIANTS = Object.freeze(new Set([
  VARIANT_IDS.rps,
  VARIANT_IDS.chargeBlockFireball,
  VARIANT_IDS.punchStabShoot,
]));

export function getResourcePresentation(variantId = DEFAULT_VARIANT_ID) {
  return RESOURCE_PRESENTATIONS[variantId] ?? DEFAULT_RESOURCE_PRESENTATION;
}

export function shouldShowPickHistoryForVariant(variantId = DEFAULT_VARIANT_ID) {
  return !HIDE_PICK_HISTORY_VARIANTS.has(variantId);
}
