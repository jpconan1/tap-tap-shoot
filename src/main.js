const MOVES = Object.freeze({
  reload: Object.freeze({
    id: 'reload',
    label: 'Reload',
    cost: 0,
    gain: 1,
  }),
  shoot: Object.freeze({
    id: 'shoot',
    label: 'Shoot',
    cost: 1,
    gain: 0,
  }),
  stab: Object.freeze({
    id: 'stab',
    label: 'Stab',
    cost: 1,
    gain: 0,
  }),
  block: Object.freeze({
    id: 'block',
    label: 'Dodge',
    cost: 0,
    gain: 0,
  }),
  counterstab: Object.freeze({
    id: 'counterstab',
    label: 'Counterstab',
    cost: 0,
    gain: 0,
  }),
});

const MOVE_IDS = Object.freeze(Object.keys(MOVES));
const HIT_TABLE = Object.freeze({
  shoot: Object.freeze({
    stab: 'shot',
    counterstab: 'shot',
    reload: 'shot',
  }),
  stab: Object.freeze({
    block: 'stabbed',
    reload: 'stabbed',
  }),
});

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
const SCENE_AUDIO = Object.freeze({
  shooting: 'gunshot.wav',
  stabbing: 'stab.wav',
  hiding: 'nothing.wav',
  clash: 'clash.wav',
  collision: 'collision.wav',
  counterstab: 'counterstab.wav',
  dodge: 'wiff.wav',
  reloading: 'reload.wav',
  tricky: 'reload.wav',
});
const STARBURST_WIPE_AUDIO = 'starbust.wav';
const LOSE_JINGLE_AUDIO = 'lose_jingle.wav';
const WIN_SOUND_AUDIO = 'win_sound.wav';
const MUSIC_TRACKS = Object.freeze({
  title: 'title_loop.wav',
  game: 'piano_loop.wav',
  sax: 'sax_loop.wav',
});
const MUSIC_TOPPERS = Object.freeze({
  tension: 'string_loop_topper.wav',
  final: 'string_loop_topper2.wav',
});

const DOODLE_FRAME_COUNT = 3;
const DOODLE_FRAME_RATE = 8;
const BEAT_MS = 750;
const DOODLE_FRAME_WIDTH = 512;
const DOODLE_FRAME_HEIGHT = 256;
const BUTTON_FRAME_WIDTH = 256;
const BUTTON_FRAME_HEIGHT = 128;
const ROUND_FRAME_WIDTH = 256;
const ROUND_FRAME_HEIGHT = 128;
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
const REMATCH_BUTTON_FRAME_WIDTH = 256;
const REMATCH_BUTTON_FRAME_HEIGHT = 128;
const CROSSED_FRAME_WIDTH = 384;
const CROSSED_FRAME_HEIGHT = 192;
const AP_SLOT_COUNT = 4;
const LAST_NUMBERED_ROUND = 21;
const MATCH_TARGET_WINS = 5;
const FRAME_WIDTH = 1100;
const FRAME_HEIGHT = 825;
const WIPE_FRAME_WIDTH = 1100;
const WIPE_FRAME_HEIGHT = 825;
const WIPE_STEP_DURATION = 58;
const SCENE_BEATS = 2;
const GAME_OVER_SCENE_BEATS = 2;
const READY_BEATS = 3;
const MUSIC_SCHEDULE_LOOKAHEAD_SECONDS = 0.08;
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
const OPPONENTS = Object.freeze({
  olJoe: Object.freeze({
    id: 'olJoe',
    name: 'Ol Joe',
    buttonDoodle: 'oljoe_button',
    crossedDoodle: 'crossed1',
    chooseMove: chooseOlJoeMove,
  }),
  mackTheKnife: Object.freeze({
    id: 'mackTheKnife',
    name: 'Mack the Knife',
    buttonDoodle: 'mactheknife_button',
    crossedDoodle: 'crossed2',
    chooseMove: chooseMackTheKnifeMove,
  }),
  blastinDan: Object.freeze({
    id: 'blastinDan',
    name: 'Blastin Dan',
    buttonDoodle: 'blastindan_button',
    crossedDoodle: 'crossed3',
    chooseMove: chooseBlastinDanMove,
  }),
  katheyClever: Object.freeze({
    id: 'katheyClever',
    name: 'Kathey Clever',
    buttonDoodle: 'katheyclever_button',
    crossedDoodle: 'crossed4',
    chooseMove: chooseKatheyCleverMove,
  }),
});
const OPPONENT_IDS = Object.freeze(['olJoe', 'mackTheKnife', 'blastinDan', 'katheyClever']);
const DEFAULT_OPPONENT_ID = 'olJoe';
const OL_JOE_POLICY = Object.freeze({
  '0-0': Object.freeze({ reload: 100 }),
  '1-1': Object.freeze({ shoot: 45, block: 35, stab: 15, reload: 5, counterstab: 0 }),
  '1-0': Object.freeze({ shoot: 38, stab: 38, reload: 24 }),
  '0-1': Object.freeze({ block: 45, counterstab: 45, reload: 10 }),
  '2-1': Object.freeze({ shoot: 42, block: 24, stab: 18, reload: 16 }),
  '1-2': Object.freeze({ block: 32, counterstab: 28, shoot: 25, stab: 10, reload: 5 }),
});
const doodleSheets = new Map();
const sceneAudio = new Map();
const sceneAudioBuffers = new Map();
const sceneAudioLoadPromises = new Map();
let doodleRenderers = [];
let sceneAudioContext = null;
let sceneAudioUnlockPromise = null;
let desiredMusicTrack = null;
let queuedMusicTrack = null;
let queuedMusicSegment = null;
let currentMusicSegment = null;
let musicTopperSegment = null;
let musicScheduleTimer = null;
let htmlMusicAudio = null;
let htmlMusicTrack = null;

function getMove(moveId) {
  return MOVES[moveId] ?? null;
}

function canAfford(moveId, ap) {
  const move = getMove(moveId);
  return Boolean(move) && ap >= move.cost;
}

function getLegalMoves(ap) {
  return MOVE_IDS.filter((moveId) => canAfford(moveId, ap));
}

