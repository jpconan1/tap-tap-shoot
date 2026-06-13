export const STARBURST_WIPE_AUDIO = 'starbust.wav';
export const LOSE_JINGLE_AUDIO = 'lose_jingle.wav';
export const WIN_SOUND_AUDIO = 'win_sound.wav';

const SCENE_AUDIO = Object.freeze({
  shooting: 'gunshot.wav',
  stabbing: 'stab.wav',
  hiding: 'nothing.wav',
  clash: 'clash.wav',
  collision: 'collision.wav',
  counterstab: 'counterstab.wav',
  dodge: 'wiff.wav',
  reloading: 'reload.wav',
  tricky: 'reload.wav',
});
const MUSIC_TRACKS = Object.freeze({
  title: 'title_loop.wav',
  game: 'piano_loop.wav',
  sax: 'sax_loop.wav',
});
const MUSIC_TOPPERS = Object.freeze({
  tension: 'string_loop_topper.wav',
  final: 'string_loop_topper2.wav',
});
const MUSIC_SCHEDULE_LOOKAHEAD_SECONDS = 0.08;

const sceneAudio = new Map();
const sceneAudioBuffers = new Map();
const sceneAudioLoadPromises = new Map();
let sceneAudioContext = null;
let sceneAudioUnlockPromise = null;
let desiredMusicTrack = null;
let queuedMusicTrack = null;
let queuedMusicSegment = null;
let currentMusicSegment = null;
let musicTopperSegments = [];
let musicScheduleTimer = null;
let htmlMusicAudio = null;
let htmlMusicTrack = null;
let lastStageAudioKey = null;
let getMusicTopperFile = () => null;

export function configureAudio(options) {
  getMusicTopperFile = options.getMusicTopperFile;
}

export function resetStageAudioKey() {
  lastStageAudioKey = null;
}

export function installAudioUnlockListeners() {
  const options = { capture: true, once: true };
  const unlock = () => unlockSceneAudio();

  window.addEventListener('pointerdown', unlock, options);
  window.addEventListener('keydown', unlock, options);
  window.addEventListener('touchstart', unlock, options);
}

export function requestMusicTrack(trackId) {
  if (!MUSIC_TRACKS[trackId]) {
    return;
  }

  desiredMusicTrack = trackId;

  const context = getExistingSceneAudioContext();

  if (!context) {
    return;
  }

  loadSceneAudioBuffer(MUSIC_TRACKS[trackId]).then(() => syncMusicTrack());
  syncMusicTrack();
}

export function queueMusicTrackOnce(trackId, returnTrackId) {
  if (!MUSIC_TRACKS[trackId] || !MUSIC_TRACKS[returnTrackId]) {
    return;
  }

  const context = getSceneAudioContext();

  if (!context) {
    return;
  }

  queuedMusicSegment = { trackId, returnTrackId };
  loadSceneAudioBuffer(MUSIC_TRACKS[trackId]).then(() => syncMusicTrack());
  loadSceneAudioBuffer(MUSIC_TRACKS[returnTrackId]);
  syncMusicTrack();
}

export function restartMusicTrack(trackId) {
  if (!MUSIC_TRACKS[trackId]) {
    return;
  }

  desiredMusicTrack = trackId;
  queuedMusicTrack = null;
  queuedMusicSegment = null;

  const context = getSceneAudioContext();

  if (!context) {
    startHtmlMusicTrack(trackId, null);
    return;
  }

  stopCurrentMusicSegment();
  loadSceneAudioBuffer(MUSIC_TRACKS[trackId]).then((buffer) => {
    if (!buffer || context.state !== 'running') {
      return;
    }

    startMusicSegment(trackId, context.currentTime + 0.005, null);
  });
}

export function restartMusicTrackOnce(trackId, returnTrackId) {
  if (!MUSIC_TRACKS[trackId] || !MUSIC_TRACKS[returnTrackId]) {
    return;
  }

  desiredMusicTrack = returnTrackId;
  queuedMusicTrack = null;
  queuedMusicSegment = null;

  const context = getSceneAudioContext();

  if (!context) {
    startHtmlMusicTrack(trackId, returnTrackId);
    return;
  }

  stopCurrentMusicSegment();
  loadSceneAudioBuffer(MUSIC_TRACKS[trackId]).then((buffer) => {
    if (!buffer || context.state !== 'running') {
      return;
    }

    loadSceneAudioBuffer(MUSIC_TRACKS[returnTrackId]);
    startMusicSegment(trackId, context.currentTime + 0.005, returnTrackId);
  });
}

