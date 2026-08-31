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

function ensureContext() {
  if (ctx) return ctx;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null; // no Web Audio support — every export below just silently no-ops
  ctx = new AudioContextClass();
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.05; // soft, background — should never fight the SFX for attention
  musicGain.connect(ctx.destination);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.22;
  sfxGain.connect(ctx.destination);
  return ctx;
}

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

// A small sparkle — a fish reaching adulthood and awarding a Tank Point.
export function playTankPoint() {
  playTone(1174.7, 0.06, { type: 'triangle', gain: 0.12 }); // D6
  playTone(1567.98, 0.09, { type: 'triangle', gain: 0.12, when: 0.05 }); // G6
}

// ---- Background music ----
// A short looping pentatonic melody (no bad-sounding intervals possible,
// regardless of note order — an easy way to guarantee something "cute" and
// harmonious without hand-composing a real tune), soft triangle-wave lead
// over a very quiet square-wave bass note per bar. Scheduled by converting
// the whole loop's notes into absolute `when` offsets up front, then
// rescheduling the next loop via setTimeout timed to the loop's own total
// duration — simple, and any timer drift just means the NEXT loop's first
// note starts a few ms late, not an audible glitch.
const MUSIC_TEMPO_BPM = 132;
const BEAT_S = 60 / MUSIC_TEMPO_BPM;
// C major pentatonic, one octave: C4 D4 E4 G4 A4 C5 D5 E5
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
// Scale-degree indices (0-7) and beat-lengths for one 8-bar phrase — simple,
// mostly stepwise-and-skip motion so it reads as an actual little tune
// rather than a random note generator.
const MELODY = [
  { deg: 5, beats: 1 }, { deg: 4, beats: 1 }, { deg: 3, beats: 1 }, { deg: 4, beats: 1 },
  { deg: 5, beats: 1 }, { deg: 5, beats: 1 }, { deg: 5, beats: 2 },
  { deg: 7, beats: 1 }, { deg: 6, beats: 1 }, { deg: 5, beats: 1 }, { deg: 4, beats: 1 },
  { deg: 3, beats: 1 }, { deg: 3, beats: 1 }, { deg: 3, beats: 2 },
  { deg: 4, beats: 1 }, { deg: 5, beats: 1 }, { deg: 4, beats: 1 }, { deg: 3, beats: 1 },
  { deg: 2, beats: 1 }, { deg: 4, beats: 1 }, { deg: 0, beats: 2 },
  { deg: 3, beats: 1 }, { deg: 5, beats: 1 }, { deg: 7, beats: 1 }, { deg: 5, beats: 1 },
  { deg: 4, beats: 1 }, { deg: 3, beats: 1 }, { deg: 0, beats: 2 },
];
const BASS_DEGREES = [0, 3, 4, 3]; // one bass note every 2 bars (8 beats), root-ish walking pattern

function scheduleMusicLoop() {
  const audioCtx = ensureContext();
  if (!audioCtx) return;
  let beatCursor = 0;
  for (const note of MELODY) {
    const freq = SCALE[note.deg % SCALE.length] * (note.deg >= SCALE.length ? 2 : 1);
    playTone(freq, note.beats * BEAT_S * 0.82, {
      type: 'triangle',
      gain: 0.1,
      attack: 0.01,
      release: 0.05,
      when: beatCursor * BEAT_S,
      destination: musicGain,
    });
    beatCursor += note.beats;
  }
  const totalBeats = beatCursor;
  let bassCursor = 0;
  for (const deg of BASS_DEGREES) {
    playTone(SCALE[deg] / 2, BEAT_S * 1.6, {
      type: 'square',
      gain: 0.05,
      attack: 0.01,
      release: 0.15,
      when: bassCursor * BEAT_S,
      destination: musicGain,
    });
    bassCursor += 8;
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
