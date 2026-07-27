const STANDOFF_PRESENTATION = Object.freeze({
  kind: 'doodle',
  name: 'rps-poker/poker-standoff',
  flip: false,
});

const TABLE_PRESENTATION = Object.freeze({
  kind: 'doodle',
  name: 'rps-poker/table-blank',
  flip: false,
});

const DEAL_PRESENTATION = Object.freeze({
  kind: 'rps-poker-table',
  name: 'rps-poker-card-deal',
  animateDeal: true,
});

const DEALT_PRESENTATION = Object.freeze({
  kind: 'rps-poker-table',
  name: 'rps-poker-card-dealt',
  animateDeal: false,
});

export const RPS_POKER_DEAL_DURATION_MS = 625;
export const RPS_POKER_CLEAR_DURATION_MS = 625;
const CARD_READY_FRAME_MS = 58;
const CARD_READY_FRAME_COUNT = 7;
export const RPS_POKER_READY_DURATION_MS = 8 * CARD_READY_FRAME_MS;
export const RPS_POKER_FLIP_DURATION_MS = 6 * 84;
const cardReadyImages = new Map();
const communityFlipImages = new Map();
const turnBetweenImages = new Map();
export const RPS_POKER_TURN_SWING_DURATION_MS = 5 * 84;
export const RPS_POKER_TURN_CENTER_DURATION_MS = 3 * 84;

export function getRpsPokerIdlePresentation() {
  return TABLE_PRESENTATION;
}

export function getRpsPokerStandoffPresentation() {
  return STANDOFF_PRESENTATION;
}

export function isRpsPokerStandoff(presentation) {
  return presentation?.kind === 'doodle'
    && presentation.name === STANDOFF_PRESENTATION.name;
}

export async function playRpsPokerOpening({
  isActive,
  preload,
  renderPresentation,
  waitBeats,
  waitMilliseconds,
  spikeWipe,
}) {
  if (!isActive()) return false;

  await preload();
  if (!isActive()) return false;

  renderPresentation(STANDOFF_PRESENTATION);
  await waitBeats(2);

  if (!isActive()) return false;

  await spikeWipe(() => renderPresentation(TABLE_PRESENTATION));

  if (!isActive()) return false;

  renderPresentation(DEAL_PRESENTATION);
  await waitMilliseconds(RPS_POKER_DEAL_DURATION_MS);

  if (!isActive()) return false;

  renderPresentation(DEALT_PRESENTATION);
  return true;
}

export function renderRpsPokerStage(presentation) {
  if (presentation?.kind !== 'rps-poker-table') return '';

  const community = presentation.community;
  return `
    <div class="rps-poker-table">
      <canvas
        class="sprite-canvas rps-poker-table-art"
        data-doodle="rps-poker/table-blank"
        width="512"
        height="256"
        aria-hidden="true"
      ></canvas>
      ${community
        ? presentation.animateCommunity === true
          ? `<canvas
              class="rps-poker-community-flip"
              data-community="${community}"
              data-animate="true"
              width="150"
              height="200"
              aria-hidden="true"
            ></canvas>`
          : `<canvas
              class="sprite-canvas rps-poker-dealt-card${presentation.clearing ? ' is-clearing' : ''}"
              data-doodle="${getRpsPokerMoveCardDoodle(community)}"
              data-frame-width="128"
              data-frame-height="175"
              width="128"
              height="175"
              aria-hidden="true"
            ></canvas>`
        : `<canvas
            class="sprite-canvas rps-poker-dealt-card${presentation.animateDeal ? ' is-dealing' : ''}"
            data-doodle="rps-poker/cardback"
            data-frame-width="128"
            data-frame-height="175"
            width="128"
            height="175"
            aria-hidden="true"
          ></canvas>`}
    </div>
  `;
}

export function getRpsPokerCommunityPresentation(community, animateCommunity, { clearing = false } = {}) {
  return {
    kind: 'rps-poker-table',
    name: `rps-poker-community-${community}`,
    community,
    animateCommunity,
    clearing,
  };
}

