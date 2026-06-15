import { MOVE_IDS } from './engine/moves.js';

export const DOODLE_FRAME_WIDTH = 512;
export const DOODLE_FRAME_HEIGHT = 256;
export const DOODLE_FRAME_COUNT = 3;
export const DOODLE_FRAME_RATE = 8;

const WIPE_FRAME_WIDTH = 1100;
const WIPE_FRAME_HEIGHT = 825;
const WIPE_STEP_DURATION = 58;
const READY_WAITING_FRAME_WIDTH = 512;
const READY_WAITING_FRAME_HEIGHT = 256;

const INTERACTION_DOODLES = Object.freeze({
  'reload|reload': 'reloading',
  'reload|shoot': 'shooting',
  'reload|stab': 'stabbing',
  'reload|block': 'tricky',
  'reload|counterstab': 'tricky',
  'shoot|shoot': 'collision',
  'shoot|stab': 'shooting',
  'shoot|block': 'dodge',
  'shoot|counterstab': 'shooting',
  'stab|stab': 'clash',
  'stab|block': 'stabbing',
  'stab|counterstab': 'counterstab',
  'block|block': 'hiding',
  'block|counterstab': 'hiding',
  'counterstab|counterstab': 'hiding',
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

const READY_WAITING_READY_STEPS = Object.freeze([
  Object.freeze(['1']),
  Object.freeze(['2']),
  Object.freeze(['3']),
  Object.freeze(['4']),
  Object.freeze(['5']),
  Object.freeze(['6']),
  Object.freeze(['7']),
]);
const READY_WAITING_WAITING_STEPS = Object.freeze([
  Object.freeze(['waiting1']),
  Object.freeze(['waiting2']),
  Object.freeze(['waiting3']),
]);
const SPLIT_SCENE_DOODLES = Object.freeze([
  'split_scenes/clash-them',
  'split_scenes/clash-you',
  'split_scenes/collision-them',
  'split_scenes/collision-you',
  'split_scenes/counterstab-counterer',
  'split_scenes/counterstab-stabber',
  'split_scenes/dodge-dodger',
  'split_scenes/dodge-shooter',
  'split_scenes/hiding-them',
  'split_scenes/hiding-you',
  'split_scenes/reloading-them',
  'split_scenes/reloading-you',
  'split_scenes/tricky-fooled',
  'split_scenes/tricky-tricker',
]);
const READY_WAITING_SPLIT_STEP = 3;
const READY_WAITING_COUNTDOWN_MS = 5000;
export const READY_WAITING_READY_MS = READY_WAITING_READY_STEPS.length * WIPE_STEP_DURATION;
export const READY_WAITING_WAITING_MS = READY_WAITING_WAITING_STEPS.length * WIPE_STEP_DURATION;

const doodleSheets = new Map();
let doodleRenderers = [];

export function preloadDoodleSheets(doodles) {
  return Promise.all([...new Set(doodles)].map((doodle) => ensureImageLoaded(loadDoodleSheet(doodle))));
}

export function getRendererPreloadDoodles() {
  return [
    ...Object.values(INTERACTION_DOODLES),
    ...STARBURST_WIPE_STEPS.flat().map((name) => `starburst_wipe/${name}`),
    ...READY_WAITING_READY_STEPS.flat().map((name) => `ready_waiting/${name}`),
    ...READY_WAITING_WAITING_STEPS.flat().map((name) => `ready_waiting/${name}`),
    ...Array.from({ length: 5 }, (_, index) => `ready_waiting/countdown${index + 1}`),
    ...SPLIT_SCENE_DOODLES,
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

export function getDoodlePresentation(p1Move, p2Move) {
  const name = getDoodleForMoves(p1Move, p2Move);

  return {
    kind: 'doodle',
    name,
    flip: shouldFlipDoodle(name, p1Move, p2Move),
  };
}

export function mountSpriteRenderers(canvases) {
  doodleRenderers = [...canvases].map((canvas) => ({
    canvas,
    context: canvas.getContext('2d'),
    image: loadDoodleSheet(canvas.dataset.doodle),
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
  const images = new Set([
    ...READY_WAITING_READY_STEPS.flat(),
    ...READY_WAITING_WAITING_STEPS.flat(),
    ...Array.from({ length: 5 }, (_, index) => `countdown${index + 1}`),
  ]);
  return preloadDoodleSheets([...images].map((name) => `ready_waiting/${name}`));
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

async function startReadyWaitingLoop(canvas) {
  const context = canvas.getContext('2d');
  await preloadReadyWaiting();

  const startedAt = performance.now();
  let hasSplit = false;
  const readyFlip = canvas.dataset.readyPlayer === 'p2';
  const waitingFlip = canvas.dataset.waitingPlayer === 'p2';

  function tick(now) {
    if (!canvas.isConnected) {
      return;
    }

    const elapsed = now - startedAt;

    if (elapsed < READY_WAITING_READY_MS) {
      const stepIndex = Math.min(
        READY_WAITING_READY_STEPS.length - 1,
        Math.floor(elapsed / WIPE_STEP_DURATION),
      );

      if (!hasSplit && stepIndex >= READY_WAITING_SPLIT_STEP) {
        hasSplit = true;
        canvas.dispatchEvent(new CustomEvent('ready-waiting-split', { bubbles: true }));
      }

      drawReadyWaitingStep(canvas, context, READY_WAITING_READY_STEPS[stepIndex], now, readyFlip);
      requestAnimationFrame(tick);
      return;
    }

    const waitingElapsed = elapsed - READY_WAITING_READY_MS;
    const countdownIndex = getCountdownIndex(waitingElapsed);

    if (countdownIndex) {
      drawReadyWaitingStep(canvas, context, [`countdown${countdownIndex}`], now, waitingFlip);
    } else {
      const stepIndex = Math.floor(waitingElapsed / WIPE_STEP_DURATION) % READY_WAITING_WAITING_STEPS.length;
      drawReadyWaitingStep(canvas, context, READY_WAITING_WAITING_STEPS[stepIndex], now, waitingFlip);
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function drawReadyWaitingStep(canvas, context, layers, now, flip = false) {
  const frame = Math.floor((now / 1000) * DOODLE_FRAME_RATE) % DOODLE_FRAME_COUNT;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();

  if (flip) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }

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

  context.restore();
}

function getCountdownIndex(waitingElapsed) {
  const countdownElapsed = waitingElapsed - READY_WAITING_WAITING_MS;

  if (countdownElapsed < 0 || countdownElapsed >= READY_WAITING_COUNTDOWN_MS) {
    return null;
  }

  return 5 - Math.floor(countdownElapsed / 1000);
}

function getDoodleForMoves(p1Move, p2Move) {
  const sortedMoves = [p1Move, p2Move].sort((a, b) => MOVE_IDS.indexOf(a) - MOVE_IDS.indexOf(b));
  const key = sortedMoves.join('|');
  return INTERACTION_DOODLES[key] ?? 'hiding';
}

function shouldFlipDoodle(doodle, p1Move, p2Move) {
  if (doodle === 'shooting') {
    return p2Move === 'shoot';
  }

  if (doodle === 'stabbing') {
    return p2Move === 'stab';
  }

  if (doodle === 'dodge') {
    return p1Move === 'block';
  }

  if (doodle === 'counterstab') {
    return p1Move === 'counterstab';
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

function shouldKeepSpriteFallback() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /Safari/.test(navigator.userAgent));
}

function loadDoodleSheet(doodle) {
  if (doodleSheets.has(doodle)) {
    return doodleSheets.get(doodle);
  }

  const image = new Image();
  image.src = `./assets/${doodle}_sheet.webp`;
  image.onload = () => drawDoodleFrame(performance.now());
  doodleSheets.set(doodle, image);
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
    if (!image.complete || !image.naturalWidth) {
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

    if (!shouldKeepSpriteFallback()) {
      canvas.style.backgroundImage = 'none';
    }
  });
}