export function interruptMusicFileOnce(fileName, returnTrackId = desiredMusicTrack ?? 'game', resumeCurrentTrack = true) {
  if (!fileName) {
    return;
  }

  desiredMusicTrack = returnTrackId;
  queuedMusicTrack = null;
  queuedMusicSegment = null;

  const context = getSceneAudioContext();

  if (!context) {
    const audio = getSceneAudio(fileName);
    audio.muted = false;
    audio.volume = 1;
    audio.currentTime = 0;
    audio.onended = () => {
      if (returnTrackId) {
        startHtmlMusicTrack(returnTrackId, null);
      }
    };
    audio.play().catch((error) => {
      console.warn(`Could not play music interrupt: ${fileName}`, error);
    });
    return;
  }

  loadSceneAudioBuffer(fileName).then((buffer) => {
    if (!buffer || context.state !== 'running') {
      return;
    }

    if (returnTrackId && MUSIC_TRACKS[returnTrackId]) {
      loadSceneAudioBuffer(MUSIC_TRACKS[returnTrackId]);
    }

    const resumeSegment = resumeCurrentTrack ? getInterruptedMusicResumeSegment(returnTrackId) : null;
    stopCurrentMusicSegment();
    startMusicFileSegment(fileName, context.currentTime + 0.005, resumeSegment);
  });
}

export function syncMusicTopper() {
  const fileName = getMusicTopperFile();

  if (!fileName) {
    stopMusicTopperSegment();
    return;
  }

  loadSceneAudioBuffer(fileName).then(() => {
    if (
      !currentMusicSegment?.trackId
      || hasMusicTopperSegment(fileName, currentMusicSegment.source)
    ) {
      return;
    }

    const context = getSceneAudioContext();

    if (!context || context.state !== 'running') {
      return;
    }

    const elapsed = Math.max(0, context.currentTime - currentMusicSegment.startTime);
    const offset = currentMusicSegment.offset + elapsed;
    syncMusicTopperForSegment(currentMusicSegment, context.currentTime + 0.005, offset);
  });
}

export function playStageAudio({ isTransitioning, presentation, audioKey }) {
  if (isTransitioning || presentation.kind !== 'doodle') {
    return;
  }

  const fileName = SCENE_AUDIO[presentation.name];

  if (!fileName) {
    return;
  }

  if (audioKey === lastStageAudioKey) {
    return;
  }

  lastStageAudioKey = audioKey;
  playSceneAudio(fileName, audioKey);
}

export function playOneShotAudio(fileName) {
  const context = getSceneAudioContext();

  if (!context) {
    playSceneHtmlAudio(fileName);
    return;
  }

  const buffer = sceneAudioBuffers.get(fileName);

  if (buffer) {
    startSceneAudioBuffer(context, buffer);
    return;
  }

  loadSceneAudioBuffer(fileName).then((loadedBuffer) => {
    if (loadedBuffer) {
      startSceneAudioBuffer(context, loadedBuffer);
      return;
    }

    playSceneHtmlAudio(fileName);
  });
}

export function unlockSceneAudio() {
  if (sceneAudioUnlockPromise) {
    return sceneAudioUnlockPromise;
  }

  const context = getSceneAudioContext();
  const audioFiles = getAudioFiles();

  if (!context) {
    audioFiles.forEach((fileName) => getSceneAudio(fileName).load());
    sceneAudioUnlockPromise = Promise.resolve();
    return sceneAudioUnlockPromise;
  }

  sceneAudioUnlockPromise = context.resume()
    .catch((error) => {
      console.warn('Could not unlock scene audio context', error);
    })
    .then(() => desiredMusicTrack ? loadSceneAudioBuffer(MUSIC_TRACKS[desiredMusicTrack]) : null)
    .then(() => syncMusicTrack())
    .then(() => Promise.all(audioFiles.map((fileName) => loadSceneAudioBuffer(fileName))))
    .then(() => syncMusicTrack())
    .then(() => undefined);

  return sceneAudioUnlockPromise;
}

export function getMusicTopperId(id) {
  return MUSIC_TOPPERS[id] ?? null;
}

