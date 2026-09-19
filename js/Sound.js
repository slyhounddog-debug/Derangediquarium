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

import { ALIEN_MUSIC_BATTLE_LEAD_MS, BOSS_MUSIC_FADE_OUT_MS, BOSS_MUSIC_FADE_IN_START_MS, BOSS_MUSIC_FADE_IN_MS } from './Config.js';

let ctx = null;
let musicGain = null;
let sfxGain = null;
let musicStarted = false;

// ---- Music post-processing chain: musicGain -> musicLowpassFilter ->
// musicHighpassFilter -> ctx.destination ---- See setMusicUnderwaterMuffle/
// setMusicSpeedBoost below. Both effects apply uniformly to whichever of the
// 3 tracks is actually audible right now (Game/Battle/Boss all feed the same
// shared musicGain upstream of this), so neither needs to know or care which
// one that is.
let musicLowpassFilter = null;
let musicHighpassFilter = null;
let wantMuffle = false; // desired state, reapplied once the nodes actually exist
let wantSpeedBoost = false;
// Per direct request ("when time is paused, add a muffle effect to the
// music, so it sounds like it's under water") — a lowpass sweeps down to
// this cutoff; fully open (no audible filtering) is MUSIC_FILTER_OPEN_HZ.
const MUSIC_FILTER_MUFFLED_HZ = 550;
const MUSIC_FILTER_OPEN_HZ = 20000;
// Per direct request ("adjust the 2x speed music filter to just be a high
// pass filter at 1200hz on the music instead of the pitch raise", later
// tuned down to 1000hz) — replaces the previous AudioWorklet-based granular
// pitch shifter entirely. Fully open (no audible filtering) is as low as a
// highpass filter's cutoff can meaningfully go without clipping into DC.
const MUSIC_HIGHPASS_ACTIVE_HZ = 1000;
const MUSIC_HIGHPASS_OPEN_HZ = 20;
// Per direct request ("let a 10% increase of music speed naturally raise
// the pitch, just when the time is sped up", tuned down to 5% then 3%) — a
// genuine <audio> playbackRate change (see ensureMusicTracks'
// preservesPitch = false, which is what makes a playbackRate change
// actually shift pitch instead of the browser's default time-stretch-only
// behavior).
const MUSIC_SPEED_BOOST_RATE = 1.03;
// How quickly the underwater-muffle lowpass ramps to its new target —
// smooth enough to avoid an audible pop/step, the standard `setTargetAtTime`
// "time constant" shape (not a linear duration — ~5x this value is roughly
// how long the ramp visually/audibly finishes).
const MUSIC_EFFECT_RAMP_S = 0.5;
// How long the 2x-speed effect (highpass filter + playbackRate, both ramped
// together in setMusicSpeedBoost below) takes to fade — as an exact linear
// duration, not a `setTargetAtTime` time constant, since "the fade out time"
// needs to be a literal, precise span. Per direct request, fading OUT
// (dropping back to normal) is quicker than fading in.
const MUSIC_SPEED_FADE_IN_MS = 800;
const MUSIC_SPEED_FADE_OUT_MS = 500;
let speedRampRafId = null;

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
// directly any time they change after that. musicVolume/sfxVolume are the
// slider's own 0-1 FRACTION (what the slider displays, 0.5 = "50%"), not the
// final gain — see MUSIC_VOLUME_MAX_GAIN/SFX_VOLUME_MAX_GAIN below for the
// separate scale-down applied on top. Per direct request, both start at 50%.
let musicVolume = 0.5;
let sfxVolume = 0.5;
// Per direct request ("the max loudness the music and sound effects can get
// are 30% quieter than they are now") — a slider at 100% used to map
// straight to gain 1.0 (the loudest this app could ever get); now it maps to
// 0.7, so the whole achievable range (slider at 0-100%) is uniformly 30%
// quieter than it used to be, not just the new 50%-by-default starting
// point. Applied as a multiplier in setMusicVolume/setSfxVolume and in
// ensureContext's own initial gain-node setup below, so both paths (a slider
// drag, and the very first AudioContext creation) always agree.
const MUSIC_VOLUME_MAX_GAIN = 0.7;
const SFX_VOLUME_MAX_GAIN = 0.7;

