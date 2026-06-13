import { MOVES, canAfford } from './engine/moves.js';
import { createRoundState, getPlayerLegalMoves, playTurn } from './engine/gameState.js';
import { chooseRivalMove as chooseAiMove, DEFAULT_RIVAL_ID, RIVALS } from './engine/rivalAi.js';
import {
  configureAudio,
  getMusicTopperId,
  installAudioUnlockListeners,
  interruptMusicFileOnce,
  LOSE_JINGLE_AUDIO,
  playOneShotAudio,
  playStageAudio,
  queueMusicTrackOnce,
  requestMusicTrack,
  resetStageAudioKey,
  restartMusicTrackOnce,
  STARBURST_WIPE_AUDIO,
  syncMusicTopper,
  unlockSceneAudio,
  WIN_SOUND_AUDIO,
} from './audio.js';
import { RankedClient } from './rankedClient.js';
import {
  DOODLE_FRAME_HEIGHT,
  DOODLE_FRAME_WIDTH,
  getDoodlePresentation,
  mountSpriteRenderers,
  playStarburstWipeTransition,
} from './renderer.js';

const BEAT_MS = 750;
const BUTTON_FRAME_WIDTH = 256;
const BUTTON_FRAME_HEIGHT = 128;
const TURN_FRAME_WIDTH = 256;
const TURN_FRAME_HEIGHT = 128;
const AP_LABEL_FRAME_WIDTH = 234;
const AP_LABEL_FRAME_HEIGHT = 33;
const AP_ICON_FRAME_WIDTH = 64;
const AP_ICON_FRAME_HEIGHT = 64;
const WINS_LABEL_FRAME_WIDTH = 128;
const WINS_LABEL_FRAME_HEIGHT = 64;
const WIN_MARK_FRAME_WIDTH = 64;
const WIN_MARK_FRAME_HEIGHT = 64;
const PICK_LABEL_FRAME_WIDTH = 128;
const THEY_PICKED_LABEL_FRAME_WIDTH = 150;
const PICK_LABEL_FRAME_HEIGHT = 64;
const MOVE_ICON_FRAME_WIDTH = 128;
const MOVE_ICON_FRAME_HEIGHT = 128;
const TITLE_FRAME_WIDTH = 512;
const TITLE_FRAME_HEIGHT = 256;
const TITLE_BUTTON_FRAME_WIDTH = 256;
const TITLE_BUTTON_FRAME_HEIGHT = 128;
const TUTORIAL_SLIDE_COUNT = 9;
const REMATCH_BUTTON_FRAME_WIDTH = 256;
const REMATCH_BUTTON_FRAME_HEIGHT = 128;
const CROSSED_FRAME_WIDTH = 384;
const CROSSED_FRAME_HEIGHT = 192;
const OUTLINE_FRAME_WIDTH = 384;
const OUTLINE_FRAME_HEIGHT = 192;
const AP_SLOT_COUNT = 4;
const LAST_NUMBERED_TURN = 21;
const GAME_TARGET_ROUNDS = 5;
const FRAME_WIDTH = 1100;
const FRAME_HEIGHT = 825;
const SCENE_BEATS = 2;
const ROUND_OVER_SCENE_BEATS = 2;
const READY_BEATS = 3;
const MOVE_BUTTON_DOODLES = Object.freeze({
  reload: 'reload_button',
  shoot: 'shoot_button',
  stab: 'stab_button',
  block: 'dodge_button',
  counterstab: 'counterstab_button',
});
const MOVE_ICON_DOODLES = Object.freeze({
  reload: 'reload_icon',
  shoot: 'shoot_icon',
  stab: 'stab_icon',
  block: 'dodge_icon',
  counterstab: 'counterstab_icon',
});
const MOVE_OUTLINE_RELATIONS = Object.freeze({
  reload: Object.freeze({
    reload: 'draws',
    shoot: 'loses',
    stab: 'loses',
    block: 'draws',
    counterstab: 'draws',
  }),
  shoot: Object.freeze({
    reload: 'beats',
    shoot: 'draws',
    stab: 'beats',
    block: 'draws',
    counterstab: 'beats',
  }),
  stab: Object.freeze({
    reload: 'beats',
    shoot: 'loses',
    stab: 'draws',
    block: 'beats',
    counterstab: 'draws',
  }),
  block: Object.freeze({
    reload: 'draws',
    shoot: 'draws',
    stab: 'loses',
    block: 'draws',
    counterstab: 'draws',
  }),
  counterstab: Object.freeze({
    reload: 'draws',
    shoot: 'loses',
    stab: 'draws',
    block: 'draws',
    counterstab: 'draws',
  }),
});
const OPPONENTS = RIVALS;
const OPPONENT_IDS = Object.freeze(Object.keys(OPPONENTS));
const DEFAULT_OPPONENT_ID = DEFAULT_RIVAL_ID;

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
let isTransitioning = false;
let loopToken = 0;
let turnPhase = 'idle';
let p1QueuedMove = null;
let rankedSnapshot = null;
let findingMatchStep = 0;
let findingMatchTimer = null;
let tutorialSlideIndex = 0;
let tutorialStageMode = 'slide';
let stagePresentation = { kind: 'doodle', name: 'reloading', flip: false };
let lastMoves = {
  p1: 'reload',
  p2: 'reload',
};
let roundWins = {
  p1: 0,
  p2: 0,
};
const defeatedOpponentIds = new Set();
const rankedClient = new RankedClient({
  onQueue: handleRankedQueue,
  onSnapshot: applyRankedSnapshot,
  onClose: handleRankedClose,
});

