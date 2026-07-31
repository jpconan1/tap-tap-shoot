const VIEWPORTS = Object.freeze({
  landscape: Object.freeze({ width: 960, height: 540 }),
  portrait: Object.freeze({ width: 540, height: 960 }),
});
const BOX_MIN_SIZE = 96;
const BUTTON_FRAME_WIDTH = 256;
const BUTTON_FRAME_HEIGHT = 128;
const BODY_STYLES = new Set(['body', 'body-left', 'bullet', 'lead', 'emphasis', 'header', 'subheader', 'subheader-spaced']);
const INTERACTION_MODES = new Set(['modal', 'guided']);
const ESCAPE_ACTIONS = new Set(['none', 'cancel', 'next']);
const OUTSIDE_ACTIONS = new Set(['none', 'next']);

function assertObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
}

function finiteNumber(value, path) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${path} must be a finite number.`);
  }
  return Number(value);
}

function positiveNumber(value, path) {
  const number = finiteNumber(value, path);
  if (number <= 0) throw new RangeError(`${path} must be greater than zero.`);
  return number;
}

function normalizeGeometry(value, path, { minimumSize = 1 } = {}) {
  assertObject(value, path);
  const width = positiveNumber(value.width, `${path}.width`);
  const height = positiveNumber(value.height, `${path}.height`);
  if (width < minimumSize || height < minimumSize) {
    throw new RangeError(`${path} must be at least ${minimumSize}×${minimumSize}.`);
  }
  return Object.freeze({
    x: finiteNumber(value.x, `${path}.x`),
    y: finiteNumber(value.y, `${path}.y`),
    width,
    height,
  });
}

function normalizeResponsiveGeometry(value, path, options) {
  assertObject(value, path);
  const landscape = normalizeGeometry(value, path, options);
  const portrait = value.portrait
    ? normalizeGeometry(value.portrait, `${path}.portrait`, options)
    : null;
  return Object.freeze({ ...landscape, portrait });
}

function normalizeBody(body, path) {
  if (!Array.isArray(body) || body.length === 0) {
    throw new TypeError(`${path} must be a non-empty array.`);
  }
  return Object.freeze(body.map((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (typeof entry === 'string') {
      if (!entry.trim()) throw new TypeError(`${entryPath} must not be empty.`);
      return Object.freeze({ text: entry, style: 'body' });
    }
    assertObject(entry, entryPath);
    if (typeof entry.text === 'string' && entry.text.trim() && Array.isArray(entry.aside) && entry.aside.length) {
      const aside = entry.aside.map((part, partIndex) => {
        const partPath = `${entryPath}.aside[${partIndex}]`;
        assertObject(part, partPath);
        if (typeof part.text === 'string' && part.text.trim()) {
          const tone = part.tone ?? 'default';
          if (!['default', 'red'].includes(tone)) {
            throw new RangeError(`${partPath}.tone must be default or red.`);
          }
          return Object.freeze({ text: part.text, tone });
        }
        if (typeof part.doodle !== 'string' || !part.doodle.trim()) {
          throw new TypeError(`${partPath} must contain non-empty text or doodle.`);
        }
        return Object.freeze({
          doodle: part.doodle,
          width: positiveNumber(part.width, `${partPath}.width`),
          height: positiveNumber(part.height, `${partPath}.height`),
        });
      });
      return Object.freeze({
        text: entry.text,
        style: 'bullet',
        aside: Object.freeze(aside),
      });
    }
    if (Array.isArray(entry.parts) && entry.parts.length) {
      const parts = entry.parts.map((part, partIndex) => {
        const partPath = `${entryPath}.parts[${partIndex}]`;
        assertObject(part, partPath);
        if (typeof part.text === 'string' && part.text.trim()) {
          const tone = part.tone ?? 'default';
          if (!['default', 'red'].includes(tone)) {
            throw new RangeError(`${partPath}.tone must be default or red.`);
          }
          return Object.freeze({ text: part.text, tone });
        }
        if (typeof part.doodle !== 'string' || !part.doodle.trim()) {
          throw new TypeError(`${partPath} must contain non-empty text or doodle.`);
        }
        return Object.freeze({
          doodle: part.doodle,
          width: positiveNumber(part.width, `${partPath}.width`),
          height: positiveNumber(part.height, `${partPath}.height`),
        });
      });
      return Object.freeze({ parts: Object.freeze(parts), label: entry.label ?? '' });
    }
    if (typeof entry.graphic === 'string' && entry.graphic.trim()) {
      return Object.freeze({ graphic: entry.graphic });
    }
    if (typeof entry.text !== 'string' || !entry.text.trim()) {
      throw new TypeError(`${entryPath}.text must be a non-empty string.`);
    }
    const style = entry.style ?? 'body';
    if (!BODY_STYLES.has(style)) {
      throw new RangeError(`${entryPath}.style must be body, body-left, bullet, lead, emphasis, header, subheader, or subheader-spaced.`);
    }
    return Object.freeze({ text: entry.text, style });
  }));
}

function normalizeNavigation(navigation, path) {
  const value = navigation ?? {};
  assertObject(value, path);
  const escape = value.escape ?? 'none';
  if (!ESCAPE_ACTIONS.has(escape)) {
    throw new RangeError(`${path}.escape must be none, cancel, or next.`);
  }
  const outside = value.outside ?? 'none';
  if (!OUTSIDE_ACTIONS.has(outside)) {
    throw new RangeError(`${path}.outside must be none or next.`);
  }
  return Object.freeze({
    back: value.back !== false,
    next: value.next !== false,
    escape,
    outside,
  });
}

function normalizeHighlight(highlight, path) {
  const geometry = normalizeResponsiveGeometry(highlight, path);
  const padding = highlight.padding === undefined ? 0 : finiteNumber(highlight.padding, `${path}.padding`);
  if (padding < 0) throw new RangeError(`${path}.padding must not be negative.`);
  return Object.freeze({ ...geometry, padding });
}

export function normalizeAlertSequence(alerts) {
  if (!Array.isArray(alerts) || alerts.length === 0) {
    throw new TypeError('Alert sequence must be a non-empty array.');
  }
  const ids = new Set();
  return Object.freeze(alerts.map((alert, index) => {
    const path = `alerts[${index}]`;
    assertObject(alert, path);
    if (typeof alert.id !== 'string' || !alert.id.trim()) {
      throw new TypeError(`${path}.id must be a non-empty string.`);
    }
    if (ids.has(alert.id)) throw new RangeError(`Duplicate alert id "${alert.id}".`);
    ids.add(alert.id);
    if (typeof alert.label !== 'string' || !alert.label.trim()) {
      throw new TypeError(`${path}.label must be a non-empty string.`);
    }
    const mode = alert.mode ?? 'modal';
    if (!INTERACTION_MODES.has(mode)) {
      throw new RangeError(`${path}.mode must be modal or guided.`);
    }
    const highlights = alert.highlights ?? [];
    if (!Array.isArray(highlights)) throw new TypeError(`${path}.highlights must be an array.`);
    if (mode === 'guided' && highlights.length === 0) {
      throw new RangeError(`${path}.highlights must contain at least one rectangle in guided mode.`);
    }
    return Object.freeze({
      id: alert.id,
      label: alert.label,
      body: normalizeBody(alert.body, `${path}.body`),
      box: normalizeResponsiveGeometry(alert.box, `${path}.box`, { minimumSize: BOX_MIN_SIZE }),
      mode,
      highlights: Object.freeze(highlights.map((highlight, highlightIndex) => (
        normalizeHighlight(highlight, `${path}.highlights[${highlightIndex}]`)
      ))),
      navigation: normalizeNavigation(alert.navigation, `${path}.navigation`),
    });
  }));
}

export function resolveAlertGeometry(geometry, viewportMode = 'landscape') {
  const mode = viewportMode === 'portrait' ? 'portrait' : 'landscape';
  const viewport = VIEWPORTS[mode];
  const requested = mode === 'portrait' && geometry.portrait ? geometry.portrait : geometry;
  const width = Math.min(requested.width, viewport.width);
  const height = Math.min(requested.height, viewport.height);
  return Object.freeze({
    x: Math.max(0, Math.min(requested.x, viewport.width - width)),
    y: Math.max(0, Math.min(requested.y, viewport.height - height)),
    width,
    height,
  });
}

export function resolveHighlightGeometry(highlight, viewportMode = 'landscape') {
  const mode = viewportMode === 'portrait' ? 'portrait' : 'landscape';
  const viewport = VIEWPORTS[mode];
  const geometry = mode === 'portrait' && highlight.portrait ? highlight.portrait : highlight;
  const x = Math.max(0, geometry.x - highlight.padding);
  const y = Math.max(0, geometry.y - highlight.padding);
  const right = Math.min(viewport.width, geometry.x + geometry.width + highlight.padding);
  const bottom = Math.min(viewport.height, geometry.y + geometry.height + highlight.padding);
  return Object.freeze({
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  });
}

function renderBody(body, renderGraphic) {
  const hasAsideRules = body.some((line) => line.aside);
  const asideRuleCount = body.filter((line) => line.aside).length;
  let asideRuleIndex = 0;
  let trailingBulletIndex = 0;
  return body.map((line) => {
    if (line.aside) {
      asideRuleIndex += 1;
      const row = document.createElement('div');
      row.className = 'alert-box-body-row alert-box-body-row-with-aside';
      const bullet = document.createElement('canvas');
      bullet.className = 'sprite-canvas alert-box-body-bullet';
      bullet.dataset.doodle = 'arrow-bullet-point';
      bullet.dataset.frameWidth = '64';
      bullet.dataset.frameHeight = '64';
      bullet.width = 64;
      bullet.height = 64;
      bullet.setAttribute('aria-hidden', 'true');
      const paragraph = document.createElement('p');
      paragraph.className = 'alert-box-line alert-box-line-bullet';
      paragraph.textContent = line.text;
      const copy = document.createElement('div');
      copy.className = 'alert-box-rule-copy';
      copy.style.gridRow = String(asideRuleIndex + 2);
      copy.append(bullet, paragraph);
      const aside = document.createElement('div');
      aside.className = 'alert-box-rule-art';
      aside.style.gridRow = String(asideRuleIndex + 1);
      aside.setAttribute('aria-hidden', 'true');
      line.aside.forEach((part) => {
        if (part.text) {
          const text = document.createElement('span');
          text.textContent = part.text;
          aside.append(text);
          return;
        }
        const doodle = document.createElement('canvas');
        doodle.className = 'sprite-canvas alert-box-inline-art';
        doodle.dataset.doodle = part.doodle;
        doodle.dataset.frameWidth = String(part.width);
        doodle.dataset.frameHeight = String(part.height);
        doodle.width = part.width;
        doodle.height = part.height;
        aside.append(doodle);
      });
      row.append(copy, aside);
      return row;
    }
    if (line.parts) {
      const row = document.createElement('div');
      row.className = 'alert-box-rich-line';
      if (line.label) row.setAttribute('aria-label', line.label);
      line.parts.forEach((part) => {
        if (part.text) {
          const text = document.createElement('span');
          text.textContent = part.text;
          if (part.tone === 'red') text.className = 'alert-box-inline-red';
          row.append(text);
          return;
        }
        const doodle = document.createElement('canvas');
        doodle.className = 'sprite-canvas alert-box-inline-art';
        doodle.dataset.doodle = part.doodle;
        doodle.dataset.frameWidth = String(part.width);
        doodle.dataset.frameHeight = String(part.height);
        doodle.width = part.width;
        doodle.height = part.height;
        doodle.setAttribute('aria-hidden', 'true');
        row.append(doodle);
      });
      return row;
    }
    if (line.graphic) {
      const graphic = renderGraphic?.(line.graphic);
      if (graphic) return graphic;
      const placeholder = document.createElement('div');
      placeholder.className = 'alert-box-graphic';
      placeholder.dataset.graphic = line.graphic;
      return placeholder;
    }
    const paragraph = document.createElement('p');
    paragraph.className = `alert-box-line alert-box-line-${line.style}`;
    paragraph.textContent = line.text;
    if (line.style === 'bullet') {
      const row = document.createElement('div');
      row.className = 'alert-box-body-row';
      const bullet = document.createElement('canvas');
      bullet.className = 'sprite-canvas alert-box-body-bullet';
      bullet.dataset.doodle = 'arrow-bullet-point';
      bullet.dataset.frameWidth = '64';
      bullet.dataset.frameHeight = '64';
      bullet.width = 64;
      bullet.height = 64;
      bullet.setAttribute('aria-hidden', 'true');
      row.append(bullet, paragraph);
      if (hasAsideRules) {
        row.classList.add('alert-box-trailing-rule');
        row.style.gridRow = String(asideRuleCount + 3 + trailingBulletIndex);
        trailingBulletIndex += 1;
      }
      return row;
    }
    return paragraph;
  });
}

function renderAction(action, doodle, label) {
  const button = document.createElement('button');
  button.className = `alert-box-action alert-box-action-${action === 'alert-back' ? 'back' : 'next'}`;
  button.type = 'button';
  button.dataset.action = action;
  button.setAttribute('aria-label', label);
  button.innerHTML = `
    <canvas
      class="sprite-canvas alert-box-action-art"
      data-doodle="${doodle}"
      data-frame-width="${BUTTON_FRAME_WIDTH}"
      data-frame-height="${BUTTON_FRAME_HEIGHT}"
      width="${BUTTON_FRAME_WIDTH}"
      height="${BUTTON_FRAME_HEIGHT}"
      aria-hidden="true"
    ></canvas>
  `;
  return button;
}

function makeShade(step, viewportMode) {
  const mode = viewportMode === 'portrait' ? 'portrait' : 'landscape';
  const viewport = VIEWPORTS[mode];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('alert-system-shade');
  svg.setAttribute('viewBox', `0 0 ${viewport.width} ${viewport.height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const holes = step.mode === 'guided'
    ? step.highlights.map((highlight) => {
      const { x, y, width, height } = resolveHighlightGeometry(highlight, mode);
      return `M ${x} ${y} h ${width} v ${height} h ${-width} Z`;
    }).join(' ')
    : '';
  path.setAttribute('d', `M 0 0 H ${viewport.width} V ${viewport.height} H 0 Z ${holes}`);
  path.setAttribute('fill-rule', 'evenodd');
  svg.append(path);
  return svg;
}