export function renderRpsPokerReadyOverlay(readyWaiting) {
  if (!readyWaiting?.readyPlayerId) return '';

  if (readyWaiting.phase === 'countdown' || readyWaiting.phase === 'clearing') {
    return `
      <canvas
        class="sprite-canvas rps-poker-facedown-card ${readyWaiting.readyPlayerId}${readyWaiting.phase === 'clearing' ? ' is-clearing' : ''}"
        data-doodle="rps-poker/cardback-side"
        data-frame-width="175"
        data-frame-height="128"
        width="175"
        height="128"
        aria-hidden="true"
      ></canvas>
    `;
  }

  return `
    <canvas
      class="rps-poker-ready-overlay ${readyWaiting.readyPlayerId}"
      data-ready-phase="${readyWaiting.phase}"
      data-direction="${readyWaiting.phase === 'reverse' ? 'reverse' : 'forward'}"
      width="280"
      height="256"
      aria-hidden="true"
    ></canvas>
  `;
}

export function renderRpsPokerReadyCards({
  earlyPlayerId,
  latePlayerId = null,
  animateEarly = false,
  animateLate = false,
  reversePlayerId = null,
  hiddenPlayerId = null,
  clearingPlayerId = null,
  revealedMoves = null,
  animateReveal = false,
  clearingRevealed = false,
}) {
  return [earlyPlayerId, latePlayerId].filter(Boolean).map((playerId) => {
    if (playerId === hiddenPlayerId) return '';
    if (revealedMoves?.[playerId]) {
      return renderRpsPokerRevealedCard(
        playerId,
        revealedMoves[playerId],
        animateReveal,
        clearingRevealed,
      );
    }
    const phase = playerId === clearingPlayerId
      ? 'clearing'
      : playerId === reversePlayerId
      ? 'reverse'
      : playerId === earlyPlayerId && animateEarly
        ? 'safe'
        : playerId === latePlayerId && animateLate
          ? 'safe'
          : 'countdown';
    return renderRpsPokerReadyOverlay({ readyPlayerId: playerId, phase });
  }).join('');
}

function renderRpsPokerRevealedCard(playerId, moveId, animate, clearing) {
  if (animate) {
    return `
      <canvas
        class="rps-poker-player-flip ${playerId}"
        data-move="${moveId}"
        width="200"
        height="150"
        aria-hidden="true"
      ></canvas>
    `;
  }
  const sideMove = moveId === 'scissors' ? 'sci' : moveId;
  return `
    <canvas
      class="sprite-canvas rps-poker-revealed-card ${playerId}${clearing ? ' is-clearing' : ''}"
      data-doodle="rps-poker/${sideMove}-card-side"
      data-frame-width="175"
      data-frame-height="128"
      width="175"
      height="128"
      aria-hidden="true"
    ></canvas>
  `;
}

export function mountRpsPokerReadyOverlays(canvases) {
  [...canvases].forEach((canvas) => startCardReadyAnimation(canvas));
}

export function mountRpsPokerCommunityFlips(canvases) {
  [...canvases].forEach((canvas) => startCommunityFlip(canvas));
}

export function mountRpsPokerPlayerFlips(canvases) {
  [...canvases].forEach((canvas) => startPlayerFlip(canvas));
}

export function preloadRpsPokerReadyAnimation() {
  return Promise.all([
    ...Array.from({ length: CARD_READY_FRAME_COUNT }, (_, index) => loadCardReadyImage(`frame${index + 1}`)),
    loadCardReadyImage('hold-frame'),
  ]);
}

export function preloadRpsPokerCommunityFlips() {
  return Promise.all(['rock', 'paper', 'sci'].flatMap((move) => [
    ...Array.from({ length: 3 }, (_, index) => loadCommunityFlipImage(`frame${index + 1}`)),
    ...Array.from({ length: 3 }, (_, index) => loadCommunityFlipImage(`frame${index + 4}-${move}`)),
  ]));
}

export function preloadRpsPokerPlayerFlips() {
  return Promise.all(['rock', 'paper', 'sci'].flatMap((move) => [
    ...Array.from({ length: 3 }, (_, index) => loadCommunityFlipImage(`frame${index + 1}-side`)),
    ...Array.from({ length: 3 }, (_, index) => loadCommunityFlipImage(`frame${index + 4}-${move}-side`)),
  ]));
}

