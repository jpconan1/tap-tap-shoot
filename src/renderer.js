import { MOVE_IDS } from './engine/moves.js';
import { resolveScene } from './sceneResolver.js';

export const DOODLE_FRAME_WIDTH = 512;
export const DOODLE_FRAME_HEIGHT = 256;
export const DOODLE_FRAME_COUNT = 3;
export const DOODLE_FRAME_RATE = 8;

const WIPE_FRAME_WIDTH = 1100;
const WIPE_FRAME_HEIGHT = 825;
const WIPE_STEP_DURATION = 58;
const CURTAIN_FRAME_WIDTH = 960;
const CURTAIN_FRAME_HEIGHT = 540;
const CURTAIN_STEP_DURATION = 84;
const CURTAIN_CLOSED_BEAT_MS = 420;
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
let isBoilEnabled = true;

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

const FIREBALL_WAR_DOODLES = Object.freeze({
  'block|block': 'fireball-war/block-draw',
  'charge|block': 'fireball-war/block-charge',
  'block|fireball': 'fireball-war/block-fireball',
  'charge|charge': 'fireball-war/both-charge',
  'charge|fireball': 'fireball-war/charge-fireball',
  'fireball|fireball': 'fireball-war/fireball-draw',
});

const GUN_KNIFE_FIST_DOODLES = Object.freeze([
  'gun-knife-fist/pss-standoff',
  'gun-knife-fist/punch-draw',
  'gun-knife-fist/punch-shoot-damage',
  'gun-knife-fist/punch-shoot-kill',
  'gun-knife-fist/shoot-draw',
  'gun-knife-fist/shoot-stab',
  'gun-knife-fist/stab-draw',
  'gun-knife-fist/stab-punch-damage',
  'gun-knife-fist/stab-punch-kill',
]);
const GUN_KNIFE_FIST_SPLIT_DOODLES = Object.freeze([
  'gun-knife-fist/split_scenes/pss-standoff_p1_is_ready',
  'gun-knife-fist/split_scenes/pss-standoff_p2_is_ready',
  'gun-knife-fist/split_scenes/punch-draw_p1_is_ready',
  'gun-knife-fist/split_scenes/punch-draw_p2_is_ready',
  'gun-knife-fist/split_scenes/punch-shoot_puncher_is_ready',
  'gun-knife-fist/split_scenes/punch-shoot_shooter_is_ready',
  'gun-knife-fist/split_scenes/shoot-draw_p1_is_ready',
  'gun-knife-fist/split_scenes/shoot-draw_p2_is_ready',
  'gun-knife-fist/split_scenes/stab-draw_p1_is_ready',
  'gun-knife-fist/split_scenes/stab-draw_p2_is_ready',
  'gun-knife-fist/split_scenes/stab-punch_puncher_is_ready',
  'gun-knife-fist/split_scenes/stab-punch_stabber_is_ready',
]);
const TAP_TAP_SHOOT_Y_DOODLES = Object.freeze([
  'tap-tap-shoot-y/standoff-ssd',
  'tap-tap-shoot-y/reload-draw',
  'tap-tap-shoot-y/reload-duck',
  'tap-tap-shoot-y/shoot-draw',
  'tap-tap-shoot-y/shoot-duck',
  'tap-tap-shoot-y/shoot-kill',
  'tap-tap-shoot-y/stab-draw',
  'tap-tap-shoot-y/stab-kill',
  'tap-tap-shoot-y/stab-reload',
  'tap-tap-shoot-y/duck-draw',
]);
const TAP_TAP_SHOOT_Y_SPLIT_DOODLES = Object.freeze([
  'tap-tap-shoot-y/split_scenes/ssd-standoff_p1_is_ready',
  'tap-tap-shoot-y/split_scenes/ssd-standoff_p2_is_ready',
  'tap-tap-shoot-y/split_scenes/reloading_p1_is_ready',
  'tap-tap-shoot-y/split_scenes/reloading_p2_is_ready',
  'tap-tap-shoot-y/split_scenes/shoot-draw_p1_is_ready',
  'tap-tap-shoot-y/split_scenes/shoot-draw_p2_is_ready',
  'tap-tap-shoot-y/split_scenes/stab-draw_p1_is_ready',
  'tap-tap-shoot-y/split_scenes/stab-draw_p2_is_ready',
  'tap-tap-shoot-y/split_scenes/duck-draw_p1_is_ready',
  'tap-tap-shoot-y/split_scenes/duck-draw_p2_is_ready',
  'tap-tap-shoot-y/split_scenes/reload-duck_reloader_is_ready',
  'tap-tap-shoot-y/split_scenes/reload-duck_ducker_is_ready',
  'tap-tap-shoot-y/split_scenes/shoot-duck_shooter_is_ready',
  'tap-tap-shoot-y/split_scenes/shoot-duck_ducker_is_ready',
  'tap-tap-shoot-y/split_scenes/stab-reload_stabber_is_ready',
  'tap-tap-shoot-y/split_scenes/stab-reload_reloader_is_ready',
]);
const TAP_TAP_SHOOT_X_DOODLES = Object.freeze([
  'tap-tap-shoot-x/standoff-tts',
  'tap-tap-shoot-x/defense-draw',
  'tap-tap-shoot-x/reload-draw',
  'tap-tap-shoot-x/reload-duck',
  'tap-tap-shoot-x/shoot-draw',
  'tap-tap-shoot-x/shoot-duck',
  'tap-tap-shoot-x/shoot-kill',
  'tap-tap-shoot-x/stab-counterstab',
  'tap-tap-shoot-x/stab-draw',
  'tap-tap-shoot-x/stab-kill',
]);
const TAP_TAP_SHOOT_X_SPLIT_DOODLES = Object.freeze([
  'tap-tap-shoot-x/split_scenes/tts-standoff_p1_is_ready',
  'tap-tap-shoot-x/split_scenes/tts-standoff_p2_is_ready',
  'tap-tap-shoot-x/split_scenes/reloading_p1_is_ready',
  'tap-tap-shoot-x/split_scenes/reloading_p2_is_ready',
  'tap-tap-shoot-x/split_scenes/shoot-draw_p1_is_ready',
  'tap-tap-shoot-x/split_scenes/shoot-draw_p2_is_ready',
  'tap-tap-shoot-x/split_scenes/shoot-duck_shooter_is_ready',
  'tap-tap-shoot-x/split_scenes/shoot-duck_ducker_is_ready',
  'tap-tap-shoot-x/split_scenes/stab-draw_p1_is_ready',
  'tap-tap-shoot-x/split_scenes/stab-draw_p2_is_ready',
  'tap-tap-shoot-x/split_scenes/defense-draw_p1_is_ready',
  'tap-tap-shoot-x/split_scenes/defense-draw_p2_is_ready',
  'tap-tap-shoot-x/split_scenes/reload-defense_reloader_is_ready',
  'tap-tap-shoot-x/split_scenes/reload-defense_defender_is_ready',
  'tap-tap-shoot-x/split_scenes/stab-counterstab_stabber_is_ready',
  'tap-tap-shoot-x/split_scenes/stab-counterstab_counterstabber_is_ready',
]);

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
const CURTAIN_WIPE_STEPS = Object.freeze([
  'curtains-open',
  'curtains-frame1',
  'curtains-frame2',
  'curtains-frame3',
  'curtains-closed',
]);

