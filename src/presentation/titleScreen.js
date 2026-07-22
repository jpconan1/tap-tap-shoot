import { DOODLE_FRAME_COUNT, DOODLE_FRAME_RATE } from '../renderer.js';

const TITLE_LOGO_FRAME_WIDTH = 512;
const TITLE_LOGO_FRAME_HEIGHT = 368;
const TITLE_BUTTON_FRAME_WIDTH = 256;
const TITLE_BUTTON_FRAME_HEIGHT = 128;
const TITLE_AUDIO_BUTTON_FRAME_WIDTH = 384;
const TITLE_AUDIO_BUTTON_FRAME_HEIGHT = 192;
const TITLE_BOIL_TOGGLE_FRAME_WIDTH = 320;
const TITLE_BOIL_TOGGLE_FRAME_HEIGHT = 160;
const TITLE_VOLUME_SLIDER_FRAME_WIDTH = 320;
const TITLE_VOLUME_SLIDER_FRAME_HEIGHT = 160;
const TITLE_MUSIC_SLIDER_URL = './assets/title/Music_slider_sheet.webp';
const TITLE_SFX_SLIDER_URL = './assets/title/sfx_slider_sheet.webp';
const TITLE_GRADIENT_SLIDER_URL = './assets/title/graidant_slider_sheet.webp';