async function startCardReadyAnimation(canvas) {
  const hold = canvas.dataset.readyPhase === 'countdown';
  const reverse = canvas.dataset.direction === 'reverse';
  const names = hold
    ? ['hold-frame']
    : reverse
      ? Array.from({ length: CARD_READY_FRAME_COUNT }, (_, index) => `frame${CARD_READY_FRAME_COUNT - index}`)
      : [
        ...Array.from({ length: CARD_READY_FRAME_COUNT }, (_, index) => `frame${index + 1}`),
        'hold-frame',
      ];
  const images = await Promise.all(names.map(loadCardReadyImage));

  if (!canvas.isConnected) return;

  const context = canvas.getContext('2d');
  if (!context) return;
  context.imageSmoothingEnabled = false;

  const startedAt = performance.now();

  function tick(now) {
    if (!canvas.isConnected) return;

    const elapsed = now - startedAt;
    const movementFrame = hold
      ? 0
      : Math.min(images.length - 1, Math.floor(elapsed / CARD_READY_FRAME_MS));
    const boilFrame = Math.floor(elapsed / 125) % 3;
    drawCardReadyFrame(canvas, context, images[movementFrame], boilFrame);
    window.requestAnimationFrame(tick);
  }

  window.requestAnimationFrame(tick);
}

function loadCardReadyImage(name) {
  if (!cardReadyImages.has(name)) {
    const image = new Image();
    const loaded = new Promise((resolve) => {
      image.addEventListener('load', () => resolve(image), { once: true });
      image.addEventListener('error', () => resolve(image), { once: true });
    });
    image.src = `./assets/rps-poker/card-rdy-animation/${name}_sheet.webp`;
    cardReadyImages.set(name, loaded);
  }

  return cardReadyImages.get(name);
}

function drawCardReadyFrame(canvas, context, image, boilFrame) {
  if (!image?.naturalWidth) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    0,
    boilFrame * 256,
    280,
    256,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

async function startCommunityFlip(canvas) {
  const community = canvas.dataset.community === 'scissors' ? 'sci' : canvas.dataset.community;
  const animate = canvas.dataset.animate === 'true';
  const names = animate
    ? [
      'frame1',
      'frame2',
      'frame3',
      `frame4-${community}`,
      `frame5-${community}`,
      `frame6-${community}`,
    ]
    : [`frame6-${community}`];
  const images = await Promise.all(names.map(loadCommunityFlipImage));

  if (!canvas.isConnected) return;

  const context = canvas.getContext('2d');
  if (!context) return;
  context.imageSmoothingEnabled = false;

  let frame = 0;
  drawCommunityFlipFrame(canvas, context, images[frame]);
  if (!animate) return;

  const timer = window.setInterval(() => {
    if (!canvas.isConnected || frame >= images.length - 1) {
      window.clearInterval(timer);
      return;
    }
    frame += 1;
    drawCommunityFlipFrame(canvas, context, images[frame]);
  }, 84);
}

function loadCommunityFlipImage(name) {
  if (!communityFlipImages.has(name)) {
    const image = new Image();
    const loaded = new Promise((resolve) => {
      image.addEventListener('load', () => resolve(image), { once: true });
      image.addEventListener('error', () => resolve(image), { once: true });
    });
    image.src = `./assets/rps-poker/flip/${name}.webp`;
    communityFlipImages.set(name, loaded);
  }
  return communityFlipImages.get(name);
}

function drawCommunityFlipFrame(canvas, context, image) {
  if (!image?.naturalWidth) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
}

async function startPlayerFlip(canvas) {
  const move = canvas.dataset.move === 'scissors' ? 'sci' : canvas.dataset.move;
  const names = [
    'frame1-side',
    'frame2-side',
    'frame3-side',
    `frame4-${move}-side`,
    `frame5-${move}-side`,
    `frame6-${move}-side`,
  ];
  const images = await Promise.all(names.map(loadCommunityFlipImage));
  if (!canvas.isConnected) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.imageSmoothingEnabled = false;
  let frame = 0;
  drawCommunityFlipFrame(canvas, context, images[frame]);
  const timer = window.setInterval(() => {
    if (!canvas.isConnected || frame >= images.length - 1) {
      window.clearInterval(timer);
      return;
    }
    frame += 1;
    drawCommunityFlipFrame(canvas, context, images[frame]);
  }, 84);
}

const CHIP_BANK_OFFSETS = Object.freeze([
  Object.freeze({ x: 30, y: 0, layer: 0 }),
  Object.freeze({ x: 0, y: 36, layer: 10 }),
  Object.freeze({ x: 60, y: 36, layer: 20 }),
]);

const RPS_POKER_MOVE_CARDS = Object.freeze({
  rock: 'rps-poker/rock-card',
  paper: 'rps-poker/paper-card',
  scissors: 'rps-poker/sci-card',
});

export function getRpsPokerMoveCardDoodle(moveId) {
  return RPS_POKER_MOVE_CARDS[moveId] ?? '';
}

export function renderRpsPokerAnteTurn(ante, actor, transition = null) {
  const safeAnte = Math.max(1, Math.min(9, Number(ante) || 1));
  const arrow = actor === 'p2' ? 'turn-right' : actor === 'p1' ? 'turn-left' : 'down';
  const arrowWidth = actor === 'p2' ? 131 : actor === 'p1' ? 110 : 116;
  const arrowHeight = actor === 'p2' ? 109 : actor === 'p1' ? 99 : 123;
  return `
    <div class="rps-poker-ante-turn">
      ${transition
        ? `<canvas
            class="rps-poker-turn-swing"
            data-direction="${transition.to === 'center'
              ? transition.from === 'p2' ? 'right-to-center' : 'left-to-center'
              : transition.from === 'p2' ? 'right-to-left' : 'left-to-right'}"
            width="400"
            height="220"
            aria-hidden="true"
          ></canvas>`
        : `<canvas
            class="sprite-canvas rps-poker-turn-arrow ${actor === 'p2' ? 'right' : actor === 'p1' ? 'left' : 'down'}"
            data-doodle="rps-poker/ante-turns/${arrow}"
            data-frame-width="${arrowWidth}"
            data-frame-height="${arrowHeight}"
            width="${arrowWidth}"
            height="${arrowHeight}"
            aria-hidden="true"
          ></canvas>`}
      <canvas
        class="sprite-canvas rps-poker-ante"
        data-doodle="rps-poker/ante-turns/ante${safeAnte}"
        data-frame-width="256"
        data-frame-height="128"
        width="256"
        height="128"
        aria-label="Ante ${safeAnte}"
      ></canvas>
    </div>
  `;
}

