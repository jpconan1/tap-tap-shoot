const FRAME_SIZES = Object.freeze({
  landscape: Object.freeze({ width: 960, height: 540 }),
  portrait: Object.freeze({ width: 540, height: 960 }),
});
const STORAGE_KEY = 'tapTapShoot.layoutTool.v1';
const DEFAULT_FRAME_COUNT = 3;

const stage = document.querySelector('[data-stage]');
const assetList = document.querySelector('[data-asset-list]');
const inspector = document.querySelector('[data-inspector]');
const emptySelection = document.querySelector('[data-empty-selection]');
const layerList = document.querySelector('[data-layer-list]');
const saveStatus = document.querySelector('[data-save-status]');
const importFile = document.querySelector('[data-import-file]');

let orientation = 'landscape';
let selectedId = null;
let catalog = [];
let drag = null;
let layouts = loadLayouts();

boot();

async function boot() {
  catalog = getElementCatalog().map(createPendingCatalogItem);
  renderElementList();
  render();
  Promise.all(getElementCatalog().map(loadElementMetadata)).then((loadedCatalog) => {
    catalog = loadedCatalog;
    renderElementList();
  });

  document.querySelectorAll('[data-orientation]').forEach((button) => {
    button.addEventListener('click', () => setOrientation(button.dataset.orientation));
  });
  document.querySelector('[data-action="export"]').addEventListener('click', exportLayouts);
  document.querySelector('[data-action="import"]').addEventListener('click', () => importFile.click());
  document.querySelector('[data-action="clear"]').addEventListener('click', clearLayout);
  document.querySelector('[data-action="mirror"]').addEventListener('click', mirrorSelected);
  document.querySelector('[data-action="duplicate"]').addEventListener('click', duplicateSelected);
  document.querySelector('[data-action="delete"]').addEventListener('click', deleteSelected);
  document.querySelector('[data-action="backward"]').addEventListener('click', () => moveLayer(-1));
  document.querySelector('[data-action="forward"]').addEventListener('click', () => moveLayer(1));

  importFile.addEventListener('change', importLayouts);
  inspector.addEventListener('input', updateSelectedFromInspector);
  stage.addEventListener('pointerdown', beginDrag);
  stage.addEventListener('click', selectFromStage);
  stage.addEventListener('keydown', handleStageKeydown);
  window.addEventListener('pointermove', continueDrag);
  window.addEventListener('pointerup', endDrag);
}

function getElementCatalog() {
  if (Array.isArray(window.LAYOUT_ELEMENTS)) {
    return window.LAYOUT_ELEMENTS;
  }

  return (window.LAYOUT_ASSETS ?? []).map((path) => ({
    key: getAssetName(path),
    name: getAssetName(path),
    asset: path,
  }));
}

function createPendingCatalogItem(definition) {
  return {
    kind: definition.kind ?? 'image',
    key: definition.key,
    name: definition.name,
    text: definition.text ?? definition.name,
    asset: definition.asset ?? '',
    frame: definition.frame ?? 0,
    frameCount: 1,
    width: definition.width ?? 256,
    height: definition.height ?? 128,
    sourceWidth: definition.width ?? 256,
    sourceHeight: definition.height ?? 128,
    frameIndex: 0,
  };
}

function loadElementMetadata(definition) {
  if ((definition.kind ?? 'image') === 'text') {
    return Promise.resolve(createPendingCatalogItem(definition));
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () => {
      const frameCount = getFrameCount(definition.asset);
      const frameHeight = Math.round(image.naturalHeight / frameCount);
      const frameIndex = definition.frame === 'last'
        ? frameCount - 1
        : clampInteger(definition.frame, 0, frameCount - 1);
      resolve({
        ...createPendingCatalogItem(definition),
        frameCount,
        width: definition.width ?? image.naturalWidth,
        height: definition.height ?? frameHeight,
        sourceWidth: image.naturalWidth,
        sourceHeight: frameHeight,
        frameIndex,
      });
    }, { once: true });
    image.addEventListener('error', () => resolve(createPendingCatalogItem(definition)), { once: true });
    image.src = `./${definition.asset}`;
  });
}

