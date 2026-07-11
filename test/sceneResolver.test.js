import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import {
  VARIANT_ORDER,
  getVariantMoveIds,
  getVariantStartResource,
} from '../src/engine/moves.js';
import { resolveTurn } from '../src/engine/resolveTurn.js';
import { resolveReadyScene, resolveScene } from '../src/sceneResolver.js';

test('every variant move pairing resolves symmetrically to an existing scene', () => {
  for (const variantId of VARIANT_ORDER) {
    const moves = getVariantMoveIds(variantId);
    const resource = getVariantStartResource(variantId);

    for (const p1Move of moves) {
      for (const p2Move of moves) {
        const result = resolveTurn({ variantId, p1Move, p2Move, p1Resource: resource, p2Resource: resource });
        assert.equal(result.ok, true, `${variantId}: ${p1Move} vs ${p2Move} must be legal at starting resources`);

        const scene = resolveScene({ variantId, p1Move, p2Move, result });
        assertSceneAssetExists(scene, `${variantId}: ${p1Move} vs ${p2Move}`);

        const swappedResult = resolveTurn({
          variantId,
          p1Move: p2Move,
          p2Move: p1Move,
          p1Resource: resource,
          p2Resource: resource,
        });
        const swapped = resolveScene({
          variantId,
          p1Move: p2Move,
          p2Move: p1Move,
          result: swappedResult,
        });

        assert.equal(swapped.name, scene.name, `${variantId}: swapping players changed scene for ${p1Move} vs ${p2Move}`);
        assert.equal(
          swapped.flip,
          p1Move === p2Move ? scene.flip : !scene.flip,
          `${variantId}: swapping players did not mirror ${p1Move} vs ${p2Move}`,
        );
      }
    }
  }
});

test('every ready scene selected by the resolver exists', () => {
  for (const variantId of VARIANT_ORDER) {
    const variantMoves = getVariantMoveIds(variantId);
    const resource = getVariantStartResource(variantId);

    for (const p1Move of variantMoves) {
      for (const p2Move of variantMoves) {
        const moves = { p1: p1Move, p2: p2Move };
        const result = resolveTurn({ variantId, p1Move, p2Move, p1Resource: resource, p2Resource: resource });
        const scene = resolveScene({ variantId, p1Move, p2Move, result });

        for (const readyPlayerId of ['p1', 'p2']) {
          const ready = resolveReadyScene({ sceneName: scene.name, readyPlayerId, moves });
          if (ready) assertSceneAssetExists(ready, `${variantId}: ${p1Move} vs ${p2Move}, ${readyPlayerId} ready`);
        }
      }
    }
  }
});

function assertSceneAssetExists(scene, context) {
  assert.equal(scene.kind, 'doodle', context);
  assert.equal(typeof scene.flip, 'boolean', context);
  assert.equal(
    existsSync(new URL(`../assets/${scene.name}_sheet.webp`, import.meta.url)),
    true,
    `${context} selected missing asset ${scene.name}`,
  );
}
