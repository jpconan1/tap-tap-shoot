import {
  DEFAULT_VARIANT_ID,
  MAX_BULLETS,
  MOVES,
  VARIANT_IDS,
  getVariantMoveIds,
  getVariantResourceMax,
} from './engine/moves.js';
import { createRoundState, getPlayerLegalMoves, getPlayerResource, playTurn } from './engine/gameState.js';
import { chooseRivalMove as chooseAiMove, DEFAULT_RIVAL_ID } from './engine/rivalAi.js';
import {
  configureAudio,
  CURTAIN_CLOSE_AUDIO,
  CURTAIN_OPEN_AUDIO,
  finishMusicLoopThenStop,
  getMusicTopperId,
  installAudioUnlockListeners,
  interruptMusicFileOnce,
  LOSE_JINGLE_AUDIO,
  playOneShotAudio,
  playUserGestureAudio,
  preloadSceneAudio,
  playStageAudio,
  queueMusicTrackOnce,
  READY_AUDIO,
  requestMusicTrack,
  resetStageAudioKey,
  restartMusicTrackOnce,
  STARBURST_WIPE_AUDIO,
  setMusicEnabled,
  setSoundEnabled,
  syncMusicTopper,
  unlockSceneAudio,
  WIN_SOUND_AUDIO,
} from './audio.js';
import { RankedClient } from './rankedClient.js';
import { getResourcePresentation, shouldShowPickHistoryForVariant } from './variantPresentation.js';
import {
  DOODLE_FRAME_RATE,
  DOODLE_FRAME_HEIGHT,
  DOODLE_FRAME_WIDTH,
  getVariantStagePresentation,
  getVariantSuperAnimation,
  getRendererPreloadDoodles,
  mountCountdownOverlays,
  mountReadyWaitingOverlays,
  mountWaitingDotsOverlays,
  mountSpriteRenderers,
  closeCurtainWipe,
  openCurtainWipe,
  pauseRendererClock,
  playCurtainWipeTransition,
  playStarburstWipeTransition,
  preloadDoodleSheets,
  READY_WAITING_SAFE_PHASE_MS,
  resumeRendererClock,
} from './renderer.js';

const BEAT_MS = 750;
const BUTTON_FRAME_WIDTH = 256;
const BUTTON_FRAME_HEIGHT = 128;
const TURN_FRAME_WIDTH = 256;
const TURN_FRAME_HEIGHT = 128;
const BULLETS_LABEL_FRAME_WIDTH = 256;
const BULLETS_LABEL_FRAME_HEIGHT = 80;
const BULLETS_ICON_FRAME_WIDTH = 64;
const BULLETS_ICON_FRAME_HEIGHT = 64;
const WINS_LABEL_FRAME_WIDTH = 128;
const WINS_LABEL_FRAME_HEIGHT = 64;
const WIN_MARK_FRAME_WIDTH = 64;
const WIN_MARK_FRAME_HEIGHT = 64;
const PICK_LABEL_FRAME_WIDTH = 128;
const THEY_PICKED_LABEL_FRAME_WIDTH = 150;
const PICK_LABEL_FRAME_HEIGHT = 64;
const MOVE_ICON_FRAME_WIDTH = 128;
const MOVE_ICON_FRAME_HEIGHT = 128;
const TITLE_LOGO_FRAME_WIDTH = 512;
const TITLE_LOGO_FRAME_HEIGHT = 368;
const TITLE_BUTTON_FRAME_WIDTH = 256;
const TITLE_BUTTON_FRAME_HEIGHT = 128;
const TITLE_AUDIO_BUTTON_FRAME_WIDTH = 384;
const TITLE_AUDIO_BUTTON_FRAME_HEIGHT = 192;
const VARIANT_BUTTON_FRAME_WIDTH = 325;
const VARIANT_BUTTON_FRAME_HEIGHT = 128;
const PICK_VARIANT_FRAME_WIDTH = 388;
const PICK_VARIANT_FRAME_HEIGHT = 233;
const TUTORIAL_MAIN_SLIDE_COUNT = 6;
const TUTORIAL_REVEAL_SLIDE_INDEX = 5;
const TUTORIAL_TIPS_SLIDE_COUNT = 3;
const REMATCH_BUTTON_FRAME_WIDTH = 256;
const REMATCH_BUTTON_FRAME_HEIGHT = 128;
const BULLET_SLOT_COUNT = MAX_BULLETS;
const LAST_NUMBERED_TURN = 21;
const GAME_TARGET_ROUNDS = 5;
const FRAME_WIDTH = 960;
const FRAME_HEIGHT = 540;
const VARIANT_LAYOUT_URLS = Object.freeze({
  [VARIANT_IDS.shootStabDuck]: './assets/shoot-stab-duck/layout.json',
  [VARIANT_IDS.rps]: './assets/rock-paper-scissors/rps-layout.json',
  [VARIANT_IDS.chargeBlockFireball]: './assets/charge-block-fireball/cbf-layout.json',
  [VARIANT_IDS.punchStabShoot]: './assets/punch-stab-shoot/pss-layout.json',
});
const DEFAULT_LAYOUT_STATE_ID = 'playing.default';
const DISADVANTAGED_LAYOUT_STATE_ID = 'playing.disadvantaged';
const BETWEEN_ROUND_LAYOUT_STATE_ID = 'round.between';
const GAME_OVER_LAYOUT_STATE_ID = 'round.game-over';
const ROUND_OVER_SCENE_BEATS = 2;
const READY_BEATS = 3;
const SUPER_FINAL_FRAME_COUNT = 4;
const SUPER_FINAL_FRAME_MS = 320;
const SUPER_FINAL_LINGER_BEATS = 1;
const COMPUTER_MOVE_DELAY_MS = 3000;
const COUNTDOWN_PHASE_MS = 5000;
const LOADING_FRAME_WIDTH = 512;
const LOADING_FRAME_HEIGHT = 256;
const LOADING_FRAME_COUNT = 10;
const LOADING_FRAME_RATE = DOODLE_FRAME_RATE;
const LOADING_LOOP_COUNT = 1;
const LOADING_DURATION_MS = (LOADING_FRAME_COUNT / LOADING_FRAME_RATE) * LOADING_LOOP_COUNT * 1000;
const LOADING_BAR_FRAME_COUNT = 3;
const LOADING_BAR_FRAME_RATE = 8;
const LOADING_CLICK_BLINK_MS = 1400;
const LOADING_ANIMATION_FRAME_URLS = Object.freeze(
  Array.from({ length: LOADING_FRAME_COUNT }, (_, index) => `./assets/loading_animation_frames/${index + 1}.webp`),
);
const LOADING_BAR_EMPTY_URL = './assets/progress_bar_empty_sheet.webp';
const LOADING_BAR_FULL_URL = './assets/progress_bar_full_sheet.webp';
const LOADING_CLICK_MESSAGE_URL = './assets/click_msg_sheet.webp';
const PAPER_BACKGROUND_URL = './assets/crumpled_paper_background.webp';
const ONLINE_STATUS_POLL_MS = 5000;
const RANKED_DISPLAY_NAME_KEY = 'tapTapShoot.rankedDisplayName';
const DEFAULT_RANKED_DISPLAY_NAME = 'Guest';
const MAX_RANKED_DISPLAY_NAME_LENGTH = 50;
const NAME_PREFIXES = Object.freeze([
  'Steely',
  'Mega',
  'Supa',
  'Ultra',
  'Omega',
  'SSJ',
  'Sneaky',
  'Sharp',
  'Gung-Ho',
  'Fidgety',
  'Slippery',
  'Thick',
  'Tsar',
  'Stabby',
  'Gunslinger',
  'Baby',
  "Ol'",
  'King',
  'Grandmaster',
]);
const NAME_MAINS = Object.freeze([
  'Pete',
  'Vega',
  'Samwise',
  'Paul',
  'Goku',
  'Niki',
  'Louise',
  'Frank',
  'Clark',
  'Hippo',
  'Gizmo',
  'Alexander',
  'Burger',
]);
const NAME_SUFFIXES = Object.freeze([
  ', Certified Fraud',
  'the Chill',
  ', Reborn',
  'Marks',
  'Dodge',
  ', Counterer',
  ', Doodler',
  'Bigups',
  'the Stank',
  ', Harasser',
  'Waters',
  'Rigby',
  'Conan',
  'Cooney',
  'Clever',
  'K. Rool',
  'Parker',
  '####',
]);
const MOVE_BUTTON_DOODLES = Object.freeze({
  rock: 'rock-paper-scissors/rock_button',
  paper: 'rock-paper-scissors/paper_button',
  scissors: 'rock-paper-scissors/scissors_button',
  charge: 'charge-block-fireball/charge_button',
  block: 'charge-block-fireball/block_button',
  fireball: 'charge-block-fireball/fireball_button',
  punch: 'punch-stab-shoot/punch_button',
  reload: 'reload_button',
  shoot: 'shoot_button',
  stab: 'stab_button',
  duck: 'duck_button',
  counterstab: 'mactheknife_button',
});
const MOVE_ICON_DOODLES = Object.freeze({
  rock: 'rock-paper-scissors/rock_button',
  paper: 'rock-paper-scissors/paper_button',
  scissors: 'rock-paper-scissors/scissors_button',
  charge: 'charge-block-fireball/charge icon',
  block: 'charge-block-fireball/block_button',
  fireball: 'charge-block-fireball/fireball_button',
  punch: 'stab_icon',
  reload: 'reload_icon',
  shoot: 'shoot_icon',
  stab: 'stab_icon',
  duck: 'dodge_icon',
  counterstab: 'counterstab_icon',
});
const TUTORIAL_OUTCOMES = Object.freeze({
  '1-1:reload': Object.freeze({
    p2Move: 'stab',
    lines: Object.freeze([
      Object.freeze({ text: 'Reloading while your opponent has a Bullet' }),
      Object.freeze({ text: 'is a bad idea.' }),
      Object.freeze({ text: 'They get a Win.' }),
    ]),
  }),
  '1-1:shoot': Object.freeze({
    p2Move: 'duck',
    lines: Object.freeze([
      Object.freeze({ text: 'Watch out!', size: 'big' }),
      Object.freeze({ text: 'They have a Bullet' }),
      Object.freeze({ text: "and you don't." }),
    ]),
  }),
  '1-1:stab': Object.freeze({
    p2Move: 'duck',
    lines: Object.freeze([
      Object.freeze({ text: 'Nice.', size: 'big' }),
      Object.freeze({ text: 'They thought you were' }),
      Object.freeze({ text: 'going to shoot.' }),
      Object.freeze({ text: 'You get a Win.' }),
    ]),
  }),
  '1-1:duck': Object.freeze({
    p2Move: 'shoot',
    lines: Object.freeze([
      Object.freeze({ text: 'Nice.', size: 'big' }),
      Object.freeze({ text: 'Now you have an advantage.' }),
      Object.freeze({ text: "Your opponent can't" }),
      Object.freeze({ text: 'attack next round.' }),
    ]),
  }),
  '1-0:reload': Object.freeze({
    p2Move: 'duck',
    lines: Object.freeze([
      Object.freeze({ text: 'Cunning.', size: 'big' }),
      Object.freeze({ text: 'Your advantage grew' }),
      Object.freeze({ text: 'and the game continues.' }),
    ]),
  }),
  '1-0:shoot': Object.freeze({
    p2Move: 'duck',
    lines: Object.freeze([
      Object.freeze({ text: 'Back to even.', size: 'big' }),
      Object.freeze({ text: 'They guessed right.' }),
      Object.freeze({ text: 'How mysterious.', size: 'small' }),
    ]),
  }),
  '1-0:stab': Object.freeze({
    p2Move: 'duck',
    lines: Object.freeze([
      Object.freeze({ text: 'Back to even.', size: 'big' }),
      Object.freeze({ text: 'They guessed right.' }),
      Object.freeze({ text: 'How mysterious.', size: 'small' }),
    ]),
  }),
  '1-0:duck': Object.freeze({
    p2Move: 'reload',
    lines: Object.freeze([
      Object.freeze({ text: 'Odd choice.', size: 'big' }),
      Object.freeze({ text: 'You made a defensive move' }),
      Object.freeze({ text: 'when your opponent' }),
      Object.freeze({ text: "couldn't attack." }),
      Object.freeze({ text: 'Back to even.' }),
    ]),
  }),
  '0-1:reload': Object.freeze({
    p2Move: 'shoot',
    lines: Object.freeze([
      Object.freeze({ text: 'Low key smart.', size: 'big' }),
      Object.freeze({ text: "But it won't work" }),
      Object.freeze({ text: 'in this tutorial.' }),
    ]),
  }),
  '0-1:duck': Object.freeze({
    p2Move: 'shoot',
    lines: Object.freeze([
      Object.freeze({ text: 'Whew!', size: 'big' }),
      Object.freeze({ text: 'You avoided the attack!' }),
      Object.freeze({ text: 'Back to even.' }),
    ]),
  }),
  'advantage:reload': Object.freeze({
    p2Move: 'duck',
    lines: Object.freeze([
      Object.freeze({ text: 'Cunning.', size: 'big' }),
      Object.freeze({ text: 'Your advantage grew' }),
      Object.freeze({ text: 'and the game continues.' }),
    ]),
  }),
  'advantage:shoot': Object.freeze({
    p2Move: 'duck',
    lines: Object.freeze([
      Object.freeze({ text: 'They guessed right.' }),
      Object.freeze({ text: 'How mysterious.', size: 'small' }),
    ]),
  }),
  'advantage:stab': Object.freeze({
    p2Move: 'duck',
    lines: Object.freeze([
      Object.freeze({ text: 'They guessed right.' }),
      Object.freeze({ text: 'How mysterious.', size: 'small' }),
    ]),
  }),
  'advantage:duck': Object.freeze({
    p2Move: 'duck',
    lines: Object.freeze([
      Object.freeze({ text: 'Odd choice.', size: 'big' }),
      Object.freeze({ text: 'You made a defensive move' }),
      Object.freeze({ text: 'when your opponent' }),
      Object.freeze({ text: "couldn't attack." }),
    ]),
  }),
});
const DEFAULT_OPPONENT_ID = DEFAULT_RIVAL_ID;
const COMPUTER_VARIANTS = Object.freeze([
  Object.freeze({
    id: VARIANT_IDS.rps,
    name: 'Rock Paper Scissors',
    buttonDoodle: 'rock-paper-scissors/rps_button',
  }),
  Object.freeze({
    id: VARIANT_IDS.chargeBlockFireball,
    name: 'Charge Block Fireball',
    buttonDoodle: 'charge-block-fireball/cbf_button',
  }),
  Object.freeze({
    id: VARIANT_IDS.shootStabDuck,
    name: 'Shoot Stab Duck',
    buttonDoodle: 'shoot-stab-duck/ssd_button',
  }),
  Object.freeze({
    id: VARIANT_IDS.punchStabShoot,
    name: 'Punch Stab Shoot',
    buttonDoodle: 'punch-stab-shoot/pss_button',
  }),
  Object.freeze({
    id: VARIANT_IDS.tapTapShoot,
    name: 'Tap Tap Shoot',
    buttonDoodle: 'tap-tap-shoot/tap_tap_shoot_button',
  }),
]);
const COMPUTER_VARIANT_IDS = Object.freeze(COMPUTER_VARIANTS.map((variant) => variant.id));

const app = document.querySelector('#app');
const FINDING_MATCH_DOODLES = Object.freeze([
  'title/findingmatch',
  'title/findingmatch1',
  'title/findingmatch2',
  'title/findingmatch3',
]);
let state = createRoundState();
let screen = 'title';
let playMode = 'local';
let selectedOpponentId = DEFAULT_OPPONENT_ID;
let selectedVariantId = DEFAULT_VARIANT_ID;
let isTransitioning = false;
let isMusicEnabled = false;
let isSoundEnabled = false;
let pauseMenu = null;
let pauseStartedAt = null;
const pausableTimers = new Set();
let loopToken = 0;
let turnPhase = 'idle';
let p1QueuedMove = null;
let localTurnChoice = null;
let rankedSnapshot = null;
let pendingRankedSnapshot = null;
let pendingSuperAnimation = null;
let isApplyingRankedSnapshot = false;
let rankedReadyWaiting = null;
let rankedReadyWaitingTimer = null;
let rankedRoundAudioKey = null;
let rankedDisplayName = readStoredDisplayName();
let onlinePlayerCount = null;
let onlineStatusTimer = null;
let findingMatchStep = 0;
let findingMatchTimer = null;
let tutorialSlideIndex = 0;
let tutorialTipsSlideIndex = 0;
let tutorialStageMode = 'slide';
let tutorialFeedbackMarkup = '';
let tutorialPendingFeedbackMarkup = '';
let stagePresentation = getIdleStagePresentation();
let gameLayouts = new Map();
let gameLayout = null;
let activeLayoutStateId = DEFAULT_LAYOUT_STATE_ID;
let lastMoves = {
  p1: 'reload',
  p2: 'reload',
};
let roundWins = {
  p1: 0,
  p2: 0,
};
const rankedClient = new RankedClient({
  onQueue: handleRankedQueue,
  onSnapshot: applyRankedSnapshot,
  onClose: handleRankedClose,
});

configureAudio({ getMusicTopperFile });

updateFrameScale();
window.addEventListener('resize', updateFrameScale);
window.addEventListener('keydown', handleGlobalKeydown);
installAudioUnlockListeners();
boot();

