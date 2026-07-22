import { ONLINE_FLOW_SEQUENCE } from './onlineFlowSequences.js';

export class OnlineFlowDirector {
  constructor({ closeCurtains, openCurtains, reattachCurtain, spikeWipe, waitBeats, waitBanAnimation, revealTiebreaker, commit, show, openingCues, disconnect, exitRanked }) {
    this.effects = { closeCurtains, openCurtains, reattachCurtain, spikeWipe, waitBeats, waitBanAnimation, revealTiebreaker, commit, show, openingCues, disconnect, exitRanked };
    this.curtain = null;
    this.curtainState = 'open';
    this.curtainTransition = null;
    this.mailbox = new Map();
    this.runId = 0;
  }

  adoptCurtain(curtain) {
    this.curtain = curtain;
    this.curtainState = curtain ? 'closed' : 'open';
  }

  async cover() {
    if (this.curtainState === 'closing') {
      await this.curtainTransition;
      return this.curtain;
    }
    if (this.curtainState === 'opening') await this.curtainTransition;
    if (this.curtain) {
      this.effects.reattachCurtain?.(this.curtain);
      this.curtainState = 'closed';
      return this.curtain;
    }

    this.curtainState = 'closing';
    const transition = this.effects.closeCurtains((curtain) => {
      this.curtain = curtain;
    });
    this.curtainTransition = transition;
    const curtain = await transition;
    if (this.curtainTransition === transition) {
      this.curtain = curtain;
      this.curtainState = 'closed';
      this.curtainTransition = null;
    }
    return this.curtain;
  }

  async reveal() {
    if (this.curtainState === 'closing') await this.curtainTransition;
    if (!this.curtain || this.curtainState === 'open') return;
    if (this.curtainState === 'opening') return this.curtainTransition;
    const curtain = this.curtain;
    this.effects.reattachCurtain?.(curtain);
    this.curtainState = 'opening';
    const transition = this.effects.openCurtains(curtain);
    this.curtainTransition = transition;
    await transition;
    if (this.curtain === curtain) this.curtain = null;
    if (this.curtainTransition === transition) {
      this.curtainState = 'open';
      this.curtainTransition = null;
    }
  }

  syncLayers() {
    if (this.curtain) this.effects.reattachCurtain?.(this.curtain);
  }

  queueAnimation(id, payload) {
    this.mailbox.set(id, payload);
  }

  consumeAnimations() {
    const animations = [...this.mailbox.values()];
    this.mailbox.clear();
    return animations;
  }

  cancel() {
    this.runId += 1;
    this.mailbox.clear();
    this.curtain?.remove();
    this.curtain = null;
    this.curtainState = 'open';
    this.curtainTransition = null;
  }

  async play(name, context) {
    const steps = ONLINE_FLOW_SEQUENCE[name];
    if (!steps) return false;
    const runId = ++this.runId;
    for (const step of steps) {
      if (runId !== this.runId) return false;
      await this.runStep(step, context);
    }
    return runId === this.runId;
  }

  async runStep(step, context) {
    if (step.type === 'commit') this.effects.commit(context.snapshot, context.previousPhase);
    else if (step.type === 'show') this.effects.show(step.stage);
    else if (step.type === 'closeCurtains') await this.cover();
    else if (step.type === 'openCurtains') await this.reveal();
    else if (step.type === 'waitBeats') await this.effects.waitBeats(step.beats);
    else if (step.type === 'waitBanAnimation') await this.effects.waitBanAnimation?.();
    else if (step.type === 'revealTiebreaker') this.effects.revealTiebreaker?.(context.snapshot);
    else if (step.type === 'cancelMailbox') this.mailbox.clear();
    else if (step.type === 'spikeWipe') await this.effects.spikeWipe(step.stage);
    else if (step.type === 'openingCues') this.effects.openingCues();
    else if (step.type === 'disconnect') this.effects.disconnect?.();
    else if (step.type === 'exitRanked') this.effects.exitRanked?.();
  }
}