configureAudio({ getMusicTopperFile });

updateFrameScale();
window.addEventListener('resize', updateFrameScale);
installAudioUnlockListeners();
try {
  render();
} catch (error) {
  console.error('Could not render title screen', error);
}

function updateFrameScale() {
  const margin = 28;
  const availableWidth = window.innerWidth - margin;
  const availableHeight = window.innerHeight - margin;
  const scale = Math.min(1, availableWidth / FRAME_WIDTH, availableHeight / FRAME_HEIGHT);
  app.style.setProperty('--ui-scale', scale.toFixed(4));
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

  if (screen === 'queue') {
    renderQueueScreen();
    return;
  }

  if (screen === 'tutorial') {
    renderTutorialScreen();
    return;
  }

  const legalMoves = new Set(getCurrentLegalMoves());

  app.innerHTML = `
    <section class="arena ${state.status}">
      ${renderStageHud()}
      ${renderPickHistories()}
      <figure class="doodle-stage">
        ${renderStagePresentation()}
      </figure>
    </section>

    <section class="moves" aria-label="Moves">
      ${renderActionButtons(legalMoves)}
    </section>

    <section class="controls">
      <button class="ghost" data-action="reset">Reset</button>
    </section>
  `;

  installMoveHoverHandlers();

  app.querySelector('[data-action="continue"]')?.addEventListener('click', continueGame);
  app.querySelector('[data-action="rematch"]')?.addEventListener('click', restartGame);
  app.querySelector('[data-action="quit"]')?.addEventListener('click', quitLocalGame);
  app.querySelector('[data-action="reset"]').addEventListener('click', restartGame);
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
  playStageAudio({
    isTransitioning,
    presentation: stagePresentation,
    audioKey: `${state.turn}:${turnPhase}:${stagePresentation.name}:${stagePresentation.flip}`,
  });
}