function resolveRound({ p1Move, p2Move, p1Ap, p2Ap }) {
  const p1 = validateChoice('p1', p1Move, p1Ap);
  const p2 = validateChoice('p2', p2Move, p2Ap);

  if (!p1.ok || !p2.ok) {
    return {
      ok: false,
      errors: [p1.error, p2.error].filter(Boolean),
    };
  }

  const p1Hit = HIT_TABLE[p1Move]?.[p2Move] ?? null;
  const p2Hit = HIT_TABLE[p2Move]?.[p1Move] ?? null;
  const winner = p1Hit && !p2Hit ? 'p1' : p2Hit && !p1Hit ? 'p2' : null;

  return {
    ok: true,
    p1Move,
    p2Move,
    p1Ap: spendAndGain(p1Ap, p1Move),
    p2Ap: spendAndGain(p2Ap, p2Move),
    p1Hit,
    p2Hit,
    winner,
    isGameOver: winner !== null,
    isTie: winner === null,
  };
}

function createGameState() {
  return {
    round: 0,
    status: 'playing',
    players: {
      p1: createPlayerState(),
      p2: createPlayerState(),
    },
    history: [],
  };
}

function playRound(state, p1Move, p2Move) {
  if (state.status !== 'playing') {
    return {
      ok: false,
      error: 'game is over',
      state,
    };
  }

  const result = resolveRound({
    p1Move,
    p2Move,
    p1Ap: state.players.p1.ap,
    p2Ap: state.players.p2.ap,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.errors.join(', '),
      state,
    };
  }

  const nextState = {
    ...state,
    round: result.isGameOver ? state.round : state.round + 1,
    status: result.isGameOver ? 'finished' : 'playing',
    winner: result.winner ?? state.winner,
    players: {
      p1: {
        ...state.players.p1,
        ap: result.p1Ap,
        move: p1Move,
        hit: result.p2Hit,
      },
      p2: {
        ...state.players.p2,
        ap: result.p2Ap,
        move: p2Move,
        hit: result.p1Hit,
      },
    },
    history: [
      {
        round: state.round,
        p1Move,
        p2Move,
        p1ApBefore: state.players.p1.ap,
        p2ApBefore: state.players.p2.ap,
        p1ApAfter: result.p1Ap,
        p2ApAfter: result.p2Ap,
        winner: result.winner,
        p1Hit: result.p1Hit,
        p2Hit: result.p2Hit,
      },
      ...state.history,
    ],
  };

  return {
    ok: true,
    result,
    state: nextState,
  };
}

function getPlayerLegalMoves(state, playerId) {
  return getLegalMoves(state.players[playerId].ap);
}

function validateChoice(player, moveId, ap) {
  const move = getMove(moveId);

  if (!move) {
    return { ok: false, error: `${player} picked unknown move: ${moveId}` };
  }

  if (ap < move.cost) {
    return { ok: false, error: `${player} cannot afford ${moveId}` };
  }

  return { ok: true };
}

function spendAndGain(ap, moveId) {
  const move = getMove(moveId);
  return ap - move.cost + move.gain;
}

function createPlayerState() {
  return {
    ap: 1,
    move: null,
    hit: null,
  };
}

