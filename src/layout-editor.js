const FRAME_SIZES = Object.freeze({
  landscape: Object.freeze({ width: 960, height: 540 }),
  portrait: Object.freeze({ width: 540, height: 960 }),
});
const STORAGE_KEY = 'tapTapShoot.layoutTool.v2';
const DEFAULT_VARIANT_ID = 'shoot-stab-duck';
const VARIANT_NAME = 'Shoot Stab Duck';
const DEFAULT_LAYOUT_STATE_ID = 'playing.default';
const LAYOUT_STATES = Object.freeze([
  Object.freeze({ id: 'playing.default', name: 'Playing' }),
  Object.freeze({ id: 'playing.disadvantaged', name: 'Disadvantaged' }),
  Object.freeze({ id: 'round.between', name: 'Between rounds' }),
  Object.freeze({ id: 'round.game-over', name: 'Game over' }),
]);
const DEFAULT_FRAME_COUNT = 3;
const DEFAULT_ELEMENT_SCALE = 0.5;

const stage = document.querySelector('[data-stage]');
const layoutTargetSelect = document.querySelector('[data-layout-target]');
const variantSelect = document.querySelector('[data-variant]');
const layoutStateSelect = document.querySelector('[data-layout-state]');
const assetList = document.querySelector('[data-asset-list]');
const inspector = document.querySelector('[data-inspector]');
const emptySelection = document.querySelector('[data-empty-selection]');
const layerList = document.querySelector('[data-layer-list]');
const saveStatus = document.querySelector('[data-save-status]');
const importFile = document.querySelector('[data-import-file]');

let orientation = 'landscape';
let layoutStateId = DEFAULT_LAYOUT_STATE_ID;
let layoutTarget = getInitialLayoutTarget();
let variantId = getInitialVariantId();
let selectedId = null;
let catalog = [];
let drag = null;
let layouts = loadLayouts();

boot();

async function boot() {
  catalog = getElementCatalog().map(createPendingCatalogItem);
  renderVariantOptions();
  renderLayoutStateOptions();
  renderElementList();
  render();
  refreshCatalog();
  loadBundledLayoutIfEmpty();

  document.querySelectorAll('[data-orientation]').forEach((button) => {
    button.addEventListener('click', () => setOrientation(button.dataset.orientation));
  });
  layoutTargetSelect.addEventListener('change', () => setLayoutTarget(layoutTargetSelect.value));
  variantSelect.addEventListener('change', () => setVariant(variantSelect.value));
  layoutStateSelect.addEventListener('change', () => setLayoutState(layoutStateSelect.value));
  document.querySelector('[data-action="export"]').addEventListener('click', exportLayouts);
  document.querySelector('[data-action="import"]').addEventListener('click', () => importFile.click());
  document.querySelector('[data-action="clear"]').addEventListener('click', clearLayout);
  document.querySelector('[data-action="mirror"]').addEventListener('click', mirrorSelected);
  document.querySelector('[data-action="duplicate"]').addEventListener('click', duplicateSelected);
  document.querySelector('[data-action="delete"]').addEventListener('click', deleteSelected);
  document.querySelector('[data-action="backward"]').addEventListener('click', () => moveLayer(-1));
  document.querySelector('[data-action="forward"]').addEventListener('click', () => moveLayer(1));
  document.querySelectorAll('[data-scale]').forEach((button) => {
    button.addEventListener('click', () => scaleSelected(Number(button.dataset.scale)));
  });

  importFile.addEventListener('change', importLayouts);
  inspector.addEventListener('input', updateSelectedFromInspector);
  stage.addEventListener('pointerdown', beginDrag);
  stage.addEventListener('click', selectFromStage);
  stage.addEventListener('keydown', handleStageKeydown);
  window.addEventListener('pointermove', continueDrag);
  window.addEventListener('pointerup', endDrag);
}

