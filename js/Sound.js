// Sound.js — synthesized SFX (still pure Web Audio API oscillators/noise,
// same as ever) + 3 real music tracks (Game/Battle/Boss, per direct
// request — replacing the previous synthesized chiptune background loop
// entirely). The 3 tracks live in audio/ at the repo root — see
// ensureMusicTracks below for how they're loaded/wired/crossfaded.
// Autoplay policies mean the AudioContext (and any <audio> element routed
// through it) can't actually produce sound until a real user gesture —
// main.js calls resumeAudio() from the very first pointerdown/keydown the
// page sees. Forbidden: no gameplay logic — every export here is a
// fire-and-forget side effect a caller triggers at the moment something
// already happened.

import { ALIEN_MUSIC_BATTLE_LEAD_MS } from './Config.js';

let ctx = null;
let musicGain = null;
let sfxGain = null;
let musicStarted = false;

// The 3 real music tracks (see ensureMusicTracks below) and their own
// per-track gain nodes, feeding into the shared musicGain above so the
// Settings volume slider still controls all of them uniformly.
let gameMusicEl = null;
let battleMusicEl = null;
let bossMusicEl = null;
let gameTrackGain = null;
let battleTrackGain = null;
let bossTrackGain = null;
// Whether Battle should currently be the audible one (crossfade target) —
// tracked so setBattleMusicActive can no-op on repeat calls with the same
// value instead of restarting an in-flight ramp every frame it's called
// from main.js's per-tick check.
let battleActive = false;
// Once the end-game boss track has been triggered, it stays the permanent
// audio state for the rest of the session — setBattleMusicActive becomes a
// no-op so a still-alive alien (the boss itself is `type: 'alien'`) can't
// fight the boss track for the music slot.
let bossActive = false;

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

// Silence (and genuinely stop processing) all audio the instant the
// window/tab loses focus, resuming automatically the instant it's back —
// per direct request. AudioContext.suspend()/resume() is the correct
// primitive for this rather than zeroing the gain nodes — it also halts the
// audio graph's actual CPU work while backgrounded, not just its output,
// and needs no separate bookkeeping to restore the right volume afterward
// (setMusicVolume/setSfxVolume's own musicVolume/sfxVolume variables are
// completely untouched by this). A no-op if the context doesn't exist yet
// (nothing to silence before the first real user gesture unlocks it) or is
// already in the target state (switching tabs can fire blur/focus more
// than once in a row in some browsers). Suspending the context silences a
// MediaElementAudioSourceNode's OUTPUT, but — unlike the oscillator-based
// scheduling this file used to do for its background music — does NOT pause
// the underlying <audio> element's own playback clock, which keeps
// advancing on real wall-clock time regardless; that's actually exactly
// what's wanted here, since it means the Game/Battle tracks stay perfectly
// in sync with each other (and with real time) across any blur/focus cycle,
// with no risk of the old "double-scheduled" bug this file's synthesized
// music loop used to have — nothing here is ever scheduled twice.
window.addEventListener('blur', () => {
  if (ctx && ctx.state === 'running') ctx.suspend();
});
window.addEventListener('focus', () => {
  if (ctx && ctx.state === 'suspended') ctx.resume();
});

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
// refuse to run an AudioContext (or play an <audio> element routed through
// one) until a real user gesture, and this is also what starts the Game and
// Battle tracks playing for the first time (see startMusic below).
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

// A small, simple two-note chime — a fish growing from baby to mid-size.
// Deliberately plainer than playGrowToAdult below, since reaching the
// adult stage is the bigger milestone (a Tank Point too, via
// Entities.js's awardTankPoint, which calls playTankPoint independently of
// this pair — the two are separate cues that happen to land on the same
// moment, not a duplicate of each other).
export function playGrowToMid() {
  playTone(880, 0.07, { type: 'sine', gain: 0.1 }); // A5
  playTone(1174.66, 0.09, { type: 'sine', gain: 0.1, when: 0.05 }); // D6
}