const app = document.querySelector('#app');
const RANKED_PLAYER_ID_KEY = 'tapTapShoot.rankedPlayerId';
const FINDING_MATCH_DOODLES = Object.freeze([
  'title/findingmatch',
  'title/findingmatch1',
  'title/findingmatch2',
  'title/findingmatch3',
]);
let state = createGameState();
let screen = 'title';
let playMode = 'local';
let selectedOpponentId = DEFAULT_OPPONENT_ID;
let isTransitioning = false;
let loopToken = 0;
let roundPhase = 'idle';
let p1QueuedMove = null;
let rankedSocket = null;
let rankedPlayerId = readLocalStorage(RANKED_PLAYER_ID_KEY);
let rankedSnapshot = null;
let findingMatchStep = 0;
let findingMatchTimer = null;
let stagePresentation = { kind: 'doodle', name: 'reloading', flip: false };
let lastSceneAudioKey = null;
let lastMoves = {
  p1: 'reload',
  p2: 'reload',
};
let matchWins = {
  p1: 0,
  p2: 0,
};
const defeatedOpponentIds = new Set();

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

  app.querySelectorAll('[data-move]').forEach((button) => {
    button.addEventListener('click', () => submitMove(button.dataset.move));
  });

  app.querySelector('[data-action="continue"]')?.addEventListener('click', continueMatch);
  app.querySelector('[data-action="rematch"]')?.addEventListener('click', restartMatch);
  app.querySelector('[data-action="quit"]')?.addEventListener('click', quitLocalMatch);
  app.querySelector('[data-action="reset"]').addEventListener('click', restartMatch);
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
  playStageAudio();
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
      </div>
    </section>
  `;

  app.querySelector('[data-action="play"]').addEventListener('click', startGameFromTitle);
  app.querySelector('[data-action="ranked"]').addEventListener('click', startRankedFromTitle);
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
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
      </div>
    </section>
  `;

  app.querySelectorAll('[data-opponent]').forEach((button) => {
    button.addEventListener('click', () => startLocalMatch(button.dataset.opponent));
  });
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
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
    <div class="stage-hud" aria-label="Match status">
      ${renderApMeter('p1', state.players.p1.ap)}
      ${renderWinMeter('p1')}
      <canvas
        class="sprite-canvas round-counter"
        data-doodle="${getRoundDoodle(state.round)}"
        data-frame-width="${ROUND_FRAME_WIDTH}"
        data-frame-height="${ROUND_FRAME_HEIGHT}"
        width="${ROUND_FRAME_WIDTH}"
        height="${ROUND_FRAME_HEIGHT}"
        aria-label="Round ${state.round}"
      ></canvas>
      ${renderWinMeter('p2')}
      ${renderApMeter('p2', state.players.p2.ap)}
    </div>
  `;
}

function renderWinMeter(playerId) {
  const winStacks = getWinStacks(matchWins[playerId]);

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
      <div class="win-marks" aria-label="${playerId} wins: ${matchWins[playerId]}">
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

function getRoundDoodle(round) {
  return round <= LAST_NUMBERED_ROUND ? `round${round}` : 'roundlostcount';
}

function renderActionButtons(legalMoves) {
  if (roundPhase === 'game-over') {
    if (playMode === 'online') {
      return renderSheetButton('rematch', 'rematch_button', 'Rematch', 'rematch-button');
    }

    return isMatchOver() ? renderMatchOverButtons() : renderContinueButton();
  }

  return Object.values(MOVES).map((move) => renderMoveButton(move, legalMoves.has(move.id))).join('');
}

function renderContinueButton() {
  return renderSheetButton('continue', 'continue_button', 'Continue', 'continue-button');
}

function renderMatchOverButtons() {
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
  const canChooseMove = roundPhase === 'go' || roundPhase === 'scene';

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

function submitMove(p1Move) {
  if (playMode === 'online') {
    submitRankedMove(p1Move);
    return;
  }

  if (
    isTransitioning ||
    (roundPhase !== 'go' && roundPhase !== 'scene') ||
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

function chooseRivalMove() {
  const opponent = OPPONENTS[selectedOpponentId] ?? OPPONENTS[DEFAULT_OPPONENT_ID];
  return opponent.chooseMove(state);
}

function chooseOlJoeMove(currentState) {
  const ownAp = currentState.players.p2.ap;
  const enemyAp = currentState.players.p1.ap;
  return chooseWeightedLegalMove(ownAp, OL_JOE_POLICY[getRivalPolicyKey(ownAp, enemyAp)]);
}

function chooseMackTheKnifeMove(currentState) {
  const ownAp = currentState.players.p2.ap;
  const enemyAp = currentState.players.p1.ap;

  if (ownAp === 0) {
    return chooseWeightedLegalMove(ownAp, enemyAp > 0
      ? { counterstab: 50, block: 30, reload: 20 }
      : { reload: 100 });
  }

  return chooseWeightedLegalMove(ownAp, enemyAp > 0
    ? { stab: 50, counterstab: 25, shoot: 15, block: 10 }
    : { stab: 62, shoot: 18, reload: 20 });
}

function chooseBlastinDanMove(currentState) {
  const ownAp = currentState.players.p2.ap;
  const enemyAp = currentState.players.p1.ap;

  if (ownAp === 0) {
    return 'reload';
  }

  return chooseWeightedLegalMove(ownAp, enemyAp > 0
    ? { shoot: 70, block: 15, reload: 10, stab: 5 }
    : { shoot: 72, reload: 18, stab: 10 });
}

function chooseKatheyCleverMove(currentState) {
  const ownAp = currentState.players.p2.ap;
  const enemyAp = currentState.players.p1.ap;
  const playerLastMove = currentState.history[0]?.p1Move;

  if (enemyAp === 0) {
    return chooseWeightedLegalMove(ownAp, ownAp > 0
      ? { stab: 40, shoot: 30, reload: 30 }
      : { reload: 100 });
  }

  if (playerLastMove === 'stab') {
    return chooseWeightedLegalMove(ownAp, { counterstab: 55, block: 25, shoot: 15, reload: 5 });
  }

  if (playerLastMove === 'shoot') {
    return chooseWeightedLegalMove(ownAp, { block: 55, reload: 20, shoot: 15, counterstab: 10 });
  }

  return chooseWeightedLegalMove(ownAp, ownAp > enemyAp
    ? { shoot: 32, block: 28, counterstab: 25, stab: 10, reload: 5 }
    : { block: 36, counterstab: 34, reload: 15, shoot: 10, stab: 5 });
}

function chooseWeightedLegalMove(ownAp, policy) {
  const legalMoves = getLegalMoves(ownAp);
  const weightedMoves = Object.entries(policy)
    .filter(([moveId, weight]) => legalMoves.includes(moveId) && weight > 0)
    .map(([moveId, weight]) => ({ moveId, weight }));

  if (!weightedMoves.length) {
    return legalMoves.includes('reload') ? 'reload' : legalMoves[0];
  }

  return pickWeightedRivalMove(weightedMoves);
}

function getRivalPolicyKey(ownAp, enemyAp) {
  if (ownAp === 0 && enemyAp === 0) {
    return '0-0';
  }

  if (ownAp > 0 && enemyAp === 0) {
    return '1-0';
  }

  if (ownAp === 0 && enemyAp > 0) {
    return '0-1';
  }

  if (ownAp > enemyAp) {
    return '2-1';
  }

  if (ownAp < enemyAp) {
    return '1-2';
  }

  return '1-1';
}

function pickWeightedRivalMove(weightedMoves) {
  const totalWeight = weightedMoves.reduce((sum, move) => sum + move.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const move of weightedMoves) {
    if (roll < move.weight) {
      return move.moveId;
    }

    roll -= move.weight;
  }

  return weightedMoves[weightedMoves.length - 1].moveId;
}

async function restartMatch() {
  if (playMode === 'online') {
    leaveRanked();
    return;
  }

  if (isTransitioning) {
    return;
  }

  if (isMatchOver() || state.winner !== 'p1') {
    restartMusicTrackOnce('title', 'game');
  }
  unlockSceneAudio();
  resetMatchWins();
  loopToken += 1;
  isTransitioning = true;
  await playStarburstWipeTransition(setNewGame);
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

async function startLocalMatch(opponentId) {
  if (isTransitioning) {
    return;
  }

  selectedOpponentId = OPPONENTS[opponentId] ? opponentId : DEFAULT_OPPONENT_ID;
  playMode = 'local';
  requestMusicTrack('game');
  unlockSceneAudio();
  resetMatchWins();
  isTransitioning = true;
  await playStarburstWipeTransition(setNewGame);
  isTransitioning = false;
  render();
  beginOpeningCues();
}

async function continueMatch() {
  if (playMode === 'online') {
    return;
  }

  if (isTransitioning || roundPhase !== 'game-over' || isMatchOver()) {
    return;
  }

  requestMusicTrack('game');
  unlockSceneAudio();
  loopToken += 1;
  isTransitioning = true;
  await playStarburstWipeTransition(setNewGameAtReloadScene);
  isTransitioning = false;
  render();
}

async function quitLocalMatch() {
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
  await playStarburstWipeTransition(() => {
    resetMatchWins();
    state = createGameState();
    screen = 'title';
    roundPhase = 'idle';
    p1QueuedMove = null;
    rankedSnapshot = null;
    stagePresentation = { kind: 'doodle', name: 'reloading', flip: false };
    render();
  });
  isTransitioning = false;
  render();
}

function resetMatchWins() {
  matchWins = {
    p1: 0,
    p2: 0,
  };
  syncMusicTopper();
}

function isMatchOver() {
  return matchWins.p1 >= MATCH_TARGET_WINS || matchWins.p2 >= MATCH_TARGET_WINS;
}

function getMatchWinner() {
  if (matchWins.p1 >= MATCH_TARGET_WINS) {
    return 'p1';
  }

  if (matchWins.p2 >= MATCH_TARGET_WINS) {
    return 'p2';
  }

  return null;
}

function setNewGame() {
  state = createGameState();
  screen = 'playing';
  rankedSnapshot = null;
  roundPhase = 'intro-scene';
  p1QueuedMove = null;
  lastSceneAudioKey = null;
  lastMoves = {
    p1: 'reload',
    p2: 'reload',
  };
  stagePresentation = { kind: 'doodle', name: 'reloading', flip: false };
  render();
}

function setNewGameAtReloadScene() {
  setNewGame();
  roundPhase = 'scene';
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
  connectRankedSocket();
  render();
}

function connectRankedSocket() {
  closeRankedSocket();

  const socket = new WebSocket(getRankedSocketUrl());
  rankedSocket = socket;

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    handleRankedMessage(message);
  });

  socket.addEventListener('close', () => {
    if (playMode === 'online' && screen !== 'title' && rankedSocket === socket) {
      screen = 'title';
      rankedSnapshot = null;
      rankedSocket = null;
      render();
    }
  });
}

function getRankedSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.protocol === 'file:' ? 'localhost:8787' : window.location.host;
  const url = new URL(`${protocol}//${host}/ws`);

  if (rankedPlayerId) {
    url.searchParams.set('playerId', rankedPlayerId);
  }

  return url.toString();
}

