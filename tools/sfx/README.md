# SFX audition tool

A small local web tool for finding, trimming and levelling the game's recorded sound effects.
It is a dev tool only; the game never loads it.

```
npm run sfx          # or: node tools/sfx/server.mjs
# -> http://localhost:8081
```

It is a separate server from the game's (`server.js`, port 8080) because it has file-writing endpoints,
and so it can be restarted without touching the game. **Restart it after editing `slots.json` or
`server.mjs`** (they are read once at startup); `index.html` is served fresh on every reload.

## Using it

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