function renderPickHistories() {
  if (!state.history.length) {
    return '';
  }

  return `
    ${renderPickHistory('p1')}
    ${renderPickHistory('p2')}
  `;
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

function renderTitleScreen() {
  stopFindingMatchTicker();
  requestMusicTrack('title');

  app.innerHTML = `
    <section class="title-screen" aria-label="Title screen">
      <canvas
        class="sprite-canvas title-logo"
        data-doodle="title/LOGO"
        data-frame-width="${TITLE_FRAME_WIDTH}"
        data-frame-height="${TITLE_FRAME_HEIGHT}"
        width="${TITLE_FRAME_WIDTH}"
        height="${TITLE_FRAME_HEIGHT}"
        aria-label="Tap Tap Shoot"
      ></canvas>

      <div class="title-actions">
        <button class="play-button" data-action="play" aria-label="Play computer">
          <canvas
            class="sprite-canvas play-button-art"
            data-doodle="title/playvcom"
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

        <button class="play-button tutorial-button" data-action="tutorial" aria-label="Tutorial">
          <canvas
            class="sprite-canvas play-button-art"
            data-doodle="title/tutorial_button"
            data-frame-width="${TITLE_BUTTON_FRAME_WIDTH}"
            data-frame-height="${TITLE_BUTTON_FRAME_HEIGHT}"
            width="${TITLE_BUTTON_FRAME_WIDTH}"
            height="${TITLE_BUTTON_FRAME_HEIGHT}"
            aria-hidden="true"
          ></canvas>
        </button>
      </div>
    </section>
  `;

  app.querySelector('[data-action="play"]').addEventListener('click', startGameFromTitle);
  app.querySelector('[data-action="ranked"]').addEventListener('click', startRankedFromTitle);
  app.querySelector('[data-action="tutorial"]').addEventListener('click', startTutorialFromTitle);
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
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
    </section>

    <section class="moves tutorial-moves" aria-label="Tutorial controls">
      ${renderTutorialButtons()}
    </section>
  `;

  installMoveHoverHandlers();
  app.querySelector('[data-action="back-tutorial"]')?.addEventListener('click', goBackTutorial);
  app.querySelector('[data-action="next-tutorial"]')?.addEventListener('click', advanceTutorialSlide);
  app.querySelector('[data-action="quit"]')?.addEventListener('click', quitLocalGame);
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
  playStageAudio({
    isTransitioning: isTransitioning || tutorialStageMode !== 'scene',
    presentation: stagePresentation,
    audioKey: `tutorial:${state.turn}:${turnPhase}:${stagePresentation.name}:${stagePresentation.flip}`,
  });
}

function renderTutorialStage() {
  return tutorialStageMode === 'scene' ? renderStagePresentation() : renderTutorialSlide();
}

function renderTutorialNav() {
  return `
    <nav class="tutorial-nav" aria-label="Tutorial navigation">
      ${renderSheetButton('back-tutorial', 'back_button', 'Back', 'tutorial-nav-button tutorial-back-button')}
      ${tutorialSlideIndex === TUTORIAL_SLIDE_COUNT - 1
        ? renderSheetButton('quit', 'quit_button', 'Return to menu', 'tutorial-nav-button tutorial-next-button')
        : renderSheetButton('next-tutorial', 'tutorial/next_button', 'Next', 'tutorial-nav-button tutorial-next-button')}
    </nav>
  `;
}

function renderTutorialSlide() {
  const slideNumber = tutorialSlideIndex + 1;
  const slides = [
    `
      <p><strong>Tap Tap Shoot!</strong></p>
      <p>is a simultaneous reveal</p>
      <p>guessing game, like</p>
      <p><strong>Rock Paper Scissors.</strong></p>
    `,
    `
      <p>But a little more complex.</p>
      <p>There are five options, and</p>
      <p>a resource to manage.</p>
    `,
    `
      <p>Hover over the buttons</p>
      <p>to see what beats what.</p>
    `,
    `
      <p>An</p>
      <p><strong>Action Point</strong></p>
      <p>is required to attack your opponent.</p>
      <p>Each player starts with one.</p>
      <p>Defensive moves are free.</p>
    `,
    `
      <p><strong>Reloading</strong></p>
      <p>stocks an Action Point,</p>
      <p>but leaves you vulnerable.</p>
    `,
    `
      <p>Each game is</p>
      <p><strong>First to Five.</strong></p>
    `,
    `
      <div class="tutorial-side-copy">
        <p><strong>Tips</strong></p>
        <p>The game is all about</p>
        <p>relative Action Points.</p>
        <p>When each player has</p>
        <p>one, the game is like</p>
        <p>Rock Paper Scissors.</p>
      </div>
      <div class="tutorial-art-slot" aria-hidden="true"></div>
    `,
    `
      <div class="tutorial-side-copy">
        <p><strong>Tips</strong></p>
        <p>But when a player has an</p>
        <p>Action Point advantage,</p>
        <p>they can enforce a mixup.</p>
      </div>
      <div class="tutorial-art-slot" aria-hidden="true"></div>
    `,
    `
      <p>Everyone has patterns.</p>
      <p>Try to read your opponent!</p>
      <p>And thanks for playing!!</p>
      <p><strong>-JP</strong></p>
    `,
  ];

  return `
    <div class="tutorial-slide tutorial-slide-${slideNumber}" aria-label="Tutorial ${slideNumber}">
      ${slides[tutorialSlideIndex]}
    </div>
  `;
}

function renderTutorialButtons() {
  if (tutorialSlideIndex >= 2) {
    const moves = Object.values(MOVES);

    return moves.map((move) => renderTutorialMoveButton(move)).join('');
  }

  return '';
}

function renderOpponentSelectScreen() {
  stopFindingMatchTicker();
  requestMusicTrack('title');

  app.innerHTML = `
    <section class="title-screen opponent-select-screen" aria-label="Choose computer opponent">
      <canvas
        class="sprite-canvas title-logo"
        data-doodle="title/LOGO"
        data-frame-width="${TITLE_FRAME_WIDTH}"
        data-frame-height="${TITLE_FRAME_HEIGHT}"
        width="${TITLE_FRAME_WIDTH}"
        height="${TITLE_FRAME_HEIGHT}"
        aria-label="Tap Tap Shoot"
      ></canvas>

      <div class="opponent-actions">
        ${OPPONENT_IDS.map((opponentId) => renderOpponentButton(OPPONENTS[opponentId])).join('')}
        ${renderBackButton()}
      </div>
    </section>
  `;

  app.querySelectorAll('[data-opponent]').forEach((button) => {
    button.addEventListener('click', () => startLocalGame(button.dataset.opponent));
  });
  app.querySelector('[data-action="back-title"]').addEventListener('click', returnToTitleFromOpponentSelect);
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
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

function renderOpponentButton(opponent) {
  const isDefeated = defeatedOpponentIds.has(opponent.id);

  return `
    <button class="opponent-button ${isDefeated ? 'defeated' : ''}" data-opponent="${opponent.id}" aria-label="${opponent.name}">
      <canvas
        class="sprite-canvas opponent-button-art"
        data-doodle="${opponent.buttonDoodle}"
        data-frame-width="${TITLE_BUTTON_FRAME_WIDTH}"
        data-frame-height="${TITLE_BUTTON_FRAME_HEIGHT}"
        width="${TITLE_BUTTON_FRAME_WIDTH}"
        height="${TITLE_BUTTON_FRAME_HEIGHT}"
        aria-hidden="true"
      ></canvas>
      ${isDefeated ? renderCrossedOpponentMark(opponent) : ''}
    </button>
  `;
}

function renderCrossedOpponentMark(opponent) {
  return `
    <canvas
      class="sprite-canvas crossed-opponent-mark"
      data-doodle="${opponent.crossedDoodle}"
      data-frame-width="${CROSSED_FRAME_WIDTH}"
      data-frame-height="${CROSSED_FRAME_HEIGHT}"
      width="${CROSSED_FRAME_WIDTH}"
      height="${CROSSED_FRAME_HEIGHT}"
      aria-hidden="true"
    ></canvas>
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
        data-frame-width="${TITLE_FRAME_WIDTH}"
        data-frame-height="${TITLE_FRAME_HEIGHT}"
        width="${TITLE_FRAME_WIDTH}"
        height="${TITLE_FRAME_HEIGHT}"
        aria-label="Tap Tap Shoot"
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
      ${renderApMeter('p1', state.players.p1.ap)}
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
      ${renderApMeter('p2', state.players.p2.ap)}
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

function renderApMeter(playerId, ap) {
  return `
    <div class="ap-meter ${playerId}">
      <canvas
        class="sprite-canvas ap-label"
        data-doodle="action_points"
        data-frame-width="${AP_LABEL_FRAME_WIDTH}"
        data-frame-height="${AP_LABEL_FRAME_HEIGHT}"
        width="${AP_LABEL_FRAME_WIDTH}"
        height="${AP_LABEL_FRAME_HEIGHT}"
        aria-hidden="true"
      ></canvas>
      <div class="ap-icons" aria-label="${playerId} action points: ${ap}">
        ${Array.from({ length: AP_SLOT_COUNT }, (_, index) => renderApSlot(playerId, index, ap)).join('')}
      </div>
    </div>
  `;
}

function renderApSlot(playerId, index, ap) {
  const slot = playerId === 'p2' ? AP_SLOT_COUNT - index : index + 1;
  const isFilled = slot <= ap;

  return `
    <span class="ap-slot">
      ${isFilled ? renderApIcon() : ''}
    </span>
  `;
}

function renderApIcon() {
  return `
    <canvas
      class="sprite-canvas ap-icon"
      data-doodle="ap_icon"
      data-frame-width="${AP_ICON_FRAME_WIDTH}"
      data-frame-height="${AP_ICON_FRAME_HEIGHT}"
      width="${AP_ICON_FRAME_WIDTH}"
      height="${AP_ICON_FRAME_HEIGHT}"
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
      return renderSheetButton('rematch', 'rematch_button', 'Rematch', 'rematch-button');
    }

    return isGameOver() ? renderGameOverButtons() : renderContinueButton();
  }

  return Object.values(MOVES).map((move) => renderMoveButton(move, legalMoves.has(move.id))).join('');
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
  const canChooseMove = turnPhase === 'go' || turnPhase === 'scene';
  const relationAttributes = Object.fromEntries(
    Object.entries(MOVE_OUTLINE_RELATIONS).map(([hoveredMove, relations]) => [
      `data-${hoveredMove}-outline`,
      relations[move.id],
    ]),
  );
  const relationMarkup = Object.entries(relationAttributes)
    .map(([attribute, value]) => `${attribute}="${value}"`)
    .join(' ');

  return `
    <button class="move-card ${isQueued ? 'selected' : ''}" data-move="${move.id}" ${relationMarkup} ${isLegal && canChooseMove && state.status === 'playing' && !isTransitioning ? '' : 'disabled'}>
      ${renderMoveOutline('beats')}
      ${renderMoveOutline('draws')}
      ${renderMoveOutline('loses')}
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

function renderTutorialMoveButton(move) {
  return renderMoveButton(move, tutorialStageMode === 'slide' && canAfford(move.id, state.players.p1.ap));
}

function renderMoveOutline(relation) {
  return `
    <canvas
      class="sprite-canvas move-interaction-outline ${relation}-outline"
      data-doodle="${relation}_outline"
      data-frame-width="${OUTLINE_FRAME_WIDTH}"
      data-frame-height="${OUTLINE_FRAME_HEIGHT}"
      width="${OUTLINE_FRAME_WIDTH}"
      height="${OUTLINE_FRAME_HEIGHT}"
      aria-hidden="true"
    ></canvas>
  `;
}

function installMoveHoverHandlers() {
  app.querySelectorAll('[data-move]').forEach((button) => {
    button.addEventListener('click', () => submitMove(button.dataset.move));
    button.addEventListener('pointerenter', () => {
      button.closest('.moves')?.setAttribute('data-hover-move', button.dataset.move);
    });
    button.addEventListener('pointerleave', () => {
      button.closest('.moves')?.removeAttribute('data-hover-move');
    });
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
    (turnPhase !== 'go' && turnPhase !== 'scene') ||
    state.status !== 'playing' ||
    !canAfford(p1Move, state.players.p1.ap)
  ) {
    return;
  }

  unlockSceneAudio();
  p1QueuedMove = p1Move;
  render();
  resolvePlayerSelection();
}

function submitTutorialMove(p1Move) {
  if (
    tutorialSlideIndex < 2 ||
    tutorialStageMode !== 'slide' ||
    isTransitioning ||
    (turnPhase !== 'go' && turnPhase !== 'scene') ||
    state.status !== 'playing' ||
    !canAfford(p1Move, state.players.p1.ap)
  ) {
    return;
  }

  unlockSceneAudio();
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

  playMode = 'local';
  screen = 'opponent-select';
  p1QueuedMove = null;
  rankedSnapshot = null;
  render();
}

function returnToTitleFromOpponentSelect() {
  if (isTransitioning) {
    return;
  }

  screen = 'title';
  p1QueuedMove = null;
  rankedSnapshot = null;
  render();
}

async function startTutorialFromTitle() {
  if (isTransitioning) {
    return;
  }

  playMode = 'local';
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
    tutorialStageMode = 'slide';
    p1QueuedMove = null;
    rankedSnapshot = null;
    stagePresentation = { kind: 'doodle', name: 'reloading', flip: false };
    render();
  });
  isTransitioning = false;
  render();
}

async function startLocalGame(opponentId) {
  if (isTransitioning) {
    return;
  }

  selectedOpponentId = OPPONENTS[opponentId] ? opponentId : DEFAULT_OPPONENT_ID;
  playMode = 'local';
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
  if (isTransitioning || screen !== 'tutorial' || tutorialSlideIndex >= TUTORIAL_SLIDE_COUNT - 1) {
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
    return;
  }

  if (isTransitioning || turnPhase !== 'round-over' || isGameOver()) {
    return;
  }

  requestMusicTrack('game');
  unlockSceneAudio();
  loopToken += 1;
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
  isTransitioning = true;
  await playWipeTransition(() => {
    resetRoundWins();
    state = createRoundState();
    screen = 'title';
    turnPhase = 'idle';
    tutorialSlideIndex = 0;
    tutorialStageMode = 'slide';
    p1QueuedMove = null;
    rankedSnapshot = null;
    stagePresentation = { kind: 'doodle', name: 'reloading', flip: false };
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
    playMode !== 'local' ||
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

function setNewRound() {
  state = createRoundState();
  screen = 'playing';
  rankedSnapshot = null;
  turnPhase = 'intro-scene';
  p1QueuedMove = null;
  resetStageAudioKey();
  lastMoves = {
    p1: 'reload',
    p2: 'reload',
  };
  stagePresentation = { kind: 'doodle', name: 'reloading', flip: false };
  render();
}

function setNewRoundAtReloadScene() {
  setNewRound();
  turnPhase = 'scene';
  stagePresentation = { kind: 'doodle', name: 'reloading', flip: false };
  render();
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

  unlockSceneAudio();
  playMode = 'online';
  screen = 'queue';
  p1QueuedMove = null;
  rankedSnapshot = null;
  findingMatchStep = 0;
  rankedClient.connect();
  render();
}

function handleRankedQueue() {
  screen = 'queue';
  render();
}

function handleRankedClose() {
  if (playMode === 'online' && screen !== 'title') {
    screen = 'title';
    rankedSnapshot = null;
    render();
  }
}

function applyRankedSnapshot(snapshot) {
  stopFindingMatchTicker();
  const previousPhase = rankedSnapshot?.phase;
  rankedSnapshot = snapshot;
  screen = 'playing';
  state = getLocalStateFromRankedSnapshot(snapshot);
  roundWins = getLocalRoundWinsFromRankedSnapshot(snapshot);
  turnPhase = getTurnPhaseFromRankedSnapshot(snapshot);
  p1QueuedMove = snapshot.phase === 'choosing' ? p1QueuedMove : null;
  if (previousPhase !== snapshot.phase) {
    resetStageAudioKey();
  }

  if (snapshot.revealedMoves || snapshot.round.lastTurn) {
    lastMoves = getLocalMovesFromRankedSnapshot(snapshot);
    stagePresentation = getDoodlePresentation(lastMoves.p1, lastMoves.p2);
  } else if (snapshot.phase === 'countdown') {
    stagePresentation = { kind: 'cue', name: 'READY' };
  } else if (snapshot.phase === 'choosing') {
    stagePresentation = { kind: 'cue', name: 'GO' };
  } else if (snapshot.phase === 'gameOver') {
    stagePresentation = {
      kind: 'doodle',
      name: snapshot.winner === snapshot.playerKey ? 'winner' : 'loser',
      flip: false,
    };
  }

  render();
}

function getLocalStateFromRankedSnapshot(snapshot) {
  const opponentKey = snapshot.opponentKey;
  const playerKey = snapshot.playerKey;

  return {
    turn: snapshot.round.turn,
    status: snapshot.phase === 'gameOver' ? 'finished' : 'playing',
    winner: snapshot.winner === playerKey ? 'p1' : snapshot.winner === opponentKey ? 'p2' : null,
    players: {
      p1: {
        ap: snapshot.players[playerKey].ap,
        move: null,
        hit: null,
      },
      p2: {
        ap: snapshot.players[opponentKey].ap,
        move: null,
        hit: null,
      },
    },
    history: snapshot.round.lastTurn ? [snapshot.round.lastTurn] : [],
  };
}

function getLocalRoundWinsFromRankedSnapshot(snapshot) {
  return {
    p1: snapshot.roundWins[snapshot.playerKey],
    p2: snapshot.roundWins[snapshot.opponentKey],
  };
}

function getTurnPhaseFromRankedSnapshot(snapshot) {
  if (snapshot.phase === 'countdown') {
    return 'ready';
  }

  if (snapshot.phase === 'choosing') {
    return 'go';
  }

  if (snapshot.phase === 'revealed') {
    return 'scene';
  }

  return 'round-over';
}

function getLocalMovesFromRankedSnapshot(snapshot) {
  const moves = snapshot.revealedMoves ?? {
    p1: snapshot.round.lastTurn?.p1Move ?? 'reload',
    p2: snapshot.round.lastTurn?.p2Move ?? 'reload',
  };

  return {
    p1: moves[snapshot.playerKey],
    p2: moves[snapshot.opponentKey],
  };
}

function submitRankedMove(moveId) {
  if (p1QueuedMove || !rankedClient.submitMove(rankedSnapshot, moveId)) {
    return;
  }

  p1QueuedMove = moveId;
  render();
}

function leaveRanked() {
  rankedClient.close();
  stopFindingMatchTicker();
  playMode = 'local';
  rankedSnapshot = null;
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
  turnPhase = 'intro-scene';
  await waitBeats(SCENE_BEATS, token);

  if (!isActiveLoop(token)) {
    return;
  }

  turnPhase = 'ready';
  stagePresentation = { kind: 'cue', name: 'READY' };
  render();
  await waitBeats(READY_BEATS, token);

  if (!isActiveLoop(token)) {
    return;
  }

  turnPhase = 'go';
  stagePresentation = { kind: 'cue', name: 'GO' };
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
    if (screen !== 'tutorial') {
      maybeShowRoundOverScene(token);
    }
  }
}

function waitBeats(beats, token) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(isActiveLoop(token));
    }, beats * BEAT_MS);
  });
}

