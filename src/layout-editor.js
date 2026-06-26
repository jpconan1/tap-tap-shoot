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
  catalog = window.LAYOUT_ASSETS.map((path) => ({ path, width: 256, height: 128 }));
  renderAssetList();
  render();
  Promise.all(window.LAYOUT_ASSETS.map(loadAssetMetadata)).then((loadedCatalog) => {
    catalog = loadedCatalog;
    renderAssetList();
  });

  document.querySelectorAll('[data-orientation]').forEach((button) => {
    button.addEventListener('click', () => setOrientation(button.dataset.orientation));
  });
  document.querySelector('[data-action="export"]').addEventListener('click', exportLayouts);
  document.querySelector('[data-action="import"]').addEventListener('click', () => importFile.click());
  document.querySelector('[data-action="clear"]').addEventListener('click', clearLayout);
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

function loadAssetMetadata(path) {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () => {
      const frameCount = getFrameCount(path);
      resolve({
        path,
        width: image.naturalWidth,
        height: Math.round(image.naturalHeight / frameCount),
      });
    }, { once: true });
    image.addEventListener('error', () => resolve({ path, width: 256, height: 128 }), { once: true });
    image.src = `./${path}`;
  });
}

function getFrameCount(path) {
  if (path.endsWith('loading_animation_boil_sheet.webp')) {
    return 10;
  }

  return path.includes('_sheet.') ? DEFAULT_FRAME_COUNT : 1;
}

function renderAssetList() {
  assetList.replaceChildren(...catalog.map(createAssetButton));
}

function createAssetButton(asset) {
  const button = document.createElement('button');
  const thumb = document.createElement('span');
  const name = document.createElement('span');
  button.className = 'asset-item';
  button.type = 'button';
  button.title = `Add ${asset.path}`;
  thumb.className = 'asset-thumb';
  thumb.style.backgroundImage = `url("./${asset.path}")`;
  name.className = 'asset-name';
  name.textContent = getAssetName(asset.path);
  button.append(thumb, name);
  button.addEventListener('click', () => addAsset(asset));
  return button;
}

function addAsset(asset) {
  const frame = FRAME_SIZES[orientation];
  const element = {
    id: crypto.randomUUID(),
    name: uniqueName(getAssetName(asset.path)),
    asset: asset.path,
    x: Math.round((frame.width - asset.width) / 2),
    y: Math.round((frame.height - asset.height) / 2),
    width: asset.width,
    height: asset.height,
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
  node.style.backgroundImage = `url("./${element.asset}")`;
  node.style.backgroundSize = `${element.width}px auto`;
  return node;
}

function renderInspector() {
  const selected = getSelected();
  inspector.hidden = !selected;
  emptySelection.hidden = Boolean(selected);

  if (!selected) {
    return;
  }

  for (const field of ['name', 'x', 'y', 'width', 'height', 'asset']) {
    inspector.elements[field].value = selected[field];
  }
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
  drag = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: selected.x,
    startY: selected.y,
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
  selected.x = Math.round(drag.startX + event.clientX - drag.startClientX);
  selected.y = Math.round(drag.startY + event.clientY - drag.startClientY);
  updateSelectedNode();
  renderInspector();
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
    selected.name = event.target.value || getAssetName(selected.asset);
  } else if (['x', 'y', 'width', 'height'].includes(event.target.name)) {
    const value = Math.round(Number(event.target.value));

    if (!Number.isFinite(value)) {
      return;
    }

    selected[event.target.name] = event.target.name === 'width' || event.target.name === 'height'
      ? Math.max(1, value)
      : value;
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
        .filter((element) => element && typeof element.asset === 'string')
        .map((element) => ({
          id: typeof element.id === 'string' ? element.id : crypto.randomUUID(),
          name: String(element.name || getAssetName(element.asset)),
          asset: element.asset,
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
  node.style.backgroundSize = `${selected.width}px auto`;
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
