import { getGameFlowPolicy } from './gameFlowPolicies.js';

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

    if (!roundFinished) return runId === this.runId;

    if (resultLevel === 'round' && policy.autoAdvanceRound) {
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
