const COMPLETE = Object.freeze({ status: 'completed' });

export class GameplayAnimationDirector {
  constructor({ buildTimeline = defaultTimeline, effects = {}, onReconcile = () => {} } = {}) {
    this.buildTimeline = buildTimeline;
    this.effects = effects;
    this.onReconcile = onReconcile;
    this.queue = [];
    this.seen = new Set();
    this.latestRevision = -Infinity;
    this.authoritativeState = null;
    this.controller = null;
    this.draining = null;
  }

  isPresenting() {
    return Boolean(this.controller) || this.queue.length > 0;
  }

  enqueue(transition) {
    if (!transition?.id || this.seen.has(transition.id)) return Promise.resolve({ status: 'duplicate' });
    const revision = Number.isFinite(transition.revision) ? transition.revision : this.latestRevision + 1;
    if (revision < this.latestRevision) return Promise.resolve({ status: 'stale' });

    this.latestRevision = Math.max(this.latestRevision, revision);
    this.seen.add(transition.id);
    this.queue.push(freezeTransition({ ...transition, revision }));
    this.queue.sort((left, right) => left.revision - right.revision);
    this.draining ??= this.drain();
    return this.draining;
  }

  async play(transition) {
    if (!transition?.id) throw new TypeError('Gameplay animation transition requires an id.');
    this.cancel('replaced');
    this.seen.delete(transition.id);
    return this.enqueue(transition);
  }

  cancel(reason = 'cancelled') {
    this.queue.length = 0;
    this.controller?.abort(reason);
    this.controller = null;
  }

  reconcile(authoritativeState) {
    this.authoritativeState = authoritativeState;
    if (!this.isPresenting()) this.onReconcile(authoritativeState);
  }

  async drain() {
    let result = COMPLETE;
    try {
      while (this.queue.length) {
        const transition = this.queue.shift();
        // Catch up at transition boundaries. Only the newest queued transition matters.
        if (this.queue.length && transition.revision < this.latestRevision) continue;
        result = await this.run(transition);
      }
    } finally {
      this.controller = null;
      this.draining = null;
      if (this.authoritativeState !== null) this.onReconcile(this.authoritativeState);
    }
    return result;
  }

  async run(transition) {
    const controller = new AbortController();
    this.controller = controller;
    const beats = await this.buildTimeline(transition);
    for (const beat of beats ?? []) {
      if (controller.signal.aborted) return { status: 'cancelled', reason: controller.signal.reason };
      const effect = this.effects[beat.type];
      if (!effect) throw new RangeError(`Unknown gameplay animation effect "${beat.type}".`);
      await effect(beat, transition, controller.signal);
    }
    return controller.signal.aborted
      ? { status: 'cancelled', reason: controller.signal.reason }
      : COMPLETE;
  }
}

function defaultTimeline(transition) {
  return transition.beats ?? [];
}

function freezeTransition(transition) {
  return deepFreeze(structuredClone(transition));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export function waitForAnimation(duration, signal) {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    let timeout = null;
    const finish = (completed) => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      resolve(completed);
    };
    const abort = () => finish(false);
    signal?.addEventListener('abort', abort, { once: true });
    timeout = setTimeout(() => finish(true), Math.max(0, duration));
  });
}
