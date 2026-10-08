# Finsanity benchmark & verification tools

Dev-only tooling for measuring performance and proving that optimizations don't change visuals or physics. It is **not** part of the game (the server never serves it). Everything drives a real, **headed** Chromium window through Playwright, because only a headed browser uses the real GPU; headless results do not reproduce the game's frame-time problems.

## Setup
- The game server must be running: `node server.js` (http://localhost:8080). Override with `BENCH_URL=http://host:port/`.
- Playwright is not a project dependency. `pw.cjs` finds it (`require('playwright')`, `$PLAYWRIGHT_PATH`, or the copy `npx playwright` leaves in the npm cache). If missing: `npm i -D playwright && npx playwright install chromium`.
- A browser window pops up during every run. Don't use the machine heavily while a benchmark runs; results are timing-sensitive.

## What "fast" means here
`rAF` frame interval is pinned to the display's refresh interval (10.0ms on a 100Hz monitor) and cannot go lower, so it only tells you when the game *misses* a frame. The numbers that actually measure cost are:
- **main-thread ms** (per frame / per wall-second, from CDP `TaskDuration`),
- **GPU busy ms** (sum of `GPUTask` events on the GPU process during a Chromium trace),
- the game's own **F3 per-phase JS timings** (`?perf` in the URL, or press F3; "basic" mode = JS only, "accurate" mode forces draws to finish but distorts everything with readbacks — don't trust it for absolute numbers).
Since the game now only renders after a sim step, "frames per second" of the rAF loop is no longer the render rate; compare busy-time per second instead.

## Scenarios and fixtures
`lib.cjs` `SCENARIOS`: `empty` (fresh New Game, Mound cracked), `stress` (loads `fixtures/stress.json`: 30 fish across 6 species, 52 buildings, ~1000 items), each also with the Shop / Tank / Lab open (`+shop`, `+tank`, `+lab`).
- Rebuild the stress save with the game's own cheat keys: `node tools/bench/mkstress.cjs` (writes `fixtures/stress_raw.json`), then `node tools/bench/pad_items.cjs` (clones real items up to 1000 -> `fixtures/stress.json`).
- The live stress simulation is **not reproducible run to run** even with a seeded RNG and a paused clock (cause not found). Never expect two live runs to match frame for frame; compare medians of several runs, and verify physics changes with `coll/` instead.

