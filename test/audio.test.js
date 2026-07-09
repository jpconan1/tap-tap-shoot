import assert from 'node:assert/strict';
import test from 'node:test';

test('tap tap shoot scene audio starts through WebAudio', async () => {
  let starts = 0;

  class MockAudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = {};
      this.state = 'suspended';
    }

    addEventListener() {}

    resume() {
      this.state = 'running';
      return Promise.resolve();
    }

    decodeAudioData() {
      return Promise.resolve({ duration: 1 });
    }

    createBufferSource() {
      return {
        connect() {},
        start() {
          starts += 1;
        },
        stop() {},
        set buffer(value) {
          this._buffer = value;
        },
      };
    }

    createGain() {
      return {
        gain: { value: 1 },
        connect() {},
      };
    }
  }

  globalThis.window = {
    AudioContext: MockAudioContext,
    addEventListener() {},
  };
  globalThis.Audio = class {
    load() {}

    play() {
      return Promise.resolve();
    }
  };
  globalThis.fetch = async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(1),
  });

  const audio = await import(`../src/audio.js?audio-test=${Date.now()}`);

  audio.setSoundEnabled(true);
  await audio.unlockSceneAudio();
  audio.playStageAudio({
    isTransitioning: false,
    presentation: { kind: 'doodle', name: 'tap-tap-shoot/shoot-kill' },
    audioKey: 'turn:shoot-kill',
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(starts, 1);
});