const doodleSheets = new Map();
let doodleRenderers = [];
const curtainBoilStops = new WeakMap();
let rendererPauseStartedAt = null;
let rendererPausedDuration = 0;

function getSharpContext(canvas) {
  const context = canvas.getContext('2d');
  if (context) {
    context.imageSmoothingEnabled = false;
  }
  return context;
}

export function preloadDoodleSheets(doodles) {
  return Promise.all([...new Set(doodles)].map((doodle) => ensureImageLoaded(loadDoodleSheet(doodle))));
}

export function getRendererPreloadDoodles() {
  return [
    ...Object.values(FIREBALL_WAR_DOODLES),
    'fireball-war/super-blasting',
    ...Array.from({ length: 4 }, (_, index) => `fireball-war/super-final-frame${index + 1}`),
    ...TAP_TAP_SHOOT_Y_DOODLES,
    ...TAP_TAP_SHOOT_Y_SPLIT_DOODLES,
    ...GUN_KNIFE_FIST_DOODLES,
    ...GUN_KNIFE_FIST_SPLIT_DOODLES,
    ...TAP_TAP_SHOOT_X_DOODLES,
    ...TAP_TAP_SHOOT_X_SPLIT_DOODLES,
    ...STARBURST_WIPE_STEPS.flat().map((name) => `starburst_wipe/${name}`),
    ...CURTAIN_WIPE_STEPS.map((name) => `curtains/${name}`),
    ...READY_WAITING_READY_STEPS.map((name) => `ready_waiting/${name}`),
    'ready_waiting/rdy',
    ...COUNTDOWN_NUMBERS.map((number) => `ready_waiting/countdown${number}`),
    'ready_waiting/waiting1',
    'ready_waiting/waiting2',
    'ready_waiting/waiting3',
  ];
}

