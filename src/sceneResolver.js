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
  'block|block': 'charge-block-fireball/block-draw',
  'charge|block': 'charge-block-fireball/block-charge',
  'block|fireball': 'charge-block-fireball/block-fireball',
  'charge|charge': 'charge-block-fireball/both-charge',
  'charge|fireball': 'charge-block-fireball/charge-fireball',
  'fireball|fireball': 'charge-block-fireball/fireball-draw',
});

export function resolveScene({ variantId = '', p1Move, p2Move, result = {} }) {
  const variant = variantId ? normalizeVariantId(variantId) : '';

  if (variant === VARIANT_IDS.shootStabDuck) return resolveShootStabDuck(result, p1Move, p2Move);
  if (variant === VARIANT_IDS.punchStabShoot) return resolvePunchStabShoot(result, p1Move, p2Move);
  if (variant === VARIANT_IDS.tapTapShoot) return resolveTapTapShoot(result, p1Move, p2Move);

  const name = variant === VARIANT_IDS.rps
    ? resolveRpsName(p1Move, p2Move)
    : variant === VARIANT_IDS.chargeBlockFireball
      ? resolveCbfName(p1Move, p2Move)
      : resolveBasicName(p1Move, p2Move);

  return presentation(name, resolveBasicFlip(name, p1Move, p2Move, variant));
}

export function resolveReadyScene({ sceneName, readyPlayerId, moves }) {
  if (!readyPlayerId || !sceneName || sceneName === 'shooting' || sceneName === 'stabbing') return null;

  const readyMove = moves?.[readyPlayerId];
  const direct = resolveDirectReadyScene(sceneName, readyPlayerId);
  if (direct) return direct;

  const roleScenes = [
    ['charge-block-fireball/block-charge', 'charge', 'charger', 'blocker', moves?.p1 === 'charge'],
    ['charge-block-fireball/block-fireball', 'fireball', 'fireballer', 'blocker', moves?.p1 === 'fireball'],
    ['punch-stab-shoot/punch-shoot', 'punch', 'puncher', 'shooter', moves?.p2 === 'punch'],
    ['punch-stab-shoot/stab-punch', 'stab', 'stabber', 'puncher', moves?.p2 === 'stab'],
    ['shoot-stab-duck/reload-duck', 'reload', 'reloader', 'ducker', moves?.p1 === 'duck'],
    ['shoot-stab-duck/shoot-duck', 'shoot', 'shooter', 'ducker', moves?.p2 === 'shoot'],
    ['shoot-stab-duck/stab-reload', 'stab', 'stabber', 'reloader', moves?.p2 === 'stab'],
    ['tap-tap-shoot/reload-duck', 'reload', 'reloader', 'defender', moves?.p1 === 'duck'],
    ['tap-tap-shoot/shoot-duck', 'shoot', 'shooter', 'ducker', moves?.p2 === 'shoot'],
    ['tap-tap-shoot/stab-counterstab', 'stab', 'stabber', 'counterstabber', moves?.p2 === 'stab'],
  ];

  const rule = roleScenes.find(([prefix]) => sceneName.startsWith(prefix));
  if (!rule) return null;

  const [prefix, primaryMove, primaryRole, secondaryRole, flip] = rule;
  let assetBase = prefix;
  if (prefix === 'tap-tap-shoot/reload-duck') assetBase = 'tap-tap-shoot/reload-defense';
  return presentation(`${assetBase.replace(/\/([^/]+)$/, '/split_scenes/$1')}_${readyMove === primaryMove ? primaryRole : secondaryRole}_is_ready`, flip);
}

function resolveDirectReadyScene(sceneName, readyPlayerId) {
  const rules = [
    [/^rock-paper-scissors\/(rps-standoff|rock-draw|paper-draw|scissors-(?:draw|tie))$/, (name) => `rock-paper-scissors/split_scenes/${name === 'scissors-tie' ? 'scissors-draw' : name}_${readyPlayerId}_is_ready`],
    [/^charge-block-fireball\/(cbf-standoff|both-charge|block-draw|fireball-draw)$/, (name) => {
      if (name === 'cbf-standoff') return `charge-block-fireball/split_scenes/cbf_standoff_${readyPlayerId}_is_ready`;
      if (name === 'both-charge') return `charge-block-fireball/split_scenes/charge-${readyPlayerId}_is_ready`;
      return `charge-block-fireball/split_scenes/${name}_${readyPlayerId}_is_ready`;
    }],
    [/^punch-stab-shoot\/(pss-standoff|punch-draw|shoot-draw|stab-draw)$/, (name) => `punch-stab-shoot/split_scenes/${name}_${readyPlayerId}_is_ready`],
    [/^shoot-stab-duck\/(standoff-ssd|reload-draw|shoot-draw|stab-draw|duck-draw)$/, (name) => `shoot-stab-duck/split_scenes/${name === 'standoff-ssd' ? 'ssd-standoff' : name === 'reload-draw' ? 'reloading' : name}_${readyPlayerId}_is_ready`],
    [/^tap-tap-shoot\/(standoff-tts|reload-draw|shoot-draw|stab-draw|defense-draw)$/, (name) => `tap-tap-shoot/split_scenes/${name === 'standoff-tts' ? 'tts-standoff' : name === 'reload-draw' ? 'reloading' : name}_${readyPlayerId}_is_ready`],
  ];

  for (const [pattern, build] of rules) {
    const match = sceneName.match(pattern);
    if (match) return presentation(build(match[1]), false);
  }
  return null;
}

