import { MOVE_IDS, normalizeVariantId, VARIANT_IDS } from './engine/moves.js';

const BASIC_SCENES = Object.freeze({
  'reload|reload': 'reloading',
  'reload|shoot': 'shooting',
  'reload|stab': 'counterstab',
  'reload|duck': 'tricky',
  'shoot|shoot': 'collision',
  'shoot|stab': 'shooting',
  'shoot|duck': 'dodge',
  'stab|stab': 'clash',
  'stab|duck': 'stabbing',
  'duck|duck': 'hiding',
});

const CBF_SCENES = Object.freeze({
  'block|block': 'fireball-war/block-draw',
  'charge|block': 'fireball-war/block-charge',
  'block|fireball': 'fireball-war/block-fireball',
  'charge|charge': 'fireball-war/both-charge',
  'charge|fireball': 'fireball-war/charge-fireball',
  'fireball|fireball': 'fireball-war/fireball-draw',
});

export function resolveScene({ variantId = '', p1Move, p2Move, result = {} }) {
  const variant = variantId ? normalizeVariantId(variantId) : '';

  if (variant === VARIANT_IDS.tapTapShootY) return resolveTapTapShootY(result, p1Move, p2Move);
  if (variant === VARIANT_IDS.gunKnifeFist) return resolveGunKnifeFist(result, p1Move, p2Move);
  if (variant === VARIANT_IDS.tapTapShootX) return resolveTapTapShootX(result, p1Move, p2Move);

  const name = variant === VARIANT_IDS.rockPaperScissors
    ? resolveRpsName(p1Move, p2Move)
    : variant === VARIANT_IDS.fireballWar
      ? resolveCbfName(p1Move, p2Move)
      : resolveBasicName(p1Move, p2Move);

  return presentation(name, resolveBasicFlip(name, p1Move, p2Move, variant));
}

export function swapScenePerspective(result = {}) {
  return {
    ...result,
    p1Move: result.p2Move,
    p2Move: result.p1Move,
    p1Hit: result.p2Hit,
    p2Hit: result.p1Hit,
    p1Resource: result.p2Resource,
    p2Resource: result.p1Resource,
    p1ResourceBefore: result.p2ResourceBefore,
    p2ResourceBefore: result.p1ResourceBefore,
    p1ResourceAfter: result.p2ResourceAfter,
    p2ResourceAfter: result.p1ResourceAfter,
    p1BulletsBefore: result.p2BulletsBefore,
    p2BulletsBefore: result.p1BulletsBefore,
    p1BulletsAfter: result.p2BulletsAfter,
    p2BulletsAfter: result.p1BulletsAfter,
    winner: result.winner === 'p1' ? 'p2' : result.winner === 'p2' ? 'p1' : result.winner,
  };
}

export function resolveReadyScene({ sceneName, readyPlayerId, moves }) {
  if (!readyPlayerId || !sceneName || sceneName === 'shooting' || sceneName === 'stabbing') return null;

  const readyMove = moves?.[readyPlayerId];
  const direct = resolveDirectReadyScene(sceneName, readyPlayerId);
  if (direct) return direct;

  const roleScenes = [
    ['fireball-war/block-charge', 'charge', 'charger', 'blocker', moves?.p1 === 'charge'],
    ['fireball-war/block-fireball', 'fireball', 'fireballer', 'blocker', moves?.p1 === 'fireball'],
    ['gun-knife-fist/punch-shoot', 'punch', 'puncher', 'shooter', moves?.p2 === 'punch'],
    ['gun-knife-fist/stab-punch', 'stab', 'stabber', 'puncher', moves?.p2 === 'stab'],
    ['tap-tap-shoot-y/reload-duck', 'reload', 'reloader', 'ducker', moves?.p1 === 'duck'],
    ['tap-tap-shoot-y/shoot-duck', 'shoot', 'shooter', 'ducker', moves?.p2 === 'shoot'],
    ['tap-tap-shoot-y/stab-reload', 'stab', 'stabber', 'reloader', moves?.p2 === 'stab'],
    ['tap-tap-shoot-x/reload-duck', 'reload', 'reloader', 'defender', moves?.p1 === 'duck'],
    ['tap-tap-shoot-x/shoot-duck', 'shoot', 'shooter', 'ducker', moves?.p2 === 'shoot'],
    ['tap-tap-shoot-x/stab-counterstab', 'stab', 'stabber', 'counterstabber', moves?.p2 === 'stab'],
  ];

  const rule = roleScenes.find(([prefix]) => sceneName.startsWith(prefix));
  if (!rule) return null;

  const [prefix, primaryMove, primaryRole, secondaryRole, flip] = rule;
  let assetBase = prefix;
  if (prefix === 'tap-tap-shoot-x/reload-duck') assetBase = 'tap-tap-shoot-x/reload-defense';
  return presentation(`${assetBase.replace(/\/([^/]+)$/, '/split_scenes/$1')}_${readyMove === primaryMove ? primaryRole : secondaryRole}_is_ready`, flip);
}