function handleRankedMessage(message) {
  if (message.type === 'hello') {
    rankedPlayerId = message.playerId;
    writeLocalStorage(RANKED_PLAYER_ID_KEY, rankedPlayerId);
    sendRankedMessage({ type: 'joinRanked' });
    return;
  }

  if (message.type === 'queue') {
    screen = 'queue';
    render();
    return;
  }

  if (message.type === 'matchState') {
    applyRankedSnapshot(message);
  }
}

function applyRankedSnapshot(snapshot) {
  stopFindingMatchTicker();
  const previousPhase = rankedSnapshot?.phase;
  rankedSnapshot = snapshot;
  screen = 'playing';
  state = getLocalStateFromRankedSnapshot(snapshot);
  matchWins = getLocalScoreFromRankedSnapshot(snapshot);
  roundPhase = getRoundPhaseFromRankedSnapshot(snapshot);
  p1QueuedMove = snapshot.phase === 'choosing' ? p1QueuedMove : null;
  lastSceneAudioKey = previousPhase === snapshot.phase ? lastSceneAudioKey : null;

  if (snapshot.revealedMoves || snapshot.game.lastTurn) {
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
    round: snapshot.game.round,
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
    history: snapshot.game.lastTurn ? [snapshot.game.lastTurn] : [],
  };
}

function getLocalScoreFromRankedSnapshot(snapshot) {
  return {
    p1: snapshot.score[snapshot.playerKey],
    p2: snapshot.score[snapshot.opponentKey],
  };
}

function getRoundPhaseFromRankedSnapshot(snapshot) {
  if (snapshot.phase === 'countdown') {
    return 'ready';
  }

  if (snapshot.phase === 'choosing') {
    return 'go';
  }

  if (snapshot.phase === 'revealed') {
    return 'scene';
  }

  return 'game-over';
}

function getLocalMovesFromRankedSnapshot(snapshot) {
  const moves = snapshot.revealedMoves ?? {
    p1: snapshot.game.lastTurn?.p1Move ?? 'reload',
    p2: snapshot.game.lastTurn?.p2Move ?? 'reload',
  };

  return {
    p1: moves[snapshot.playerKey],
    p2: moves[snapshot.opponentKey],
  };
}

function submitRankedMove(moveId) {
  if (
    !rankedSocket ||
    rankedSocket.readyState !== WebSocket.OPEN ||
    !rankedSnapshot ||
    rankedSnapshot.phase !== 'choosing' ||
    p1QueuedMove ||
    !rankedSnapshot.players[rankedSnapshot.playerKey].legalMoves.includes(moveId)
  ) {
    return;
  }

  p1QueuedMove = moveId;
  sendRankedMessage({
    type: 'submitMove',
    matchId: rankedSnapshot.matchId,
    moveId,
  });
  render();
}

function sendRankedMessage(message) {
  if (rankedSocket?.readyState === WebSocket.OPEN) {
    rankedSocket.send(JSON.stringify(message));
  }
}

function leaveRanked() {
  closeRankedSocket();
  stopFindingMatchTicker();
  playMode = 'local';
  rankedSnapshot = null;
  screen = 'title';
  roundPhase = 'idle';
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

function closeRankedSocket() {
  if (rankedSocket) {
    rankedSocket.close();
    rankedSocket = null;
  }
}

function readLocalStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ranked still works for this tab; it just cannot persist the player id.
  }
}

function installAudioUnlockListeners() {
  const options = { capture: true, once: true };
  const unlock = () => unlockSceneAudio();

  window.addEventListener('pointerdown', unlock, options);
  window.addEventListener('keydown', unlock, options);
  window.addEventListener('touchstart', unlock, options);
}

function requestMusicTrack(trackId) {
  if (!MUSIC_TRACKS[trackId]) {
    return;
  }

  desiredMusicTrack = trackId;

  const context = getExistingSceneAudioContext();

  if (!context) {
    return;
  }

  loadSceneAudioBuffer(MUSIC_TRACKS[trackId]).then(() => syncMusicTrack());
  syncMusicTrack();
}

