import { MOVE_IDS } from './engine/moves.js';

export const DOODLE_FRAME_WIDTH = 512;
export const DOODLE_FRAME_HEIGHT = 256;
export const DOODLE_FRAME_COUNT = 3;
export const DOODLE_FRAME_RATE = 8;

const WIPE_FRAME_WIDTH = 1100;
const WIPE_FRAME_HEIGHT = 825;
const WIPE_STEP_DURATION = 58;
const READY_WAITING_FRAME_WIDTH = 300;
const READY_WAITING_FRAME_HEIGHT = 256;
const READY_WAITING_STEP_DURATION = 58;
const WAITING_DOTS_FRAME_WIDTH = 135;
const WAITING_DOTS_FRAME_HEIGHT = 55;
const WAITING_DOTS_START_DELAY = (7 * READY_WAITING_STEP_DURATION) + 750;
const WAITING_DOTS_STEP_FRAMES = 8;
const WAITING_DOTS_STEP_MS = (WAITING_DOTS_STEP_FRAMES / DOODLE_FRAME_RATE) * 1000;
export const READY_WAITING_SAFE_PHASE_MS = WAITING_DOTS_START_DELAY + (3 * WAITING_DOTS_STEP_MS);
const COUNTDOWN_NUMBERS = Object.freeze([5, 4, 3, 2, 1]);
const COUNTDOWN_STEP_MS = 1000;

const READY_WAITING_READY_STEPS = Object.freeze([
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
]);
const READY_WAITING_SPLIT_STEP = 3;
const SPLIT_READY_DOODLES = Object.freeze([
  'split_scenes/reloading-p1_ready',
  'split_scenes/reloading-p2_ready',
  'split_scenes/clash-p1_ready',
  'split_scenes/clash-p2_ready',
  'split_scenes/collision-p1_ready',
  'split_scenes/collision-p2_ready',
  'split_scenes/hiding-p1_ready',
  'split_scenes/hiding-p2_ready',
  'split_scenes/dodge-p1shooteris_ready',
  'split_scenes/dodge-p2dodgeris_ready',
  'split_scenes/counterstab-p1stabberis_ready',
  'split_scenes/counterstab-p2countereris_ready',
  'split_scenes/tricky-p1tricksteris_ready',
  'split_scenes/tricky-p2fooledis_ready',
]);

const INTERACTION_DOODLES = Object.freeze({
  'reload|reload': 'reloading',
  'reload|shoot': 'shooting',
  'reload|stab': 'counterstab',
  'reload|duck': 'tricky',
  'shoot|shoot': 'collision',
  'shoot|stab': 'shooting',
  'shoot|duck': 'dodge',
  'stab|stab': 'clash',
  'stab|duck': 'stabbing',
  'duck|duck': 'hiding',
});

const STARBURST_WIPE_STEPS = Object.freeze([
  Object.freeze(['1_w']),
  Object.freeze(['2_w', '1']),
  Object.freeze(['3_w', '1', '2']),
  Object.freeze(['4_w', '2', '3']),
  Object.freeze(['4_w', '3']),
  Object.freeze(['4_w']),
  Object.freeze(['4', '3_w']),
  Object.freeze(['3', '2_w']),
  Object.freeze(['2', '1_w']),
  Object.freeze(['1']),
]);

const doodleSheets = new Map();
let doodleRenderers = [];

export function preloadDoodleSheets(doodles) {
  return Promise.all([...new Set(doodles)].map((doodle) => ensureImageLoaded(loadDoodleSheet(doodle))));
}

export function getRendererPreloadDoodles() {
  return [
    ...Object.values(INTERACTION_DOODLES),
    ...SPLIT_READY_DOODLES,
    ...STARBURST_WIPE_STEPS.flat().map((name) => `starburst_wipe/${name}`),
    ...READY_WAITING_READY_STEPS.map((name) => `ready_waiting/${name}`),
    'ready_waiting/rdy',
    ...COUNTDOWN_NUMBERS.map((number) => `ready_waiting/countdown${number}`),
    'ready_waiting/waiting1',
    'ready_waiting/waiting2',
    'ready_waiting/waiting3',
  ];
}