## Commands (run from the repo root)
| Command | Purpose |
|---|---|
| `node tools/bench/run.cjs <tag> <ids\|all> [runs]` | Benchmark scenarios, saves `results/<tag>.json` (median of `runs`, default 3). Each run is a fresh page. |
| `node tools/bench/compare.cjs <tagA> <tagB>` | Side-by-side of two saved results. |
| `node tools/bench/visual.cjs capture <set>` | Deterministic screenshots of 7 views (fake clock, seeded RNG, caustic video frozen, entities frozen with Pause Time) into `visual/<set>/`. |
| `node tools/bench/visual.cjs compare <refSet> [curSet]` | Capture a new set and diff it against `<refSet>`; diff PNGs go to `visual/diff_*`. Noise floor of identical code is meanAbs 0.00-0.12 (a few bubble pixels); anything above that, look at the diff image. Capture the reference with the *old* code right before changing anything. |
| `node tools/bench/profile.cjs <fixture\|none> [secs]` / `profile2.cjs` | CPU sampling profile: self time by function; `profile2` groups native canvas calls by their JS caller and lists inclusive time. |
| `node tools/bench/callcount.cjs <fixture\|none>` | Canvas 2D calls per rendered frame by method. |
| `node tools/bench/phasecalls.cjs <fixture> ["<perf label>"]` | Canvas calls per render phase; with a label, that phase's drawing calls become no-ops (ablation = true cost of a phase). **Needs a temporary one-line probe**: add `window.__phaseAfter = label;` as the first line of `perfMark` in `js/PerfOverlay.js`, and remove it afterwards. `PAUSETIME=1` freezes entities first. |
| `node tools/bench/tracediff.cjs` | Chromium trace event totals, live vs frozen stress scene. |
| `node tools/bench/callers.cjs <fixture|none>` | Which JS functions issue fill/stroke/drawImage/fillText calls, per rendered frame (stack-sampled; `CLEAR_ITEMS=1` removes the items first, `TOP=n`). The way to find what to sprite-cache next. |
| `node tools/bench/crop.cjs <setA> <setB> <view> [x y w h zoom]` | Zoomed side-by-side crop (A, B, amplified diff) of two visual sets; without a region it picks the most-different window. Use it to LOOK at a diff before trusting a number. |
| `node tools/bench/mklooks.cjs [hatId]` | Builds `fixtures/looks.json` (every fish tier/tint/stage, dying fish, an equipped hat) for the `looks` visual view. |
| `node tools/bench/mutprobe.cjs` | DOM mutations per second inside each menu (should be ~0 per frame). |
| `node tools/bench/functional.cjs` | Shop/Tank/Lab still update live (family cycle, upgrade buy, lab purchase). |
| `node tools/bench/cadence.cjs` | Render rate at title / 1x / 2x / 0x speed. |
| `node tools/bench/spritebench*.cjs` | Isolated micro-benchmarks of canvas sprite-drawing strategies. |
| `node tools/bench/sim/lockstep.mjs [fixture] [ticks] [--magnets N] [--time|--solo|--self]` | **Simulation equivalence + timing in plain Node**: the real `updateEntities()` from a save fixture, committed code vs working tree, each with its own seeded RNG; the whole `state.level` is compared bit for bit after every step (first diverging path is printed). `--time` reports ms/step for both, `--solo` runs only the new code (use with `node --cpu-prof`, then `sim/cpuprofile.mjs`), `--self` proves the harness itself is deterministic. Fixtures: `stress.json`, `buildings.json` (items against every building; `sim/mkbuildings.mjs`). **Run it after any change to item/building/fish logic.** |
| `node tools/bench/sim/fancheck.mjs` | 300k random items vs random fans, old vs new `computeFanForce`, bit-exact (cone edges, range limit, fan centre included). |
| `node tools/bench/textbench.cjs` | Isolated canvas text micro-benchmark (note: plain `fillText` is cheap in isolation — it is *colour emoji* text that is slow; see CLAUDE.md). |
| `node tools/bench/coll/run_ref.mjs`, `final_check.mjs` | **Physics equivalence**: extract the real `applyItemPush`/`resolveItemCollisions` source from `Grid.js` and run old vs new in lockstep over falling/piling items, requiring bit-exact x/y/vx/vy/touching/sleeping/restTicks. For an old/new comparison set `REF_GRID=<path to the OLD Grid.js>`. |

Environment switches understood by `lib.cjs`: `BENCH_INIT=<script file>` (inject any experiment script before the game loads — e.g. a shim that no-ops `fillText` to measure what text costs), `BENCH_ABLATE=<regex of function names>` (every draw call issued by a matching function becomes a no-op — reads the stack on every draw, so JS timings are inflated; only trust GPU numbers from it), `BENCH_UNCAPPED=1` (lift the vsync cap to emulate a very high refresh rate), `BENCH_NOCAUSTIC=1` (block the caustic video), `BENCH_PAUSETIME=1` (freeze entities: isolates render cost), `BENCH_WAIT_BEFORE_PAUSE=<ms>`, `BENCH_ATLAS=1` / `BENCH_OPAQUE=1` (runtime shims for experiments).

## Method that worked (and lessons)
1. **Measure first.** Profile, count canvas calls, ablate phases; don't guess. The F3 `r:` labels are the *end* of each phase, and canvas drawing is deferred, so a phase's JS time under-reports it: the cost lands at the first full-screen `drawImage` that consumes the foreground canvas (the "mask copy of foreground" step).
2. **A/B with runtime shims before writing production code** (atlas, opaque canvas, DOM write guards were all tested this way; the atlas looked great in an isolated benchmark and did nothing in the game).
3. **Prove equivalence**, don't assume it: lockstep physics comparison for simulation code, `visual.cjs compare` for rendering.
4. Live frames are *more* expensive than frozen ones (moving vector paths miss Skia's path cache), so benchmark live scenes; use `BENCH_PAUSETIME` only to isolate render cost.
5. Frozen/fake-clock tests need `clock.pauseAt` right after `install` (otherwise the fake clock keeps running in real time).
