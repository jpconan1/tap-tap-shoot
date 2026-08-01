const PLAYER_KEYS = Object.freeze(['p1', 'p2']);

export function isCompleteOnlinePokerState(state) {
  if (!state || typeof state !== 'object') return false;
  if (!['lock', 'betting', 'anteLoss'].includes(state.phase)) return false;
  if (!isPlayerNumberMap(state.stacks) || !isPlayerNumberMap(state.committed)) return false;
  if (!Number.isFinite(state.pot) || !Number.isFinite(state.ante) || !Number.isFinite(state.hand)) return false;
  if (state.phase === 'betting' && !PLAYER_KEYS.includes(state.actor)) return false;
  return state.locked !== null && typeof state.locked === 'object';
}

export function localizeOnlinePokerTransition(transition, playerKey) {
  if (!transition || typeof transition !== 'object') return null;
  const localized = localizeValue(transition, playerKey);
  return {
    ...localized,
    previous: isPokerTransitionState(localized.previous) ? localized.previous : null,
    next: isPokerTransitionState(localized.next) ? localized.next : null,
  };
}

export function localizeOnlinePokerEvents(events, playerKey) {
  if (!Array.isArray(events)) return [];
  return localizeValue(events, playerKey);
}

export function getOnlinePokerAnimationKind(events, fallbackKind = null) {
  const types = new Set((events ?? []).map((event) => event?.type));
  if (types.has('COMMUNITY_REVEALED')) return 'lock-complete';
  if (types.has('PLAYER_FOLDED')) return 'fold';
  if (types.has('CARDS_REVEALED')) return 'showdown';
  if (types.has('BET_RAISED')) return 'raise';
  if (types.has('BET_PLACED')) return 'bet';
  if (types.has('PLAYER_CHECKED')) return 'check';
  return fallbackKind;
}

export function getOnlinePokerPlayerId(playerKey, perspectiveKey) {
  if (!PLAYER_KEYS.includes(playerKey)) return null;
  return perspectiveKey === 'p2'
    ? playerKey === 'p1' ? 'p2' : 'p1'
    : playerKey;
}

function isPlayerNumberMap(value) {
  return value
    && typeof value === 'object'
    && PLAYER_KEYS.every((key) => Number.isFinite(value[key]));
}

function isPokerTransitionState(value) {
  return value
    && typeof value === 'object'
    && isPlayerNumberMap(value.stacks)
    && isPlayerNumberMap(value.committed)
    && typeof value.phase === 'string';
}

function localizeValue(value, playerKey) {
  if (Array.isArray(value)) return value.map((item) => localizeValue(item, playerKey));
  if (!value || typeof value !== 'object') {
    if (playerKey !== 'p2') return value;
    if (value === 'p1') return 'p2';
    if (value === 'p2') return 'p1';
    return value;
  }
  const localized = {};
  for (const [key, item] of Object.entries(value)) {
    const localKey = playerKey === 'p2'
      ? key === 'p1' ? 'p2' : key === 'p2' ? 'p1' : key
      : key;
    localized[localKey] = localizeValue(item, playerKey);
  }
  return localized;
}
