export class PresentationFlowDirector {
  constructor({ sequences, effects = {} }) {
    this.sequences = sequences;
    this.effects = effects;
    this.runId = 0;
  }

  cancel() {
    this.runId += 1;
  }

  async play(name, context = {}) {
    const steps = this.sequences[name];
    if (!steps) return false;

    const runId = ++this.runId;
    for (const step of steps) {
      if (runId !== this.runId) return false;
      await this.runStep(step, context);
    }
    return runId === this.runId;
  }

  async runStep(step, context) {
    const effect = this.effects[step.type];
    if (!effect) throw new RangeError(`Unknown presentation effect "${step.type}".`);
    await effect(step, context);
  }
}