function resolveDirectReadyScene(sceneName, readyPlayerId) {
  const rules = [
    [/^rock-paper-scissors\/(rps-standoff|rock-draw|paper-draw|scissors-(?:draw|tie))$/, (name) => `rock-paper-scissors/split_scenes/${name === 'scissors-tie' ? 'scissors-draw' : name}_${readyPlayerId}_is_ready`],
    [/^fireball-war\/(cbf-standoff|both-charge|block-draw|fireball-draw)$/, (name) => {
      if (name === 'cbf-standoff') return `fireball-war/split_scenes/cbf_standoff_${readyPlayerId}_is_ready`;
      if (name === 'both-charge') return `fireball-war/split_scenes/charge-${readyPlayerId}_is_ready`;
      return `fireball-war/split_scenes/${name}_${readyPlayerId}_is_ready`;
    }],
    [/^gun-knife-fist\/(pss-standoff|punch-draw|shoot-draw|stab-draw)$/, (name) => `gun-knife-fist/split_scenes/${name}_${readyPlayerId}_is_ready`],
    [/^tap-tap-shoot-y\/(standoff-ssd|reload-draw|shoot-draw|stab-draw|duck-draw)$/, (name) => `tap-tap-shoot-y/split_scenes/${name === 'standoff-ssd' ? 'ssd-standoff' : name === 'reload-draw' ? 'reloading' : name}_${readyPlayerId}_is_ready`],
    [/^tap-tap-shoot-x\/(standoff-tts|reload-draw|shoot-draw|stab-draw|defense-draw)$/, (name) => `tap-tap-shoot-x/split_scenes/${name === 'standoff-tts' ? 'tts-standoff' : name === 'reload-draw' ? 'reloading' : name}_${readyPlayerId}_is_ready`],
  ];

  for (const [pattern, build] of rules) {
    const match = sceneName.match(pattern);
    if (match) return presentation(build(match[1]), false);
  }
  return null;
}

function resolveTapTapShootY(result, p1Move, p2Move) {
  if (p1Move === p2Move) return presentation(`tap-tap-shoot-y/${p1Move === 'reload' ? 'reload' : p1Move}-draw`, false);
  const hitMove = result.p1Hit ? p1Move : result.p2Hit ? p2Move : null;
  if (hitMove === 'shoot') return presentation('tap-tap-shoot-y/shoot-kill', p2Move === 'shoot');
  if (hitMove === 'stab') return presentation('tap-tap-shoot-y/stab-kill', p2Move === 'stab');
  if (hasMoves(p1Move, p2Move, 'reload', 'duck')) return presentation('tap-tap-shoot-y/reload-duck', p1Move === 'duck');
  if (hasMoves(p1Move, p2Move, 'shoot', 'duck')) return presentation('tap-tap-shoot-y/shoot-duck', p2Move === 'shoot');
  if (hasMoves(p1Move, p2Move, 'stab', 'reload')) return presentation('tap-tap-shoot-y/stab-reload', p2Move === 'stab');
  return presentation('tap-tap-shoot-y/duck-draw', p1Move === 'duck');
}

function resolveGunKnifeFist(result, p1Move, p2Move) {
  if (p1Move === p2Move) return presentation(`gun-knife-fist/${p1Move}-draw`, false);
  const hitMove = result.p1Hit ? p1Move : result.p2Hit ? p2Move : null;
  const targetMove = result.p1Hit ? p2Move : result.p2Hit ? p1Move : null;
  const suffix = result.winner !== null ? 'kill' : 'damage';
  if (hitMove === 'punch' && targetMove === 'shoot') return presentation(`gun-knife-fist/punch-shoot-${suffix}`, p2Move === 'punch');
  if (hitMove === 'stab' && targetMove === 'punch') return presentation(`gun-knife-fist/stab-punch-${suffix}`, p2Move === 'stab');
  return presentation('gun-knife-fist/shoot-stab', p2Move === 'shoot');
}

