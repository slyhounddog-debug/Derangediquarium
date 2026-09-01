// Sound.js — synthesized SFX + a looping chiptune-style background track,
// entirely generated via the Web Audio API. No audio files/assets at all:
// real 8-bit console audio was square/triangle/noise wave synthesis in the
// first place, so building "8-bit style" sound this way is the genuine
// article, not a placeholder. Autoplay policies mean the AudioContext can't
// actually produce sound until a real user gesture — main.js calls
// resumeAudio() from the very first pointerdown/keydown the page sees.
// Forbidden: no gameplay logic — every export here is a fire-and-forget
// side effect a caller triggers at the moment something already happened.

let ctx = null;
let musicGain = null;
let sfxGain = null;
let musicStarted = false;
let musicTimer = null;

// Volume sliders in the pause menu's Settings panel (UI.js) call
// setMusicVolume/setSfxVolume below, which need to work even before the
// AudioContext exists yet (a slider drag before the very first user
// gesture that unlocks audio) — these are the source of truth, applied to
// the real gain node once ensureContext() creates it, and re-applied
// directly any time they change after that.
let musicVolume = 0.05; // soft, background — should never fight the SFX for attention
let sfxVolume = 0.22;

function ensureContext() {
  if (ctx) return ctx;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null; // no Web Audio support — every export below just silently no-ops
  ctx = new AudioContextClass();
  musicGain = ctx.createGain();
  musicGain.gain.value = musicVolume;
  musicGain.connect(ctx.destination);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = sfxVolume;
  sfxGain.connect(ctx.destination);
  return ctx;
}

// v is 0-1 — UI.js's Settings sliders call these directly on `input`, so the
// volume updates live while dragging, not just on release.
export function setMusicVolume(v) {
  musicVolume = Math.max(0, Math.min(1, v));
  if (musicGain) musicGain.gain.value = musicVolume;
}
export function setSfxVolume(v) {
  sfxVolume = Math.max(0, Math.min(1, v));
  if (sfxGain) sfxGain.gain.value = sfxVolume;
}
export function getMusicVolume() { return musicVolume; }
export function getSfxVolume() { return sfxVolume; }

// Called from main.js on the very first pointerdown/keydown — browsers
// refuse to run an AudioContext until a real user gesture, and this is also
// what kicks off the looping background music for the first time.
export function resumeAudio() {
  const audioCtx = ensureContext();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (!musicStarted) {
    musicStarted = true;
    startMusic();
  }
}

// One oscillator + a short attack/release gain envelope, the basic unit
// every SFX below is built from. `when` is a delay in seconds from now, so a
// short sequence of notes can be scheduled together without a chain of
// setTimeouts drifting against the audio clock.
function playTone(freq, duration, { type = 'square', gain = 0.2, attack = 0.006, release = 0.06, when = 0, destination = null } = {}) {
  const audioCtx = ensureContext();
  if (!audioCtx) return;
  const start = audioCtx.currentTime + when;
  const end = start + duration;
  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  const env = audioCtx.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(gain, start + attack);
  env.gain.setValueAtTime(gain, Math.max(start + attack, end - release));
  env.gain.linearRampToValueAtTime(0, end);
  osc.connect(env);
  env.connect(destination || sfxGain);
  osc.start(start);
  osc.stop(end + 0.02);
}

// A short burst of white noise instead of a tuned pitch — used for the
// percussive/crunchy SFX (demolish, fish death's final thud) where a clean
// oscillator tone would read as too musical.
function playNoise(duration, { gain = 0.15, when = 0, destination = null } = {}) {
  const audioCtx = ensureContext();
  if (!audioCtx) return;
  const start = audioCtx.currentTime + when;
  const frameCount = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
  const buffer = audioCtx.createBuffer(1, frameCount, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount); // fades out across the burst
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const env = audioCtx.createGain();
  env.gain.setValueAtTime(gain, start);
  env.gain.linearRampToValueAtTime(0, start + duration);
  src.connect(env);
  env.connect(destination || sfxGain);
  src.start(start);
}

// ---- SFX ----
// A cheerful two-note ascending blip — fish and building purchases alike.
export function playPurchase() {
  playTone(523.25, 0.08, { type: 'square', gain: 0.16 }); // C5
  playTone(783.99, 0.1, { type: 'square', gain: 0.16, when: 0.07 }); // G5
}