// A slightly more elaborate, "magical" sparkle — a fish reaching full adult
// size, whether that's a Mutagen-Paste jump straight from baby or an
// ordinary feed from mid-size. A 3-note ascending phrase (real chord tones,
// not just a scale run) with a soft high shimmer note layered under the
// last one for a touch of sparkle, per direct request ("a slightly more
// magical sound when growing to the adult size").
export function playGrowToAdult() {
  playTone(659.25, 0.06, { type: 'sine', gain: 0.09 }); // E5
  playTone(880, 0.07, { type: 'sine', gain: 0.1, when: 0.06 }); // A5
  playTone(1318.5, 0.12, { type: 'sine', gain: 0.11, when: 0.13 }); // E6
  playTone(1760, 0.16, { type: 'triangle', gain: 0.05, when: 0.15, attack: 0.03, release: 0.1 }); // A6 — a soft shimmer layered under the last note
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

// A quick descending pitch sweep (real oscillator frequency automation, not
// two separate tones) — reads as a punchier "pew" than the fixed-pitch
// playTone building block can produce on its own. Used for the Turret's
// shot below; kept private (not exported) since nothing else needs it yet.
function playSweep(freqFrom, freqTo, duration, { type = 'square', gain = 0.14, when = 0 } = {}) {
  const audioCtx = ensureContext();
  if (!audioCtx) return;
  const start = audioCtx.currentTime + when;
  const end = start + duration;
  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), end);
  const env = audioCtx.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.006);
  env.gain.setValueAtTime(gain, Math.max(start + 0.006, end - 0.02));
  env.gain.linearRampToValueAtTime(0, end);
  osc.connect(env);
  env.connect(sfxGain);
  osc.start(start);
  osc.stop(end + 0.02);
}

// A quick "pew" — a Turret (any tier) firing a shot.
export function playTurretShoot() {
  playSweep(950, 260, 0.08, { type: 'square', gain: 0.1 });
}

// A short, sharp impact — an alien taking a hit (click damage or a landed
// Turret projectile) without dying. Distinct from playAlienDeath below —
// this should read as "hit, still alive," not a defeat.
export function playAlienHit() {
  playNoise(0.05, { gain: 0.09 });
  playTone(180, 0.05, { type: 'sawtooth', gain: 0.08, when: 0.005 });
}

// A bigger descending burst — an alien actually dying. Louder/longer than
// playAlienHit, with a genuine low-end resolve so it reads as "defeated,"
// not just another hit.
export function playAlienDeath() {
  playNoise(0.16, { gain: 0.15 });
  playTone(220, 0.1, { type: 'sawtooth', gain: 0.12, when: 0.02 });
  playTone(110, 0.16, { type: 'sawtooth', gain: 0.1, when: 0.09 });
}

// A soft rising whoosh — any item (coin, Science Bubble, Waste) getting
// pulled into a Processor/Auto-Feeder/Waste Turret's intake. Deliberately
// quiet/short, since this can fire often in a busy factory.
export function playIntake() {
  playSweep(300, 700, 0.07, { type: 'sine', gain: 0.055 });
}

// A soft falling pop — a Processor/Auto-Feeder actually dispensing/
// finishing off with something (the Auto-Feeder's Food output; a
// Processor's Science Bubble finishing its hold — the coin equivalent
// already has its own dedicated playCoinBank blip, so this doesn't also
// fire there, to avoid two sounds landing on one event).
export function playDispense() {
  playTone(880, 0.05, { type: 'sine', gain: 0.08 });
  playTone(660, 0.06, { type: 'sine', gain: 0.07, when: 0.04 });
}

// ---- Background music ----
// Replaced entirely with 3 real tracks, per direct request — the previous
// synthesized chiptune loop (hand-composed melody/chords/bass, all pure
// oscillators) is gone. Game.mp3 plays whenever there's no alien threat;
// Battle.mp3 takes over whenever there is; Boss.mp3 takes over permanently
// once the end-game boss upgrade is purchased. The 3 files live in audio/
// at the repo root (moved there from the project root, where they were
// first added) and are loaded as plain <audio> elements routed through the
// existing WebAudio graph via createMediaElementSource, so the Settings
// panel's music-volume slider (musicGain) and the blur/focus silencing
// above both keep working uniformly across all 3 without any special-casing.
//
// Game and Battle are BOTH always playing, in lockstep, for the entire
// session — only their own gain is what actually changes. Per direct
// spec ("their timings are lined up exactly, so you can switch... with a
// seamless transition"), the two tracks are musically aligned throughout,
// not just at one specific timestamp — keeping both permanently in sync via
// looping playback (rather than pausing one and seeking/starting the other
// on demand) is what actually guarantees that alignment holds at whatever
// moment a crossfade happens to start, with zero risk of drift between the
// two tracks' own loop points ever creeping in. Boss is different by
// design — per direct request ("that music can start immediately, from the
// beginning") it isn't kept synced with anything; it simply starts fresh
// from position 0 the instant it's triggered.
const MUSIC_CROSSFADE_S = ALIEN_MUSIC_BATTLE_LEAD_MS / 1000; // matches the 3-second pre-wave window main.js starts the fade-in from, so Battle reaches full volume right as the wave actually spawns