function getFrameCount(path) {
  if (path.endsWith('loading_animation_boil_sheet.webp')) {
    return 10;
  }

  return path.includes('_sheet.') ? DEFAULT_FRAME_COUNT : 1;
}

function renderElementList() {
  assetList.replaceChildren(...catalog.map(createElementButton));
}

function createElementButton(item) {
  const button = document.createElement('button');
  const thumb = document.createElement('span');
  const name = document.createElement('span');
  button.className = 'asset-item';
  button.type = 'button';
  button.title = `Add ${item.name}`;
  thumb.className = 'asset-thumb';
  thumb.setAttribute('aria-hidden', 'true');
  renderElementPreview(thumb, item, { width: 44 });
  name.className = 'asset-name';
  name.textContent = item.name;
  button.append(thumb, name);
  button.addEventListener('click', () => addElement(item));
  return button;
}

function addElement(item) {
  const frame = FRAME_SIZES[orientation];
  const element = {
    id: crypto.randomUUID(),
    key: item.key,
    kind: item.kind,
    name: uniqueName(item.name),
    text: item.text,
    asset: item.asset,
    frameIndex: item.frameIndex,
    sourceWidth: item.sourceWidth,
    sourceHeight: item.sourceHeight,
    x: Math.round((frame.width - item.width) / 2),
    y: Math.round((frame.height - item.height) / 2),
    width: item.width,
    height: item.height,
  };
  currentElements().push(element);
  selectedId = element.id;
  commit();
}

function render() {
  const frame = FRAME_SIZES[orientation];
  stage.className = `stage ${orientation}`;
  stage.style.width = `${frame.width}px`;
  stage.style.height = `${frame.height}px`;
  stage.replaceChildren(...currentElements().map(createStageElement));
  renderInspector();
  renderLayers();
  updateOrientationButtons();
}

function createStageElement(element, index) {
  const node = document.createElement('div');
  node.className = `layout-element${element.id === selectedId ? ' selected' : ''}`;
  node.dataset.id = element.id;
  node.dataset.label = `${element.name} · ${element.x}, ${element.y}`;
  node.style.left = `${element.x}px`;
  node.style.top = `${element.y}px`;
  node.style.width = `${element.width}px`;
  node.style.height = `${element.height}px`;
  node.style.zIndex = index + 1;
  renderElementPreview(node, element);
  renderResizeHandles(node, element);
  return node;
}

function renderElementPreview(node, element, preview = {}) {
  node.classList.toggle('text-preview', element.kind === 'text');
  node.textContent = '';
  node.style.backgroundImage = '';
  node.style.backgroundSize = '';
  node.style.backgroundPosition = '';

  if (element.kind === 'text') {
    node.textContent = element.text || element.name;
    return;
  }

  const sourceWidth = Math.max(1, finiteInteger(element.sourceWidth, element.width));
  const sourceHeight = Math.max(1, finiteInteger(element.sourceHeight, element.height));
  const displayWidth = preview.width ?? element.width;
  const scale = displayWidth / sourceWidth;
  const frameIndex = Math.max(0, finiteInteger(element.frameIndex, 0));

  node.style.backgroundImage = `url("./${element.asset}")`;
  node.style.backgroundSize = `${displayWidth}px auto`;
  node.style.backgroundPosition = `0 ${Math.round(-sourceHeight * scale * frameIndex)}px`;
}

function renderResizeHandles(node, element) {
  if (element.id !== selectedId) {
    return;
  }

  for (const handle of ['nw', 'ne', 'sw', 'se']) {
    const resizeHandle = document.createElement('span');
    resizeHandle.className = `resize-handle ${handle}`;
    resizeHandle.dataset.resizeHandle = handle;
    resizeHandle.setAttribute('aria-hidden', 'true');
    node.append(resizeHandle);
  }
}

function renderInspector() {
  const selected = getSelected();
  inspector.hidden = !selected;
  emptySelection.hidden = Boolean(selected);

  if (!selected) {
    return;
  }

  for (const field of ['name', 'x', 'y', 'width', 'height', 'asset']) {
    inspector.elements[field].value = selected[field] ?? '';
  }

  document.querySelector('[data-action="mirror"]').disabled = !canMirrorToP2(selected);
}

