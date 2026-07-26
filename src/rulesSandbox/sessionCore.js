export const PLAYERS = Object.freeze(['p1', 'p2']);

export function otherPlayer(playerId) {
  return playerId === 'p1' ? 'p2' : 'p1';
}

export function createPhasedSession(definition, options = {}) {
  const random = options.random ?? Math.random;
  let state = definition.createState({ ...options, random });

  function getLegalActions(playerId) {
    if (state.status === 'complete' || !state.activePlayers.includes(playerId)) return [];
    return definition.getLegalActions(state, playerId).map((action) => (
      typeof action === 'string' ? { id: action, label: title(action) } : action
    ));
  }

  function submit(command) {
    if (!command || !PLAYERS.includes(command.playerId) || typeof command.actionId !== 'string') {
      throw new Error('Command requires playerId and actionId');
    }
    if (state.status === 'complete') throw new Error('Session is complete');
    if (!state.activePlayers.includes(command.playerId)) throw new Error(`${command.playerId} is not active`);
    const legal = getLegalActions(command.playerId);
    const action = legal.find(({ id }) => id === command.actionId);
    if (!action) throw new Error(`Illegal action: ${command.actionId}`);
    if (action.amount) {
      const amount = Number(command.amount);
      if (!Number.isInteger(amount) || amount < action.amount.min || amount > action.amount.max) {
        throw new Error(`Amount must be an integer from ${action.amount.min} to ${action.amount.max}`);
      }
    }
    state = definition.reduce(state, { ...command, amount: Number(command.amount) || 0 }, { random });
    return getState();
  }

  function getState() {
    const legalActions = Object.fromEntries(PLAYERS.map((playerId) => [playerId, getLegalActions(playerId)]));
    return clone({
      ...state,
      legalActions,
      presentation: definition.present(state),
    });
  }

  return Object.freeze({
    id: definition.id,
    submit,
    getState,
    getView(playerId = null) {
      const view = getState();
      if (playerId && PLAYERS.includes(playerId)) {
        for (const pendingPlayer of Object.keys(view.pending ?? {})) {
          if (pendingPlayer !== playerId) view.pending[pendingPlayer] = 'concealed';
        }
        if (view.locked) {
          for (const lockedPlayer of PLAYERS) {
            if (lockedPlayer !== playerId && view.status !== 'complete') view.locked[lockedPlayer] = 'concealed';
          }
        }
      } else if (view.presentation.concealed) {
        view.pending = Object.fromEntries(Object.keys(view.pending ?? {}).map((key) => [key, 'concealed']));
      }
      return view;
    },
    reset() {
      state = definition.createState({ ...options, random });
      return getState();
    },
  });
}

export function simultaneousReducer({
  state,
  command,
  resolve,
  nextPhase = state.phase,
  prompt = state.prompt,
}) {
  const pending = { ...state.pending, [command.playerId]: command.actionId };
  if (!pending.p1 || !pending.p2) {
    return {
      ...state,
      pending,
      activePlayers: PLAYERS.filter((playerId) => !pending[playerId]),
      prompt: pending.p1 || pending.p2 ? 'Choice locked. Pass to the other player.' : prompt,
    };
  }
  return resolve({ ...state, pending: {} }, pending, nextPhase);
}

export function appendEvent(state, text) {
  return [...state.events, { index: state.events.length + 1, text }];
}

export function rpsWinner(p1, p2, cycle = { rock: 'scissors', scissors: 'paper', paper: 'rock' }) {
  if (p1 === p2) return null;
  return cycle[p1] === p2 ? 'p1' : 'p2';
}

export function basePresentation(state, scene, details = []) {
  return {
    prompt: state.prompt,
    scene,
    details,
    concealed: Object.keys(state.pending ?? {}).length > 0,
  };
}

export function title(value) {
  return String(value)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