function getInterruptedMusicResumeSegment(fallbackTrackId) {
  const context = getSceneAudioContext();

  if (!context || !currentMusicSegment?.trackId) {
    return fallbackTrackId ? { trackId: fallbackTrackId, returnTrackId: null, offset: 0 } : null;
  }

  const fileName = MUSIC_TRACKS[currentMusicSegment.trackId];
  const buffer = fileName ? sceneAudioBuffers.get(fileName) : null;

  if (!buffer) {
    return { trackId: currentMusicSegment.trackId, returnTrackId: currentMusicSegment.returnTrackId, offset: 0 };
  }

  const elapsed = Math.max(0, context.currentTime - currentMusicSegment.startTime);
  const offset = (currentMusicSegment.offset + elapsed) % buffer.duration;

  return {
    trackId: currentMusicSegment.trackId,
    returnTrackId: currentMusicSegment.returnTrackId,
    offset,
  };
}

function startMusicFileSegment(fileName, startAt, resumeSegment) {
  const context = getSceneAudioContext();
  const buffer = fileName ? sceneAudioBuffers.get(fileName) : null;

  if (!context || context.state !== 'running' || !buffer) {
    return;
  }

  const source = context.createBufferSource();
  const safeStartAt = Math.max(startAt, context.currentTime + 0.005);
  const segment = {
    trackId: null,
    returnTrackId: null,
    resumeSegment,
    source,
    startTime: safeStartAt,
    offset: 0,
    endTime: safeStartAt + buffer.duration,
  };

  source.buffer = buffer;
  source.connect(context.destination);
  source.onended = () => {
    if (currentMusicSegment?.source === source) {
      const nextResumeSegment = currentMusicSegment.resumeSegment;
      currentMusicSegment = null;
      stopMusicTopperSegment(source);
      resumeInterruptedMusic(nextResumeSegment);
      return;
    }

    stopMusicTopperSegment(source);
  };
  source.start(safeStartAt);
  currentMusicSegment = segment;
}

function resumeInterruptedMusic(resumeSegment) {
  const context = getSceneAudioContext();

  if (!context || context.state !== 'running') {
    syncMusicTrack();
    return;
  }

  if (!resumeSegment?.trackId || !MUSIC_TRACKS[resumeSegment.trackId]) {
    syncMusicTrack();
    return;
  }

  loadSceneAudioBuffer(MUSIC_TRACKS[resumeSegment.trackId]).then((buffer) => {
    if (!buffer || context.state !== 'running' || currentMusicSegment) {
      return;
    }

    startMusicSegment(
      resumeSegment.trackId,
      context.currentTime + 0.005,
      resumeSegment.returnTrackId,
      resumeSegment.offset,
    );
  });
}

function syncMusicTrack() {
  const context = getExistingSceneAudioContext();

  if (!context) {
    return;
  }

  if (context.state !== 'running' || !desiredMusicTrack) {
    return;
  }

  if (!currentMusicSegment) {
    const nextSegment = queuedMusicSegment;
    queuedMusicSegment = null;

    if (nextSegment) {
      startMusicSegment(nextSegment.trackId, context.currentTime + 0.02, nextSegment.returnTrackId);
      return;
    }

    startMusicSegment(desiredMusicTrack, context.currentTime + 0.02, null);
    return;
  }

  if (currentMusicSegment.trackId !== desiredMusicTrack) {
    queuedMusicTrack = desiredMusicTrack;
  }

  scheduleMusicBoundaryCheck();
}

function startMusicSegment(trackId, startAt, returnTrackId, offset = 0) {
  const context = getSceneAudioContext();
  const fileName = MUSIC_TRACKS[trackId];
  const buffer = fileName ? sceneAudioBuffers.get(fileName) : null;

  if (!context || context.state !== 'running' || !buffer) {
    if (fileName) {
      loadSceneAudioBuffer(fileName).then(() => syncMusicTrack());
    }

    return;
  }

  const source = context.createBufferSource();
  const safeStartAt = Math.max(startAt, context.currentTime + 0.005);
  const safeOffset = normalizeAudioOffset(offset, buffer.duration);
  const segment = {
    trackId,
    returnTrackId,
    source,
    startTime: safeStartAt,
    offset: safeOffset,
    endTime: safeStartAt + buffer.duration - safeOffset,
  };

  source.buffer = buffer;
  source.connect(context.destination);
  source.onended = () => {
    if (currentMusicSegment?.source === source) {
      currentMusicSegment = null;
      stopMusicTopperSegment(source);
      syncMusicTrack();
      return;
    }

    stopMusicTopperSegment(source);
  };
  source.start(safeStartAt, safeOffset);
  currentMusicSegment = segment;
  syncMusicTopperForSegment(segment, safeStartAt, safeOffset);
  scheduleMusicBoundaryCheck();
}