function renderLayers() {
  layerList.replaceChildren(...currentElements().map((element, index) => {
    const button = document.createElement('button');
    const position = document.createElement('span');
    const name = document.createElement('span');
    button.className = `layer-item${element.id === selectedId ? ' selected' : ''}`;
    button.type = 'button';
    position.className = 'layer-index';
    position.textContent = index + 1;
    name.className = 'layer-name';
    name.textContent = element.name;
    button.append(position, name);
    button.addEventListener('click', () => selectElement(element.id));
    return button;
  }));
}

function selectFromStage(event) {
  const element = event.target.closest('.layout-element');
  selectElement(element?.dataset.id ?? null);
}

function selectElement(id) {
  selectedId = id;
  render();
  stage.focus({ preventScroll: true });
}

function beginDrag(event) {
  const node = event.target.closest('.layout-element');

  if (!node || event.button !== 0) {
    return;
  }

  event.preventDefault();
  selectedId = node.dataset.id;
  const selected = getSelected();
  const resizeHandle = event.target.closest('[data-resize-handle]')?.dataset.resizeHandle ?? null;
  drag = {
    mode: resizeHandle ? 'resize' : 'move',
    handle: resizeHandle,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: selected.x,
    startY: selected.y,
    startWidth: selected.width,
    startHeight: selected.height,
    aspectRatio: getAspectRatio(selected),
  };
  node.setPointerCapture?.(event.pointerId);
  renderInspector();
  renderLayers();
}

function continueDrag(event) {
  if (!drag || event.pointerId !== drag.pointerId) {
    return;
  }

  const selected = getSelected();

  if (drag.mode === 'resize') {
    resizeSelectedFromPointer(selected, event);
  } else {
    selected.x = Math.round(drag.startX + event.clientX - drag.startClientX);
    selected.y = Math.round(drag.startY + event.clientY - drag.startClientY);
  }

  updateSelectedNode();
  renderInspector();
}

function resizeSelectedFromPointer(selected, event) {
  const dx = event.clientX - drag.startClientX;
  const dy = event.clientY - drag.startClientY;
  const movesWest = drag.handle.includes('w');
  const movesNorth = drag.handle.includes('n');
  const widthDelta = movesWest ? -dx : dx;
  const heightDelta = movesNorth ? -dy : dy;
  const widthTarget = Math.max(1, drag.startWidth + widthDelta);
  const heightTarget = Math.max(1, drag.startHeight + heightDelta);
  const widthFromHeight = heightTarget * drag.aspectRatio;
  const targetWidth = Math.abs(widthTarget - drag.startWidth) >= Math.abs(widthFromHeight - drag.startWidth)
    ? widthTarget
    : widthFromHeight;

  applyAspectSize(selected, 'width', targetWidth, drag.aspectRatio);

  if (movesWest) {
    selected.x = Math.round(drag.startX + drag.startWidth - selected.width);
  }

  if (movesNorth) {
    selected.y = Math.round(drag.startY + drag.startHeight - selected.height);
  }
}

function endDrag(event) {
  if (!drag || event.pointerId !== drag.pointerId) {
    return;
  }

  drag = null;
  commit();
}

function handleStageKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    duplicateSelected();
    return;
  }

  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
    event.preventDefault();
    deleteSelected();
    return;
  }

  const movement = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }[event.key];

  if (!movement || !selectedId) {
    return;
  }

  event.preventDefault();
  const amount = event.shiftKey ? 10 : 1;
  const selected = getSelected();
  selected.x += movement[0] * amount;
  selected.y += movement[1] * amount;
  commit();
}

function updateSelectedFromInspector(event) {
  const selected = getSelected();

  if (!selected || !event.target.name) {
    return;
  }

  if (event.target.name === 'name') {
    selected.name = event.target.value || selected.key || getAssetName(selected.asset);
  } else if (['x', 'y', 'width', 'height'].includes(event.target.name)) {
    const value = Math.round(Number(event.target.value));

    if (!Number.isFinite(value)) {
      return;
    }

    if (event.target.name === 'width' || event.target.name === 'height') {
      applyAspectSize(selected, event.target.name, value);
      inspector.elements.width.value = selected.width;
      inspector.elements.height.value = selected.height;
    } else {
      selected[event.target.name] = value;
    }
  }

  updateSelectedNode();
  renderLayers();
  saveLayouts();
}

