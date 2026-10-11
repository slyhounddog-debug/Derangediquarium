# Dev tools (sound effects + game tuning + game text + UI layout)

A small local web tool with five tabs. It is a dev tool only; the game never loads it.

- **Audio** — find, trim and level the game's recorded sound effects (below).
- **Variables** — the numbers worth tuning (prices, hunger, species stats, building speeds and power, aliens and waves, Science Lab costs, audio levels, ...), each with a slider and a number box.
- **Formulas** — how the game calculates things (fish/building prices, merged-fish value, feeder economy, Dartfin school, Blimpfish coin, hunger timeline, cleanliness, power efficiency, alien waves, turret damage vs waves, fish health vs aliens, fan lift, building throughput, progression totals, gem economy). Each card has the values it depends on (same sliders) and live tables of what the formula produces.
- **Text** — every player-facing string in the game, editable in place: shop fish and building descriptions, Factory/Power Plant recipes, Science Lab nodes, aliens, achievements, hats, World Settings, the tutorials and info boxes, the windows/menus/buttons in `index.html`, and **all the chat messages**. Same behaviour as the Variables tab: search, "Changed only", per-row **Reset** to the last git commit, "Reset all changed", reload the game tab to see an edit.
- **Layout** — a visual editor for the game's DOM UI (menus, panels, HUD, buttons, text): the real game runs in a preview, you click, drag and resize things, and the changes are saved as overrides the game applies on top of its own styles (below).

```
npm run sfx          # or: node tools/sfx/server.mjs
# -> http://localhost:8081
```

It is a separate server from the game's (`server.js`, port 8080) because it has file-writing endpoints,
and so it can be restarted without touching the game. **Restart it after editing `slots.json` or
`server.mjs`** (they are read once at startup); `index.html` is served fresh on every reload.

## Using it

