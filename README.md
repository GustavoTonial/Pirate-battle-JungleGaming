# Pirate Battle

Top-down naval shooter built with **React + TypeScript (strict) + PixiJS**. Ranking and match history use a REST API
mocked with **MSW**, consumed through **Axios + TanStack Query**. Tests: **Playwright**.

Live demo: _add your Vercel/Netlify/Cloudflare URL here after deploying._

## Setup

```bash
npm install        # also runs `msw init public` (creates public/mockServiceWorker.js - commit it)
npm run dev        # http://localhost:5173
```

Requires Node 20+. No private services and no required environment variables.

| Variable (optional) | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | Base URL of the (mocked) REST API |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Type-check + production build into `dist/` |
| `npm run preview` | Serves the production build on :4173 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run test:e2e` | Playwright (builds and previews the app itself), desktop + mobile Chromium |
| `npm run test:e2e:update` | (Re)creates the visual-regression baselines |
| `npm run test:e2e:report` | Opens the HTML report (traces are kept for failures) |
| `PERF=1 npx playwright test e2e/perf.spec.ts --project=desktop-chromium` | Profiling run (3 min real time + memory cycles) |

First run on a new machine: `npx playwright install chromium`, then `npm run test:e2e:update` once to create baselines,
and commit `e2e/visual.spec.ts-snapshots/`. Baselines are OS/browser specific; regenerate them in the environment that
will run CI.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Sail forward | `W` / `Up` | forward button |
| Turn left / right | `A` `D` / `Left` `Right` | turn buttons |
| Fire ahead (1 projectile) | `Space` | center fire button |
| Left / right broadside (3 parallel projectiles) | `Q` / `E` | side fire buttons |
| Pause | `Esc` / `P` | pause button |

Movement and firing can be combined freely. Touch controls appear on coarse-pointer devices (or with `?touch=1`).
Mobile is **landscape only**; portrait shows a rotate overlay. The match also pauses on window blur or hidden tab, and
resuming requires pressing **Resume**.

## Gameplay configuration

All balance lives in [`src/config/gameConfig.ts`](src/config/gameConfig.ts) (health, speeds, turn rates, damage, projectile
speed/range, cooldowns, shooter range, spawn weights, island layout). Systems only read the config snapshot they receive.

The Options screen exposes two values (validated, persisted in `localStorage`):

| Option | Limits |
| --- | --- |
| Game session time | integer, 60 - 180 s (default 90) |
| Enemy spawn time | number, 0.5 - 10 s, must be > 0 (default 2.5) |

Each match takes a frozen snapshot of the options when it starts. The first two spawns are always a Chaser then a
Shooter, afterwards 50/50. Spawn points are free of islands/ships and at least 380 px from the player.

## Mocked API and network scenarios

Endpoints (served by MSW in dev, tests **and the published build**):

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/ranking?page&pageSize&sessionTimeSec&enemySpawnTimeSec` | Paginated ranking for one configuration |
| `GET` | `/api/players/:playerId/matches?page&pageSize` | Paginated match history, newest first |
| `POST` | `/api/matches` | Registers a finished match. Idempotent by `matchId`: 201 first time, 200 afterwards |

Select a scenario in the app (**Menu -> Network simulator**), with `?scenario=<id>`, or from the console with
`__PB_MOCK__.setScenario('<id>')`. **Reset data** (or `?mockReset=1`, or `__PB_MOCK__.reset()`) restores the initial state.

| id | Behavior |
| --- | --- |
| `success` | Healthy API, multi-page ranking (default) |
| `empty` | Empty ranking and history |
| `multi-page` | 150 ranking entries |
| `slow` / `variable-latency` / `out-of-order` | 1.5 s / seeded random 0.1-1.8 s / odd requests slow, even fast |
| `timeout` / `network-error` | Requests never answer (client timeout) / connection failures |
| `http-500` / `http-404` | Server errors / 404 on queries (not retried) |
| `ranking-fails` / `history-fails` | One query fails, the other works |
| `record-timeout-after-save` | Match stored, response lost; the retry must not duplicate it |
| `record-unavailable` | Registration answers 503 until you switch scenario (match stays pending) |
| `record-flaky` | Registration fails twice per match, then works |

Reproduce "registration unavailable, then recovery": pick `record-unavailable`, finish a match (result shows
"Couldn't save..."), refresh (the match is still pending), switch to `success`, press **Try again**.

Testing knobs (query params): `apiTimeout=<ms>`, `retryBase=<ms>`, `retries=<n>`, `mockSeed=<n>`, `mockReset=1`.

Local persistence keys: `pb.options.v1`, `pb.lastResult.v1`, `pb.pending.v1`, `pb.player.v1`, `pb.mock.db.v1`,
`pb.mock.scenario.v1`.

## Test hooks (`?e2e=1`)

`window.__PB__` exposes `state()`, `advance(ms)` (with `&clock=manual`), `arrange({...})` (scenario setup) and `perf()`.
Other params: `seed=<n>`, `nospawn=1`, `perf=1` (FPS overlay). Rules, input, collisions and rendering always run for real.

## Deploy

Static site, no server needed. Vercel: import the repo (framework: Vite, build `npm run build`, output `dist`).
`postinstall` creates the MSW worker file during the build. The app must be served from the domain root
(CSS and textures use `/assets/...`).

## Assets and licenses

Game art, UI atlases and tile sheets come from the challenge pack (originals in `assets-src/`; derived PNG/JSON in
`public/assets/`). Fonts: system serif stack, nothing to license. **Add the pack's license text here** if it requires
attribution. Sound effects are not wired in this version.

## Documentation

See [ARCHITECTURE.md](ARCHITECTURE.md) for design decisions, data flow, limitations and balancing notes.
Profiling evidence goes in `perf-results/` (see `ARCHITECTURE.md` -> Performance for the template to fill in).