export function pauseRendererClock() {
  if (rendererPauseStartedAt !== null) {
    return;
  }

  rendererPauseStartedAt = performance.now();
}

export function resumeRendererClock() {
  if (rendererPauseStartedAt === null) {
    return;
  }

  rendererPausedDuration += performance.now() - rendererPauseStartedAt;
  rendererPauseStartedAt = null;
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

// Generic full-screen curtain transition. Put screen/state changes in onCovered.
export async function playCurtainWipeTransition(app, onCovered, { playCloseAudio = null, playOpenAudio = null } = {}) {
  await preloadCurtainWipe();

  let overlay = createCurtainOverlay(app);
  const closedStep = CURTAIN_WIPE_STEPS.length - 1;

  playCloseAudio?.();
  await animateCurtainSteps(overlay, 0, closedStep);
  await holdCurtainStep(overlay, CURTAIN_WIPE_STEPS[closedStep], CURTAIN_CLOSED_BEAT_MS);

  onCovered();

  overlay = createCurtainOverlay(app);
  drawCurtainStep(overlay, CURTAIN_WIPE_STEPS[closedStep], performance.now());
  playOpenAudio?.();
  await animateCurtainSteps(overlay, closedStep - 1, 0);
  overlay.remove();
}

export async function closeCurtainWipe(app, playCloseAudio = null) {
  await preloadCurtainWipe();

  const overlay = createCurtainOverlay(app);
  const closedStep = CURTAIN_WIPE_STEPS.length - 1;

  playCloseAudio?.();
  await animateCurtainSteps(overlay, 0, closedStep);
  startCurtainBoil(overlay, CURTAIN_WIPE_STEPS[closedStep]);

  return overlay;
}

export async function openCurtainWipe(overlay, playOpenAudio = null) {
  if (!overlay?.isConnected) {
    return;
  }

  stopCurtainBoil(overlay);
  const closedStep = CURTAIN_WIPE_STEPS.length - 1;
  drawCurtainStep(overlay, CURTAIN_WIPE_STEPS[closedStep], performance.now());
  playOpenAudio?.();
  await animateCurtainSteps(overlay, closedStep - 1, 0);
  overlay.remove();
}

export function getDoodlePresentation(p1Move, p2Move, { variantId = '' } = {}) {
  return resolveScene({ variantId, p1Move, p2Move });
}

export function getVariantStagePresentation(result, p1Move, p2Move, { variantId = '' } = {}) {
  return resolveScene({ variantId, p1Move, p2Move, result });
}

function getTapTapShootYStagePresentation(result, p1Move, p2Move) {
  if (p1Move === p2Move) {
    return {
      kind: 'doodle',
      name: `tap-tap-shoot-y/${p1Move === 'reload' ? 'reload' : p1Move}-draw`,
      flip: false,
    };
  }

  const hitMove = result.p1Hit ? p1Move : result.p2Hit ? p2Move : null;

  if (hitMove === 'shoot') {
    return {
      kind: 'doodle',
      name: 'tap-tap-shoot-y/shoot-kill',
      flip: p2Move === 'shoot',
    };
  }

  if (hitMove === 'stab') {
    return {
      kind: 'doodle',
      name: 'tap-tap-shoot-y/stab-kill',
      flip: p2Move === 'stab',
    };
  }

  if ((p1Move === 'reload' && p2Move === 'duck') || (p1Move === 'duck' && p2Move === 'reload')) {
    return {
      kind: 'doodle',
      name: 'tap-tap-shoot-y/reload-duck',
      flip: p1Move === 'duck',
    };
  }

  if ((p1Move === 'shoot' && p2Move === 'duck') || (p1Move === 'duck' && p2Move === 'shoot')) {
    return {
      kind: 'doodle',
      name: 'tap-tap-shoot-y/shoot-duck',
      flip: p2Move === 'shoot',
    };
  }

  if ((p1Move === 'stab' && p2Move === 'reload') || (p1Move === 'reload' && p2Move === 'stab')) {
    return {
      kind: 'doodle',
      name: 'tap-tap-shoot-y/stab-reload',
      flip: p2Move === 'stab',
    };
  }

  return {
    kind: 'doodle',
    name: 'tap-tap-shoot-y/duck-draw',
    flip: p1Move === 'duck',
  };
}

export function getVariantSuperAnimation(result, { variantId = '', resourceMax = 0, frameCount = 4 } = {}) {
  if (
    (variantId === 'fireballWar' || variantId === 'fireball-war')
    && result?.winner
    && result[`${result.winner}Move`] === 'charge'
    && result.resources?.[result.winner] >= resourceMax
  ) {
    const flip = result.winner === 'p2';
    return {
      frames: Array.from({ length: frameCount }, (_, index) => ({
        kind: 'doodle',
        name: `fireball-war/super-final-frame${index + 1}`,
        flip,
      })),
      finalFrame: {
        kind: 'doodle',
        name: 'fireball-war/super-blasting',
        flip,
      },
    };
  }

  return null;
}

export function mountSpriteRenderers(canvases) {
  doodleRenderers = [...canvases].map((canvas) => ({
    canvas,
    context: getSharpContext(canvas),
    image: loadSpriteSheet(canvas),
    frameWidth: Number(canvas.dataset.frameWidth) || DOODLE_FRAME_WIDTH,
    frameHeight: Number(canvas.dataset.frameHeight) || DOODLE_FRAME_HEIGHT,
    flip: canvas.dataset.flip === 'true',
  }));

  doodleRenderers.forEach(({ canvas, image }) => {
    installSpriteFallback(canvas, image);
  });
  drawDoodleFrame(getRendererNow(performance.now()));
  ensureDoodleLoop();
}

export function setBoilEnabled(isEnabled) {
  isBoilEnabled = Boolean(isEnabled);
  drawDoodleFrame(getRendererNow(performance.now()));
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

function createCurtainOverlay(app) {
  const canvas = document.createElement('canvas');
  canvas.className = 'wipe-overlay curtain-wipe-overlay';
  canvas.width = CURTAIN_FRAME_WIDTH;
  canvas.height = CURTAIN_FRAME_HEIGHT;
  canvas.setAttribute('aria-hidden', 'true');
  app.append(canvas);
  return canvas;
}

function preloadStarburstWipe() {
  const images = new Set(STARBURST_WIPE_STEPS.flat());
  return preloadDoodleSheets([...images].map((name) => `starburst_wipe/${name}`));
}

function preloadCurtainWipe() {
  return preloadDoodleSheets(CURTAIN_WIPE_STEPS.map((name) => `curtains/${name}`));
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

function waitMs(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

function getRendererNow(now) {
  const frozenNow = rendererPauseStartedAt ?? now;
  return frozenNow - rendererPausedDuration;
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
  const context = getSharpContext(canvas);
  await preloadReadyWaiting();

  const startedAt = getRendererNow(performance.now());
  const holdReady = canvas.dataset.readyPhase === 'countdown';
  let didRequestSplit = false;

  function tick(now) {
    if (!canvas.isConnected) {
      return;
    }

    const renderNow = getRendererNow(now);
    const elapsed = renderNow - startedAt;
    const stepIndex = getReadyWaitingStepIndex(elapsed);
    const layers = holdReady ? ['rdy'] : getReadyWaitingLayersForStep(stepIndex);

    if (!holdReady && !didRequestSplit && stepIndex >= READY_WAITING_SPLIT_STEP) {
      didRequestSplit = true;
      canvas.dispatchEvent(new CustomEvent('ready-waiting-split', { bubbles: true }));
    }

    drawReadyWaitingStep(canvas, context, layers, renderNow);
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
  const frame = getBoilFrame(now);

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
  const context = getSharpContext(canvas);
  await preloadReadyWaiting();

  const startedAt = getRendererNow(performance.now());
  const elapsedOffset = canvas.dataset.immediate === 'true' ? WAITING_DOTS_START_DELAY : 0;

  function tick(now) {
    if (!canvas.isConnected) {
      return;
    }

    const renderNow = getRendererNow(now);
    const elapsed = renderNow - startedAt + elapsedOffset;
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (elapsed >= WAITING_DOTS_START_DELAY) {
      drawWaitingDotsStep(canvas, context, elapsed - WAITING_DOTS_START_DELAY, renderNow);
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

  const frame = getBoilFrame(now);

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
  const context = getSharpContext(canvas);
  await preloadReadyWaiting();

  const startedAt = getRendererNow(performance.now());

  function tick(now) {
    if (!canvas.isConnected) {
      return;
    }

    const renderNow = getRendererNow(now);
    drawCountdownStep(canvas, context, renderNow - startedAt, renderNow);
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

  const frame = getBoilFrame(now);

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

function animateCurtainSteps(canvas, firstStep, lastStep) {
  return new Promise((resolve) => {
    const direction = firstStep <= lastStep ? 1 : -1;
    const stepCount = Math.abs(lastStep - firstStep) + 1;

    if (stepCount <= 0) {
      resolve();
      return;
    }

    const startedAt = performance.now();

    function tick(now) {
      const elapsed = now - startedAt;
      const stepOffset = Math.min(stepCount - 1, Math.floor(elapsed / CURTAIN_STEP_DURATION));
      const stepIndex = firstStep + (stepOffset * direction);

      drawCurtainStep(canvas, CURTAIN_WIPE_STEPS[stepIndex], now);

      if (stepOffset >= stepCount - 1 && elapsed >= stepCount * CURTAIN_STEP_DURATION) {
        resolve();
        return;
      }

      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  });
}

function holdCurtainStep(canvas, step, duration) {
  return new Promise((resolve) => {
    const startedAt = performance.now();

    function tick(now) {
      drawCurtainStep(canvas, step, now);

      if (now - startedAt >= duration) {
        resolve();
        return;
      }

      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  });
}

function startCurtainBoil(canvas, step) {
  stopCurtainBoil(canvas);

  let isRunning = true;
  curtainBoilStops.set(canvas, () => {
    isRunning = false;
  });

  function tick(now) {
    if (!isRunning || !canvas.isConnected) {
      curtainBoilStops.delete(canvas);
      return;
    }

    drawCurtainStep(canvas, step, now);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function stopCurtainBoil(canvas) {
  const stop = curtainBoilStops.get(canvas);

  if (!stop) {
    return;
  }

  stop();
  curtainBoilStops.delete(canvas);
}

function drawWipeStep(canvas, layers, now) {
  if (!layers) {
    return;
  }

  const context = getSharpContext(canvas);
  const frame = getBoilFrame(now);

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

function drawCurtainStep(canvas, step, now) {
  const context = getSharpContext(canvas);
  const image = loadDoodleSheet(`curtains/${step}`);
  const frame = getBoilFrame(now);

  context.clearRect(0, 0, canvas.width, canvas.height);

  if (!image.complete || !image.naturalWidth) {
    return;
  }

  context.drawImage(
    image,
    0,
    frame * CURTAIN_FRAME_HEIGHT,
    CURTAIN_FRAME_WIDTH,
    CURTAIN_FRAME_HEIGHT,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

function getDoodleForMoves(p1Move, p2Move, variantId = '') {
  if (variantId === 'rps' || variantId === 'rock-paper-scissors') {
    return getRpsDoodleForMoves(p1Move, p2Move);
  }

  if (variantId === 'fireballWar' || variantId === 'fireball-war') {
    return getFireballWarDoodleForMoves(p1Move, p2Move);
  }

  const sortedMoves = [p1Move, p2Move].sort((a, b) => MOVE_IDS.indexOf(a) - MOVE_IDS.indexOf(b));
  const key = sortedMoves.join('|');
  return INTERACTION_DOODLES[key] ?? 'hiding';
}

function getFireballWarDoodleForMoves(p1Move, p2Move) {
  const sortedMoves = [p1Move, p2Move].sort((a, b) => MOVE_IDS.indexOf(a) - MOVE_IDS.indexOf(b));
  const key = sortedMoves.join('|');
  return FIREBALL_WAR_DOODLES[key] ?? 'fireball-war/cbf-standoff';
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

function getGunKnifeFistStagePresentation(result, p1Move, p2Move) {
  if (p1Move === p2Move) {
    return {
      kind: 'doodle',
      name: `gun-knife-fist/${p1Move}-draw`,
      flip: false,
    };
  }

  const hitMove = result.p1Hit ? p1Move : result.p2Hit ? p2Move : null;
  const targetMove = result.p1Hit ? p2Move : result.p2Hit ? p1Move : null;
  const isKill = result.winner !== null;

  if (hitMove === 'punch' && targetMove === 'shoot') {
    return {
      kind: 'doodle',
      name: `gun-knife-fist/punch-shoot-${isKill ? 'kill' : 'damage'}`,
      flip: p2Move === 'punch',
    };
  }

  if (hitMove === 'stab' && targetMove === 'punch') {
    return {
      kind: 'doodle',
      name: `gun-knife-fist/stab-punch-${isKill ? 'kill' : 'damage'}`,
      flip: p2Move === 'stab',
    };
  }

  return {
    kind: 'doodle',
    name: 'gun-knife-fist/shoot-stab',
    flip: p2Move === 'shoot',
  };
}

function getTapTapShootXStagePresentation(result, p1Move, p2Move) {
  if (p1Move === p2Move) {
    const drawName = p1Move === 'duck' || p1Move === 'counterstab'
      ? 'defense-draw'
      : `${p1Move === 'reload' ? 'reload' : p1Move}-draw`;

    return {
      kind: 'doodle',
      name: `tap-tap-shoot-x/${drawName}`,
      flip: false,
    };
  }

  const hitMove = result.p1Hit ? p1Move : result.p2Hit ? p2Move : null;

  if (hitMove === 'shoot') {
    return {
      kind: 'doodle',
      name: 'tap-tap-shoot-x/shoot-kill',
      flip: p2Move === 'shoot',
    };
  }

  if (hitMove === 'stab') {
    return {
      kind: 'doodle',
      name: 'tap-tap-shoot-x/stab-kill',
      flip: p2Move === 'stab',
    };
  }

  if ((p1Move === 'stab' && p2Move === 'counterstab') || (p1Move === 'counterstab' && p2Move === 'stab')) {
    return {
      kind: 'doodle',
      name: 'tap-tap-shoot-x/stab-counterstab',
      flip: p2Move === 'stab',
    };
  }

  if ((p1Move === 'stab' && p2Move === 'duck') || (p1Move === 'duck' && p2Move === 'stab')) {
    return {
      kind: 'doodle',
      name: 'tap-tap-shoot-x/defense-draw',
      flip: p1Move === 'duck',
    };
  }

  if ((p1Move === 'reload' && p2Move === 'duck') || (p1Move === 'duck' && p2Move === 'reload')) {
    return {
      kind: 'doodle',
      name: 'tap-tap-shoot-x/reload-duck',
      flip: p1Move === 'duck',
    };
  }

  if ((p1Move === 'shoot' && p2Move === 'duck') || (p1Move === 'duck' && p2Move === 'shoot')) {
    return {
      kind: 'doodle',
      name: 'tap-tap-shoot-x/shoot-duck',
      flip: p2Move === 'shoot',
    };
  }

  return {
    kind: 'doodle',
    name: 'tap-tap-shoot-x/defense-draw',
    flip: p2Move === 'duck' || p2Move === 'counterstab',
  };
}

function shouldFlipDoodle(doodle, p1Move, p2Move, variantId = '') {
  if (variantId === 'rps' || variantId === 'rock-paper-scissors') {
    return (doodle === 'rock-paper-scissors/rock-scissors' && p2Move === 'rock')
      || (doodle === 'rock-paper-scissors/paper-rock' && p2Move === 'paper')
      || (doodle === 'rock-paper-scissors/scissors-paper' && p2Move === 'scissors');
  }

  if (variantId === 'fireballWar' || variantId === 'fireball-war') {
    return (doodle === 'fireball-war/block-charge' && p1Move === 'charge')
      || (doodle === 'fireball-war/block-fireball' && p1Move === 'fireball')
      || (doodle === 'fireball-war/charge-fireball' && p1Move === 'fireball');
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
  image.onload = () => drawDoodleFrame(getRendererNow(performance.now()));
  doodleSheets.set(key, image);
  return image;
}

function ensureDoodleLoop() {
  if (ensureDoodleLoop.isRunning) {
    return;
  }

  ensureDoodleLoop.isRunning = true;

  function tick(now) {
    drawDoodleFrame(getRendererNow(now));
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function drawDoodleFrame(now) {
  if (!doodleRenderers.length) {
    return;
  }

  const frame = getBoilFrame(now);

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

function getBoilFrame(now) {
  if (!isBoilEnabled) {
    return 0;
  }

  return Math.floor((now / 1000) * DOODLE_FRAME_RATE) % DOODLE_FRAME_COUNT;
}
