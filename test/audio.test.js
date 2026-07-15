import assert from 'node:assert/strict';
import test from 'node:test';

test('boot preload waits for a user gesture before creating WebAudio context', async () => {
  let contextsCreated = 0;

  globalThis.window = {
    AudioContext: class {
      constructor() {
        contextsCreated += 1;
      }
    },
    addEventListener() {},
  };
  globalThis.Audio = class {};

  const audio = await import(`../src/audio.js?gesture-preload-test=${Date.now()}`);
  await audio.preloadSceneAudio();

  assert.equal(contextsCreated, 0);
});

test('Tap Tap Shoot X scene audio starts through WebAudio', async () => {
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
    presentation: { kind: 'doodle', name: 'tap-tap-shoot-x/shoot-kill' },
    audioKey: 'turn:shoot-kill',
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(starts, 1);
});

test('Tap Tap Shoot X standoff uses reload sound', async () => {
  const played = [];

  globalThis.window = {
    addEventListener() {},
  };
  globalThis.Audio = class {
    constructor(src) {
      this.src = src;
    }

    load() {}

    play() {
      played.push(this.src);
      return Promise.resolve();
    }
  };

  const audio = await import(`../src/audio.js?tts-standoff-test=${Date.now()}`);
  audio.setSoundEnabled(true);
  audio.playStageAudio({
    isTransitioning: false,
    presentation: { kind: 'doodle', name: 'tap-tap-shoot-x/standoff-tts' },
    audioKey: 'tts:standoff',
  });

  assert.deepEqual(played, ['./assets/audio/reload.mp3']);
});

test('Tap Tap Shoot Y standoff and stab versus reload use assigned sounds', async () => {
  const played = [];

  globalThis.window = {
    addEventListener() {},
  };
  globalThis.Audio = class {
    constructor(src) {
      this.src = src;
      this.volume = 1;
      this.currentTime = 0;
    }

    load() {}

    play() {
      played.push(this.src);
      return Promise.resolve();
    }
  };

  const audio = await import(`../src/audio.js?ssd-stab-reload-test=${Date.now()}`);
  audio.setSoundEnabled(true);
  audio.playStageAudio({
    isTransitioning: false,
    presentation: { kind: 'doodle', name: 'tap-tap-shoot-y/standoff-ssd' },
    audioKey: 'ssd:standoff',
  });
  audio.playStageAudio({
    isTransitioning: false,
    presentation: { kind: 'doodle', name: 'tap-tap-shoot-y/stab-reload' },
    audioKey: 'ssd:stab-reload',
  });

  assert.deepEqual(played, [
    './assets/audio/reload.mp3',
    './assets/audio/counterstab.mp3',
  ]);
});

test('Fireball War uses intentional scene sounds only', async () => {
  const played = [];

  globalThis.window = {
    addEventListener() {},
  };
  globalThis.Audio = class {
    constructor(src) {
      this.src = src;
      this.volume = 1;
      this.currentTime = 0;
    }

    load() {}

    play() {
      played.push(this.src);
      return Promise.resolve();
    }
  };

  const audio = await import(`../src/audio.js?cbf-audio-test=${Date.now()}`);

  audio.setSoundEnabled(true);

  audio.playStageAudio({
    isTransitioning: false,
    presentation: { kind: 'doodle', name: 'fireball-war/cbf-standoff' },
    audioKey: 'cbf:standoff',
  });
  audio.playStageAudio({
    isTransitioning: false,
    presentation: { kind: 'doodle', name: 'fireball-war/block-draw' },
    audioKey: 'cbf:block-block',
  });
  audio.playStageAudio({
    isTransitioning: false,
    presentation: { kind: 'doodle', name: 'fireball-war/block-charge' },
    audioKey: 'cbf:block-charge',
  });
  audio.playStageAudio({
    isTransitioning: false,
    presentation: { kind: 'doodle', name: 'fireball-war/block-fireball' },
    audioKey: 'cbf:block-fireball',
  });
  audio.playStageAudio({
    isTransitioning: false,
    presentation: { kind: 'doodle', name: 'fireball-war/fireball-draw' },
    audioKey: 'cbf:fireball-fireball',
  });
  audio.playStageAudio({
    isTransitioning: false,
    presentation: { kind: 'doodle', name: 'fireball-war/charge-fireball' },
    audioKey: 'cbf:fireball-kill',
  });
  audio.playStageAudio({
    isTransitioning: false,
    presentation: { kind: 'doodle', name: 'fireball-war/super-final-frame1' },
    audioKey: 'cbf:super',
  });

  assert.deepEqual(played, [
    './assets/audio/charge.mp3',
    './assets/audio/block.m4a',
    './assets/audio/collision.mp3',
    './assets/audio/super.mp3',
  ]);
});

