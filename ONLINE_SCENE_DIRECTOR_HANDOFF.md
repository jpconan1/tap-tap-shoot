# Online Scene Director Handoff

The online pre-game flow uses a presentation director so server snapshots, curtains, stages, and timing do not fight each other.

## Files

- `src/presentation/onlineFlowSequences.js`
  - Declares choreography as ordered command lists.
  - Converts server snapshots/transitions into presentation events.
- `src/presentation/onlineFlowDirector.js`
  - Executes sequences one command at a time.
  - Owns the active curtain.
  - Owns cancellation and the queued-animation mailbox.
- `src/main.js`
  - Supplies rendering/animation effects to the director.
  - Commits authoritative ranked snapshots.
  - Contains the individual stage renderers.
- `test/onlineFlowDirector.test.js`
  - Verifies command order without needing DOM or WebSockets.

## Mental Model

Keep these separate:

1. **Match state:** server facts such as phase, players, picks, and score.
2. **Presentation state:** visible stage, curtain state, waits, wipes, and queued animations.

Server snapshot flow:

```text
ranked snapshot
  -> interpretOnlineSnapshot()
  -> semantic event
  -> onlineFlowDirector.play()
  -> declarative sequence commands
  -> render/curtain/wipe effects
```

Do not start curtain animations directly inside snapshot conditionals. Add or edit a semantic event and its sequence instead.

## Existing Events

- `MATCH_FOUND`
  - Commit snapshot.
  - Show match-found stage.
  - Open curtains.
  - Hold two beats.
  - Close curtains.
- `VARIANT_SELECTION_STARTED`
  - Close curtains if needed.
  - Commit snapshot.
  - Show variant selection.
  - Open curtains.
- `VARIANTS_CHOSEN`
  - Cancel queued selection animations.
  - Close curtains.
  - Commit snapshot.
  - Show scoreboard.
  - Open curtains.
  - Hold five beats.
  - Spike wipe into gameplay.

Ordinary snapshot updates do not need a sequence. `processRankedSnapshot()` commits and renders them directly unless a modal/detail stage must remain visible.

## Adding the Next Stage

Example: add a stage between scoreboard and gameplay.

1. Add a renderer in `src/main.js`:

```js
function renderNextStage() {
  app.innerHTML = `<section class="next-stage">...</section>`;
  mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
}
```

2. Route its screen name in `render()`:

```js
if (screen === 'next-stage') {
  renderNextStage();
  return;
}
```

3. Edit the sequence in `onlineFlowSequences.js`:

```js
Object.freeze({ type: 'show', stage: 'scoreboard' }),
Object.freeze({ type: 'openCurtains' }),
Object.freeze({ type: 'waitBeats', beats: 5 }),
Object.freeze({ type: 'closeCurtains' }),
Object.freeze({ type: 'show', stage: 'next-stage' }),
Object.freeze({ type: 'openCurtains' }),
Object.freeze({ type: 'waitBeats', beats: 2 }),
Object.freeze({ type: 'spikeWipe', stage: 'playing' }),
```

4. Update the expected command log in `test/onlineFlowDirector.test.js`.

## Adding a New Server-Driven Event

Teach `interpretOnlineSnapshot(previous, next, transitionId)` to return a semantic event name:

```js
if (transitionId === 'new-server-transition') return 'NEW_STAGE_STARTED';
```

Then add the matching sequence to `ONLINE_FLOW_SEQUENCE`.

Use server-provided order and IDs. Do not derive shared presentation order from local-player perspective. Example: scoreboard variant order uses `variantPickOrder`, so both clients see the same first game.

## Supported Commands

The director currently understands:

- `commit`
- `show`
- `closeCurtains`
- `openCurtains`
- `waitBeats`
- `cancelMailbox`
- `spikeWipe`
- `openingCues`

To add a command:

1. Add handling in `OnlineFlowDirector.runStep()`.
2. Inject its side effect through the constructor from `main.js`.
3. Add a unit test proving command order.

Keep the director generic. Game-specific DOM and audio stay in injected effects or stage renderers.

## Curtain Rules

- The director owns the online-flow curtain element.
- Use `onlineFlowDirector.cover()` and `onlineFlowDirector.reveal()` for online pre-game UI.
- Do not store another online curtain reference in `main.js` stage state.
- Rendering with `app.innerHTML` detaches overlays. The director reattaches its owned curtain before opening it.
- Call `onlineFlowDirector.cancel()` on quit, disconnect, or forced return to title.
- A sequence may safely call `closeCurtains` when already closed. `cover()` reuses the owned curtain.

The older ranked queue curtain is adopted by the director when the first match snapshot arrives. Do not let both systems animate that curtain afterward.

## Variant Waiting State

After a player selects a variant:

- Keep the rule/detail stage mounted.
- Mark `variantDetailMenu.locked = true`.
- Hide Back without collapsing its layout slot.
- Replace Select with the RDY animation.
- Ignore ordinary snapshot renders while the detail menu is mounted.
- When `VARIANTS_CHOSEN` arrives, the sequence removes the detail stage and advances to scoreboard.

Opponent-ready animation events received while detail/curtains hide the selection stage go through the director mailbox. `VARIANTS_CHOSEN` cancels stale mailbox work.

## Timing

One beat is `BEAT_MS` in `src/main.js` (currently 750 ms).

Express designed holds as `waitBeats`, not raw milliseconds. Renderer frame timing may still use milliseconds where animation frames require it.

## Safety Checklist

Before finishing a flow change:

- Both clients receive the same shared ordering.
- Local perspective is used only for names/sides, not match order.
- Every opened curtain was previously closed or adopted.
- Quit/disconnect cancels the active director run.
- A rapid second player response cannot strand an obsolete stage.
- Modal/detail stages survive ordinary snapshots when intended.
- Sequence unit test reflects the designed choreography.
- Run `npm test` and `git diff --check`.
