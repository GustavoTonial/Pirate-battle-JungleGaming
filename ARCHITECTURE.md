# Architecture

## Layers

```
src/
  config/     gameConfig.ts       typed, frozen-per-match balance + option limits
  game/       Simulation, ai      pure rules (no DOM, no Pixi, no clock)
  input/      InputController     keyboard + touch -> one held-state object
  render/     GameRenderer, assets  Pixi display objects, textures
  engine/     GameSession         ties simulation + renderer + input + loop + lifecycle
  state/      appStore, storage   UI state (zustand) and localStorage helpers
  api/        client, hooks, recorder   Axios + TanStack Query + pending queue
  mocks/      handlers, scenarios, fixtures, db   MSW
  ui/         React screens       menus, HUD, dialogs, touch controls
  testing/    testMode, testApi   opt-in observation hooks
```

Dependency direction: `ui -> engine -> (game, render, input)`; `game` imports nothing but `config` types and math.

## React <-> PixiJS

* React owns menus, HUD, dialogs and touch buttons. PixiJS owns the arena, ships, projectiles, effects and the health
  bars above ships.
* `MatchScreen` creates **one `GameSession` per match** in an effect and destroys it in the cleanup. `GameRenderer.create`
  is async; it takes an `isCancelled()` callback and, if the effect was already cleaned up (Strict Mode mount/unmount/
  mount, quick navigation), destroys the Pixi app *before* attaching the canvas. Shared textures are never destroyed with
  the app (`texture: false`).
* Continuous combat state never enters React. `GameSession` pushes a `HudSnapshot` (score, health, whole seconds left,
  status) to a zustand store **only when one of those values changes**: at most about once per second plus discrete
  events, never per frame. HUD components subscribe to that store.
* Screen-reader support: the canvas is `aria-hidden`; a visually hidden `<dl>` mirrors score/time/health, and a single
  polite live region announces state changes (start, pause, resume, low hull, 30 s / 10 s left). Nothing is announced
  per frame or per second.
* The pause menu and the network simulator use native modal `<dialog>` (browser-managed focus trap, inert background).

## Simulation loop and time

* `Simulation.step(dt)` is deterministic and does nothing unless the status is `running`. `GameSession.advance(ms)` adds
  real elapsed time (capped at 100 ms per frame) to an accumulator and runs **fixed 1/60 s steps**, so movement, damage,
  cooldowns and spawns do not depend on the frame rate.
* Step order: player (turn, move, fire) -> spawn timer -> enemy AI -> projectile motion -> ship/ship separation ->
  ship vs islands + arena clamp -> projectile hits -> Chaser contact -> cleanup -> end conditions (death is checked
  before time).
* Pause sets the status, clears input and zeroes the accumulator. Cooldowns and the match clock only advance inside
  `step`, so they freeze. Resume also clears input and the accumulator: nothing from the pause period accumulates.
  Visual effects advance by *simulated* time, so they freeze too.
* A seeded PRNG (`mulberry32`) drives spawn positions and types; the same seed gives the same match.
* Time ends the match at exactly the configured duration (clamped); `durationMs` is the effective active time.

## Collisions

All colliders are circles (ships, projectiles, islands). Islands are circle colliders sized to the sprites.

* Ships vs islands/arena: push-out along the contact normal, then clamp to the arena. Ship vs ship: symmetric
  separation (except Chaser vs player, which explodes on contact).
* Projectiles are removed on island hit, ship hit (damage applied once, owner-filtered), end of range, or leaving the
  arena. Maximum projectile step (about 9 px) is far below any collider radius, so there is no tunnelling.
* Enemy navigation uses whisker-style avoidance: if the straight path hits an inflated island circle, the heading is bent
  away from its center, stronger when closer; the push-out is the safety net.
* Dead enemies leave `sim.ships` immediately and stop firing/colliding; their sprites are destroyed on the next sync.

## Rendering and resources

* Fixed 1280x720 world scaled to fit the canvas (letterboxed), so rules and coordinates never change with screen size.
  `ResizeObserver` drives `renderer.resize`; resolution follows `devicePixelRatio` (capped at 2).
