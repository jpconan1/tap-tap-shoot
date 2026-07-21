const ALERT_FRAME_WIDTH = 512;
const ALERT_FRAME_HEIGHT = 256;
const ALERT_SLICE_INSET = 48;
const CONTINUE_FRAME_WIDTH = 256;
const CONTINUE_FRAME_HEIGHT = 128;

export function createAlertSystem({ root, mountSprites, mountNineSlices }) {
  let queue = [];
  let resolveSequence = null;

  function show(alerts) {
    if (!Array.isArray(alerts) || alerts.length === 0) {
      return Promise.resolve();
    }

    queue = [...alerts];
    return new Promise((resolve) => {
      resolveSequence = resolve;
      renderNext();
    });
  }

  function renderNext() {
    root.querySelector('.generic-alert-overlay')?.remove();
    const alert = queue.shift();

    if (!alert) {
      resolveSequence?.();
      resolveSequence = null;
      return;
    }

    const width = Math.max(ALERT_SLICE_INSET * 2, Math.round(alert.width));
    const height = Math.max(ALERT_SLICE_INSET * 2, Math.round(alert.height));
    const overlay = document.createElement('div');
    overlay.className = 'generic-alert-overlay';
    overlay.innerHTML = `
      <section class="generic-alert" role="alertdialog" aria-modal="true">
        <canvas
          class="nine-slice-canvas generic-alert-box"
          data-doodle="alert"
          data-frame-width="${ALERT_FRAME_WIDTH}"
          data-frame-height="${ALERT_FRAME_HEIGHT}"
          data-slice-inset="${ALERT_SLICE_INSET}"
          width="${width}"
          height="${height}"
          aria-hidden="true"
        ></canvas>
        <p class="generic-alert-message"></p>
        <button class="generic-alert-continue" type="button" aria-label="Continue">
          <canvas
            class="sprite-canvas"
            data-doodle="continue_button"
            data-frame-width="${CONTINUE_FRAME_WIDTH}"
            data-frame-height="${CONTINUE_FRAME_HEIGHT}"
            width="${CONTINUE_FRAME_WIDTH}"
            height="${CONTINUE_FRAME_HEIGHT}"
            aria-hidden="true"
          ></canvas>
        </button>
      </section>
    `;
    overlay.querySelector('.generic-alert').setAttribute('aria-label', alert.label);
    overlay.querySelector('.generic-alert-message').textContent = alert.message;
    root.append(overlay);
    mountNineSlices(overlay.querySelectorAll('.nine-slice-canvas'));
    mountSprites(root.querySelectorAll('.sprite-canvas'));
    const button = overlay.querySelector('.generic-alert-continue');
    button.addEventListener('click', renderNext, { once: true });
    button.focus();
  }

  return Object.freeze({ show });
}