function queueMusicTrackOnce(trackId, returnTrackId) {
  if (!MUSIC_TRACKS[trackId] || !MUSIC_TRACKS[returnTrackId]) {
    return;
  }

  const context = getSceneAudioContext();

  if (!context) {
    return;
  }

  queuedMusicSegment = { trackId, returnTrackId };
  loadSceneAudioBuffer(MUSIC_TRACKS[trackId]).then(() => syncMusicTrack());
  loadSceneAudioBuffer(MUSIC_TRACKS[returnTrackId]);
  syncMusicTrack();
}

function restartMusicTrack(trackId) {
  if (!MUSIC_TRACKS[trackId]) {
    return;
  }

  desiredMusicTrack = trackId;
  queuedMusicTrack = null;
  queuedMusicSegment = null;

  const context = getSceneAudioContext();

  if (!context) {
    startHtmlMusicTrack(trackId, null);
    return;
  }

  stopCurrentMusicSegment();
  loadSceneAudioBuffer(MUSIC_TRACKS[trackId]).then((buffer) => {
    if (!buffer || context.state !== 'running') {
      return;
    }

    startMusicSegment(trackId, context.currentTime + 0.005, null);
  });
}

function restartMusicTrackOnce(trackId, returnTrackId) {
  if (!MUSIC_TRACKS[trackId] || !MUSIC_TRACKS[returnTrackId]) {
    return;
  }

  desiredMusicTrack = returnTrackId;
  queuedMusicTrack = null;
  queuedMusicSegment = null;

  const context = getSceneAudioContext();

  if (!context) {
    startHtmlMusicTrack(trackId, returnTrackId);
    return;
  }

  stopCurrentMusicSegment();
  loadSceneAudioBuffer(MUSIC_TRACKS[trackId]).then((buffer) => {
    if (!buffer || context.state !== 'running') {
      return;
    }

    loadSceneAudioBuffer(MUSIC_TRACKS[returnTrackId]);
    startMusicSegment(trackId, context.currentTime + 0.005, returnTrackId);
  });
}

function interruptMusicFileOnce(fileName, returnTrackId = desiredMusicTrack ?? 'game', resumeCurrentTrack = true) {
  if (!fileName) {
    return;
  }

  desiredMusicTrack = returnTrackId;
  queuedMusicTrack = null;
  queuedMusicSegment = null;

  const context = getSceneAudioContext();

  if (!context) {
    const audio = getSceneAudio(fileName);
    audio.muted = false;
    audio.volume = 1;
    audio.currentTime = 0;
    audio.onended = () => {
      if (returnTrackId) {
        startHtmlMusicTrack(returnTrackId, null);
      }
    };
    audio.play().catch((error) => {
      console.warn(`Could not play music interrupt: ${fileName}`, error);
    });
    return;
  }

  loadSceneAudioBuffer(fileName).then((buffer) => {
    if (!buffer || context.state !== 'running') {
      return;
    }

    if (returnTrackId && MUSIC_TRACKS[returnTrackId]) {
      loadSceneAudioBuffer(MUSIC_TRACKS[returnTrackId]);
    }

    const resumeSegment = resumeCurrentTrack ? getInterruptedMusicResumeSegment(returnTrackId) : null;
    stopCurrentMusicSegment();
    startMusicFileSegment(fileName, context.currentTime + 0.005, resumeSegment);
  });
}

function getInterruptedMusicResumeSegment(fallbackTrackId) {
  const context = getSceneAudioContext();

  if (!context || !currentMusicSegment?.trackId) {
    return fallbackTrackId ? { trackId: fallbackTrackId, returnTrackId: null, offset: 0 } : null;
  }

  const fileName = MUSIC_TRACKS[currentMusicSegment.trackId];
  const buffer = fileName ? sceneAudioBuffers.get(fileName) : null;

  if (!buffer) {
    return { trackId: currentMusicSegment.trackId, returnTrackId: currentMusicSegment.returnTrackId, offset: 0 };
  }

  const elapsed = Math.max(0, context.currentTime - currentMusicSegment.startTime);
  const offset = (currentMusicSegment.offset + elapsed) % buffer.duration;

  return {
    trackId: currentMusicSegment.trackId,
    returnTrackId: currentMusicSegment.returnTrackId,
    offset,
  };
}

function startMusicFileSegment(fileName, startAt, resumeSegment) {
  const context = getSceneAudioContext();
  const buffer = fileName ? sceneAudioBuffers.get(fileName) : null;

  if (!context || context.state !== 'running' || !buffer) {
    return;
  }

  const source = context.createBufferSource();
  const safeStartAt = Math.max(startAt, context.currentTime + 0.005);
  const segment = {
    trackId: null,
    returnTrackId: null,
    resumeSegment,
    source,
    startTime: safeStartAt,
    offset: 0,
    endTime: safeStartAt + buffer.duration,
  };

  source.buffer = buffer;
  source.connect(context.destination);
  source.onended = () => {
    if (currentMusicSegment?.source === source) {
      const nextResumeSegment = currentMusicSegment.resumeSegment;
      currentMusicSegment = null;
      stopMusicTopperSegment(source);
      resumeInterruptedMusic(nextResumeSegment);
      return;
    }

    stopMusicTopperSegment(source);
  };
  source.start(safeStartAt);
  currentMusicSegment = segment;
}

function resumeInterruptedMusic(resumeSegment) {
  const context = getSceneAudioContext();

  if (!context || context.state !== 'running') {
    syncMusicTrack();
    return;
  }

  if (!resumeSegment?.trackId || !MUSIC_TRACKS[resumeSegment.trackId]) {
    syncMusicTrack();
    return;
  }

  loadSceneAudioBuffer(MUSIC_TRACKS[resumeSegment.trackId]).then((buffer) => {
    if (!buffer || context.state !== 'running' || currentMusicSegment) {
      return;
    }

    startMusicSegment(
      resumeSegment.trackId,
      context.currentTime + 0.005,
      resumeSegment.returnTrackId,
      resumeSegment.offset,
    );
  });
}