function getElementCatalog() {
  if (typeof window.getLayoutElementsForTarget === 'function') {
    return window.getLayoutElementsForTarget({ target: layoutTarget, variantId });
  }

  if (typeof window.getLayoutElementsForVariant === 'function') {
    return window.getLayoutElementsForVariant(variantId);
  }

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
  const size = getDefaultDisplaySize(
    definition.width ?? 256,
    definition.height ?? 128,
  );

  return {
    kind: definition.kind ?? 'image',
    key: definition.key,
    name: definition.name,
    text: definition.text ?? definition.name,
    asset: definition.asset ?? '',
    frame: definition.frame ?? 0,
    frameCount: 1,
    width: size.width,
    height: size.height,
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
      const sourceWidth = definition.width ?? image.naturalWidth;
      const sourceHeight = definition.height ?? frameHeight;
      const size = getDefaultDisplaySize(sourceWidth, sourceHeight);
      const frameIndex = definition.frame === 'last'
        ? frameCount - 1
        : clampInteger(definition.frame, 0, frameCount - 1);
      resolve({
        ...createPendingCatalogItem(definition),
        frameCount,
        width: size.width,
        height: size.height,
        sourceWidth,
        sourceHeight,
        frameIndex,
      });
    }, { once: true });
    image.addEventListener('error', () => resolve(createPendingCatalogItem(definition)), { once: true });
    image.src = `./${definition.asset}`;
  });
}