function ensureContext() {
  if (ctx) return ctx;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null; // no Web Audio support — every export below just silently no-ops
  ctx = new AudioContextClass();
  musicGain = ctx.createGain();
  musicGain.gain.value = musicVolume * MUSIC_VOLUME_MAX_GAIN;
  musicLowpassFilter = ctx.createBiquadFilter();
  musicLowpassFilter.type = 'lowpass';
  musicLowpassFilter.frequency.value = wantMuffle ? MUSIC_FILTER_MUFFLED_HZ : MUSIC_FILTER_OPEN_HZ; // picks up any setMusicUnderwaterMuffle call that landed before the very first user gesture created this context
  musicHighpassFilter = ctx.createBiquadFilter();
  musicHighpassFilter.type = 'highpass';
  musicHighpassFilter.frequency.value = wantSpeedBoost ? MUSIC_HIGHPASS_ACTIVE_HZ : MUSIC_HIGHPASS_OPEN_HZ; // picks up any setMusicSpeedBoost call that landed before the very first user gesture created this context
  musicGain.connect(musicLowpassFilter);
  musicLowpassFilter.connect(musicHighpassFilter);
  musicHighpassFilter.connect(ctx.destination);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = sfxVolume * SFX_VOLUME_MAX_GAIN;
  sfxGain.connect(ctx.destination);
  return ctx;
}

// Per direct request ("when time is paused, add a muffle effect to the
// music, so it sounds like it's under water"). A smooth setTargetAtTime
// ramp (not an instant jump) so toggling Pause Time doesn't pop.
export function setMusicUnderwaterMuffle(active) {
  wantMuffle = active;
  if (!musicLowpassFilter) return; // no AudioContext yet (pre-first-gesture) — applied once ensureContext runs, via the same wantMuffle flag main.js re-reads through UI.js's own toggle
  musicLowpassFilter.frequency.setTargetAtTime(active ? MUSIC_FILTER_MUFFLED_HZ : MUSIC_FILTER_OPEN_HZ, ctx.currentTime, MUSIC_EFFECT_RAMP_S);
}

// Per direct request ("when time is at 2x speed... a high pass filter at
// 1000hz on the music... let a 3% increase of music speed naturally raise
// the pitch... have the effects fade in/out", with fade-out specifically
// tuned to 0.5s). Two fades run together, both using the same exact-duration
// linear ramp (MUSIC_SPEED_FADE_IN_MS/MUSIC_SPEED_FADE_OUT_MS) so the filter
// and the pitch/speed change move in lockstep: the highpass filter's own
// AudioParam ramp, and a manual rAF-driven ramp of every music <audio>
// element's playbackRate (see rampMusicPlaybackRate below —
// HTMLMediaElement.playbackRate has no AudioParam equivalent to lean on).
export function setMusicSpeedBoost(active) {
  wantSpeedBoost = active;
  const fadeMs = active ? MUSIC_SPEED_FADE_IN_MS : MUSIC_SPEED_FADE_OUT_MS;
  if (musicHighpassFilter) {
    const now = ctx.currentTime;
    const target = active ? MUSIC_HIGHPASS_ACTIVE_HZ : MUSIC_HIGHPASS_OPEN_HZ;
    // cancel-then-hold-then-ramp — safely retargets a ramp that might
    // already be mid-flight (toggling 2x speed again before the previous
    // fade finished) without an audible jump/click.
    musicHighpassFilter.frequency.cancelScheduledValues(now);
    musicHighpassFilter.frequency.setValueAtTime(musicHighpassFilter.frequency.value, now);
    musicHighpassFilter.frequency.linearRampToValueAtTime(target, now + fadeMs / 1000);
  }
  rampMusicPlaybackRate(active ? MUSIC_SPEED_BOOST_RATE : 1.0, fadeMs);
}

