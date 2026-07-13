import { ONLINE_FLOW_SEQUENCE } from './onlineFlowSequences.js';

export class OnlineFlowDirector {
  constructor({ closeCurtains, openCurtains, reattachCurtain, spikeWipe, waitBeats, waitBanAnimation, revealTiebreaker, commit, show, openingCues, disconnect, exitRanked }) {
    this.effects = { closeCurtains, openCurtains, reattachCurtain, spikeWipe, waitBeats, waitBanAnimation, revealTiebreaker, commit, show, openingCues, disconnect, exitRanked };
    this.curtain = null;
    this.mailbox = new Map();
    this.runId = 0;
  }

  adoptCurtain(curtain) {
    this.curtain = curtain;
  }

  async cover() {
    if (!this.curtain) this.curtain = await this.effects.closeCurtains();
    else this.effects.reattachCurtain?.(this.curtain);
    return this.curtain;
  }

  async reveal() {
    if (!this.curtain) return;
    const curtain = this.curtain;
    this.effects.reattachCurtain?.(curtain);
    await this.effects.openCurtains(curtain);
    if (this.curtain === curtain) this.curtain = null;
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