// A tiny soft "plink" — dropping a food pellet.
export function playFoodPlace() {
  playTone(1046.5, 0.05, { type: 'triangle', gain: 0.1 }); // C6
}

// Deliberately quiet, per direct request — a fish eating (Food or Waste).
export function playEat() {
  playTone(660, 0.05, { type: 'sine', gain: 0.05, attack: 0.002, release: 0.03 });
}

// A soft, low murmur — a fish crossing into its second, more urgent hunger
// stage (the "!!" indicator) for the first time since it last ate enough to
// drop back below that threshold. Reworked per direct report — the
// original sawtooth "stomach growl" read as an alarm rather than a gentle
// nudge ("too aggressive... I'm always looking around for what I did
// wrong"), which is the opposite of the intent (a fish getting hungry is
// routine, not a crisis). Now 'triangle' (smooth, no buzzy harmonics) at a
// notably lower gain, keeping the same soft descending two-note shape so it
// still reads as "this fish wants food" without sounding like something
// broke. playFishDeath below is what should read as the actually bad
// outcome — this stays clearly gentler than that.
export function playHunger() {
  playTone(196, 0.1, { type: 'triangle', gain: 0.06, attack: 0.01, release: 0.06 }); // G3
  playTone(174.61, 0.14, { type: 'triangle', gain: 0.05, attack: 0.01, release: 0.08, when: 0.1 }); // F3
}

// A short descending sad phrase — a fish starving.
export function playFishDeath() {
  playTone(440, 0.13, { type: 'triangle', gain: 0.14 }); // A4
  playTone(370, 0.13, { type: 'triangle', gain: 0.13, when: 0.12 }); // F#4
  playTone(311, 0.22, { type: 'triangle', gain: 0.12, when: 0.24 }); // Eb4
}

// A bright quick double-blip, Mario-coin style — banking a coin.
export function playCoinBank() {
  playTone(988, 0.05, { type: 'square', gain: 0.15 }); // B5
  playTone(1318.5, 0.14, { type: 'square', gain: 0.15, when: 0.05 }); // E6
}

// A solid low "thunk" — placing a building.
export function playBuildPlace() {
  playTone(196, 0.09, { type: 'square', gain: 0.14 }); // G3
  playTone(147, 0.1, { type: 'square', gain: 0.1, when: 0.05 }); // D3
}

// A short crunch — demolishing a building.
export function playDemolish() {
  playNoise(0.12, { gain: 0.14 });
  playTone(130, 0.08, { type: 'sawtooth', gain: 0.08, when: 0.02 });
}

// A rising 4-note arpeggio — buying a Tank Upgrade.
export function playUpgrade() {
  const notes = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
  notes.forEach((freq, i) => playTone(freq, 0.09, { type: 'square', gain: 0.14, when: i * 0.07 }));
}

// A soft, muted "thud" — a fish's drop cycle completed but its resource
// (coin or Science) was already at its active cap, so nothing was actually
// produced. Deliberately dull and low, sliding down rather than up, so it
// reads as "nope, capped" rather than any of this game's other "you got
// something" blips — the one SFX in the game meant to feel like a non-event.
export function playProductionBlocked() {
  playTone(220, 0.05, { type: 'triangle', gain: 0.09 }); // A3
  playTone(164.81, 0.09, { type: 'triangle', gain: 0.07, when: 0.045 }); // E3
}

// A small sparkle — a fish reaching adulthood and awarding a Tank Point.
export function playTankPoint() {
  playTone(1174.7, 0.06, { type: 'triangle', gain: 0.12 }); // D6
  playTone(1567.98, 0.09, { type: 'triangle', gain: 0.12, when: 0.05 }); // G6
}

// A soft rising blip — opening a panel (Shop, Tank Upgrades, pause menu, the
// electricity HUD's graph popup) or switching into a pause-menu sub-tab
// (Settings). Deliberately gentler/quieter than playPurchase's own rising
// blip — this fires on nearly every click in this game's UI chrome, so it
// needs to stay unobtrusive rather than compete for attention.
export function playPanelOpen() {
  playTone(659.25, 0.05, { type: 'sine', gain: 0.09 }); // E5
  playTone(880, 0.07, { type: 'sine', gain: 0.09, when: 0.04 }); // A5
}

