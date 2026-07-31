import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAlertSystem,
  normalizeAlertSequence,
  resolveAlertGeometry,
  resolveHighlightGeometry,
} from '../src/alertSystem.js';

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this.parent = null;
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.listeners = new Map();
    this.className = '';
    this.classList = { add: (...names) => { this.className = [this.className, ...names].filter(Boolean).join(' '); } };
  }

  append(...children) {
    children.forEach((child) => {
      child.parent = this;
      this.children.push(child);
    });
  }

  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }

  removeEventListener(name, listener) {
    if (this.listeners.get(name) === listener) this.listeners.delete(name);
  }

  focus() {
    this.focused = true;
  }

  contains(target) {
    if (this === target) return true;
    return this.children.some((child) => child.contains(target));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (element) => {
      const action = selector.match(/^\[data-action="(.+)"\]$/)?.[1];
      const className = selector.startsWith('.') ? selector.slice(1) : null;
      if (
        (action && element.dataset.action === action)
        || (className && element.className.split(' ').includes(className))
      ) {
        matches.push(element);
      }
      element.children.forEach(visit);
    };
    this.children.forEach(visit);
    return matches;
  }

  get childElementCount() {
    return this.children.length;
  }
}

function validStep(overrides = {}) {
  return {
    id: 'welcome',
    label: 'Welcome',
    body: ['First line', { text: 'Important line', style: 'emphasis' }],
    box: { x: 100, y: 80, width: 420, height: 220 },
    ...overrides,
  };
}

test('alert definitions normalize JSON-friendly copy and defaults', () => {
  const [step] = normalizeAlertSequence([validStep()]);
  assert.deepEqual(step.body, [
    { text: 'First line', style: 'body' },
    { text: 'Important line', style: 'emphasis' },
  ]);
  assert.equal(step.mode, 'modal');
  assert.deepEqual(step.navigation, {
    back: true,
    next: true,
    escape: 'none',
    outside: 'none',
  });
});

test('alert body supports reusable text styles and keyed graphics', () => {
  const [step] = normalizeAlertSequence([validStep({
    body: [
      { text: 'Title', style: 'header' },
      { text: 'Deck', style: 'subheader' },
      { text: 'Point', style: 'bullet' },
      { graphic: 'example-diagram' },
    ],
  })]);
  assert.deepEqual(step.body, [
    { text: 'Title', style: 'header' },
    { text: 'Deck', style: 'subheader' },
    { text: 'Point', style: 'bullet' },
    { graphic: 'example-diagram' },
  ]);
});

test('guided alerts require one or more valid highlight rectangles', () => {
  assert.throws(
    () => normalizeAlertSequence([validStep({ mode: 'guided' })]),
    /at least one rectangle/,
  );
  const [step] = normalizeAlertSequence([validStep({
    mode: 'guided',
    highlights: [{ x: 10, y: 20, width: 30, height: 40, padding: 5 }],
  })]);
  assert.equal(step.highlights.length, 1);
});

test('alert definitions reject duplicate ids and malformed content', () => {
  assert.throws(() => normalizeAlertSequence([validStep(), validStep()]), /Duplicate alert id/);
  assert.throws(() => normalizeAlertSequence([validStep({ body: [] })]), /non-empty array/);
  assert.throws(() => normalizeAlertSequence([validStep({ mode: 'passive' })]), /modal or guided/);
  assert.throws(
    () => normalizeAlertSequence([validStep({ box: { x: 0, y: 0, width: 20, height: 20 } })]),
    /at least 96/,
  );
});

test('alert geometry clamps inside landscape and uses portrait overrides', () => {
  const [step] = normalizeAlertSequence([validStep({
    box: {
      x: 900,
      y: 500,
      width: 420,
      height: 220,
      portrait: { x: 30, y: 700, width: 480, height: 320 },
    },
  })]);
  assert.deepEqual(resolveAlertGeometry(step.box), { x: 540, y: 320, width: 420, height: 220 });
  assert.deepEqual(resolveAlertGeometry(step.box, 'portrait'), { x: 30, y: 640, width: 480, height: 320 });
});

