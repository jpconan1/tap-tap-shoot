import { mountSpriteRenderers } from '../renderer.js';
import { createRulesSandboxSession, RULES_SANDBOX_VARIANTS } from './variants.js';

export function mountRulesSandbox(app, options = {}) {
  let session = null;
  let selectedVariantId = null;

  function renderPicker() {
    session = null;
    selectedVariantId = null;
    app.innerHTML = renderRulesSandboxPicker();
    mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
    bind();
  }

  function renderSession() {
    const state = session.getState();
    const activePlayer = state.activePlayers[0] ?? null;
    const actions = activePlayer ? state.legalActions[activePlayer] : [];
    app.innerHTML = renderRulesSandboxState(state);
    mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
    bind();
  }

  function bind() {
    app.querySelectorAll('[data-sandbox-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.sandboxAction;
        if (action === 'picker') return renderPicker();
        if (action === 'restart') {
          session.reset();
          return renderSession();
        }
        if (action === 'pick-variant') {
          selectedVariantId = button.dataset.value;
          session = createRulesSandboxSession(selectedVariantId, options);
          return renderSession();
        }
        if (action === 'submit') {
          const state = session.getState();
          const playerId = state.activePlayers[0];
          const amountInput = button.closest('.rules-sandbox-placeholder')?.querySelector('input');
          try {
            session.submit({
              playerId,
              actionId: button.dataset.value,
              amount: amountInput?.value,
            });
            renderSession();
          } catch (error) {
            button.closest('.rules-sandbox-placeholder')?.classList.add('has-error');
            button.setAttribute('aria-description', error.message);
          }
        }
      });
    });
  }

  renderPicker();
  return Object.freeze({
    getSession: () => session,
    getSelectedVariantId: () => selectedVariantId,
  });
}

export function renderRulesSandboxPicker() {
  return `
    <section class="rules-sandbox rules-sandbox-picker">
      <header><p>RULES SANDBOX</p><h1>Pick prototype</h1></header>
      <div class="rules-sandbox-variant-grid">
        ${RULES_SANDBOX_VARIANTS.map((variant, index) => placeholderButton({
          action: 'pick-variant', value: variant.id, label: variant.name, index,
        })).join('')}
      </div>
    </section>
  `;
}

export function renderRulesSandboxState(state) {
  const activePlayer = state.activePlayers[0] ?? null;
  const actions = activePlayer ? state.legalActions[activePlayer] : [];
  return `
    <section class="rules-sandbox">
      <header class="rules-sandbox-header">
        <button type="button" data-sandbox-action="picker">← Variants</button>
        <div><p>RULES SANDBOX</p><h1>${escapeHtml(state.variantName)}</h1></div>
        <button type="button" data-sandbox-action="restart">Restart</button>
      </header>
      <main class="rules-sandbox-board">
        <section class="rules-sandbox-scene" data-layout-key="scene">
          <p class="rules-sandbox-phase">${escapeHtml(state.phase)}</p>
          <h2>${escapeHtml(state.presentation.scene)}</h2>
          <p>${escapeHtml(state.presentation.prompt)}</p>
          ${state.presentation.concealed ? '<strong>Choice concealed. Pass device.</strong>' : ''}
        </section>
        <section class="rules-sandbox-state" aria-label="Current state">
          ${state.presentation.details.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
        </section>
        <section class="rules-sandbox-controls">
          <h2>${activePlayer ? `${activePlayer.toUpperCase()} choose` : state.prompt}</h2>
          <div class="rules-sandbox-actions">
            ${actions.map((action, index) => placeholderButton({
              action: 'submit', value: action.id, label: action.label, index, amount: action.amount,
            })).join('')}
          </div>
        </section>
        <aside class="rules-sandbox-log">
          <h2>Events</h2>
          <ol>${[...state.events].reverse().map((event) => `<li>${escapeHtml(event.text)}</li>`).join('')}</ol>
        </aside>
      </main>
    </section>
  `;
}

function placeholderButton({ action, value, label, index, amount = null }) {
  const doodle = `button_bg_generic${(index % 3) + 1}`;
  return `
    <div class="rules-sandbox-placeholder">
      ${amount ? `<input type="number" min="${amount.min}" max="${amount.max}" value="${amount.min}" aria-label="${escapeHtml(label)} amount">` : ''}
      <button type="button" data-sandbox-action="${action}" data-value="${escapeHtml(value)}" aria-label="${escapeHtml(label)}">
        <canvas class="sprite-canvas" data-doodle="${doodle}" data-frame-width="256" data-frame-height="128" width="256" height="128" aria-hidden="true"></canvas>
        <span>${escapeHtml(label)}</span>
      </button>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
