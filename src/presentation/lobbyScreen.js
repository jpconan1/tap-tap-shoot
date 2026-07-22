function renderSheetAction(action, doodle, label, pressed = false, disabled = false) {
  return `<button class="lobby-sheet-action ${pressed ? 'is-active' : ''}" data-action="${action}" type="button" aria-label="${label}"${action === 'toggle-ready' ? ` aria-pressed="${pressed}"` : ''}${disabled ? ' disabled' : ''}><canvas class="sprite-canvas lobby-sheet-action-art" data-doodle="${doodle}" data-frame-width="256" data-frame-height="128" width="256" height="128" aria-hidden="true"></canvas></button>`;
}

export function orderLobbyPlayers(players, selfId) {
  const weights = { ready: 1, idle: 2, in_ranked_match: 3, playing_computer: 3 };
  return [...players].sort((a, b) => (
    a.playerId === selfId ? -1
      : b.playerId === selfId ? 1
        : (weights[a.presence] ?? 2) - (weights[b.presence] ?? 2)
          || a.displayName.localeCompare(b.displayName)
  ));
}

export function createLobbyScreen({
  app,
  boardColors,
  whiteboard,
  getState,
  setRosterOpen,
  escapeHtml,
  renderSettingsControls,
  installSettingsHandlers,
  renderOpenCurtainBorder,
  mountSpriteRenderers,
  stopOnlineStatusPolling,
  requestMusicTrack,
  onOpenPlayer,
  onToggleMatchmaking,
  onOpenPractice,
  onOpenSettings,
  onBack,
  onCloseOverlay,
  onChallengePlayer,
  onSendChat,
  onRespondChallenge,
  onCancelChallenge,
  onCloseChallenge,
}) {
  function renderPlayerRow(player, selfId) {
    const isSelf = player.playerId === selfId;
    const busy = ['in_ranked_match', 'playing_computer'].includes(player.presence) || player.challengePending;
    const status = player.challengePending ? 'Challenge pending'
      : player.presence === 'ready' ? 'Ready'
        : player.presence === 'in_ranked_match' ? 'In ranked match'
          : player.presence === 'playing_computer' ? 'Playing computer' : 'Idle';
    return `<button class="lobby-player-row ${isSelf ? 'self' : ''} ${player.presence === 'ready' ? 'ready' : ''} ${busy ? 'busy' : ''}" data-player-id="${escapeHtml(player.playerId)}" type="button"><span>${escapeHtml(player.displayName)}${isSelf ? ' (you)' : ''}</span><small>${player.rating} · ${status}</small></button>`;
  }

  function renderChallengeOverlay(state) {
    const incoming = state.challenge.challengedId === state.self?.playerId;
    const name = incoming ? state.challenge.challengerName : state.challenge.challengedName;
    const heading = state.challengeStatus === 'pending'
      ? (incoming ? 'Ranked challenge' : 'Challenge sent')
      : escapeHtml(state.challengeStatus ?? '');
    const actions = state.challengeStatus === 'pending'
      ? (incoming
        ? '<button data-action="accept-challenge">Accept</button><button data-action="decline-challenge">Decline</button>'
        : '<button data-action="cancel-challenge">Cancel</button>')
      : '<button data-action="close-challenge">Close</button>';
    return `<div class="lobby-overlay"><div class="lobby-dialog"><h2>${heading}</h2><p>${escapeHtml(name)}</p>${actions}</div></div>`;
  }

  function renderOverlay(state) {
    if (state.challenge) return renderChallengeOverlay(state);
    if (!state.selectedPlayerId) return '';
    const player = state.players.find((entry) => entry.playerId === state.selectedPlayerId);
    if (!player) return '';
    if (player.playerId === state.self?.playerId) {
      return `<div class="lobby-overlay"><div class="lobby-dialog" role="dialog" aria-modal="true" aria-label="Settings"><h2>Settings</h2>${renderSettingsControls()}<button data-action="close-overlay" type="button">Close</button></div></div>`;
    }
    const canChallenge = player.presence === 'idle' && !player.challengePending;
    return `<div class="lobby-overlay"><div class="lobby-dialog"><h2>${escapeHtml(player.displayName)}</h2><p>Rating ${player.rating}</p><p>${escapeHtml(player.presence.replaceAll('_', ' '))}</p>${canChallenge ? '<button data-action="challenge-player" type="button">Ranked challenge</button>' : ''}<button data-action="close-overlay" type="button">Close</button></div></div>`;
  }

  function installHandlers() {
    const state = getState();
    app.querySelectorAll('[data-player-id]').forEach((button) => button.addEventListener('click', () => onOpenPlayer(button.dataset.playerId)));
    app.querySelector('[data-action="toggle-ready"]')?.addEventListener('click', onToggleMatchmaking);
    app.querySelector('[data-action="play-computer"]')?.addEventListener('click', onOpenPractice);
    app.querySelector('[data-action="settings"]')?.addEventListener('click', onOpenSettings);
    app.querySelector('[data-action="back-to-title"]')?.addEventListener('click', onBack);
    app.querySelector('[data-action="toggle-roster"]')?.addEventListener('click', () => {
      const open = !getState().rosterOpen;
      setRosterOpen(open);
      app.querySelector('.lobby-roster-panel')?.classList.toggle('is-open', open);
    });
    app.querySelector('[data-action="close-overlay"]')?.addEventListener('click', onCloseOverlay);
    app.querySelector('[data-action="challenge-player"]')?.addEventListener('click', () => onChallengePlayer(state.selectedPlayerId));
    app.querySelector('.lobby-chat-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = event.currentTarget.elements.message;
      onSendChat(input.value, whiteboard.getMarkerColor());
      input.value = '';
      input.focus();
    });
    app.querySelectorAll('[data-board-tool]').forEach((button) => button.addEventListener('click', (event) => whiteboard.selectTool(button.dataset.boardTool, event)));
    app.querySelector('[data-action="accept-challenge"]')?.addEventListener('click', () => onRespondChallenge(state.challenge?.id, true));
    app.querySelector('[data-action="decline-challenge"]')?.addEventListener('click', () => onRespondChallenge(state.challenge?.id, false));
    app.querySelector('[data-action="cancel-challenge"]')?.addEventListener('click', () => onCancelChallenge(state.challenge?.id));
    app.querySelector('[data-action="close-challenge"]')?.addEventListener('click', onCloseChallenge);
    installSettingsHandlers(app);
  }

  function render() {
    stopOnlineStatusPolling();
    requestMusicTrack('title');
    const state = getState();
    const roster = orderLobbyPlayers(state.players, state.self?.playerId);
    app.innerHTML = `
      <section class="title-screen lobby-screen ${state.connected ? '' : 'is-disconnected'}" aria-label="Online lobby">
        <canvas class="sprite-canvas lobby-header-art" data-doodle="lobby-header" data-frame-width="465" data-frame-height="174" width="465" height="174" aria-label="Lobby"></canvas>
        <div class="lobby-workspace">
          <div class="whiteboard-frame">
            <div class="whiteboard-paper" aria-hidden="true"></div><img class="whiteboard-art" src="./assets/whiteboard.webp" width="840" height="622" alt="">
            <div class="whiteboard-scroll" tabindex="0" aria-label="Shared lobby whiteboard"><canvas class="whiteboard-text-canvas" aria-hidden="true"></canvas><canvas class="whiteboard-canvas"></canvas></div>
            <button class="whiteboard-tray-return-zone ${whiteboard.isToolHeld() ? 'is-active' : ''}" data-action="return-board-tool" type="button" aria-label="Return whiteboard tool"></button>
            <div class="whiteboard-tool-tray" role="group" aria-label="Whiteboard tools">${boardColors.map(whiteboard.renderTool).join('')}${whiteboard.renderTool('erase')}</div>
            ${whiteboard.renderHeldTool()}<button class="whiteboard-new-marks" data-action="board-bottom" type="button" hidden>new marks ↓</button>
          </div>
          <aside class="lobby-roster-panel ${state.rosterOpen ? 'is-open' : ''}">
            <header class="lobby-heading"><strong>ONLINE</strong><span>${state.connected ? state.players.length : '…'}</span></header>
            <div class="lobby-roster" role="list">${roster.map((player) => renderPlayerRow(player, state.self?.playerId)).join('')}</div>
          </aside>
        </div>
        <div class="lobby-bottom-rail">
          <form class="lobby-chat-form"><label class="sprite-input-frame lobby-chat-input-frame"><canvas class="sprite-canvas sprite-input-frame-art" data-doodle="text_frame" data-frame-width="768" data-frame-height="64" width="768" height="64" aria-hidden="true"></canvas><input name="message" maxlength="200" autocomplete="off" aria-label="Chat message"></label><button class="lobby-chat-submit" type="submit" aria-label="Send chat message"><canvas class="sprite-canvas lobby-chat-submit-art" data-doodle="chat_button" data-frame-width="128" data-frame-height="64" width="128" height="64" aria-hidden="true"></canvas></button></form>
          <button class="lobby-roster-toggle" data-action="toggle-roster" type="button" aria-label="Players"><canvas class="sprite-canvas lobby-roster-toggle-art" data-doodle="burger_button" data-frame-width="128" data-frame-height="128" width="128" height="128" aria-hidden="true"></canvas></button>
        </div>
        <div class="lobby-action-row">
          ${renderSheetAction('back-to-title', 'back_button_w', 'Back to title')}
          ${renderSheetAction('play-computer', 'title/playvcom_button', 'Practice versus computer')}
          ${renderSheetAction('toggle-ready', 'match_button', 'Play a match', state.matchmakingStatus === 'searching', !state.connected)}
          ${renderSheetAction('settings', 'settings_button', 'Settings')}
        </div>
        ${renderOverlay(state)}${renderOpenCurtainBorder()}
      </section>
    `;
    installHandlers();
    mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
    whiteboard.mount();
  }

  function syncMatchmakingIndicator() {
    app.querySelector('.matchmaking-indicator')?.remove();
    if (getState().matchmakingStatus !== 'searching') return;
    const indicator = document.createElement('div');
    indicator.className = 'matchmaking-indicator';
    indicator.setAttribute('role', 'status');
    indicator.setAttribute('aria-label', 'Waiting for match...');
    indicator.innerHTML = '<span aria-hidden="true">Waiting for match<span class="matchmaking-dots"></span></span>';
    app.append(indicator);
  }

  return { render, renderOverlay, syncMatchmakingIndicator };
}