async function boot() {
  const loadingScreen = renderLoadingScreen();
  let loadingImages = null;
  const gameLayoutPromise = preloadGameLayouts()
    .then(() => {
      gameLayout = getCachedGameLayoutForVariant(DEFAULT_VARIANT_ID);
      updateFrameScale();
    })
    .catch((error) => {
      console.warn('Could not load game layout', error);
    });
  const loadingImagesPromise = preloadLoadingImages()
    .then((images) => {
      loadingImages = images;
      return images;
    })
    .then((images) => {
      if (!loadingScreen.isDone && images.boilFrames?.length && images.barEmpty && images.barFull && images.clickMessage) {
        playLoadingScreen(loadingScreen, images);
      }
    })
    .catch((error) => {
      console.warn('Could not load loading screen art', error);
    });
  const preloadPromise = preloadGameAssets().catch((error) => {
    console.warn('Could not preload all game assets', error);
  });

  const minimumLoadingPromise = loadingImagesPromise.then(() => waitMsWithoutToken(LOADING_DURATION_MS));

  await Promise.all([preloadPromise, minimumLoadingPromise, gameLayoutPromise]);
  stopLoadingScreen(loadingScreen, loadingImages);
  await waitForLoadingStart(loadingScreen);

  try {
    unlockSceneAudio();
    await playWipeTransition(() => render());
  } catch (error) {
    console.error('Could not render title screen', error);
  }
}

function renderLoadingScreen() {
  app.innerHTML = `
    <section class="loading-screen" aria-label="Loading">
      <button class="loading-start" type="button" aria-label="Start" disabled>
        <img
          class="loading-boil"
          src="${LOADING_ANIMATION_FRAME_URLS[0]}"
          width="${LOADING_FRAME_WIDTH}"
          height="${LOADING_FRAME_HEIGHT}"
          alt=""
          aria-hidden="true"
        />
        <canvas
          class="loading-progress"
          width="${LOADING_FRAME_WIDTH}"
          height="${LOADING_FRAME_HEIGHT}"
          aria-hidden="true"
        ></canvas>
        <canvas
          class="loading-click-message"
          width="${LOADING_FRAME_WIDTH}"
          height="${LOADING_FRAME_HEIGHT}"
          aria-hidden="true"
        ></canvas>
      </button>
    </section>
  `;

  return {
    button: app.querySelector('.loading-start'),
    boilImage: app.querySelector('.loading-boil'),
    progressCanvas: app.querySelector('.loading-progress'),
    clickMessageCanvas: app.querySelector('.loading-click-message'),
    animationFrameId: null,
    startedAt: 0,
    isDone: false,
  };
}

function preloadLoadingImages() {
  return Promise.all([
    Promise.all(LOADING_ANIMATION_FRAME_URLS.map((url) => loadImageAsset(url, { decode: false }))),
    loadImageAsset(LOADING_BAR_EMPTY_URL, { decode: false }),
    loadImageAsset(LOADING_BAR_FULL_URL, { decode: false }),
    loadImageAsset(LOADING_CLICK_MESSAGE_URL, { decode: false }),
  ]).then(([boilFrames, barEmpty, barFull, clickMessage]) => ({
    boilFrames,
    barEmpty,
    barFull,
    clickMessage,
  }));
}

function playLoadingScreen(loadingScreen, images) {
  loadingScreen.startedAt = performance.now();

  function tick(now) {
    if (!loadingScreen.button?.isConnected) {
      return;
    }

    drawLoadingScreen(loadingScreen, images, now);
    loadingScreen.animationFrameId = requestAnimationFrame(tick);
  }

  tick(loadingScreen.startedAt);
}

function drawLoadingScreen(loadingScreen, images, now) {
  if (!images) {
    return;
  }

  const elapsed = Math.max(0, now - loadingScreen.startedAt);
  const progress = loadingScreen.isDone ? 1 : getLoadingProgress(elapsed);
  const progressContext = loadingScreen.progressCanvas?.getContext('2d');
  const clickMessageContext = loadingScreen.clickMessageCanvas?.getContext('2d');
  const currentBoilFrame = loadingScreen.isDone
    ? LOADING_FRAME_COUNT - 1
    : Math.min(LOADING_FRAME_COUNT - 1, Math.floor((elapsed / 1000) * LOADING_FRAME_RATE));

  if (!loadingScreen.isDone && elapsed >= LOADING_DURATION_MS) {
    removeLoadingBoil(loadingScreen);
  }

  if (loadingScreen.boilImage && images.boilFrames?.[currentBoilFrame]) {
    loadingScreen.boilImage.src = images.boilFrames[currentBoilFrame].src;
  }

  if (!progressContext || !images.barEmpty || !images.barFull) {
    return;
  }

  const barFrame = Math.floor((now / 1000) * LOADING_BAR_FRAME_RATE) % LOADING_BAR_FRAME_COUNT;
  const barWidth = Math.round(LOADING_FRAME_WIDTH * progress);

  progressContext.clearRect(0, 0, LOADING_FRAME_WIDTH, LOADING_FRAME_HEIGHT);
  progressContext.drawImage(
    images.barEmpty,
    0,
    barFrame * LOADING_FRAME_HEIGHT,
    LOADING_FRAME_WIDTH,
    LOADING_FRAME_HEIGHT,
    0,
    0,
    LOADING_FRAME_WIDTH,
    LOADING_FRAME_HEIGHT,
  );

  if (barWidth <= 0) {
    return;
  }

  progressContext.drawImage(
    images.barFull,
    0,
    barFrame * LOADING_FRAME_HEIGHT,
    barWidth,
    LOADING_FRAME_HEIGHT,
    0,
    0,
    barWidth,
    LOADING_FRAME_HEIGHT,
  );

  if (!loadingScreen.isDone || !clickMessageContext || !images.clickMessage) {
    return;
  }

  const blinkPhase = (now % LOADING_CLICK_BLINK_MS) / LOADING_CLICK_BLINK_MS;
  const blinkAlpha = blinkPhase < 0.55 ? 1 : 0.18;

  clickMessageContext.clearRect(0, 0, LOADING_FRAME_WIDTH, LOADING_FRAME_HEIGHT);
  clickMessageContext.save();
  clickMessageContext.globalAlpha = blinkAlpha;
  clickMessageContext.drawImage(
    images.clickMessage,
    0,
    barFrame * LOADING_FRAME_HEIGHT,
    LOADING_FRAME_WIDTH,
    LOADING_FRAME_HEIGHT,
    0,
    0,
    LOADING_FRAME_WIDTH,
    LOADING_FRAME_HEIGHT,
  );
  clickMessageContext.restore();
}

function getLoadingProgress(elapsed) {
  const t = Math.min(1, elapsed / LOADING_DURATION_MS);

  if (t < 0.48) {
    return easeOutQuad(t / 0.48) * 0.5;
  }

  if (t < 0.56) {
    return 0.75;
  }

  if (t < 0.64) {
    return lerp(0.75, 0.82, (t - 0.56) / 0.08);
  }

  if (t < 0.72) {
    return 0.82;
  }

  if (t < 0.8) {
    return lerp(0.82, 0.9, (t - 0.72) / 0.08);
  }

  if (t < 0.88) {
    return lerp(0.9, 0.96, (t - 0.8) / 0.08);
  }

  if (t < 0.98) {
    return 0.99;
  }

  return 1;
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function stopLoadingScreen(loadingScreen, images) {
  loadingScreen.isDone = true;

  if (images) {
    drawLoadingScreen(loadingScreen, images, loadingScreen.startedAt + LOADING_DURATION_MS);
  }

  removeLoadingBoil(loadingScreen);
  loadingScreen.button?.classList.add('ready');
  loadingScreen.button?.removeAttribute('disabled');
}

function removeLoadingBoil(loadingScreen) {
  loadingScreen.boilImage?.remove();
  loadingScreen.boilImage = null;
}

function waitForLoadingStart(loadingScreen) {
  if (!loadingScreen.button) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    loadingScreen.button.addEventListener('click', resolve, { once: true });
  });
}

function preloadGameAssets() {
  return Promise.all([
    preloadDoodleSheets(getGamePreloadDoodles()),
    preloadStaticImages(),
    preloadGameFont(),
    preloadSceneAudio(),
  ]).then(() => undefined);
}

function getGamePreloadDoodles() {
  return [
    ...getRendererPreloadDoodles(),
    'READY',
    'bullets_label',
    'bullet_icon',
    'back_button',
    'continue_button',
    'continue_t_button',
    'next_slide_button',
    'Prev_slide_button',
    'quit_button',
    'reload_button',
    'reload-to-stab_arrow',
    'right_red',
    'down-right_red',
    'up-right_red',
    'left_red',
    'down-right_blue',
    'left_blue',
    'rematch_button',
    'tips_button',
    'wins_label',
    'you_picked',
    'they_picked',
    'system_scenes/game_won',
    'system_scenes/game_lost',
    'system_scenes/no_contest',
    'system_scenes/round_won',
    'system_scenes/round_lost',
    'tip1graphic',
    'tip2graphicgraphic',
    'title/LOGO',
    'title/playvcom_button',
    'title/playonline',
    'title/music_button',
    'title/music_button_checked',
    'title/sound_button',
    'title/sound_button_checked',
    ...FINDING_MATCH_DOODLES,
    ...COMPUTER_VARIANTS.map((variant) => variant.buttonDoodle),
    ...Object.values(MOVE_BUTTON_DOODLES),
    ...Object.values(MOVE_ICON_DOODLES),
    ...Array.from({ length: LAST_NUMBERED_TURN + 1 }, (_, turn) => `turn${turn}`),
    'turnlostcount',
    ...Array.from({ length: GAME_TARGET_ROUNDS }, (_, index) => `w${index + 1}`),
  ];
}

function preloadStaticImages() {
  return Promise.all([
    preloadImageAsset(PAPER_BACKGROUND_URL, { readyClass: 'paper-background-ready' }),
  ]).then(() => undefined);
}

function preloadImageAsset(src, { readyClass = '' } = {}) {
  return loadImageAsset(src)
    .then((didLoad) => {
      if (!didLoad) {
        return false;
      }

      if (readyClass) {
        document.body.classList.add(readyClass);
      }

      return true;
    });
}

function loadImageAsset(src, { decode = true } = {}) {
  const image = new Image();
  const loaded = new Promise((resolve) => {
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => resolve(null), { once: true });
    image.src = src;

    if (image.complete) {
      resolve(image.naturalWidth ? image : null);
    }
  });

  return loaded.then((loadedImage) => {
    if (!loadedImage) {
      return false;
    }

    if (!decode || !loadedImage.decode) {
      return loadedImage;
    }

    return loadedImage.decode().then(() => loadedImage, () => loadedImage);
  });
}

function preloadGameFont() {
  if (!document.fonts?.load) {
    return Promise.resolve();
  }

  return document.fonts.load('16px Pangolin').then(() => undefined, () => undefined);
}