// Smoothly ramps Game/Battle/Boss's playbackRate together, in lockstep —
// each animation frame reads every track's CURRENT rate and nudges all of
// them by the same interpolated step, so they're always set to numerically
// identical values at every point along the fade. That's what keeps Game and
// Battle in sync through the transition itself (resyncMusicTracks' own
// periodic currentTime check below is a safety net for any residual drift,
// not what's doing the syncing here). A no-op before ensureMusicTracks has
// run — the elements' own initial playbackRate (set there) already picks up
// whatever wantSpeedBoost was at that point.
function rampMusicPlaybackRate(target, durationMs) {
  if (speedRampRafId) cancelAnimationFrame(speedRampRafId);
  const tracks = [gameMusicEl, battleMusicEl, bossMusicEl].filter(Boolean);
  if (!tracks.length) return;
  const startRates = tracks.map((el) => el.playbackRate);
  const startTime = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - startTime) / durationMs);
    tracks.forEach((el, i) => { el.playbackRate = startRates[i] + (target - startRates[i]) * t; });
    speedRampRafId = t < 1 ? requestAnimationFrame(step) : null;
  };
  speedRampRafId = requestAnimationFrame(step);
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
  if (musicGain) musicGain.gain.value = musicVolume * MUSIC_VOLUME_MAX_GAIN;
}
export function setSfxVolume(v) {
  sfxVolume = Math.max(0, Math.min(1, v));
  if (sfxGain) sfxGain.gain.value = sfxVolume * SFX_VOLUME_MAX_GAIN;
}
export function getMusicVolume() { return musicVolume; }
export function getSfxVolume() { return sfxVolume; }