function normalizeAudioOffset(offset, duration) {
  if (!duration || duration <= 0) {
    return 0;
  }

  return ((offset % duration) + duration) % duration;
}

function stopCurrentMusicSegment() {
  clearTimeout(musicScheduleTimer);
  musicScheduleTimer = null;
  stopMusicTopperSegment();

  if (!currentMusicSegment) {
    return;
  }

  const source = currentMusicSegment.source;
  currentMusicSegment = null;
  source.onended = null;

  try {
    source.stop();
  } catch {
    // Already stopped.
  }
}

function syncMusicTopperForSegment(segment, startAt, offset = 0) {
  const fileName = getMusicTopperFile();

  if (!fileName) {
    stopMusicTopperSegment();
    return;
  }

  const context = getSceneAudioContext();
  const buffer = sceneAudioBuffers.get(fileName);

  if (!context || context.state !== 'running') {
    return;
  }

  if (!buffer) {
    loadSceneAudioBuffer(fileName);
    return;
  }

  const shouldReplaceNow = startAt <= context.currentTime + 0.02;

  if (shouldReplaceNow) {
    stopMusicTopperSegment();
  } else {
    stopMusicTopperSegment(segment.source);
  }

  const source = context.createBufferSource();
  const safeOffset = normalizeAudioOffset(offset, buffer.duration);
  const topperSegment = {
    source,
    baseSource: segment.source,
    fileName,
  };

  source.buffer = buffer;
  source.connect(context.destination);
  source.onended = () => {
    forgetMusicTopperSegment(topperSegment);
  };
  source.start(startAt, safeOffset);
  musicTopperSegments.push(topperSegment);
}

function stopMusicTopperSegment(baseSource = null) {
  const segmentsToStop = baseSource
    ? musicTopperSegments.filter((segment) => segment.baseSource === baseSource)
    : musicTopperSegments;

  if (!segmentsToStop.length) {
    return;
  }

  musicTopperSegments = musicTopperSegments.filter((segment) => !segmentsToStop.includes(segment));

  segmentsToStop.forEach((segment) => {
    segment.source.onended = null;

    try {
      segment.source.stop();
    } catch {
      // Already stopped.
    }
  });
}

function hasMusicTopperSegment(fileName, baseSource = null) {
  return musicTopperSegments.some((segment) => (
    segment.fileName === fileName
    && (!baseSource || segment.baseSource === baseSource)
  ));
}

function forgetMusicTopperSegment(topperSegment) {
  musicTopperSegments = musicTopperSegments.filter((segment) => segment !== topperSegment);
}

function scheduleMusicBoundaryCheck() {
  clearTimeout(musicScheduleTimer);

  const context = getSceneAudioContext();

  if (!context || !currentMusicSegment) {
    return;
  }

  const delaySeconds = Math.max(
    0,
    currentMusicSegment.endTime - context.currentTime - MUSIC_SCHEDULE_LOOKAHEAD_SECONDS,
  );

  musicScheduleTimer = setTimeout(scheduleNextMusicSegment, delaySeconds * 1000);
}

function scheduleNextMusicSegment() {
  const context = getSceneAudioContext();

  if (!context || context.state !== 'running' || !currentMusicSegment) {
    syncMusicTrack();
    return;
  }

  const nextSegment = queuedMusicSegment;
  queuedMusicSegment = null;

  let nextTrack = nextSegment?.trackId
    ?? queuedMusicTrack
    ?? currentMusicSegment.returnTrackId
    ?? desiredMusicTrack;
  const returnTrackId = nextSegment?.returnTrackId ?? null;
  queuedMusicTrack = null;

  if (!nextTrack) {
    return;
  }

  if (!sceneAudioBuffers.has(MUSIC_TRACKS[nextTrack])) {
    if (nextSegment) {
      queuedMusicSegment = nextSegment;
    } else {
      queuedMusicTrack = nextTrack;
    }

    nextTrack = currentMusicSegment.trackId;
  }

  startMusicSegment(nextTrack, currentMusicSegment.endTime, returnTrackId);
}