function resolveShootStabDuck(result, p1Move, p2Move) {
  if (p1Move === p2Move) return presentation(`shoot-stab-duck/${p1Move === 'reload' ? 'reload' : p1Move}-draw`, false);
  const hitMove = result.p1Hit ? p1Move : result.p2Hit ? p2Move : null;
  if (hitMove === 'shoot') return presentation('shoot-stab-duck/shoot-kill', p2Move === 'shoot');
  if (hitMove === 'stab') return presentation('shoot-stab-duck/stab-kill', p2Move === 'stab');
  if (hasMoves(p1Move, p2Move, 'reload', 'duck')) return presentation('shoot-stab-duck/reload-duck', p1Move === 'duck');
  if (hasMoves(p1Move, p2Move, 'shoot', 'duck')) return presentation('shoot-stab-duck/shoot-duck', p2Move === 'shoot');
  if (hasMoves(p1Move, p2Move, 'stab', 'reload')) return presentation('shoot-stab-duck/stab-reload', p2Move === 'stab');
  return presentation('shoot-stab-duck/duck-draw', p1Move === 'duck');
}

function resolvePunchStabShoot(result, p1Move, p2Move) {
  if (p1Move === p2Move) return presentation(`punch-stab-shoot/${p1Move}-draw`, false);
  const hitMove = result.p1Hit ? p1Move : result.p2Hit ? p2Move : null;
  const targetMove = result.p1Hit ? p2Move : result.p2Hit ? p1Move : null;
  const suffix = result.winner !== null ? 'kill' : 'damage';
  if (hitMove === 'punch' && targetMove === 'shoot') return presentation(`punch-stab-shoot/punch-shoot-${suffix}`, p2Move === 'punch');
  if (hitMove === 'stab' && targetMove === 'punch') return presentation(`punch-stab-shoot/stab-punch-${suffix}`, p2Move === 'stab');
  return presentation('punch-stab-shoot/shoot-stab', p2Move === 'shoot');
}

function resolveTapTapShoot(result, p1Move, p2Move) {
  if (p1Move === p2Move) {
    const name = ['duck', 'counterstab'].includes(p1Move) ? 'defense-draw' : `${p1Move === 'reload' ? 'reload' : p1Move}-draw`;
    return presentation(`tap-tap-shoot/${name}`, false);
  }
  const hitMove = result.p1Hit ? p1Move : result.p2Hit ? p2Move : null;
  if (hitMove === 'shoot') return presentation('tap-tap-shoot/shoot-kill', p2Move === 'shoot');
  if (hitMove === 'stab') return presentation('tap-tap-shoot/stab-kill', p2Move === 'stab');
  if (hasMoves(p1Move, p2Move, 'stab', 'counterstab')) return presentation('tap-tap-shoot/stab-counterstab', p2Move === 'stab');
  if (hasMoves(p1Move, p2Move, 'stab', 'duck')) return presentation('tap-tap-shoot/defense-draw', p1Move === 'duck');
  if (hasMoves(p1Move, p2Move, 'duck', 'counterstab')) return presentation('tap-tap-shoot/defense-draw', p1Move === 'duck');
  if (hasMoves(p1Move, p2Move, 'reload', 'duck')) return presentation('tap-tap-shoot/reload-duck', p1Move === 'duck');
  if (hasMoves(p1Move, p2Move, 'shoot', 'duck')) return presentation('tap-tap-shoot/shoot-duck', p2Move === 'shoot');
  return presentation('tap-tap-shoot/defense-draw', p2Move === 'duck' || p2Move === 'counterstab');
}

function resolveRpsName(p1Move, p2Move) {
  if (p1Move === p2Move) return `rock-paper-scissors/${p1Move === 'scissors' ? 'scissors-tie' : `${p1Move}-draw`}`;
  if (hasMoves(p1Move, p2Move, 'rock', 'scissors')) return 'rock-paper-scissors/rock-scissors';
  if (hasMoves(p1Move, p2Move, 'paper', 'rock')) return 'rock-paper-scissors/paper-rock';
  if (hasMoves(p1Move, p2Move, 'scissors', 'paper')) return 'rock-paper-scissors/scissors-paper';
  return 'rock-paper-scissors/rps-standoff';
}

function resolveCbfName(p1Move, p2Move) { return CBF_SCENES[sortedKey(p1Move, p2Move)] ?? 'charge-block-fireball/cbf-standoff'; }
function resolveBasicName(p1Move, p2Move) { return BASIC_SCENES[sortedKey(p1Move, p2Move)] ?? 'hiding'; }

function resolveBasicFlip(name, p1Move, p2Move, variant) {
  if (variant === VARIANT_IDS.rps) return (name.endsWith('rock-scissors') && p2Move === 'rock') || (name.endsWith('paper-rock') && p2Move === 'paper') || (name.endsWith('scissors-paper') && p2Move === 'scissors');
  if (variant === VARIANT_IDS.chargeBlockFireball) return (name.endsWith('block-charge') && p1Move === 'charge') || (name.endsWith('block-fireball') && p1Move === 'fireball') || (name.endsWith('charge-fireball') && p1Move === 'fireball');
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
