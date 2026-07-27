export const LOBBY_BOARD_COLORS = Object.freeze(['black', 'red', 'blue', 'purple', 'green']);

const COLOR_VALUES = Object.freeze({ black: '#191919', red: '#AC3235', blue: '#5703EF', purple: '#821B92', green: '#118040' });
const TOOL_LAYOUT = Object.freeze({
  black: Object.freeze({ x: 185, y: 591, width: 71, height: 14, heldWidth: 75, heldHeight: 64, hotspotX: 7, hotspotY: 57 }),
  red: Object.freeze({ x: 260, y: 591, width: 71, height: 14, heldWidth: 75, heldHeight: 64, hotspotX: 7, hotspotY: 57 }),
  blue: Object.freeze({ x: 335, y: 591, width: 71, height: 14, heldWidth: 75, heldHeight: 64, hotspotX: 7, hotspotY: 57 }),
  purple: Object.freeze({ x: 410, y: 591, width: 71, height: 14, heldWidth: 75, heldHeight: 64, hotspotX: 7, hotspotY: 57 }),
  green: Object.freeze({ x: 485, y: 591, width: 71, height: 14, heldWidth: 75, heldHeight: 64, hotspotX: 7, hotspotY: 57 }),
  erase: Object.freeze({ x: 570, y: 584, width: 67, height: 23, heldWidth: 144, heldHeight: 168, hotspotX: 72, hotspotY: 84 }),
});

export function createEmptyLobbyBoard() {
  return { width: 760, viewHeight: 450, maxHeight: 1575, rowHeight: 60, top: 0, nextY: 68, operations: [] };
}

