import { getGameFlowPolicy } from './gameFlowPolicies.js';
import { getPostTurnAction } from '../engine/matchEngine.js';

export class GameFlowDirector {
  constructor({ playSuper, waitBeats, showResult, advanceRound }) {
    this.effects = { playSuper, waitBeats, showResult, advanceRound };
    this.runId = 0;
  }

  cancel() {
    this.runId += 1;
  }

  async reveal({ variantId, superAnimation = null, roundFinished = false, resultLevel = 'round' }) {
    const runId = ++this.runId;
    const policy = getGameFlowPolicy(variantId);

    if (superAnimation) {
      await this.effects.playSuper(superAnimation, runId);
      if (runId !== this.runId) return false;
    }

    const action = getPostTurnAction({
      roundFinished,
      gameFinished: resultLevel !== 'round',
      autoAdvanceRound: policy.autoAdvanceRound,
    });
    if (action === 'continue-turn') return runId === this.runId;

    if (action === 'advance-round') {
      await this.effects.advanceRound?.({ preserveReveal: true });
      return runId === this.runId;
    }

    if (!superAnimation) {
      await this.effects.waitBeats(2, runId);
      if (runId !== this.runId) return false;
    }

    await this.effects.showResult(resultLevel);
    return runId === this.runId;
  }
}