Needs `npm install` once (the Variables tab uses `acorn`, a dev dependency, to read the game's source).

One card per sound (the list lives in `slots.json`). On a card you can:

- **Drag audio files onto it** (or *browse*, or drop them into `audio/sfx-candidates/<slotId>/`).
  Candidate files are git-ignored; only your picks are tracked.
- **Play** a candidate (shows length, peak and RMS in dBFS). **Current synth** plays the original
  synthesized sound for slots that have one, for comparison.
- **Trim** opens a waveform editor: drag a range, auto-trim silence, fade, normalise, and (for loops)
  *Seamless loop crossfade*. *Save as new candidate* writes a trimmed WAV next to the original.
- **Gain** slider: applies to previews and is saved with the pick. The preview level at the top
  (default 0.35) matches the game's default SFX level.
- **Use this** copies the file to `audio/sfx/<slotId>.<ext>` and records it in `audio/sfx/manifest.json`.
- **Seam** (loop slots only) plays the last 1.5 s then wraps to the start.
- **Gain-only cards** (`gainOnly: true` in `slots.json`) are for sounds whose file is fixed in the game
  (the title sting, the building drop): just Play and a gain slider, saved straight to the manifest.

Changes to the manifest only reach the game on reload (it is fetched when the audio context starts).

## Files

| Path | What |
|---|---|
| `tools/sfx/slots.json` | The list of sounds: `id`, `label`, `want`, `plays`, `search` terms, `synth` (has a synthesized fallback in `Sound.js`), `loop`, `gainOnly`. |
| `tools/sfx/server.mjs` | Express server: slot listing, upload, choose, gain, unchoose, delete. |
| `tools/sfx/index.html` | The whole page (card UI, waveform trimmer, WAV encoder). |
| `audio/sfx-candidates/<slotId>/` | Files being auditioned (git-ignored). |
| `audio/sfx/` | Picked files plus `manifest.json` (tracked). |

## Manifest format (`audio/sfx/manifest.json`)

```json
{
  "playCoinBank":   { "file": "playCoinBank.wav", "gain": 0.5, "source": "original name.wav" },
  "uiHover":        { "files": ["uiHover-1.wav", "..."], "gain": 0.21, "source": "6 files, cycled in order" },
  "finSanity":      { "gainOnly": true, "gain": 1, "source": "Fin Sanity.mp3" }
}
```

`uiHover` (several files, cycled) and `playCoinBankDiamond` (the Diamond-tier coin sound) were set up by
hand; the tool's *Use this* writes a single `file` per slot, so using it on `uiHover` would replace the set.

## Adding a new sound (for a future session)

1. Add an entry to `slots.json` (and restart the tool). Use `synth: true` only if `Sound.js` exports a
   `playXxx` function of that exact name that has a synthesized fallback (the "Current synth" button calls it).
2. In `js/Sound.js` add `export function playXxx()` that does `if (sfxOnCooldown('playXxx')) return;` then
   `if (playSample('<slotId>')) return;` followed by the synth fallback (or nothing for a new, sample-only sound).
   `playSample(name, index)` plays the manifest buffer through the SFX gain with the manifest gain.
3. Call it where the event happens (see the wiring list in `CLAUDE.md`, "Recorded Sound Effects & the SFX
   Audition Tool"). Test in a browser by hooking `AudioContext.prototype.createBufferSource` and checking which
   buffers play.

## Variables and Formulas tabs

These edit the game's own source: each variable is a plain numeric literal in `js/Config.js` (or `js/Sound.js`
for the audio levels). Moving a slider / typing a number replaces just that number in the file (comments and
formatting are untouched) and **you reload the game tab to see it**. "Default" is the value in the last git commit
(`git show HEAD:...`), so **Reset** always has somewhere to go back to; `git diff` shows everything you changed.
The game's text descriptions sometimes quote numbers literally and will not update by themselves.

| File | What |
|---|---|
| `tools/sfx/tuning.json` | Which numbers are listed, in which group. A string = one constant in Config.js; `{name, file, label, min, max, step}` = one with overrides; `{deep: NAME, fields: [...], label, step, firstIndex}` = every numeric literal inside that table/array (optionally only the named properties). |
| `tools/sfx/tuning.mjs` | The engine: parses the source with acorn, finds each literal's exact range, lists values/defaults/slider ranges, sets and resets values. Only plain numeric literals are editable; anything computed from other constants is skipped (and reported in the "Skipped" note). |
| `tools/sfx/tuning.js` | The two tabs' UI, and the formula definitions (`FORMULAS`) with their live-table code. |

Restart the tool server after editing `tuning.json`, `tuning.mjs` or `server.mjs`; `tuning.js` and `index.html` load fresh on reload.

### Adding a variable
Add its name (or a `deep` entry) to a group in `tuning.json` and restart the tool. It must be a plain number in the source. If a value is derived from other numbers in code (like turret power per second, now computed in Config.js from shots/sec x power per shot) make the *inputs* the literals instead.

### Adding a formula
Add an object to `FORMULAS` in `tuning.js`: `id`, `title`, `formula` (text), `note`, `params` (variable ids to show sliders for; ids are `NAME` for a constant or `NAME.path.segments`, e.g. `SPECIES.guppy.cost`), optional `inputs` (extra number/select controls that are not game values), and `render(inputs)` returning an HTML string (use the `tbl()` helper and `V(id)` to read current slider values). Keep the math identical to the game code it mirrors, and say in `note` what is ignored.

## Text tab

Like the Variables tab, but for words. `text.mjs` scans the game's own source with acorn (and `index.html` with a small tag tokenizer), lists the strings a player reads, and writes an edited string back by replacing just that literal's character range (comments, quoting style and formatting around it are untouched; quotes, backslashes and newlines are escaped for you). "Was" is the string in the last git commit, so Reset always has somewhere to go back to. **Reload the game tab to see an edit.** Nothing is cached in the game; the tab never touches game logic or physics.

| File | What |
|---|---|
| `tools/sfx/text.json` | What counts as text and how it is grouped: the text-bearing property names (`textKeys`), calls/assignments that take text (`textCalls`, `textProps`), things never to list (`denyCalls`, `denyProps`, `denyKeys`), which constants are chat messages (`messageDecl`), and the tab's groups (matched by file, declaration name or call context; first match wins, the rest land in "Other in-game text"). |
| `tools/sfx/text.mjs` | The engine: `listText()`, `setText(id, value, base)`, `resetText(id)`. |
| `tools/sfx/text.js` | The tab's UI (groups are built lazily when opened; there are 800+ texts). |

- **What is listed.** Table fields (`name`, `description`, `desc`, `label`, `text`, ... in `SPECIES`, `BUILDING_TYPES`, `SCIENCE_LAB_UPGRADES`, `ACHIEVEMENTS`, `WORLD_RULES`, `TUTORIAL_FLOWS`, ...), every `*_MESSAGE(S)` constant and anything passed to a `push*Notification`, text assigned to `textContent`/`innerHTML`/`title`/..., text passed to `setText`/`createPickupText`/`showBuildError`/..., and the static text and tooltips in `index.html`. Colours, CSS/SVG strings, selectors, class lists, reason codes and developer messages are filtered out.
- **`${ }` parts.** A template literal with `${...}` in it is shown as written; the game fills those parts in while it runs. The tab refuses an edit that adds, removes, reorders or changes one (it would change the code). A template with no `${}` is shown as plain text.
- **Ids.** Table strings are addressed by path (`Config:SPECIES.guppy.description`); strings inside functions by `file:function/context#n`; `index.html` by `html:#nearest-id#n`. Uncommitted code changes can renumber the `#n` of a function's strings, so "Was"/Reset pair strings with the last commit by content (see `pairWithHead`) instead of by number: an edited string still pairs with its original, and a newly added one shows as "new (not committed)".
- **Safety.** Every save re-parses the file (JS with acorn, HTML with the tokenizer) and refuses anything that would not parse; each save also sends the text the page believes is current, and is refused if the file changed since (edit in VS Code while the tab is open and nothing gets overwritten). `index.html` text is shown as written (entities such as `&amp;` stay as typed), whitespace runs are collapsed, and `<` is not allowed.
- **Numbers inside text.** Descriptions and chat messages that quote a number do not follow the Variables tab; change both.
- **Commit dialog.** The summary now has a "Text (Text tab)" section listing each changed string old → new, grouped like the tab.

Restart the tool's server after editing `text.json`, `text.mjs`, `server.mjs` or `gitcommit.mjs`; `text.js`, `tuning.js` and `index.html` load fresh on reload.

### Adding text the scanner does not find
Most new strings are picked up automatically (a `description:` in a table, a `*_MESSAGE` constant, `el.textContent = '...'`). If one is missed, add its property name to `textKeys`, its call to `textCalls`, or its assignment target to `textProps` in `text.json`. To move a table into its own group, add a group to `text.json`. If a string is listed that should not be, add the call/property/key to the matching `deny` list.

## Commit to GitHub button

A green **Commit to GitHub** button sits in the header on every tab, with a badge showing how many files have changed since the last commit (it refreshes every few seconds and after each slider/sound edit). Pressing it opens a review dialog: a summary line and details written from what changed (slider edits as "old → new" grouped by Variables group, sound picks/gain changes from `audio/sfx/manifest.json`, and any other changed files), a file list with everything ticked, and **Commit & push**. Nothing is committed until that button is pressed; unticked files are left out. It commits to the current branch and pushes to `origin`. If the push fails (offline, rejected) the commit is kept locally and pressing the button again retries the push. The server side is `tools/sfx/gitcommit.mjs`, the dialog is `tools/sfx/gitcommit.js`.

Note it offers *every* changed file in the repo, not only ones edited through the tool; review the list before confirming. The Variables tab's "default" values move to the new commit afterwards.

## Revert button

A red **Revert** button sits right next to Commit. It opens the same kind of dialog with the same uncommitted files (grouped the same way): tick the ones to throw away, or use *Tick all*. Modified and deleted files go back to exactly what the last commit has. Brand-new files have no earlier version, so reverting one **deletes** it; they sit in their own red group and start unticked. The red button needs a second click (it re-labels itself with the count and expires after 4 seconds) before anything happens, and closing the dialog after a revert reloads the page so the Variables/Audio tabs show the restored values. Only files git currently lists as changed can be touched. The endpoints are `GET /api/git/revert-list` and `POST /api/git/revert` (`gitRevertList`/`gitRevert` in `gitcommit.mjs`); **restart the tool's server after pulling this in**, since `server.mjs` is read once at startup.

Every sound in `Sound.js` now has an Audio-tab card; the synthesized ones play their original sound until you pick a recording (each `playXxx()` tries `playSample('<slotId>')` first).

## Desktop shortcut

`tools/sfx/open-dev-tool.bat` starts this tool's server (port 8081) and the game's (8080) when they are not already running and opens http://localhost:8081. `powershell -File tools/sfx/make-desktop-shortcut.ps1` puts a "Finsanity Dev Tool" shortcut on the desktop that runs it.

## Note: world-tunable scalars
Some Config.js numbers are `export let` (not `const`) because the in-game World Settings window changes them per run (see CLAUDE.md "World Settings"). They are still plain numeric literals, so the Variables tab edits them exactly as before. When adding a new one to the World Settings list, register it in `WORLD_SCALAR_SETTERS`/`WORLD_SCALAR_DEFAULTS` at the bottom of Config.js.

## Layout tab

Visual editing of the **DOM UI** (everything in `index.html` + `style.css`/`nautical.css`: title planks, save-slot / new-game / World Settings / pause / Settings / Controls windows, Shop, Tank, Science Lab, Base Stats, HUD, minimap buttons, toolbar). Not the canvas art (fish, tiles, decor are drawn by code; they are not editable here).

**How it works.** The tool server also serves the game under `/game/` (same origin as the tool, so the tab can reach into the preview iframe; the real game on 8080 is unaffected). The preview page is the real `index.html` plus an inline script that (1) seeds a fixture save into the preview's own localStorage (never your real saves), (2) silences all audio, and (3) loads `layout-host.js`, the in-iframe half of the editor. Pick a **Screen** from the dropdown (presets in `layout-presets.json`: title, save slots, New Game flow, World Settings, HUD, Shop, Tank, Lab, Stats, Pause menu...) and the preview boots, loads the fixture and walks to that screen. Press **Play** to use the game normally (open another panel yourself), **Edit** to select things.

**Editing.** In Edit mode clicks select instead of playing: drag to move, drag a handle to resize, arrow keys nudge 1px (Shift 10px), Alt+click digs through whatever is stacked under the cursor, Esc deselects. The side panel has the element's selector (and chips to apply the edit to *every* element sharing a class, e.g. all `.plank-btn`), Position, Size, font size / color / opacity / Hide, any other CSS property, the element's own text (each text node), the breadcrumb + parent/child/sibling buttons (for click-through layers), an "Elements on screen" id list, and **All changes**. Undo/Redo (Ctrl+Z / Ctrl+Y, also inside the preview) and autosave (500 ms) are built in.

**Where edits are saved** (the game's own source is never edited):

| File | What |
|---|---|
| `css/layout.json` | The source of truth: `{ rules: [ { sel, css: {prop: value}, text: {childNodeIndex: "string"} } ] }`. |
| `css/layout.css` | Generated from the JSON on every save (`sel { prop: value !important; }`). Linked in `index.html` after `nautical.css`, so it wins over both sheets and over inline styles set by code. Empty (just a comment) when there are no overrides. |
| `js/LayoutOverrides.js` | Applies the `text` overrides at game start (fetches `css/layout.json` once). Static `index.html` text only: text the game rebuilds from code is rewritten by the game, so use the Text tab for that. |

Moves use the CSS `translate` property (composes with the element's existing `transform`, works on anything, doesn't disturb the layout around it). Deleting a rule (or Undo) restores the original look; "Reset this rule" / the ✕ in All changes do it per element. Both files show up in the Commit dialog like any other change.

| File | What |
|---|---|
| `tools/sfx/layout.mjs` | Server: `/game/` (the game, with the seed + editor script injected), `GET/POST /api/layout`. Saves are sanitised (`layout-model.js`): unsafe selectors/properties/values (`url(`, `{ } ; < @`, ...) are dropped. |
| `tools/sfx/layout-model.js` | Shared (server, tab, iframe): model shape, sanitiser, JSON -> CSS. |
| `tools/sfx/layout-host.js` | Runs inside the preview: picking, hover/selection overlay, drag/resize/nudge -> CSS patches, live CSS + text, scripted steps. |
| `tools/sfx/layout.js` | The tab: panel, undo/redo, autosave, presets, preview sizing. |
| `tools/sfx/layout-presets.json` | Fixtures + screens. Read on every request (no restart). A screen is `{id, label, fixture?, hold?, steps}`; steps: `{waitFor: sel}`, `{click: sel}`, `{key: 'KeyE'}` (a game hotkey), `{show/hide: sel}`, `{wait: ms}`, `{include: 'otherId'}`. |

**Adding a screen:** add an entry to `layout-presets.json` (copy the "hud" steps via `include` for anything in game, then a hotkey or `click`). The fixture is any save file (`tools/bench/fixtures/stress_raw.json` by default).

**Limits.** Selectors for elements the game builds from code (shop cards, save-slot rows, achievement cards) are positional (`nth-child`), so they can drift if the game's content changes; prefer a class chip ("all N matching .x") for those. Elements the game repositions every frame with inline `left/top` are fine (the override is `translate`, not `left/top`). `!important` rules also beat anything the game sets inline for the same property. Restart the tool server after pulling in `layout.mjs`/`server.mjs`; the rest loads fresh.