export function mountRpsPokerTurnSwings(canvases) {
  [...canvases].forEach((canvas) => startTurnSwing(canvas));
}

export function preloadRpsPokerTurnSwings() {
  return Promise.all(Array.from({ length: 5 }, (_, index) => loadTurnBetweenImage(index + 1)));
}

async function startTurnSwing(canvas) {
  const frameNumbers = {
    'left-to-right': [1, 2, 3, 4, 5],
    'right-to-left': [5, 4, 3, 2, 1],
    'left-to-center': [1, 2, 3],
    'right-to-center': [5, 4, 3],
  }[canvas.dataset.direction] ?? [1, 2, 3, 4, 5];
  const frames = await Promise.all(frameNumbers.map(loadTurnBetweenImage));
  if (!canvas.isConnected) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.imageSmoothingEnabled = false;
  let index = 0;

  function draw() {
    if (!canvas.isConnected) return;
    const image = frames[index];
    const positions = [
      { x: 110, y: 71 },
      { x: 129, y: 84 },
      { x: 142, y: 98 },
      { x: 158, y: 84 },
      { x: 178, y: 71 },
    ];
    const position = positions[frameNumbers[index] - 1];
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, position.x, position.y);
    index += 1;
    if (index < frames.length) window.setTimeout(draw, 84);
  }

  draw();
}

function loadTurnBetweenImage(number) {
  if (!turnBetweenImages.has(number)) {
    const image = new Image();
    const loaded = new Promise((resolve) => {
      image.addEventListener('load', () => resolve(image), { once: true });
      image.addEventListener('error', () => resolve(image), { once: true });
    });
    image.src = `./assets/rps-poker/ante-turns/between${number}.webp`;
    turnBetweenImages.set(number, loaded);
  }
  return turnBetweenImages.get(number);
}