export async function playStarburstWipeTransition(app, onCovered, playWipeAudio) {
  playWipeAudio();
  await preloadStarburstWipe();

  let overlay = createWipeOverlay(app);
  const coveredStep = 5;
  await animateWipeSteps(overlay, 0, coveredStep);

  onCovered();

  overlay = createWipeOverlay(app);
  drawWipeStep(overlay, STARBURST_WIPE_STEPS[coveredStep], performance.now());
  await animateWipeSteps(overlay, coveredStep + 1, STARBURST_WIPE_STEPS.length - 1);
  overlay.remove();
}

export function getDoodlePresentation(p1Move, p2Move, { variantId = '' } = {}) {
  const name = getDoodleForMoves(p1Move, p2Move, variantId);

  return {
    kind: 'doodle',
    name,
    flip: shouldFlipDoodle(name, p1Move, p2Move, variantId),
  };
}

export function mountSpriteRenderers(canvases) {
  doodleRenderers = [...canvases].map((canvas) => ({
    canvas,
    context: canvas.getContext('2d'),
    image: loadSpriteSheet(canvas),
    frameWidth: Number(canvas.dataset.frameWidth) || DOODLE_FRAME_WIDTH,
    frameHeight: Number(canvas.dataset.frameHeight) || DOODLE_FRAME_HEIGHT,
    flip: canvas.dataset.flip === 'true',
  }));

  doodleRenderers.forEach(({ canvas, image }) => {
    installSpriteFallback(canvas, image);
  });
  drawDoodleFrame(performance.now());
  ensureDoodleLoop();
}

export function mountReadyWaitingOverlays(canvases) {
  [...canvases].forEach((canvas) => {
    startReadyWaitingLoop(canvas);
  });
}

export function mountWaitingDotsOverlays(canvases) {
  [...canvases].forEach((canvas) => {
    startWaitingDotsLoop(canvas);
  });
}

export function mountCountdownOverlays(canvases) {
  [...canvases].forEach((canvas) => {
    startCountdownLoop(canvas);
  });
}

function createWipeOverlay(app) {
  const canvas = document.createElement('canvas');
  canvas.className = 'wipe-overlay';
  canvas.width = WIPE_FRAME_WIDTH;
  canvas.height = WIPE_FRAME_HEIGHT;
  canvas.setAttribute('aria-hidden', 'true');
  app.append(canvas);
  return canvas;
}

function preloadStarburstWipe() {
  const images = new Set(STARBURST_WIPE_STEPS.flat());
  return preloadDoodleSheets([...images].map((name) => `starburst_wipe/${name}`));
}

function preloadReadyWaiting() {
  return preloadDoodleSheets([
    ...READY_WAITING_READY_STEPS.map((name) => `ready_waiting/${name}`),
    'ready_waiting/rdy',
    ...COUNTDOWN_NUMBERS.map((number) => `ready_waiting/countdown${number}`),
    'ready_waiting/waiting1',
    'ready_waiting/waiting2',
    'ready_waiting/waiting3',
  ]);
}

function ensureImageLoaded(image) {
  if (image.complete && image.naturalWidth) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', resolve, { once: true });
  });
}

