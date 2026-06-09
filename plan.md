# Tap Tap Shoot Tech Plan

## Summary
Use Vite for the browser client, like Burger Joint, but keep online play server-authoritative. Vite handles UI, assets, buttons, timers, and the renderer. A Node multiplayer server handles matchmaking, countdowns, turn timers, and final round decisions.

## Key Choices
- Client: Vite, vanilla JS or TypeScript.
- Server: Node with Colyseus.
- Game logic: shared pure engine module used by both client and server.
- Renderer: start with Canvas2D for boiling doodles; move to PixiJS only if graphics need layered sprites, batching, or heavier effects.
- Ranked matchmaking: server-owned queue, match rooms, results, and rating updates.

## Implementation Shape
- Move current `src/engine/*` logic into shared game logic usable by browser and server.
- Add Vite scripts: `dev`, `build`, `preview`.
- Add server app with Colyseus rooms:
  - ready countdown
  - short decision timer
  - submit move messages
  - timeout/default move handling
  - authoritative round resolution
- Client displays server state and sends player decisions only.
- Client may predict UI locally, but server result always wins.

## Tests
- Keep engine unit tests for move rules and round resolution.
- Add server room tests for countdown, submitted moves, timeouts, disconnects, and match end.
- Add simple client smoke test after Vite setup.

## Assumptions
- No React for now.
- No full game engine yet.
- No generated final writing or media beyond temporary placeholders.
- Online ranked comes after local/server room foundation is stable.