function syncMusicTrack() {
  const context = getExistingSceneAudioContext();

  if (!context) {
    return;
  }

  if (context.state !== 'running' || !desiredMusicTrack) {
    return;
  }

  if (!currentMusicSegment) {
    const nextSegment = queuedMusicSegment;
    queuedMusicSegment = null;

    if (nextSegment) {
      startMusicSegment(nextSegment.trackId, context.currentTime + 0.02, nextSegment.returnTrackId);
      return;
    }

    startMusicSegment(desiredMusicTrack, context.currentTime + 0.02, null);
    return;
  }

  if (currentMusicSegment.trackId !== desiredMusicTrack) {
    queuedMusicTrack = desiredMusicTrack;
  }

  scheduleMusicBoundaryCheck();
}

function startMusicSegment(trackId, startAt, returnTrackId, offset = 0) {
  const context = getSceneAudioContext();
  const fileName = MUSIC_TRACKS[trackId];
  const buffer = fileName ? sceneAudioBuffers.get(fileName) : null;

  if (!context || context.state !== 'running' || !buffer) {
    if (fileName) {
      loadSceneAudioBuffer(fileName).then(() => syncMusicTrack());
    }

    return;
  }

  const source = context.createBufferSource();
  const safeStartAt = Math.max(startAt, context.currentTime + 0.005);
  const safeOffset = normalizeAudioOffset(offset, buffer.duration);
  const segment = {
    trackId,
    returnTrackId,
    source,
    startTime: safeStartAt,
    offset: safeOffset,
    endTime: safeStartAt + buffer.duration - safeOffset,
  };

  source.buffer = buffer;
  source.connect(context.destination);
  source.onended = () => {
    if (currentMusicSegment?.source === source) {
      currentMusicSegment = null;
      stopMusicTopperSegment(source);
      syncMusicTrack();
      return;
    }

    stopMusicTopperSegment(source);
  };
  source.start(safeStartAt, safeOffset);
  currentMusicSegment = segment;
  syncMusicTopperForSegment(segment, safeStartAt, safeOffset);
  scheduleMusicBoundaryCheck();
}

function normalizeAudioOffset(offset, duration) {
  if (!duration || duration <= 0) {
    return 0;
  }

  return ((offset % duration) + duration) % duration;
}

function stopCurrentMusicSegment() {
  clearTimeout(musicScheduleTimer);
  musicScheduleTimer = null;
  stopMusicTopperSegment();

  if (!currentMusicSegment) {
    return;
  }

  const source = currentMusicSegment.source;
  currentMusicSegment = null;
  source.onended = null;

  try {
    source.stop();
  } catch {
    // Already stopped.
  }
}

function shouldPlayMusicTopper() {
  return playMode === 'local'
    && !isMatchOver()
    && (matchWins.p1 === MATCH_TARGET_WINS - 1 || matchWins.p2 === MATCH_TARGET_WINS - 1);
}

function getMusicTopperFile() {
  if (!shouldPlayMusicTopper()) {
    return null;
  }

  if (matchWins.p1 === MATCH_TARGET_WINS - 1 && matchWins.p2 === MATCH_TARGET_WINS - 1) {
    return MUSIC_TOPPERS.final;
  }

  return MUSIC_TOPPERS.tension;
}

function syncMusicTopper() {
  const fileName = getMusicTopperFile();

  if (!fileName) {
    stopMusicTopperSegment();
    return;
  }

  loadSceneAudioBuffer(fileName).then(() => {
    if (!currentMusicSegment?.trackId || musicTopperSegment?.fileName === fileName) {
      return;
    }

    const context = getSceneAudioContext();

    if (!context || context.state !== 'running') {
      return;
    }

    const elapsed = Math.max(0, context.currentTime - currentMusicSegment.startTime);
    const offset = currentMusicSegment.offset + elapsed;
    syncMusicTopperForSegment(currentMusicSegment, context.currentTime + 0.005, offset);
  });
}

function syncMusicTopperForSegment(segment, startAt, offset = 0) {
  const fileName = getMusicTopperFile();

  if (!fileName) {
    stopMusicTopperSegment();
    return;
  }

  const context = getSceneAudioContext();
  const buffer = sceneAudioBuffers.get(fileName);

  if (!context || context.state !== 'running') {
    return;
  }

  if (!buffer) {
    loadSceneAudioBuffer(fileName);
    return;
  }

  stopMusicTopperSegment();

  const source = context.createBufferSource();
  const safeOffset = normalizeAudioOffset(offset, buffer.duration);
  source.buffer = buffer;
  source.connect(context.destination);
  source.onended = () => {
    if (musicTopperSegment?.source === source) {
      musicTopperSegment = null;
    }
  };
  source.start(startAt, safeOffset);
  musicTopperSegment = {
    source,
    baseSource: segment.source,
    fileName,
  };
}

function stopMusicTopperSegment(baseSource = null) {
  if (!musicTopperSegment || (baseSource && musicTopperSegment.baseSource !== baseSource)) {
    return;
  }

  const source = musicTopperSegment.source;
  musicTopperSegment = null;
  source.onended = null;

  try {
    source.stop();
  } catch {
    // Already stopped.
  }
}

function scheduleMusicBoundaryCheck() {
  clearTimeout(musicScheduleTimer);

  const context = getSceneAudioContext();

  if (!context || !currentMusicSegment) {
    return;
  }

  const delaySeconds = Math.max(
    0,
    currentMusicSegment.endTime - context.currentTime - MUSIC_SCHEDULE_LOOKAHEAD_SECONDS,
  );

  musicScheduleTimer = setTimeout(scheduleNextMusicSegment, delaySeconds * 1000);
}

function scheduleNextMusicSegment() {
  const context = getSceneAudioContext();

  if (!context || context.state !== 'running' || !currentMusicSegment) {
    syncMusicTrack();
    return;
  }

  const nextSegment = queuedMusicSegment;
  queuedMusicSegment = null;

  let nextTrack = nextSegment?.trackId
    ?? queuedMusicTrack
    ?? currentMusicSegment.returnTrackId
    ?? desiredMusicTrack;
  const returnTrackId = nextSegment?.returnTrackId ?? null;
  queuedMusicTrack = null;

  if (!nextTrack) {
    return;
  }

  if (!sceneAudioBuffers.has(MUSIC_TRACKS[nextTrack])) {
    if (nextSegment) {
      queuedMusicSegment = nextSegment;
    } else {
      queuedMusicTrack = nextTrack;
    }

    nextTrack = currentMusicSegment.trackId;
  }

  startMusicSegment(nextTrack, currentMusicSegment.endTime, returnTrackId);
}

