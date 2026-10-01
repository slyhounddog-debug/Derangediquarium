// PerfOverlay.js — an on-screen performance readout, toggled with F3 (or
// opened at load with ?perf in the URL), added per direct request to find out
// what's actually slow with ~50 fish / ~600 objects on screen. Purely a
// diagnostic: no gameplay logic and nothing here ever writes game state.
//
// Three modes, cycled by F3: off -> basic -> accurate.
//  - basic: times the JavaScript of each update/render phase (cheap, doesn't
//    disturb the frame rate). Canvas drawing is DEFERRED by the browser, so
//    this under-reports how long drawing really takes — it mostly shows
//    game-logic cost.
//  - accurate: after each render phase it forces the canvas to actually finish
//    drawing (a 1px getImageData read), so every phase's time includes its real
//    drawing cost. This slows the game a little itself and shifts cost between
//    phases, but is the mode that shows WHICH phase is expensive.
//
// It also reports the fixed-timestep simulation's catch-up behavior: when
// frames take longer than one 60Hz step, the loop (Engine.js's
// createGameLoop) runs several update steps per rendered frame, so a heavy
// update multiplies — "steps/frame" at or near 15 (MAX_FRAME_SKIP) means the
// sim is spiraling, and the ms-per-step number is then what to fix first.

let mode = 0; // 0 off, 1 basic, 2 accurate
let el = null;

let lastMark = 0;
const phaseMs = {}; // label -> ms accumulated this reporting window
let frames = 0;
let steps = 0;
let updateMs = 0;
let renderMs = 0;
let windowStart = 0;
let stepStart = 0;
let renderStart = 0;
let lastRenderStart = 0;
let intervalSum = 0;
let worstFrame = 0;

function ensureEl() {
  if (el) return el;
  el = document.createElement('pre');
  el.id = 'perf-overlay';
  el.style.cssText = 'position:fixed;left:6px;top:6px;z-index:100000;margin:0;padding:8px 10px;background:rgba(0,0,0,0.78);color:#9fff9f;font:11px/1.35 Consolas,monospace;border-radius:6px;pointer-events:none;white-space:pre;max-height:96vh;overflow:hidden;';
  document.body.appendChild(el);
  return el;
}

function setMode(m) {
  mode = m;
  if (mode === 0) { if (el) el.style.display = 'none'; return; }
  ensureEl().style.display = 'block';
  for (const k of Object.keys(phaseMs)) delete phaseMs[k];
  frames = steps = 0; updateMs = renderMs = intervalSum = worstFrame = 0;
  windowStart = performance.now();
}

window.addEventListener('keydown', (e) => {
  if (e.code !== 'F3') return;
  e.preventDefault();
  setMode((mode + 1) % 3);
});
if (/[?&]perf\b/.test(location.search)) window.addEventListener('DOMContentLoaded', () => setMode(1));

// Time since the previous mark (or the start of this step/render) is credited
// to `label`. `flushCtx`, when given and in accurate mode, is forced to finish
// its pending drawing first so the time includes the real drawing cost.
export function perfMark(label, flushCtx) {
  if (mode === 0) return;
  if (mode === 2 && flushCtx) { try { flushCtx.getImageData(0, 0, 1, 1); } catch (e) { /* tainted/unsupported — ignore */ } }
  const t = performance.now();
  phaseMs[label] = (phaseMs[label] || 0) + (t - lastMark);
  lastMark = t;
}

// A one-line note other modules can set for the overlay to show (e.g. whether
// the item load mode is on) — cheap and ignored while the overlay is off.
let notes = {};
export function perfNote(key, text) { if (mode !== 0) notes[key] = text; }

export function perfUpdateBegin() {
  if (mode === 0) return;
  stepStart = lastMark = performance.now();
}
export function perfUpdateEnd() {
  if (mode === 0) return;
  perfMark('u: everything else');
  updateMs += performance.now() - stepStart;
  steps++;
}
export function perfRenderBegin() {
  if (mode === 0) return;
  renderStart = lastMark = performance.now();
  if (lastRenderStart) {
    const gap = renderStart - lastRenderStart;
    intervalSum += gap;
    if (gap > worstFrame) worstFrame = gap;
  }
  lastRenderStart = renderStart;
}
export function perfRenderEnd(state, canvasW, canvasH) {
  if (mode === 0) return;
  perfMark('r: everything else');
  renderMs += performance.now() - renderStart;
  frames++;
  const now = performance.now();
  if (now - windowStart < 500) return;
  report(state, now - windowStart, canvasW, canvasH);
  for (const k of Object.keys(phaseMs)) delete phaseMs[k];
  frames = steps = 0; updateMs = renderMs = intervalSum = worstFrame = 0;
  windowStart = now;
}

function countObjects(state) {
  const items = {};
  for (const it of state.level.items) items[it.type] = (items[it.type] || 0) + 1;
  let fish = 0, aliens = 0;
  for (const e of state.level.entities) { if (e.type === 'fish') fish++; else if (e.type === 'alien') aliens++; }
  let buildings = 0;
  for (const k in state.level.buildingData) buildings++;
  return { items, itemTotal: state.level.items.length, fish, aliens, buildings };
}

function report(state, windowMs, canvasW, canvasH) {
  const fps = (frames / windowMs) * 1000;
  const f = Math.max(1, frames);
  const lines = [];
  lines.push(`PERF (${mode === 1 ? 'basic: JS time only' : 'ACCURATE: includes drawing'})   F3 = next mode`);
  lines.push(`${fps.toFixed(1)} fps   frame ${(intervalSum / Math.max(1, frames - 1)).toFixed(1)}ms avg / ${worstFrame.toFixed(0)}ms worst   canvas ${canvasW}x${canvasH}`);
  lines.push(`update: ${steps / f < 10 ? '' : '!! '}${(steps / f).toFixed(1)} steps/frame (15 = sim spiraling)   ${(updateMs / f).toFixed(1)}ms/frame   ${(updateMs / Math.max(1, steps)).toFixed(2)}ms/step`);
  lines.push(`render: ${(renderMs / f).toFixed(1)}ms/frame`);
  const c = countObjects(state);
  const itemStr = Object.entries(c.items).map(([k, v]) => `${k} ${v}`).join(', ');
  for (const k of Object.keys(notes)) lines.push(notes[k]);
  lines.push(`objects: fish ${c.fish}, aliens ${c.aliens}, items ${c.itemTotal} (${itemStr}), buildings ${c.buildings}`);
  lines.push('');
  lines.push('ms per frame by phase (update phases are summed over all steps):');
  const rows = Object.entries(phaseMs).sort((a, b) => b[1] - a[1]);
  for (const [label, v] of rows) {
    const per = v / f;
    if (per < 0.05) continue;
    lines.push(`${per.toFixed(1).padStart(7)}  ${label}`);
  }
  el.textContent = lines.join('\n');
}