// The falling mirror of playPanelOpen — closing a panel or backing out of a
// pause-menu sub-tab.
export function playPanelClose() {
  playTone(659.25, 0.05, { type: 'sine', gain: 0.08 }); // E5
  playTone(493.88, 0.07, { type: 'sine', gain: 0.08, when: 0.04 }); // B4
}

// ---- Background music ----
// Reworked a third time, per direct request ("I hate it... more melodic,
// upbeat and adventurous feeling, with more substance, and no random
// clicks in the song"). The "random clicks" were almost certainly the
// previous version's own rhythmic "bounce" pulse — a bare, fast-attack
// square-wave tick layered under the bass, described in that version's own
// comment as exactly that ("a tiny... square-wave tick"). It's gone
// entirely this time, not just quieted — nothing in this track is a bare
// percussive blip any more, only tuned notes.
//
// The bigger change is real harmonic "substance": the previous two passes
// were melody-plus-single-bass-note, built entirely off one pentatonic
// scale so nothing could ever clash. This version is hand-composed (never
// randomized) over an actual I-V-vi-IV chord progression (C-G-Am-F,
// repeated twice across an 8-bar loop) — the single most common
// "hopeful/adventurous" progression in game and pop music (it's the
// backbone of a huge fraction of upbeat anthems) — using the full C major
// scale rather than just its pentatonic subset, so the melody can leap
// along real chord tones (full triads, not just neighboring scale steps)
// for a much more "fanfare" contour: e.g. bar 1 arpeggiates straight up the
// C major triad, bar 7 leaps up to the loop's highest note (A5) right
// before the final turnaround. Three real, independent voices now play
// every bar: the lead melody, a moving root-then-fifth bass line (a classic
// "oom-pah" pattern, not a static drone), and a soft sustained pad holding
// the FULL triad (root+third+fifth) underneath — that pad is what actually
// makes a chord change audible as a chord change, not just a bass note
// change. All three stay 'sine'/'triangle' (never 'square' at a fast
// attack) specifically to keep everything smooth — a square wave's sharp
// edges are what read as "clicky" at a short, fast-attack duration. Scheduled
// the same way as every prior version: the whole loop's notes are converted
// into absolute `when` offsets up front, then the next loop is scheduled via
// setTimeout timed to the loop's own total duration, so any timer drift only
// ever delays the NEXT loop's first note by a few ms, never an audible glitch
// mid-phrase.
const MUSIC_TEMPO_BPM = 132;
const BEAT_S = 60 / MUSIC_TEMPO_BPM;
const BAR_BEATS = 4;
// Full C major scale across 2+ octaves (not just the pentatonic subset) —
// index 0 = C4 ... index 14 = C6. Every melody/chord note below is chosen
// deliberately against the chord progression, so using the full scale (with
// its 4th/7th degrees available) carries no dissonance risk the way
// generating notes programmatically would.
const SCALE = [
  261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, // C4 D4 E4 F4 G4 A4 B4
  523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5, // C5 D5 E5 F5 G5 A5 B5 C6
];
// I-V-vi-IV, repeated twice across the loop — [root, third, fifth] as SCALE
// indices. The classic "hopeful anthem" progression; F -> C across the loop
// boundary (bar 8 back to bar 1) is a plagal ("amen") cadence, which is why
// the loop point itself feels like a satisfying resolve rather than a hard
// cut.
const CHORDS = {
  C: [0, 2, 4],
  G: [4, 6, 8],
  Am: [5, 7, 9],
  F: [3, 5, 7],
};
const CHORD_PROGRESSION = ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'];
// One bar (4 beats) of melody per chord above, chosen to outline that
// chord's own triad on the strong beats — an ascending arpeggio hop over
// the opening C, a full run up to the octave over G, a slightly more
// syncopated minor-tinged bar over Am, climbing to a high point over F, a
// mirrored/descending echo of bar 1 for the "return" (bar 5), then a real
// climax (A5, the loop's highest note) over the second Am before a
// four-note descending close leads back into the loop.
const MELODY_BARS = [
  [{ deg: 0, beats: 0.5 }, { deg: 2, beats: 0.5 }, { deg: 4, beats: 0.5 }, { deg: 7, beats: 0.5 }, { deg: 9, beats: 0.5 }, { deg: 7, beats: 0.5 }, { deg: 4, beats: 0.5 }, { deg: 2, beats: 0.5 }],
  [{ deg: 4, beats: 0.5 }, { deg: 6, beats: 0.5 }, { deg: 8, beats: 0.5 }, { deg: 11, beats: 0.5 }, { deg: 8, beats: 0.5 }, { deg: 6, beats: 0.5 }, { deg: 4, beats: 1 }],
  [{ deg: 5, beats: 0.5 }, { deg: 7, beats: 0.5 }, { deg: 9, beats: 0.5 }, { deg: 7, beats: 0.5 }, { deg: 5, beats: 0.5 }, { deg: 2, beats: 0.5 }, { deg: 3, beats: 0.5 }, { deg: 5, beats: 0.5 }],
  [{ deg: 3, beats: 1 }, { deg: 5, beats: 0.5 }, { deg: 7, beats: 0.5 }, { deg: 10, beats: 1 }, { deg: 7, beats: 0.5 }, { deg: 5, beats: 0.5 }],
  [{ deg: 7, beats: 0.5 }, { deg: 9, beats: 0.5 }, { deg: 11, beats: 0.5 }, { deg: 9, beats: 0.5 }, { deg: 7, beats: 0.5 }, { deg: 4, beats: 0.5 }, { deg: 2, beats: 0.5 }, { deg: 0, beats: 0.5 }],
  [{ deg: 4, beats: 0.5 }, { deg: 6, beats: 0.5 }, { deg: 8, beats: 0.5 }, { deg: 6, beats: 0.5 }, { deg: 4, beats: 1 }, { deg: 2, beats: 1 }],
  [{ deg: 5, beats: 0.5 }, { deg: 7, beats: 0.5 }, { deg: 9, beats: 0.5 }, { deg: 12, beats: 0.5 }, { deg: 9, beats: 0.5 }, { deg: 7, beats: 0.5 }, { deg: 5, beats: 1 }],
  [{ deg: 10, beats: 0.5 }, { deg: 7, beats: 0.5 }, { deg: 5, beats: 0.5 }, { deg: 3, beats: 0.5 }, { deg: 5, beats: 1 }, { deg: 3, beats: 1 }],
];