function duplicateSelected() {
  const selected = getSelected();

  if (!selected) {
    return;
  }

  const duplicate = {
    ...selected,
    id: crypto.randomUUID(),
    name: uniqueName(`${selected.name} copy`),
    x: selected.x + 20,
    y: selected.y + 20,
  };
  currentElements().push(duplicate);
  selectedId = duplicate.id;
  commit();
}

function mirrorSelected() {
  const selected = getSelected();

  if (!selected || !canMirrorToP2(selected)) {
    return;
  }

  const frame = FRAME_SIZES[orientation];
  const baseKey = hasP1Token(selected.key) ? selected.key : selected.name;
  const mirroredKey = mirrorP1ToP2(baseKey);
  const catalogMatch = catalog.find((item) => item.key === mirroredKey);
  const mirror = {
    ...selected,
    id: crypto.randomUUID(),
    key: mirroredKey,
    name: uniqueName(catalogMatch?.name ?? mirrorP1ToP2(selected.name)),
    text: mirrorP1ToP2(catalogMatch?.text ?? selected.text),
    asset: catalogMatch?.asset ?? selected.asset,
    frameIndex: catalogMatch?.frameIndex ?? selected.frameIndex,
    sourceWidth: catalogMatch?.sourceWidth ?? selected.sourceWidth,
    sourceHeight: catalogMatch?.sourceHeight ?? selected.sourceHeight,
    x: Math.round(frame.width - selected.x - selected.width),
    y: selected.y,
  };
  currentElements().push(mirror);
  selectedId = mirror.id;
  commit();
}

function deleteSelected() {
  const index = currentElements().findIndex((element) => element.id === selectedId);

  if (index === -1) {
    return;
  }

  currentElements().splice(index, 1);
  selectedId = null;
  commit();
}

function moveLayer(direction) {
  const elements = currentElements();
  const index = elements.findIndex((element) => element.id === selectedId);
  const nextIndex = index + direction;

  if (index === -1 || nextIndex < 0 || nextIndex >= elements.length) {
    return;
  }

  [elements[index], elements[nextIndex]] = [elements[nextIndex], elements[index]];
  commit();
}

function setOrientation(nextOrientation) {
  if (!FRAME_SIZES[nextOrientation] || nextOrientation === orientation) {
    return;
  }

  orientation = nextOrientation;
  selectedId = null;
  render();
}

function clearLayout() {
  if (!currentElements().length || !window.confirm(`Clear the ${orientation} layout?`)) {
    return;
  }

  layouts[orientation].elements = [];
  selectedId = null;
  commit();
}