function refreshCatalog() {
  const catalogVariantId = variantId;
  catalog = getElementCatalog().map(createPendingCatalogItem);
  renderElementList();
  Promise.all(getElementCatalog().map(loadElementMetadata)).then((loadedCatalog) => {
    if (variantId !== catalogVariantId) {
      return;
    }

    catalog = loadedCatalog;
    renderElementList();
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
    scene: Boolean(item.scene),
    anchors: createDefaultAnchors(item),
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
  updateLayoutTargetSelect();
  updateVariantSelect();
  updateOrientationButtons();
  updateLayoutStateSelect();
}

function renderVariantOptions() {
  variantSelect.replaceChildren(...getLayoutVariants().map((variant) => {
    const option = document.createElement('option');
    option.value = variant.id;
    option.textContent = variant.name;
    return option;
  }));
}

function renderLayoutStateOptions() {
  layoutStateSelect.replaceChildren(...LAYOUT_STATES.map((state) => {
    const option = document.createElement('option');
    option.value = state.id;
    option.textContent = state.name;
    return option;
  }));
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

  renderAnchorMarkers(node, element);
}

function renderAnchorMarkers(node, element) {
  for (const [key, label] of [['p1Head', 'P1'], ['p2Head', 'P2']]) {
    const anchor = element.anchors?.[key];

    if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
      continue;
    }

    const marker = document.createElement('span');
    marker.className = `anchor-marker ${key}`;
    marker.textContent = label;
    marker.style.left = `${anchor.x}px`;
    marker.style.top = `${anchor.y}px`;
    node.append(marker);
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

  inspector.elements.p1HeadX.value = selected.anchors?.p1Head?.x ?? '';
  inspector.elements.p1HeadY.value = selected.anchors?.p1Head?.y ?? '';
  inspector.elements.p2HeadX.value = selected.anchors?.p2Head?.x ?? '';
  inspector.elements.p2HeadY.value = selected.anchors?.p2Head?.y ?? '';

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
  } else if (['p1HeadX', 'p1HeadY', 'p2HeadX', 'p2HeadY'].includes(event.target.name)) {
    updateSelectedAnchor(selected, event.target.name, event.target.value);
  }

  updateSelectedNode();
  renderLayers();
  saveLayouts();
}

function updateSelectedAnchor(selected, fieldName, rawValue) {
  const match = /^(p[12]Head)(X|Y)$/.exec(fieldName);

  if (!match) {
    return;
  }

  selected.anchors = selected.anchors ?? {};
  selected.anchors[match[1]] = selected.anchors[match[1]] ?? {};
  selected.anchors[match[1]][match[2].toLowerCase()] = finiteInteger(rawValue, 0);
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

function scaleSelected(scale) {
  const selected = getSelected();

  if (!selected || !Number.isFinite(scale) || scale <= 0) {
    return;
  }

  const centerX = selected.x + selected.width / 2;
  const centerY = selected.y + selected.height / 2;
  selected.width = Math.max(1, Math.round(getSourceWidth(selected) * scale));
  selected.height = Math.max(1, Math.round(getSourceHeight(selected) * scale));
  selected.x = Math.round(centerX - selected.width / 2);
  selected.y = Math.round(centerY - selected.height / 2);
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

function setLayoutState(nextStateId) {
  if (!LAYOUT_STATES.some((state) => state.id === nextStateId) || nextStateId === layoutStateId) {
    return;
  }

  layoutStateId = nextStateId;
  selectedId = null;
  render();
}

function setVariant(nextVariantId) {
  if (!getLayoutVariants().some((variant) => variant.id === nextVariantId) || nextVariantId === variantId) {
    return;
  }

  saveLayouts();
  variantId = nextVariantId;
  localStorage.setItem(`${STORAGE_KEY}.activeVariant`, variantId);
  layouts = loadLayouts();
  selectedId = null;
  refreshCatalog();
  render();
  loadBundledLayoutIfEmpty();
}

function setLayoutTarget(nextTarget) {
  if (!['parent', 'variant'].includes(nextTarget) || nextTarget === layoutTarget) {
    return;
  }

  saveLayouts();
  layoutTarget = nextTarget;
  localStorage.setItem(`${STORAGE_KEY}.activeTarget`, layoutTarget);
  layouts = loadLayouts();
  selectedId = null;
  refreshCatalog();
  render();
  loadBundledLayoutIfEmpty();
}

function clearLayout() {
  const stateName = LAYOUT_STATES.find((state) => state.id === layoutStateId)?.name ?? layoutStateId;

  if (!currentElements().length || !window.confirm(`Clear the ${stateName} ${orientation} layout?`)) {
    return;
  }

  currentLayout().elements = [];
  selectedId = null;
  commit();
}

function exportLayouts() {
  const variant = getLayoutVariant();
  const isParent = layoutTarget === 'parent';
  const payload = {
    version: 3,
    layoutTarget,
    variantId: isParent ? 'parent' : variantId,
    variant: isParent ? 'Parent' : variant.name,
    variantFolder: isParent ? 'assets' : variant.folder,
    frame: FRAME_SIZES.landscape,
    portraitFrame: FRAME_SIZES.portrait,
    sceneAnchors: collectSceneAnchors(),
    states: Object.fromEntries(LAYOUT_STATES.map((state) => [
      state.id,
      {
        name: state.name,
        elements: layouts.states[state.id].landscape.elements,
        portraitElements: layouts.states[state.id].portrait.elements,
      },
    ])),
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = isParent ? 'parent-layout.json' : `${variantId}-layout.json`;
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
    const importedTarget = parsed.layoutTarget === 'parent' || parsed.variantId === 'parent' ? 'parent' : 'variant';

    if (importedTarget !== layoutTarget) {
      layoutTarget = importedTarget;
      localStorage.setItem(`${STORAGE_KEY}.activeTarget`, layoutTarget);
    }

    const importedVariantId = getKnownVariantId(parsed.variantId, variantId);

    if (layoutTarget === 'variant' && importedVariantId !== variantId) {
      variantId = importedVariantId;
      localStorage.setItem(`${STORAGE_KEY}.activeVariant`, variantId);
    }

    refreshCatalog();
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
    const stored = localStorage.getItem(getStorageKey(variantId))
      ?? (layoutTarget === 'variant' && variantId === DEFAULT_VARIANT_ID ? localStorage.getItem(STORAGE_KEY) : null);

    return normalizeLayouts(JSON.parse(stored));
  } catch {
    return createEmptyLayouts();
  }
}

async function loadBundledLayoutIfEmpty() {
  if (hasStoredLayouts() || !isLayoutEmpty(layouts)) {
    return;
  }

  const requestedTarget = layoutTarget;
  const requestedVariantId = variantId;

  try {
    const response = await fetch(getBundledLayoutUrl(), { cache: 'no-store' });

    if (!response.ok) {
      return;
    }

    const bundled = normalizeLayouts(await response.json());

    if (layoutTarget !== requestedTarget || variantId !== requestedVariantId) {
      return;
    }

    if (!isLayoutEmpty(layouts)) {
      return;
    }

    layouts = bundled;
    selectedId = null;
    commit();
  } catch {
    // Empty editor still works when opened from file:// or before starter layouts exist.
  }
}

function normalizeLayouts(value) {
  const normalized = createEmptyLayouts();

  if (value?.version >= 2 && value.states && typeof value.states === 'object') {
    normalized.layoutTarget = value.layoutTarget === 'parent' || value.variantId === 'parent' ? 'parent' : layoutTarget;
    normalized.variantId = normalized.layoutTarget === 'parent' ? 'parent' : getKnownVariantId(value.variantId, variantId);
    normalized.variant = String(value.variant || (
      normalized.layoutTarget === 'parent' ? 'Parent' : getLayoutVariant(normalized.variantId).name
    ));

    for (const state of LAYOUT_STATES) {
      const stateValue = value.states[state.id];

      if (!stateValue) {
        continue;
      }

      if (Array.isArray(stateValue.elements)) {
        normalized.states[state.id].landscape.elements = stateValue.elements
          .filter((element) => element && (typeof element.asset === 'string' || element.kind === 'text'))
          .map(normalizeElement);
      }

      if (Array.isArray(stateValue.portraitElements)) {
        normalized.states[state.id].portrait.elements = stateValue.portraitElements
          .filter((element) => element && (typeof element.asset === 'string' || element.kind === 'text'))
          .map(normalizeElement);
      }
    }

    return normalized;
  }

  for (const key of Object.keys(FRAME_SIZES)) {
    const elements = value?.[key]?.elements;

    if (Array.isArray(elements)) {
      normalized.states[DEFAULT_LAYOUT_STATE_ID][key].elements = elements
        .filter((element) => element && (typeof element.asset === 'string' || element.kind === 'text'))
        .map(normalizeElement);
    }
  }

  cloneDefaultLayoutToEmptyStates(normalized);

  return normalized;
}

function normalizeElement(element) {
  const asset = migrateAssetPath(typeof element.asset === 'string' ? element.asset : '');
  const sourceSize = NEW_ASSET_SOURCE_SIZES[asset] ?? {};
  const anchors = normalizeAnchors(element.anchors);

  return {
    id: typeof element.id === 'string' ? element.id : crypto.randomUUID(),
    key: typeof element.key === 'string' ? element.key : getAssetName(asset),
    kind: element.kind === 'text' ? 'text' : 'image',
    name: String(element.name || getAssetName(asset)),
    text: typeof element.text === 'string' ? element.text : '',
    asset,
    frameIndex: Math.max(0, finiteInteger(element.frameIndex, 0)),
    scene: Boolean(element.scene || element.key === 'scene' || String(element.key).startsWith('scene:')),
    anchors,
    sourceWidth: Math.max(1, finiteInteger(sourceSize.width ?? element.sourceWidth, element.width ?? 256)),
    sourceHeight: Math.max(1, finiteInteger(sourceSize.height ?? element.sourceHeight, element.height ?? 128)),
    x: finiteInteger(element.x, 0),
    y: finiteInteger(element.y, 0),
    width: Math.max(1, finiteInteger(element.width, 256)),
    height: Math.max(1, finiteInteger(element.height, 128)),
  };
}

function migrateAssetPath(path) {
  return {
    'assets/action_points_sheet.webp': 'assets/bullets_label_sheet.webp',
    'assets/ap_icon_sheet.webp': 'assets/bullet_icon_sheet.webp',
    'assets/dodge_button_sheet.webp': 'assets/duck_button_sheet.webp',
  }[path] ?? path;
}

const NEW_ASSET_SOURCE_SIZES = Object.freeze({
  'assets/bullets_label_sheet.webp': Object.freeze({ width: 256, height: 80 }),
  'assets/bullet_icon_sheet.webp': Object.freeze({ width: 64, height: 64 }),
  'assets/duck_button_sheet.webp': Object.freeze({ width: 256, height: 128 }),
});

function createEmptyLayouts() {
  const variant = getLayoutVariant();

  return {
    layoutTarget,
    variantId: layoutTarget === 'parent' ? 'parent' : variant.id,
    variant: layoutTarget === 'parent' ? 'Parent' : variant.name,
    states: Object.fromEntries(LAYOUT_STATES.map((state) => [
      state.id,
      {
        landscape: { frame: FRAME_SIZES.landscape, elements: [] },
        portrait: { frame: FRAME_SIZES.portrait, elements: [] },
      },
    ])),
  };
}

function cloneDefaultLayoutToEmptyStates(layoutsValue) {
  for (const state of LAYOUT_STATES) {
    if (state.id === DEFAULT_LAYOUT_STATE_ID) {
      continue;
    }

    for (const key of Object.keys(FRAME_SIZES)) {
      if (!layoutsValue.states[state.id][key].elements.length) {
        layoutsValue.states[state.id][key].elements = cloneElements(
          layoutsValue.states[DEFAULT_LAYOUT_STATE_ID][key].elements,
        );
      }
    }
  }
}

function cloneElements(elements) {
  return elements.map((element) => ({
    ...element,
    id: crypto.randomUUID(),
  }));
}

function isLayoutEmpty(value) {
  return LAYOUT_STATES.every((state) => Object.keys(FRAME_SIZES).every((key) => (
    !value.states[state.id][key].elements.length
  )));
}

function hasStoredLayouts() {
  try {
    return Boolean(localStorage.getItem(getStorageKey(variantId)));
  } catch {
    return false;
  }
}

function getBundledLayoutUrl() {
  return layoutTarget === 'parent'
    ? './assets/parent-layout.json'
    : `./assets/${variantId}/layout.json`;
}

function collectSceneAnchors() {
  const entries = [];

  for (const state of LAYOUT_STATES) {
    for (const key of Object.keys(FRAME_SIZES)) {
      for (const element of layouts.states[state.id][key].elements) {
        if (!element.scene || !element.asset || !element.anchors) {
          continue;
        }

        entries.push([element.asset, element.anchors]);
      }
    }
  }

  return Object.fromEntries(entries);
}

function createDefaultAnchors(item) {
  if (!item.scene) {
    return null;
  }

  return {
    p1Head: { x: Math.round(item.width * 0.32), y: Math.round(item.height * 0.28) },
    p2Head: { x: Math.round(item.width * 0.68), y: Math.round(item.height * 0.28) },
  };
}

function normalizeAnchors(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return {
    p1Head: normalizeAnchor(value.p1Head),
    p2Head: normalizeAnchor(value.p2Head),
  };
}

function normalizeAnchor(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return {
    x: finiteInteger(value.x, 0),
    y: finiteInteger(value.y, 0),
  };
}

function getInitialVariantId() {
  try {
    return getKnownVariantId(localStorage.getItem(`${STORAGE_KEY}.activeVariant`), DEFAULT_VARIANT_ID);
  } catch {
    return DEFAULT_VARIANT_ID;
  }
}

function getInitialLayoutTarget() {
  try {
    const target = localStorage.getItem(`${STORAGE_KEY}.activeTarget`);
    return ['parent', 'variant'].includes(target) ? target : 'parent';
  } catch {
    return 'parent';
  }
}

function getStorageKey(id) {
  return layoutTarget === 'parent'
    ? `${STORAGE_KEY}.parent`
    : `${STORAGE_KEY}.${getKnownVariantId(id, DEFAULT_VARIANT_ID)}`;
}

function getKnownVariantId(id, fallback = DEFAULT_VARIANT_ID) {
  const variants = getLayoutVariants();
  const candidate = String(id || '');

  return variants.some((variant) => variant.id === candidate)
    ? candidate
    : fallback;
}

function getLayoutVariant(id = variantId) {
  return getLayoutVariants().find((variant) => variant.id === id) ?? getLayoutVariants()[0];
}

function getLayoutVariants() {
  return Array.isArray(window.LAYOUT_VARIANTS) && window.LAYOUT_VARIANTS.length
    ? window.LAYOUT_VARIANTS
    : [{ id: DEFAULT_VARIANT_ID, name: VARIANT_NAME, folder: 'assets/shoot-stab-duck' }];
}

function commit() {
  render();
  saveLayouts();
}

function saveLayouts() {
  layouts.layoutTarget = layoutTarget;
  layouts.variantId = layoutTarget === 'parent' ? 'parent' : variantId;
  layouts.variant = layoutTarget === 'parent' ? 'Parent' : getLayoutVariant().name;
  localStorage.setItem(`${STORAGE_KEY}.activeTarget`, layoutTarget);
  localStorage.setItem(`${STORAGE_KEY}.activeVariant`, variantId);
  localStorage.setItem(getStorageKey(variantId), JSON.stringify(layouts));
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

function updateLayoutStateSelect() {
  layoutStateSelect.value = layoutStateId;
}

function updateLayoutTargetSelect() {
  layoutTargetSelect.value = layoutTarget;
  variantSelect.disabled = layoutTarget === 'parent';
}

function updateVariantSelect() {
  variantSelect.value = variantId;
}

function currentElements() {
  return currentLayout().elements;
}

function currentLayout() {
  return layouts.states[layoutStateId][orientation];
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

function getDefaultDisplaySize(width, height) {
  return {
    width: Math.max(1, Math.round(width * DEFAULT_ELEMENT_SCALE)),
    height: Math.max(1, Math.round(height * DEFAULT_ELEMENT_SCALE)),
  };
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
  return getSourceWidth(element) / getSourceHeight(element);
}

function getSourceWidth(element) {
  return Math.max(1, finiteInteger(element.sourceWidth, element.width));
}

function getSourceHeight(element) {
  return Math.max(1, finiteInteger(element.sourceHeight, element.height));
}
