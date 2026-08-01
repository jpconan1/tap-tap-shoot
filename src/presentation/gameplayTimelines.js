import { getPostTurnAction } from '../engine/matchEngine.js';
import { getGameFlowPolicy } from './gameFlowPolicies.js';

export function buildGameplayTimeline(transition) {
  if (transition.variantId === 'rpsPoker') return buildPokerTimeline(transition);
  return buildRevealTimeline(transition);
}

export function buildRevealTimeline({ variantId, events = [], after = {} }) {
  const beats = [];
  const superEvent = events.find((event) => event.type === 'super.played');
  if (superEvent) beats.push({ type: 'playSuper', animation: superEvent.animation });

  const policy = getGameFlowPolicy(variantId);
  const action = getPostTurnAction({
    roundFinished: after.roundFinished === true,
    gameFinished: after.resultLevel && after.resultLevel !== 'round',
    autoAdvanceRound: policy.autoAdvanceRound,
  });
  if (action === 'advance-round') beats.push({ type: 'advanceRound', preserveReveal: true });
  if (action === 'finish-game') {
    if (!superEvent) beats.push({ type: 'wait', beats: 2 });
    beats.push({ type: 'showResult', level: after.resultLevel ?? 'round' });
  }
  return beats;
}

export function buildPokerTimeline({ events = [] }) {
  const beats = [];
  for (const event of events) {
    if (event.type === 'turn.locked') beats.push({ type: 'pokerLocked', event });
    else if (event.type === 'poker.community-revealed') beats.push({ type: 'pokerCommunity', event });
    else if (event.type === 'poker.bet') beats.push({ type: 'pokerBet', event });
    else if (event.type === 'poker.fold') beats.push({ type: 'pokerFold', event });
    else if (event.type === 'poker.showdown') beats.push({ type: 'pokerShowdown', event });
    else if (event.type === 'poker.payout') beats.push({ type: 'pokerPayout', event });
    else if (event.type === 'hand.started') beats.push({ type: 'pokerDeal', event });
    else if (event.type === 'round.finished') beats.push({ type: 'showResult', level: event.level ?? 'round' });
  }
  return beats;
}

export function normalizeOnlinePokerAnimation({ id, revision, transition, events, before, after, perspective }) {
  const type = eventTypeFromPokerTransition(transition?.kind);
  return {
    id,
    revision,
    variantId: 'rpsPoker',
    before,
    after,
    perspective,
    events: type ? [{ type, transition, domainEvents: events }] : [],
  };
}

function eventTypeFromPokerTransition(kind) {
  if (kind === 'lock-complete') return 'poker.community-revealed';
  if (['bet', 'raise', 'check'].includes(kind)) return 'poker.bet';
  if (kind === 'fold') return 'poker.fold';
  if (kind === 'showdown') return 'poker.showdown';
  return null;
}