test('rock paper scissors only sounds on rock and scissors ties', async () => {
  const played = [];

  globalThis.window = {
    addEventListener() {},
  };
  globalThis.Audio = class {
    constructor(src) {
      this.src = src;
      this.volume = 1;
      this.currentTime = 0;
    }

    load() {}

    play() {
      played.push(this.src);
      return Promise.resolve();
    }
  };

  const audio = await import(`../src/audio.js?rps-audio-test=${Date.now()}`);
  audio.setSoundEnabled(true);

  const scenes = [
    'rps-standoff',
    'rock-draw',
    'paper-draw',
    'scissors-tie',
    'rock-scissors',
    'paper-rock',
    'scissors-paper',
  ];

  scenes.forEach((scene) => {
    audio.playStageAudio({
      isTransitioning: false,
      presentation: { kind: 'doodle', name: `rock-paper-scissors/${scene}` },
      audioKey: `rps:${scene}`,
    });
  });

  assert.deepEqual(played, [
    './assets/audio/collision.mp3',
    './assets/audio/clash.mp3',
  ]);
});

test('Gun Knife Fist uses punch sounds without silence file', async () => {
  const played = [];

  globalThis.window = {
    addEventListener() {},
  };
  globalThis.Audio = class {
    constructor(src) {
      this.src = src;
      this.volume = 1;
      this.currentTime = 0;
    }

    load() {}

    play() {
      played.push(this.src);
      return Promise.resolve();
    }
  };

  const audio = await import(`../src/audio.js?pss-audio-test=${Date.now()}`);

  audio.setSoundEnabled(true);

  audio.playStageAudio({
    isTransitioning: false,
    presentation: { kind: 'doodle', name: 'gun-knife-fist/pss-standoff' },
    audioKey: 'pss:standoff',
  });
  audio.playStageAudio({
    isTransitioning: false,
    presentation: { kind: 'doodle', name: 'gun-knife-fist/punch-draw' },
    audioKey: 'pss:punch-collision',
  });
  audio.playStageAudio({
    isTransitioning: false,
    presentation: { kind: 'doodle', name: 'gun-knife-fist/punch-shoot-damage' },
    audioKey: 'pss:punch-damage',
  });
  audio.playStageAudio({
    isTransitioning: false,
    presentation: { kind: 'doodle', name: 'gun-knife-fist/punch-shoot-kill' },
    audioKey: 'pss:punch-kill',
  });

  assert.deepEqual(played, [
    './assets/audio/reload.mp3',
    './assets/audio/collision.mp3',
    './assets/audio/punch.mp3',
    './assets/audio/punch-kill.mp3',
  ]);
});

test('game music sometimes uses loop variants instead of piano loop', async () => {
  const played = [];
  const originalRandom = Math.random;

  globalThis.window = {
    addEventListener() {},
  };
  globalThis.Audio = class {
    constructor(src) {
      this.src = src;
      this.volume = 1;
      this.currentTime = 0;
      this.onended = null;
    }

    load() {}

    pause() {}

    play() {
      played.push(this.src);
      return Promise.resolve();
    }
  };

  const audio = await import(`../src/audio.js?music-var-test=${Date.now()}`);

  audio.setMusicEnabled(true);

  const randomValues = [0.25, 0.61, 0.75];
  Math.random = () => randomValues.shift() ?? 0.75;

  try {
    audio.restartMusicTrack('game');
    audio.restartMusicTrack('game');
  } finally {
    Math.random = originalRandom;
  }

  assert.deepEqual(played.slice(-2), [
    './assets/audio/loop-var4.mp3',
    './assets/audio/piano_loop.mp3',
  ]);
});
