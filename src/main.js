import {
  DEFAULT_VARIANT_ID,
  MAX_BULLETS,
  MOVES,
  VARIANT_IDS,
  getVariantMoveIds,
  getVariantLabel,
  getVariantResourceMax,
  getVariantStartResource,
  getVariantTargetRoundWins,
} from './engine/moves.js';
import { createRoundState, getPlayerLegalMoves, getPlayerResource, playTurn } from './engine/gameState.js';
import { resolveTurn } from './engine/resolveTurn.js';
import { chooseRivalMove as chooseAiMove } from './engine/rivalAi.js';
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
  setMusicVolume,
  setSoundEnabled,
  setSfxVolume,
  syncMusicTopper,
  unlockSceneAudio,
  WIN_SOUND_AUDIO,
} from './audio.js';
import { RankedClient, RankedUpdateQueue } from './rankedClient.js';
import { getServerHttpUrl } from './serverUrl.js';
import { OnlineFlowDirector } from './presentation/onlineFlowDirector.js';
import { interpretOnlineSnapshot } from './presentation/onlineFlowSequences.js';
import { GameFlowDirector } from './presentation/gameFlowDirector.js';
import { createTitleScreen } from './presentation/titleScreen.js';
import { createVariantSelectScreen } from './presentation/variantSelectScreen.js';
import { createLobbyScreen } from './presentation/lobbyScreen.js';
import { getResourcePresentation, shouldShowPickHistoryForVariant } from './variantPresentation.js';
import { resolveReadyScene, resolveScene, swapScenePerspective } from './sceneResolver.js';
import { VARIANT_SELECT_PAGE_SIZE, VARIANT_SELECT_VARIANTS } from './variantSelectConfig.js';
import nameGeneratorData from './nameGeneratorData.json' with { type: 'json' };
import {
  DOODLE_FRAME_RATE,
  DOODLE_FRAME_COUNT,
  DOODLE_FRAME_HEIGHT,
  DOODLE_FRAME_WIDTH,
  getVariantStagePresentation,
  getVariantSuperAnimation,
  getRendererPreloadDoodles,
  mountCountdownOverlays,
  mountBanAnimations,
  mountReadyWaitingOverlays,
  mountWaitingDotsOverlays,
  mountSpriteRenderers,
  mountNineSliceRenderers,
  closeCurtainWipe,
  openCurtainWipe,
  pauseRendererClock,
  playCurtainWipeTransition,
  playStarburstWipeTransition,
  preloadDoodleSheets,
  READY_WAITING_SAFE_PHASE_MS,
  resumeClosedCurtainBoil,
  resumeRendererClock,
  setBoilEnabled,
} from './renderer.js';
import { createAlertSystem } from './alertSystem.js';
import { createLayoutLoader, DEFAULT_LAYOUT_STATE_ID } from './layoutLoader.js';
import { createLobbyWhiteboard, LOBBY_BOARD_COLORS } from './lobbyWhiteboard.js';

const BEAT_MS = 750;
const BAN_ANIMATION_DURATION_MS = 7 * 58;
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
const TITLE_BUTTON_FRAME_WIDTH = 256;
const TITLE_BUTTON_FRAME_HEIGHT = 128;
const VARIANT_BUTTON_FRAME_WIDTH = 325;
const VARIANT_BUTTON_FRAME_HEIGHT = 128;
const ONLINE_HEADER_FRAME_WIDTH = 1518;
const ONLINE_HEADER_FRAME_HEIGHT = 512;
const BAN_HEADER_FRAME_WIDTH = 910;
const BAN_HEADER_FRAME_HEIGHT = 512;
const TUTORIAL_MAIN_SLIDE_COUNT = 6;
const TUTORIAL_REVEAL_SLIDE_INDEX = 5;
const TUTORIAL_TIPS_SLIDE_COUNT = 3;
const REMATCH_BUTTON_FRAME_WIDTH = 256;
const REMATCH_BUTTON_FRAME_HEIGHT = 128;
const BULLET_SLOT_COUNT = MAX_BULLETS;
const LAST_NUMBERED_TURN = 21;
const FRAME_WIDTH = 960;
const FRAME_HEIGHT = 540;
const PORTRAIT_FRAME_WIDTH = 540;
const PORTRAIT_FRAME_HEIGHT = 960;
const VARIANT_LAYOUT_URLS = Object.freeze({
  [VARIANT_IDS.tapTapShootY]: './assets/tap-tap-shoot-y/tap-tap-shoot-y-layout.json',
  [VARIANT_IDS.rockPaperScissors]: './assets/rock-paper-scissors/rock-paper-scissors-layout.json',
  [VARIANT_IDS.fireballWar]: './assets/fireball-war/fireball-war-layout.json',
  [VARIANT_IDS.gunKnifeFist]: './assets/gun-knife-fist/gun-knife-fist-layout.json',
  [VARIANT_IDS.tapTapShootX]: './assets/tap-tap-shoot-x/tap-tap-shoot-x-layout.json',
});
const DISADVANTAGED_LAYOUT_STATE_ID = 'playing.disadvantaged';
const BETWEEN_ROUND_LAYOUT_STATE_ID = 'round.between';
const GAME_OVER_LAYOUT_STATE_ID = 'round.game-over';
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
const TITLE_ALERT_SHOWCASE = Object.freeze([
  Object.freeze({ width: 320, height: 150, label: '320 by 150 alert', message: '320 × 150' }),
  Object.freeze({ width: 440, height: 190, label: '440 by 190 alert', message: '440 × 190' }),
  Object.freeze({ width: 560, height: 240, label: '560 by 240 alert', message: '560 × 240' }),
  Object.freeze({ width: 700, height: 310, label: '700 by 310 alert', message: '700 × 310' }),
  Object.freeze({ width: 840, height: 400, label: '840 by 400 alert', message: '840 × 400' }),
]);
const ENABLE_TITLE_ALERT_SHOWCASE = false;
const ONLINE_STATUS_POLL_MS = 5000;
const RANKED_DISPLAY_NAME_KEY = 'tapTapShootX.rankedDisplayName';
const BOIL_ENABLED_KEY = 'tapTapShootX.boilEnabled';
const MUSIC_VOLUME_KEY = 'tapTapShootX.musicVolume';
const SFX_VOLUME_KEY = 'tapTapShootX.sfxVolume';
const DEFAULT_RANKED_DISPLAY_NAME = 'Guest';
const MAX_RANKED_DISPLAY_NAME_LENGTH = 50;
const DEFAULT_MOVE_BUTTON_DOODLES = Object.freeze({
  rock: 'rock-paper-scissors/rock_button',
  paper: 'rock-paper-scissors/paper_button',
  scissors: 'rock-paper-scissors/scissors_button',
  charge: 'fireball-war/charge_button',
  block: 'fireball-war/block_button',
  fireball: 'fireball-war/fireball_button',
  punch: 'gun-knife-fist/fist_button',
  reload: 'tap-tap-shoot-y/reload_button',
  shoot: 'tap-tap-shoot-y/shoot_button',
  stab: 'tap-tap-shoot-y/stab_button',
  duck: 'tap-tap-shoot-y/duck_button',
  counterstab: 'tap-tap-shoot-x/counterstab_button',
});
const VARIANT_MOVE_BUTTON_DOODLES = Object.freeze({
  [VARIANT_IDS.gunKnifeFist]: Object.freeze({
    punch: 'gun-knife-fist/fist_button',
    stab: 'gun-knife-fist/knife_button',
    shoot: 'gun-knife-fist/gun_button',
  }),
  [VARIANT_IDS.tapTapShootY]: Object.freeze({
    reload: 'tap-tap-shoot-y/reload_button',
    shoot: 'tap-tap-shoot-y/shoot_button',
    stab: 'tap-tap-shoot-y/stab_button',
    duck: 'tap-tap-shoot-y/duck_button',
  }),
  [VARIANT_IDS.tapTapShootX]: Object.freeze({
    reload: 'tap-tap-shoot-x/charge_ap_button',
    shoot: 'tap-tap-shoot-x/shoot_ap_button',
    stab: 'tap-tap-shoot-x/stab_ap_button',
    duck: 'tap-tap-shoot-x/duck_button',
    counterstab: 'tap-tap-shoot-x/counterstab_button',
  }),
});
const MOVE_ICON_DOODLES = Object.freeze({
  rock: 'rock-paper-scissors/rock_button',
  paper: 'rock-paper-scissors/paper_button',
  scissors: 'rock-paper-scissors/scissors_button',
  charge: 'fireball-war/charge icon',
  block: 'fireball-war/block_button',
  fireball: 'fireball-war/fireball_button',
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
const COMPUTER_VARIANTS = VARIANT_SELECT_VARIANTS;
const COMPUTER_VARIANT_IDS = Object.freeze(COMPUTER_VARIANTS.map((variant) => variant.id));

const app = document.querySelector('#app');
const alertSystem = createAlertSystem({
  root: app,
  mountSprites: mountSpriteRenderers,
  mountNineSlices: mountNineSliceRenderers,
});
let hasShownTitleAlertShowcase = false;

function getSharpCanvasContext(canvas) {
  const context = canvas?.getContext('2d');
  if (context) {
    context.imageSmoothingEnabled = false;
  }
  return context;
}

let state = createRoundState();
let screen = 'title';
let playMode = 'local';
let selectedVariantId = DEFAULT_VARIANT_ID;
let variantSelectPage = 0;
let variantDifficultyToggleState = 'easy';
let isTransitioning = false;
let transitionGeneration = 0;
let variantDetailMenu = null;
const completedBanAnimationVariants = new Set();
let isMusicEnabled = false;
let isSoundEnabled = false;
let isBoilEnabled = readStoredBoilEnabled();
let musicVolume = readStoredVolume(MUSIC_VOLUME_KEY);
let sfxVolume = readStoredVolume(SFX_VOLUME_KEY);
let pauseMenu = null;
let gameplayRulesOpen = false;
let pauseStartedAt = null;
const pausableTimers = new Set();
let loopToken = 0;
let turnPhase = 'idle';
let p1QueuedMove = null;
let localTurnChoice = null;
let localRoundTimedOutPlayer = null;
let rankedSnapshot = null;
let ignoredRankedMatchId = null;
let matchmakingStatus = 'idle';
const rankedUpdateQueue = new RankedUpdateQueue();
let pendingSuperAnimation = null;
let isApplyingRankedSnapshot = false;
let rankedReadyWaiting = null;
let rankedReadyWaitingTimer = null;
let rankedRoundAudioKey = null;
let rankedConnectionNotice = null;
let rankedDisconnectReturnTimer = null;
let rankedDisplayName = readStoredDisplayName();
let onlinePlayerCount = null;
let debugTools = {
  winGame: false,
  revealComputerMove: false,
  sceneGallery: false,
};
let onlineStatusTimer = null;
let lobbySelf = null;
let lobbyPlayers = [];
let lobbyMessages = [];
let lobbyChallenge = null;
let lobbyChallengeStatus = null;
let lobbySelectedPlayerId = null;
let lobbyUnreadCount = 0;
let lobbyConnected = false;
let lobbyRosterOpen = false;
let tutorialSlideIndex = 0;
let tutorialTipsSlideIndex = 0;
let tutorialStageMode = 'slide';
let tutorialFeedbackMarkup = '';
let tutorialPendingFeedbackMarkup = '';
let stagePresentation = getIdleStagePresentation();
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
  onError: handleRankedError,
  onLobbyState: handleLobbyState,
  onRoster: handleLobbyRoster,
  onChat: handleLobbyChat,
  onBoardOperation: handleLobbyBoardOperation,
  onBoardTrim: handleLobbyBoardTrim,
  onBoardReset: handleLobbyBoardReset,
  onChallenge: handleLobbyChallenge,
});
const layoutLoader = createLayoutLoader({
  layoutUrls: VARIANT_LAYOUT_URLS,
  defaultVariantId: DEFAULT_VARIANT_ID,
});
const lobbyWhiteboard = createLobbyWhiteboard({
  root: app,
  isActive: () => screen === 'lobby',
  isBoilEnabled: () => isBoilEnabled,
  mountSprites: mountSpriteRenderers,
  sendStroke: (points, color) => rankedClient.sendBoardStroke(points, color),
  sendErase: (points) => rankedClient.sendBoardErase(points),
  frameRate: DOODLE_FRAME_RATE,
  frameCount: DOODLE_FRAME_COUNT,
});
const titleScreen = createTitleScreen({
  app,
  getState: () => ({ isSoundEnabled, isBoilEnabled, musicVolume, sfxVolume, rankedDisplayName }),
  getSharpCanvasContext,
  loadImageAsset,
  mountSpriteRenderers,
  requestMusicTrack,
  renderOnlinePlayerCount,
  startOnlineStatusPolling,
  enterLobby: enterLobbyFromTitle,
  generateName: generateTitleName,
  toggleSound,
  toggleBoil,
  enableAudio: enableAudioFromSlider,
  setVolume: setTitleVolume,
  escapeHtml,
  maxDisplayNameLength: MAX_RANKED_DISPLAY_NAME_LENGTH,
  showAlertShowcase: () => {
    if (!ENABLE_TITLE_ALERT_SHOWCASE || hasShownTitleAlertShowcase) return;
    hasShownTitleAlertShowcase = true;
    alertSystem.show(TITLE_ALERT_SHOWCASE);
  },
});
const variantSelectScreen = createVariantSelectScreen({
  app,
  variants: COMPUTER_VARIANTS,
  pageSize: VARIANT_SELECT_PAGE_SIZE,
  getPage: () => variantSelectPage,
  setPage: (page) => { variantSelectPage = page; },
  getDifficulty: () => variantDifficultyToggleState,
  setDifficulty: (difficulty) => { variantDifficultyToggleState = difficulty; },
  escapeHtml,
  mountSpriteRenderers,
  requestMusicTrack,
  onSelectVariant: showVariantDetail,
  onBack: returnToLobbyFromOpponentSelect,
  onCloseDetail: closeVariantDetail,
});
const lobbyScreen = createLobbyScreen({
  app,
  boardColors: LOBBY_BOARD_COLORS,
  whiteboard: lobbyWhiteboard,
  getState: () => ({
    connected: lobbyConnected,
    players: lobbyPlayers,
    self: lobbySelf,
    rosterOpen: lobbyRosterOpen,
    matchmakingStatus,
    selectedPlayerId: lobbySelectedPlayerId,
    challenge: lobbyChallenge,
    challengeStatus: lobbyChallengeStatus,
  }),
  setRosterOpen: (open) => { lobbyRosterOpen = open; },
  escapeHtml,
  renderSettingsControls: titleScreen.renderSettingsControls,
  installSettingsHandlers: titleScreen.installSettingsHandlers,
  renderOpenCurtainBorder: variantSelectScreen.renderOpenCurtainBorder,
  mountSpriteRenderers,
  stopOnlineStatusPolling,
  requestMusicTrack,
  onOpenPlayer: openLobbyPlayer,
  onToggleMatchmaking: toggleMatchmaking,
  onOpenPractice: () => openLobbyPlayer('computer'),
  onOpenSettings: openPauseMenu,
  onBack: returnToTitleFromLobby,
  onCloseOverlay: () => { lobbySelectedPlayerId = null; render(); },
  onChallengePlayer: (playerId) => rankedClient.challengePlayer(playerId),
  onSendChat: (message, color) => rankedClient.sendChat(message, color),
  onRespondChallenge: (challengeId, accept) => rankedClient.respondChallenge(challengeId, accept),
  onCancelChallenge: (challengeId) => rankedClient.cancelChallenge(challengeId),
  onCloseChallenge: () => { lobbyChallenge = null; lobbyChallengeStatus = null; render(); },
});
const onlineFlowDirector = new OnlineFlowDirector({
  closeCurtains: (onCreate) => closeCurtainWipe(app, playCurtainCloseAudio, 'online-flow-curtain', onCreate),
  openCurtains: (curtain) => openCurtainWipe(curtain, playCurtainOpenAudio),
  reattachCurtain: (curtain) => app.append(curtain),
  spikeWipe: (nextStage) => playWipeTransition(() => {
    screen = nextStage;
    render();
  }),
  waitBeats: (beats) => waitMsWithoutToken(beats * BEAT_MS),
  waitBanAnimation: () => waitMsWithoutToken(BAN_ANIMATION_DURATION_MS),
  revealTiebreaker: (snapshot) => {
    const variantId = snapshot?.remainingVariants?.[0] ?? snapshot?.variantId;
    [...app.querySelectorAll('[data-pick-variant]')]
      .find((button) => button.dataset.pickVariant === variantId)
      ?.classList.add('tiebreaker-reveal');
  },
  commit: commitRankedSnapshot,
  show: (stage) => {
    if (stage === 'title' || (stage === 'scoreboard' && rankedSnapshot?.phase !== 'gameOver')) {
      requestMusicTrack('title');
    }
    screen = stage;
    render();
  },
  openingCues: () => {
    requestMusicTrack('game');
    beginOpeningCues();
  },
  disconnect: () => {},
  exitRanked: resetRankedSession,
});
const gameFlowDirector = new GameFlowDirector({
  playSuper: (animation) => playSuperAnimation(animation, loopToken),
  waitBeats: (beats) => waitBeats(beats, loopToken),
  showResult: showDirectedLocalResult,
  advanceRound: advanceLocalRoundPreservingReveal,
});