// Called from main.js on the very first pointerdown/keydown anywhere on the
// page — browsers refuse to run an AudioContext at all until a real user
// gesture, so this exists purely to unlock it early (a silent no-op if
// nothing's scheduled to play yet). Per direct request, this deliberately
// does NOT start the Game/Battle music itself any more — clicking Settings
// or Help on the start screen used to count as "the first gesture" and
// start the music before the player had even pressed Start. Starting the
// actual music is startGameMusic's own job now, called only from the real
// Start/Continue buttons (see main.js's initStartScreen callback).
export function resumeAudio() {
  const audioCtx = ensureContext();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// Called specifically when the player presses Start or Continue on the
// start screen — the one and only thing that should ever start the Game/
// Battle music loop. Still resumes the context itself too (harmless if
// resumeAudio already did, and covers the case where THIS is the very
// first gesture the page has seen at all, since a button click is a real
// user gesture in its own right). musicStarted guards startMusic() itself
// so a repeat call (Continue after an earlier Start, however that'd happen)
// is a safe no-op.
export function startGameMusic() {
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
// Per direct report ("when the tab/window isn't focused, it's stacking the
// turret shot sound effects so that when you click back to focus the
// window, they all play at once, really loud") — the real root cause: the
// window 'blur' handler above suspends the AudioContext, and a suspended
// context's own `currentTime` FREEZES at the moment it suspended (it does
// NOT keep advancing with real wall-clock time) while the game's own
// simulation keeps right on running in the background. Every SFX call made
// while backgrounded — playTurretShoot included, but genuinely any of
// them — was still computing `start = audioCtx.currentTime + when` off
// that frozen clock, so a whole background session's worth of sounds all
// landed at (near enough) the exact same scheduled instant; the moment
// 'focus' resumes the context, that entire backlog becomes "now" all at
// once. The turret shot cap (MAX_CONCURRENT_TURRET_SHOTS, below) didn't
// help either — its own release timer is a real setTimeout, which keeps
// ticking on wall-clock time regardless of the suspended AudioContext, so
// it kept freeing up "slots" throughout the whole backgrounded period.
// Fixed at the one shared root every tone/noise-based SFX in this file
// already funnels through: if the context isn't actually `'running'` right
// now, skip scheduling anything at all rather than queuing it up to burst
// later — a sound the player can't hear anyway (this tab has no audio
// output while backgrounded) doesn't need to be preserved for playback
// once they return, and this is the only way to guarantee nothing skewed
// by the frozen clock ever gets scheduled in the first place.
function playTone(freq, duration, { type = 'square', gain = 0.2, attack = 0.006, release = 0.06, when = 0, destination = null } = {}) {
  const audioCtx = ensureContext();
  if (!audioCtx || audioCtx.state !== 'running') return;
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
  if (!audioCtx || audioCtx.state !== 'running') return; // see playTone's own comment on why
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
// A cheerful two-note ascending blip — buying a fish.
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

// A distinct, harsher death sound for a fish an alien actually finishes off
// — per direct request ("a separate sound effect when the fish is killed by
// an alien"), so a starved fish and an alien-killed fish don't share the
// exact same cue. Built from a sharp noise burst (echoing playAlienHit/
// playAlienDeath's own noise-based "impact" language, since this death is
// itself the alien's doing) plus a lower, more sawtooth-buzzy descending
// phrase than playFishDeath's own gentler triangle-wave one, so it reads as
// more violent/sudden rather than a slow fade-out.
export function playFishKilledByAlien() {
  playNoise(0.07, { gain: 0.13 });
  playTone(330, 0.1, { type: 'sawtooth', gain: 0.12, when: 0.02 }); // E4
  playTone(220, 0.16, { type: 'sawtooth', gain: 0.11, when: 0.13 }); // A3
  playTone(164.81, 0.24, { type: 'sawtooth', gain: 0.1, when: 0.26 }); // E3
}

// A bright quick double-blip, Mario-coin style — banking a coin.
export function playCoinBank() {
  playTone(988, 0.05, { type: 'square', gain: 0.15 }); // B5
  playTone(1318.5, 0.14, { type: 'square', gain: 0.15, when: 0.05 }); // E6
}

// A solid ascending "thunk" — placing a building. Reworked per direct
// report ("sounds negative... change it to sound like a good thing instead
// of a bad thing happened") — the original version descended in pitch (G3
// then D3), which read as deflating, the opposite of the intended "purchase
// confirmed" feel. Keeps the same low, chunky square-wave mechanical
// character (still distinct from playPurchase's own brighter, higher fish
// blip) but climbs up a fourth instead of dropping a fifth — the same
// "rising pitch reads as a good outcome" language playPurchase/playUpgrade
// already use elsewhere in this file.
export function playBuildPlace() {
  playTone(196, 0.08, { type: 'square', gain: 0.13 }); // G3
  playTone(261.63, 0.12, { type: 'square', gain: 0.15, when: 0.06 }); // C4
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

// A clear "denied" buzz — attempting to buy something (Food, a fish, a
// building) without enough money. Per direct request, paired with
// UI.js's flashMoneyInsufficient (which used to only shake the money
// readout red with no sound at all). A short two-note descending sawtooth
// buzz, deliberately harsher/more "error" than playProductionBlocked below
// — this fires on a genuine failed ACTION (a purchase attempt that did
// nothing), where that one fires on a passive production cycle quietly
// having nowhere to put its output.
export function playInsufficientFunds() {
  playTone(196, 0.09, { type: 'sawtooth', gain: 0.11 }); // G3
  playTone(146.83, 0.13, { type: 'sawtooth', gain: 0.1, when: 0.08 }); // D3
}

// A soft, muted "thud" — a fish's drop cycle completed but its resource
// (coin or Science) was already at its active cap, so nothing was actually
// produced. Deliberately dull and low, sliding down rather than up, so it
// reads as "nope, capped" rather than any of this game's other "you got
// something" blips. Made noticeably more obvious per direct report/request
// ("change it to a more obvious sound effect") — the original two-note
// version was easy to miss under other tank noise; this keeps the same
// descending "nope" shape but louder, with a third, lower note and a short
// leading noise tick so it reads as a distinct event rather than blending
// into the background.
export function playProductionBlocked() {
  playNoise(0.03, { gain: 0.07 });
  playTone(294, 0.08, { type: 'triangle', gain: 0.16, when: 0.01 }); // D4
  playTone(220, 0.1, { type: 'triangle', gain: 0.14, when: 0.09 }); // A3
  playTone(164.81, 0.16, { type: 'triangle', gain: 0.12, when: 0.19 }); // E3
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
  if (!audioCtx || audioCtx.state !== 'running') return; // see playTone's own comment on why
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

// A quick "pew" — a Turret (any tier) firing a shot. Per direct request
// ("the gain from the shooting sounds of the turrets can stack when 20
// turrets shoot at the same time, making it super loud"), capped to at most
// MAX_CONCURRENT_TURRET_SHOTS overlapping instances — every additional
// simultaneous shot beyond that just plays no sound at all rather than
// piling another oscillator's gain on top of an already-loud stack. The
// counter releases on its own after this sound's own fixed duration, no
// separate "sound finished" callback needed since playSweep's own envelope
// is a known, constant length.
const TURRET_SHOOT_DURATION_S = 0.08;
const MAX_CONCURRENT_TURRET_SHOTS = 4;
let activeTurretShotSounds = 0;
export function playTurretShoot() {
  if (activeTurretShotSounds >= MAX_CONCURRENT_TURRET_SHOTS) return;
  activeTurretShotSounds++;
  setTimeout(() => { activeTurretShotSounds = Math.max(0, activeTurretShotSounds - 1); }, TURRET_SHOOT_DURATION_S * 1000);
  playSweep(950, 260, TURRET_SHOOT_DURATION_S, { type: 'square', gain: 0.1 });
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

// Real bug fix, per direct report ("battle music is slightly ahead of the
// game music"): keeping both tracks permanently playing (see the big comment
// above) only guarantees they STAY in sync once they start in sync — and two
// separate HTMLMediaElement.play() calls, even issued back-to-back in the
// same synchronous startMusic() below, have no cross-element timing
// guarantee at all. Browsers can (and do) take a slightly different amount
// of real time to actually begin decoding/outputting each file, so the two
// tracks can start a handful of milliseconds apart and then stay that far
// apart forever, since looped native <audio> playback has no mechanism of
// its own to notice or correct drift. A small periodic safety-net check —
// comparing currentTime (wrapped to each loop's own duration, so a check
// landing right as one track wraps back to 0 while the other hasn't quite
// yet doesn't read as a huge, spurious drift) and snapping Battle back onto
// Game's clock whenever they've drifted past MUSIC_RESYNC_TOLERANCE_S — self-
// corrects regardless of the exact root cause (startup latency, or the two
// mp3 files not encoding to bit-for-bit identical durations). Deliberately
// treats Game as the master clock (Battle is the one that gets snapped) —
// arbitrary, but has to pick one so the two checks in each direction can't
// both fire and fight each other. In practice this mostly resolves silently
// while Battle's own gain is still 0 (the player never hears the correction
// itself), well before the first real crossfade ever makes Battle audible.
const MUSIC_RESYNC_INTERVAL_MS = 1000;
const MUSIC_RESYNC_TOLERANCE_S = 0.04;
let musicResyncTimer = null;

function resyncMusicTracks() {
  if (!gameMusicEl || !battleMusicEl || gameMusicEl.paused || battleMusicEl.paused) return;
  const duration = gameMusicEl.duration;
  if (!duration || !isFinite(duration)) return;
  let diff = battleMusicEl.currentTime - gameMusicEl.currentTime;
  // Wrap into [-duration/2, duration/2] so a check landing right at a loop
  // boundary (one track already wrapped to ~0, the other still near the end)
  // doesn't misread a genuinely tiny, correct offset as a huge one.
  diff = ((diff + duration / 2) % duration + duration) % duration - duration / 2;
  if (Math.abs(diff) > MUSIC_RESYNC_TOLERANCE_S) {
    battleMusicEl.currentTime = gameMusicEl.currentTime;
  }
}

function ensureMusicTracks() {
  if (gameMusicEl) return;
  gameMusicEl = new Audio('audio/Game.mp3');
  gameMusicEl.loop = true;
  battleMusicEl = new Audio('audio/Battle.mp3');
  battleMusicEl.loop = true;
  bossMusicEl = new Audio('audio/Boss.mp3');
  bossMusicEl.loop = true;
  // preservesPitch defaults to true in every modern browser (Chrome/Firefox/
  // Safari all time-stretch by default) — explicitly disabled, vendor
  // prefixes included, so setMusicSpeedBoost's playbackRate ramp actually
  // shifts pitch as a natural side effect of playing faster, per direct
  // request, rather than staying pitch-flat.
  const initialRate = wantSpeedBoost ? MUSIC_SPEED_BOOST_RATE : 1.0;
  [gameMusicEl, battleMusicEl, bossMusicEl].forEach((el) => {
    el.preservesPitch = false;
    el.mozPreservesPitch = false;
    el.webkitPreservesPitch = false;
    el.playbackRate = initialRate;
  });

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
  if (!musicResyncTimer) musicResyncTimer = setInterval(resyncMusicTracks, MUSIC_RESYNC_INTERVAL_MS);
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

// Called once, the instant the end-game boss upgrade is purchased (main.js's
// bossFightTriggerPending handler, right as the 16-second reveal sequence
// itself starts). Per direct request, Game/Battle fade all the way out
// first, then — after a genuine stretch of silence (Config.js's
// BOSS_SILENCE_WAIT_MS, elapsed elsewhere in main.js's own timeline; this
// function just has to hold Boss silent for that whole span) — Boss fades in
// on its own, not overlapping either half of the transition.
const BOSS_MUSIC_FADE_OUT_S = BOSS_MUSIC_FADE_OUT_MS / 1000;
const BOSS_MUSIC_FADE_IN_START_S = BOSS_MUSIC_FADE_IN_START_MS / 1000;
const BOSS_MUSIC_FADE_IN_S = BOSS_MUSIC_FADE_IN_MS / 1000;
export function triggerBossMusic() {
  if (bossActive) return;
  bossActive = true;
  if (!ctx) return; // shouldn't happen in practice — audio is unlocked well before any Lab purchase is possible
  ensureMusicTracks();
  const now = ctx.currentTime;
  // Game/Battle fade out first, over BOSS_MUSIC_FADE_OUT_S.
  gameTrackGain.gain.cancelScheduledValues(now);
  gameTrackGain.gain.setValueAtTime(gameTrackGain.gain.value, now);
  gameTrackGain.gain.linearRampToValueAtTime(0, now + BOSS_MUSIC_FADE_OUT_S);
  battleTrackGain.gain.cancelScheduledValues(now);
  battleTrackGain.gain.setValueAtTime(battleTrackGain.gain.value, now);
  battleTrackGain.gain.linearRampToValueAtTime(0, now + BOSS_MUSIC_FADE_OUT_S);
  // Real bug fix, per direct report: the Boss track's own PLAYBACK (not just
  // its gain) used to start immediately, right here at t=0 — silent, since
  // the gain was held at 0, but still genuinely advancing through the song
  // underneath that silence. By the time the fade-in actually became
  // audible at BOSS_MUSIC_FADE_IN_START_S, the track itself was already that
  // many seconds in, so what the player heard fading in was the middle of
  // the song, not its start. Fixed by delaying the play() call itself (via
  // setTimeout, since AudioContext scheduling only controls gain/oscillator
  // params, not when an HTMLMediaElement's own playback begins) to land at
  // the exact same real moment the fade-in starts, so hearing it begin IS
  // the song actually starting from currentTime 0.
  bossTrackGain.gain.cancelScheduledValues(now);
  bossTrackGain.gain.setValueAtTime(0, now);
  // This hold point is what keeps the gain flat at 0 through the whole
  // silent stretch — without it, linearRampToValueAtTime would interpolate
  // the WHOLE way from (now, 0) to the ramp's end target, i.e. gain would
  // already be climbing gradually from t=0 instead of staying silent.
  bossTrackGain.gain.setValueAtTime(0, now + BOSS_MUSIC_FADE_IN_START_S);
  bossTrackGain.gain.linearRampToValueAtTime(1, now + BOSS_MUSIC_FADE_IN_START_S + BOSS_MUSIC_FADE_IN_S);
  setTimeout(() => {
    bossMusicEl.currentTime = 0;
    bossMusicEl.play().catch(() => {});
  }, BOSS_MUSIC_FADE_IN_START_MS);
  // Game/Battle are paused for good once their own fade-out actually
  // finishes — not immediately, which would cut them off mid-ramp. Nothing
  // left to resync once they're stopped.
  setTimeout(() => {
    gameMusicEl.pause();
    battleMusicEl.pause();
    if (musicResyncTimer) {
      clearInterval(musicResyncTimer);
      musicResyncTimer = null;
    }
  }, BOSS_MUSIC_FADE_OUT_S * 1000);
}

// Exported for completeness (e.g. a future mute toggle) — not currently
// wired to any UI control, since none was requested.
export function stopMusic() {
  musicStarted = false;
  if (gameMusicEl) gameMusicEl.pause();
  if (battleMusicEl) battleMusicEl.pause();
  if (bossMusicEl) bossMusicEl.pause();
  if (musicResyncTimer) {
    clearInterval(musicResyncTimer);
    musicResyncTimer = null;
  }
}