function resolveTapTapShootX(result, p1Move, p2Move) {
  if (p1Move === p2Move) {
    const name = ['duck', 'counterstab'].includes(p1Move) ? 'defense-draw' : `${p1Move === 'reload' ? 'reload' : p1Move}-draw`;
    return presentation(`tap-tap-shoot-x/${name}`, false);
  }
  const hitMove = result.p1Hit ? p1Move : result.p2Hit ? p2Move : null;
  if (hitMove === 'shoot') return presentation('tap-tap-shoot-x/shoot-kill', p2Move === 'shoot');
  if (hitMove === 'stab') return presentation('tap-tap-shoot-x/stab-kill', p2Move === 'stab');
  if (hasMoves(p1Move, p2Move, 'stab', 'counterstab')) return presentation('tap-tap-shoot-x/stab-counterstab', p2Move === 'stab');
  if (hasMoves(p1Move, p2Move, 'stab', 'duck')) return presentation('tap-tap-shoot-x/defense-draw', p1Move === 'duck');
  if (hasMoves(p1Move, p2Move, 'duck', 'counterstab')) return presentation('tap-tap-shoot-x/defense-draw', p1Move === 'duck');
  if (hasMoves(p1Move, p2Move, 'reload', 'duck')) return presentation('tap-tap-shoot-x/reload-duck', p1Move === 'duck');
  if (hasMoves(p1Move, p2Move, 'shoot', 'duck')) return presentation('tap-tap-shoot-x/shoot-duck', p2Move === 'shoot');
  return presentation('tap-tap-shoot-x/defense-draw', p2Move === 'duck' || p2Move === 'counterstab');
}

function resolveRpsName(p1Move, p2Move) {
  if (p1Move === p2Move) return `rock-paper-scissors/${p1Move === 'scissors' ? 'scissors-tie' : `${p1Move}-draw`}`;
  if (hasMoves(p1Move, p2Move, 'rock', 'scissors')) return 'rock-paper-scissors/rock-scissors';
  if (hasMoves(p1Move, p2Move, 'paper', 'rock')) return 'rock-paper-scissors/paper-rock';
  if (hasMoves(p1Move, p2Move, 'scissors', 'paper')) return 'rock-paper-scissors/scissors-paper';
  return 'rock-paper-scissors/rps-standoff';
}

function resolveCbfName(p1Move, p2Move) { return CBF_SCENES[sortedKey(p1Move, p2Move)] ?? 'fireball-war/cbf-standoff'; }
function resolveBasicName(p1Move, p2Move) { return BASIC_SCENES[sortedKey(p1Move, p2Move)] ?? 'hiding'; }

function resolveBasicFlip(name, p1Move, p2Move, variant) {
  if (variant === VARIANT_IDS.rockPaperScissors) return (name.endsWith('rock-scissors') && p2Move === 'rock') || (name.endsWith('paper-rock') && p2Move === 'paper') || (name.endsWith('scissors-paper') && p2Move === 'scissors');
  if (variant === VARIANT_IDS.fireballWar) return (name.endsWith('block-charge') && p1Move === 'charge') || (name.endsWith('block-fireball') && p1Move === 'fireball') || (name.endsWith('charge-fireball') && p1Move === 'fireball');
  if (name === 'shooting') return p2Move === 'shoot';
  if (name === 'stabbing') return p2Move === 'stab';
  if (name === 'dodge') return p1Move === 'duck';
  if (name === 'counterstab') return p2Move === 'stab';
  if (name === 'tricky') return p2Move === 'reload' && p1Move !== 'reload';
  return false;
}

function sortedKey(a, b) { return [a, b].sort((x, y) => MOVE_IDS.indexOf(x) - MOVE_IDS.indexOf(y)).join('|'); }
function hasMoves(a, b, x, y) { return (a === x && b === y) || (a === y && b === x); }
function presentation(name, flip) { return { kind: 'doodle', name, flip: Boolean(flip) }; }