function ensureMusicTracks() {
  if (gameMusicEl) return;
  gameMusicEl = new Audio('audio/Game.mp3');
  gameMusicEl.loop = true;
  battleMusicEl = new Audio('audio/Battle.mp3');
  battleMusicEl.loop = true;
  bossMusicEl = new Audio('audio/Boss.mp3');
  bossMusicEl.loop = true;

  gameTrackGain = ctx.createGain();
  battleTrackGain = ctx.createGain();
  bossTrackGain = ctx.createGain();
  // Read the current target state rather than hardcoding 0/1 — covers the
  // (unlikely but possible) edge case of setBattleMusicActive/
  // triggerBossMusic having already been called once before the very first
  // user-gesture unlock created these nodes at all.
  gameTrackGain.gain.value = bossActive ? 0 : (battleActive ? 0 : 1);
  battleTrackGain.gain.value = bossActive ? 0 : (battleActive ? 1 : 0);
  bossTrackGain.gain.value = bossActive ? 1 : 0;

  ctx.createMediaElementSource(gameMusicEl).connect(gameTrackGain).connect(musicGain);
  ctx.createMediaElementSource(battleMusicEl).connect(battleTrackGain).connect(musicGain);
  ctx.createMediaElementSource(bossMusicEl).connect(bossTrackGain).connect(musicGain);
}

function startMusic() {
  ensureMusicTracks();
  gameMusicEl.play().catch(() => {});
  battleMusicEl.play().catch(() => {});
  if (bossActive) bossMusicEl.play().catch(() => {});
}

// Called every tick from main.js with whether Battle should currently be the
// audible track (aliens genuinely on screen, OR within
// ALIEN_MUSIC_BATTLE_LEAD_MS of the next wave spawning) — per direct
// request. No-ops on a repeat call with the same value (so calling this
// every single tick doesn't restart the ramp from wherever it currently is
// every frame) and once the boss track has taken over permanently (see
// triggerBossMusic below).
export function setBattleMusicActive(active) {
  if (bossActive || active === battleActive) return;
  battleActive = active;
  if (!ctx || !gameTrackGain || !battleTrackGain) return; // audio not unlocked yet — nothing to ramp
  const now = ctx.currentTime;
  const battleTarget = active ? 1 : 0;
  const gameTarget = active ? 0 : 1;
  // Cancel-then-hold-then-ramp — the standard way to safely retarget a gain
  // ramp that might already be mid-flight (e.g. aliens clearing right as the
  // next wave's own 3-second lead-in begins) without an audible jump/click.
  battleTrackGain.gain.cancelScheduledValues(now);
  battleTrackGain.gain.setValueAtTime(battleTrackGain.gain.value, now);
  battleTrackGain.gain.linearRampToValueAtTime(battleTarget, now + MUSIC_CROSSFADE_S);
  gameTrackGain.gain.cancelScheduledValues(now);
  gameTrackGain.gain.setValueAtTime(gameTrackGain.gain.value, now);
  gameTrackGain.gain.linearRampToValueAtTime(gameTarget, now + MUSIC_CROSSFADE_S);
}

// Called once, the instant the end-game boss upgrade is purchased (UI.js's
// buyLabUpgrade) — per direct request, starts immediately, from the
// beginning, with no fade and no further Game/Battle involvement for the
// rest of the session.
export function triggerBossMusic() {
  if (bossActive) return;
  bossActive = true;
  if (!ctx) return; // shouldn't happen in practice — audio is unlocked well before any Lab purchase is possible
  ensureMusicTracks();
  const now = ctx.currentTime;
  gameTrackGain.gain.cancelScheduledValues(now);
  gameTrackGain.gain.setValueAtTime(0, now);
  battleTrackGain.gain.cancelScheduledValues(now);
  battleTrackGain.gain.setValueAtTime(0, now);
  gameMusicEl.pause();
  battleMusicEl.pause();
  bossTrackGain.gain.value = 1;
  bossMusicEl.currentTime = 0;
  bossMusicEl.play().catch(() => {});
}

// Exported for completeness (e.g. a future mute toggle) — not currently
// wired to any UI control, since none was requested.
export function stopMusic() {
  musicStarted = false;
  if (gameMusicEl) gameMusicEl.pause();
  if (battleMusicEl) battleMusicEl.pause();
  if (bossMusicEl) bossMusicEl.pause();
}
