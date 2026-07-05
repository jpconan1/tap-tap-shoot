const SYSTEM_SCENES = [
  "game_lost",
  "game_point",
  "game_won",
  "match_point",
  "no_contest",
  "round-game-match",
  "round_lost",
  "round_won",
];

const VARIANT_SCENES = {
  "rock-paper-scissors": [
    "paper-draw",
    "paper-rock",
    "rock-draw",
    "rock-scissors",
    "rps-standoff",
    "scissors-paper",
    "scissors-tie",
  ],
  "charge-block-fireball": [
    "block-charge",
    "block-draw",
    "block-fireball",
    "both-charge",
    "cbf-standoff",
    "charge-fireball",
    "fireball-draw",
    "super-blasting",
    "super-final-frame1",
    "super-final-frame2",
    "super-final-frame3",
    "super-final-frame4",
  ],
  "punch-stab-shoot": [
    "punch-draw",
    "punch-shoot-damage",
    "punch-shoot-kill",
    "shoot-draw",
    "shoot-stab",
    "stab-draw",
    "stab-punch-damage",
    "stab-punch-kill",
  ],
  "shoot-stab-duck": [
    "duck-draw",
    "reload-draw",
    "reload-duck",
    "shoot-draw",
    "shoot-kill",
    "stab-draw",
    "stab-kill",
    "stab-reload",
    "standoff-ssd",
  ],
  "tap-tap-shoot": [
    "defense-draw",
    "reload-draw",
    "reload-duck",
    "shoot-draw",
    "shoot-kill",
    "stab-counterstab",
    "stab-draw",
    "stab-kill",
    "standoff-tts",
  ],
};

window.LAYOUT_VARIANTS = [
  { id: "rock-paper-scissors", name: "Rock Paper Scissors", folder: "assets/rock-paper-scissors" },
  { id: "charge-block-fireball", name: "Charge Block Fireball", folder: "assets/charge-block-fireball" },
  { id: "punch-stab-shoot", name: "Punch Stab Shoot", folder: "assets/punch-stab-shoot" },
  { id: "shoot-stab-duck", name: "Shoot Stab Duck", folder: "assets/shoot-stab-duck" },
  { id: "tap-tap-shoot", name: "Tap Tap Shoot", folder: "assets/tap-tap-shoot" },
];

window.LAYOUT_PARENT_ELEMENTS = [
  { key: "scene", name: "Scene placement", asset: "assets/shoot-stab-duck/standoff-ssd_sheet.webp", frame: "last", scene: true },
  { key: "p1-info", name: "P1 name & info", kind: "text", text: "P1\nINFO", width: 220, height: 72 },
  { key: "p2-info", name: "P2 name & info", kind: "text", text: "P2\nINFO", width: 220, height: 72 },
  { key: "p1-win-label", name: "P1 win label", asset: "assets/wins_label_sheet.webp" },
  { key: "p2-win-label", name: "P2 win label", asset: "assets/wins_label_sheet.webp" },
  { key: "p1-win-counter", name: "P1 win counter", asset: "assets/w1_sheet.webp" },
  { key: "p2-win-counter", name: "P2 win counter", asset: "assets/w1_sheet.webp" },
  { key: "turn-counter", name: "Turn counter", asset: "assets/turn1_sheet.webp" },
];

const GENERIC_ARROWS = [
  "up",
  "up-right",
  "right",
  "down-right",
  "down",
  "down-left",
  "left",
  "up-left",
].flatMap((direction) => [
  { key: `${direction}-red-arrow`, name: `${titleCase(direction)} red arrow`, asset: `assets/${direction}_red_sheet.webp` },
  { key: `${direction}-blue-arrow`, name: `${titleCase(direction)} blue arrow`, asset: `assets/${direction}_blue_sheet.webp` },
]);

const PREVIOUS_MOVE_ELEMENTS = [
  { key: "p1-you-picked", name: "P1 you picked", asset: "assets/you_picked_sheet.webp" },
  { key: "p2-they-picked", name: "P2 they picked", asset: "assets/they_picked_sheet.webp" },
  { key: "p1-previous-move-icon", name: "P1 previous move icon", asset: "assets/shoot_icon_sheet.webp" },
  { key: "p2-previous-move-icon", name: "P2 previous move icon", asset: "assets/shoot_icon_sheet.webp" },
];