function isActiveLoop(token) {
  return token === loopToken && (screen === 'playing' || screen === 'tutorial');
}

function resolveQueuedTurn() {
  const p1Move = p1QueuedMove && canAfford(p1QueuedMove, state.players.p1.ap)
    ? p1QueuedMove
    : getFallbackMove('p1');
  const p2Move = chooseAiMove(state, selectedOpponentId);
  const turn = playTurn(state, p1Move, p2Move);

  if (turn.ok) {
    state = turn.state;
    turnPhase = 'scene';
    if (screen === 'tutorial') {
      tutorialStageMode = 'scene';
    }
    lastMoves = {
      p1: p1Move,
      p2: p2Move,
    };
    stagePresentation = getDoodlePresentation(p1Move, p2Move);

    if (screen === 'tutorial' && state.status === 'finished' && state.winner) {
      roundWins[state.winner] += 1;
      syncMusicTopper();
    }

    if (playMode === 'local' && state.status === 'finished' && state.winner === 'p2') {
      if (screen !== 'tutorial' && roundWins.p2 >= GAME_TARGET_ROUNDS - 1) {
        interruptMusicFileOnce(LOSE_JINGLE_AUDIO, null, false);
      } else {
        interruptMusicFileOnce(LOSE_JINGLE_AUDIO, 'game');
      }
    } else if (playMode === 'local' && state.status === 'finished' && state.winner === 'p1') {
      if (screen !== 'tutorial' && roundWins.p1 >= GAME_TARGET_ROUNDS - 1) {
        interruptMusicFileOnce(WIN_SOUND_AUDIO, null, false);
      } else {
        interruptMusicFileOnce(WIN_SOUND_AUDIO, 'game');
      }
    }
  }

  p1QueuedMove = null;
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

function showRoundOverScene() {
  if (state.winner) {
    roundWins[state.winner] += 1;
  }
  syncMusicTopper();

  if (playMode === 'local' && screen !== 'tutorial' && getGameWinner() === 'p1') {
    defeatedOpponentIds.add(selectedOpponentId);
  }

  if (playMode === 'local' && screen !== 'tutorial' && !isGameOver()) {
    if (state.winner === 'p1') {
      queueMusicTrackOnce('sax', 'game');
    }
  }

  stagePresentation = {
    kind: 'doodle',
    name: state.winner === 'p1' ? 'winner' : 'loser',
    flip: false,
  };
  render();
}

function setNewTutorialRound() {
  state = createRoundState();
  turnPhase = 'scene';
  p1QueuedMove = null;
  resetStageAudioKey();
  lastMoves = {
    p1: 'reload',
    p2: 'reload',
  };
  stagePresentation = { kind: 'doodle', name: 'reloading', flip: false };
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
