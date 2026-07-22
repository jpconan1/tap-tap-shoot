export const DEFAULT_LAYOUT_STATE_ID = 'playing.default';

const DEFAULT_FRAME = Object.freeze({ width: 960, height: 540 });
const DEFAULT_PORTRAIT_FRAME = Object.freeze({ width: 540, height: 960 });

export function createLayoutLoader({ layoutUrls, defaultVariantId, fetchLayout = fetch }) {
  const cache = new Map();
  const defaultUrl = layoutUrls[defaultVariantId];

  if (!defaultUrl) throw new Error(`Missing layout URL for default variant: ${defaultVariantId}`);

  function getUrl(variantId) {
    return layoutUrls[variantId] ?? defaultUrl;
  }

  async function load(variantId) {
    const url = getUrl(variantId);
    if (cache.has(url)) return cache.get(url);

    const response = await fetchLayout(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Layout request failed: ${response.status}`);

    const layout = normalizeGameLayout(await response.json());
    cache.set(url, layout);
    return layout;
  }

  return Object.freeze({
    load,
    preloadAll: () => Promise.all([...new Set([defaultVariantId, ...Object.keys(layoutUrls)])].map(load)),
    getCached: (variantId) => cache.get(getUrl(variantId)) ?? cache.get(defaultUrl) ?? null,
  });
}

export function normalizeGameLayout(payload) {
  if (payload?.version >= 2 && payload?.states && typeof payload.states === 'object') {
    return normalizeStatefulGameLayout(payload);
  }

  const frame = payload?.landscape?.frame;
  const elements = payload?.landscape?.elements;
  if (!frame || !Array.isArray(elements)) throw new Error('Layout is missing landscape frame or elements');

  const width = positiveNumber(frame.width, DEFAULT_FRAME.width);
  const height = positiveNumber(frame.height, DEFAULT_FRAME.height);
  const slots = elements
    .filter((element) => element && typeof element.key === 'string')
    .map((element, index) => [element.key, normalizeSlot(element, index)]);

  return {
    variant: 'Tap Tap Shoot Y',
    width,
    height,
    states: new Map([[DEFAULT_LAYOUT_STATE_ID, { width, height, slots: new Map(slots) }]]),
  };
}

function normalizeStatefulGameLayout(payload) {
  const frame = payload.frame ?? payload.landscape?.frame ?? {};
  const width = positiveNumber(frame.width, DEFAULT_FRAME.width);
  const height = positiveNumber(frame.height, DEFAULT_FRAME.height);
  const portraitFrame = payload.portraitFrame ?? {};
  const portraitWidth = positiveNumber(portraitFrame.width, DEFAULT_PORTRAIT_FRAME.width);
  const portraitHeight = positiveNumber(portraitFrame.height, DEFAULT_PORTRAIT_FRAME.height);
  const states = new Map();

  for (const [id, definition] of Object.entries(payload.states)) {
    if (!definition || typeof definition !== 'object') continue;
    states.set(id, {
      id,
      extends: typeof definition.extends === 'string' ? definition.extends : null,
      width: positiveNumber(definition.frame?.width, width),
      height: positiveNumber(definition.frame?.height, height),
      slots: normalizeSlots(definition.elements),
      portraitWidth,
      portraitHeight,
      portraitSlots: normalizeSlots(definition.portraitElements),
    });
  }

  if (!states.has(DEFAULT_LAYOUT_STATE_ID)) {
    states.set(DEFAULT_LAYOUT_STATE_ID, {
      id: DEFAULT_LAYOUT_STATE_ID, extends: null, width, height, slots: new Map(),
      portraitWidth, portraitHeight, portraitSlots: new Map(),
    });
  }

  return {
    variant: String(payload.variant || 'Tap Tap Shoot Y'), width, height, portraitWidth, portraitHeight,
    states: resolveStates(states),
  };
}

function normalizeSlots(elements) {
  if (!Array.isArray(elements)) return new Map();
  return new Map(elements
    .filter((element) => element && typeof element.key === 'string')
    .map((element, index) => [element.key, element.hidden ? { hidden: true, zIndex: index + 1 } : normalizeSlot(element, index)]));
}

function normalizeSlot(element, index) {
  return {
    x: finiteNumber(element.x, 0), y: finiteNumber(element.y, 0),
    width: positiveNumber(element.width, 1), height: positiveNumber(element.height, 1), zIndex: index + 1,
  };
}

function resolveStates(states) {
  const resolved = new Map();
  for (const id of states.keys()) resolved.set(id, resolveState(id, states, resolved, new Set()));
  return resolved;
}

function resolveState(id, states, resolved, stack) {
  if (resolved.has(id)) return resolved.get(id);
  const definition = states.get(id) ?? states.get(DEFAULT_LAYOUT_STATE_ID);
  const slots = new Map();

  if (definition.extends && !stack.has(definition.extends)) {
    stack.add(id);
    resolveState(definition.extends, states, resolved, stack).slots.forEach((slot, key) => slots.set(key, slot));
    stack.delete(id);
  }
  definition.slots.forEach((slot, key) => slot.hidden ? slots.delete(key) : slots.set(key, slot));

  return {
    id, width: definition.width, height: definition.height, slots,
    portraitWidth: definition.portraitWidth, portraitHeight: definition.portraitHeight,
    portraitSlots: definition.portraitSlots?.size ? definition.portraitSlots : createFallbackPortraitSlots(slots),
  };
}

function createFallbackPortraitSlots(landscapeSlots) {
  const slots = new Map();
  const add = (key, x, y, width, height, zIndex = 1) => {
    if (landscapeSlots.has(key)) slots.set(key, { x, y, width, height, zIndex });
  };

  add('p1-info', 14, 16, 190, 72, 20); add('p2-info', 336, 16, 190, 72, 20);
  add('p1-win-label', 8, 88, 128, 64, 20); add('p1-win-counter', 104, 94, 64, 64, 21);
  add('p2-win-label', 404, 88, 128, 64, 20); add('p2-win-counter', 372, 94, 64, 64, 21);
  add('turn-counter', 142, 76, 256, 128, 22); add('scene', 14, 190, 512, 256, 5);
  add('p1-you-picked', 18, 448, 128, 64, 12); add('p1-previous-move-icon', 136, 448, 64, 64, 13);
  add('p2-they-picked', 340, 448, 150, 64, 12); add('p2-previous-move-icon', 286, 448, 64, 64, 13);

  const resourceKeys = [...landscapeSlots.keys()].filter((key) => /^(p1|p2)-.+-slot-\d+$/.test(key));
  for (const playerId of ['p1', 'p2']) {
    resourceKeys.filter((key) => key.startsWith(`${playerId}-`)).sort().forEach((key, index) => {
      const x = playerId === 'p1' ? 18 + ((index % 3) * 48) : 378 + ((index % 3) * 48);
      add(key, x, 524 + (Math.floor(index / 3) * 48), 48, 48, 14);
    });
  }
  add('rules-button', 214, 526, 112, 56, 24);

  const buttonKeys = [...landscapeSlots.keys()]
    .filter((key) => key.endsWith('-button') && !['rules-button', 'continue-button', 'quit-button'].includes(key))
    .sort((a, b) => (landscapeSlots.get(a)?.x ?? 0) - (landscapeSlots.get(b)?.x ?? 0));
  buttonKeys.forEach((key, index) => {
    const x = buttonKeys.length % 2 && index === buttonKeys.length - 1 ? 150 : (index % 2 === 0 ? 25 : 295);
    add(key, x, 610 + (Math.floor(index / 2) * 116), 220, 110, 30 + index);
  });
  add('continue-button', 142, 700, 256, 128, 30); add('quit-button', 142, 824, 256, 128, 31);
  return slots;
}

function positiveNumber(value, fallback) {
  return Math.max(1, finiteNumber(value, fallback));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}