const BULLET_ELEMENTS = [
  { key: "p1-bullets-label", name: "P1 bullets label", asset: "assets/bullets_label_sheet.webp" },
  { key: "p2-bullets-label", name: "P2 bullets label", asset: "assets/bullets_label_sheet.webp" },
  { key: "p1-bullet-slot-1", name: "P1 bullet slot 1", asset: "assets/bullet_icon_sheet.webp" },
  { key: "p1-bullet-slot-2", name: "P1 bullet slot 2", asset: "assets/bullet_icon_sheet.webp" },
  { key: "p1-bullet-slot-3", name: "P1 bullet slot 3", asset: "assets/bullet_icon_sheet.webp" },
  { key: "p2-bullet-slot-1", name: "P2 bullet slot 1", asset: "assets/bullet_icon_sheet.webp" },
  { key: "p2-bullet-slot-2", name: "P2 bullet slot 2", asset: "assets/bullet_icon_sheet.webp" },
  { key: "p2-bullet-slot-3", name: "P2 bullet slot 3", asset: "assets/bullet_icon_sheet.webp" },
];

const CHARGE_ELEMENTS = [
  { key: "p1-charge-slot-1", name: "P1 charge slot 1", asset: "assets/charge-block-fireball/charge icon_sheet.webp" },
  { key: "p1-charge-slot-2", name: "P1 charge slot 2", asset: "assets/charge-block-fireball/charge icon_sheet.webp" },
  { key: "p1-charge-slot-3", name: "P1 charge slot 3", asset: "assets/charge-block-fireball/charge icon_sheet.webp" },
  { key: "p2-charge-slot-1", name: "P2 charge slot 1", asset: "assets/charge-block-fireball/charge icon_sheet.webp" },
  { key: "p2-charge-slot-2", name: "P2 charge slot 2", asset: "assets/charge-block-fireball/charge icon_sheet.webp" },
  { key: "p2-charge-slot-3", name: "P2 charge slot 3", asset: "assets/charge-block-fireball/charge icon_sheet.webp" },
];

const HEALTH_ELEMENTS = [
  { key: "p1-health-slot-1", name: "P1 health slot 1", asset: "assets/punch-stab-shoot/health-icon_sheet.webp" },
  { key: "p1-health-slot-2", name: "P1 health slot 2", asset: "assets/punch-stab-shoot/health-icon_sheet.webp" },
  { key: "p1-health-slot-3", name: "P1 health slot 3", asset: "assets/punch-stab-shoot/health-icon_sheet.webp" },
  { key: "p2-health-slot-1", name: "P2 health slot 1", asset: "assets/punch-stab-shoot/health-icon_sheet.webp" },
  { key: "p2-health-slot-2", name: "P2 health slot 2", asset: "assets/punch-stab-shoot/health-icon_sheet.webp" },
  { key: "p2-health-slot-3", name: "P2 health slot 3", asset: "assets/punch-stab-shoot/health-icon_sheet.webp" },
];