async function startReadyWaitingLoop(canvas) {
  const context = canvas.getContext('2d');
  await preloadReadyWaiting();

  const startedAt = performance.now();
  const holdReady = canvas.dataset.readyPhase === 'countdown';
  let didRequestSplit = false;

  function tick(now) {
    if (!canvas.isConnected) {
      return;
    }

    const elapsed = now - startedAt;
    const stepIndex = getReadyWaitingStepIndex(elapsed);
    const layers = holdReady ? ['rdy'] : getReadyWaitingLayersForStep(stepIndex);

    if (!holdReady && !didRequestSplit && stepIndex >= READY_WAITING_SPLIT_STEP) {
      didRequestSplit = true;
      canvas.dispatchEvent(new CustomEvent('ready-waiting-split', { bubbles: true }));
    }

    drawReadyWaitingStep(canvas, context, layers, now);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function getReadyWaitingLayers(elapsed) {
  return getReadyWaitingLayersForStep(getReadyWaitingStepIndex(elapsed));
}

function getReadyWaitingStepIndex(elapsed) {
  return Math.min(
    READY_WAITING_READY_STEPS.length - 1,
    Math.floor(elapsed / READY_WAITING_STEP_DURATION),
  );
}

function getReadyWaitingLayersForStep(stepIndex) {
  return stepIndex >= READY_WAITING_READY_STEPS.length - 1
    ? ['rdy']
    : [READY_WAITING_READY_STEPS[stepIndex]];
}

function drawReadyWaitingStep(canvas, context, layers, now) {
  const frame = Math.floor((now / 1000) * DOODLE_FRAME_RATE) % DOODLE_FRAME_COUNT;

  context.clearRect(0, 0, canvas.width, canvas.height);

  layers.forEach((layer) => {
    const image = loadDoodleSheet(`ready_waiting/${layer}`);

    if (!image.complete || !image.naturalWidth) {
      return;
    }

    context.drawImage(
      image,
      0,
      frame * READY_WAITING_FRAME_HEIGHT,
      READY_WAITING_FRAME_WIDTH,
      READY_WAITING_FRAME_HEIGHT,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  });
}

async function startWaitingDotsLoop(canvas) {
  const context = canvas.getContext('2d');
  await preloadReadyWaiting();

  const startedAt = performance.now();
  const elapsedOffset = canvas.dataset.immediate === 'true' ? WAITING_DOTS_START_DELAY : 0;

  function tick(now) {
    if (!canvas.isConnected) {
      return;
    }

    const elapsed = now - startedAt + elapsedOffset;
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (elapsed >= WAITING_DOTS_START_DELAY) {
      drawWaitingDotsStep(canvas, context, elapsed - WAITING_DOTS_START_DELAY, now);
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function drawWaitingDotsStep(canvas, context, elapsed, now) {
  const dotIndex = Math.floor(elapsed / WAITING_DOTS_STEP_MS) % 3;
  const image = loadDoodleSheet(`ready_waiting/waiting${dotIndex + 1}`);

  if (!image.complete || !image.naturalWidth) {
    return;
  }

  const frame = Math.floor((now / 1000) * DOODLE_FRAME_RATE) % DOODLE_FRAME_COUNT;

  context.drawImage(
    image,
    0,
    frame * WAITING_DOTS_FRAME_HEIGHT,
    WAITING_DOTS_FRAME_WIDTH,
    WAITING_DOTS_FRAME_HEIGHT,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

async function startCountdownLoop(canvas) {
  const context = canvas.getContext('2d');
  await preloadReadyWaiting();

  const startedAt = performance.now();

  function tick(now) {
    if (!canvas.isConnected) {
      return;
    }

    drawCountdownStep(canvas, context, now - startedAt, now);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function drawCountdownStep(canvas, context, elapsed, now) {
  const number = COUNTDOWN_NUMBERS[Math.min(
    COUNTDOWN_NUMBERS.length - 1,
    Math.floor(elapsed / COUNTDOWN_STEP_MS),
  )];
  const image = loadDoodleSheet(`ready_waiting/countdown${number}`);

  context.clearRect(0, 0, canvas.width, canvas.height);

  if (!image.complete || !image.naturalWidth) {
    return;
  }

  const frame = Math.floor((now / 1000) * DOODLE_FRAME_RATE) % DOODLE_FRAME_COUNT;

  context.drawImage(
    image,
    0,
    frame * READY_WAITING_FRAME_HEIGHT,
    READY_WAITING_FRAME_WIDTH,
    READY_WAITING_FRAME_HEIGHT,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

function animateWipeSteps(canvas, firstStep, lastStep) {
  return new Promise((resolve) => {
    const start = Math.max(0, firstStep);
    const end = Math.min(STARBURST_WIPE_STEPS.length - 1, lastStep);
    const stepCount = end - start + 1;

    if (stepCount <= 0) {
      resolve();
      return;
    }

    const startedAt = performance.now();

    function tick(now) {
      const elapsed = now - startedAt;
      const stepOffset = Math.min(stepCount - 1, Math.floor(elapsed / WIPE_STEP_DURATION));
      const stepIndex = start + stepOffset;

      drawWipeStep(canvas, STARBURST_WIPE_STEPS[stepIndex], now);

      if (stepOffset >= stepCount - 1 && elapsed >= stepCount * WIPE_STEP_DURATION) {
        resolve();
        return;
      }

      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  });
}

function drawWipeStep(canvas, layers, now) {
  if (!layers) {
    return;
  }

  const context = canvas.getContext('2d');
  const frame = Math.floor((now / 1000) * DOODLE_FRAME_RATE) % DOODLE_FRAME_COUNT;

  context.clearRect(0, 0, canvas.width, canvas.height);

  layers.forEach((layer) => {
    const image = loadDoodleSheet(`starburst_wipe/${layer}`);

    if (!image.complete || !image.naturalWidth) {
      return;
    }

    context.drawImage(
      image,
      0,
      frame * WIPE_FRAME_HEIGHT,
      WIPE_FRAME_WIDTH,
      WIPE_FRAME_HEIGHT,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  });
}

function getDoodleForMoves(p1Move, p2Move, variantId = '') {
  if (variantId === 'rps') {
    return getRpsDoodleForMoves(p1Move, p2Move);
  }

  const sortedMoves = [p1Move, p2Move].sort((a, b) => MOVE_IDS.indexOf(a) - MOVE_IDS.indexOf(b));
  const key = sortedMoves.join('|');
  return INTERACTION_DOODLES[key] ?? 'hiding';
}

function getRpsDoodleForMoves(p1Move, p2Move) {
  if (p1Move === p2Move) {
    return `rock-paper-scissors/${p1Move === 'scissors' ? 'scissors-tie' : `${p1Move}-draw`}`;
  }

  if ((p1Move === 'rock' && p2Move === 'scissors') || (p1Move === 'scissors' && p2Move === 'rock')) {
    return 'rock-paper-scissors/rock-scissors';
  }

  if ((p1Move === 'paper' && p2Move === 'rock') || (p1Move === 'rock' && p2Move === 'paper')) {
    return 'rock-paper-scissors/paper-rock';
  }

  if ((p1Move === 'scissors' && p2Move === 'paper') || (p1Move === 'paper' && p2Move === 'scissors')) {
    return 'rock-paper-scissors/scissors-paper';
  }

  return 'rock-paper-scissors/rps-standoff';
}

function shouldFlipDoodle(doodle, p1Move, p2Move, variantId = '') {
  if (variantId === 'rps') {
    return (doodle === 'rock-paper-scissors/rock-scissors' && p2Move === 'rock')
      || (doodle === 'rock-paper-scissors/paper-rock' && p2Move === 'paper')
      || (doodle === 'rock-paper-scissors/scissors-paper' && p2Move === 'scissors');
  }

  if (doodle === 'shooting') {
    return p2Move === 'shoot';
  }

  if (doodle === 'stabbing') {
    return p2Move === 'stab';
  }

  if (doodle === 'dodge') {
    return p1Move === 'duck';
  }

  if (doodle === 'counterstab') {
    return p2Move === 'stab';
  }

  if (doodle === 'tricky') {
    return p2Move === 'reload' && p1Move !== 'reload';
  }

  return false;
}

function installSpriteFallback(canvas, image) {
  canvas.style.backgroundImage = `url("${image.src}")`;
  canvas.style.backgroundPosition = 'top left';
  canvas.style.backgroundRepeat = 'no-repeat';
  canvas.style.backgroundSize = '100% auto';
}

function loadDoodleSheet(doodle) {
  return loadSpriteSheetByKey(doodle, `./assets/${doodle}_sheet.webp`);
}

function loadSpriteSheet(canvas) {
  if (canvas.dataset.doodleFile) {
    return loadSpriteSheetByKey(canvas.dataset.doodleFile, `./assets/${canvas.dataset.doodleFile}`);
  }

  return loadDoodleSheet(canvas.dataset.doodle);
}

function loadSpriteSheetByKey(key, src) {
  if (!key) {
    return new Image();
  }

  if (doodleSheets.has(key)) {
    return doodleSheets.get(key);
  }

  const image = new Image();
  image.src = src;
  image.onload = () => drawDoodleFrame(performance.now());
  doodleSheets.set(key, image);
  return image;
}

function ensureDoodleLoop() {
  if (ensureDoodleLoop.isRunning) {
    return;
  }

  ensureDoodleLoop.isRunning = true;

  function tick(now) {
    drawDoodleFrame(now);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function drawDoodleFrame(now) {
  if (!doodleRenderers.length) {
    return;
  }

  const frame = Math.floor((now / 1000) * DOODLE_FRAME_RATE) % DOODLE_FRAME_COUNT;

  doodleRenderers.forEach(({ canvas, context, image, frameWidth, frameHeight, flip }) => {
    if (!canvas.isConnected || !image.complete || !image.naturalWidth) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();

    if (flip) {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }

    context.drawImage(
      image,
      0,
      frame * frameHeight,
      frameWidth,
      frameHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    context.restore();

    canvas.style.backgroundImage = 'none';
  });
}