function requestHtmlMusicTrack(trackId) {
  const fileName = MUSIC_TRACKS[trackId];

  if (!fileName || htmlMusicTrack === trackId) {
    return;
  }

  if (!htmlMusicAudio || htmlMusicAudio.ended || htmlMusicAudio.paused) {
    startHtmlMusicTrack(trackId, null);
    return;
  }

  queuedMusicTrack = trackId;
  htmlMusicAudio.loop = false;
}

function startHtmlMusicTrack(trackId, returnTrackId) {
  const fileName = MUSIC_TRACKS[trackId];

  if (!fileName) {
    return;
  }

  htmlMusicAudio = getSceneAudio(fileName);
  htmlMusicTrack = trackId;
  htmlMusicAudio.loop = false;
  htmlMusicAudio.muted = false;
  htmlMusicAudio.volume = 1;
  htmlMusicAudio.currentTime = 0;
  htmlMusicAudio.onended = () => {
    const nextTrack = returnTrackId ?? queuedMusicTrack ?? desiredMusicTrack;
    queuedMusicTrack = null;

    if (nextTrack) {
      startHtmlMusicTrack(nextTrack, null);
    }
  };
  htmlMusicAudio.play().catch((error) => {
    console.warn(`Could not play music track: ${fileName}`, error);
  });
}

function playStageAudio() {
  if (isTransitioning || stagePresentation.kind !== 'doodle') {
    return;
  }

  const fileName = SCENE_AUDIO[stagePresentation.name];

  if (!fileName) {
    return;
  }

  const audioKey = `${state.round}:${roundPhase}:${stagePresentation.name}:${stagePresentation.flip}`;

  if (audioKey === lastSceneAudioKey) {
    return;
  }

  lastSceneAudioKey = audioKey;
  playSceneAudio(fileName, audioKey);
}

function playSceneAudio(fileName, audioKey) {
  const context = getSceneAudioContext();

  if (!context) {
    playSceneHtmlAudio(fileName);
    return;
  }

  const buffer = sceneAudioBuffers.get(fileName);

  if (buffer) {
    playSceneAudioBuffer(buffer, audioKey);
    return;
  }

  loadSceneAudioBuffer(fileName).then((loadedBuffer) => {
    if (loadedBuffer) {
      playSceneAudioBuffer(loadedBuffer, audioKey);
      return;
    }

    if (audioKey === lastSceneAudioKey) {
      playSceneHtmlAudio(fileName);
    }
  });
}

function playOneShotAudio(fileName) {
  const context = getSceneAudioContext();

  if (!context) {
    playSceneHtmlAudio(fileName);
    return;
  }

  const buffer = sceneAudioBuffers.get(fileName);

  if (buffer) {
    startSceneAudioBuffer(context, buffer);
    return;
  }

  loadSceneAudioBuffer(fileName).then((loadedBuffer) => {
    if (loadedBuffer) {
      startSceneAudioBuffer(context, loadedBuffer);
      return;
    }

    playSceneHtmlAudio(fileName);
  });
}

function playSceneHtmlAudio(fileName) {
  const audio = getSceneAudio(fileName);
  audio.muted = false;
  audio.volume = 1;
  audio.currentTime = 0;
  audio.play().catch((error) => {
    console.warn(`Could not play scene audio: ${fileName}`, error);
  });
}

function unlockSceneAudio() {
  if (sceneAudioUnlockPromise) {
    return sceneAudioUnlockPromise;
  }

  const context = getSceneAudioContext();
  const audioFiles = getAudioFiles();

  if (!context) {
    audioFiles.forEach((fileName) => getSceneAudio(fileName).load());
    sceneAudioUnlockPromise = Promise.resolve();
    return sceneAudioUnlockPromise;
  }

  sceneAudioUnlockPromise = context.resume()
    .catch((error) => {
      console.warn('Could not unlock scene audio context', error);
    })
    .then(() => desiredMusicTrack ? loadSceneAudioBuffer(MUSIC_TRACKS[desiredMusicTrack]) : null)
    .then(() => syncMusicTrack())
    .then(() => Promise.all(audioFiles.map((fileName) => loadSceneAudioBuffer(fileName))))
    .then(() => syncMusicTrack())
    .then(() => undefined);

  return sceneAudioUnlockPromise;
}

function getAudioFiles() {
  return [
    ...new Set([
      ...Object.values(SCENE_AUDIO),
      STARBURST_WIPE_AUDIO,
      LOSE_JINGLE_AUDIO,
      WIN_SOUND_AUDIO,
      ...Object.values(MUSIC_TRACKS),
      ...Object.values(MUSIC_TOPPERS),
    ]),
  ];
}