export function createTitleScreen({
  app,
  getState,
  getSharpCanvasContext,
  loadImageAsset,
  mountSpriteRenderers,
  requestMusicTrack,
  renderOnlinePlayerCount,
  startOnlineStatusPolling,
  enterLobby,
  generateName,
  toggleSound,
  toggleBoil,
  enableAudio,
  setVolume,
  escapeHtml,
  maxDisplayNameLength,
  showAlertShowcase = null,
}) {
  let sliderImagesPromise = null;

  function renderAudioButton(kind, isChecked) {
    const doodle = `title/${kind}_button${isChecked ? '_checked' : ''}`;
    const label = `${kind} ${isChecked ? 'on' : 'off'}`;

    return `
      <button class="title-audio-button" data-action="toggle-${kind}" type="button" aria-label="${label}" aria-pressed="${isChecked ? 'true' : 'false'}">
        <canvas class="sprite-canvas title-audio-button-art" data-doodle="${doodle}" data-frame-width="${TITLE_AUDIO_BUTTON_FRAME_WIDTH}" data-frame-height="${TITLE_AUDIO_BUTTON_FRAME_HEIGHT}" width="${TITLE_AUDIO_BUTTON_FRAME_WIDTH}" height="${TITLE_AUDIO_BUTTON_FRAME_HEIGHT}" aria-hidden="true"></canvas>
      </button>
    `;
  }

  function renderVolumeSlider(kind, value, isSoundEnabled) {
    const label = kind === 'music' ? 'music volume' : 'sound effects volume';
    return `
      <canvas class="title-volume-slider ${isSoundEnabled ? '' : 'is-muted'}" data-volume-kind="${kind}" width="${TITLE_VOLUME_SLIDER_FRAME_WIDTH}" height="${TITLE_VOLUME_SLIDER_FRAME_HEIGHT}" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(value * 100)}"></canvas>
    `;
  }

  function renderBoilButton(isBoilEnabled) {
    return `
      <button class="title-audio-button title-boil-button" data-action="toggle-boil" type="button" aria-label="animation ${isBoilEnabled ? 'on' : 'off'}" aria-pressed="${isBoilEnabled ? 'true' : 'false'}">
        <canvas class="sprite-canvas title-audio-button-art" data-doodle="title/boiling_toggle_${isBoilEnabled ? 'on' : 'off'}" data-frame-width="${TITLE_BOIL_TOGGLE_FRAME_WIDTH}" data-frame-height="${TITLE_BOIL_TOGGLE_FRAME_HEIGHT}" width="${TITLE_BOIL_TOGGLE_FRAME_WIDTH}" height="${TITLE_BOIL_TOGGLE_FRAME_HEIGHT}" aria-hidden="true"></canvas>
      </button>
    `;
  }

  function renderSettingsControls() {
    const state = getState();
    return `
      <div class="title-audio-actions settings-controls" aria-label="Settings controls">
        ${renderAudioButton('sound', state.isSoundEnabled)}
        ${renderBoilButton(state.isBoilEnabled)}
        ${renderVolumeSlider('music', state.musicVolume, state.isSoundEnabled)}
        ${renderVolumeSlider('sfx', state.sfxVolume, state.isSoundEnabled)}
      </div>
    `;
  }

  function installSettingsHandlers(root, onChange = null) {
    root.querySelector('[data-action="toggle-sound"]')?.addEventListener('click', () => {
      toggleSound({ rerender: !onChange });
      onChange?.();
    });
    root.querySelector('[data-action="toggle-boil"]')?.addEventListener('click', () => {
      toggleBoil({ rerender: !onChange });
      onChange?.();
    });
    mountVolumeSliders(root.querySelectorAll('.title-volume-slider'));
  }

  function mountVolumeSliders(canvases) {
    const sliders = [...canvases];
    if (!sliders.length) return;

    sliders.forEach((canvas) => {
      const updateFromPointer = (event) => {
        const rect = canvas.getBoundingClientRect();
        enableAudio(canvas.dataset.volumeKind);
        setVolume(canvas.dataset.volumeKind, rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0);
      };

      canvas.addEventListener('pointerdown', (event) => {
        canvas.setPointerCapture(event.pointerId);
        updateFromPointer(event);
      });
      canvas.addEventListener('pointermove', (event) => {
        if (event.buttons) updateFromPointer(event);
      });
      canvas.addEventListener('keydown', (event) => {
        const direction = ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : ['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : 0;
        if (!direction) return;
        event.preventDefault();
        const kind = canvas.dataset.volumeKind;
        enableAudio(kind);
        const state = getState();
        setVolume(kind, state[kind === 'music' ? 'musicVolume' : 'sfxVolume'] + direction * (event.shiftKey ? 0.1 : 0.05));
      });
    });

    loadSliderImages().then((images) => {
      if (!images) return;
      function tick(now) {
        const connectedSliders = sliders.filter((canvas) => canvas.isConnected);
        if (!connectedSliders.length) return;
        drawVolumeSliders(connectedSliders, images, now);
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  function drawVolumeSliders(sliders, images, now) {
    const state = getState();
    const frame = state.isBoilEnabled ? Math.floor((now / 1000) * DOODLE_FRAME_RATE) % DOODLE_FRAME_COUNT : 0;
    const sourceY = frame * TITLE_VOLUME_SLIDER_FRAME_HEIGHT;

    sliders.forEach((canvas) => {
      const kind = canvas.dataset.volumeKind;
      const volume = kind === 'music' ? state.musicVolume : state.sfxVolume;
      const context = getSharpCanvasContext(canvas);
      const baseImage = kind === 'music' ? images.music : images.sfx;
      if (!context || !baseImage || !images.gradient) return;

      const fillWidth = Math.round(TITLE_VOLUME_SLIDER_FRAME_WIDTH * volume);
      canvas.classList.toggle('is-muted', !state.isSoundEnabled);
      canvas.setAttribute('aria-valuenow', String(Math.round(volume * 100)));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(baseImage, 0, sourceY, TITLE_VOLUME_SLIDER_FRAME_WIDTH, TITLE_VOLUME_SLIDER_FRAME_HEIGHT, 0, 0, canvas.width, canvas.height);
      if (fillWidth > 0) context.drawImage(images.gradient, 0, sourceY, fillWidth, TITLE_VOLUME_SLIDER_FRAME_HEIGHT, 0, 0, fillWidth, canvas.height);
    });
  }

  function loadSliderImages() {
    if (!sliderImagesPromise) {
      sliderImagesPromise = Promise.all([
        loadImageAsset(TITLE_MUSIC_SLIDER_URL, { decode: false }),
        loadImageAsset(TITLE_SFX_SLIDER_URL, { decode: false }),
        loadImageAsset(TITLE_GRADIENT_SLIDER_URL, { decode: false }),
      ]).then(([music, sfx, gradient]) => music && sfx && gradient ? { music, sfx, gradient } : null);
    }
    return sliderImagesPromise;
  }

  function updateSoundButton() {
    const state = getState();
    const button = app.querySelector('[data-action="toggle-sound"]');
    const canvas = button?.querySelector('.sprite-canvas');
    if (!button || !canvas) return;
    button.setAttribute('aria-label', `sound ${state.isSoundEnabled ? 'on' : 'off'}`);
    button.setAttribute('aria-pressed', state.isSoundEnabled ? 'true' : 'false');
    canvas.dataset.doodle = `title/sound_button${state.isSoundEnabled ? '_checked' : ''}`;
    mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
  }

  function render() {
    const state = getState();
    requestMusicTrack('title');
    app.innerHTML = `
      <section class="title-screen title-menu-screen" aria-label="Title screen">
        <canvas class="sprite-canvas title-logo title-menu-logo" data-doodle="new-logo-rev-2-alpha" data-frame-width="${TITLE_LOGO_FRAME_WIDTH}" data-frame-height="${TITLE_LOGO_FRAME_HEIGHT}" width="${TITLE_LOGO_FRAME_WIDTH}" height="${TITLE_LOGO_FRAME_HEIGHT}" aria-label="Super Rock Paper Scissors Online"></canvas>
        <form class="title-menu-form">
          <div class="title-menu-actions">
            <button class="play-button title-menu-random" data-action="random-name" type="button" aria-label="Random name"><canvas class="sprite-canvas play-button-art" data-doodle="name_button" data-frame-width="${TITLE_BUTTON_FRAME_WIDTH}" data-frame-height="${TITLE_BUTTON_FRAME_HEIGHT}" width="${TITLE_BUTTON_FRAME_WIDTH}" height="${TITLE_BUTTON_FRAME_HEIGHT}" aria-hidden="true"></canvas></button>
            <button class="play-button title-menu-submit" type="submit" aria-label="Enter lobby"><canvas class="sprite-canvas play-button-art" data-doodle="lobby_button" data-frame-width="${TITLE_BUTTON_FRAME_WIDTH}" data-frame-height="${TITLE_BUTTON_FRAME_HEIGHT}" width="${TITLE_BUTTON_FRAME_WIDTH}" height="${TITLE_BUTTON_FRAME_HEIGHT}" aria-hidden="true"></canvas></button>
          </div>
          <label class="sprite-input-frame title-name-input-frame">
            <canvas class="sprite-canvas sprite-input-frame-art" data-doodle="text_frame" data-frame-width="768" data-frame-height="64" width="768" height="64" aria-hidden="true"></canvas>
            <input id="title-name-input" class="title-name-input" name="displayName" maxlength="${maxDisplayNameLength}" autocomplete="nickname" spellcheck="false" aria-label="Display name" value="${escapeHtml(state.rankedDisplayName)}" />
          </label>
          <p class="online-player-count" aria-live="polite">${renderOnlinePlayerCount()}</p>
        </form>
        <div class="title-audio-actions title-menu-audio-actions" aria-label="Settings">
          ${renderAudioButton('sound', state.isSoundEnabled)}
          ${renderVolumeSlider('music', state.musicVolume, state.isSoundEnabled)}
          ${renderVolumeSlider('sfx', state.sfxVolume, state.isSoundEnabled)}
          ${renderBoilButton(state.isBoilEnabled)}
        </div>
      </section>
    `;

    app.querySelector('.title-menu-form').addEventListener('submit', enterLobby);
    app.querySelector('[data-action="random-name"]').addEventListener('click', generateName);
    installSettingsHandlers(app);
    startOnlineStatusPolling();
    mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
    app.querySelector('.title-name-input')?.focus();
    showAlertShowcase?.();
  }

  return { installSettingsHandlers, render, renderSettingsControls, updateSoundButton };
}