test('highlight padding expands rectangles and clamps them to viewport', () => {
  const [step] = normalizeAlertSequence([validStep({
    mode: 'guided',
    highlights: [{ x: 4, y: 5, width: 100, height: 50, padding: 12 }],
  })]);
  assert.deepEqual(resolveHighlightGeometry(step.highlights[0]), {
    x: 0,
    y: 0,
    width: 116,
    height: 67,
  });
});

test('alert system navigates backward and resolves completed sequences', async (context) => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    createElementNS: (_namespace, tagName) => new FakeElement(tagName),
  };
  context.after(() => { globalThis.document = previousDocument; });
  const root = new FakeElement('main');
  const system = createAlertSystem({ root, mountSprites() {} });
  const result = system.show([
    validStep(),
    validStep({ id: 'second', label: 'Second' }),
  ]);

  system.next();
  assert.equal(system.getCurrentStep().id, 'second');
  system.back();
  assert.equal(system.getCurrentStep().id, 'welcome');
  root.querySelector('[data-action="alert-next"]').listeners.get('click')();
  root.querySelector('[data-action="alert-next"]').listeners.get('click')();

  assert.deepEqual(await result, { status: 'completed' });
  assert.equal(system.isActive(), false);
  assert.equal(root.children.length, 0);
});

test('show safely replaces an active sequence and cancel resolves its reason', async (context) => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    createElementNS: (_namespace, tagName) => new FakeElement(tagName),
  };
  context.after(() => { globalThis.document = previousDocument; });
  const root = new FakeElement('main');
  const system = createAlertSystem({ root, mountSprites() {} });
  const replaced = system.show([validStep()]);
  const cancelled = system.show([validStep({ id: 'replacement' })]);

  assert.deepEqual(await replaced, { status: 'replaced' });
  system.cancel('screen-rendered');
  assert.deepEqual(await cancelled, { status: 'cancelled', reason: 'screen-rendered' });
  assert.equal(root.listeners.has('keydown'), false);
});

test('guided shade cuts holes while modal shade covers the viewport', async (context) => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    createElementNS: (_namespace, tagName) => new FakeElement(tagName),
  };
  context.after(() => { globalThis.document = previousDocument; });
  const root = new FakeElement('main');
  const system = createAlertSystem({ root, mountSprites() {} });
  const modal = system.show([validStep()]);
  const modalPath = root.querySelector('.alert-system-shade').children[0].attributes.get('d');
  assert.equal((modalPath.match(/M /g) ?? []).length, 1);

  const guided = system.show([validStep({
    id: 'guided',
    mode: 'guided',
    highlights: [
      { x: 10, y: 20, width: 30, height: 40 },
      { x: 100, y: 120, width: 50, height: 60 },
    ],
  })]);
  const guidedPath = root.querySelector('.alert-system-shade').children[0].attributes.get('d');
  assert.equal((guidedPath.match(/M /g) ?? []).length, 3);

  assert.deepEqual(await modal, { status: 'replaced' });
  system.cancel();
  await guided;
});

test('outside press advances when the current step opts in', async (context) => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    createElementNS: (_namespace, tagName) => new FakeElement(tagName),
  };
  context.after(() => { globalThis.document = previousDocument; });
  const root = new FakeElement('main');
  const system = createAlertSystem({ root, mountSprites() {} });
  const result = system.show([validStep({
    navigation: { outside: 'next' },
  })]);
  const event = {
    target: root,
    preventDefaultCalled: false,
    stopImmediatePropagationCalled: false,
    preventDefault() { this.preventDefaultCalled = true; },
    stopImmediatePropagation() { this.stopImmediatePropagationCalled = true; },
  };

  root.listeners.get('pointerdown')(event);

  assert.equal(event.preventDefaultCalled, true);
  assert.equal(event.stopImmediatePropagationCalled, true);
  assert.deepEqual(await result, { status: 'completed' });
});