export function createAlertSystem({
  root,
  mountSprites,
  renderGraphic,
  getViewportMode = () => 'landscape',
}) {
  let active = null;

  function finish(status, detail = {}) {
    if (!active) return;
    const sequence = active;
    active = null;
    root.removeEventListener('keydown', handleKeydown, true);
    root.removeEventListener('pointerdown', handlePointerdown, true);
    sequence.overlay?.remove();
    sequence.resolve(Object.freeze({ status, ...detail }));
  }

  function cancel(reason = 'cancelled') {
    finish('cancelled', { reason });
  }

  function show(alerts, options = {}) {
    const steps = normalizeAlertSequence(alerts);
    const startIndex = options.startId === undefined
      ? 0
      : steps.findIndex((step) => step.id === options.startId);
    if (startIndex < 0) throw new RangeError(`Unknown alert startId "${options.startId}".`);
    if (active) finish('replaced');
    return new Promise((resolve) => {
      active = {
        steps,
        index: startIndex,
        overlay: null,
        resolve,
      };
      root.addEventListener('keydown', handleKeydown, true);
      root.addEventListener('pointerdown', handlePointerdown, true);
      renderCurrent();
    });
  }

  function goBack() {
    if (!active || active.index === 0) return;
    active.index -= 1;
    renderCurrent();
  }

  function goNext() {
    if (!active) return;
    if (active.index >= active.steps.length - 1) {
      finish('completed');
      return;
    }
    active.index += 1;
    renderCurrent();
  }

  function handleKeydown(event) {
    if (!active) return;
    const step = active.steps[active.index];
    if (event.key !== 'Escape' || step.navigation.escape === 'none') return;
    event.preventDefault();
    if (step.navigation.escape === 'next') goNext();
    else cancel('escape');
  }

  function handlePointerdown(event) {
    if (!active) return;
    const step = active.steps[active.index];
    if (step.navigation.outside !== 'next') return;
    const panel = active.overlay?.querySelector('.alert-system-box');
    if (panel?.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    goNext();
  }

  function renderCurrent() {
    if (!active) return;
    active.overlay?.remove();
    const step = active.steps[active.index];
    const viewportMode = getViewportMode() === 'portrait' ? 'portrait' : 'landscape';
    const box = resolveAlertGeometry(step.box, viewportMode);
    const overlay = document.createElement('div');
    overlay.className = `alert-system-overlay is-${step.mode}`;
    if (step.navigation.outside === 'next') {
      overlay.classList.add('is-outside-dismissable');
    }
    overlay.dataset.alertId = step.id;
    overlay.append(makeShade(step, viewportMode));

    const panel = document.createElement('section');
    panel.className = 'alert-box alert-system-box';
    panel.setAttribute('role', step.mode === 'modal' ? 'alertdialog' : 'dialog');
    panel.setAttribute('aria-modal', step.mode === 'modal' ? 'true' : 'false');
    panel.setAttribute('aria-label', step.label);
    panel.tabIndex = -1;
    panel.style.left = `${box.x}px`;
    panel.style.top = `${box.y}px`;
    panel.style.width = `${box.width}px`;
    panel.style.height = `${box.height}px`;

    const body = document.createElement('div');
    body.className = 'alert-box-body';
    body.append(...renderBody(step.body, renderGraphic));
    panel.append(body);

    const actions = document.createElement('nav');
    actions.className = 'alert-box-actions';
    actions.setAttribute('aria-label', 'Alert navigation');
    if (active.index > 0 && step.navigation.back) {
      const back = renderAction('alert-back', 'tutorial/Prev_slide_button', 'Previous');
      back.addEventListener('click', goBack);
      actions.append(back);
    }
    if (step.navigation.next) {
      const last = active.index === active.steps.length - 1;
      const next = renderAction(
        'alert-next',
        last ? 'tutorial/continue_tutorial_button' : 'tutorial/next_slide_button',
        last ? 'Continue' : 'Next',
      );
      next.addEventListener('click', goNext);
      actions.append(next);
    }
    if (actions.childElementCount) panel.append(actions);

    overlay.append(panel);
    root.append(overlay);
    active.overlay = overlay;
    mountSprites(overlay.querySelectorAll('.sprite-canvas'));
    (panel.querySelector('[data-action="alert-next"]') ?? panel).focus();
  }

  return Object.freeze({
    back: goBack,
    cancel,
    getCurrentStep: () => active?.steps[active.index] ?? null,
    isActive: () => Boolean(active),
    next: goNext,
    refresh: renderCurrent,
    show,
  });
}