function startHtmlMusicTrack(trackId, returnTrackId) {
  const fileName = MUSIC_TRACKS[trackId];

  if (!fileName) {
    return;
  }

  htmlMusicAudio = getSceneAudio(fileName);
  htmlMusicTrack = trackId;
  htmlMusicAudio.loop = false;
  htmlMusicAudio.muted = false;
  htmlMusicAudio.volume = 1;
  htmlMusicAudio.currentTime = 0;
  htmlMusicAudio.onended = () => {
    const nextTrack = returnTrackId ?? queuedMusicTrack ?? desiredMusicTrack;
    queuedMusicTrack = null;

    if (nextTrack) {
      startHtmlMusicTrack(nextTrack, null);
    }
  };
  htmlMusicAudio.play().catch((error) => {
    console.warn(`Could not play music track: ${fileName}`, error);
  });
}

function playSceneAudio(fileName, audioKey) {
  const context = getSceneAudioContext();

  if (!context) {
    playSceneHtmlAudio(fileName);
    return;
  }

  const buffer = sceneAudioBuffers.get(fileName);

  if (buffer) {
    playSceneAudioBuffer(buffer, audioKey);
    return;
  }

  loadSceneAudioBuffer(fileName).then((loadedBuffer) => {
    if (loadedBuffer) {
      playSceneAudioBuffer(loadedBuffer, audioKey);
      return;
    }

    if (audioKey === lastStageAudioKey) {
      playSceneHtmlAudio(fileName);
    }
  });
}

function playSceneHtmlAudio(fileName) {
  const audio = getSceneAudio(fileName);
  audio.muted = false;
  audio.volume = 1;
  audio.currentTime = 0;
  audio.play().catch((error) => {
    console.warn(`Could not play scene audio: ${fileName}`, error);
  });
}

function getAudioFiles() {
  return [
    ...new Set([
      ...Object.values(SCENE_AUDIO),
      STARBURST_WIPE_AUDIO,
      LOSE_JINGLE_AUDIO,
      WIN_SOUND_AUDIO,
      ...Object.values(MUSIC_TRACKS),
      ...Object.values(MUSIC_TOPPERS),
    ]),
  ];
}

function getSceneAudioContext() {
  if (sceneAudioContext) {
    return sceneAudioContext;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  sceneAudioContext = new AudioContextClass();
  return sceneAudioContext;
}

function getExistingSceneAudioContext() {
  return sceneAudioContext;
}

function loadSceneAudioBuffer(fileName) {
  if (sceneAudioBuffers.has(fileName) || sceneAudioLoadPromises.has(fileName)) {
    return sceneAudioLoadPromises.get(fileName) ?? Promise.resolve(sceneAudioBuffers.get(fileName));
  }

  const context = getSceneAudioContext();

  if (!context) {
    return Promise.resolve(null);
  }

  const promise = fetch(`./assets/audio/${fileName}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.arrayBuffer();
    })
    .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
    .then((buffer) => {
      sceneAudioBuffers.set(fileName, buffer);
      return buffer;
    })
    .catch((error) => {
      console.warn(`Could not load WebAudio scene audio: ${fileName}`, error);
      return null;
    });

  sceneAudioLoadPromises.set(fileName, promise);
  return promise;
}

function playSceneAudioBuffer(buffer, audioKey) {
  const context = getSceneAudioContext();

  if (!context || audioKey !== lastStageAudioKey) {
    return;
  }

  if (context.state !== 'running') {
    context.resume()
      .then(() => {
        if (audioKey === lastStageAudioKey && context.state === 'running') {
          startSceneAudioBuffer(context, buffer);
        }
      })
      .catch((error) => {
        console.warn('Could not resume scene audio context', error);
      });
    return;
  }

  startSceneAudioBuffer(context, buffer);
}

function startSceneAudioBuffer(context, buffer) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
}

function getSceneAudio(fileName) {
  if (sceneAudio.has(fileName)) {
    return sceneAudio.get(fileName);
  }

  const audio = new Audio(`./assets/audio/${fileName}`);
  audio.preload = 'auto';
  sceneAudio.set(fileName, audio);
  return audio;
}