function exportLayouts() {
  const payload = {
    version: 1,
    landscape: {
      frame: FRAME_SIZES.landscape,
      elements: layouts.landscape.elements,
    },
    portrait: {
      frame: FRAME_SIZES.portrait,
      elements: layouts.portrait.elements,
    },
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'tap-tap-shoot-layout.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importLayouts() {
  const [file] = importFile.files;

  if (!file) {
    return;
  }

  try {
    const parsed = JSON.parse(await file.text());
    layouts = normalizeLayouts(parsed);
    selectedId = null;
    commit();
  } catch {
    window.alert('Could not import that layout JSON.');
  } finally {
    importFile.value = '';
  }
}

function loadLayouts() {
  try {
    return normalizeLayouts(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return createEmptyLayouts();
  }
}

function normalizeLayouts(value) {
  const normalized = createEmptyLayouts();

  for (const key of Object.keys(FRAME_SIZES)) {
    const elements = value?.[key]?.elements;

    if (Array.isArray(elements)) {
      normalized[key].elements = elements
        .filter((element) => element && (typeof element.asset === 'string' || element.kind === 'text'))
        .map((element) => ({
          id: typeof element.id === 'string' ? element.id : crypto.randomUUID(),
          key: typeof element.key === 'string' ? element.key : getAssetName(element.asset),
          kind: element.kind === 'text' ? 'text' : 'image',
          name: String(element.name || getAssetName(element.asset)),
          text: typeof element.text === 'string' ? element.text : '',
          asset: typeof element.asset === 'string' ? element.asset : '',
          frameIndex: Math.max(0, finiteInteger(element.frameIndex, 0)),
          sourceWidth: Math.max(1, finiteInteger(element.sourceWidth, element.width ?? 256)),
          sourceHeight: Math.max(1, finiteInteger(element.sourceHeight, element.height ?? 128)),
          x: finiteInteger(element.x, 0),
          y: finiteInteger(element.y, 0),
          width: Math.max(1, finiteInteger(element.width, 256)),
          height: Math.max(1, finiteInteger(element.height, 128)),
        }));
    }
  }

  return normalized;
}

function createEmptyLayouts() {
  return {
    landscape: { frame: FRAME_SIZES.landscape, elements: [] },
    portrait: { frame: FRAME_SIZES.portrait, elements: [] },
  };
}

function commit() {
  render();
  saveLayouts();
}

function saveLayouts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  saveStatus.textContent = 'Saved locally';
}

function updateSelectedNode() {
  const selected = getSelected();
  const node = stage.querySelector(`[data-id="${CSS.escape(selected.id)}"]`);

  if (!node) {
    return;
  }

  node.dataset.label = `${selected.name} · ${selected.x}, ${selected.y}`;
  node.style.left = `${selected.x}px`;
  node.style.top = `${selected.y}px`;
  node.style.width = `${selected.width}px`;
  node.style.height = `${selected.height}px`;
  renderElementPreview(node, selected);
  renderResizeHandles(node, selected);
}

function updateOrientationButtons() {
  document.querySelectorAll('[data-orientation]').forEach((button) => {
    button.classList.toggle('active', button.dataset.orientation === orientation);
  });
}

function currentElements() {
  return layouts[orientation].elements;
}

function getSelected() {
  return currentElements().find((element) => element.id === selectedId) ?? null;
}

function canMirrorToP2(element) {
  return hasP1Token(element.key) || hasP1Token(element.name) || hasP1Token(element.text);
}

function hasP1Token(value) {
  return /(^|[^a-z0-9])p1([^a-z0-9]|$)/i.test(String(value ?? ''));
}

function mirrorP1ToP2(value) {
  return String(value ?? '').replace(/(^|[^a-z0-9])p1([^a-z0-9]|$)/gi, (match, before, after) => (
    `${before}${match.slice(before.length, match.length - after.length) === 'P1' ? 'P2' : 'p2'}${after}`
  ));
}

function uniqueName(base) {
  const names = new Set(currentElements().map((element) => element.name));

  if (!names.has(base)) {
    return base;
  }

  let suffix = 2;

  while (names.has(`${base} ${suffix}`)) {
    suffix += 1;
  }

  return `${base} ${suffix}`;
}

function getAssetName(path) {
  return path
    .split('/')
    .pop()
    .replace(/\.(webp|png|jpe?g)$/i, '')
    .replace(/_sheet$/, '')
    .replaceAll('_', ' ');
}

function finiteInteger(value, fallback) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? number : fallback;
}

function clampInteger(value, min, max) {
  return Math.min(max, Math.max(min, finiteInteger(value, min)));
}

function applyAspectSize(element, changedField, rawValue, aspectRatio = getAspectRatio(element)) {
  const value = Math.max(1, Math.round(Number(rawValue)));

  if (!Number.isFinite(value)) {
    return;
  }

  if (changedField === 'height') {
    element.height = value;
    element.width = Math.max(1, Math.round(value * aspectRatio));
  } else {
    element.width = value;
    element.height = Math.max(1, Math.round(value / aspectRatio));
  }
}

function getAspectRatio(element) {
  const sourceWidth = Math.max(1, finiteInteger(element.sourceWidth, element.width));
  const sourceHeight = Math.max(1, finiteInteger(element.sourceHeight, element.height));
  return sourceWidth / sourceHeight;
}