export function createLobbyWhiteboard({ root, isActive, isBoilEnabled, mountSprites, sendStroke, sendErase, frameRate = 8, frameCount = 3 }) {
  let board = createEmptyLobbyBoard();
  let tool = 'scroll';
  let markerColor = 'black';
  let pointer = null;
  let activeStroke = null;
  let pendingTop = null;

  function setBoard(nextBoard) {
    board = nextBoard ?? createEmptyLobbyBoard();
    pendingTop = null;
    update(true);
  }

  function appendChat(message) {
    const normalized = {
      ...message,
      color: LOBBY_BOARD_COLORS.includes(message.color) ? message.color : 'black',
      rowY: Number.isFinite(message.rowY) ? message.rowY : board.nextY,
      rowSpan: Number.isFinite(message.rowSpan) ? message.rowSpan : Math.max(1, Math.min(3, Math.ceil(((message.displayName?.length ?? 0) + (message.text?.length ?? 0) + 2) / 37))),
    };
    board.operations.push({ kind: 'text', id: normalized.id, message: normalized });
    board.nextY = Math.max(board.nextY, normalized.rowY + (normalized.rowSpan * board.rowHeight));
    update(true);
    return normalized;
  }

  function appendOperation(operation) {
    if (!operation) return;
    board.operations.push(operation);
    update(true);
  }

  function trim(top) {
    if (!Number.isFinite(top)) return;
    if (activeStroke) { pendingTop = top; return; }
    applyTrim(top);
  }

  function renderTool(nextTool) {
    const layout = TOOL_LAYOUT[nextTool];
    const selected = nextTool === 'erase' ? tool === 'erase' : tool === 'marker' && markerColor === nextTool;
    const file = nextTool === 'erase' ? 'eraser_sheet.webp' : `${nextTool === 'purple' ? 'purp' : nextTool}-marker_sheet.webp`;
    const label = nextTool === 'erase' ? 'Eraser' : `${nextTool} marker`;
    return `<button class="whiteboard-tray-tool ${selected ? 'is-selected' : ''}" style="--tool-x:${(layout.x / 840) * 100}%;--tool-y:${(layout.y / 622) * 100}%;--tool-w:${(layout.width / 840) * 100}%;--tool-h:${(layout.height / 622) * 100}%" data-board-tool="${nextTool}" type="button" aria-label="${label}" aria-pressed="${selected}"><canvas class="sprite-canvas" data-doodle-file="${file}" data-frame-width="${layout.width}" data-frame-height="${layout.height}" width="${layout.width}" height="${layout.height}" aria-hidden="true"></canvas></button>`;
  }

  function renderHeldTool() {
    if (tool === 'scroll') return '';
    const heldTool = tool === 'erase' ? 'erase' : markerColor;
    const layout = TOOL_LAYOUT[heldTool];
    const file = heldTool === 'erase' ? 'eraser-held_sheet.webp' : `${heldTool === 'purple' ? 'purp' : heldTool}_marker-writing_sheet.webp`;
    const x = pointer?.x ?? layout.x + layout.hotspotX;
    const y = pointer?.y ?? layout.y + layout.hotspotY;
    return `<canvas class="sprite-canvas whiteboard-held-tool" style="--pointer-x:${(x / 840) * 100}%;--pointer-y:${(y / 622) * 100}%;--held-w:${(layout.heldWidth / 840) * 100}%;--held-h:${(layout.heldHeight / 622) * 100}%;--hotspot-x:${(layout.hotspotX / layout.heldWidth) * 100}%;--hotspot-y:${(layout.hotspotY / layout.heldHeight) * 100}%" data-doodle-file="${file}" data-frame-width="${layout.heldWidth}" data-frame-height="${layout.heldHeight}" width="${layout.heldWidth}" height="${layout.heldHeight}" aria-hidden="true"></canvas>`;
  }

  function selectTool(nextTool, event) {
    const selected = nextTool === 'erase' ? tool === 'erase' : tool === 'marker' && markerColor === nextTool;
    if (selected) { releaseTool(); return; }
    if (LOBBY_BOARD_COLORS.includes(nextTool)) { markerColor = nextTool; tool = 'marker'; }
    else if (nextTool === 'erase') tool = nextTool;
    updatePointer(event);
    root.querySelectorAll('[data-board-tool]').forEach((button) => {
      const isSelected = tool === 'erase' ? button.dataset.boardTool === 'erase' : button.dataset.boardTool === markerColor;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
    const canvas = root.querySelector('.whiteboard-canvas');
    if (canvas) canvas.dataset.tool = tool;
    root.querySelector('.whiteboard-tray-return-zone')?.classList.add('is-active');
    refreshHeldTool();
  }

  function releaseTool() {
    if (tool === 'scroll') return;
    tool = 'scroll'; pointer = null;
    root.querySelectorAll('[data-board-tool]').forEach((button) => { button.classList.remove('is-selected'); button.setAttribute('aria-pressed', 'false'); });
    const canvas = root.querySelector('.whiteboard-canvas');
    if (canvas) canvas.dataset.tool = 'scroll';
    root.querySelector('.whiteboard-tray-return-zone')?.classList.remove('is-active');
    root.querySelector('.whiteboard-held-tool')?.remove();
  }

  function followTool(event) {
    if (!isActive() || tool === 'scroll') return;
    updatePointer(event);
    const held = root.querySelector('.whiteboard-held-tool');
    if (!held || !pointer) return;
    held.style.setProperty('--pointer-x', `${(pointer.x / 840) * 100}%`);
    held.style.setProperty('--pointer-y', `${(pointer.y / 622) * 100}%`);
  }

  function releaseToolOutside(event) {
    if (!isActive() || tool === 'scroll' || event.target.closest?.('.whiteboard-frame')) return;
    releaseTool();
  }

  function mount() {
    const canvas = root.querySelector('.whiteboard-canvas');
    const scroll = root.querySelector('.whiteboard-scroll');
    if (!canvas || !scroll) return;
    canvas.dataset.tool = tool;
    draw(canvas); animate(canvas);
    requestAnimationFrame(() => { scroll.scrollTop = scroll.scrollHeight; });
    canvas.addEventListener('pointerdown', beginStroke);
    canvas.addEventListener('pointermove', continueStroke);
    canvas.addEventListener('pointerup', finishStroke);
    canvas.addEventListener('pointercancel', finishStroke);
    root.querySelector('[data-action="return-board-tool"]')?.addEventListener('pointerdown', releaseTool);
  }

  function beginStroke(event) {
    if (tool === 'scroll' || event.button > 0) return;
    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);
    activeStroke = { pointerId: event.pointerId, tool, color: markerColor, points: [getPoint(event, canvas)] };
    event.preventDefault();
  }

  function continueStroke(event) {
    if (!activeStroke || activeStroke.pointerId !== event.pointerId) return;
    const point = getPoint(event, event.currentTarget);
    const previous = activeStroke.points.at(-1);
    if (Math.hypot(point.x - previous.x, point.y - previous.y) < 1.5) return;
    activeStroke.points.push(point);
    if (activeStroke.points.length > 180) finishStroke(event);
    else draw(event.currentTarget, activeStroke);
    event.preventDefault();
  }

  function finishStroke(event) {
    if (!activeStroke || activeStroke.pointerId !== event.pointerId) return;
    const stroke = activeStroke;
    activeStroke = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (stroke.points.length > 1) stroke.tool === 'erase' ? sendErase(stroke.points) : sendStroke(stroke.points, stroke.color);
    if (pendingTop !== null) { applyTrim(pendingTop); pendingTop = null; }
  }

  function applyTrim(top) {
    const scroll = root.querySelector('.whiteboard-scroll');
    const oldTop = board.top;
    const oldScrollTop = scroll?.scrollTop ?? 0;
    board.top = top;
    board.operations = board.operations.filter((operation) => operation.kind !== 'text'
      ? operation.points?.some((point) => point.y >= top)
      : operation.message.rowY + (operation.message.rowSpan * board.rowHeight) > top);
    update(false);
    if (scroll && oldScrollTop > 0) {
      const pixelsPerUnit = scroll.scrollHeight / Math.max(board.viewHeight, board.nextY - oldTop);
      scroll.scrollTop = Math.max(0, oldScrollTop - ((top - oldTop) * pixelsPerUnit));
    }
  }

  function update(followNewContent) {
    if (!isActive()) return;
    const canvas = root.querySelector('.whiteboard-canvas');
    const scroll = root.querySelector('.whiteboard-scroll');
    if (!canvas || !scroll) return;
    const nearBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 45;
    draw(canvas, activeStroke);
    if (followNewContent && nearBottom) requestAnimationFrame(() => { scroll.scrollTop = scroll.scrollHeight; });
  }

  function draw(canvas, preview = null) {
    const height = Math.ceil(Math.max(board.viewHeight, board.nextY - board.top));
    const textCanvas = root.querySelector('.whiteboard-text-canvas');
    [canvas, textCanvas].filter(Boolean).forEach((layer) => {
      if (layer.width !== board.width) layer.width = board.width;
      if (layer.height !== height) layer.height = height;
      layer.style.height = `${(height / board.viewHeight) * 100}%`;
    });
    if (textCanvas) drawTextLayer(textCanvas, preview);
    drawDrawingLayer(canvas, preview, getBoilFrame());
  }

  function drawTextLayer(canvas, preview) {
    const context = canvas.getContext('2d'); context.clearRect(0, 0, canvas.width, canvas.height);
    [...board.operations, ...(preview?.tool === 'erase' ? [preview] : [])].forEach((operation) => {
      if (operation.kind === 'text') drawText(context, operation.message);
      else if (operation.kind === 'erase' || operation.tool === 'erase') drawPath(context, operation, 0, false);
    });
  }

  function drawDrawingLayer(canvas, preview, boilFrame) {
    const context = canvas.getContext('2d'); context.clearRect(0, 0, canvas.width, canvas.height);
    [...board.operations, ...(preview ? [preview] : [])].forEach((operation) => {
      if (operation.kind !== 'text') drawPath(context, operation, boilFrame, isBoilEnabled());
    });
  }

  function drawPath(context, operation, boilFrame, shouldBoil) {
    const points = operation.points ?? [];
    if (points.length < 2) return;
    context.save();
    const eraser = operation.kind === 'erase' || operation.tool === 'erase';
    context.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
    context.strokeStyle = COLOR_VALUES[operation.color] ?? COLOR_VALUES.black;
    context.lineWidth = (operation.width ?? (eraser ? 120 : 5)) + (shouldBoil ? boilOffset(operation, -1, 'w', boilFrame) * .35 : 0);
    context.lineCap = 'round'; context.lineJoin = 'round'; context.beginPath();
    const first = boiledPoint(points[0], operation, 0, boilFrame, shouldBoil);
    context.moveTo(first.x, first.y - board.top);
    points.slice(1).forEach((point, index) => { const next = boiledPoint(point, operation, index + 1, boilFrame, shouldBoil); context.lineTo(next.x, next.y - board.top); });
    context.stroke(); context.restore();
  }

  function drawText(context, message) {
    const prefix = message.system ? '' : `${message.displayName}: `;
    const lines = wrapText(context, `${prefix}${message.text}`, message.rowSpan);
    context.save(); context.fillStyle = COLOR_VALUES[message.color] ?? COLOR_VALUES.black;
    context.font = '38px "Architects Daughter", sans-serif'; context.textBaseline = 'top';
    lines.forEach((line, index) => context.fillText(line, 18, message.rowY - board.top + (index * 48), board.width - 36));
    context.restore();
  }

  function wrapText(context, text, maxLines) {
    context.font = '38px "Architects Daughter", sans-serif';
    const lines = []; let line = '';
    text.split(' ').forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > board.width - 36 && lines.length < maxLines - 1) { lines.push(line); line = word; }
      else line = candidate;
    });
    lines.push(line); return lines.slice(0, maxLines);
  }

  function animate(canvas) {
    let previousFrame = -1;
    function tick() {
      if (!canvas.isConnected) return;
      const nextFrame = getBoilFrame();
      if (nextFrame !== previousFrame) { previousFrame = nextFrame; drawDrawingLayer(canvas, activeStroke, nextFrame); }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function getBoilFrame() { return isBoilEnabled() ? Math.floor((performance.now() / 1000) * frameRate) % frameCount : 0; }
  function boiledPoint(point, operation, index, frame, enabled) { return enabled ? { x: point.x + boilOffset(operation, index, 'x', frame) * 1.15, y: point.y + boilOffset(operation, index, 'y', frame) * 1.15 } : point; }
  function boilOffset(operation, index, axis, frame) {
    const key = `${operation.id ?? 'preview'}:${index}:${axis}:${frame}`; let hash = 2166136261;
    for (let index = 0; index < key.length; index += 1) { hash ^= key.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return ((hash >>> 0) % 2001) / 1000 - 1;
  }
  function getPoint(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    return { x: Math.max(0, Math.min(board.width, ((event.clientX - rect.left) / rect.width) * board.width)), y: board.top + Math.max(0, Math.min(canvas.height, ((event.clientY - rect.top) / rect.height) * canvas.height)) };
  }
  function updatePointer(event) {
    const frame = root.querySelector('.whiteboard-frame');
    if (!frame || !Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)) return;
    const rect = frame.getBoundingClientRect(); pointer = { x: ((event.clientX - rect.left) / rect.width) * 840, y: ((event.clientY - rect.top) / rect.height) * 622 };
  }
  function refreshHeldTool() {
    root.querySelector('.whiteboard-held-tool')?.remove();
    const tray = root.querySelector('.whiteboard-tool-tray');
    if (!tray || tool === 'scroll') return;
    tray.insertAdjacentHTML('afterend', renderHeldTool()); mountSprites(root.querySelectorAll('.sprite-canvas'));
  }
  return Object.freeze({
    appendChat, appendOperation, followTool, getMarkerColor: () => markerColor, isToolHeld: () => tool !== 'scroll',
    mount, releaseTool, releaseToolOutside, renderHeldTool, renderTool, selectTool, setBoard, trim,
  });
}
