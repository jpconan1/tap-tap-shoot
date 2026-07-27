import { ONLINE_FLOW_SEQUENCE } from './onlineFlowSequences.js';
import { PresentationFlowDirector } from './presentationFlowDirector.js';

export class OnlineFlowDirector extends PresentationFlowDirector {
  constructor({ closeCurtains, openCurtains, reattachCurtain, spikeWipe, waitBeats, waitBanAnimation, revealTiebreaker, commit, show, openingCues, disconnect, exitRanked }) {
    super({
      sequences: ONLINE_FLOW_SEQUENCE,
      effects: {
        commit: (_step, context) => commit(context.snapshot, context.previousPhase),
        show: (step) => show(step.stage),
        waitBeats: (step) => waitBeats(step.beats),
        waitBanAnimation: () => waitBanAnimation?.(),
        revealTiebreaker: (_step, context) => revealTiebreaker?.(context.snapshot),
        cancelMailbox: () => {},
        spikeWipe: (step) => spikeWipe(step.stage),
        openingCues: () => openingCues(),
        disconnect: () => disconnect?.(),
        exitRanked: () => exitRanked?.(),
      },
    });
    this.curtainEffects = { closeCurtains, openCurtains, reattachCurtain };
    this.curtain = null;
    this.curtainState = 'open';
    this.curtainTransition = null;
    this.mailbox = new Map();
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
      this.curtainEffects.reattachCurtain?.(this.curtain);
      this.curtainState = 'closed';
      return this.curtain;
    }

    this.curtainState = 'closing';
    const transition = this.curtainEffects.closeCurtains((curtain) => {
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
    this.curtainEffects.reattachCurtain?.(curtain);
    this.curtainState = 'opening';
    const transition = this.curtainEffects.openCurtains(curtain);
    this.curtainTransition = transition;
    await transition;
    if (this.curtain === curtain) this.curtain = null;
    if (this.curtainTransition === transition) {
      this.curtainState = 'open';
      this.curtainTransition = null;
    }
  }

  syncLayers() {
    if (this.curtain) this.curtainEffects.reattachCurtain?.(this.curtain);
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
    super.cancel();
    this.mailbox.clear();
    this.curtain?.remove();
    this.curtain = null;
    this.curtainState = 'open';
    this.curtainTransition = null;
  }

  async runStep(step, context) {
    if (step.type === 'closeCurtains') await this.cover();
    else if (step.type === 'openCurtains') await this.reveal();
    else {
      if (step.type === 'cancelMailbox') this.mailbox.clear();
      await super.runStep(step, context);
    }
  }
}