* Textures: ships atlas (1x), tiles (2x sheet, scaled 0.5) and a water tile are loaded once via `Assets.load` with
  progress, cached in module scope, and sliced into sub-textures. Any failure rejects; `LoadingScreen` shows an
  accessible error with *Try again* / *Main Menu*, before combat starts.
* Projectile and effect sprites come from small pools; ship views are created/destroyed with the ships. `destroy()`
  removes the ticker callback, `ResizeObserver`, key/blur/visibility listeners and destroys the Pixi app.
* Health deteriorates visually in three hull stages (full sail, torn, grey wreck) plus a flame when hull <= 40%.
  Feedback: muzzle flashes, impact bursts, explosions, red hit flash and a short screen shake when the player is hit.

## Persistence

`localStorage`: options, last completed result, pending (unconfirmed) records, local player identity, and the mock
database/scenario. Every read is try/catch-protected and validated. Reloading or leaving the match abandons it: only
*ended* matches are ever recorded.

## Ranking and history

Contracts: [`src/api/contracts.ts`](src/api/contracts.ts) (shared by client, handlers, fixtures).

* **Query keys**: `['ranking', sessionTimeSec, enemySpawnTimeSec, page]`, `['history', playerId, page]`.
  `queryFn` forwards the abort `signal` to Axios, so a superseded request is cancelled and a late response cannot
  overwrite newer data. Pagination uses `keepPreviousData`. Tabs mount with `refetchOnMount: 'always'`.
* **Ranking rule**: only matches with the same configuration are compared; order is score desc, then earlier `playedAt`,
  then `matchId` (deterministic). Each finished match is one entry.
* **Retries**: queries and the mutation retry (default 2, exponential back-off capped at 4 s) only network errors,
  timeouts, 5xx, 408 and 429; other 4xx fail immediately.
* **Registering a match** (`MatchRecorderProvider`, mounted above all screens): the record is written to the pending
  store *first*, then `POST /matches` runs through `useMutation`. Success removes it from pending, marks it saved and
  invalidates `ranking` and `history`. Failure keeps it pending; the result screen shows the state with a *Try again*
  button. Pending records are retried at start-up (after a refresh) and on the `online` event.
* **Idempotency**: `matchId` is the idempotency key. The client allows one in-flight request per `matchId` (repeated
  clicks are ignored) and the server returns the stored record (200, `created: false`) for a known id. This is what makes
  the "timeout after the server saved" scenario safe.
* API failures never block play: the game, options and menu do not depend on any request.

## MSW

One set of handlers (`src/mocks/handlers.ts`) is used in dev, in Playwright and in the production build (worker started
in `main.tsx`). Scenarios (`scenarios.ts`) combine a per-endpoint behavior, a latency profile and a dataset. Randomness
is seeded (`?mockSeed`). Confirmed matches live in `localStorage` (`mockDb`).

## Performance

Budget: 60 FPS at 1280x720 with at most 10 enemies. Measure with `PERF=1 npx playwright test e2e/perf.spec.ts`; it records
average FPS, median/p95/max frame time and entity counts for a 3-minute match, plus JS heap, DOM nodes and listeners
after each of 5 start/play/quit cycles (`perf-results/*.json`). Fill this table with the first real run:

| Item | Value |
| --- | --- |
| Hardware / OS | _to fill_ |
| Browser / version | _to fill_ |
| Resolution / DPR | _to fill_ |
| Match config | 180 s, spawn 1.5 s, bot input |
| Avg FPS / p95 frame ms | _to fill_ |
| Max entities | _to fill_ |
| Heap after cycles 1..5 | _to fill_ (flat = no leak) |

## Limitations and decisions

* Colliders are circles; ships are elongated, so side contacts feel slightly generous.
* The renderer does not interpolate between fixed steps; at 60 Hz this is invisible, on 120/144 Hz displays motion is
  shown at 60 steps/s.
* No audio: the sound files were not part of this repository snapshot, so nothing is wired.
* Balance (player 10 HP; Chaser 2 HP and 3 contact damage; Shooter 3 HP, 1 damage every 1.6 s) targets a player who keeps
  moving; a stationary player dies to a single Shooter in about 16 s.
* Test hooks (`?e2e=1`) can teleport entities for scenario setup; they are inert unless the flag is present.