function getSceneAudioContext() {
  if (sceneAudioContext) {
    return sceneAudioContext;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  sceneAudioContext = new AudioContextClass();
  return sceneAudioContext;
}

function getExistingSceneAudioContext() {
  return sceneAudioContext;
}

function loadSceneAudioBuffer(fileName) {
  if (sceneAudioBuffers.has(fileName) || sceneAudioLoadPromises.has(fileName)) {
    return sceneAudioLoadPromises.get(fileName) ?? Promise.resolve(sceneAudioBuffers.get(fileName));
  }

  const context = getSceneAudioContext();

  if (!context) {
    return Promise.resolve(null);
  }

  const promise = fetch(`./assets/audio/${fileName}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.arrayBuffer();
    })
    .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
    .then((buffer) => {
      sceneAudioBuffers.set(fileName, buffer);
      return buffer;
    })
    .catch((error) => {
      console.warn(`Could not load WebAudio scene audio: ${fileName}`, error);
      return null;
    });

  sceneAudioLoadPromises.set(fileName, promise);
  return promise;
}

function playSceneAudioBuffer(buffer, audioKey) {
  const context = getSceneAudioContext();

  if (!context || audioKey !== lastSceneAudioKey) {
    return;
  }

  if (context.state !== 'running') {
    context.resume()
      .then(() => {
        if (audioKey === lastSceneAudioKey && context.state === 'running') {
          startSceneAudioBuffer(context, buffer);
        }
      })
      .catch((error) => {
        console.warn('Could not resume scene audio context', error);
      });
    return;
  }

  startSceneAudioBuffer(context, buffer);
}

function startSceneAudioBuffer(context, buffer) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
}

function getSceneAudio(fileName) {
  if (sceneAudio.has(fileName)) {
    return sceneAudio.get(fileName);
  }

  const audio = new Audio(`./assets/audio/${fileName}`);
  audio.preload = 'auto';
  sceneAudio.set(fileName, audio);
  return audio;
}

function beginGameLoop() {
  loopToken += 1;
  setNewGame();
  beginOpeningCues();
}

function beginOpeningCues() {
  loopToken += 1;
  runOpeningCues(loopToken);
}

async function runOpeningCues(token) {
  roundPhase = 'intro-scene';
  await waitBeats(SCENE_BEATS, token);

  if (!isActiveLoop(token)) {
    return;
  }

  roundPhase = 'ready';
  stagePresentation = { kind: 'cue', name: 'READY' };
  render();
  await waitBeats(READY_BEATS, token);

  if (!isActiveLoop(token)) {
    return;
  }

  roundPhase = 'go';
  stagePresentation = { kind: 'cue', name: 'GO' };
  render();
}

async function resolvePlayerSelection() {
  const token = loopToken;

  if (!isActiveLoop(token) || isTransitioning || (roundPhase !== 'go' && roundPhase !== 'scene')) {
    return;
  }

  roundPhase = 'wipe';
  isTransitioning = true;
  await playStarburstWipeTransition(resolveQueuedRound);
  isTransitioning = false;

  if (isActiveLoop(token)) {
    render();
    maybeShowGameOverScene(token);
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
  return token === loopToken && screen === 'playing';
}

function resolveQueuedRound() {
  const p1Move = p1QueuedMove && canAfford(p1QueuedMove, state.players.p1.ap)
    ? p1QueuedMove
    : getFallbackMove('p1');
  const p2Move = chooseRivalMove();
  const turn = playRound(state, p1Move, p2Move);

  if (turn.ok) {
    state = turn.state;
    roundPhase = 'scene';
    lastMoves = {
      p1: p1Move,
      p2: p2Move,
    };
    stagePresentation = getDoodlePresentation(p1Move, p2Move);

    if (playMode === 'local' && state.status === 'finished' && state.winner === 'p2') {
      if (matchWins.p2 >= MATCH_TARGET_WINS - 1) {
        interruptMusicFileOnce(LOSE_JINGLE_AUDIO, null, false);
      } else {
        interruptMusicFileOnce(LOSE_JINGLE_AUDIO, 'game');
      }
    } else if (playMode === 'local' && state.status === 'finished' && state.winner === 'p1') {
      if (matchWins.p1 >= MATCH_TARGET_WINS - 1) {
        interruptMusicFileOnce(WIN_SOUND_AUDIO, null, false);
      } else {
        interruptMusicFileOnce(WIN_SOUND_AUDIO, 'game');
      }
    }
  }

  p1QueuedMove = null;
  render();
}

async function maybeShowGameOverScene(token) {
  if (!isActiveLoop(token) || state.status !== 'finished') {
    return;
  }

  await waitBeats(GAME_OVER_SCENE_BEATS, token);

  if (!isActiveLoop(token) || state.status !== 'finished') {
    return;
  }

  roundPhase = 'game-over';
  isTransitioning = true;
  await playStarburstWipeTransition(showGameOverScene);
  isTransitioning = false;

  if (isActiveLoop(token)) {
    render();
  }
}

function showGameOverScene() {
  if (state.winner) {
    matchWins[state.winner] += 1;
  }
  syncMusicTopper();

  if (playMode === 'local' && getMatchWinner() === 'p1') {
    defeatedOpponentIds.add(selectedOpponentId);
  }

  if (playMode === 'local' && !isMatchOver()) {
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

async function playStarburstWipeTransition(onCovered) {
  playOneShotAudio(STARBURST_WIPE_AUDIO);
  await preloadStarburstWipe();

  let overlay = createWipeOverlay();
  const coveredStep = 5;
  await animateWipeSteps(overlay, 0, coveredStep);

  onCovered();

  overlay = createWipeOverlay();
  drawWipeStep(overlay, STARBURST_WIPE_STEPS[coveredStep], performance.now());
  await animateWipeSteps(overlay, coveredStep + 1, STARBURST_WIPE_STEPS.length - 1);
  overlay.remove();
}

function createWipeOverlay() {
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
  return Promise.all([...images].map((name) => ensureImageLoaded(loadDoodleSheet(`starburst_wipe/${name}`))));
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

function getDoodleForMoves(p1Move, p2Move) {
  const sortedMoves = [p1Move, p2Move].sort((a, b) => MOVE_IDS.indexOf(a) - MOVE_IDS.indexOf(b));
  const key = sortedMoves.join('|');
  return INTERACTION_DOODLES[key] ?? 'hiding';
}

function getDoodlePresentation(p1Move, p2Move) {
  const name = getDoodleForMoves(p1Move, p2Move);

  return {
    kind: 'doodle',
    name,
    flip: shouldFlipDoodle(name, p1Move, p2Move),
  };
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

function mountSpriteRenderers(canvases) {
  doodleRenderers = [...canvases].map((canvas) => ({
    canvas,
    context: canvas.getContext('2d'),
    image: loadDoodleSheet(canvas.dataset.doodle),
    frameWidth: Number(canvas.dataset.frameWidth) || DOODLE_FRAME_WIDTH,
    frameHeight: Number(canvas.dataset.frameHeight) || DOODLE_FRAME_HEIGHT,
    flip: canvas.dataset.flip === 'true',
  }));

  drawDoodleFrame(performance.now());
  ensureDoodleLoop();
}

function loadDoodleSheet(doodle) {
  if (doodleSheets.has(doodle)) {
    return doodleSheets.get(doodle);
  }

  const image = new Image();
  image.src = `./assets/${doodle}_sheet.png`;
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
  });
}