const VARIANT_ELEMENTS = {
  "rock-paper-scissors": [
    { key: "rock-button", name: "Rock button", asset: "assets/rock-paper-scissors/rock_button_sheet.webp" },
    { key: "paper-button", name: "Paper button", asset: "assets/rock-paper-scissors/paper_button_sheet.webp" },
    { key: "scissors-button", name: "Scissors button", asset: "assets/rock-paper-scissors/scissors_button_sheet.webp" },
  ],
  "charge-block-fireball": [
    { key: "charge-button", name: "Charge button", asset: "assets/charge-block-fireball/charge_button_sheet.webp" },
    { key: "block-button", name: "Block button", asset: "assets/charge-block-fireball/block_button_sheet.webp" },
    { key: "fireball-button", name: "Fireball button", asset: "assets/charge-block-fireball/fireball_button_sheet.webp" },
    ...CHARGE_ELEMENTS,
  ],
  "punch-stab-shoot": [
    { key: "punch-button", name: "Punch button", asset: "assets/punch-stab-shoot/punch_button_sheet.webp" },
    { key: "stab-button", name: "Stab button", asset: "assets/stab_button_sheet.webp" },
    { key: "shoot-button", name: "Shoot button", asset: "assets/shoot_button_sheet.webp" },
    ...HEALTH_ELEMENTS,
  ],
  "shoot-stab-duck": [
    { key: "reload-button", name: "Reload button", asset: "assets/reload_button_sheet.webp" },
  { key: "shoot-button", name: "Shoot button", asset: "assets/shoot_button_sheet.webp" },
  { key: "shoot-decorative-icon", name: "Shoot decorative icon", asset: "assets/shoot_icon_sheet.webp" },
  { key: "stab-button", name: "Stab button", asset: "assets/stab_button_sheet.webp" },
  { key: "stab-decorative-icon", name: "Stab decorative icon", asset: "assets/stab_icon_sheet.webp" },
  { key: "duck-button", name: "Duck button", asset: "assets/duck_button_sheet.webp" },
    ...BULLET_ELEMENTS,
    ...PREVIOUS_MOVE_ELEMENTS,
  ],
  "tap-tap-shoot": [
    { key: "reload-button", name: "Reload button", asset: "assets/reload_button_sheet.webp" },
    { key: "shoot-button", name: "Shoot button", asset: "assets/shoot_button_sheet.webp" },
    { key: "stab-button", name: "Stab button", asset: "assets/stab_button_sheet.webp" },
    { key: "duck-button", name: "Duck button", asset: "assets/duck_button_sheet.webp" },
    { key: "counterstab-button", name: "Counterstab button", asset: "assets/stab_button_sheet.webp" },
    { key: "counterstab-decorative-icon", name: "Counterstab decorative icon", asset: "assets/counterstab_icon_sheet.webp" },
    ...BULLET_ELEMENTS,
    ...PREVIOUS_MOVE_ELEMENTS,
  ],
};

const LEGACY_ARROWS = [
  { key: "stab-to-duck-arrow", name: "Stab to duck arrow", asset: "assets/stab-to-duck_arrow_sheet.webp" },
  { key: "reload-to-stab-arrow", name: "Reload to stab arrow", asset: "assets/reload-to-stab_arrow_sheet.webp" },
  { key: "duck-to-shoot-arrow", name: "Duck to shoot arrow", asset: "assets/duck-to-shoot_arrow_sheet.webp" },
  { key: "shoot-to-stab-arrow", name: "Shoot to stab arrow", asset: "assets/shoot-to-stab_arrow_sheet.webp" },
];

const ACTION_ELEMENTS = [
  { key: "continue-button", name: "Continue button", asset: "assets/continue_button_sheet.webp" },
  { key: "quit-button", name: "Quit button", asset: "assets/quit_button_sheet.webp" },
];

window.getLayoutElementsForTarget = function getLayoutElementsForTarget({ target, variantId }) {
  if (target === "parent") {
    return [
      ...window.LAYOUT_PARENT_ELEMENTS,
      ...ACTION_ELEMENTS,
    ];
  }

  const variant = window.LAYOUT_VARIANTS.find((item) => item.id === variantId) ?? window.LAYOUT_VARIANTS[0];
  const systemScenes = SYSTEM_SCENES.map((name) => sceneElement({
    key: `system-scene:${name}`,
    name: `System scene: ${name}`,
    asset: `assets/system_scenes/${name}_sheet.webp`,
  }));
  const variantScenes = (VARIANT_SCENES[variant.id] ?? []).map((name) => sceneElement({
    key: `scene:${name}`,
    name: `Scene: ${name}`,
    asset: `${variant.folder}/${name}_sheet.webp`,
  }));

  return [
    ...variantScenes,
    ...systemScenes,
    ...(VARIANT_ELEMENTS[variant.id] ?? []),
    ...GENERIC_ARROWS,
    ...LEGACY_ARROWS,
  ];
};

window.getLayoutElementsForVariant = function getLayoutElementsForVariant(variantId) {
  return window.getLayoutElementsForTarget({ target: "variant", variantId });
};

function sceneElement(definition) {
  return {
    ...definition,
    scene: true,
    frame: "last",
  };
}

function titleCase(value) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