async function loadGameLayoutForVariant(variantId) {
  const layoutUrl = getLayoutUrlForVariant(variantId);

  if (gameLayouts.has(layoutUrl)) {
    return gameLayouts.get(layoutUrl);
  }

  const response = await fetch(layoutUrl, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Layout request failed: ${response.status}`);
  }

  const layout = normalizeGameLayout(await response.json());
  gameLayouts.set(layoutUrl, layout);
  return layout;
}

function preloadGameLayouts() {
  return Promise.all(
    [...new Set([DEFAULT_VARIANT_ID, ...Object.keys(VARIANT_LAYOUT_URLS)])]
      .map((variantId) => loadGameLayoutForVariant(variantId)),
  );
}

function getLayoutUrlForVariant(variantId) {
  return VARIANT_LAYOUT_URLS[variantId] ?? GAME_LAYOUT_URL;
}

function getCachedGameLayoutForVariant(variantId) {
  return gameLayouts.get(getLayoutUrlForVariant(variantId)) ?? gameLayouts.get(GAME_LAYOUT_URL) ?? gameLayout;
}

async function setActiveGameLayoutForVariant(variantId) {
  gameLayout = await loadGameLayoutForVariant(variantId);
  updateFrameScale();
}

function setCachedActiveGameLayoutForVariant(variantId) {
  gameLayout = getCachedGameLayoutForVariant(variantId);
  updateFrameScale();
}

function normalizeGameLayout(payload) {
  if (payload?.version >= 2 && payload?.states && typeof payload.states === 'object') {
    return normalizeStatefulGameLayout(payload);
  }

  const frame = payload?.landscape?.frame;
  const elements = payload?.landscape?.elements;

  if (!frame || !Array.isArray(elements)) {
    throw new Error('Layout is missing landscape frame or elements');
  }

  const slots = elements
    .filter((element) => element && typeof element.key === 'string')
    .map((element, index) => [
      element.key,
      {
        x: finiteLayoutNumber(element.x, 0),
        y: finiteLayoutNumber(element.y, 0),
        width: Math.max(1, finiteLayoutNumber(element.width, 1)),
        height: Math.max(1, finiteLayoutNumber(element.height, 1)),
        zIndex: index + 1,
      },
    ]);

  return {
    variant: 'Shoot Stab Duck',
    width: Math.max(1, finiteLayoutNumber(frame.width, FRAME_WIDTH)),
    height: Math.max(1, finiteLayoutNumber(frame.height, FRAME_HEIGHT)),
    states: new Map([[DEFAULT_LAYOUT_STATE_ID, {
      width: Math.max(1, finiteLayoutNumber(frame.width, FRAME_WIDTH)),
      height: Math.max(1, finiteLayoutNumber(frame.height, FRAME_HEIGHT)),
      slots: new Map(slots),
    }]]),
  };
}

function normalizeStatefulGameLayout(payload) {
  const frame = payload.frame ?? payload.landscape?.frame ?? {};
  const width = Math.max(1, finiteLayoutNumber(frame.width, FRAME_WIDTH));
  const height = Math.max(1, finiteLayoutNumber(frame.height, FRAME_HEIGHT));
  const rawStates = payload.states;
  const normalizedStates = new Map();

  for (const [stateId, stateDefinition] of Object.entries(rawStates)) {
    if (!stateDefinition || typeof stateDefinition !== 'object') {
      continue;
    }

    normalizedStates.set(stateId, {
      id: stateId,
      extends: typeof stateDefinition.extends === 'string' ? stateDefinition.extends : null,
      width: Math.max(1, finiteLayoutNumber(stateDefinition.frame?.width, width)),
      height: Math.max(1, finiteLayoutNumber(stateDefinition.frame?.height, height)),
      slots: normalizeGameLayoutSlots(stateDefinition.elements),
    });
  }

  if (!normalizedStates.has(DEFAULT_LAYOUT_STATE_ID)) {
    normalizedStates.set(DEFAULT_LAYOUT_STATE_ID, {
      id: DEFAULT_LAYOUT_STATE_ID,
      extends: null,
      width,
      height,
      slots: new Map(),
    });
  }

  return {
    variant: String(payload.variant || 'Shoot Stab Duck'),
    width,
    height,
    states: resolveGameLayoutStates(normalizedStates),
  };
}

function normalizeGameLayoutSlots(elements) {
  if (!Array.isArray(elements)) {
    return new Map();
  }

  return new Map(elements
    .filter((element) => element && typeof element.key === 'string')
    .map((element, index) => [
      element.key,
      element.hidden
        ? { hidden: true, zIndex: index + 1 }
        : {
          x: finiteLayoutNumber(element.x, 0),
          y: finiteLayoutNumber(element.y, 0),
          width: Math.max(1, finiteLayoutNumber(element.width, 1)),
          height: Math.max(1, finiteLayoutNumber(element.height, 1)),
          zIndex: index + 1,
        },
    ]));
}

function resolveGameLayoutStates(states) {
  const resolved = new Map();

  for (const stateId of states.keys()) {
    resolved.set(stateId, resolveGameLayoutState(stateId, states, resolved, new Set()));
  }

  return resolved;
}

function resolveGameLayoutState(stateId, states, resolved, stack) {
  if (resolved.has(stateId)) {
    return resolved.get(stateId);
  }

  const stateDefinition = states.get(stateId) ?? states.get(DEFAULT_LAYOUT_STATE_ID);
  const slots = new Map();

  if (stateDefinition.extends && !stack.has(stateDefinition.extends)) {
    stack.add(stateId);
    const parent = resolveGameLayoutState(stateDefinition.extends, states, resolved, stack);
    parent.slots.forEach((slot, key) => slots.set(key, slot));
    stack.delete(stateId);
  }

  stateDefinition.slots.forEach((slot, key) => {
    if (slot.hidden) {
      slots.delete(key);
    } else {
      slots.set(key, slot);
    }
  });

  return {
    id: stateId,
    width: stateDefinition.width,
    height: stateDefinition.height,
    slots,
  };
}

function finiteLayoutNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function updateFrameScale() {
  const margin = 28;
  const availableWidth = window.innerWidth - margin;
  const availableHeight = window.innerHeight - margin;
  const frameWidth = gameLayout?.width ?? FRAME_WIDTH;
  const frameHeight = gameLayout?.height ?? FRAME_HEIGHT;
  const scale = Math.min(1, availableWidth / frameWidth, availableHeight / frameHeight);
  app.style.setProperty('--ui-scale', scale.toFixed(4));
}

function sanitizeDisplayName(value) {
  if (typeof value !== 'string') {
    return DEFAULT_RANKED_DISPLAY_NAME;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return DEFAULT_RANKED_DISPLAY_NAME;
  }

  return Array.from(normalized).slice(0, MAX_RANKED_DISPLAY_NAME_LENGTH).join('');
}

function generateDisplayName() {
  const prefix = pickRandom(NAME_PREFIXES);
  const main = pickRandom(NAME_MAINS);
  const suffix = pickRandom(NAME_SUFFIXES).replace('####', generateDigitString(4));
  const pattern = Math.floor(Math.random() * 4);
  const parts = [
    [prefix, main, suffix],
    [prefix, main],
    [main, suffix],
    [prefix, suffix],
  ][pattern];
  const spacedName = parts.join(' ').replace(' ,', ',');
  const separator = spacedName.includes(',') ? ' ' : pickRandom([' ', '_', '-']);
  const name = spacedName.replaceAll(' ', separator);

  if (Math.random() < 0.75) {
    return name;
  }

  return Math.random() < 0.5 ? `xXx_${name}_xXx` : `-${name}-`;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function generateDigitString(length) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

function readStoredDisplayName() {
  try {
    const savedName = sanitizeDisplayName(window.localStorage.getItem(RANKED_DISPLAY_NAME_KEY));
    return savedName === DEFAULT_RANKED_DISPLAY_NAME ? generateDisplayName() : savedName;
  } catch {
    return generateDisplayName();
  }
}

function writeStoredDisplayName(value) {
  try {
    window.localStorage.setItem(RANKED_DISPLAY_NAME_KEY, value);
  } catch {
    // Online play still works for this tab; it just cannot remember the name.
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') {
    return;
  }

  if (pauseMenu) {
    event.preventDefault();
    closePauseMenu();
    return;
  }

  if (!canOpenPauseMenu()) {
    return;
  }

  event.preventDefault();
  openPauseMenu();
}

function canOpenPauseMenu() {
  return screen === 'playing'
    && (playMode === 'local' || playMode === 'test')
    && !isTransitioning
    && !pauseMenu;
}

async function openPauseMenu() {
  if (!canOpenPauseMenu()) {
    return;
  }

  pauseGameplayTimers();
  isTransitioning = true;
  const curtain = await closeCurtainWipe(app, playCurtainCloseAudio);

  if (screen !== 'playing') {
    curtain.remove();
    isTransitioning = false;
    resumeGameplayTimers();
    return;
  }

  const overlay = renderPauseMenu();
  pauseMenu = { curtain, overlay };
}

async function closePauseMenu() {
  const menu = pauseMenu;

  if (!menu) {
    return;
  }

  pauseMenu = null;
  menu.overlay.remove();
  await openCurtainWipe(menu.curtain, playCurtainOpenAudio);
  isTransitioning = false;
  resumeGameplayTimers();
}

function renderPauseMenu() {
  const overlay = document.createElement('div');
  overlay.className = 'pause-menu-overlay';
  overlay.innerHTML = `
    <div class="pause-menu" role="dialog" aria-modal="true" aria-label="Pause menu">
      <button class="pause-menu-button" data-pause-action="resume" type="button">Resume</button>
      <button class="pause-menu-button danger" data-pause-action="quit" type="button">Quit</button>
    </div>
  `;
  app.append(overlay);
  overlay.querySelector('[data-pause-action="resume"]').addEventListener('click', closePauseMenu);
  overlay.querySelector('[data-pause-action="quit"]').addEventListener('click', quitFromPauseMenu);
  overlay.querySelector('[data-pause-action="resume"]').focus();
  return overlay;
}

async function quitFromPauseMenu() {
  const menu = pauseMenu;

  if (!menu) {
    return;
  }

  pauseMenu = null;
  menu.overlay.remove();
  quitToVariantMenu();
  render();
  app.append(menu.curtain);
  await openCurtainWipe(menu.curtain, playCurtainOpenAudio);
  isTransitioning = false;
  resumeGameplayTimers();
}

function quitToVariantMenu() {
  requestMusicTrack('title');
  unlockSceneAudio();
  loopToken += 1;
  clearLocalTurnChoice();
  clearPausableTimers();
  resetRoundWins();
  playMode = 'local';
  screen = 'opponent-select';
  turnPhase = 'idle';
  state = createRoundState();
  tutorialSlideIndex = 0;
  tutorialTipsSlideIndex = 0;
  tutorialStageMode = 'slide';
  tutorialFeedbackMarkup = '';
  tutorialPendingFeedbackMarkup = '';
  p1QueuedMove = null;
  rankedSnapshot = null;
  pendingSuperAnimation = null;
  stagePresentation = getIdleStagePresentation();
}

function setPausableTimeout(callback, duration) {
  const timer = {
    active: true,
    callback,
    remaining: Math.max(0, duration),
    startedAt: 0,
    timeoutId: null,
  };

  pausableTimers.add(timer);

  if (pauseStartedAt === null) {
    schedulePausableTimer(timer);
  }

  return timer;
}

function schedulePausableTimer(timer) {
  timer.startedAt = performance.now();
  timer.timeoutId = setTimeout(() => {
    if (!timer.active) {
      return;
    }

    timer.active = false;
    timer.timeoutId = null;
    pausableTimers.delete(timer);
    timer.callback();
  }, timer.remaining);
}

function clearPausableTimeout(timer) {
  if (!timer) {
    return;
  }

  timer.active = false;
  if (timer.timeoutId !== null) {
    clearTimeout(timer.timeoutId);
  }
  timer.timeoutId = null;
  pausableTimers.delete(timer);
}

function clearPausableTimers() {
  [...pausableTimers].forEach(clearPausableTimeout);
  pauseStartedAt = null;
}

function pausePausableTimers() {
  if (pauseStartedAt !== null) {
    return;
  }

  pauseStartedAt = performance.now();
  pausableTimers.forEach((timer) => {
    if (!timer.active || timer.timeoutId === null) {
      return;
    }

    clearTimeout(timer.timeoutId);
    timer.timeoutId = null;
    timer.remaining = Math.max(0, timer.remaining - (pauseStartedAt - timer.startedAt));
  });
}

function resumePausableTimers() {
  if (pauseStartedAt === null) {
    return;
  }

  pauseStartedAt = null;
  pausableTimers.forEach((timer) => {
    if (timer.active && !timer.timeoutId) {
      schedulePausableTimer(timer);
    }
  });
}

function render() {
  if (screen === 'title') {
    renderTitleScreen();
    return;
  }

  if (screen === 'opponent-select') {
    renderOpponentSelectScreen();
    return;
  }

  if (screen === 'online-name') {
    renderOnlineNameScreen();
    return;
  }

  if (screen === 'queue') {
    renderQueueScreen();
    return;
  }

  if (screen === 'tutorial') {
    renderTutorialScreen();
    return;
  }

  const legalMoves = new Set(getCurrentLegalMoves());

  if (playMode === 'online' && rankedSnapshot?.phase === 'banning') {
    renderRankedBanScreen();
    return;
  }

  if (gameLayout) {
    renderLayoutGameScreen(legalMoves);
    return;
  }

  app.innerHTML = `
    <section class="arena ${state.status}">
      ${renderStageHud()}
      ${renderPickHistories()}
      <figure class="doodle-stage">
        ${shouldClearStageForCountdown() ? '' : renderStagePresentation()}
      </figure>
      ${renderTestOpponentControls()}
      ${renderReadyWaitingOverlay()}
      ${renderBulletMeters()}
    </section>

    <section class="moves" aria-label="Moves">
      ${renderActionButtons(legalMoves)}
    </section>

    <section class="controls">
      <button class="ghost" data-action="reset">Reset</button>
    </section>
  `;

  installMoveButtonHandlers();

  app.querySelector('[data-action="continue"]')?.addEventListener('click', continueGame);
  app.querySelector('[data-action="rematch"]')?.addEventListener('click', restartGame);
  app.querySelector('[data-action="quit"]')?.addEventListener('click', quitLocalGame);
  app.querySelector('[data-action="reset"]').addEventListener('click', restartGame);
  app.querySelectorAll('[data-test-opponent-move]').forEach((button) => {
    button.addEventListener('click', () => submitTestOpponentMove(button.dataset.testOpponentMove));
  });
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
  app.querySelector('.ready-waiting-overlay')?.addEventListener('ready-waiting-split', handleReadyWaitingSplit);
  mountReadyWaitingOverlays(app.querySelectorAll('.ready-waiting-overlay'));
  mountWaitingDotsOverlays(app.querySelectorAll('.waiting-dots-overlay'));
  mountCountdownOverlays(app.querySelectorAll('.countdown-overlay'));
  playStageAudio({
    isTransitioning: isTransitioning || shouldSuppressStageAudio(),
    presentation: shouldClearStageForCountdown() ? { kind: 'cue', name: 'countdown' } : stagePresentation,
    audioKey: `${state.turn}:${turnPhase}:${stagePresentation.name}:${stagePresentation.flip}`,
  });
  maybeStartComputerTurnChoice();
}

function renderRankedBanScreen() {
  const bans = rankedSnapshot.bans ?? {};
  const bannedVariants = new Set(Object.values(bans));
  const playerBan = bans[rankedSnapshot.playerKey];
  const opponentBan = bans[rankedSnapshot.opponentKey];
  const variants = rankedSnapshot.variants ?? [];

  app.innerHTML = `
    <section class="title-screen online-name-screen variant-ban-screen" aria-label="Variant bans">
      <div class="title-panel online-name-card">
        <h1 class="online-name-title">Ban variant</h1>
        <p class="online-player-count">${opponentBan ? 'Opponent banned.' : 'Opponent choosing.'}</p>
        <div class="variant-ban-list">
          ${variants.map((variant) => `
            <button
              class="ghost variant-ban-button ${bannedVariants.has(variant.id) ? 'selected' : ''}"
              data-ban-variant="${variant.id}"
              type="button"
              ${playerBan || bannedVariants.has(variant.id) ? 'disabled' : ''}
            >
              ${escapeHtml(variant.label)}
            </button>
          `).join('')}
        </div>
        <div class="online-name-actions">
          <button class="ghost online-name-back" data-action="quit" type="button">Back</button>
        </div>
      </div>
    </section>
  `;

  app.querySelector('[data-action="quit"]')?.addEventListener('click', leaveRanked);
  app.querySelectorAll('[data-ban-variant]').forEach((button) => {
    button.addEventListener('click', () => submitRankedBan(button.dataset.banVariant));
  });
}

function renderLayoutGameScreen(legalMoves) {
  activeLayoutStateId = getLayoutStateId(legalMoves);
  const layout = getActiveGameLayout();

  app.innerHTML = `
    <section class="arena layout-arena ${state.status}">
      <div
        class="layout-stage"
        style="width: ${layout.width}px; height: ${layout.height}px;"
      >
        ${renderLayoutSlot('scene', shouldClearStageForCountdown() ? '' : renderStagePresentation(), 'scene-slot')}
        ${renderLayoutSlot('p1-info', renderPlayerIdentity('p1'), 'identity-slot')}
        ${renderLayoutSlot('p2-info', renderPlayerIdentity('p2'), 'identity-slot')}
        ${renderLayoutSlot('p1-win-label', renderStaticDoodle('wins_label', WINS_LABEL_FRAME_WIDTH, WINS_LABEL_FRAME_HEIGHT, 'wins-label'), 'hud-art-slot')}
        ${renderLayoutSlot('p2-win-label', renderStaticDoodle('wins_label', WINS_LABEL_FRAME_WIDTH, WINS_LABEL_FRAME_HEIGHT, 'wins-label'), 'hud-art-slot')}
        ${renderLayoutSlot('turn-counter', renderTurnCounter(), 'hud-art-slot')}
        ${renderLayoutSlot('p1-win-counter', renderWinCounter('p1'), 'hud-art-slot')}
        ${renderLayoutSlot('p2-win-counter', renderWinCounter('p2'), 'hud-art-slot')}
        ${renderLayoutBulletSlots('p1')}
        ${renderLayoutBulletSlots('p2')}
        ${renderLayoutPickHistorySlots('p1')}
        ${renderLayoutPickHistorySlots('p2')}
        ${renderLayoutMoveControls(legalMoves)}
        ${renderTestOpponentControls()}
        ${renderReadyWaitingOverlay()}
        <section class="controls layout-controls">
          <button class="ghost" data-action="reset">Reset</button>
        </section>
      </div>
    </section>
  `;

  installMoveButtonHandlers();
  installLayoutActionHandlers();
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
  app.querySelector('.ready-waiting-overlay')?.addEventListener('ready-waiting-split', handleReadyWaitingSplit);
  mountReadyWaitingOverlays(app.querySelectorAll('.ready-waiting-overlay'));
  mountWaitingDotsOverlays(app.querySelectorAll('.waiting-dots-overlay'));
  mountCountdownOverlays(app.querySelectorAll('.countdown-overlay'));
  playStageAudio({
    isTransitioning: isTransitioning || shouldSuppressStageAudio(),
    presentation: shouldClearStageForCountdown() ? { kind: 'cue', name: 'countdown' } : stagePresentation,
    audioKey: `${state.turn}:${turnPhase}:${stagePresentation.name}:${stagePresentation.flip}`,
  });
  maybeStartComputerTurnChoice();
}

function installLayoutActionHandlers() {
  app.querySelector('[data-action="continue"]')?.addEventListener('click', continueGame);
  app.querySelector('[data-action="rematch"]')?.addEventListener('click', restartGame);
  app.querySelector('[data-action="quit"]')?.addEventListener('click', quitLocalGame);
  app.querySelector('[data-action="reset"]')?.addEventListener('click', restartGame);
  app.querySelectorAll('[data-test-opponent-move]').forEach((button) => {
    button.addEventListener('click', () => submitTestOpponentMove(button.dataset.testOpponentMove));
  });
}

function renderLayoutSlot(key, markup, extraClass = '') {
  const slot = getActiveGameLayout()?.slots.get(key);

  if (!slot || !markup) {
    return '';
  }

  return `
    <div
      class="layout-slot ${extraClass}"
      data-layout-key="${key}"
      style="left: ${slot.x}px; top: ${slot.y}px; width: ${slot.width}px; height: ${slot.height}px; z-index: ${slot.zIndex};"
    >
      ${markup}
    </div>
  `;
}

function renderStaticDoodle(doodle, width, height, className = '') {
  return `
    <canvas
      class="sprite-canvas ${className}"
      data-doodle="${doodle}"
      data-frame-width="${width}"
      data-frame-height="${height}"
      width="${width}"
      height="${height}"
      aria-hidden="true"
    ></canvas>
  `;
}

function renderTurnCounter() {
  return `
    <canvas
      class="sprite-canvas turn-counter"
      data-doodle="${getTurnDoodle(state.turn)}"
      data-frame-width="${TURN_FRAME_WIDTH}"
      data-frame-height="${TURN_FRAME_HEIGHT}"
      width="${TURN_FRAME_WIDTH}"
      height="${TURN_FRAME_HEIGHT}"
      aria-label="Turn ${state.turn}"
    ></canvas>
  `;
}

function renderWinCounter(playerId) {
  if (roundWins[playerId] <= 0) {
    return '';
  }

  return renderStaticDoodle(`w${Math.min(roundWins[playerId], GAME_TARGET_ROUNDS)}`, WIN_MARK_FRAME_WIDTH, WIN_MARK_FRAME_HEIGHT, 'win-mark');
}

function renderLayoutBulletSlots(playerId) {
  if (getVariantResourceMax(getCurrentVariantId()) <= 0) {
    return '';
  }

  const resource = getResourcePresentation(getCurrentVariantId());
  const label = resource.showLabel
    ? renderLayoutSlot(
      `${playerId}-${resource.labelSlotSuffix}`,
      renderStaticDoodle(resource.labelDoodle, BULLETS_LABEL_FRAME_WIDTH, BULLETS_LABEL_FRAME_HEIGHT, 'bullets-label'),
      'hud-art-slot',
    )
    : '';

  return `
    ${label}
    ${Array.from({ length: BULLET_SLOT_COUNT }, (_, index) => {
      const slot = playerId === 'p2' ? BULLET_SLOT_COUNT - index : index + 1;
      return renderLayoutSlot(
        `${playerId}-${resource.iconSlotPrefix}-slot-${index + 1}`,
        slot <= getPlayerResource(state.players[playerId])
          ? renderStaticDoodle(resource.iconDoodle, BULLETS_ICON_FRAME_WIDTH, BULLETS_ICON_FRAME_HEIGHT, 'bullets-icon')
          : '<span class="empty-bullet-slot" aria-hidden="true"></span>',
        'bullet-slot',
      );
    }).join('')}
  `;
}

function renderLayoutPickHistorySlots(playerId) {
  if (!shouldShowPickHistory()) {
    return '';
  }

  const isPlayer = playerId === 'p1';
  const label = isPlayer ? 'you_picked' : 'they_picked';
  const labelWidth = isPlayer ? PICK_LABEL_FRAME_WIDTH : THEY_PICKED_LABEL_FRAME_WIDTH;
  const move = lastMoves[playerId];

  return `
    ${renderLayoutSlot(`${playerId}-${isPlayer ? 'you-picked' : 'they-picked'}`, renderStaticDoodle(label, labelWidth, PICK_LABEL_FRAME_HEIGHT, 'pick-label'), 'hud-art-slot')}
    ${renderLayoutSlot(`${playerId}-previous-move-icon`, renderStaticDoodle(MOVE_ICON_DOODLES[move], MOVE_ICON_FRAME_WIDTH, MOVE_ICON_FRAME_HEIGHT, 'move-icon'), 'hud-art-slot')}
  `;
}

function renderLayoutMoveControls(legalMoves) {
  return `
    <div class="layout-moves moves" aria-label="Moves">
      ${renderLayoutMoveArrows()}
      ${renderLayoutActionButtons(legalMoves)}
    </div>
  `;
}

function renderLayoutMoveArrows() {
  if (turnPhase === 'round-over') {
    return '';
  }

  return `
    ${renderLayoutSlot('right-red-arrow', renderStaticDoodle('right_red', 128, 128, 'move-arrow'), 'move-arrow-slot')}
    ${renderLayoutSlot('down-right-red-arrow', renderStaticDoodle('down-right_red', 128, 128, 'move-arrow'), 'move-arrow-slot')}
    ${renderLayoutSlot('up-right-red-arrow', renderStaticDoodle('up-right_red', 128, 128, 'move-arrow'), 'move-arrow-slot')}
    ${renderLayoutSlot('left-red-arrow', renderStaticDoodle('left_red', 128, 128, 'move-arrow'), 'move-arrow-slot')}
    ${renderLayoutSlot('down-right-blue-arrow', renderStaticDoodle('down-right_blue', 128, 128, 'move-arrow'), 'move-arrow-slot')}
    ${renderLayoutSlot('left-blue-arrow', renderStaticDoodle('left_blue', 128, 128, 'move-arrow'), 'move-arrow-slot')}
    ${renderLayoutSlot('stab-to-duck-arrow', renderStaticDoodle('stab-to-duck_arrow', 128, 128, 'move-arrow'), 'move-arrow-slot')}
    ${renderLayoutSlot('reload-to-stab-arrow', renderStaticDoodle('reload-to-stab_arrow', 128, 128, 'move-arrow'), 'move-arrow-slot')}
    ${renderLayoutSlot('duck-to-shoot-arrow', renderStaticDoodle('duck-to-shoot_arrow', 128, 128, 'move-arrow'), 'move-arrow-slot')}
    ${renderLayoutSlot('shoot-to-stab-arrow', renderStaticDoodle('shoot-to-stab_arrow', 128, 128, 'move-arrow'), 'move-arrow-slot')}
  `;
}

function renderLayoutActionButtons(legalMoves) {
  if (turnPhase === 'round-over') {
    return renderLayoutRoundActions();
  }

  const slottedButtons = getActiveMoveIds()
    .map((moveId) => renderLayoutSlot(`${moveId}-button`, renderMoveButton(MOVES[moveId], legalMoves.has(moveId)), 'move-button-slot'))
    .join('');

  return slottedButtons || getActiveMoveIds()
    .map((moveId) => renderMoveButton(MOVES[moveId], legalMoves.has(moveId)))
    .join('');
}

function renderLayoutRoundActions() {
  let actions;

  if (playMode === 'online') {
    if (rankedSnapshot?.noContest && !rankedSnapshot.winner) {
      actions = [{ slot: 'quit-button', markup: renderSheetButton('quit', 'quit_button', 'Back to menu', 'quit-button') }];
    } else if (rankedSnapshot?.phase === 'roundOver') {
      actions = [{ slot: 'continue-button', markup: renderContinueButton() }];
    } else {
      actions = [
        { slot: 'continue-button', markup: renderSheetButton('rematch', 'continue_button', 'Continue', 'continue-button') },
        { slot: 'quit-button', markup: renderSheetButton('quit', 'quit_button', 'Quit', 'quit-button') },
      ];
    }
  } else {
    actions = isGameOver()
      ? [
        { slot: 'continue-button', markup: renderSheetButton('rematch', 'continue_button', 'Continue', 'continue-button') },
        { slot: 'quit-button', markup: renderSheetButton('quit', 'quit_button', 'Quit', 'quit-button') },
      ]
      : [{ slot: 'continue-button', markup: renderContinueButton() }];
  }

  return actions.map(({ slot, markup }) => renderLayoutSlot(slot, markup, 'move-button-slot')).join('');
}

function getActiveGameLayout() {
  return gameLayout?.states.get(activeLayoutStateId)
    ?? gameLayout?.states.get(DEFAULT_LAYOUT_STATE_ID)
    ?? {
      width: gameLayout?.width ?? FRAME_WIDTH,
      height: gameLayout?.height ?? FRAME_HEIGHT,
      slots: new Map(),
    };
}

function getLayoutStateId(legalMoves) {
  if (turnPhase === 'round-over') {
    return isGameOver() || rankedSnapshot?.phase === 'gameOver'
      ? GAME_OVER_LAYOUT_STATE_ID
      : BETWEEN_ROUND_LAYOUT_STATE_ID;
  }

  if (isDisadvantagedLayoutState(legalMoves)) {
    return DISADVANTAGED_LAYOUT_STATE_ID;
  }

  return DEFAULT_LAYOUT_STATE_ID;
}

function isDisadvantagedLayoutState(legalMoves) {
  return state.status === 'playing'
    && getCurrentVariantId() !== VARIANT_IDS.chargeBlockFireball
    && getPlayerResource(state.players.p1) === 0
    && getPlayerResource(state.players.p2) > 0
    && !legalMoves.has('shoot');
}

function shouldSuppressStageAudio() {
  return playMode === 'online'
    && rankedSnapshot?.phase === 'choosing';
}

function renderPickHistories() {
  if (!shouldShowPickHistory()) {
    return '';
  }

  return `
    ${renderPickHistory('p1')}
    ${renderPickHistory('p2')}
  `;
}

function shouldShowPickHistory() {
  return state.history.length > 0
    && shouldShowPickHistoryForVariant(getCurrentVariantId());
}

function renderPickHistory(playerId) {
  const isPlayer = playerId === 'p1';
  const label = isPlayer ? 'you_picked' : 'they_picked';
  const labelWidth = isPlayer ? PICK_LABEL_FRAME_WIDTH : THEY_PICKED_LABEL_FRAME_WIDTH;
  const move = lastMoves[playerId];

  return `
    <aside class="pick-history ${playerId}" aria-label="${isPlayer ? 'You picked' : 'They picked'} ${move}">
      <canvas
        class="sprite-canvas pick-label"
        data-doodle="${label}"
        data-frame-width="${labelWidth}"
        data-frame-height="${PICK_LABEL_FRAME_HEIGHT}"
        width="${labelWidth}"
        height="${PICK_LABEL_FRAME_HEIGHT}"
        aria-hidden="true"
      ></canvas>
      <canvas
        class="sprite-canvas move-icon"
        data-doodle="${MOVE_ICON_DOODLES[move]}"
        data-frame-width="${MOVE_ICON_FRAME_WIDTH}"
        data-frame-height="${MOVE_ICON_FRAME_HEIGHT}"
        width="${MOVE_ICON_FRAME_WIDTH}"
        height="${MOVE_ICON_FRAME_HEIGHT}"
        aria-hidden="true"
      ></canvas>
    </aside>
  `;
}

function renderStagePresentation() {
  if (stagePresentation.kind === 'cue') {
    return `
      <canvas
        class="sprite-canvas cue-canvas"
        data-doodle="${stagePresentation.name}"
        width="${DOODLE_FRAME_WIDTH}"
        height="${DOODLE_FRAME_HEIGHT}"
        aria-label="${stagePresentation.name}"
      ></canvas>
    `;
  }

  return `
    <canvas
      class="sprite-canvas doodle-canvas"
      data-doodle="${stagePresentation.name}"
      data-flip="${stagePresentation.flip}"
      width="${DOODLE_FRAME_WIDTH}"
      height="${DOODLE_FRAME_HEIGHT}"
      aria-label="${stagePresentation.name}"
    ></canvas>
  `;
}

function renderReadyWaitingOverlay() {
  const readyWaiting = getActiveReadyWaiting();

  if (!readyWaiting) {
    return '';
  }

  if (readyWaiting.isNoContest) {
    return readyWaiting.phase === 'countdown'
      ? ['p1', 'p2'].map((playerId) => `
        <canvas
          class="countdown-overlay ${playerId}"
          width="300"
          height="256"
          aria-hidden="true"
        ></canvas>
      `).join('')
      : ['p1', 'p2'].map((playerId) => `
        <canvas
          class="waiting-dots-overlay ${playerId}"
          data-immediate="true"
          width="135"
          height="55"
          aria-hidden="true"
        ></canvas>
      `).join('');
  }

  const waitingSceneClass = getReadyWaitingSceneClass();
  const waitingRoleClass = getReadyWaitingRoleClass(readyWaiting.waitingPlayerId);

  return `
    <canvas
      class="ready-waiting-overlay ${readyWaiting.readyPlayerId}"
      data-ready-phase="${readyWaiting.phase}"
      width="300"
      height="256"
      aria-hidden="true"
    ></canvas>
    ${readyWaiting.phase === 'countdown'
      ? `
        <canvas
          class="countdown-overlay ${readyWaiting.waitingPlayerId}"
          width="300"
          height="256"
          aria-hidden="true"
        ></canvas>
      `
      : `
        <canvas
          class="waiting-dots-overlay ${readyWaiting.waitingPlayerId} ${waitingSceneClass} ${waitingRoleClass}"
          width="135"
          height="55"
          aria-hidden="true"
        ></canvas>
      `}
  `;
}

function getReadyWaitingSceneClass() {
  if (stagePresentation.kind !== 'doodle') {
    return '';
  }

  const scene = getReadyWaitingSceneName(stagePresentation.name);
  return scene ? `scene-${scene}` : '';
}

function getReadyWaitingSceneName(doodleName) {
  const splitPrefix = 'split_scenes/';
  const splitIndex = doodleName.indexOf(splitPrefix);
  const localName = splitIndex === -1
    ? doodleName.split('/').pop()
    : doodleName.slice(splitIndex + splitPrefix.length);

  if (!localName) {
    return '';
  }

  return localName
    .replace(/_is_ready$/, '')
    .replace(/_p[12]$/, '')
    .replace(/_(reloader|ducker|stabber|blocker|charger|fireballer|puncher|shooter|counterstabber)$/, '')
    .replace(/-p[12].*$/, '')
    .replace(/-p[12]_ready$/, '')
    .replace(/_standoff$/, '-standoff')
    .split('-')[0];
}

function getReadyWaitingRoleClass(playerId) {
  const scene = getReadyWaitingSceneClass();

  if (scene === 'scene-dodge') {
    return lastMoves[playerId] === 'shoot' ? 'role-shooter' : 'role-dodger';
  }

  if (scene === 'scene-counterstab') {
    return lastMoves[playerId] === 'reload' ? 'role-counterer' : 'role-stabber';
  }

  return '';
}

function getActiveReadyWaiting() {
  if (
    screen !== 'playing' ||
    isTransitioning ||
    (state.status !== 'playing' && rankedSnapshot?.phase !== 'roundOver')
  ) {
    return null;
  }

  if (
    isLocalChoiceMode()
    && turnPhase === 'scene'
    && localTurnChoice?.readyPlayerId
    && (localTurnChoice.phase === 'safe' || localTurnChoice.phase === 'countdown')
  ) {
    return {
      phase: localTurnChoice.phase,
      readyPlayerId: localTurnChoice.readyPlayerId,
      waitingPlayerId: localTurnChoice.waitingPlayerId,
    };
  }

  return rankedReadyWaiting;
}

function getRankedReadyWaitingFromSnapshot(snapshot) {
  if (
    playMode === 'online' &&
    snapshot?.phase === 'choosing' &&
    !snapshot.readyPlayerKey &&
    !snapshot.waitingPlayerKey &&
    snapshot.noContestWaitingAt &&
    snapshot.noContestCountdownAt
  ) {
    const now = Date.now();

    if (now < snapshot.noContestWaitingAt) {
      return null;
    }

    return {
      isNoContest: true,
      phase: now >= snapshot.noContestCountdownAt ? 'countdown' : 'safe',
      readyPlayerId: null,
      waitingPlayerId: null,
    };
  }

  if (
    playMode !== 'online' ||
    !['choosing', 'roundOver'].includes(snapshot?.phase) ||
    !snapshot.readyPlayerKey ||
    !snapshot.waitingPlayerKey
  ) {
    return null;
  }

  const remainingMs = Math.max(0, snapshot.deadlineAt - Date.now());

  return {
    phase: remainingMs <= COUNTDOWN_PHASE_MS ? 'countdown' : 'safe',
    readyPlayerId: getLocalPlayerIdFromRankedKey(snapshot, snapshot.readyPlayerKey),
    waitingPlayerId: getLocalPlayerIdFromRankedKey(snapshot, snapshot.waitingPlayerKey),
  };
}

function getLocalPlayerIdFromRankedKey(snapshot, playerKey) {
  return playerKey === snapshot?.playerKey ? 'p1' : 'p2';
}

function shouldClearStageForCountdown() {
  const readyWaiting = getActiveReadyWaiting();

  return readyWaiting?.phase === 'countdown'
    || (playMode === 'online' && rankedSnapshot?.phase === 'roundOver' && Boolean(readyWaiting));
}

function renderTitleScreen() {
  stopFindingMatchTicker();
  stopOnlineStatusPolling();
  requestMusicTrack('title');

  app.innerHTML = `
    <section class="title-screen" aria-label="Title screen">
      <canvas
        class="sprite-canvas title-logo"
        data-doodle="title/LOGO"
        data-frame-width="${TITLE_LOGO_FRAME_WIDTH}"
        data-frame-height="${TITLE_LOGO_FRAME_HEIGHT}"
        width="${TITLE_LOGO_FRAME_WIDTH}"
        height="${TITLE_LOGO_FRAME_HEIGHT}"
        aria-label="Super Rock Paper Scissors Online"
      ></canvas>

      <div class="title-actions">
        <button class="play-button" data-action="play" aria-label="Play computer">
          <canvas
            class="sprite-canvas play-button-art"
            data-doodle="title/playvcom_button"
            data-frame-width="${TITLE_BUTTON_FRAME_WIDTH}"
            data-frame-height="${TITLE_BUTTON_FRAME_HEIGHT}"
            width="${TITLE_BUTTON_FRAME_WIDTH}"
            height="${TITLE_BUTTON_FRAME_HEIGHT}"
            aria-hidden="true"
          ></canvas>
        </button>

        <button class="play-button online-button" data-action="ranked" aria-label="Play online">
          <canvas
            class="sprite-canvas play-button-art"
            data-doodle="title/playonline"
            data-frame-width="${TITLE_BUTTON_FRAME_WIDTH}"
            data-frame-height="${TITLE_BUTTON_FRAME_HEIGHT}"
            width="${TITLE_BUTTON_FRAME_WIDTH}"
            height="${TITLE_BUTTON_FRAME_HEIGHT}"
            aria-hidden="true"
          ></canvas>
        </button>
      </div>

      <div class="title-audio-actions" aria-label="Audio">
        ${renderTitleAudioButton('music', isMusicEnabled)}
        ${renderTitleAudioButton('sound', isSoundEnabled)}
      </div>
    </section>
  `;

  app.querySelector('[data-action="play"]').addEventListener('click', startGameFromTitle);
  app.querySelector('[data-action="ranked"]').addEventListener('click', startRankedFromTitle);
  app.querySelector('[data-action="toggle-music"]').addEventListener('click', toggleMusic);
  app.querySelector('[data-action="toggle-sound"]').addEventListener('click', toggleSound);
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
}

function renderTitleAudioButton(kind, isChecked) {
  const doodle = `title/${kind}_button${isChecked ? '_checked' : ''}`;
  const label = `${kind} ${isChecked ? 'on' : 'off'}`;

  return `
    <button
      class="title-audio-button"
      data-action="toggle-${kind}"
      type="button"
      aria-label="${label}"
      aria-pressed="${isChecked ? 'true' : 'false'}"
    >
      <canvas
        class="sprite-canvas title-audio-button-art"
        data-doodle="${doodle}"
        data-frame-width="${TITLE_AUDIO_BUTTON_FRAME_WIDTH}"
        data-frame-height="${TITLE_AUDIO_BUTTON_FRAME_HEIGHT}"
        width="${TITLE_AUDIO_BUTTON_FRAME_WIDTH}"
        height="${TITLE_AUDIO_BUTTON_FRAME_HEIGHT}"
        aria-hidden="true"
      ></canvas>
    </button>
  `;
}

function toggleMusic() {
  const trackId = screen === 'title' ? 'title' : 'game';

  isMusicEnabled = !isMusicEnabled;
  setMusicEnabled(isMusicEnabled, trackId);
  playAudioToggleSound();
  render();
}

function toggleSound() {
  isSoundEnabled = !isSoundEnabled;
  setSoundEnabled(isSoundEnabled);
  playAudioToggleSound();
  render();
}

function playAudioToggleSound() {
  if (!isSoundEnabled) {
    return;
  }

  playUserGestureAudio(READY_AUDIO);
  unlockSceneAudio();
}

function renderOnlineNameScreen() {
  stopFindingMatchTicker();
  requestMusicTrack('title');

  app.innerHTML = `
    <section class="title-screen online-name-screen" aria-label="Online name">
      <canvas
        class="sprite-canvas title-logo"
        data-doodle="title/LOGO"
        data-frame-width="${TITLE_LOGO_FRAME_WIDTH}"
        data-frame-height="${TITLE_LOGO_FRAME_HEIGHT}"
        width="${TITLE_LOGO_FRAME_WIDTH}"
        height="${TITLE_LOGO_FRAME_HEIGHT}"
        aria-label="Super Rock Paper Scissors Online"
      ></canvas>

      <form class="online-name-form">
        <label class="online-name-label" for="online-name-input">Name</label>
        <input
          id="online-name-input"
          class="online-name-input"
          name="displayName"
          maxlength="${MAX_RANKED_DISPLAY_NAME_LENGTH}"
          autocomplete="nickname"
          spellcheck="false"
          value="${escapeHtml(rankedDisplayName)}"
        />
        <p class="online-player-count" aria-live="polite">${renderOnlinePlayerCount()}</p>
        <button class="ghost online-name-random" data-action="random-name" type="button">Random</button>
        <div class="online-name-actions">
          <button class="ghost online-name-back" data-action="back-title" type="button">Back</button>
          <button class="ghost online-name-submit" type="submit">Find match</button>
        </div>
      </form>
    </section>
  `;

  app.querySelector('.online-name-form').addEventListener('submit', submitOnlineName);
  app.querySelector('[data-action="back-title"]').addEventListener('click', returnToTitleFromOnlineName);
  app.querySelector('[data-action="random-name"]').addEventListener('click', generateOnlineName);
  startOnlineStatusPolling();
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
  app.querySelector('.online-name-input')?.focus();
}

function renderTutorialScreen() {
  stopFindingMatchTicker();
  requestMusicTrack('game');

  app.innerHTML = `
    <section class="arena tutorial-arena">
      ${renderStageHud()}
      ${renderPickHistories()}
      ${renderTutorialNav()}
      <figure class="doodle-stage tutorial-stage">
        ${renderTutorialStage()}
      </figure>
      ${renderBulletMeters()}
    </section>

    <section class="moves tutorial-moves" aria-label="Tutorial controls">
      ${renderTutorialButtons()}
    </section>
  `;

  installMoveButtonHandlers();
  app.querySelector('[data-action="back-tutorial"]')?.addEventListener('click', goBackTutorial);
  app.querySelector('[data-action="next-tutorial"]')?.addEventListener('click', advanceTutorialSlide);
  app.querySelector('[data-action="tips-tutorial"]')?.addEventListener('click', openTutorialTips);
  app.querySelector('[data-action="rematch"]')?.addEventListener('click', restartTutorialPractice);
  app.querySelector('[data-action="quit"]')?.addEventListener('click', quitLocalGame);
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
  playStageAudio({
    isTransitioning: isTransitioning || tutorialStageMode !== 'scene',
    presentation: stagePresentation,
    audioKey: `tutorial:${state.turn}:${turnPhase}:${stagePresentation.name}:${stagePresentation.flip}`,
  });
}

function renderTutorialStage() {
  if (tutorialStageMode === 'scene') {
    return renderStagePresentation();
  }

  if (tutorialStageMode === 'feedback') {
    return renderTutorialFeedback();
  }

  if (tutorialStageMode === 'tips') {
    return renderTutorialTipsSlide();
  }

  return renderTutorialSlide();
}

function renderTutorialNav() {
  if (turnPhase === 'round-over' && isGameOver()) {
    return '';
  }

  if (tutorialStageMode === 'scene' || tutorialStageMode === 'feedback') {
    return `
      <nav class="tutorial-nav tutorial-nav-practice" aria-label="Tutorial navigation">
        ${renderSheetButton('tips-tutorial', 'tips_button', 'Tips', 'tutorial-nav-button tutorial-next-button')}
      </nav>
    `;
  }

  if (tutorialStageMode === 'tips') {
    return `
      <nav class="tutorial-nav" aria-label="Tutorial navigation">
        ${renderSheetButton('back-tutorial', 'Prev_slide_button', 'Back', 'tutorial-nav-button tutorial-back-button')}
        ${tutorialTipsSlideIndex === TUTORIAL_TIPS_SLIDE_COUNT - 1
          ? renderSheetButton('quit', 'quit_button', 'Return to menu', 'tutorial-nav-button tutorial-next-button')
          : renderSheetButton('next-tutorial', 'next_slide_button', 'Next', 'tutorial-nav-button tutorial-next-button')}
      </nav>
    `;
  }

  return `
    <nav class="tutorial-nav" aria-label="Tutorial navigation">
      ${renderSheetButton('back-tutorial', 'Prev_slide_button', 'Back', 'tutorial-nav-button tutorial-back-button')}
      ${tutorialSlideIndex === TUTORIAL_REVEAL_SLIDE_INDEX
        ? ''
        : renderSheetButton('next-tutorial', 'next_slide_button', 'Next', 'tutorial-nav-button tutorial-next-button')}
    </nav>
  `;
}

function renderTutorialSlide() {
  const slideNumber = tutorialSlideIndex + 1;
  const slides = [
    `
      <p><strong>Tap Tap Shoot!</strong></p>
      <p>is a guessing game like</p>
      <p><strong>Rock Paper Scissors.</strong></p>
    `,
    `
      <p><strong>But more violent.</strong></p>
      <p>The goal is to</p>
      <p><strong>Shoot</strong> or <strong>Stab</strong></p>
      <p>your opponent.</p>
    `,
    `
      <p>You need an</p>
      <p><strong>Bullet</strong></p>
      <p>to attack.</p>
      <p>Each player starts with one.</p>
      <p>Defensive moves are free.</p>
    `,
    `
      <p><strong>Reloading</strong></p>
      <p>stocks a Bullet,</p>
      <p>but leaves you open.</p>
    `,
    `
      <p>Games are</p>
      <p><strong>First to Five.</strong></p>
    `,
    `
      <p>Hover over the buttons</p>
      <p>to see what beats what.</p>
      <p>Choose one and</p>
      <p>see what happens!</p>
    `,
  ];

  return `
    <div class="tutorial-slide tutorial-slide-${slideNumber}" aria-label="Tutorial ${slideNumber}">
      ${slides[tutorialSlideIndex]}
    </div>
  `;
}

function renderTutorialFeedback() {
  return `
    <div class="tutorial-slide tutorial-feedback" aria-label="Tutorial result">
      ${tutorialFeedbackMarkup}
    </div>
  `;
}

function renderTutorialTipsSlide() {
  const slideNumber = tutorialTipsSlideIndex + 1;
  const slides = [
    `
      ${renderTutorialTipArt('tip1graphic')}
      <div class="tutorial-side-copy">
        <p><strong>Tips</strong></p>
        <p>The game is all about</p>
        <p>relative Bullets.</p>
        <p>When each player has</p>
        <p>one, the game is like</p>
        <p>Rock Paper Scissors.</p>
      </div>
    `,
    `
      ${renderTutorialTipArt('tip2graphicgraphic')}
      <div class="tutorial-side-copy">
        <p><strong>Tips</strong></p>
        <p>But when a player has an</p>
        <p>Bullet advantage,</p>
        <p>they can enforce a mixup.</p>
      </div>
    `,
    `
      <p>Everyone has patterns.</p>
      <p>Try to read your opponent!</p>
      <p>And thanks for playing!!</p>
      <p><strong>-JP</strong></p>
    `,
  ];

  return `
    <div class="tutorial-slide tutorial-tips-slide tutorial-tips-slide-${slideNumber}" aria-label="Tutorial tips ${slideNumber}">
      ${slides[tutorialTipsSlideIndex]}
    </div>
  `;
}

function renderTutorialTipArt(doodle) {
  return `
    <canvas
      class="sprite-canvas tutorial-tip-graphic"
      data-doodle="${doodle}"
      width="${DOODLE_FRAME_WIDTH}"
      height="${DOODLE_FRAME_HEIGHT}"
      aria-hidden="true"
    ></canvas>
  `;
}

function renderTutorialButtons() {
  if (turnPhase === 'round-over' && isGameOver()) {
    return renderGameOverButtons();
  }

  if (shouldShowTutorialMoveButtons()) {
    const moves = Object.values(MOVES);

    return moves.map((move) => renderTutorialMoveButton(move)).join('');
  }

  return '';
}

function shouldShowTutorialMoveButtons() {
  return (tutorialStageMode === 'slide' && tutorialSlideIndex === TUTORIAL_REVEAL_SLIDE_INDEX)
    || tutorialStageMode === 'scene'
    || tutorialStageMode === 'feedback'
    || tutorialStageMode === 'tips';
}

function renderOpponentSelectScreen() {
  stopFindingMatchTicker();
  requestMusicTrack('title');

  app.innerHTML = `
    <section class="title-screen opponent-select-screen" aria-label="Choose variant">
      ${renderOpenCurtainBorder()}

      <canvas
        class="sprite-canvas pick-variant-header"
        data-doodle-file="pick_variant_sheet.webp"
        data-frame-width="${PICK_VARIANT_FRAME_WIDTH}"
        data-frame-height="${PICK_VARIANT_FRAME_HEIGHT}"
        width="${PICK_VARIANT_FRAME_WIDTH}"
        height="${PICK_VARIANT_FRAME_HEIGHT}"
        aria-label="Pick variant"
      ></canvas>

      <div class="variant-actions">
        ${COMPUTER_VARIANTS.map((variant) => renderVariantButton(variant)).join('')}
        ${renderBackButton()}
      </div>
    </section>
  `;

  app.querySelectorAll('[data-variant]').forEach((button) => {
    button.addEventListener('click', () => startLocalGame(button.dataset.variant));
  });
  app.querySelector('[data-action="back-title"]').addEventListener('click', returnToTitleFromOpponentSelect);
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
}

function renderOpenCurtainBorder() {
  return `
    <canvas
      class="sprite-canvas curtain-border"
      data-doodle="curtains/curtains-open"
      data-frame-width="${FRAME_WIDTH}"
      data-frame-height="${FRAME_HEIGHT}"
      width="${FRAME_WIDTH}"
      height="${FRAME_HEIGHT}"
      aria-hidden="true"
    ></canvas>
  `;
}

function renderBackButton() {
  return `
    <button class="opponent-button back-button" data-action="back-title" aria-label="Back">
      <canvas
        class="sprite-canvas opponent-button-art"
        data-doodle="back_button"
        data-frame-width="${TITLE_BUTTON_FRAME_WIDTH}"
        data-frame-height="${TITLE_BUTTON_FRAME_HEIGHT}"
        width="${TITLE_BUTTON_FRAME_WIDTH}"
        height="${TITLE_BUTTON_FRAME_HEIGHT}"
        aria-hidden="true"
      ></canvas>
    </button>
  `;
}

function renderVariantButton(variant) {
  return `
    <button class="variant-button" data-variant="${variant.id}" aria-label="${variant.name}">
      <canvas
        class="sprite-canvas variant-button-art"
        data-doodle="${variant.buttonDoodle}"
        data-frame-width="${VARIANT_BUTTON_FRAME_WIDTH}"
        data-frame-height="${VARIANT_BUTTON_FRAME_HEIGHT}"
        width="${VARIANT_BUTTON_FRAME_WIDTH}"
        height="${VARIANT_BUTTON_FRAME_HEIGHT}"
        aria-hidden="true"
      ></canvas>
    </button>
  `;
}

function renderQueueScreen() {
  startFindingMatchTicker();
  requestMusicTrack('title');

  app.innerHTML = `
    <section class="title-screen queue-screen" aria-label="Ranked queue">
      <canvas
        class="sprite-canvas title-logo"
        data-doodle="title/LOGO"
        data-frame-width="${TITLE_LOGO_FRAME_WIDTH}"
        data-frame-height="${TITLE_LOGO_FRAME_HEIGHT}"
        width="${TITLE_LOGO_FRAME_WIDTH}"
        height="${TITLE_LOGO_FRAME_HEIGHT}"
        aria-label="Super Rock Paper Scissors Online"
      ></canvas>
      <canvas
        class="sprite-canvas finding-match-art"
        data-doodle="${FINDING_MATCH_DOODLES[findingMatchStep]}"
        data-frame-width="${TITLE_BUTTON_FRAME_WIDTH}"
        data-frame-height="${TITLE_BUTTON_FRAME_HEIGHT}"
        width="${TITLE_BUTTON_FRAME_WIDTH}"
        height="${TITLE_BUTTON_FRAME_HEIGHT}"
        aria-label="Finding match"
      ></canvas>
      <button class="ghost" data-action="cancel-queue">Cancel</button>
    </section>
  `;

  app.querySelector('[data-action="cancel-queue"]').addEventListener('click', leaveRanked);
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
}

function renderStageHud() {
  return `
    <div class="stage-hud" aria-label="Game status">
      ${renderPlayerIdentity('p1')}
      ${renderWinMeter('p1')}
      <canvas
        class="sprite-canvas turn-counter"
        data-doodle="${getTurnDoodle(state.turn)}"
        data-frame-width="${TURN_FRAME_WIDTH}"
        data-frame-height="${TURN_FRAME_HEIGHT}"
        width="${TURN_FRAME_WIDTH}"
        height="${TURN_FRAME_HEIGHT}"
        aria-label="Turn ${state.turn}"
      ></canvas>
      ${renderWinMeter('p2')}
      ${renderPlayerIdentity('p2')}
    </div>
  `;
}

function renderPlayerIdentity(playerId) {
  const identity = getPlayerIdentity(playerId);

  return `
    <div class="player-identity ${playerId}" aria-label="${escapeHtml(identity.name)}${identity.rating ? ` rating ${identity.rating}` : ''}">
      <div class="player-name">${escapeHtml(identity.name)}</div>
      ${identity.rating ? `<div class="player-rating">${identity.rating}</div>` : ''}
      ${renderComputerDebugLine(playerId)}
    </div>
  `;
}

function renderComputerDebugLine(playerId) {
  if (playerId !== 'p2' || playMode !== 'local' || getCurrentVariantId() !== VARIANT_IDS.chargeBlockFireball) {
    return '';
  }

  const queuedMove = localTurnChoice?.moves?.p2;
  const lastComputerMove = state.history[0]?.p2Move ?? null;
  const debugMove = queuedMove || lastComputerMove;

  return debugMove ? `<div class="player-debug">CPU last: ${escapeHtml(debugMove)}</div>` : '';
}

function getPlayerIdentity(playerId) {
  if (playMode === 'online' && rankedSnapshot) {
    const rankedKey = playerId === 'p1' ? rankedSnapshot.playerKey : rankedSnapshot.opponentKey;
    const player = rankedSnapshot.players[rankedKey];

    return {
      name: player?.displayName || DEFAULT_RANKED_DISPLAY_NAME,
      rating: player?.rating,
    };
  }

  return {
    name: playerId === 'p1' ? 'YOU' : 'CPU',
    rating: null,
  };
}

function renderBulletMeters() {
  return `
    <div class="bullets-super-meters" aria-label="Bullets">
      ${renderBulletMeter('p1', getPlayerResource(state.players.p1))}
      ${renderBulletMeter('p2', getPlayerResource(state.players.p2))}
    </div>
  `;
}

function renderWinMeter(playerId) {
  const winStacks = getWinStacks(roundWins[playerId]);

  return `
    <div class="win-meter ${playerId}">
      <canvas
        class="sprite-canvas wins-label"
        data-doodle="wins_label"
        data-frame-width="${WINS_LABEL_FRAME_WIDTH}"
        data-frame-height="${WINS_LABEL_FRAME_HEIGHT}"
        width="${WINS_LABEL_FRAME_WIDTH}"
        height="${WINS_LABEL_FRAME_HEIGHT}"
        aria-hidden="true"
      ></canvas>
      <div class="win-marks" aria-label="${playerId} wins: ${roundWins[playerId]}">
        ${winStacks.map((stack) => renderWinMark(stack)).join('')}
      </div>
    </div>
  `;
}

function renderWinMark(count) {
  return `
    <canvas
      class="sprite-canvas win-mark"
      data-doodle="w${count}"
      data-frame-width="${WIN_MARK_FRAME_WIDTH}"
      data-frame-height="${WIN_MARK_FRAME_HEIGHT}"
      width="${WIN_MARK_FRAME_WIDTH}"
      height="${WIN_MARK_FRAME_HEIGHT}"
      aria-hidden="true"
    ></canvas>
  `;
}

function renderBulletMeter(playerId, bullets) {
  return `
    <div class="bullets-meter ${playerId}">
      <canvas
        class="sprite-canvas bullets-label"
        data-doodle="bullets_label"
        data-frame-width="${BULLETS_LABEL_FRAME_WIDTH}"
        data-frame-height="${BULLETS_LABEL_FRAME_HEIGHT}"
        width="${BULLETS_LABEL_FRAME_WIDTH}"
        height="${BULLETS_LABEL_FRAME_HEIGHT}"
        aria-hidden="true"
      ></canvas>
      <div class="bullets-icons" aria-label="${playerId} bullets: ${bullets}">
        ${Array.from({ length: BULLET_SLOT_COUNT }, (_, index) => renderBulletSlot(playerId, index, bullets)).join('')}
      </div>
    </div>
  `;
}

function renderBulletSlot(playerId, index, bullets) {
  const slot = playerId === 'p2' ? BULLET_SLOT_COUNT - index : index + 1;
  const isFilled = slot <= bullets;

  return `
    <span class="bullets-slot">
      ${isFilled ? renderBulletIcon() : ''}
    </span>
  `;
}

function renderBulletIcon() {
  return `
    <canvas
      class="sprite-canvas bullets-icon"
      data-doodle="bullet_icon"
      data-frame-width="${BULLETS_ICON_FRAME_WIDTH}"
      data-frame-height="${BULLETS_ICON_FRAME_HEIGHT}"
      width="${BULLETS_ICON_FRAME_WIDTH}"
      height="${BULLETS_ICON_FRAME_HEIGHT}"
      aria-hidden="true"
    ></canvas>
  `;
}

function getTurnDoodle(turn) {
  return turn <= LAST_NUMBERED_TURN ? `turn${turn}` : 'turnlostcount';
}

function renderActionButtons(legalMoves) {
  if (turnPhase === 'round-over') {
    if (playMode === 'online') {
      if (rankedSnapshot?.noContest && !rankedSnapshot.winner) {
        return renderSheetButton('quit', 'quit_button', 'Back to menu', 'quit-button');
      }

      if (rankedSnapshot?.phase === 'roundOver') {
        return renderContinueButton();
      }

      return renderSheetButton('rematch', 'rematch_button', 'Rematch', 'rematch-button');
    }

    return isGameOver() ? renderGameOverButtons() : renderContinueButton();
  }

  return getActiveMoveIds().map((moveId) => renderMoveButton(MOVES[moveId], legalMoves.has(moveId))).join('');
}

function renderContinueButton() {
  return renderSheetButton('continue', 'continue_button', 'Continue', 'continue-button');
}

function renderGameOverButtons() {
  return `
    ${renderSheetButton('rematch', 'rematch_button', 'Rematch', 'rematch-button')}
    ${renderSheetButton('quit', 'quit_button', 'Quit', 'quit-button')}
  `;
}

function renderSheetButton(action, doodle, label, extraClass = '') {
  return `
    <button class="sheet-button ${extraClass}" data-action="${action}" aria-label="${label}">
      <canvas
        class="sprite-canvas sheet-button-art"
        data-doodle="${doodle}"
        data-frame-width="${REMATCH_BUTTON_FRAME_WIDTH}"
        data-frame-height="${REMATCH_BUTTON_FRAME_HEIGHT}"
        width="${REMATCH_BUTTON_FRAME_WIDTH}"
        height="${REMATCH_BUTTON_FRAME_HEIGHT}"
        aria-hidden="true"
      ></canvas>
    </button>
  `;
}

function renderMoveButton(move, isLegal) {
  const isQueued = p1QueuedMove === move.id;
  const canChooseMove = (
    screen === 'playing' && isLocalChoiceMode()
      ? turnPhase === 'scene'
      : turnPhase === 'go' || turnPhase === 'scene'
  ) && !p1QueuedMove;

  return `
    <button class="move-card ${isQueued ? 'selected' : ''}" data-move="${move.id}" ${isLegal && canChooseMove && state.status === 'playing' && !isTransitioning ? '' : 'disabled'}>
      <canvas
        class="sprite-canvas move-button-art"
        data-doodle="${MOVE_BUTTON_DOODLES[move.id]}"
        data-frame-width="${BUTTON_FRAME_WIDTH}"
        data-frame-height="${BUTTON_FRAME_HEIGHT}"
        width="${BUTTON_FRAME_WIDTH}"
        height="${BUTTON_FRAME_HEIGHT}"
        aria-label="${move.label}"
      ></canvas>
    </button>
  `;
}

function getActiveMoveIds() {
  return getVariantMoveIds(getCurrentVariantId());
}

function getCurrentVariantId() {
  if (playMode === 'online' && rankedSnapshot) {
    return rankedSnapshot.currentVariantId ?? rankedSnapshot.variantId ?? DEFAULT_VARIANT_ID;
  }

  return state.variantId ?? DEFAULT_VARIANT_ID;
}

function renderTestOpponentControls() {
  if (screen !== 'playing' || playMode !== 'test') {
    return '';
  }

  const legalMoves = new Set(getPlayerLegalMoves(state, 'p2'));
  const selectedMove = localTurnChoice?.moves.p2;
  const canChooseMove = turnPhase === 'scene'
    && state.status === 'playing'
    && !isTransitioning
    && !selectedMove;

  return `
    <nav class="test-opponent-controls" aria-label="Test opponent moves">
      ${getActiveMoveIds().map((moveId) => MOVES[moveId]).map((move) => `
        <button
          class="text-link test-opponent-link ${selectedMove === move.id ? 'selected' : ''}"
          data-test-opponent-move="${move.id}"
          type="button"
          ${canChooseMove && legalMoves.has(move.id) ? '' : 'disabled'}
        >${move.label.toLowerCase()}</button>
      `).join('')}
    </nav>
  `;
}

function renderTutorialMoveButton(move) {
  const canUseMove = shouldShowTutorialMoveButtons()
    && !isTransitioning
    && (turnPhase === 'go' || turnPhase === 'scene')
    && state.status === 'playing'
    && getTutorialLegalMoves().includes(move.id);

  return renderMoveButton(move, canUseMove);
}

function getTutorialLegalMoves() {
  return getPlayerLegalMoves(state, 'p1');
}

function installMoveButtonHandlers() {
  app.querySelectorAll('[data-move]').forEach((button) => {
    button.addEventListener('click', () => submitMove(button.dataset.move));
  });
}

function submitMove(p1Move) {
  if (screen === 'tutorial') {
    submitTutorialMove(p1Move);
    return;
  }

  if (playMode === 'online') {
    submitRankedMove(p1Move);
    return;
  }

  if (
    isTransitioning ||
    turnPhase !== 'scene' ||
    state.status !== 'playing' ||
    !getCurrentLegalMoves().includes(p1Move)
  ) {
    return;
  }

  unlockSceneAudio();
  queueLocalPlayerMove(p1Move);
}

function queueLocalPlayerMove(p1Move) {
  const choice = getOrCreateLocalTurnChoice();

  if (!choice || choice.moves.p1) {
    return;
  }

  choice.moves.p1 = p1Move;
  p1QueuedMove = p1Move;
  handleLocalMoveQueued('p1');
}

function maybeStartComputerTurnChoice() {
  if (
    screen !== 'playing' ||
    playMode !== 'local' ||
    state.status !== 'playing' ||
    isTransitioning ||
    turnPhase !== 'scene'
  ) {
    return;
  }

  getOrCreateLocalTurnChoice();
}

function submitTestOpponentMove(p2Move) {
  if (
    screen !== 'playing' ||
    playMode !== 'test' ||
    isTransitioning ||
    turnPhase !== 'scene' ||
    state.status !== 'playing' ||
    !getPlayerLegalMoves(state, 'p2').includes(p2Move)
  ) {
    return;
  }

  unlockSceneAudio();
  queueTestOpponentMove(p2Move);
}

function queueTestOpponentMove(p2Move) {
  const choice = getOrCreateLocalTurnChoice();

  if (!choice || choice.moves.p2) {
    return;
  }

  choice.moves.p2 = p2Move;
  handleLocalMoveQueued('p2');
}

function getOrCreateLocalTurnChoice() {
  const key = getLocalTurnChoiceKey();

  if (localTurnChoice?.key === key) {
    return localTurnChoice;
  }

  clearLocalTurnChoice();
  localTurnChoice = {
    key,
    moves: {
      p1: null,
      p2: null,
    },
    phase: 'neutral',
    readyPlayerId: null,
    waitingPlayerId: null,
    splitApplied: false,
    computerTimer: playMode === 'local'
      ? setPausableTimeout(() => {
        queueLocalComputerMove();
      }, COMPUTER_MOVE_DELAY_MS)
      : null,
    safeTimer: null,
    timeoutTimer: null,
  };
  return localTurnChoice;
}

function getLocalTurnChoiceKey() {
  return [
    state.turn,
    getPlayerResource(state.players.p1),
    getPlayerResource(state.players.p2),
    roundWins.p1,
    roundWins.p2,
  ].join(':');
}

function queueLocalComputerMove() {
  const choice = getOrCreateLocalTurnChoice();

  if (!choice || choice.moves.p2) {
    return;
  }

  choice.moves.p2 = chooseEasyComputerMove(state);
  handleLocalMoveQueued('p2');
}

function chooseEasyComputerMove(roundState, rng = Math.random) {
  const legalMoves = getPlayerLegalMoves(roundState, 'p2');
  return legalMoves[Math.floor(rng() * legalMoves.length)] ?? legalMoves[0];
}

function handleLocalMoveQueued(playerId) {
  const choice = localTurnChoice;

  if (!choice) {
    return;
  }

  if (!choice.readyPlayerId) {
    beginLocalSafePhase(playerId);
    return;
  }

  if (choice.waitingPlayerId === playerId) {
    clearLocalPhaseTimers();
    resolvePlayerSelection();
  }
}

function beginLocalSafePhase(readyPlayerId) {
  const choice = localTurnChoice;

  if (!choice) {
    return;
  }

  choice.phase = 'safe';
  choice.readyPlayerId = readyPlayerId;
  choice.waitingPlayerId = readyPlayerId === 'p1' ? 'p2' : 'p1';
  choice.safeTimer = setPausableTimeout(() => {
    beginLocalCountdownPhase();
  }, READY_WAITING_SAFE_PHASE_MS);
  render();
}

function beginLocalCountdownPhase() {
  const choice = localTurnChoice;

  if (!choice || !choice.waitingPlayerId || choice.moves[choice.waitingPlayerId]) {
    return;
  }

  choice.phase = 'countdown';

  choice.timeoutTimer = setPausableTimeout(() => {
    loseLocalRoundOnTimeout(choice.waitingPlayerId);
  }, COUNTDOWN_PHASE_MS);
  render();
}

function handleReadyWaitingSplit() {
  const choice = getActiveReadyWaiting();

  if (!choice || choice.phase !== 'safe') {
    return;
  }

  if (localTurnChoice && choice.readyPlayerId === localTurnChoice.readyPlayerId && localTurnChoice.splitApplied) {
    return;
  }

  const splitPresentation = getReadySplitPresentation(choice.readyPlayerId);

  if (!splitPresentation) {
    return;
  }

  if (localTurnChoice && choice.readyPlayerId === localTurnChoice.readyPlayerId) {
    localTurnChoice.splitApplied = true;
  }

  stagePresentation = splitPresentation;
  replaceStagePresentation();
}

function replaceStagePresentation() {
  const stage = app.querySelector('.doodle-stage, [data-layout-key="scene"]');

  if (!stage) {
    return;
  }

  stage.innerHTML = renderStagePresentation();
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
}

function getReadySplitPresentation(readyPlayerId) {
  const scene = stagePresentation.kind === 'doodle' ? stagePresentation.name : '';

  if (!readyPlayerId || scene === 'shooting' || scene === 'stabbing') {
    return null;
  }

  const rpsSplitScene = getRpsReadySplitScene(scene);

  if (rpsSplitScene) {
    return {
      kind: 'doodle',
      name: `rock-paper-scissors/split_scenes/${rpsSplitScene}_${readyPlayerId}_is_ready`,
      flip: false,
    };
  }

  const cbfSplitScene = getChargeBlockFireballReadySplitScene(scene);

  if (cbfSplitScene) {
    const separator = cbfSplitScene === 'charge' ? '-' : '_';
    return {
      kind: 'doodle',
      name: `charge-block-fireball/split_scenes/${cbfSplitScene}${separator}${readyPlayerId}_is_ready`,
      flip: false,
    };
  }

  const pssSplitPresentation = getPunchStabShootReadySplitPresentation(scene, readyPlayerId);

  if (pssSplitPresentation) {
    return pssSplitPresentation;
  }

  const ssdSplitPresentation = getShootStabDuckReadySplitPresentation(scene, readyPlayerId);

  if (ssdSplitPresentation) {
    return ssdSplitPresentation;
  }

  if (scene === 'charge-block-fireball/block-charge') {
    const isChargerReady = lastMoves[readyPlayerId] === 'charge';
    return {
      kind: 'doodle',
      name: `charge-block-fireball/split_scenes/block-charge_${isChargerReady ? 'charger' : 'blocker'}_is_ready`,
      flip: lastMoves.p1 === 'charge',
    };
  }

  if (scene === 'charge-block-fireball/block-fireball') {
    const isFireballerReady = lastMoves[readyPlayerId] === 'fireball';
    return {
      kind: 'doodle',
      name: `charge-block-fireball/split_scenes/block-fireball_${isFireballerReady ? 'fireballer' : 'blocker'}_is_ready`,
      flip: false,
    };
  }

  return null;
}

function getRpsReadySplitScene(scene) {
  const prefix = 'rock-paper-scissors/';

  if (!scene.startsWith(prefix)) {
    return null;
  }

  const sceneName = scene.slice(prefix.length);
  const splitSceneName = sceneName === 'scissors-tie' ? 'scissors-draw' : sceneName;
  return ['rps-standoff', 'rock-draw', 'paper-draw', 'scissors-draw'].includes(splitSceneName)
    ? splitSceneName
    : null;
}

function getChargeBlockFireballReadySplitScene(scene) {
  const prefix = 'charge-block-fireball/';

  if (!scene.startsWith(prefix)) {
    return null;
  }

  const sceneName = scene.slice(prefix.length);

  if (sceneName === 'cbf-standoff') {
    return 'cbf_standoff';
  }

  if (sceneName === 'both-charge') {
    return 'charge';
  }

  return ['block-draw', 'fireball-draw'].includes(sceneName) ? sceneName : null;
}

function getPunchStabShootReadySplitPresentation(scene, readyPlayerId) {
  const prefix = 'punch-stab-shoot/';

  if (!scene.startsWith(prefix)) {
    return null;
  }

  const sceneName = scene.slice(prefix.length);

  if (sceneName === 'pss-standoff' || ['punch-draw', 'shoot-draw', 'stab-draw'].includes(sceneName)) {
    return {
      kind: 'doodle',
      name: `punch-stab-shoot/split_scenes/${sceneName}_${readyPlayerId}_is_ready`,
      flip: false,
    };
  }

  if (sceneName.startsWith('punch-shoot')) {
    const isPuncherReady = lastMoves[readyPlayerId] === 'punch';
    return {
      kind: 'doodle',
      name: `punch-stab-shoot/split_scenes/punch-shoot_${isPuncherReady ? 'puncher' : 'shooter'}_is_ready`,
      flip: lastMoves.p2 === 'punch',
    };
  }

  if (sceneName.startsWith('stab-punch')) {
    const isStabberReady = lastMoves[readyPlayerId] === 'stab';
    return {
      kind: 'doodle',
      name: `punch-stab-shoot/split_scenes/stab-punch_${isStabberReady ? 'stabber' : 'puncher'}_is_ready`,
      flip: lastMoves.p2 === 'stab',
    };
  }

  return null;
}

function getShootStabDuckReadySplitPresentation(scene, readyPlayerId) {
  const prefix = 'shoot-stab-duck/';

  if (!scene.startsWith(prefix)) {
    return null;
  }

  const sceneName = scene.slice(prefix.length);

  if (sceneName === 'standoff-ssd') {
    return {
      kind: 'doodle',
      name: `shoot-stab-duck/split_scenes/ssd-standoff_${readyPlayerId}_is_ready`,
      flip: false,
    };
  }

  if (sceneName === 'reload-draw') {
    return {
      kind: 'doodle',
      name: `shoot-stab-duck/split_scenes/reloading_${readyPlayerId}_is_ready`,
      flip: false,
    };
  }

  if (['shoot-draw', 'stab-draw', 'duck-draw'].includes(sceneName)) {
    return {
      kind: 'doodle',
      name: `shoot-stab-duck/split_scenes/${sceneName}_${readyPlayerId}_is_ready`,
      flip: false,
    };
  }

  if (sceneName === 'reload-duck') {
    const isReloaderReady = lastMoves[readyPlayerId] === 'reload';
    return {
      kind: 'doodle',
      name: `shoot-stab-duck/split_scenes/reload-duck_${isReloaderReady ? 'reloader' : 'ducker'}_is_ready`,
      flip: lastMoves.p1 === 'duck',
    };
  }

  if (sceneName === 'stab-reload') {
    const isStabberReady = lastMoves[readyPlayerId] === 'stab';
    return {
      kind: 'doodle',
      name: `shoot-stab-duck/split_scenes/stab-reload_${isStabberReady ? 'stabber' : 'reloader'}_is_ready`,
      flip: lastMoves.p2 === 'stab',
    };
  }

  return null;
}

function clearLocalTurnChoice() {
  if (localTurnChoice?.computerTimer) {
    clearPausableTimeout(localTurnChoice.computerTimer);
  }

  clearLocalPhaseTimers();
  localTurnChoice = null;
}

function pauseGameplayTimers() {
  pauseRendererClock();
  pausePausableTimers();
}

function resumeGameplayTimers() {
  resumeRendererClock();
  resumePausableTimers();
}

function clearLocalPhaseTimers() {
  if (localTurnChoice?.safeTimer) {
    clearPausableTimeout(localTurnChoice.safeTimer);
    localTurnChoice.safeTimer = null;
  }

  if (localTurnChoice?.timeoutTimer) {
    clearPausableTimeout(localTurnChoice.timeoutTimer);
    localTurnChoice.timeoutTimer = null;
  }
}

async function loseLocalRoundOnTimeout(playerId) {
  const token = loopToken;

  if (
    (playerId !== 'p1' && playerId !== 'p2') ||
    !isActiveLoop(token) ||
    !localTurnChoice ||
    localTurnChoice.moves[playerId] ||
    state.status !== 'playing'
  ) {
    return;
  }

  clearLocalTurnChoice();
  p1QueuedMove = null;
  state = {
    ...state,
    status: 'finished',
    winner: playerId === 'p1' ? 'p2' : 'p1',
  };
  turnPhase = 'wipe';
  isTransitioning = true;
  await playWipeTransition(() => {
    turnPhase = 'round-over';
    showRoundOverScene();
  });
  isTransitioning = false;

  if (isActiveLoop(token)) {
    render();
  }
}

function submitTutorialMove(p1Move) {
  if (
    !shouldShowTutorialMoveButtons() ||
    isTransitioning ||
    (turnPhase !== 'go' && turnPhase !== 'scene') ||
    state.status !== 'playing' ||
    !getTutorialLegalMoves().includes(p1Move)
  ) {
    return;
  }

  unlockSceneAudio();
  tutorialFeedbackMarkup = '';
  tutorialPendingFeedbackMarkup = '';
  p1QueuedMove = p1Move;
  render();
  resolvePlayerSelection();
}

async function restartGame() {
  if (playMode === 'online') {
    leaveRanked();
    return;
  }

  if (isTransitioning) {
    return;
  }

  if (isGameOver() || state.winner !== 'p1') {
    restartMusicTrackOnce('title', 'game');
  }
  unlockSceneAudio();
  resetRoundWins();
  loopToken += 1;
  isTransitioning = true;
  await playWipeTransition(setNewRound);
  isTransitioning = false;
  render();
  beginOpeningCues();
}

async function startGameFromTitle() {
  if (isTransitioning) {
    return;
  }

  isTransitioning = true;
  await playCurtainMenuTransition(() => {
    playMode = 'local';
    screen = 'opponent-select';
    p1QueuedMove = null;
    rankedSnapshot = null;
    render();
  });
  isTransitioning = false;
  render();
}

async function returnToTitleFromOpponentSelect() {
  if (isTransitioning) {
    return;
  }

  isTransitioning = true;
  await playCurtainMenuTransition(() => {
    screen = 'title';
    clearLocalTurnChoice();
    p1QueuedMove = null;
    rankedSnapshot = null;
    render();
  });
  isTransitioning = false;
  render();
}

async function startTutorialFromTitle() {
  if (isTransitioning) {
    return;
  }

  playMode = 'local';
  clearLocalTurnChoice();
  requestMusicTrack('game');
  unlockSceneAudio();
  resetRoundWins();
  loopToken += 1;
  isTransitioning = true;
  await playWipeTransition(() => {
    selectedOpponentId = DEFAULT_OPPONENT_ID;
    state = createRoundState();
    screen = 'tutorial';
    turnPhase = 'scene';
    tutorialSlideIndex = 0;
    tutorialTipsSlideIndex = 0;
    tutorialStageMode = 'slide';
    tutorialFeedbackMarkup = '';
    tutorialPendingFeedbackMarkup = '';
    p1QueuedMove = null;
    rankedSnapshot = null;
    pendingSuperAnimation = null;
    stagePresentation = getIdleStagePresentation();
    render();
  });
  isTransitioning = false;
  render();
}

async function startTestModeFromTitle() {
  if (isTransitioning) {
    return;
  }

  selectedOpponentId = DEFAULT_OPPONENT_ID;
  selectedVariantId = DEFAULT_VARIANT_ID;
  await setActiveGameLayoutForVariant(selectedVariantId);
  playMode = 'test';
  clearLocalTurnChoice();
  requestMusicTrack('game');
  unlockSceneAudio();
  resetRoundWins();
  isTransitioning = true;
  await playWipeTransition(setNewRound);
  isTransitioning = false;
  render();
  beginOpeningCues();
}

async function startLocalGame(variantId) {
  if (isTransitioning) {
    return;
  }

  selectedOpponentId = DEFAULT_OPPONENT_ID;
  selectedVariantId = COMPUTER_VARIANT_IDS.includes(variantId) ? variantId : DEFAULT_VARIANT_ID;
  await setActiveGameLayoutForVariant(selectedVariantId);
  playMode = 'local';
  clearLocalTurnChoice();
  requestMusicTrack('game');
  unlockSceneAudio();
  resetRoundWins();
  isTransitioning = true;
  await playWipeTransition(setNewRound);
  isTransitioning = false;
  render();
  beginOpeningCues();
}

async function advanceTutorialSlide() {
  if (isTransitioning || screen !== 'tutorial') {
    return;
  }

  if (tutorialStageMode === 'tips') {
    if (tutorialTipsSlideIndex >= TUTORIAL_TIPS_SLIDE_COUNT - 1) {
      return;
    }

    unlockSceneAudio();
    isTransitioning = true;
    await playWipeTransition(() => {
      tutorialTipsSlideIndex += 1;
      render();
    });
    isTransitioning = false;
    render();
    return;
  }

  if (tutorialStageMode !== 'slide' || tutorialSlideIndex >= TUTORIAL_MAIN_SLIDE_COUNT - 1) {
    return;
  }

  unlockSceneAudio();
  isTransitioning = true;
  await playWipeTransition(() => {
    settleTutorialScene();
    tutorialSlideIndex += 1;
    tutorialStageMode = 'slide';
    render();
  });
  isTransitioning = false;
  render();
}

async function openTutorialTips() {
  if (isTransitioning || screen !== 'tutorial') {
    return;
  }

  loopToken += 1;
  unlockSceneAudio();
  isTransitioning = true;
  await playWipeTransition(() => {
    if (tutorialStageMode === 'scene') {
      settleTutorialScene();
    }
    tutorialStageMode = 'tips';
    tutorialFeedbackMarkup = '';
    tutorialPendingFeedbackMarkup = '';
    render();
  });
  isTransitioning = false;
  render();
}

async function restartTutorialPractice() {
  if (isTransitioning || screen !== 'tutorial') {
    return;
  }

  requestMusicTrack('game');
  unlockSceneAudio();
  loopToken += 1;
  isTransitioning = true;
  await playWipeTransition(() => {
    resetRoundWins();
    state = createRoundState();
    turnPhase = 'scene';
    tutorialSlideIndex = TUTORIAL_REVEAL_SLIDE_INDEX;
    tutorialTipsSlideIndex = 0;
    tutorialStageMode = 'slide';
    tutorialFeedbackMarkup = '';
    tutorialPendingFeedbackMarkup = '';
    clearLocalTurnChoice();
    p1QueuedMove = null;
    rankedSnapshot = null;
    resetStageAudioKey();
    lastMoves = {
      p1: 'reload',
      p2: 'reload',
    };
    stagePresentation = getIdleStagePresentation();
    render();
  });
  isTransitioning = false;
  render();
}

async function goBackTutorial() {
  if (isTransitioning || screen !== 'tutorial') {
    return;
  }

  if (tutorialStageMode === 'slide' && tutorialSlideIndex === 0) {
    return;
  }

  unlockSceneAudio();
  isTransitioning = true;
  await playWipeTransition(() => {
    if (tutorialStageMode === 'tips') {
      if (tutorialTipsSlideIndex > 0) {
        tutorialTipsSlideIndex -= 1;
      } else {
        tutorialSlideIndex = TUTORIAL_REVEAL_SLIDE_INDEX;
        tutorialStageMode = 'slide';
      }
      render();
      return;
    }

    if (tutorialStageMode === 'scene') {
      settleTutorialScene();
      tutorialStageMode = 'slide';
      render();
      return;
    }

    tutorialSlideIndex = Math.max(0, tutorialSlideIndex - 1);
    render();
  });
  isTransitioning = false;
  render();
}

async function continueGame() {
  if (playMode === 'online') {
    submitRankedContinue();
    return;
  }

  if (isTransitioning || turnPhase !== 'round-over' || isGameOver()) {
    return;
  }

  requestMusicTrack('game');
  unlockSceneAudio();
  loopToken += 1;
  clearLocalTurnChoice();
  isTransitioning = true;
  await playWipeTransition(setNewRoundAtReloadScene);
  isTransitioning = false;
  render();
}

async function quitLocalGame() {
  if (playMode === 'online') {
    leaveRanked();
    return;
  }

  if (isTransitioning) {
    return;
  }

  requestMusicTrack('title');
  unlockSceneAudio();
  loopToken += 1;
  clearLocalTurnChoice();
  isTransitioning = true;
  await playWipeTransition(() => {
    resetRoundWins();
    state = createRoundState();
    screen = 'title';
    turnPhase = 'idle';
    tutorialSlideIndex = 0;
    tutorialTipsSlideIndex = 0;
    tutorialStageMode = 'slide';
    tutorialFeedbackMarkup = '';
    tutorialPendingFeedbackMarkup = '';
    p1QueuedMove = null;
    rankedSnapshot = null;
    stagePresentation = getIdleStagePresentation();
    render();
  });
  isTransitioning = false;
  render();
}

function resetRoundWins() {
  roundWins = {
    p1: 0,
    p2: 0,
  };
  syncMusicTopper();
}

function isGameOver() {
  return roundWins.p1 >= GAME_TARGET_ROUNDS || roundWins.p2 >= GAME_TARGET_ROUNDS;
}

function getGameWinner() {
  if (roundWins.p1 >= GAME_TARGET_ROUNDS) {
    return 'p1';
  }

  if (roundWins.p2 >= GAME_TARGET_ROUNDS) {
    return 'p2';
  }

  return null;
}

function getMusicTopperFile() {
  if (
    !shouldUseMusicTopper() ||
    isGameOver() ||
    (roundWins.p1 !== GAME_TARGET_ROUNDS - 1 && roundWins.p2 !== GAME_TARGET_ROUNDS - 1)
  ) {
    return null;
  }

  if (roundWins.p1 === GAME_TARGET_ROUNDS - 1 && roundWins.p2 === GAME_TARGET_ROUNDS - 1) {
    return getMusicTopperId('final');
  }

  return getMusicTopperId('tension');
}

function shouldUseMusicTopper() {
  return isLocalChoiceMode()
    || (
      playMode === 'online' &&
      ['choosing', 'roundOver'].includes(rankedSnapshot?.phase) &&
      !rankedSnapshot.noContest
    );
}

function isLocalChoiceMode() {
  return playMode === 'local' || playMode === 'test';
}

function setNewRound() {
  clearLocalTurnChoice();
  pendingSuperAnimation = null;
  state = createRoundState({ variantId: selectedVariantId });
  screen = 'playing';
  rankedSnapshot = null;
  turnPhase = 'ready';
  p1QueuedMove = null;
  resetStageAudioKey();
  lastMoves = {
    p1: getActiveMoveIds()[0] ?? 'reload',
    p2: getActiveMoveIds()[0] ?? 'reload',
  };
  stagePresentation = { kind: 'cue', name: 'READY' };
  render();
}

function setNewRoundAtReloadScene() {
  setNewRound();
  turnPhase = 'scene';
  stagePresentation = getIdleStagePresentation();
  render();
}

function getIdleStagePresentation(variantId = getCurrentVariantId()) {
  if (variantId === VARIANT_IDS.chargeBlockFireball) {
    return {
      kind: 'doodle',
      name: 'charge-block-fireball/cbf-standoff',
      flip: false,
    };
  }

  if (variantId === VARIANT_IDS.punchStabShoot) {
    return {
      kind: 'doodle',
      name: 'punch-stab-shoot/pss-standoff',
      flip: false,
    };
  }

  return {
    kind: 'doodle',
    name: variantId === VARIANT_IDS.rps ? 'rock-paper-scissors/rps-standoff' : 'shoot-stab-duck/standoff-ssd',
    flip: false,
  };
}

function getCurrentLegalMoves() {
  if (playMode !== 'online' || !rankedSnapshot) {
    return getPlayerLegalMoves(state, 'p1');
  }

  return rankedSnapshot.players[rankedSnapshot.playerKey].legalMoves;
}

function startRankedFromTitle() {
  if (isTransitioning) {
    return;
  }

  playMode = 'online';
  selectedVariantId = DEFAULT_VARIANT_ID;
  setCachedActiveGameLayoutForVariant(DEFAULT_VARIANT_ID);
  clearLocalTurnChoice();
  screen = 'online-name';
  p1QueuedMove = null;
  rankedSnapshot = null;
  pendingRankedSnapshot = null;
  rankedReadyWaiting = null;
  rankedRoundAudioKey = null;
  render();
}

function returnToTitleFromOnlineName() {
  if (isTransitioning) {
    return;
  }

  stopOnlineStatusPolling();
  screen = 'title';
  p1QueuedMove = null;
  rankedSnapshot = null;
  pendingRankedSnapshot = null;
  rankedReadyWaiting = null;
  rankedRoundAudioKey = null;
  render();
}

function submitOnlineName(event) {
  event.preventDefault();

  if (isTransitioning) {
    return;
  }

  const formData = new FormData(event.currentTarget);
  rankedDisplayName = sanitizeDisplayName(formData.get('displayName'));
  writeStoredDisplayName(rankedDisplayName);
  beginRankedQueue();
}

function generateOnlineName() {
  const input = app.querySelector('.online-name-input');

  if (!input) {
    return;
  }

  rankedDisplayName = sanitizeDisplayName(generateDisplayName());
  input.value = rankedDisplayName;
  input.focus();
  input.select();
}

function beginRankedQueue() {
  stopOnlineStatusPolling();
  unlockSceneAudio();
  playMode = 'online';
  selectedVariantId = DEFAULT_VARIANT_ID;
  setCachedActiveGameLayoutForVariant(DEFAULT_VARIANT_ID);
  clearLocalTurnChoice();
  clearRankedReadyWaitingTimer();
  screen = 'queue';
  p1QueuedMove = null;
  rankedSnapshot = null;
  pendingRankedSnapshot = null;
  rankedReadyWaiting = null;
  rankedRoundAudioKey = null;
  findingMatchStep = 0;
  rankedClient.connect(rankedDisplayName, DEFAULT_VARIANT_ID);
  render();
}

function handleRankedQueue() {
  screen = 'queue';
  render();
}

function handleRankedClose() {
  if (playMode === 'online' && screen !== 'title') {
    clearRankedReadyWaitingTimer();
    rankedReadyWaiting = null;
    screen = 'title';
    rankedSnapshot = null;
    pendingRankedSnapshot = null;
    rankedRoundAudioKey = null;
    render();
  }
}

function applyRankedSnapshot(snapshot) {
  pendingRankedSnapshot = snapshot;
  drainRankedSnapshots();
}

async function drainRankedSnapshots() {
  if (isApplyingRankedSnapshot) {
    return;
  }

  isApplyingRankedSnapshot = true;

  try {
    while (pendingRankedSnapshot) {
      const snapshot = pendingRankedSnapshot;
      pendingRankedSnapshot = null;

      if (playMode !== 'online') {
        continue;
      }

      await processRankedSnapshot(snapshot);
    }
  } finally {
    isApplyingRankedSnapshot = false;
  }
}

async function processRankedSnapshot(snapshot) {
  stopFindingMatchTicker();
  const previousSnapshot = rankedSnapshot;
  const previousPhase = previousSnapshot?.phase;

  if (shouldWipeToRankedSnapshot(previousSnapshot, snapshot)) {
    await wipeToRankedSnapshot(snapshot, previousPhase);
    return;
  }

  commitRankedSnapshot(snapshot, previousPhase);
  render();
}

async function wipeToRankedSnapshot(snapshot, previousPhase) {
  if (snapshot.noContest) {
    finishMusicLoopThenStop();
  }

  clearRankedReadyWaitingTimer();
  isTransitioning = true;
  await playWipeTransition(() => {
    commitRankedSnapshot(snapshot, previousPhase);
    render();
  });
  isTransitioning = false;
  render();
}

function shouldWipeToRankedSnapshot(previousSnapshot, snapshot) {
  return shouldWipeToRankedNoContest(previousSnapshot, snapshot)
    || shouldWipeToRankedReveal(previousSnapshot, snapshot)
    || shouldWipeToRankedRoundOver(previousSnapshot, snapshot)
    || shouldWipeToRankedGameOver(previousSnapshot, snapshot)
    || shouldWipeToRankedNextTurn(previousSnapshot, snapshot);
}

function shouldWipeToRankedNoContest(previousSnapshot, snapshot) {
  return playMode === 'online'
    && snapshot.phase === 'gameOver'
    && snapshot.noContest
    && previousSnapshot?.phase !== 'gameOver'
    && !isTransitioning;
}

function shouldWipeToRankedReveal(previousSnapshot, snapshot) {
  return playMode === 'online'
    && previousSnapshot?.phase === 'choosing'
    && snapshot.phase === 'revealed'
    && Boolean(snapshot.revealedMoves)
    && !isTransitioning;
}

function shouldWipeToRankedRoundOver(previousSnapshot, snapshot) {
  return playMode === 'online'
    && previousSnapshot?.phase === 'revealed'
    && snapshot.phase === 'roundOver'
    && !isTransitioning;
}

function shouldWipeToRankedGameOver(previousSnapshot, snapshot) {
  return playMode === 'online'
    && ['revealed', 'roundOver'].includes(previousSnapshot?.phase)
    && snapshot.phase === 'gameOver'
    && !snapshot.noContest
    && !isTransitioning;
}

function shouldWipeToRankedNextTurn(previousSnapshot, snapshot) {
  return playMode === 'online'
    && previousSnapshot?.phase === 'roundOver'
    && snapshot.phase === 'choosing'
    && !isTransitioning;
}

function commitRankedSnapshot(snapshot, previousPhase = rankedSnapshot?.phase) {
  rankedSnapshot = snapshot;
  rankedReadyWaiting = getRankedReadyWaitingFromSnapshot(snapshot);
  screen = 'playing';
  setCachedActiveGameLayoutForVariant(snapshot.currentVariantId ?? snapshot.variantId ?? DEFAULT_VARIANT_ID);
  state = getLocalStateFromRankedSnapshot(snapshot);
  roundWins = getLocalRoundWinsFromRankedSnapshot(snapshot);
  syncMusicTopper();
  turnPhase = getTurnPhaseFromRankedSnapshot(snapshot);
  p1QueuedMove = snapshot.phase === 'choosing' && previousPhase === 'choosing' ? p1QueuedMove : null;
  if (previousPhase !== snapshot.phase) {
    resetStageAudioKey();
  }
  scheduleRankedReadyWaitingRender();

  if (snapshot.phase === 'gameOver' && snapshot.noContest) {
    stagePresentation = {
      kind: 'doodle',
      name: 'system_scenes/no_contest',
      flip: false,
    };
  } else if (snapshot.phase === 'revealed') {
    lastMoves = getLocalMovesFromRankedSnapshot(snapshot);
    stagePresentation = getVariantStagePresentation(snapshot.round?.lastTurn ?? {}, lastMoves.p1, lastMoves.p2, { variantId: snapshot.currentVariantId ?? snapshot.variantId });
  } else if (snapshot.phase === 'roundOver') {
    stagePresentation = {
      kind: 'doodle',
      name: getRoundOverDoodle(getLocalRoundWinnerFromRankedSnapshot(snapshot), true),
      flip: false,
    };
  } else if (snapshot.phase === 'countdown') {
    stagePresentation = { kind: 'cue', name: 'READY' };
  } else if (snapshot.phase === 'banning') {
    stagePresentation = { kind: 'cue', name: 'READY' };
  } else if (snapshot.phase === 'choosing' && snapshot.readyPlayerKey) {
    stagePresentation = getRankedChoosingPresentation(snapshot);
  } else if (snapshot.phase === 'choosing') {
    stagePresentation = getRankedIdleChoosingPresentation(snapshot);
  } else if (snapshot.phase === 'gameOver') {
    finishMusicLoopThenStop();
    stagePresentation = {
      kind: 'doodle',
      name: snapshot.winner === snapshot.playerKey ? 'system_scenes/game_won' : 'system_scenes/game_lost',
      flip: false,
    };
  }

  maybePlayRankedRoundResultAudio(snapshot);
}

function maybePlayRankedRoundResultAudio(snapshot) {
  if (snapshot.phase !== 'revealed' || !snapshot.round?.winner) {
    return;
  }

  const audioKey = [
    snapshot.matchId,
    snapshot.round?.turn,
    snapshot.round?.winner,
    snapshot.roundWins?.p1,
    snapshot.roundWins?.p2,
  ].join(':');

  if (rankedRoundAudioKey === audioKey) {
    return;
  }

  rankedRoundAudioKey = audioKey;

  const didWinRound = snapshot.round.winner === snapshot.playerKey;
  const isFinalRound = snapshot.gameWins?.p1 >= 2
    || snapshot.gameWins?.p2 >= 2
    || snapshot.roundWins?.p1 >= GAME_TARGET_ROUNDS
    || snapshot.roundWins?.p2 >= GAME_TARGET_ROUNDS;
  interruptMusicFileOnce(didWinRound ? WIN_SOUND_AUDIO : LOSE_JINGLE_AUDIO, isFinalRound ? null : 'game', !isFinalRound);
}

function getRankedIdleChoosingPresentation(snapshot) {
  if (snapshot.round?.lastTurn) {
    const moves = getLocalMovesFromRankedSnapshot(snapshot);
    return getVariantStagePresentation(snapshot.round?.lastTurn ?? {}, moves.p1, moves.p2, { variantId: snapshot.currentVariantId ?? snapshot.variantId });
  }

  return getIdleStagePresentation(snapshot.currentVariantId ?? snapshot.variantId);
}

function getRankedChoosingPresentation(snapshot) {
  if ((snapshot.round?.turn ?? 0) === 0 && !snapshot.round?.lastTurn) {
    return getIdleStagePresentation(snapshot.currentVariantId ?? snapshot.variantId);
  }

  return getVariantStagePresentation(snapshot.round?.lastTurn ?? {}, lastMoves.p1, lastMoves.p2, { variantId: snapshot.currentVariantId ?? snapshot.variantId });
}

function getLocalStateFromRankedSnapshot(snapshot) {
  const opponentKey = snapshot.opponentKey;
  const playerKey = snapshot.playerKey;

  return {
    variantId: snapshot.currentVariantId ?? snapshot.variantId ?? DEFAULT_VARIANT_ID,
    turn: snapshot.round?.turn ?? 0,
    status: snapshot.phase === 'gameOver' ? 'finished' : 'playing',
    winner: snapshot.winner === playerKey ? 'p1' : snapshot.winner === opponentKey ? 'p2' : null,
    players: {
      p1: {
        resource: snapshot.players[playerKey]?.resource ?? snapshot.players[playerKey]?.bullets ?? 0,
        bullets: snapshot.players[playerKey]?.resource ?? snapshot.players[playerKey]?.bullets ?? 0,
        move: null,
        hit: null,
      },
      p2: {
        resource: snapshot.players[opponentKey]?.resource ?? snapshot.players[opponentKey]?.bullets ?? 0,
        bullets: snapshot.players[opponentKey]?.resource ?? snapshot.players[opponentKey]?.bullets ?? 0,
        move: null,
        hit: null,
      },
    },
    history: snapshot.round?.lastTurn ? [snapshot.round.lastTurn] : [],
  };
}

function getLocalRoundWinsFromRankedSnapshot(snapshot) {
  return {
    p1: snapshot.roundWins?.[snapshot.playerKey] ?? 0,
    p2: snapshot.roundWins?.[snapshot.opponentKey] ?? 0,
  };
}

function getLocalRoundWinnerFromRankedSnapshot(snapshot) {
  if (snapshot.round?.winner === snapshot.playerKey) {
    return 'p1';
  }

  if (snapshot.round?.winner === snapshot.opponentKey) {
    return 'p2';
  }

  return null;
}

function getTurnPhaseFromRankedSnapshot(snapshot) {
  if (snapshot.phase === 'countdown') {
    return 'ready';
  }

  if (snapshot.phase === 'banning') {
    return 'ban';
  }

  if (snapshot.phase === 'choosing') {
    return snapshot.readyPlayerKey ? 'scene' : 'go';
  }

  if (snapshot.phase === 'revealed') {
    return 'scene';
  }

  return 'round-over';
}

function scheduleRankedReadyWaitingRender() {
  clearRankedReadyWaitingTimer();

  if (!rankedSnapshot || !['choosing', 'roundOver'].includes(rankedSnapshot.phase)) {
    return;
  }

  if (!rankedReadyWaiting) {
    if (rankedSnapshot.phase !== 'choosing' || !rankedSnapshot.noContestWaitingAt) {
      return;
    }

    const waitingStartsIn = Math.max(0, rankedSnapshot.noContestWaitingAt - Date.now());
    rankedReadyWaitingTimer = setTimeout(() => {
      rankedReadyWaitingTimer = null;
      rankedReadyWaiting = getRankedReadyWaitingFromSnapshot(rankedSnapshot);
      scheduleRankedReadyWaitingRender();
      render();
    }, waitingStartsIn);
    return;
  }

  if (rankedReadyWaiting.phase !== 'safe') {
    return;
  }

  const countdownAt = rankedReadyWaiting.isNoContest
    ? rankedSnapshot.noContestCountdownAt
    : rankedSnapshot.deadlineAt - COUNTDOWN_PHASE_MS;
  const countdownStartsIn = Math.max(0, countdownAt - Date.now());
  rankedReadyWaitingTimer = setTimeout(() => {
    rankedReadyWaitingTimer = null;
    rankedReadyWaiting = getRankedReadyWaitingFromSnapshot(rankedSnapshot);
    render();
  }, countdownStartsIn);
}

function clearRankedReadyWaitingTimer() {
  if (rankedReadyWaitingTimer) {
    clearTimeout(rankedReadyWaitingTimer);
    rankedReadyWaitingTimer = null;
  }
}

function getLocalMovesFromRankedSnapshot(snapshot) {
  const moves = snapshot.revealedMoves ?? {
    p1: snapshot.round?.lastTurn?.p1Move ?? getActiveMoveIds()[0] ?? 'reload',
    p2: snapshot.round?.lastTurn?.p2Move ?? getActiveMoveIds()[0] ?? 'reload',
  };

  return {
    p1: moves[snapshot.playerKey],
    p2: moves[snapshot.opponentKey],
  };
}

function submitRankedMove(moveId) {
  const isReadyPlayer = rankedSnapshot?.phase === 'choosing'
    && !rankedSnapshot.readyPlayerKey
    && !rankedSnapshot.waitingPlayerKey;

  if (p1QueuedMove || !rankedClient.submitMove(rankedSnapshot, moveId)) {
    return;
  }

  if (isReadyPlayer) {
    playOneShotAudio(READY_AUDIO);
  }

  p1QueuedMove = moveId;
  render();
}

function submitRankedBan(variantId) {
  if (!rankedClient.submitBan(rankedSnapshot, variantId)) {
    return;
  }

  playOneShotAudio(READY_AUDIO);
  render();
}

function submitRankedContinue() {
  const isReadyPlayer = rankedSnapshot?.phase === 'roundOver'
    && !rankedSnapshot.readyPlayerKey
    && !rankedSnapshot.waitingPlayerKey;

  if (!rankedClient.submitContinue(rankedSnapshot)) {
    return;
  }

  if (isReadyPlayer) {
    playOneShotAudio(READY_AUDIO);
  }

  render();
}

function leaveRanked() {
  rankedClient.close();
  stopFindingMatchTicker();
  clearRankedReadyWaitingTimer();
  playMode = 'local';
  selectedVariantId = DEFAULT_VARIANT_ID;
  setCachedActiveGameLayoutForVariant(DEFAULT_VARIANT_ID);
  clearLocalTurnChoice();
  rankedSnapshot = null;
  pendingRankedSnapshot = null;
  rankedReadyWaiting = null;
  rankedRoundAudioKey = null;
  screen = 'title';
  turnPhase = 'idle';
  p1QueuedMove = null;
  render();
}

function startFindingMatchTicker() {
  if (findingMatchTimer) {
    return;
  }

  findingMatchTimer = setInterval(() => {
    if (screen !== 'queue') {
      stopFindingMatchTicker();
      return;
    }

    findingMatchStep = (findingMatchStep + 1) % FINDING_MATCH_DOODLES.length;
    render();
  }, BEAT_MS);
}

function stopFindingMatchTicker() {
  if (!findingMatchTimer) {
    return;
  }

  clearInterval(findingMatchTimer);
  findingMatchTimer = null;
}

function renderOnlinePlayerCount() {
  return `players online: ${onlinePlayerCount ?? '?'}`;
}

function startOnlineStatusPolling() {
  if (onlineStatusTimer) {
    return;
  }

  updateOnlineStatus();
  onlineStatusTimer = setInterval(() => {
    if (screen !== 'online-name') {
      stopOnlineStatusPolling();
      return;
    }

    updateOnlineStatus();
  }, ONLINE_STATUS_POLL_MS);
}

function stopOnlineStatusPolling() {
  if (!onlineStatusTimer) {
    return;
  }

  clearInterval(onlineStatusTimer);
  onlineStatusTimer = null;
}

async function updateOnlineStatus() {
  try {
    const response = await fetch(getOnlineStatusUrl(), { cache: 'no-store' });

    if (!response.ok) {
      return;
    }

    const status = await response.json();
    onlinePlayerCount = Number.isFinite(status.playersOnline) ? status.playersOnline : null;
    updateOnlinePlayerCountText();
  } catch {
    onlinePlayerCount = null;
    updateOnlinePlayerCountText();
  }
}

function updateOnlinePlayerCountText() {
  app.querySelector('.online-player-count')?.replaceChildren(renderOnlinePlayerCount());
}

function getOnlineStatusUrl() {
  if (window.location.protocol === 'file:') {
    return 'http://localhost:8787/api/ranked-status';
  }

  return '/api/ranked-status';
}

function beginGameLoop() {
  loopToken += 1;
  setNewRound();
  beginOpeningCues();
}

function beginOpeningCues() {
  loopToken += 1;
  runOpeningCues(loopToken);
}

async function runOpeningCues(token) {
  turnPhase = 'ready';
  stagePresentation = { kind: 'cue', name: 'READY' };
  render();
  await waitBeats(READY_BEATS, token);

  if (!isActiveLoop(token)) {
    return;
  }

  turnPhase = 'scene';
  stagePresentation = getIdleStagePresentation();
  render();
}

async function resolvePlayerSelection() {
  const token = loopToken;

  if (!isActiveLoop(token) || isTransitioning || (turnPhase !== 'go' && turnPhase !== 'scene')) {
    return;
  }

  turnPhase = 'wipe';
  isTransitioning = true;
  await playWipeTransition(resolveQueuedTurn);
  isTransitioning = false;

  if (isActiveLoop(token)) {
    render();
    if (screen === 'tutorial') {
      maybeShowTutorialFeedback(token);
    } else {
      await playPendingSuperAnimation(token);
      maybeShowRoundOverScene(token);
    }
  }
}

function waitBeats(beats, token) {
  return waitMs(beats * BEAT_MS, token);
}

function waitMs(duration, token) {
  return new Promise((resolve) => {
    setPausableTimeout(() => {
      resolve(isActiveLoop(token));
    }, duration);
  });
}

function waitMsWithoutToken(duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

function isActiveLoop(token) {
  return token === loopToken && (screen === 'playing' || screen === 'tutorial');
}

function getTutorialOutcome(p1Move) {
  const p1Resource = getPlayerResource(state.players.p1);
  const p2Resource = getPlayerResource(state.players.p2);
  const key = `${p1Resource}-${p2Resource}:${p1Move}`;
  const outcome = TUTORIAL_OUTCOMES[key]
    ?? (p2Resource === 0 && p1Resource >= 2 && p1Resource <= MAX_BULLETS ? TUTORIAL_OUTCOMES[`advantage:${p1Move}`] : null);

  if (!outcome) {
    return null;
  }

  return {
    ...outcome,
    feedbackMarkup: renderTutorialFeedbackMarkup(outcome.lines),
  };
}

function renderTutorialFeedbackMarkup(lines) {
  return lines.map((line) => {
    if (line.size === 'big') {
      return `<p><strong>${line.text}</strong></p>`;
    }

    if (line.size === 'small') {
      return `<p class="tutorial-small">${line.text}</p>`;
    }

    return `<p>${line.text}</p>`;
  }).join('');
}

function resolveQueuedTurn() {
  const legalMoves = screen === 'tutorial' ? getTutorialLegalMoves() : getPlayerLegalMoves(state, 'p1');
  const p1Move = p1QueuedMove && legalMoves.includes(p1QueuedMove)
    ? p1QueuedMove
    : getFallbackMove('p1');
  const tutorialOutcome = screen === 'tutorial' ? getTutorialOutcome(p1Move) : null;
  const p2Move = tutorialOutcome?.p2Move ?? localTurnChoice?.moves.p2 ?? chooseAiMove(state, selectedOpponentId);
  const turn = playTurn(state, p1Move, p2Move);
  clearLocalTurnChoice();

  if (turn.ok) {
    state = turn.state;
    turnPhase = 'scene';
    if (screen === 'tutorial') {
      tutorialStageMode = 'scene';
      tutorialPendingFeedbackMarkup = tutorialOutcome?.feedbackMarkup ?? '';
    }
    lastMoves = {
      p1: p1Move,
      p2: p2Move,
    };
    pendingSuperAnimation = getSuperAnimation(turn.result);
    stagePresentation = getTurnStagePresentation(turn.result, p1Move, p2Move);

    if (screen === 'tutorial' && state.status === 'finished' && state.winner) {
      roundWins[state.winner] += 1;
      syncMusicTopper();
    }

    if (playMode === 'local' && state.status === 'finished' && state.winner === 'p2') {
      if (isGameOver() || (screen !== 'tutorial' && roundWins.p2 >= GAME_TARGET_ROUNDS - 1)) {
        interruptMusicFileOnce(LOSE_JINGLE_AUDIO, null, false);
      } else {
        interruptMusicFileOnce(LOSE_JINGLE_AUDIO, 'game');
      }
    } else if (playMode === 'local' && state.status === 'finished' && state.winner === 'p1') {
      if (isGameOver() || (screen !== 'tutorial' && roundWins.p1 >= GAME_TARGET_ROUNDS - 1)) {
        interruptMusicFileOnce(WIN_SOUND_AUDIO, null, false);
      } else {
        interruptMusicFileOnce(WIN_SOUND_AUDIO, 'game');
      }
    }
  }

  p1QueuedMove = null;
  render();
}

function getTurnStagePresentation(result, p1Move, p2Move) {
  const superAnimation = getSuperAnimation(result);

  if (superAnimation) {
    return superAnimation.frames[0];
  }

  return getVariantStagePresentation(result, p1Move, p2Move, { variantId: getCurrentVariantId() });
}

function getSuperAnimation(result) {
  return getVariantSuperAnimation(result, {
    variantId: getCurrentVariantId(),
    resourceMax: getVariantResourceMax(getCurrentVariantId()),
    frameCount: SUPER_FINAL_FRAME_COUNT,
  });
}

async function playPendingSuperAnimation(token) {
  const animation = pendingSuperAnimation;
  pendingSuperAnimation = null;

  if (!animation || !isActiveLoop(token)) {
    return;
  }

  for (const frame of animation.frames.slice(1)) {
    await waitMs(SUPER_FINAL_FRAME_MS, token);

    if (!isActiveLoop(token)) {
      return;
    }

    stagePresentation = frame;
    render();
  }

  await waitMs(SUPER_FINAL_FRAME_MS, token);

  if (!isActiveLoop(token)) {
    return;
  }

  stagePresentation = animation.finalFrame;
  render();
  await waitBeats(SUPER_FINAL_LINGER_BEATS, token);
}

function settleTutorialScene() {
  if (tutorialStageMode !== 'scene') {
    return;
  }

  if (state.status === 'finished') {
    setNewTutorialRound();
  }
}

async function maybeShowRoundOverScene(token) {
  if (!isActiveLoop(token) || state.status !== 'finished') {
    return;
  }

  await waitBeats(ROUND_OVER_SCENE_BEATS, token);

  if (!isActiveLoop(token) || state.status !== 'finished') {
    return;
  }

  turnPhase = 'round-over';
  isTransitioning = true;
  await playWipeTransition(showRoundOverScene);
  isTransitioning = false;

  if (isActiveLoop(token)) {
    render();
  }
}

async function maybeShowTutorialFeedback(token) {
  if (!isActiveLoop(token) || tutorialStageMode !== 'scene' || !tutorialPendingFeedbackMarkup) {
    return;
  }

  await waitBeats(2, token);

  if (!isActiveLoop(token) || tutorialStageMode !== 'scene' || !tutorialPendingFeedbackMarkup) {
    return;
  }

  isTransitioning = true;
  await playWipeTransition(() => {
    const feedbackMarkup = tutorialPendingFeedbackMarkup;

    if (isGameOver()) {
      tutorialFeedbackMarkup = '';
      tutorialPendingFeedbackMarkup = '';
      tutorialStageMode = 'scene';
      turnPhase = 'round-over';
      showRoundOverScene();
      return;
    }

    if (state.status === 'finished') {
      setNewTutorialRound();
    }

    tutorialFeedbackMarkup = feedbackMarkup;
    tutorialPendingFeedbackMarkup = '';
    tutorialStageMode = 'feedback';
    render();
  });
  isTransitioning = false;

  if (isActiveLoop(token)) {
    render();
  }
}

function showRoundOverScene() {
  if (state.winner && screen !== 'tutorial') {
    roundWins[state.winner] += 1;
  }
  syncMusicTopper();

  if (playMode === 'local' && screen !== 'tutorial' && !isGameOver()) {
    if (state.winner === 'p1') {
      queueMusicTrackOnce('sax', 'game');
    }
  }

  const isRoundOverInComputerFight = playMode === 'local' && screen !== 'tutorial' && !isGameOver();

  stagePresentation = {
    kind: 'doodle',
    name: getRoundOverDoodle(state.winner, isRoundOverInComputerFight),
    flip: false,
  };
  render();
}

function getRoundOverDoodle(winner, useRoundDoodle) {
  if (winner === 'p1') {
    return useRoundDoodle ? 'system_scenes/round_won' : 'system_scenes/game_won';
  }

  return useRoundDoodle ? 'system_scenes/round_lost' : 'system_scenes/game_lost';
}

function setNewTutorialRound() {
  state = createRoundState();
  state = {
    ...state,
    players: {
      p1: {
        ...state.players.p1,
        resource: 0,
        bullets: 0,
      },
      p2: {
        ...state.players.p2,
        resource: 0,
        bullets: 0,
      },
    },
  };
  turnPhase = 'scene';
  p1QueuedMove = null;
  resetStageAudioKey();
  lastMoves = {
    p1: 'reload',
    p2: 'reload',
  };
  stagePresentation = getIdleStagePresentation();
  render();
}

function getWinStacks(wins) {
  const stacks = [];
  let remaining = wins;

  while (remaining > 0) {
    const stack = Math.min(5, remaining);
    stacks.push(stack);
    remaining -= stack;
  }

  return stacks;
}

function getFallbackMove(playerId) {
  const legalMoves = getPlayerLegalMoves(state, playerId);
  return legalMoves.includes('reload') ? 'reload' : legalMoves[0];
}


function playWipeTransition(onCovered) {
  return playStarburstWipeTransition(app, onCovered, () => playOneShotAudio(STARBURST_WIPE_AUDIO));
}

function playCurtainMenuTransition(onCovered) {
  return playCurtainWipeTransition(app, onCovered, {
    playCloseAudio: playCurtainCloseAudio,
    playOpenAudio: playCurtainOpenAudio,
  });
}

function playCurtainCloseAudio() {
  playOneShotAudio(CURTAIN_CLOSE_AUDIO);
}

function playCurtainOpenAudio() {
  playOneShotAudio(CURTAIN_OPEN_AUDIO);
}
