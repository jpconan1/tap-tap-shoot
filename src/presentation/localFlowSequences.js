export const LOCAL_FLOW_SEQUENCE = Object.freeze({
  OPEN_PRACTICE_SELECT: Object.freeze([
    Object.freeze({ type: 'curtainSwap', action: 'enterPracticeSelect' }),
  ]),
  START_LOCAL_GAME: Object.freeze([
    Object.freeze({ type: 'prepare', action: 'prepareLocalGame' }),
    Object.freeze({ type: 'starburstSwap', action: 'enterLocalGame' }),
    Object.freeze({ type: 'unlockInput' }),
    Object.freeze({ type: 'openingCues' }),
  ]),
  CONFIRM_LOCAL_VARIANT: Object.freeze([
    Object.freeze({ type: 'prepare', action: 'prepareLocalGame' }),
    Object.freeze({ type: 'commit', action: 'enterLocalGame' }),
    Object.freeze({ type: 'revealCurtain' }),
    Object.freeze({ type: 'unlockInput' }),
    Object.freeze({ type: 'openingCues' }),
  ]),
  START_TUTORIAL: Object.freeze([
    Object.freeze({ type: 'prepare', action: 'prepareTutorial' }),
    Object.freeze({ type: 'starburstSwap', action: 'enterTutorial' }),
    Object.freeze({ type: 'showAlert', alert: 'tutorialIntro' }),
    Object.freeze({ type: 'unlockInput' }),
    Object.freeze({ type: 'openingCues' }),
  ]),
});
