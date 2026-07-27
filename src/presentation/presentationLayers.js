export function createPresentationLayers(shell) {
  if (!shell) throw new TypeError('Presentation shell is required.');

  const screen = document.createElement('div');
  screen.className = 'presentation-layer presentation-screen-layer';

  const modal = document.createElement('div');
  modal.className = 'presentation-layer presentation-modal-layer';

  const transition = document.createElement('div');
  transition.className = 'presentation-layer presentation-transition-layer';

  shell.replaceChildren(screen, modal, transition);

  return Object.freeze({ screen, modal, transition });
}