configureAudio({ getMusicTopperFile });
setBoilEnabled(isBoilEnabled);
setMusicVolume(musicVolume);
setSfxVolume(sfxVolume);

updateFrameScale();
window.addEventListener('resize', handleViewportResize);
window.visualViewport?.addEventListener('resize', handleViewportResize);
window.addEventListener('keydown', handleGlobalKeydown);
window.addEventListener('pointermove', lobbyWhiteboard.followTool);
window.addEventListener('pointerdown', lobbyWhiteboard.releaseToolOutside, true);
installAudioUnlockListeners();
boot();

async function boot() {
  const loadingScreen = renderLoadingScreen();
  let loadingImages = null;
  const gameLayoutPromise = layoutLoader.preloadAll()
    .then(() => {
      gameLayout = layoutLoader.getCached(DEFAULT_VARIANT_ID);
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
  const debugToolsPromise = loadDebugTools();

  const minimumLoadingPromise = loadingImagesPromise.then(() => waitMsWithoutToken(LOADING_DURATION_MS));

  await Promise.all([preloadPromise, minimumLoadingPromise, gameLayoutPromise, debugToolsPromise]);
  stopLoadingScreen(loadingScreen, loadingImages);
  await waitForLoadingStart(loadingScreen);

  try {
    unlockSceneAudio();
    screen = 'title';
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
  const progressContext = getSharpCanvasContext(loadingScreen.progressCanvas);
  const clickMessageContext = getSharpCanvasContext(loadingScreen.clickMessageCanvas);
  const currentBoilFrame = loadingScreen.isDone
    ? LOADING_FRAME_COUNT - 1
    : getLoadingBoilFrame(elapsed);

  if (!loadingScreen.isDone && elapsed >= LOADING_DURATION_MS) {
    removeLoadingBoil(loadingScreen);
  }

  if (loadingScreen.boilImage && images.boilFrames?.[currentBoilFrame]) {
    loadingScreen.boilImage.src = images.boilFrames[currentBoilFrame].src;
  }

  if (!progressContext || !images.barEmpty || !images.barFull) {
    return;
  }

  const barFrame = getLoadingBarFrame(now);
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

function getLoadingBoilFrame(elapsed) {
  if (!isBoilEnabled) {
    return 0;
  }

  return Math.min(LOADING_FRAME_COUNT - 1, Math.floor((elapsed / 1000) * LOADING_FRAME_RATE));
}

function getLoadingBarFrame(now) {
  if (!isBoilEnabled) {
    return 0;
  }

  return Math.floor((now / 1000) * LOADING_BAR_FRAME_RATE) % LOADING_BAR_FRAME_COUNT;
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
    'back_button_w',
    'rules_button',
    'continue_button',
    'continue_t_button',
    'next_slide_button',
    'Prev_slide_button',
    'quit_button',
    'leave_button',
    'stop_button',
    'burger_button',
    'reload-to-stab_arrow',
    'right_red',
    'down-right_red',
    'up-right_red',
    'down-left_red',
    'up_blue',
    'left_red',
    'down-right_blue',
    'left_blue',
    'rematch_button',
    'tips_button',
    'wins_label',
    'you_picked',
    'they_picked',
    'vs-sm',
    'timeout_button',
    'system_scenes/game_won',
    'system_scenes/game_lost',
    'system_scenes/no_contest',
    'system_scenes/round_won',
    'system_scenes/round_lost',
    'tip1graphic',
    'tip2graphicgraphic',
    'new-logo-rev-2-alpha',
    'name_button',
    'lobby_button',
    'title/playvcom_button',
    'title/playonline',
    'title/sound_button',
    'title/sound_button_checked',
    'title/Music_slider',
    'title/sfx_slider',
    'title/graidant_slider',
    'title/boiling_toggle_on',
    'title/boiling_toggle_off',
    'easy_hard_toggle-easy',
    'easy_hard_toggle-hard',
    'variant_play_button',
    'select_button',
    ...COMPUTER_VARIANTS.map((variant) => variant.buttonDoodle),
    ...getMoveButtonDoodlesForPreload(),
    ...Object.values(MOVE_ICON_DOODLES),
    ...getResourceDoodlesForPreload(),
    ...Array.from({ length: LAST_NUMBERED_TURN + 1 }, (_, turn) => `turn${turn}`),
    'turnlostcount',
    ...Array.from({ length: 6 }, (_, index) => `ft5-w${index}`),
    ...Array.from({ length: 4 }, (_, index) => `ft3-win-counter-${index}`),
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

  return document.fonts.load('16px "Architects Daughter"').then(() => undefined, () => undefined);
}

async function loadGameLayoutForVariant(variantId) {
  return layoutLoader.load(variantId);
}

async function setActiveGameLayoutForVariant(variantId) {
  gameLayout = await loadGameLayoutForVariant(variantId);
  updateFrameScale();
}

function setCachedActiveGameLayoutForVariant(variantId) {
  gameLayout = layoutLoader.getCached(variantId);
  updateFrameScale();
}

function getViewportSize() {
  const bodyStyle = getComputedStyle(document.body);
  const leftInset = parseFloat(bodyStyle.paddingLeft) || 0;
  const rightInset = parseFloat(bodyStyle.paddingRight) || 0;
  const topInset = parseFloat(bodyStyle.paddingTop) || 0;
  const bottomInset = parseFloat(bodyStyle.paddingBottom) || 0;
  const visualViewport = window.visualViewport;
  const viewportWidth = visualViewport?.width ?? window.innerWidth;
  const viewportHeight = visualViewport?.height ?? window.innerHeight;
  const width = Math.max(1, viewportWidth - leftInset - rightInset);
  const height = Math.max(1, viewportHeight - topInset - bottomInset);
  return {
    width,
    height,
    centerX: (visualViewport?.offsetLeft ?? 0) + leftInset + (width / 2),
    centerY: (visualViewport?.offsetTop ?? 0) + topInset + (height / 2),
  };
}

function shouldUsePortraitLayout() {
  const viewport = getViewportSize();
  return screen === 'playing' && viewport.height > viewport.width;
}

function getViewportFrame() {
  if (shouldUsePortraitLayout()) {
    return {
      width: gameLayout?.portraitWidth ?? PORTRAIT_FRAME_WIDTH,
      height: gameLayout?.portraitHeight ?? PORTRAIT_FRAME_HEIGHT,
      mode: 'portrait',
    };
  }

  return {
    width: gameLayout?.width ?? FRAME_WIDTH,
    height: gameLayout?.height ?? FRAME_HEIGHT,
    mode: 'landscape',
  };
}

function updateFrameScale() {
  const viewport = getViewportSize();
  const { width: frameWidth, height: frameHeight, mode } = getViewportFrame();
  const availableWidth = viewport.width;
  const availableHeight = viewport.height;
  const fitScale = Math.min(availableWidth / frameWidth, availableHeight / frameHeight);
  const scale = Math.max(0.01, fitScale);
  app.style.width = `${frameWidth}px`;
  app.style.height = `${frameHeight}px`;
  app.style.setProperty('--viewport-center-x', `${viewport.centerX}px`);
  app.style.setProperty('--viewport-center-y', `${viewport.centerY}px`);
  app.dataset.viewportMode = mode;
  app.style.setProperty('--ui-scale', scale.toFixed(4));
}

function handleViewportResize() {
  const previousMode = app.dataset.viewportMode;
  updateFrameScale();
  if (previousMode && previousMode !== app.dataset.viewportMode && app.childElementCount) render();
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
  const prefix = pickRandom(nameGeneratorData.prefixes);
  const main = pickRandom(nameGeneratorData.mains);
  const suffix = pickRandom(nameGeneratorData.suffixes).replace('####', generateDigitString(4));
  const pattern = Math.floor(Math.random() * 4);
  const parts = [
    [prefix, main, suffix],
    [prefix, main],
    [main, suffix],
    [prefix, suffix],
  ][pattern];
  const spacedName = parts.join(' ').replace(' ,', ',');
  const separator = spacedName.includes(',') ? ' ' : pickRandom(nameGeneratorData.separators);
  const name = spacedName.replaceAll(' ', separator);

  if (Math.random() < 0.75) {
    return name;
  }

  return pickRandom(nameGeneratorData.brackets).replace('{name}', name);
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

function readStoredBoilEnabled() {
  try {
    return window.localStorage.getItem(BOIL_ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writeStoredBoilEnabled(value) {
  try {
    window.localStorage.setItem(BOIL_ENABLED_KEY, value ? 'true' : 'false');
  } catch {
    // Game still works for this tab; it just cannot remember the setting.
  }
}

function readStoredVolume(key) {
  try {
    const volume = Number(window.localStorage.getItem(key));
    return Number.isFinite(volume) ? clampVolume(volume) : 1;
  } catch {
    return 1;
  }
}

function writeStoredVolume(key, value) {
  try {
    window.localStorage.setItem(key, String(clampVolume(value)));
  } catch {
    // Game still works for this tab; it just cannot remember the setting.
  }
}

function clampVolume(value) {
  const volume = Number(value);

  if (!Number.isFinite(volume)) {
    return 1;
  }

  return Math.max(0, Math.min(1, volume));
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

  if (variantDetailMenu) {
    event.preventDefault();
    closeVariantDetail();
    return;
  }

  if (screen === 'opponent-select' && !isTransitioning) {
    event.preventDefault();
    returnToLobbyFromOpponentSelect();
    return;
  }

  if (screen === 'lobby' && (lobbySelectedPlayerId || lobbyChallenge)) {
    event.preventDefault();
    lobbySelectedPlayerId = null;
    lobbyChallenge = null;
    lobbyChallengeStatus = null;
    render();
    return;
  }

  if (screen === 'lobby' && !isTransitioning) {
    event.preventDefault();
    openPauseMenu();
    return;
  }

  if (!canOpenPauseMenu()) {
    return;
  }

  event.preventDefault();
  openPauseMenu();
}

function canOpenPauseMenu() {
  return ['lobby', 'playing'].includes(screen)
    && !isTransitioning
    && !pauseMenu;
}

async function openPauseMenu() {
  if (!canOpenPauseMenu()) {
    return;
  }

  const menuScreen = screen;
  if (menuScreen === 'playing') pauseGameplayTimers();
  isTransitioning = true;
  const curtain = await closeCurtainWipe(app, playCurtainCloseAudio);

  if (screen !== menuScreen) {
    curtain.remove();
    isTransitioning = false;
    if (menuScreen === 'playing') resumeGameplayTimers();
    return;
  }

  const overlay = renderPauseMenu(menuScreen);
  pauseMenu = { curtain, overlay, screen: menuScreen };
}

async function closePauseMenu() {
  const menu = pauseMenu;

  if (!menu) {
    return;
  }

  pauseMenu = null;
  menu.overlay.remove();
  await openCurtainWipe(menu.curtain, playCurtainOpenAudio);
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
  isTransitioning = false;
  if (menu.screen === 'playing') resumeGameplayTimers();
}

function renderPauseMenu(menuScreen) {
  const overlay = document.createElement('div');
  overlay.className = 'pause-menu-overlay';
  overlay.innerHTML = `
    <div class="pause-menu" role="dialog" aria-modal="true" aria-label="Pause menu">
      ${titleScreen.renderSettingsControls()}
      <div class="pause-menu-actions">
        ${menuScreen === 'lobby'
          ? renderSheetButton('pause-back', 'back_button_w', 'Back', 'pause-sheet-button')
          : `${renderSheetButton('pause-quit', 'quit_button', 'Quit', 'pause-sheet-button')}${renderSheetButton('pause-continue', 'continue_button', 'Continue', 'pause-sheet-button')}`}
        ${matchmakingStatus === 'searching' ? renderSheetButton('pause-stop-matchmaking', 'stop_button', 'Stop matchmaking', 'pause-sheet-button') : ''}
      </div>
    </div>
  `;
  app.append(overlay);
  titleScreen.installSettingsHandlers(overlay, refreshPauseMenuSettings);
  overlay.querySelector('[data-action="pause-back"]')?.addEventListener('click', closePauseMenu);
  overlay.querySelector('[data-action="pause-continue"]')?.addEventListener('click', closePauseMenu);
  overlay.querySelector('[data-action="pause-quit"]')?.addEventListener('click', renderPauseQuitConfirmation);
  overlay.querySelector('[data-action="pause-stop-matchmaking"]')?.addEventListener('click', stopMatchmakingFromPauseMenu);
  mountSpriteRenderers(overlay.querySelectorAll('.sprite-canvas'));
  if (menuScreen === 'playing') resumeRendererClock();
  overlay.querySelector('.pause-menu-actions button')?.focus();
  return overlay;
}

function stopMatchmakingFromPauseMenu(event) {
  matchmakingStatus = 'idle';
  rankedClient.setReady(false);
  event.currentTarget.remove();
  lobbyScreen.syncMatchmakingIndicator();
}

function renderPauseQuitConfirmation() {
  const menu = pauseMenu;
  if (!menu || menu.screen !== 'playing') return;
  menu.overlay.innerHTML = `
    <div class="pause-menu pause-confirmation" role="alertdialog" aria-modal="true" aria-label="Forfeit game">
      <p>Forfeit game and return to lobby?</p>
      <div class="pause-menu-actions">
        ${renderSheetButton('pause-cancel-quit', 'back_button_w', 'Back', 'pause-sheet-button')}
        ${renderSheetButton('pause-confirm-quit', 'leave_button', 'Leave', 'pause-sheet-button')}
      </div>
    </div>
  `;
  menu.overlay.querySelector('[data-action="pause-cancel-quit"]').addEventListener('click', () => {
    const replacement = renderPauseMenu(menu.screen);
    menu.overlay.replaceWith(replacement);
    menu.overlay = replacement;
  });
  menu.overlay.querySelector('[data-action="pause-confirm-quit"]').addEventListener('click', quitFromPauseMenu);
  mountSpriteRenderers(menu.overlay.querySelectorAll('.sprite-canvas'));
  menu.overlay.querySelector('[data-action="pause-cancel-quit"]').focus();
}

function refreshPauseMenuSettings() {
  const controls = pauseMenu?.overlay.querySelector('.settings-controls');

  if (!controls) {
    return;
  }

  controls.outerHTML = titleScreen.renderSettingsControls();
  titleScreen.installSettingsHandlers(pauseMenu.overlay, refreshPauseMenuSettings);
  mountSpriteRenderers(pauseMenu.overlay.querySelectorAll('.sprite-canvas'));
}

async function quitFromPauseMenu() {
  const menu = pauseMenu;

  if (!menu) {
    return;
  }

  pauseMenu = null;
  menu.overlay.remove();
  if (playMode === 'online') {
    ignoredRankedMatchId = rankedSnapshot?.matchId ?? null;
    rankedClient.forfeitMatch(rankedSnapshot);
    resetRankedSession();
  } else {
    resetLocalMatchToLobby();
  }
  screen = 'lobby';
  render();
  app.append(menu.curtain);
  await openCurtainWipe(menu.curtain, playCurtainOpenAudio);
  isTransitioning = false;
  resumeGameplayTimers();
}

function resetLocalMatchToLobby() {
  requestMusicTrack('title');
  unlockSceneAudio();
  loopToken += 1;
  clearLocalTurnChoice();
  clearPausableTimers();
  resetRoundWins();
  playMode = 'local';
  turnPhase = 'idle';
  state = createRoundState();
  p1QueuedMove = null;
  rankedSnapshot = null;
  pendingSuperAnimation = null;
  stagePresentation = getIdleStagePresentation();
  rankedClient.setPresence('idle');
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
  updateFrameScale();
  queueMicrotask(lobbyScreen.syncMatchmakingIndicator);
  queueMicrotask(() => onlineFlowDirector.syncLayers());

  const activePauseMenu = pauseMenu;
  if (activePauseMenu) {
    queueMicrotask(() => {
      if (pauseMenu !== activePauseMenu) return;
      app.append(activePauseMenu.curtain, activePauseMenu.overlay);
      resumeClosedCurtainBoil(activePauseMenu.curtain);
    });
  }

  if (screen !== 'playing') {
    gameplayRulesOpen = false;
  }

  if (screen === 'title') {
    titleScreen.render();
    return;
  }

  if (screen === 'lobby') {
    lobbyScreen.render();
    return;
  }

  if (screen === 'scene-gallery') {
    renderSceneGallery();
    return;
  }

  if (screen === 'opponent-select') {
    variantSelectScreen.render();
    return;
  }

  if (screen === 'scoreboard') {
    renderScoreboardScreen();
    return;
  }

  if (screen === 'tutorial') {
    renderTutorialScreen();
    return;
  }

  const legalMoves = new Set(getCurrentLegalMoves());

  if (playMode === 'online' && rankedSnapshot?.phase === 'variantSelection') {
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
      ${renderSkipGameButton()}
      ${renderResetButton()}
    </section>
    ${renderRankedDisconnectNotice()}
  `;

  installMoveButtonHandlers();

  app.querySelector('[data-action="continue"]')?.addEventListener('click', continueGame);
  app.querySelector('[data-action="rematch"]')?.addEventListener('click', restartGame);
  app.querySelector('[data-action="quit"]')?.addEventListener('click', quitLocalGame);
  app.querySelector('[data-action="skip-game"]')?.addEventListener('click', skipRankedGame);
  app.querySelector('[data-action="reset"]')?.addEventListener('click', restartGame);
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
  const picks = rankedSnapshot.variantPicks ?? rankedSnapshot.bans ?? {};
  const pickedVariants = new Set(Object.values(picks));
  const bannedVariants = new Set(rankedSnapshot.bannedVariants ?? []);
  const playerPick = picks[rankedSnapshot.playerKey];
  const variants = getRankedVariantSelectVariants();
  const isTiebreakerBan = rankedSnapshot.variantSelectionRound === 2;
  const firstPickedVariant = picks[rankedSnapshot.variantPickOrder?.[0]];
  const headerDoodle = isTiebreakerBan
    ? 'header-ban-variant_sheet.webp'
    : firstPickedVariant
    ? 'header-second-variant_sheet.webp'
    : 'header-first-variant_sheet.webp';
  const headerWidth = isTiebreakerBan ? BAN_HEADER_FRAME_WIDTH : ONLINE_HEADER_FRAME_WIDTH;

  app.innerHTML = `
    <section class="title-screen opponent-select-screen variant-ban-screen ${isTiebreakerBan ? 'tiebreaker-ban-stage' : ''}" aria-label="${isTiebreakerBan ? 'Ban variant' : 'Pick variant'}">
      ${variantSelectScreen.renderOpenCurtainBorder()}

      <canvas
        class="sprite-canvas pick-variant-header online-stage-header"
        data-doodle-file="${headerDoodle}"
        data-frame-width="${headerWidth}"
        data-frame-height="${isTiebreakerBan ? BAN_HEADER_FRAME_HEIGHT : ONLINE_HEADER_FRAME_HEIGHT}"
        width="${headerWidth}"
        height="${isTiebreakerBan ? BAN_HEADER_FRAME_HEIGHT : ONLINE_HEADER_FRAME_HEIGHT}"
        aria-label="${isTiebreakerBan ? 'Ban variant' : 'Pick variant'}"
      ></canvas>

      <div class="variant-actions">
        ${variants.map((variant, index) => renderRankedVariantPickButton({
          variant,
          slot: index + 1,
          disabled: Boolean(playerPick) || pickedVariants.has(variant.id) || bannedVariants.has(variant.id),
          picked: pickedVariants.has(variant.id),
          banned: bannedVariants.has(variant.id),
          firstPicked: firstPickedVariant === variant.id,
          isTiebreakerBan,
        })).join('')}
        ${renderRankedQuitButton()}
      </div>
      ${isTiebreakerBan && rankedSnapshot.variantPickOrder?.[0] === rankedSnapshot.playerKey
        ? '<div class="tiebreaker-ban-waiting">Waiting for your opponent</div>'
        : ''}
    </section>
  `;

  app.querySelector('[data-action="quit"]')?.addEventListener('click', leaveRanked);
  app.querySelectorAll('[data-pick-variant]').forEach((button) => {
    button.addEventListener('click', () => {
      if (isTiebreakerBan) submitRankedVariantPick(button.dataset.pickVariant);
      else showRankedVariantDetail(button.dataset.pickVariant, button);
    });
  });
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
  mountReadyWaitingOverlays(app.querySelectorAll('.ranked-variant-ready'));
  app.querySelectorAll('.ranked-ban-animation').forEach((canvas) => {
    canvas.addEventListener('ban-animation-complete', () => {
      completedBanAnimationVariants.add(canvas.dataset.variantId);
    }, { once: true });
  });
  mountBanAnimations(app.querySelectorAll('.ranked-ban-animation'));
}

function renderScoreboardScreen() {
  const localName = rankedSnapshot?.players?.[rankedSnapshot.playerKey]?.displayName ?? rankedDisplayName;
  const opponentName = rankedSnapshot?.players?.[rankedSnapshot.opponentKey]?.displayName ?? 'Opponent';
  const pickedVariantIds = (rankedSnapshot?.variantPickOrder ?? [])
    .map((playerKey) => rankedSnapshot?.variantPicks?.[playerKey])
    .filter(Boolean);
  const completedVariantIds = (rankedSnapshot?.gameResults ?? [])
    .map((result) => result.variantId)
    .filter(Boolean);
  const orderedVariantIds = completedVariantIds.length >= 2
    ? completedVariantIds
    : pickedVariantIds;
  const [firstVariantId, secondVariantId] = orderedVariantIds.length >= 2
    ? orderedVariantIds
    : rankedSnapshot?.remainingVariants ?? [];
  const firstVariant = variantSelectScreen.getVariant(firstVariantId);
  const secondVariant = variantSelectScreen.getVariant(secondVariantId);
  const firstScore = getScoreboardVariantScore(firstVariantId);
  const secondScore = getScoreboardVariantScore(secondVariantId);
  const tiebreakerResult = rankedSnapshot?.gameResults?.[2] ?? null;
  const readyPlayerId = rankedSnapshot?.readyPlayerKey === rankedSnapshot?.playerKey ? 'p1'
    : rankedSnapshot?.readyPlayerKey === rankedSnapshot?.opponentKey ? 'p2'
      : null;
  app.innerHTML = `
    <section class="online-interstitial scoreboard-stage" aria-label="Scoreboard">
      ${variantSelectScreen.renderOpenCurtainBorder()}
      <div class="scoreboard-name scoreboard-name-left">
        ${escapeHtml(localName)}
      </div>
      <div class="scoreboard-name scoreboard-name-right">
        ${escapeHtml(opponentName)}
        ${renderScoreboardReady(readyPlayerId === 'p2')}
      </div>
      ${renderStaticDoodle('header-scoreboard', 1214, 256, 'scoreboard-header')}
      ${renderStaticDoodle('scoreboard', 960, 540, 'scoreboard-board')}
      <div class="scoreboard-games">
        <div class="scoreboard-game-row">
          ${renderScoreboardWinCounter(firstVariantId, firstScore.p1)}
          ${renderStaticDoodle(firstVariant.buttonDoodle, VARIANT_BUTTON_FRAME_WIDTH, VARIANT_BUTTON_FRAME_HEIGHT, 'scoreboard-variant-button')}
          ${renderScoreboardWinCounter(firstVariantId, firstScore.p2)}
        </div>
        <div class="scoreboard-game-row">
          ${renderScoreboardWinCounter(secondVariantId, secondScore.p1)}
          ${renderStaticDoodle(secondVariant.buttonDoodle, VARIANT_BUTTON_FRAME_WIDTH, VARIANT_BUTTON_FRAME_HEIGHT, 'scoreboard-variant-button')}
          ${renderScoreboardWinCounter(secondVariantId, secondScore.p2)}
        </div>
        ${renderScoreboardTiebreaker(tiebreakerResult)}
      </div>
      ${renderScoreboardAction(readyPlayerId === 'p1')}
      ${rankedSnapshot?.phase !== 'gameOver' && readyPlayerId === 'p1'
        ? '<div class="scoreboard-waiting-message">Waiting for your opponent</div>'
        : ''}
    </section>
  `;
  app.querySelector('[data-action="continue"]')?.addEventListener('click', submitRankedContinue);
  app.querySelector('[data-action="main-menu"]')?.addEventListener('click', wipeToLobbyFromScoreboard);
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
  mountReadyWaitingOverlays(app.querySelectorAll('.scoreboard-ready'));
}

function renderScoreboardTiebreaker(tiebreakerResult) {
  if (tiebreakerResult) {
    const variantId = tiebreakerResult.variantId;
    const variant = variantSelectScreen.getVariant(variantId);
    const score = getScoreboardVariantScore(variantId);
    return `
      <div class="scoreboard-game-row">
        ${renderScoreboardWinCounter(variantId, score.p1)}
        ${renderStaticDoodle(variant.buttonDoodle, VARIANT_BUTTON_FRAME_WIDTH, VARIANT_BUTTON_FRAME_HEIGHT, 'scoreboard-variant-button')}
        ${renderScoreboardWinCounter(variantId, score.p2)}
      </div>
    `;
  }

  return rankedSnapshot?.phase === 'gameOver'
    ? ''
    : renderStaticDoodle('tie_breaker_button', 325, 128, 'scoreboard-tiebreaker');
}

function renderScoreboardReady(show) {
  return show
    ? '<canvas class="scoreboard-ready" width="300" height="256" aria-hidden="true"></canvas>'
    : '';
}

function renderScoreboardAction(isLocalReady) {
  if (rankedSnapshot?.phase === 'gameOver') {
    return `
      <div class="scoreboard-next-variant-wrap">
        ${renderSheetButton('main-menu', 'main_menu_button', 'Main menu', 'scoreboard-next-variant')}
      </div>
    `;
  }

  if (!rankedSnapshot?.pendingNextVariant && !rankedSnapshot?.pendingTiebreaker) {
    return '';
  }

  return `
    <div class="scoreboard-next-variant-wrap ${isLocalReady ? 'is-ready' : ''}">
      ${isLocalReady
        ? '<canvas class="scoreboard-ready scoreboard-next-ready" width="300" height="256" aria-hidden="true"></canvas>'
        : rankedSnapshot.pendingTiebreaker
          ? renderSheetButton('continue', 'tiebreaker_button', 'Tiebreaker', 'scoreboard-next-variant')
          : renderSheetButton('continue', 'next_variant_button', 'Next variant', 'scoreboard-next-variant')}
    </div>
  `;
}

async function showFinalRankedScoreboard() {
  if (isTransitioning) return;
  isTransitioning = true;
  await onlineFlowDirector.play('FINAL_SCOREBOARD', {
    snapshot: rankedSnapshot,
    previousPhase: rankedSnapshot?.phase,
  });
  isTransitioning = false;
}

async function wipeToLobbyFromScoreboard() {
  if (isTransitioning) return;
  isTransitioning = true;
  await onlineFlowDirector.play('RETURN_TO_LOBBY', {
    snapshot: rankedSnapshot,
    previousPhase: rankedSnapshot?.phase,
  });
  isTransitioning = false;
}

function getScoreboardVariantScore(variantId) {
  const result = rankedSnapshot?.gameResults?.find((gameResult) => gameResult.variantId === variantId);
  return {
    p1: result?.roundWins?.[rankedSnapshot.playerKey] ?? 0,
    p2: result?.roundWins?.[rankedSnapshot.opponentKey] ?? 0,
  };
}

function renderScoreboardWinCounter(variantId, wins) {
  return renderStaticDoodle(getWinCounterDoodle(variantId, wins), 64, 64, 'scoreboard-win-counter');
}

function getRankedVariantSelectVariants() {
  const rankedVariants = rankedSnapshot?.variants ?? [];
  return rankedVariants
    .map((rankedVariant) => COMPUTER_VARIANTS.find((variant) => variant.id === rankedVariant.id) ?? {
      id: rankedVariant.id,
      name: rankedVariant.label,
      buttonDoodle: variantSelectScreen.getVariant(rankedVariant.id).buttonDoodle,
    })
    .filter(Boolean);
}

function renderRankedVariantPickButton({ variant, slot, disabled, picked, banned, firstPicked, isTiebreakerBan }) {
  const showSettledBan = isTiebreakerBan && (banned || completedBanAnimationVariants.has(variant.id));
  const showBanAnimation = isTiebreakerBan && picked && !showSettledBan;
  return variantSelectScreen.renderVariantButton(variant, slot, {
    className: `ranked-variant-pick ${picked ? 'picked' : ''} ${banned ? 'banned' : ''} ${isTiebreakerBan ? 'tiebreaker-ban' : ''}`,
    dataAttribute: 'data-pick-variant',
    disabled,
    content: showSettledBan
      ? renderStaticDoodle('ban-animation/x', 300, 256, 'ranked-ban-mark')
      : showBanAnimation
        ? `<canvas class="ranked-ban-animation" data-variant-id="${variant.id}" width="300" height="256" aria-hidden="true"></canvas>`
        : firstPicked ? `
        <canvas
          class="ranked-variant-ready"
          width="300"
          height="256"
          aria-hidden="true"
        ></canvas>
      ` : '',
  });
}

function renderRankedQuitButton() {
  return `
    <button class="opponent-button back-button" data-action="quit" aria-label="Back">
      <canvas
        class="sprite-canvas opponent-button-art"
        data-doodle="back_button_w"
        data-frame-width="${TITLE_BUTTON_FRAME_WIDTH}"
        data-frame-height="${TITLE_BUTTON_FRAME_HEIGHT}"
        width="${TITLE_BUTTON_FRAME_WIDTH}"
        height="${TITLE_BUTTON_FRAME_HEIGHT}"
        aria-hidden="true"
      ></canvas>
    </button>
  `;
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
        ${renderLayoutSlot('rules-button', renderGameplayRulesButton(), 'gameplay-rules-button-slot')}
        ${renderTestOpponentControls()}
        ${renderReadyWaitingOverlay()}
        <section class="controls layout-controls">
          ${renderSkipGameButton()}
          ${renderResetButton()}
        </section>
      </div>
    </section>
    ${renderRankedDisconnectNotice()}
    ${renderGameplayRulesOverlay()}
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
  app.querySelector('[data-action="continue"]')?.addEventListener(
    'click',
    isRankedMatchWon() ? showFinalRankedScoreboard : continueGame,
  );
  app.querySelector('[data-action="rematch"]')?.addEventListener('click', restartGame);
  app.querySelector('[data-action="quit"]')?.addEventListener('click', quitLocalGame);
  app.querySelector('[data-action="skip-game"]')?.addEventListener('click', skipRankedGame);
  app.querySelector('[data-action="reset"]')?.addEventListener('click', restartGame);
  app.querySelector('[data-action="show-rules"]')?.addEventListener('click', openGameplayRules);
  app.querySelector('[data-action="dismiss-rules"]')?.addEventListener('click', closeGameplayRules);
  app.querySelectorAll('[data-test-opponent-move]').forEach((button) => {
    button.addEventListener('click', () => submitTestOpponentMove(button.dataset.testOpponentMove));
  });
}

function renderResetButton() {
  return playMode === 'online' ? '' : '<button class="ghost" data-action="reset">Reset</button>';
}

function renderGameplayRulesButton() {
  return renderSheetButton('show-rules', 'rules_button', 'Rules', 'gameplay-rules-button');
}

function renderGameplayRulesOverlay() {
  if (!gameplayRulesOpen) {
    return '';
  }

  const variant = variantSelectScreen.getVariant(getCurrentVariantId());
  return `
    <div class="variant-detail-overlay gameplay-rules-overlay">
      <div class="variant-detail-copy" role="dialog" aria-modal="true" aria-label="${escapeHtml(variant.name)} rules">
        ${variantSelectScreen.renderDetailCopy(variant)}
      </div>
      <div class="variant-detail-actions">
        <button class="variant-detail-action" data-action="dismiss-rules" type="button" aria-label="Back">
          <canvas
            class="sprite-canvas variant-detail-action-art"
            data-doodle="back_button_w"
            data-frame-width="${TITLE_BUTTON_FRAME_WIDTH}"
            data-frame-height="${TITLE_BUTTON_FRAME_HEIGHT}"
            width="${TITLE_BUTTON_FRAME_WIDTH}"
            height="${TITLE_BUTTON_FRAME_HEIGHT}"
            aria-hidden="true"
          ></canvas>
        </button>
      </div>
    </div>
  `;
}

function openGameplayRules() {
  gameplayRulesOpen = true;
  render();
  app.querySelector('[data-action="dismiss-rules"]')?.focus();
}

function closeGameplayRules() {
  gameplayRulesOpen = false;
  render();
  app.querySelector('[data-action="show-rules"]')?.focus();
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

function renderStaticDoodle(doodle, width, height, className = '', { flip = false } = {}) {
  return `
    <canvas
      class="sprite-canvas ${className}"
      data-doodle="${doodle}"
      data-frame-width="${width}"
      data-frame-height="${height}"
      data-flip="${flip}"
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
  const targetRoundWins = getVariantTargetRoundWins(getCurrentVariantId());
  const counter = Math.min(roundWins[playerId], targetRoundWins);
  const doodle = getWinCounterDoodle(getCurrentVariantId(), counter);
  return renderStaticDoodle(doodle, WIN_MARK_FRAME_WIDTH, WIN_MARK_FRAME_HEIGHT, 'win-mark');
}

function getWinCounterDoodle(variantId, wins) {
  const targetRoundWins = getVariantTargetRoundWins(variantId);
  const counter = Math.max(0, Math.min(wins, targetRoundWins));
  return targetRoundWins === 5 ? `ft5-w${counter}` : `ft3-win-counter-${counter}`;
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
      const slot = getResourceSlotNumber(resource, playerId, index);
      const isPlayerTwoMirrored = playerId === 'p2' && resource.mirrorPlayerTwoSlots;
      const iconOptions = { flip: isPlayerTwoMirrored };
      return renderLayoutSlot(
        `${playerId}-${resource.iconSlotPrefix}-slot-${index + 1}`,
        slot <= getPlayerResource(state.players[playerId])
          ? renderStaticDoodle(resource.iconDoodle, BULLETS_ICON_FRAME_WIDTH, BULLETS_ICON_FRAME_HEIGHT, 'bullets-icon', iconOptions)
          : renderEmptyResourceSlot(resource, iconOptions),
        'bullet-slot',
      );
    }).join('')}
  `;
}

function getResourceSlotNumber(resource, playerId, index) {
  if (playerId === 'p2' && !resource.mirrorPlayerTwoSlots) {
    return BULLET_SLOT_COUNT - index;
  }

  return index + 1;
}

function renderEmptyResourceSlot(resource, iconOptions = {}) {
  if (resource.emptyIconDoodle) {
    return renderStaticDoodle(resource.emptyIconDoodle, BULLETS_ICON_FRAME_WIDTH, BULLETS_ICON_FRAME_HEIGHT, 'bullets-icon empty-resource-icon', iconOptions);
  }

  return '<span class="empty-bullet-slot" aria-hidden="true"></span>';
}

function renderLayoutPickHistorySlots(playerId) {
  if (!shouldShowPickHistory()) return '';
  const isPlayer = playerId === 'p1';
  const label = isPlayer ? 'you_picked' : 'they_picked';
  const labelWidth = isPlayer ? PICK_LABEL_FRAME_WIDTH : THEY_PICKED_LABEL_FRAME_WIDTH;
  const move = lastMoves[playerId];

  return `
    ${renderLayoutSlot(`${playerId}-${isPlayer ? 'you-picked' : 'they-picked'}`, renderStaticDoodle(label, labelWidth, PICK_LABEL_FRAME_HEIGHT, 'pick-label'), 'hud-art-slot')}
    ${renderLayoutSlot(`${playerId}-previous-move-icon`, renderStaticDoodle(getMoveButtonDoodle(move), BUTTON_FRAME_WIDTH, BUTTON_FRAME_HEIGHT, 'previous-move-button'), 'hud-art-slot')}
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
    ${renderLayoutSlot('down-left-red-arrow', renderStaticDoodle('down-left_red', 128, 128, 'move-arrow'), 'move-arrow-slot')}
    ${renderLayoutSlot('up-blue-arrow', renderStaticDoodle('up_blue', 128, 128, 'move-arrow'), 'move-arrow-slot')}
    ${renderLayoutSlot('up-blue-arrow-2', renderStaticDoodle('up_blue', 128, 128, 'move-arrow'), 'move-arrow-slot')}
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
      actions = rankedSnapshot.pendingNextVariant || rankedSnapshot.pendingTiebreaker
        ? []
        : [{ slot: 'continue-button', markup: renderContinueButton() }];
    } else if (isRankedMatchWon()) {
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

function isRankedMatchWon() {
  return playMode === 'online'
    && rankedSnapshot?.phase === 'gameOver'
    && rankedSnapshot?.gameWins?.[rankedSnapshot.winner] === 2;
}

function getActiveGameLayout() {
  const layout = gameLayout?.states.get(activeLayoutStateId)
    ?? gameLayout?.states.get(DEFAULT_LAYOUT_STATE_ID)
    ?? {
      width: gameLayout?.width ?? FRAME_WIDTH,
      height: gameLayout?.height ?? FRAME_HEIGHT,
      slots: new Map(),
    };

  if (!shouldUsePortraitLayout()) return layout;

  return {
    ...layout,
    width: layout.portraitWidth ?? gameLayout?.portraitWidth ?? PORTRAIT_FRAME_WIDTH,
    height: layout.portraitHeight ?? gameLayout?.portraitHeight ?? PORTRAIT_FRAME_HEIGHT,
    slots: layout.portraitSlots ?? new Map(),
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
    && getCurrentVariantId() !== VARIANT_IDS.fireballWar
    && getCurrentVariantId() !== VARIANT_IDS.tapTapShootX
    && getPlayerResource(state.players.p1) === 0
    && getPlayerResource(state.players.p2) > 0
    && !legalMoves.has('shoot');
}

function shouldSuppressStageAudio() {
  return playMode === 'online'
    && rankedSnapshot?.phase === 'choosing';
}

function renderPickHistories() {
  if (!shouldShowPickHistory()) return '';
  return `${renderPickHistory('p1')}${renderPickHistory('p2')}`;
}

function shouldShowPickHistory() {
  const hasPersistedRpsReveal = getCurrentVariantId() === VARIANT_IDS.rockPaperScissors
    && stagePresentation.kind === 'doodle'
    && stagePresentation.name !== 'rock-paper-scissors/rps-standoff';

  return (state.history.length > 0 || hasPersistedRpsReveal)
    && turnPhase !== 'round-over'
    && rankedSnapshot?.phase !== 'roundOver'
    && rankedSnapshot?.phase !== 'gameOver';
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
        class="sprite-canvas previous-move-button"
        data-doodle="${getMoveButtonDoodle(move)}"
        data-frame-width="${BUTTON_FRAME_WIDTH}"
        data-frame-height="${BUTTON_FRAME_HEIGHT}"
        width="${BUTTON_FRAME_WIDTH}"
        height="${BUTTON_FRAME_HEIGHT}"
        aria-hidden="true"
      ></canvas>
    </aside>
  `;
}

function renderStagePresentation() {
  const presentationMarkup = renderStagePresentationArt();

  return `
    <div class="stage-presentation">
      ${presentationMarkup}
      ${renderLastPickVersus()}
    </div>
  `;
}

function renderStagePresentationArt() {
  if (stagePresentation.kind === 'overlay') {
    return `
      <div class="stage-presentation-stack">
        ${renderSingleStagePresentation(stagePresentation.base)}
        ${renderSingleStagePresentation(stagePresentation.overlay, 'result-overlay')}
        ${stagePresentation.overlay.name === 'system_scenes/round-game-match'
          ? renderMatchResultName()
          : ''}
      </div>
    `;
  }

  return renderSingleStagePresentation(stagePresentation);
}

function renderMatchResultName() {
  const winnerName = rankedSnapshot?.players?.[rankedSnapshot.winner]?.displayName ?? 'Player';
  return `<div class="match-result-name">${escapeHtml(winnerName)}</div>`;
}

function renderLastPickVersus() {
  const isRoundResult = turnPhase === 'round-over'
    || rankedSnapshot?.phase === 'roundOver'
    || rankedSnapshot?.phase === 'gameOver';

  const hasResultMoves = state.history.length > 0 || Boolean(localRoundTimedOutPlayer) || Boolean(rankedSnapshot?.timeout);

  if (!isRoundResult || !hasResultMoves || !lastMoves.p1 || !lastMoves.p2) {
    return '';
  }

  return `
    <div class="last-pick-versus" aria-label="${lastMoves.p1} versus ${lastMoves.p2}">
      ${renderResultMoveButton('p1')}
      ${renderStaticDoodle('vs-sm', 64, 64, 'last-pick-vs')}
      ${renderResultMoveButton('p2')}
    </div>
  `;
}

function renderResultMoveButton(playerId) {
  const rankedTimedOutPlayer = playMode === 'online' && rankedSnapshot?.timeout?.loser === rankedSnapshot?.playerKey ? 'p1'
    : playMode === 'online' && rankedSnapshot?.timeout?.loser === rankedSnapshot?.opponentKey ? 'p2'
      : null;
  const timedOutPlayer = playMode === 'online' ? rankedTimedOutPlayer : localRoundTimedOutPlayer;
  const doodle = timedOutPlayer === playerId
    ? 'timeout_button'
    : getMoveButtonDoodle(lastMoves[playerId]);

  return renderStaticDoodle(doodle, timedOutPlayer === playerId ? 258 : BUTTON_FRAME_WIDTH, BUTTON_FRAME_HEIGHT, 'last-pick-button');
}

function renderSingleStagePresentation(presentation, extraClass = '') {
  if (presentation.kind === 'cue') {
    return `
      <canvas
        class="sprite-canvas cue-canvas ${extraClass}"
        data-doodle="${presentation.name}"
        width="${DOODLE_FRAME_WIDTH}"
        height="${DOODLE_FRAME_HEIGHT}"
        aria-label="${presentation.name}"
      ></canvas>
    `;
  }

  return `
    <canvas
      class="sprite-canvas doodle-canvas ${extraClass}"
      data-doodle="${presentation.name}"
      data-flip="${presentation.flip}"
      width="${DOODLE_FRAME_WIDTH}"
      height="${DOODLE_FRAME_HEIGHT}"
      aria-label="${presentation.name}"
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

function toggleMatchmaking() {
  const searching = matchmakingStatus === 'searching';
  matchmakingStatus = searching ? 'idle' : 'searching';
  rankedClient.setReady(!searching);
  render();
}

function openLobbyPlayer(playerId) {
  if (playerId === 'computer') {
    openPracticeVariantSelect();
    return;
  }
  lobbySelectedPlayerId = playerId;
  render();
}

function handleLobbyState(message) {
  lobbyConnected = true;
  lobbySelf = message.self;
  matchmakingStatus = message.self?.presence === 'ready' ? 'searching' : matchmakingStatus === 'matched' ? 'matched' : 'idle';
  lobbyPlayers = message.players ?? [];
  lobbyMessages = message.recentMessages ?? [];
  lobbyWhiteboard.setBoard(message.board);
  lobbyChallenge = message.pendingChallenge ?? null;
  lobbyChallengeStatus = lobbyChallenge ? 'pending' : null;
  if (screen === 'title') screen = 'lobby';
  render();
}

function handleLobbyRoster(players) {
  lobbyPlayers = players;
  lobbySelf = players.find((player) => player.playerId === rankedClient.playerId) ?? lobbySelf;
  if (lobbySelf && matchmakingStatus !== 'matched') matchmakingStatus = lobbySelf.presence === 'ready' ? 'searching' : 'idle';
  if (screen === 'lobby') render();
}

function handleLobbyChat(message) {
  if (!message) return;
  const normalizedMessage = lobbyWhiteboard.appendChat(message);
  lobbyMessages.push(normalizedMessage);
  if (lobbyMessages.length > 100) lobbyMessages.shift();
  if (screen !== 'lobby') lobbyUnreadCount += 1;
}

function handleLobbyBoardOperation(operation) {
  lobbyWhiteboard.appendOperation(operation);
}

function handleLobbyBoardTrim(top) {
  lobbyWhiteboard.trim(top);
}

function handleLobbyBoardReset(board) {
  lobbyWhiteboard.setBoard(board);
}

function handleLobbyChallenge(message) {
  lobbyChallenge = message.challenge ?? null;
  lobbyChallengeStatus = message.status ?? 'pending';
  lobbySelectedPlayerId = null;
  if (message.status === 'accepted') {
    lobbyChallenge = null;
    lobbyChallengeStatus = null;
  }
  if (screen === 'lobby') render();
}

function renderSceneGallery() {
  requestMusicTrack('title');
  const groups = buildSceneGalleryGroups();

  app.innerHTML = `
    <section class="scene-gallery" aria-label="Scene gallery">
      <header class="scene-gallery-header">
        <button class="text-link" data-action="close-scene-gallery" type="button">Back</button>
        <h1>Scene gallery</h1>
        <span>Click scene for sound</span>
      </header>
      <div class="scene-gallery-scroll">
        ${groups.map(({ variantId, label, entries }) => `
          <section class="scene-gallery-group">
            <h2>${label ?? getVariantLabel(variantId)}</h2>
            <div class="scene-gallery-grid">
              ${entries.map(renderSceneGalleryCard).join('')}
            </div>
          </section>
        `).join('')}
      </div>
    </section>
  `;

  app.querySelector('[data-action="close-scene-gallery"]')?.addEventListener('click', () => {
    screen = 'title';
    render();
  });
  app.querySelectorAll('[data-gallery-scene]').forEach((button, index) => {
    button.addEventListener('click', () => {
      const presentation = {
        kind: 'doodle',
        name: button.dataset.galleryAudioScene,
        flip: button.dataset.flip === 'true',
      };
      unlockSceneAudio();
      playStageAudio({ isTransitioning: false, presentation, audioKey: `gallery:${index}:${performance.now()}` });
    });
  });
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
}

function buildSceneGalleryGroups() {
  const variantGroups = Object.values(VARIANT_IDS).map((variantId) => {
    const moveIds = getVariantMoveIds(variantId);
    const resource = getVariantStartResource(variantId);
    const entries = [];
    const seen = new Set();

    const add = (presentation, label, audioScene = presentation.name) => {
      if (!presentation) return;
      const key = `${presentation.name}:${presentation.flip}:${label}`;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({ presentation, label, audioScene });
    };

    add(getIdleStagePresentation(variantId), 'Standoff');

    for (const p1Move of moveIds) {
      for (const p2Move of moveIds) {
        const moves = { p1: p1Move, p2: p2Move };
        const result = resolveTurn({ variantId, p1Move, p2Move, p1Resource: resource, p2Resource: resource });
        if (!result.ok) continue;
        const scene = resolveScene({ variantId, p1Move, p2Move, result });
        const matchup = `P1 ${p1Move} / P2 ${p2Move}`;
        add(scene, matchup);

        for (const readyPlayerId of ['p1', 'p2']) {
          add(
            resolveReadyScene({ sceneName: scene.name, readyPlayerId, moves }),
            `${matchup} / ${readyPlayerId.toUpperCase()} ready`,
            scene.name,
          );
        }

        if (variantId === VARIANT_IDS.gunKnifeFist) {
          const killResult = resolveTurn({ variantId, p1Move, p2Move, p1Resource: 1, p2Resource: 1 });
          if (killResult.ok) add(resolveScene({ variantId, p1Move, p2Move, result: killResult }), `${matchup} / low health`);
        }
      }
    }

    return { variantId, entries };
  });

  return [
    {
      label: 'Poker tests',
      entries: [
        { presentation: { kind: 'doodle', name: 'poker-staredown', flip: false }, label: 'Poker staredown', audioScene: '' },
        { presentation: { kind: 'doodle', name: 'table-cardback-best', flip: false }, label: 'Table cardback', audioScene: '' },
      ],
    },
    ...variantGroups,
  ];
}

function renderSceneGalleryCard({ presentation, label, audioScene }) {
  return `
    <button
      class="scene-gallery-card"
      data-gallery-scene="${presentation.name}"
      data-gallery-audio-scene="${audioScene}"
      data-flip="${presentation.flip}"
      type="button"
    >
      <canvas
        class="sprite-canvas scene-gallery-art"
        data-doodle="${presentation.name}"
        data-flip="${presentation.flip}"
        data-frame-width="${DOODLE_FRAME_WIDTH}"
        data-frame-height="${DOODLE_FRAME_HEIGHT}"
        width="${DOODLE_FRAME_WIDTH}"
        height="${DOODLE_FRAME_HEIGHT}"
        aria-hidden="true"
      ></canvas>
      <span>${label}</span>
      <small>${presentation.name}${presentation.flip ? ' · flipped' : ''}</small>
    </button>
  `;
}

function enableAudioFromSlider(kind) {
  if (isSoundEnabled) return;

  isSoundEnabled = true;
  isMusicEnabled = true;
  setSoundEnabled(isSoundEnabled);
  setMusicEnabled(isMusicEnabled, ['title', 'lobby'].includes(screen) ? 'title' : 'game');
  titleScreen.updateSoundButton();

  if (kind === 'music') setTitleVolume('sfx', 0);
  else setTitleVolume('music', 0);
}

function setTitleVolume(kind, value) {
  const volume = clampVolume(value);
  if (kind === 'music') {
    musicVolume = volume;
    writeStoredVolume(MUSIC_VOLUME_KEY, musicVolume);
    setMusicVolume(musicVolume);
  } else {
    sfxVolume = volume;
    writeStoredVolume(SFX_VOLUME_KEY, sfxVolume);
    setSfxVolume(sfxVolume);
  }
}

function toggleSound({ rerender = true } = {}) {
  isSoundEnabled = !isSoundEnabled;
  isMusicEnabled = isSoundEnabled;

  if (isSoundEnabled) {
    if (musicVolume <= 0) {
      setTitleVolume('music', 1);
    }

    if (sfxVolume <= 0) {
      setTitleVolume('sfx', 1);
    }
  }

  setMusicEnabled(isMusicEnabled, ['title', 'lobby'].includes(screen) ? 'title' : 'game');
  setSoundEnabled(isSoundEnabled);
  playAudioToggleSound();
  if (rerender) {
    render();
  }
}

function toggleBoil({ rerender = true } = {}) {
  isBoilEnabled = !isBoilEnabled;
  writeStoredBoilEnabled(isBoilEnabled);
  setBoilEnabled(isBoilEnabled);
  playAudioToggleSound();
  if (rerender) {
    render();
  }
}

function playAudioToggleSound() {
  if (!isSoundEnabled) {
    return;
  }

  playUserGestureAudio(READY_AUDIO);
  unlockSceneAudio();
}

function renderTutorialScreen() {
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

async function showVariantDetail(variantId, sourceButton) {
  if (isTransitioning || variantDetailMenu) {
    return;
  }

  const variant = variantSelectScreen.getVariant(variantId);
  const selectedButton = variantSelectScreen.promoteButton(sourceButton);
  isTransitioning = true;
  const curtain = await closeCurtainWipe(app, playCurtainCloseAudio);

  if (screen !== 'opponent-select') {
    variantSelectScreen.restoreButton(selectedButton);
    curtain.remove();
    isTransitioning = false;
    return;
  }

  app.classList.add('variant-detail-open');
  const overlay = variantSelectScreen.renderDetailOverlay(variant, playSelectedVariant, {
    slot: Number(selectedButton.dataset.variantSlot),
  });
  variantDetailMenu = { curtain, overlay, selectedButton, mode: 'local' };
  isTransitioning = false;
}

async function showRankedVariantDetail(variantId, sourceButton) {
  if (isTransitioning || variantDetailMenu || rankedSnapshot?.phase !== 'variantSelection') {
    return;
  }

  const variant = variantSelectScreen.getVariant(variantId);
  const selectedButton = variantSelectScreen.promoteButton(sourceButton);
  isTransitioning = true;
  await onlineFlowDirector.cover();

  if (playMode !== 'online' || rankedSnapshot?.phase !== 'variantSelection') {
    variantSelectScreen.restoreButton(selectedButton);
    await onlineFlowDirector.reveal();
    isTransitioning = false;
    return;
  }

  app.classList.add('variant-detail-open');
  const overlay = variantSelectScreen.renderDetailOverlay(variant, confirmRankedVariantPick, {
    actionDoodle: 'select_button',
    slot: Number(selectedButton.dataset.variantSlot),
  });
  overlay.classList.add('online-flow-foreground');
  selectedButton.classList.add('online-flow-foreground');
  variantDetailMenu = { curtain: null, overlay, selectedButton, mode: 'online' };
  isTransitioning = false;
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
  if (
    !debugTools.revealComputerMove
    || playerId !== 'p2'
    || playMode !== 'local'
    || getCurrentVariantId() !== VARIANT_IDS.fireballWar
  ) {
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
  const resource = getResourcePresentation(getCurrentVariantId());
  const label = resource.showLabel && resource.labelDoodle
    ? `
      <canvas
        class="sprite-canvas bullets-label"
        data-doodle="${resource.labelDoodle}"
        data-frame-width="${BULLETS_LABEL_FRAME_WIDTH}"
        data-frame-height="${BULLETS_LABEL_FRAME_HEIGHT}"
        width="${BULLETS_LABEL_FRAME_WIDTH}"
        height="${BULLETS_LABEL_FRAME_HEIGHT}"
        aria-hidden="true"
      ></canvas>
    `
    : '';

  return `
    <div class="bullets-meter ${playerId}">
      ${label}
      <div class="bullets-icons" aria-label="${playerId} bullets: ${bullets}">
        ${Array.from({ length: BULLET_SLOT_COUNT }, (_, index) => renderBulletSlot(playerId, index, bullets)).join('')}
      </div>
    </div>
  `;
}

function renderBulletSlot(playerId, index, bullets) {
  const resource = getResourcePresentation(getCurrentVariantId());
  const slot = getResourceSlotNumber(resource, playerId, index);
  const isFilled = slot <= bullets;
  const iconOptions = { flip: playerId === 'p2' && resource.mirrorPlayerTwoSlots };

  return `
    <span class="bullets-slot">
      ${isFilled ? renderBulletIcon(iconOptions) : renderEmptyResourceSlot(resource, iconOptions)}
    </span>
  `;
}

function renderBulletIcon({ flip = false } = {}) {
  const resource = getResourcePresentation(getCurrentVariantId());

  return `
    <canvas
      class="sprite-canvas bullets-icon"
      data-doodle="${resource.iconDoodle}"
      data-frame-width="${BULLETS_ICON_FRAME_WIDTH}"
      data-frame-height="${BULLETS_ICON_FRAME_HEIGHT}"
      data-flip="${flip}"
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
        if (rankedSnapshot.pendingNextVariant || rankedSnapshot.pendingTiebreaker) {
          return '';
        }
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
    <button class="move-card ${isQueued ? 'selected' : ''}" data-move="${move.id}" ${isLegal && canChooseMove && state.status === 'playing' && (!isTransitioning || playMode === 'online') ? '' : 'disabled'}>
      <canvas
        class="sprite-canvas move-button-art"
        data-doodle="${getMoveButtonDoodle(move.id)}"
        data-frame-width="${BUTTON_FRAME_WIDTH}"
        data-frame-height="${BUTTON_FRAME_HEIGHT}"
        width="${BUTTON_FRAME_WIDTH}"
        height="${BUTTON_FRAME_HEIGHT}"
        aria-label="${move.label}"
      ></canvas>
    </button>
  `;
}

function getMoveButtonDoodle(moveId, variantId = getCurrentVariantId()) {
  return VARIANT_MOVE_BUTTON_DOODLES[variantId]?.[moveId] ?? DEFAULT_MOVE_BUTTON_DOODLES[moveId];
}

function getMoveButtonDoodlesForPreload() {
  return [
    ...Object.values(DEFAULT_MOVE_BUTTON_DOODLES),
    ...Object.values(VARIANT_MOVE_BUTTON_DOODLES).flatMap((moves) => Object.values(moves)),
  ];
}

function getResourceDoodlesForPreload() {
  return Object.values(VARIANT_IDS)
    .flatMap((variantId) => {
      const resource = getResourcePresentation(variantId);
      return [resource.labelDoodle, resource.iconDoodle, resource.emptyIconDoodle];
    })
    .filter(Boolean);
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

  choice.moves.p2 = chooseAiMove(state, Math.random, variantDifficultyToggleState);
  handleLocalMoveQueued('p2');
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

  if (
    getCurrentVariantId() === VARIANT_IDS.rockPaperScissors
    && state.history.length === 0
    && stagePresentation.kind === 'doodle'
    && stagePresentation.name !== 'rock-paper-scissors/rps-standoff'
  ) {
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
  return resolveReadyScene({ sceneName: scene, readyPlayerId, moves: lastMoves });
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

function getFireballWarReadySplitScene(scene) {
  const prefix = 'fireball-war/';

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

function getGunKnifeFistReadySplitPresentation(scene, readyPlayerId) {
  const prefix = 'gun-knife-fist/';

  if (!scene.startsWith(prefix)) {
    return null;
  }

  const sceneName = scene.slice(prefix.length);

  if (sceneName === 'pss-standoff' || ['punch-draw', 'shoot-draw', 'stab-draw'].includes(sceneName)) {
    return {
      kind: 'doodle',
      name: `gun-knife-fist/split_scenes/${sceneName}_${readyPlayerId}_is_ready`,
      flip: false,
    };
  }

  if (sceneName.startsWith('punch-shoot')) {
    const isPuncherReady = lastMoves[readyPlayerId] === 'punch';
    return {
      kind: 'doodle',
      name: `gun-knife-fist/split_scenes/punch-shoot_${isPuncherReady ? 'puncher' : 'shooter'}_is_ready`,
      flip: lastMoves.p2 === 'punch',
    };
  }

  if (sceneName.startsWith('stab-punch')) {
    const isStabberReady = lastMoves[readyPlayerId] === 'stab';
    return {
      kind: 'doodle',
      name: `gun-knife-fist/split_scenes/stab-punch_${isStabberReady ? 'stabber' : 'puncher'}_is_ready`,
      flip: lastMoves.p2 === 'stab',
    };
  }

  return null;
}

function getTapTapShootYReadySplitPresentation(scene, readyPlayerId) {
  const prefix = 'tap-tap-shoot-y/';

  if (!scene.startsWith(prefix)) {
    return null;
  }

  const sceneName = scene.slice(prefix.length);

  if (sceneName === 'standoff-ssd') {
    return {
      kind: 'doodle',
      name: `tap-tap-shoot-y/split_scenes/ssd-standoff_${readyPlayerId}_is_ready`,
      flip: false,
    };
  }

  if (sceneName === 'reload-draw') {
    return {
      kind: 'doodle',
      name: `tap-tap-shoot-y/split_scenes/reloading_${readyPlayerId}_is_ready`,
      flip: false,
    };
  }

  if (['shoot-draw', 'stab-draw', 'duck-draw'].includes(sceneName)) {
    return {
      kind: 'doodle',
      name: `tap-tap-shoot-y/split_scenes/${sceneName}_${readyPlayerId}_is_ready`,
      flip: false,
    };
  }

  if (sceneName === 'reload-duck') {
    const isReloaderReady = lastMoves[readyPlayerId] === 'reload';
    return {
      kind: 'doodle',
      name: `tap-tap-shoot-y/split_scenes/reload-duck_${isReloaderReady ? 'reloader' : 'ducker'}_is_ready`,
      flip: lastMoves.p1 === 'duck',
    };
  }

  if (sceneName === 'shoot-duck') {
    const isShooterReady = lastMoves[readyPlayerId] === 'shoot';
    return {
      kind: 'doodle',
      name: `tap-tap-shoot-y/split_scenes/shoot-duck_${isShooterReady ? 'shooter' : 'ducker'}_is_ready`,
      flip: lastMoves.p2 === 'shoot',
    };
  }

  if (sceneName === 'stab-reload') {
    const isStabberReady = lastMoves[readyPlayerId] === 'stab';
    return {
      kind: 'doodle',
      name: `tap-tap-shoot-y/split_scenes/stab-reload_${isStabberReady ? 'stabber' : 'reloader'}_is_ready`,
      flip: lastMoves.p2 === 'stab',
    };
  }

  return null;
}

function getTapTapShootXReadySplitPresentation(scene, readyPlayerId) {
  const prefix = 'tap-tap-shoot-x/';

  if (!scene.startsWith(prefix)) {
    return null;
  }

  const sceneName = scene.slice(prefix.length);

  if (sceneName === 'standoff-tts') {
    return {
      kind: 'doodle',
      name: `tap-tap-shoot-x/split_scenes/tts-standoff_${readyPlayerId}_is_ready`,
      flip: false,
    };
  }

  if (sceneName === 'reload-draw') {
    return {
      kind: 'doodle',
      name: `tap-tap-shoot-x/split_scenes/reloading_${readyPlayerId}_is_ready`,
      flip: false,
    };
  }

  if (['shoot-draw', 'stab-draw', 'defense-draw'].includes(sceneName)) {
    return {
      kind: 'doodle',
      name: `tap-tap-shoot-x/split_scenes/${sceneName}_${readyPlayerId}_is_ready`,
      flip: false,
    };
  }

  if (sceneName === 'reload-duck') {
    const isReloaderReady = lastMoves[readyPlayerId] === 'reload';
    return {
      kind: 'doodle',
      name: `tap-tap-shoot-x/split_scenes/reload-defense_${isReloaderReady ? 'reloader' : 'defender'}_is_ready`,
      flip: lastMoves.p1 === 'duck',
    };
  }

  if (sceneName === 'shoot-duck') {
    const isShooterReady = lastMoves[readyPlayerId] === 'shoot';
    return {
      kind: 'doodle',
      name: `tap-tap-shoot-x/split_scenes/shoot-duck_${isShooterReady ? 'shooter' : 'ducker'}_is_ready`,
      flip: lastMoves.p2 === 'shoot',
    };
  }

  if (sceneName === 'stab-counterstab') {
    const isStabberReady = lastMoves[readyPlayerId] === 'stab';
    return {
      kind: 'doodle',
      name: `tap-tap-shoot-x/split_scenes/stab-counterstab_${isStabberReady ? 'stabber' : 'counterstabber'}_is_ready`,
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

  const chosenMoves = { ...localTurnChoice.moves };
  localRoundTimedOutPlayer = playerId;
  lastMoves = {
    p1: chosenMoves.p1 ?? lastMoves.p1,
    p2: chosenMoves.p2 ?? lastMoves.p2,
  };
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

async function openPracticeVariantSelect() {
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
  rankedClient.setPresence('playing_computer');
  isTransitioning = false;
  render();
}

async function returnToLobbyFromOpponentSelect() {
  if (isTransitioning) {
    return;
  }

  isTransitioning = true;
  await playCurtainMenuTransition(() => {
    screen = 'lobby';
    clearLocalTurnChoice();
    p1QueuedMove = null;
    rankedSnapshot = null;
    render();
  });
  rankedClient.setPresence('idle');
  isTransitioning = false;
  render();
}

async function returnToTitleFromLobby() {
  if (isTransitioning) {
    return;
  }

  isTransitioning = true;
  await playCurtainMenuTransition(() => {
    lobbySelectedPlayerId = null;
    lobbyChallenge = null;
    lobbyChallengeStatus = null;
    screen = 'title';
    render();
  });
  rankedClient.setReady(false);
  rankedClient.setPresence('idle');
  isTransitioning = false;
  render();
}

async function closeVariantDetail() {
  const menu = variantDetailMenu;

  if (!menu || menu.locked || isTransitioning) {
    return;
  }

  variantDetailMenu = null;
  isTransitioning = true;
  menu.overlay.remove();
  if (menu.mode === 'online' && rankedSnapshot?.phase === 'variantSelection') {
    variantSelectScreen.restoreButton(menu.selectedButton);
    onlineFlowDirector.consumeAnimations();
    renderRankedBanScreen();
    await onlineFlowDirector.reveal();
  } else {
    await openCurtainWipe(menu.curtain, playCurtainOpenAudio);
  }
  variantSelectScreen.restoreButton(menu.selectedButton);
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
  isTransitioning = false;
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

async function playSelectedVariant(variantId) {
  const menu = variantDetailMenu;

  if (!menu || isTransitioning) {
    return;
  }

  variantDetailMenu = null;
  isTransitioning = true;
  menu.overlay.remove();
  variantSelectScreen.restoreButton(menu.selectedButton);
  selectedVariantId = COMPUTER_VARIANT_IDS.includes(variantId) ? variantId : DEFAULT_VARIANT_ID;
  await setActiveGameLayoutForVariant(selectedVariantId);
  playMode = 'local';
  clearLocalTurnChoice();
  requestMusicTrack('game');
  unlockSceneAudio();
  resetRoundWins();
  setNewRound();
  render();
  app.append(menu.curtain);
  await openCurtainWipe(menu.curtain, playCurtainOpenAudio);
  isTransitioning = false;
  render();
  beginOpeningCues();
}

async function confirmRankedVariantPick(variantId) {
  const menu = variantDetailMenu;

  if (!menu || menu.mode !== 'online' || isTransitioning || rankedSnapshot?.phase !== 'variantSelection') {
    return;
  }

  if (!submitRankedVariantPick(variantId)) {
    return;
  }

  menu.locked = true;
  const backButton = menu.overlay.querySelector('[data-action="variant-back"]');
  const selectButton = menu.overlay.querySelector('[data-action="variant-play"]');
  backButton.classList.add('variant-detail-action-hidden');
  menu.overlay.querySelector('.variant-detail-copy')?.insertAdjacentHTML(
    'beforeend',
    '<p class="variant-detail-waiting">Waiting for your opponent.</p>',
  );
  selectButton.disabled = true;
  selectButton.setAttribute('aria-label', 'Ready. Waiting for opponent');
  selectButton.innerHTML = `
    <canvas
      class="variant-detail-ready"
      width="300"
      height="256"
      aria-hidden="true"
    ></canvas>
  `;
  mountReadyWaitingOverlays(selectButton.querySelectorAll('.variant-detail-ready'));
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
    rankedClient.setPresence('idle');
    resetRoundWins();
    state = createRoundState();
    screen = 'lobby';
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
  const targetRoundWins = getVariantTargetRoundWins(getCurrentVariantId());
  return roundWins.p1 >= targetRoundWins || roundWins.p2 >= targetRoundWins;
}

function getGameWinner() {
  const targetRoundWins = getVariantTargetRoundWins(getCurrentVariantId());
  if (roundWins.p1 >= targetRoundWins) {
    return 'p1';
  }

  if (roundWins.p2 >= targetRoundWins) {
    return 'p2';
  }

  return null;
}

function getMusicTopperFile() {
  const targetRoundWins = getVariantTargetRoundWins(getCurrentVariantId());
  if (
    !shouldUseMusicTopper() ||
    isGameOver() ||
    (roundWins.p1 !== targetRoundWins - 1 && roundWins.p2 !== targetRoundWins - 1)
  ) {
    return null;
  }

  if (roundWins.p1 === targetRoundWins - 1 && roundWins.p2 === targetRoundWins - 1) {
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
  localRoundTimedOutPlayer = null;
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
  stagePresentation = getIdleStagePresentation();
  render();
}

function setNewRoundAtReloadScene() {
  setNewRound();
  turnPhase = 'scene';
  stagePresentation = getIdleStagePresentation();
  render();
}

function getIdleStagePresentation(variantId = getCurrentVariantId()) {
  if (variantId === VARIANT_IDS.fireballWar) {
    return {
      kind: 'doodle',
      name: 'fireball-war/cbf-standoff',
      flip: false,
    };
  }

  if (variantId === VARIANT_IDS.gunKnifeFist) {
    return {
      kind: 'doodle',
      name: 'gun-knife-fist/pss-standoff',
      flip: false,
    };
  }

  if (variantId === VARIANT_IDS.tapTapShootX) {
    return {
      kind: 'doodle',
      name: 'tap-tap-shoot-x/standoff-tts',
      flip: false,
    };
  }

  return {
    kind: 'doodle',
    name: variantId === VARIANT_IDS.rockPaperScissors ? 'rock-paper-scissors/rps-standoff' : 'tap-tap-shoot-y/standoff-ssd',
    flip: false,
  };
}

function getCurrentLegalMoves() {
  if (playMode !== 'online' || !rankedSnapshot) {
    return getPlayerLegalMoves(state, 'p1');
  }

  return rankedSnapshot.players[rankedSnapshot.playerKey].legalMoves;
}

async function enterLobbyFromTitle(event) {
  event.preventDefault();

  if (isTransitioning) {
    return;
  }

  const formData = new FormData(event.currentTarget);
  rankedDisplayName = sanitizeDisplayName(formData.get('displayName'));
  writeStoredDisplayName(rankedDisplayName);
  unlockSceneAudio();
  isTransitioning = true;
  await playCurtainMenuTransition(() => {
    lobbyConnected = false;
    screen = 'lobby';
    render();
  });
  rankedClient.connect(rankedDisplayName, DEFAULT_VARIANT_ID);
  isTransitioning = false;
}

function generateTitleName() {
  const input = app.querySelector('.title-name-input');

  if (!input) {
    return;
  }

  rankedDisplayName = sanitizeDisplayName(generateDisplayName());
  input.value = rankedDisplayName;
  input.focus();
  input.select();
}

function handleRankedQueue() {
  matchmakingStatus = 'searching';
  if (screen === 'lobby') render();
}

function handleRankedError(message = 'connection failed') {
  rankedConnectionNotice = message;
  if (matchmakingStatus === 'searching' && !rankedSnapshot) matchmakingStatus = 'idle';
  if (screen === 'lobby') {
    lobbyConnected = false;
    render();
    return;
  }
}

function handleRankedClose({ code } = {}) {
  lobbyConnected = false;
  if (!rankedSnapshot) matchmakingStatus = 'idle';
  if (screen === 'lobby') {
    rankedConnectionNotice = code === 4001 ? 'New connection for this guest. Disconnected.' : 'Reconnecting…';
    render();
    return;
  }
  if (playMode === 'online' && screen !== 'lobby') {
    onlineFlowDirector.cancel();
    gameFlowDirector.cancel();
    clearRankedReadyWaitingTimer();
    rankedReadyWaiting = null;
    if (code === 4001) {
      rankedConnectionNotice = 'New connection for this guest. Disconnected.';
      screen = 'lobby';
      rankedSnapshot = null;
      rankedUpdateQueue.clear();
      rankedRoundAudioKey = null;
      render();
      return;
    }
    screen = 'lobby';
    rankedSnapshot = null;
    rankedUpdateQueue.clear();
    rankedRoundAudioKey = null;
    render();
  }
}

function applyRankedSnapshot(snapshot, transition = null) {
  if (snapshot.matchId === ignoredRankedMatchId) return;

  if (playMode !== 'online') {
    interruptLocalPlayForRankedMatch();
    playMode = 'online';
    selectedVariantId = DEFAULT_VARIANT_ID;
    setCachedActiveGameLayoutForVariant(DEFAULT_VARIANT_ID);
    rankedSnapshot = null;
    rankedUpdateQueue.clear();
  }
  matchmakingStatus = 'matched';
  if (snapshot.revision <= (rankedSnapshot?.revision ?? 0)) {
    return;
  }
  rankedUpdateQueue.push(snapshot, transition);
  drainRankedSnapshots();
}

function interruptLocalPlayForRankedMatch() {
  loopToken += 1;
  transitionGeneration += 1;
  clearLocalTurnChoice();
  clearPausableTimers();
  gameFlowDirector.cancel();
  onlineFlowDirector.cancel();
  pauseMenu?.overlay.remove();
  pauseMenu?.curtain.remove();
  pauseMenu = null;
  variantDetailMenu?.overlay.remove();
  variantDetailMenu?.curtain?.remove();
  variantDetailMenu = null;
  isTransitioning = false;
  pendingSuperAnimation = null;
  p1QueuedMove = null;
}

async function drainRankedSnapshots() {
  if (isApplyingRankedSnapshot) {
    return;
  }

  isApplyingRankedSnapshot = true;

  try {
    while (rankedUpdateQueue.length) {
      const update = rankedUpdateQueue.shift();
      const { snapshot, transition } = update;

      if (playMode !== 'online') {
        continue;
      }

      await processRankedSnapshot(snapshot, transition);
    }
  } finally {
    isApplyingRankedSnapshot = false;
  }
}

async function processRankedSnapshot(snapshot, transition = null) {
  const previousSnapshot = rankedSnapshot;
  const previousPhase = previousSnapshot?.phase;
  const flowEvent = interpretOnlineSnapshot(previousSnapshot, snapshot, transition?.transitionId);

  if ([
    'MATCH_FOUND',
    'VARIANTS_CHOSEN',
    'VARIANT_SELECTION_STARTED',
    'TIEBREAKER_SELECTION_STARTED',
    'TIEBREAKER_CHOSEN',
    'NEXT_VARIANT_STARTED',
    'VARIANT_GAME_FINISHED',
    'MATCH_FINISHED',
  ].includes(flowEvent)) {
    clearRankedReadyWaitingTimer();
    variantDetailMenu?.overlay.remove();
    variantDetailMenu = null;
    if (flowEvent === 'TIEBREAKER_SELECTION_STARTED') completedBanAnimationVariants.clear();
    isTransitioning = true;
    await onlineFlowDirector.play(flowEvent, { snapshot, previousPhase });
    isTransitioning = false;
    if (flowEvent !== 'MATCH_FOUND') render();
    return;
  }

  if (transition) {
    await wipeToRankedSnapshot(snapshot, previousPhase);
    return;
  }

  const opponentPickBefore = previousSnapshot?.variantPicks?.[previousSnapshot.opponentKey];
  const opponentPickAfter = snapshot.variantPicks?.[snapshot.opponentKey];
  if (!opponentPickBefore && opponentPickAfter && variantDetailMenu) {
    onlineFlowDirector.queueAnimation('opponent-variant-ready', { variantId: opponentPickAfter });
  }
  commitRankedSnapshot(snapshot, previousPhase);
  if (snapshot.phase === 'variantSelection' && variantDetailMenu) {
    return;
  }
  render();
  if (
    snapshot.phase === 'variantSelection'
    && snapshot.variantSelectionRound !== 2
    && snapshot.variantPicks?.[snapshot.playerKey]
  ) {
    await onlineFlowDirector.cover();
  }
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

  if (snapshot.phase === 'revealed') {
    await playPendingSuperAnimation(loopToken);
  }
}

function commitRankedSnapshot(snapshot, previousPhase = rankedSnapshot?.phase) {
  rankedSnapshot = snapshot;
  rankedReadyWaiting = getRankedReadyWaitingFromSnapshot(snapshot);
  screen = screen === 'scoreboard'
    && snapshot.phase === 'roundOver'
    && (snapshot.pendingNextVariant || snapshot.pendingTiebreaker)
    ? 'scoreboard'
    : 'playing';
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

  if (snapshot.disconnectedPlayerKey && !rankedDisconnectReturnTimer) {
    rankedDisconnectReturnTimer = setTimeout(() => {
      rankedDisconnectReturnTimer = null;
      leaveRanked();
    }, 3000);
  }

  if (snapshot.phase === 'gameOver' && snapshot.noContest) {
    stagePresentation = {
      kind: 'doodle',
      name: 'system_scenes/no_contest',
      flip: false,
    };
  } else if (snapshot.phase === 'revealed') {
    lastMoves = getLocalMovesFromRankedSnapshot(snapshot);
    const result = getLocalTurnResultFromRankedSnapshot(snapshot);
    pendingSuperAnimation = getSuperAnimation(result);
    stagePresentation = pendingSuperAnimation?.frames[0]
      ?? getVariantStagePresentation(result, lastMoves.p1, lastMoves.p2, { variantId: snapshot.currentVariantId ?? snapshot.variantId });
  } else if (snapshot.phase === 'roundOver') {
    const didFinishVariantGame = Boolean(snapshot.pendingNextVariant || snapshot.pendingTiebreaker);
    stagePresentation = {
      kind: 'overlay',
      base: getInteractionPresentation(stagePresentation),
      overlay: {
        kind: 'doodle',
        name: didFinishVariantGame
          ? snapshot.round?.winner === snapshot.playerKey
            ? 'system_scenes/game_won'
            : 'system_scenes/game_lost'
          : getRoundOverDoodle(getLocalRoundWinnerFromRankedSnapshot(snapshot), true),
        flip: false,
      },
    };
  } else if (
    snapshot.phase === 'variantSelection'
    && snapshot.variantSelectionRound === 2
    && previousPhase === 'revealed'
  ) {
    const latestGameWinner = snapshot.gameResults?.at(-1)?.winner;
    stagePresentation = {
      kind: 'overlay',
      base: getInteractionPresentation(stagePresentation),
      overlay: {
        kind: 'doodle',
        name: latestGameWinner === snapshot.playerKey
          ? 'system_scenes/game_won'
          : 'system_scenes/game_lost',
        flip: false,
      },
    };
  } else if (snapshot.phase === 'countdown' || snapshot.phase === 'variantSelection') {
    stagePresentation = getIdleStagePresentation(snapshot.currentVariantId ?? snapshot.variantId);
  } else if (snapshot.phase === 'choosing' && snapshot.readyPlayerKey) {
    const preserveRpsWinReveal = (snapshot.currentVariantId ?? snapshot.variantId) === VARIANT_IDS.rockPaperScissors
      && !snapshot.round?.lastTurn
      && (snapshot.round?.turn ?? 0) === 0;
    if (!preserveRpsWinReveal) {
      stagePresentation = getRankedChoosingPresentation(snapshot);
    }
  } else if (snapshot.phase === 'choosing') {
    const preserveRpsReveal = (snapshot.currentVariantId ?? snapshot.variantId) === VARIANT_IDS.rockPaperScissors
      && previousPhase === 'revealed';
    if (!preserveRpsReveal) {
      stagePresentation = getRankedIdleChoosingPresentation(snapshot);
    }
  } else if (snapshot.phase === 'gameOver') {
    finishMusicLoopThenStop();
    stagePresentation = {
      kind: 'overlay',
      base: getInteractionPresentation(stagePresentation),
      overlay: {
        kind: 'doodle',
        name: isRankedMatchWon()
          ? 'system_scenes/round-game-match'
          : snapshot.winner === snapshot.playerKey
            ? 'system_scenes/game_won'
            : 'system_scenes/game_lost',
        flip: false,
      },
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
  const targetRoundWins = getVariantTargetRoundWins(snapshot.currentVariantId ?? snapshot.variantId);
  const isFinalRound = snapshot.gameWins?.p1 >= 2
    || snapshot.gameWins?.p2 >= 2
    || snapshot.roundWins?.p1 >= targetRoundWins
    || snapshot.roundWins?.p2 >= targetRoundWins;
  interruptMusicFileOnce(didWinRound ? WIN_SOUND_AUDIO : LOSE_JINGLE_AUDIO, isFinalRound ? null : 'game', !isFinalRound);
}

function getRankedIdleChoosingPresentation(snapshot) {
  if (snapshot.round?.lastTurn) {
    const moves = getLocalMovesFromRankedSnapshot(snapshot);
    return getVariantStagePresentation(getLocalTurnResultFromRankedSnapshot(snapshot), moves.p1, moves.p2, { variantId: snapshot.currentVariantId ?? snapshot.variantId });
  }

  return getIdleStagePresentation(snapshot.currentVariantId ?? snapshot.variantId);
}

function getRankedChoosingPresentation(snapshot) {
  if ((snapshot.round?.turn ?? 0) === 0 && !snapshot.round?.lastTurn) {
    return getIdleStagePresentation(snapshot.currentVariantId ?? snapshot.variantId);
  }

  return getVariantStagePresentation(getLocalTurnResultFromRankedSnapshot(snapshot), lastMoves.p1, lastMoves.p2, { variantId: snapshot.currentVariantId ?? snapshot.variantId });
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

  if (snapshot.phase === 'variantSelection') {
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

function getLocalTurnResultFromRankedSnapshot(snapshot) {
  const lastTurn = snapshot.round?.lastTurn ?? {};
  const result = {
    ...lastTurn,
    p1Resource: lastTurn.p1Resource ?? lastTurn.p1ResourceAfter,
    p2Resource: lastTurn.p2Resource ?? lastTurn.p2ResourceAfter,
  };

  const localResult = snapshot.playerKey === 'p2'
    ? swapScenePerspective(result)
    : result;

  return {
    ...localResult,
    resources: {
      p1: localResult.p1Resource,
      p2: localResult.p2Resource,
    },
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

function submitRankedVariantPick(variantId) {
  if (!rankedClient.submitVariantPick(rankedSnapshot, variantId)) {
    return false;
  }

  playOneShotAudio(READY_AUDIO);
  return true;
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

function renderSkipGameButton() {
  return playMode === 'online'
    && rankedClient.debugTools.winGame
    && !rankedSnapshot?.pendingNextVariant
    && !rankedSnapshot?.pendingTiebreaker
    && ['choosing', 'revealed', 'roundOver'].includes(rankedSnapshot?.phase)
    ? '<button class="ghost" data-action="skip-game">Debug: win game</button>'
    : '';
}

function skipRankedGame() {
  rankedClient.debugWinGame(rankedSnapshot);
}

function leaveRanked() {
  resetRankedSession();
  onlineFlowDirector.cancel();
  gameFlowDirector.cancel();
  screen = 'lobby';
  render();
}

function resetRankedSession() {
  if (rankedDisconnectReturnTimer) {
    clearTimeout(rankedDisconnectReturnTimer);
    rankedDisconnectReturnTimer = null;
  }
  variantDetailMenu?.overlay.remove();
  variantDetailMenu = null;
  clearRankedReadyWaitingTimer();
  playMode = 'local';
  selectedVariantId = DEFAULT_VARIANT_ID;
  setCachedActiveGameLayoutForVariant(DEFAULT_VARIANT_ID);
  clearLocalTurnChoice();
  rankedSnapshot = null;
  rankedUpdateQueue.clear();
  rankedReadyWaiting = null;
  rankedRoundAudioKey = null;
  matchmakingStatus = 'idle';
  turnPhase = 'idle';
  p1QueuedMove = null;
}

function renderRankedDisconnectNotice() {
  if (!rankedSnapshot?.disconnectedPlayerKey) {
    return '';
  }

  const message = rankedSnapshot.aborted
    ? 'Opponent disconnected. Match aborted.'
    : 'Opponent disconnected. You win.';

  return `<div class="ranked-disconnect-notice" role="alert">${message}</div>`;
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
    if (screen !== 'title') {
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
  return getServerHttpUrl('/api/ranked-status');
}

async function loadDebugTools() {
  try {
    const response = await fetch(getServerApiUrl('/api/debug-tools'), { cache: 'no-store' });

    if (!response.ok) {
      return;
    }

    const received = await response.json();
    debugTools = {
      winGame: received.winGame === true,
      revealComputerMove: received.revealComputerMove === true,
      sceneGallery: received.sceneGallery === true,
    };
  } catch {
    // Debug tools remain disabled when server config cannot be loaded.
  }
}

function getServerApiUrl(pathname) {
  return getServerHttpUrl(pathname);
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
      const animation = pendingSuperAnimation;
      pendingSuperAnimation = null;
      await gameFlowDirector.reveal({
        variantId: getCurrentVariantId(),
        superAnimation: animation,
        roundFinished: state.status === 'finished',
        resultLevel: getLocalResultLevel(),
      });
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
  const p2Move = tutorialOutcome?.p2Move
    ?? localTurnChoice?.moves.p2
    ?? chooseAiMove(state, Math.random, variantDifficultyToggleState);
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
      if (isGameOver() || (screen !== 'tutorial' && roundWins.p2 >= getVariantTargetRoundWins(getCurrentVariantId()) - 1)) {
        interruptMusicFileOnce(LOSE_JINGLE_AUDIO, null, false);
      } else {
        interruptMusicFileOnce(LOSE_JINGLE_AUDIO, 'game');
      }
    } else if (playMode === 'local' && state.status === 'finished' && state.winner === 'p1') {
      if (isGameOver() || (screen !== 'tutorial' && roundWins.p1 >= getVariantTargetRoundWins(getCurrentVariantId()) - 1)) {
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

async function playSuperAnimation(animation, token) {
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

async function playPendingSuperAnimation(token) {
  const animation = pendingSuperAnimation;
  pendingSuperAnimation = null;
  await gameFlowDirector.reveal({
    variantId: getCurrentVariantId(),
    superAnimation: animation,
  });
}

function getLocalResultLevel() {
  if (!state.winner) return 'round';
  const target = getVariantTargetRoundWins(getCurrentVariantId());
  return roundWins[state.winner] + 1 >= target ? 'game' : 'round';
}

async function showDirectedLocalResult(resultLevel) {
  if (!isActiveLoop(loopToken) || state.status !== 'finished') return;
  turnPhase = 'round-over';
  isTransitioning = true;
  await playWipeTransition(() => showRoundOverScene(resultLevel));
  isTransitioning = false;
  if (isActiveLoop(loopToken)) render();
}

function advanceLocalRoundPreservingReveal() {
  if (!state.winner || state.status !== 'finished') return;
  const reveal = stagePresentation;
  const moves = { ...lastMoves };
  roundWins[state.winner] += 1;
  syncMusicTopper();
  setNewRound();
  turnPhase = 'scene';
  stagePresentation = reveal;
  lastMoves = moves;
  render();
}

function settleTutorialScene() {
  if (tutorialStageMode !== 'scene') {
    return;
  }

  if (state.status === 'finished') {
    setNewTutorialRound();
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

function showRoundOverScene(resultLevel = 'round') {
  if (state.winner && screen !== 'tutorial') {
    roundWins[state.winner] += 1;
  }
  syncMusicTopper();

  if (playMode === 'local' && screen !== 'tutorial' && !isGameOver()) {
    if (state.winner === 'p1') {
      queueMusicTrackOnce('sax', 'game');
    }
  }

  const useRoundDoodle = resultLevel === 'round';

  stagePresentation = {
    kind: 'overlay',
    base: getInteractionPresentation(stagePresentation),
    overlay: {
      kind: 'doodle',
      name: resultLevel === 'match'
        ? 'system_scenes/round-game-match'
        : getRoundOverDoodle(state.winner, useRoundDoodle),
      flip: false,
    },
  };
  render();
}

function getInteractionPresentation(presentation) {
  return presentation?.kind === 'overlay' ? presentation.base : presentation;
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
  const generation = transitionGeneration;
  return playStarburstWipeTransition(app, () => {
    if (generation === transitionGeneration) onCovered();
  }, () => playOneShotAudio(STARBURST_WIPE_AUDIO));
}

function playCurtainMenuTransition(onCovered) {
  const generation = transitionGeneration;
  return playCurtainWipeTransition(app, () => {
    if (generation !== transitionGeneration) return false;
    onCovered();
    return true;
  }, {
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
