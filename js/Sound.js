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

// A low, grumbly "stomach growl" — a fish crossing into its second, more
// urgent hunger stage (the "!!" indicator) for the first time since it last
// ate enough to drop back below that threshold. Sawtooth for a grittier,
// less musical texture than anything else in this game's SFX palette,
// deliberately distinct from playFishDeath's own sadder, more final
// triangle-wave phrase below.
export function playHunger() {
  playTone(220, 0.09, { type: 'sawtooth', gain: 0.1 }); // A3
  playTone(185, 0.16, { type: 'sawtooth', gain: 0.09, when: 0.08 }); // F#3
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
// Reworked a second time per direct request — the previous pass fixed the
// "staccato/grating" complaint (legato articulation, a warm sine lead) but
// landed too slow/sparse to read as "cute and upbeat... a hero on a new
// adventure" (Stardew Valley's Summer theme, Yoshi's Island, SMW's Special
// World music were the reference points given) — those all share a bouncy,
// skipping rhythm (lots of paired eighth notes, not long held whole notes)
// and a fuller arrangement (a moving bassline, not one note every two bars).
// This pass keeps the legato articulation fix (still 'sine' lead, still a
// long release/near-full note coverage — no staccato gaps reappear) but:
// (1) tempo back up to 128 BPM, a genuine bounce rather than a slow sweep;
// (2) the melody rewritten with dense paired-eighth "hop" phrasing and a
// rising three-phrase call-and-response shape (each phrase answers the last
// a step higher) before a confident low resolve, still pure C major
// pentatonic (no bad-sounding interval possible regardless of order); (3)
// the bass now WALKS — 8 moving hits across the loop instead of 4 static
// ones, a real root-sixth-fifth pattern instead of a single held drone,
// for the "more substantial" fuller low end; (4) a new quiet rhythmic
// "bounce" pulse (a tiny soft square blip on the off-beat of every bass
// hit) layered underneath — the same trick Yoshi's Island/SMW's upbeat
// tracks lean on, a light percussive skip nobody consciously hears as an
// instrument but that makes the whole loop feel like it's hopping forward
// instead of just floating. Scheduled the same way as before: the whole
// loop's notes are converted into absolute `when` offsets up front, then
// the next loop is scheduled via setTimeout timed to the loop's own total
// duration — any timer drift just delays the NEXT loop's first note by a
// few ms, never an audible glitch mid-phrase.
const MUSIC_TEMPO_BPM = 128;
const BEAT_S = 60 / MUSIC_TEMPO_BPM;
// C major pentatonic, ~1.5 octaves: C4 D4 E4 G4 A4 C5 D5 E5 G5 A5
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
// Three answering phrases (each a step higher than the last, a classic
// "call and response climbing" shape) built from dense paired-eighth hops
// with a one-beat landing every 4 notes, then a confident low resolve back
// to the root to close the loop.
const MELODY = [
  // Phrase A — the opening hop, grounded near the root.
  { deg: 0, beats: 0.5 }, { deg: 2, beats: 0.5 }, { deg: 3, beats: 0.5 }, { deg: 5, beats: 0.5 },
  { deg: 6, beats: 1 }, { deg: 5, beats: 0.5 }, { deg: 3, beats: 0.5 }, { deg: 6, beats: 2 },
  // Phrase B — the same hop, answered a step higher.
  { deg: 5, beats: 0.5 }, { deg: 6, beats: 0.5 }, { deg: 7, beats: 0.5 }, { deg: 6, beats: 0.5 },
  { deg: 8, beats: 1 }, { deg: 7, beats: 0.5 }, { deg: 6, beats: 0.5 }, { deg: 7, beats: 2 },
  // Phrase C — a bouncy descending skip-run back down, energetic and busy.
  { deg: 6, beats: 0.5 }, { deg: 5, beats: 0.5 }, { deg: 6, beats: 0.5 }, { deg: 4, beats: 0.5 },
  { deg: 5, beats: 0.5 }, { deg: 3, beats: 0.5 }, { deg: 4, beats: 0.5 }, { deg: 2, beats: 0.5 },
  { deg: 3, beats: 1 }, { deg: 5, beats: 1 },
  // Phrase D — confident resolve, a last little flourish up before landing
  // hard on the root to close the loop cleanly.
  { deg: 3, beats: 0.5 }, { deg: 5, beats: 0.5 }, { deg: 6, beats: 0.5 }, { deg: 8, beats: 0.5 },
  { deg: 7, beats: 1.5 }, { deg: 5, beats: 0.5 }, { deg: 3, beats: 0.5 }, { deg: 0, beats: 3 },
];
// A real walking bass — 8 moving hits (root-sixth-fifth-sixth, twice) across
// the loop instead of 4 static ones, per direct request for "a more
// substantial sound."
const BASS_DEGREES = [0, 4, 3, 4, 0, 3, 4, 3];
const BASS_STEP_BEATS = 3; // spacing between bass hits — dense enough to feel like real movement, not a drone

function scheduleMusicLoop() {
  const audioCtx = ensureContext();
  if (!audioCtx) return;
  let beatCursor = 0;
  for (const note of MELODY) {
    const freq = SCALE[note.deg % SCALE.length] * (note.deg >= SCALE.length ? 2 : 1);
    playTone(freq, note.beats * BEAT_S * 0.97, {
      type: 'sine',
      gain: 0.12,
      attack: 0.015,
      release: 0.16,
      when: beatCursor * BEAT_S,
      destination: musicGain,
    });
    beatCursor += note.beats;
  }
  const totalBeats = beatCursor;
  let bassCursor = 0;
  for (const deg of BASS_DEGREES) {
    playTone(SCALE[deg] / 2, BEAT_S * 1.4, {
      type: 'triangle',
      gain: 0.065,
      attack: 0.015,
      release: 0.22,
      when: bassCursor * BEAT_S,
      destination: musicGain,
    });
    // A soft sustained pad an octave above the bass note — warms out the
    // low end into a fuller chord tone instead of one thin blip, at a low
    // enough gain to sit underneath the lead rather than compete with it.
    playTone(SCALE[deg], BEAT_S * 1.4, {
      type: 'triangle',
      gain: 0.025,
      attack: 0.1,
      release: 0.25,
      when: bassCursor * BEAT_S,
      destination: musicGain,
    });
    // The rhythmic "bounce" — a tiny, quiet square-wave tick on the
    // off-beat between this bass hit and the next, purely percussive
    // texture (not a melodic statement) to give the loop a skipping,
    // forward-hopping pulse.
    playTone(SCALE[5], 0.045, {
      type: 'square',
      gain: 0.03,
      attack: 0.002,
      release: 0.03,
      when: (bassCursor + BASS_STEP_BEATS / 2) * BEAT_S,
      destination: musicGain,
    });
    bassCursor += BASS_STEP_BEATS;
  }
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