export function renderRpsPokerChips(playerId, chipCount) {
  const count = Math.max(0, Math.min(18, Number(chipCount) || 0));
  const chips = [];

  for (let index = 0; index < count; index += 1) {
    const bank = Math.floor(index / 9);
    const bankIndex = index % 9;
    const stack = Math.floor(bankIndex / 3);
    const chip = bankIndex % 3;
    const anchor = CHIP_BANK_OFFSETS[stack];
    const jitterX = chipJitter(playerId, bank, stack, chip, 0);
    const jitterY = chipJitter(playerId, bank, stack, chip, 1);
    const left = anchor.x + jitterX;
    const top = (bank * 105) + anchor.y + ((2 - chip) * 9) + jitterY;
    const layer = anchor.layer + chip;

    chips.push(`
      <canvas
        class="sprite-canvas rps-poker-chip"
        data-doodle="rps-poker/chip"
        data-frame-width="60"
        data-frame-height="60"
        width="60"
        height="60"
        style="left:${left}px; top:${top}px; z-index:${layer};"
        aria-hidden="true"
      ></canvas>
    `);
  }

  return `<div class="rps-poker-chip-bank">${chips.join('')}</div>`;
}

export function renderRpsPokerPot({ ante, committed, pot, counts: providedCounts = null }) {
  const p1Count = Math.max(0, Math.min(18, providedCounts?.p1 ?? ((Number(ante) || 0) + (Number(committed?.p1) || 0))));
  const p2Count = Math.max(0, Math.min(18, providedCounts?.p2 ?? ((Number(ante) || 0) + (Number(committed?.p2) || 0))));
  const represented = p1Count + p2Count;
  const fallback = Math.max(0, Math.min(18, Number(pot) || 0));
  const counts = providedCounts
    ? { p1: p1Count, p2: p2Count }
    : represented === fallback
    ? { p1: p1Count, p2: p2Count }
    : { p1: Math.ceil(fallback / 2), p2: Math.floor(fallback / 2) };

  return `
    <div class="rps-poker-pot">
      ${renderSmallChipPile('p1', counts.p1)}
      ${renderSmallChipPile('p2', counts.p2)}
    </div>
  `;
}

export function getRpsPokerPotCounts({ ante, committed }) {
  return {
    p1: Math.max(0, Math.min(18, (Number(ante) || 0) + (Number(committed?.p1) || 0))),
    p2: Math.max(0, Math.min(18, (Number(ante) || 0) + (Number(committed?.p2) || 0))),
  };
}

export function renderRpsPokerHandReminder(moveId) {
  const doodle = getRpsPokerMoveCardDoodle(moveId);
  if (!doodle) return '';
  return `
    <canvas
      class="sprite-canvas rps-poker-hand-reminder"
      data-doodle="${doodle}"
      data-frame-width="128"
      data-frame-height="175"
      width="128"
      height="175"
      aria-label="${moveId}"
    ></canvas>
  `;
}

function renderSmallChipPile(playerId, chipCount) {
  const chips = [];
  for (let index = 0; index < chipCount; index += 1) {
    const bank = Math.floor(index / 9);
    const bankIndex = index % 9;
    const stack = Math.floor(bankIndex / 3);
    const chip = bankIndex % 3;
    const anchor = CHIP_BANK_OFFSETS[stack];
    const jitterX = smallChipJitter(playerId, bank, stack, chip, 0);
    const jitterY = smallChipJitter(playerId, bank, stack, chip, 1);
    const left = (bank * 62) + (anchor.x / 2) + jitterX;
    const top = (anchor.y / 2) + ((2 - chip) * 5) + jitterY;
    const layer = anchor.layer + chip;
    chips.push(`
      <canvas
        class="sprite-canvas rps-poker-pot-chip"
        data-doodle="rps-poker/chip-sm"
        data-frame-width="30"
        data-frame-height="30"
        width="30"
        height="30"
        style="left:${left}px; top:${top}px; z-index:${layer};"
        aria-hidden="true"
      ></canvas>
    `);
  }
  return `<div class="rps-poker-pot-pile ${playerId}">${chips.join('')}</div>`;
}

function smallChipJitter(playerId, bank, stack, chip, axis) {
  const playerSeed = playerId === 'p2' ? 19 : 5;
  const seed = playerSeed + (bank * 23) + (stack * 11) + (chip * 7) + (axis * 3);
  return ((seed * 7) % 3) - 1;
}

function chipJitter(playerId, bank, stack, chip, axis) {
  const playerSeed = playerId === 'p2' ? 31 : 7;
  const seed = playerSeed + (bank * 43) + (stack * 17) + (chip * 11) + (axis * 5);
  return ((seed * 13) % 7) - 3;
}