function scheduleMusicLoop() {
  const audioCtx = ensureContext();
  if (!audioCtx) return;
  let beatCursor = 0;
  for (const bar of MELODY_BARS) {
    for (const note of bar) {
      playTone(SCALE[note.deg], note.beats * BEAT_S * 0.97, {
        type: 'sine',
        gain: 0.13,
        attack: 0.015,
        release: 0.16,
        when: beatCursor * BEAT_S,
        destination: musicGain,
      });
      beatCursor += note.beats;
    }
  }
  const totalBeats = beatCursor;

  CHORD_PROGRESSION.forEach((chordName, barIndex) => {
    const [rootIdx, thirdIdx, fifthIdx] = CHORDS[chordName];
    const barStart = barIndex * BAR_BEATS * BEAT_S;

    // Bass: a real "oom-pah" — the root on beat 1 (the longer, anchoring
    // hit) and the fifth on beat 3 (shorter), one octave down.
    playTone(SCALE[rootIdx] / 2, BEAT_S * 1.6, {
      type: 'triangle', gain: 0.09, attack: 0.012, release: 0.22, when: barStart, destination: musicGain,
    });
    playTone(SCALE[fifthIdx] / 2, BEAT_S * 1.0, {
      type: 'triangle', gain: 0.07, attack: 0.012, release: 0.18, when: barStart + 2 * BEAT_S, destination: musicGain,
    });

    // The pad: the full triad, held for nearly the whole bar at a low
    // gain — this is what makes each chord change actually read as a chord
    // change (a harmony shift) rather than just the bass note moving.
    for (const idx of [rootIdx, thirdIdx, fifthIdx]) {
      playTone(SCALE[idx], BAR_BEATS * BEAT_S * 0.95, {
        type: 'triangle', gain: 0.028, attack: 0.12, release: 0.3, when: barStart, destination: musicGain,
      });
    }
  });

  musicTimer = setTimeout(scheduleMusicLoop, totalBeats * BEAT_S * 1000);
}

function startMusic() {
  scheduleMusicLoop();
}

// Exported for completeness (e.g. a future mute toggle) — not currently
// wired to any UI control, since none was requested.
export function stopMusic() {
  if (musicTimer !== null) { clearTimeout(musicTimer); musicTimer = null; }
  musicStarted = false;
}
