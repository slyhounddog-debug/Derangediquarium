// Tabs + the Variables and Formulas views of the dev tool. (The Audio tab lives in index.html.)
//
// Every number here is read from, and written back to, the game's own source files through /api/tuning
// (see tuning.mjs): sliders edit js/Config.js / js/Sound.js in place, "default" is the last git commit.
// The game is static files, so a change shows up the next time you reload the game tab.

const $ = (sel, root = document) => root.querySelector(sel);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

const statusEl = $('#status');
let statusTimer = null;
function say(msg, bad) {
  statusEl.textContent = msg;
  statusEl.style.color = bad ? 'var(--bad)' : 'var(--mute)';
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (statusEl.textContent = ''), 3500);
}

// ---------- styles ----------
document.head.append(h('style', { html: `
  .tbar { display:flex; flex-wrap:wrap; gap:10px 16px; align-items:center; margin-bottom:14px; }
  .tbar input[type=search] { font:inherit; color:var(--ink); background:#16273a; border:1px solid var(--line); border-radius:8px; padding:6px 10px; width:260px; }
  .tbar label { color:var(--mute); display:flex; gap:6px; align-items:center; }
  .tnote { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px 14px; color:var(--mute); margin-bottom:14px; font-size:13px; }
  .tnote b { color:var(--ink); }
  details.vgroup { background:var(--card); border:1px solid var(--line); border-radius:12px; margin-bottom:12px; }
  details.vgroup > summary { cursor:pointer; padding:10px 16px; font-size:16px; font-weight:600; list-style:none; display:flex; gap:12px; align-items:baseline; }
  details.vgroup > summary::-webkit-details-marker { display:none; }
  details.vgroup > summary::before { content:'▸'; color:var(--mute); }
  details.vgroup[open] > summary::before { content:'▾'; }
  .vcount { color:var(--mute); font-size:12px; font-weight:400; }
  .vchanged { color:var(--acc); font-size:12px; font-weight:400; }
  .vbody { padding:4px 16px 14px; }
  .vsub { margin:14px 0 4px; color:var(--acc); font-size:13px; font-weight:600; border-bottom:1px solid var(--line); padding-bottom:2px; }
  .vrow { display:grid; grid-template-columns: minmax(220px, 1.1fr) minmax(180px, 1.4fr) 108px 150px; gap:6px 14px; align-items:center; padding:4px 0; border-bottom:1px solid #1d2f3f; }
  .vrow.changed { background:rgba(255,179,71,.07); }
  .vname { display:flex; flex-direction:column; min-width:0; }
  .vlabel { font-size:14px; }
  .vcode { color:var(--mute); font-size:11px; font-family:Consolas, monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .vrow input[type=range] { width:100%; }
  .vnum { display:flex; gap:4px; align-items:center; }
  .vnum input { width:82px; font:inherit; color:var(--ink); background:#16273a; border:1px solid var(--line); border-radius:6px; padding:3px 6px; }
  .vnum span { color:var(--mute); font-size:12px; }
  .vdef { display:flex; gap:6px; align-items:center; color:var(--mute); font-size:12px; }
  .vdef button { padding:2px 8px; font-size:12px; }
  .vdef button:disabled { opacity:.35; cursor:default; }
  .fcard { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; margin-bottom:16px; }
  .fcard h2 { margin:0 0 4px; font-size:17px; }
  .fcard .formula { font-family:Consolas, monospace; background:#10202f; border:1px solid var(--line); border-radius:8px; padding:8px 12px; margin:6px 0; color:#ffd9a0; white-space:pre-wrap; font-size:13px; }
  .fcard .fnote { color:var(--mute); font-size:13px; margin:4px 0 8px; }
  .fcard details.fparams { margin:8px 0; }
  .fcard details.fparams > summary { cursor:pointer; color:var(--acc); font-size:13px; }
  .fcard .fgrid .vrow { grid-template-columns: minmax(180px, 1fr) minmax(140px, 1.2fr) 100px 140px; }
  .finputs { display:flex; flex-wrap:wrap; gap:8px 18px; margin:8px 0; color:var(--mute); font-size:13px; align-items:center; }
  .finputs input, .finputs select { font:inherit; color:var(--ink); background:#16273a; border:1px solid var(--line); border-radius:6px; padding:3px 6px; width:80px; }
  .finputs select { width:auto; }
  .fprev { display:flex; flex-wrap:wrap; gap:14px 28px; margin-top:8px; overflow-x:auto; }
  table.ft { border-collapse:collapse; font-size:13px; }
  table.ft caption { text-align:left; color:var(--mute); font-size:12px; padding-bottom:3px; }
  table.ft th, table.ft td { border:1px solid #2a4258; padding:3px 9px; text-align:right; white-space:nowrap; }
  table.ft th { background:#16273a; color:var(--mute); font-weight:600; }
  table.ft td:first-child, table.ft th:first-child { text-align:left; color:var(--ink); }
  table.ft td.warn { color:var(--bad); }
  table.ft td.good { color:var(--ok); }
  .fsmall { color:var(--mute); font-size:12px; margin-top:6px; }
` }));

// ---------- tabs ----------
const VIEWS = { audio: $('#view-audio'), formulas: $('#view-formulas'), variables: $('#view-variables') };
function showTab(name) {
  if (!VIEWS[name]) name = 'audio';
  for (const [k, el] of Object.entries(VIEWS)) el.hidden = k !== name;
  for (const b of document.querySelectorAll('#tabs .tab')) b.classList.toggle('on', b.dataset.tab === name);
  $('#audioControls').style.display = name === 'audio' ? 'flex' : 'none';
  try { localStorage.setItem('devtools_tab', name); } catch {}
  if (name !== 'audio') ensureLoaded();
}
for (const b of document.querySelectorAll('#tabs .tab')) b.addEventListener('click', () => showTab(b.dataset.tab));
let startTab = 'audio';
try { startTab = localStorage.getItem('devtools_tab') || 'audio'; } catch {}

// ---------- data ----------
let data = null;
let meta = null;
const vars = new Map();      // id -> variable object (value is kept current)
const rowUpdaters = new Map(); // id -> [fn] — every row showing this variable (Variables tab + formula cards)
let loadPromise = null;

function ensureLoaded() {
  if (!loadPromise) loadPromise = load();
  return loadPromise;
}
async function load() {
  try {
    const r = await fetch('/api/tuning');
    if (!r.ok) throw new Error((await r.json()).error || r.status);
    data = await r.json();
    meta = data.meta;
    vars.clear();
    for (const g of data.groups) for (const v of g.variables) vars.set(v.id, v);
    buildVariables();
    buildFormulas();
  } catch (e) {
    for (const el of [VIEWS.variables, VIEWS.formulas]) el.replaceChildren(h('div', { class: 'tnote' }, 'Could not load the game values: ' + e.message));
    loadPromise = null;
  }
}

const V = (id, dflt = 0) => { const v = vars.get(id); return v ? v.value : dflt; };
const has = (id) => vars.has(id);

function fmtNum(n, d = 2) { if (!Number.isFinite(n)) return '—'; return (+n.toFixed(d)).toLocaleString('en-US', { maximumFractionDigits: d }); }
function fmtVal(v) { return String(+Number(v).toPrecision(8)); }

// ---------- saving ----------
async function save(v) {
  try {
    const r = await fetch('/api/tuning/set', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id, value: v.value }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    v.value = j.value;
    say(`Saved ${v.label} = ${fmtVal(v.value)} (reload the game tab to see it)`);
    window.dispatchEvent(new Event('devtools:changed'));
  } catch (e) { say('Could not save: ' + e.message, true); }
  notify(v, null);
}
async function resetVar(v) {
  try {
    const r = await fetch('/api/tuning/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    v.value = j.value;
    say(`Reset ${v.label} to ${fmtVal(v.value)}`);
    window.dispatchEvent(new Event('devtools:changed'));
  } catch (e) { say('Could not reset: ' + e.message, true); }
  notify(v, null);
}

let rafPending = false;
function notify(v, source) {
  for (const fn of rowUpdaters.get(v.id) || []) if (fn !== source) fn();
  updateGroupCounts();
  if (!rafPending) { rafPending = true; requestAnimationFrame(() => { rafPending = false; renderAllPreviews(); }); }
}

// ---------- one variable row (shared by both tabs) ----------
function buildRow(v) {
  const slider = h('input', { type: 'range', min: v.min, max: v.max, step: v.step });
  const num = h('input', { type: 'number', step: 'any' });
  const resetBtn = h('button', { title: 'Put back the value from the last git commit' }, 'Reset');
  const defText = h('span');
  const row = h('div', { class: 'vrow', 'data-search': (v.label + ' ' + v.code + ' ' + (v.sub || '')).toLowerCase() },
    h('div', { class: 'vname', title: v.desc || '' }, h('span', { class: 'vlabel' }, v.label), h('span', { class: 'vcode' }, v.code + (v.file === 'Sound' ? ' · Sound.js' : ''))),
    slider,
    h('div', { class: 'vnum' }, num, h('span', {}, v.unit || '')),
    h('div', { class: 'vdef' }, defText, resetBtn));
  const update = () => {
    if (+slider.min > v.value) slider.min = v.value;
    if (+slider.max < v.value) slider.max = v.value;
    slider.value = v.value;
    if (document.activeElement !== num) num.value = fmtVal(v.value);
    const changed = v.original !== null && Math.abs(v.value - v.original) > 1e-9;
    row.classList.toggle('changed', changed);
    row.dataset.changed = changed ? '1' : '';
    defText.textContent = v.original === null ? 'new (not committed)' : 'default ' + fmtVal(v.original);
    resetBtn.disabled = !changed;
  };
  slider.addEventListener('input', () => { v.value = +slider.value; num.value = fmtVal(v.value); row.classList.toggle('changed', v.original !== null && Math.abs(v.value - v.original) > 1e-9); notify(v, update); });
  slider.addEventListener('change', () => save(v));
  num.addEventListener('change', () => { const x = parseFloat(num.value); if (!Number.isFinite(x)) { update(); return; } v.value = x; save(v); });
  resetBtn.addEventListener('click', () => resetVar(v));
  if (!rowUpdaters.has(v.id)) rowUpdaters.set(v.id, []);
  rowUpdaters.get(v.id).push(update);
  update();
  return row;
}

// ---------- Variables tab ----------
const groupEls = [];
function buildVariables() {
  const root = VIEWS.variables;
  root.classList.add('wide');
  root.replaceChildren();
  const search = h('input', { type: 'search', placeholder: 'Search (e.g. guppy, hunger, collector)…' });
  const changedOnly = h('input', { type: 'checkbox' });
  const total = [...vars.values()].length;
  const resetAllBtn = h('button', { class: 'danger', title: 'Put every value back to the last git commit' }, 'Reset all changed');
  root.append(
    h('div', { class: 'tnote', html: '<b>How this works.</b> Moving a slider (or typing a number) writes the new value straight into <code>js/Config.js</code> (or <code>js/Sound.js</code>); <b>reload the game tab</b> to see it. “Default” is the value in the last git commit, so <b>Reset</b> always has somewhere to go back to, and <code>git diff</code> shows everything you changed. Some text in the game (item and building descriptions) quotes numbers literally and won’t update by itself. Only plain numbers are listed; values that are computed from other values are left out.' }),
    h('div', { class: 'tbar' }, search, h('label', {}, changedOnly, 'Changed only'), h('span', { id: 'vtotals', style: 'color:var(--mute)' }, `${total} values`),
      h('button', { onclick: () => groupEls.forEach((g) => (g.det.open = true)) }, 'Expand all'),
      h('button', { onclick: () => groupEls.forEach((g) => (g.det.open = false)) }, 'Collapse all'), resetAllBtn));
  if (meta.problems.length) root.append(h('div', { class: 'tnote' }, 'Skipped: ' + meta.problems.join('; ')));
  groupEls.length = 0;
  for (const g of data.groups) {
    if (!g.variables.length) continue;
    const countEl = h('span', { class: 'vcount' });
    const changedEl = h('span', { class: 'vchanged' });
    const det = h('details', { class: 'vgroup' }, h('summary', {}, g.label, countEl, changedEl));
    const body = h('div', { class: 'vbody' });
    let lastSub = null;
    const rows = [];
    const subs = [];
    for (const v of g.variables) {
      if (v.sub && v.sub !== lastSub) { const s = h('div', { class: 'vsub' }, v.sub); body.append(s); subs.push({ el: s, rows: [] }); lastSub = v.sub; }
      const row = buildRow(v);
      body.append(row);
      rows.push(row);
      if (subs.length && v.sub) subs[subs.length - 1].rows.push(row);
    }
    det.append(body);
    root.append(det);
    groupEls.push({ det, g, rows, subs, countEl, changedEl });
  }
  const applyFilter = () => {
    const q = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const co = changedOnly.checked;
    let shown = 0;
    for (const ge of groupEls) {
      let any = 0;
      for (const row of ge.rows) {
        const hit = q.every((t) => row.dataset.search.includes(t)) && (!co || row.dataset.changed === '1');
        row.style.display = hit ? '' : 'none';
        if (hit) any++;
      }
      for (const s of ge.subs) s.el.style.display = s.rows.some((r) => r.style.display !== 'none') ? '' : 'none';
      ge.det.style.display = any ? '' : 'none';
      if ((q.length || co) && any) ge.det.open = true;
      shown += any;
    }
    $('#vtotals').textContent = (q.length || co) ? `${shown} of ${total} shown` : `${total} values`;
  };
  search.addEventListener('input', applyFilter);
  changedOnly.addEventListener('change', applyFilter);
  groupEls.applyFilter = applyFilter;
  resetAllBtn.addEventListener('click', async () => {
    const changed = [...vars.values()].filter((v) => v.original !== null && Math.abs(v.value - v.original) > 1e-9);
    if (!changed.length) { say('Nothing is changed'); return; }
    if (!confirm(`Reset ${changed.length} changed value${changed.length > 1 ? 's' : ''} to the last git commit?`)) return;
    for (const v of changed) await resetVar(v);
    say(`Reset ${changed.length} values`);
  });
  updateGroupCounts();
}
function updateGroupCounts() {
  for (const ge of groupEls) {
    const changed = ge.g.variables.filter((v) => v.original !== null && Math.abs(v.value - v.original) > 1e-9).length;
    ge.countEl.textContent = `${ge.g.variables.length} values`;
    ge.changedEl.textContent = changed ? `${changed} changed` : '';
  }
}

// ---------- Formulas tab ----------
const BASE_FEEDERS = ['guppy', 'dartfin', 'blimpfish'];
const sp = (s, path) => `SPECIES.${s}.${path}`;
const spName = (s) => (meta.speciesNames && meta.speciesNames[s]) || s;
const tileName = (t) => (meta.buildingNames && meta.buildingNames[meta.tileIds[t]]) || t;
const STAGES = ['baby', 'juvenile', 'adult'];

function tbl(caption, headers, rows) {
  return `<table class="ft">${caption ? `<caption>${caption}</caption>` : ''}<tr>${headers.map((x) => `<th>${x}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => (c && typeof c === 'object' ? `<td class="${c.cls || ''}">${c.t}</td>` : `<td>${c}</td>`)).join('')}</tr>`).join('')}</table>`;
}
const money = (n) => (Number.isFinite(n) ? '$' + fmtNum(n, n >= 100 ? 0 : 2) : '—');

// Alien wave model (mirrors Systems.js: alienDifficultyT / waveIntervalMsAt / the count lerp / alienTierWeightsAt)
function archetypes() {
  const out = [];
  for (let i = 0; has(`ALIEN_ARCHETYPES.${i}.hpMin`); i++) out.push({ hp: (V(`ALIEN_ARCHETYPES.${i}.hpMin`) + V(`ALIEN_ARCHETYPES.${i}.hpMax`)) / 2, dmg: V(`ALIEN_ARCHETYPES.${i}.fishDamagePerSec`), name: meta.archetypeNames[i] || `Tier ${i + 1}` });
  return out;
}
function keyframes() {
  const out = [];
  for (let k = 0; has(`ALIEN_TIER_MIX_KEYFRAMES.${k}.t`); k++) {
    const w = [];
    for (let j = 0; has(`ALIEN_TIER_MIX_KEYFRAMES.${k}.weights.${j}`); j++) w.push(V(`ALIEN_TIER_MIX_KEYFRAMES.${k}.weights.${j}`));
    out.push({ t: V(`ALIEN_TIER_MIX_KEYFRAMES.${k}.t`), w });
  }
  return out;
}
function weightsAt(t) {
  const kf = keyframes();
  if (!kf.length) return [];
  let w;
  if (t <= kf[0].t) w = kf[0].w;
  else if (t >= kf[kf.length - 1].t) w = kf[kf.length - 1].w;
  else {
    w = kf[kf.length - 1].w;
    for (let i = 0; i < kf.length - 1; i++) {
      if (t >= kf[i].t && t <= kf[i + 1].t) { const lt = (t - kf[i].t) / (kf[i + 1].t - kf[i].t); w = kf[i].w.map((x, idx) => x + (kf[i + 1].w[idx] - x) * lt); break; }
    }
  }
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x) => x / sum);
}
function waveModel(wave) {
  const ramp = Math.max(1, V('ALIEN_WAVE_DIFFICULTY_RAMP_WAVES', 1));
  const t = Math.min(1, (wave - 1) / ramp);
  const cMin = Math.round(V('ALIEN_WAVE_COUNT_EARLY_MIN') + (V('ALIEN_WAVE_COUNT_LATE_MIN') - V('ALIEN_WAVE_COUNT_EARLY_MIN')) * t);
  const cMax = Math.round(V('ALIEN_WAVE_COUNT_EARLY_MAX') + (V('ALIEN_WAVE_COUNT_LATE_MAX') - V('ALIEN_WAVE_COUNT_EARLY_MAX')) * t);
  const lo = wave === 1 ? 1 : cMin, hi = wave === 1 ? 1 : cMax; // wave 1 is always exactly one alien
  const w = weightsAt(t), arch = archetypes();
  const avgHp = w.reduce((a, x, i) => a + x * (arch[i] ? arch[i].hp : 0), 0);
  const avgDmg = w.reduce((a, x, i) => a + x * (arch[i] ? arch[i].dmg : 0), 0);
  const count = (lo + hi) / 2;
  const tAfter = Math.min(1, wave / ramp);
  const gapMs = V('ALIEN_WAVE_INTERVAL_EARLY_MS') + (V('ALIEN_WAVE_INTERVAL_LATE_MS') - V('ALIEN_WAVE_INTERVAL_EARLY_MS')) * tAfter;
  return { wave, t, lo, hi, count, w, avgHp, avgDmg, waveHp: count * avgHp, gapMs };
}

const FORMULAS = [
  {
    id: 'fishPrice', title: 'Fish purchase price',
    formula: 'price = round( base price × rate ^ N )\nN = how many of that species are alive right now',
    note: 'Each fish you own makes the next one of its species cost more. The rate is the first slider, or the lower second one once the Fish Scaling Science Lab node is bought. Hybrids and merged fish never count.',
    params: ['ECONOMY_FISH_COST_GROWTH_RATE', 'FISH_SCALING_COST_GROWTH_RATE', ...['guppy', 'dartfin', 'blimpfish', 'suckerfish', 'electric_eel', 'octopus'].map((s) => sp(s, 'cost'))],
    render() {
      const ids = ['guppy', 'dartfin', 'blimpfish', 'suckerfish', 'electric_eel', 'octopus'].filter((s) => has(sp(s, 'cost')));
      const mk = (rate, cap) => tbl(cap, ['Owned (N)', ...ids.map(spName)], Array.from({ length: 13 }, (_, n) => [n, ...ids.map((s) => '$' + fmtNum(Math.round(V(sp(s, 'cost')) * Math.pow(rate, n)), 0))]));
      return mk(V('ECONOMY_FISH_COST_GROWTH_RATE'), `Normal (× ${fmtVal(V('ECONOMY_FISH_COST_GROWTH_RATE'))})`) + mk(V('FISH_SCALING_COST_GROWTH_RATE'), `With Fish Scaling (× ${fmtVal(V('FISH_SCALING_COST_GROWTH_RATE'))})`);
    },
  },
  {
    id: 'buildingPrice', title: 'Building price',
    formula: 'price = ceil( base price × rate ^ N )     (Platforms are a flat price)\nN = how many of that exact building are already placed\nrate: ×tier 1 if base ≤ tier-2 line, ×tier 2 above it, ×tier 3 above the tier-3 line',
    note: 'Every building gets pricier with each copy you place. A building’s growth rate depends on how expensive its base price is. Selling a building refunds what the last copy cost, so place-and-sell is free.',
    params: ['PLATFORM_FLAT_COST', 'BUILDING_COST_GROWTH_RATE_TIER1', 'BUILDING_COST_GROWTH_RATE_TIER2', 'BUILDING_COST_GROWTH_RATE_TIER3', 'BUILDING_COST_TIER2_MIN_BASE', 'BUILDING_COST_TIER3_MIN_BASE',
      ...['TILE_COLLECTOR', 'TILE_REFINERY', 'TILE_MANUFACTURER', 'TILE_POWER_PLANT', 'TILE_TURRET_WASTE', 'TILE_FAN_T2', 'TILE_STORAGE_CHEST'].map((t) => `BUILDING_TYPES.${t}.cost`)],
    render() {
      const tiles = ['TILE_COLLECTOR', 'TILE_REFINERY', 'TILE_MANUFACTURER', 'TILE_POWER_PLANT', 'TILE_TURRET_WASTE', 'TILE_FAN_T2', 'TILE_STORAGE_CHEST'].filter((t) => has(`BUILDING_TYPES.${t}.cost`));
      const rate = (b) => (b > V('BUILDING_COST_TIER3_MIN_BASE') ? V('BUILDING_COST_GROWTH_RATE_TIER3') : b > V('BUILDING_COST_TIER2_MIN_BASE') ? V('BUILDING_COST_GROWTH_RATE_TIER2') : V('BUILDING_COST_GROWTH_RATE_TIER1'));
      return tbl('Price of the Nth copy', ['Already placed (N)', 'Platform', ...tiles.map((t) => `${tileName(t)} (×${fmtVal(rate(V(`BUILDING_TYPES.${t}.cost`)))})`)],
        Array.from({ length: 11 }, (_, n) => [n, '$' + V('PLATFORM_FLAT_COST'), ...tiles.map((t) => { const b = V(`BUILDING_TYPES.${t}.cost`); return '$' + fmtNum(Math.ceil(b * Math.pow(rate(b), n)), 0); })]));
    },
  },
  {
    id: 'starTier', title: 'Merged fish (star tiers)',
    formula: 'coin value = ceil( adult coin value × value multiplier ^ (tier − 1) )\nhunger rate = base hunger rate × hunger multiplier ^ (tier − 1)',
    note: 'Merging two same-species adults makes a higher tier: each tier pays more per coin and gets hungry more slowly. The tables assume a clean tank, no Mutagen buff, and the unupgraded Food (Food Quality level 0).',
    params: ['FISH_STAR_TIER_VALUE_MULTIPLIER', 'FISH_STAR_TIER_HUNGER_MULTIPLIER', 'FOOD_HUNGER_RELIEF_BY_LEVEL.0', ...BASE_FEEDERS.flatMap((s) => [sp(s, 'hungerRate'), sp(s, 'growthStages.2.dropValue'), sp(s, 'growthStages.2.dropInterval')])],
    render() {
      return BASE_FEEDERS.filter((s) => has(sp(s, 'hungerRate'))).map((s) => {
        const rows = [1, 2, 3, 4].map((tier) => {
          const coin = Math.ceil(V(sp(s, 'growthStages.2.dropValue')) * Math.pow(V('FISH_STAR_TIER_VALUE_MULTIPLIER'), tier - 1));
          const gold = coin * 60000 / V(sp(s, 'growthStages.2.dropInterval'), 1);
          const food = V(sp(s, 'hungerRate')) * Math.pow(V('FISH_STAR_TIER_HUNGER_MULTIPLIER'), tier - 1) * 60 / V('FOOD_HUNGER_RELIEF_BY_LEVEL.0', 1);
          return [`Tier ${tier}`, money(coin), money(gold), fmtNum(food, 2), money(gold / food)];
        });
        return tbl(spName(s) + ' (adult)', ['', 'Coin value', 'Gold / min', 'Food / min', 'Gold per Food'], rows);
      }).join('');
    },
  },
  {
    id: 'fishEconomy', title: 'Feeder fish economy',
    formula: 'gold / min = coin value × 60000 / coin interval ms × cleanliness multiplier\nfood / min = hunger rate × 60 / hunger relief per Food\nwaste / min = 60000 / (poop interval × species multiplier)',
    note: 'The three coin-dropping species side by side for each growth stage. “Gold per Food” is the number to watch when balancing: a Food costs the Food price, so anything under that loses money. Cleanliness multiplier is shown at a fully clean tank and at 0%.',
    params: ['FOOD_COST', 'FOOD_HUNGER_RELIEF_BY_LEVEL.0', 'WASTE_POOP_INTERVAL_MS', 'CLEANLINESS_MIN_MONEY_FRACTION', ...BASE_FEEDERS.flatMap((s) => [sp(s, 'hungerRate'), ...[0, 1, 2].flatMap((i) => [sp(s, `growthStages.${i}.dropValue`), sp(s, `growthStages.${i}.dropInterval`)])]), sp('dartfin', 'wastePoopIntervalMultiplier'), sp('blimpfish', 'wastePoopIntervalMultiplier')],
    render() {
      const rows = [];
      for (const s of BASE_FEEDERS) {
        if (!has(sp(s, 'hungerRate'))) continue;
        const mult = V(sp(s, 'wastePoopIntervalMultiplier'), 1);
        for (let i = 0; i < 3; i++) {
          const val = V(sp(s, `growthStages.${i}.dropValue`)), iv = V(sp(s, `growthStages.${i}.dropInterval`), 1);
          const gold = val * 60000 / iv;
          const food = V(sp(s, 'hungerRate')) * 60 / V('FOOD_HUNGER_RELIEF_BY_LEVEL.0', 1);
          const gpf = gold / food;
          rows.push([`${spName(s)} (${STAGES[i]})`, money(val), money(gold), money(gold * V('CLEANLINESS_MIN_MONEY_FRACTION')), fmtNum(food, 2), { t: money(gpf), cls: gpf < V('FOOD_COST') ? 'warn' : 'good' }, fmtNum(60000 / (V('WASTE_POOP_INTERVAL_MS', 1) * mult), 2)]);
        }
      }
      return tbl('', ['', 'Coin', 'Gold / min (clean)', 'Gold / min (0% clean)', 'Food / min', 'Gold per Food', 'Waste / min'], rows);
    },
  },
  {
    id: 'hunger', title: 'Hunger timeline',
    formula: 'hungry (!) at  hunger ≥ seek threshold\ncritical (!!) at  seek + critical fraction × (max − seek)\nstarves at  hunger = max\nseconds = hunger points / hunger rate;  one Food buys relief / hunger rate seconds',
    note: 'Seconds a fish can go from just-fed (hunger 0) before each stage, and how long one Food keeps it going at each Food Quality level. (Suckerfish and its hybrids never reach critical or starve.)',
    params: ['HUNGER_MAX', 'HUNGER_SEEK_THRESHOLD', 'HUNGER_CRITICAL_FRACTION', ...[0, 1, 2, 3, 4, 5].map((i) => `FOOD_HUNGER_RELIEF_BY_LEVEL.${i}`), ...['guppy', 'dartfin', 'blimpfish', 'electric_eel', 'octopus'].map((s) => sp(s, 'hungerRate'))],
    render() {
      const max = V('HUNGER_MAX'), seek = V('HUNGER_SEEK_THRESHOLD');
      const crit = seek + V('HUNGER_CRITICAL_FRACTION') * (max - seek);
      const ids = ['guppy', 'dartfin', 'blimpfish', 'electric_eel', 'octopus'].filter((s) => has(sp(s, 'hungerRate')));
      const rows = ids.map((s) => {
        const r = V(sp(s, 'hungerRate'), 1);
        return [spName(s), fmtNum(seek / r, 0) + ' s', fmtNum(crit / r, 0) + ' s', fmtNum(max / r, 0) + ' s', ...[0, 1, 2, 3, 4, 5].map((i) => has(`FOOD_HUNGER_RELIEF_BY_LEVEL.${i}`) ? fmtNum(V(`FOOD_HUNGER_RELIEF_BY_LEVEL.${i}`) / r, 0) + ' s' : '—')];
      });
      return tbl(`Critical threshold works out to hunger ${fmtNum(crit, 1)} of ${fmtVal(max)}`, ['Species', 'Hungry after', 'Critical after', 'Starves after', 'One Food (Lv 0)', 'Lv 1', 'Lv 2', 'Lv 3', 'Lv 4', 'Lv 5'], rows);
    },
  },
  {
    id: 'cleanliness', title: 'Tank cleanliness',
    formula: 'coin value × ( min fraction + cleanliness% × (1 − min fraction) )\nevery Waste item that appears lowers cleanliness by a fixed amount; eating or processing it restores the same',
    note: 'A dirty tank only cuts coin value (it never changes hunger or timing). Use the input to see how fast a given number of Waste-producing fish dirty the tank if nothing cleans it.',
    params: ['CLEANLINESS_MIN_MONEY_FRACTION', 'CLEANLINESS_PER_WASTE_EVENT', 'CLEANLINESS_WARNING_THRESHOLD', 'WASTE_POOP_INTERVAL_MS'],
    inputs: [{ key: 'fish', label: 'Waste-producing fish', value: 10, min: 1, max: 500, step: 1 }],
    render(inp) {
      const m = V('CLEANLINESS_MIN_MONEY_FRACTION');
      const rows = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0].map((c) => [c + '%', '× ' + fmtNum(m + c / 100 * (1 - m), 3)]);
      const per = V('CLEANLINESS_PER_WASTE_EVENT', 1), warn = V('CLEANLINESS_WARNING_THRESHOLD');
      const rate = inp.fish * 60000 / V('WASTE_POOP_INTERVAL_MS', 1); // waste per minute
      return tbl('Coin value multiplier', ['Clean', 'Multiplier'], rows) +
        `<div>${tbl('Dirtying (nothing cleaning)', ['', ''], [
          ['Waste items to reach the warning (' + warn + '%)', fmtNum((100 - warn) / per, 0)],
          ['Waste items to hit 0%', fmtNum(100 / per, 0)],
          [`Waste / min from ${inp.fish} fish`, fmtNum(rate, 1)],
          ['Minutes until the warning', fmtNum((100 - warn) / per / rate, 1)],
          ['Minutes until 0%', fmtNum(100 / per / rate, 1)],
        ])}</div>`;
    },
  },
  {
    id: 'power', title: 'Power efficiency',
    formula: 'shortfall% = 100 − min(100, supply / demand × 100)\nefficiency% = clamp( 100 − shortfall% × penalty, 0, 100 )',
    note: 'How much of its speed a power-using building keeps when the grid is short. Below the stalled threshold a building also refuses to take in new items. Turrets that need power only fire at 100%.',
    params: ['POWER_DEFICIT_PENALTY_MULTIPLIER', 'POWER_SHORTAGE_STALLED_THRESHOLD'],
    render() {
      const k = V('POWER_DEFICIT_PENALTY_MULTIPLIER'), th = V('POWER_SHORTAGE_STALLED_THRESHOLD');
      const rows = [100, 95, 90, 85, 80, 75, 70, 60, 50, 40, 25, 0].map((sup) => {
        const short = 100 - sup, eff = Math.max(0, Math.min(100, 100 - short * k));
        return [sup + '%', short + '%', { t: fmtNum(eff, 0) + '%', cls: eff / 100 < th ? 'warn' : eff >= 100 ? 'good' : '' }, eff / 100 < th ? 'stalled (no new items)' : eff >= 100 ? 'full speed' : 'slowed'];
      });
      return tbl('', ['Supply as % of demand', 'Shortfall', 'Efficiency', 'State'], rows);
    },
  },
  {
    id: 'waves', title: 'Alien waves',
    formula: 'difficulty t = min(1, wavesAlreadySpawned / ramp waves)\naliens per wave = lerp(early range, late range, t)   (wave 1 is always exactly one alien)\ngap to next wave = lerp(early gap, late gap, t);  tier mix = interpolated keyframe weights',
    note: 'Wave size, spacing and which alien tiers appear, by wave number. “Avg HP” is the weighted average of the tier HP midpoints; “Wave HP” multiplies it by the average alien count. Time is the cumulative minutes at which the wave arrives (ignoring how long you take to clear each). The tier-mix keyframes live in the Variables tab (Aliens & waves).',
    params: ['ALIEN_WAVE_DIFFICULTY_RAMP_WAVES', 'ALIEN_WAVE_COUNT_EARLY_MIN', 'ALIEN_WAVE_COUNT_EARLY_MAX', 'ALIEN_WAVE_COUNT_LATE_MIN', 'ALIEN_WAVE_COUNT_LATE_MAX', 'ALIEN_WAVE_INTERVAL_EARLY_MS', 'ALIEN_WAVE_INTERVAL_LATE_MS', 'ALIEN_FIRST_WAVE_EARLY_MS', 'ALIEN_MAX_ALIVE',
      ...[0, 1, 2, 3, 4].flatMap((i) => [`ALIEN_ARCHETYPES.${i}.hpMin`, `ALIEN_ARCHETYPES.${i}.hpMax`])],
    render() {
      const waves = [1, 2, 3, 5, 8, 10, 15, 20, 30, 40, 48, 60];
      let clock = (V('ALIEN_WAVE_INTERVAL_EARLY_MS') - V('ALIEN_FIRST_WAVE_EARLY_MS')) / 60000;
      const arrival = {};
      for (let w = 1; w <= 60; w++) { arrival[w] = clock; clock += waveModel(w).gapMs / 60000; }
      const rows = waves.map((w) => {
        const m = waveModel(w);
        const mix = m.w.map((x, i) => x >= 0.005 ? `T${i + 1} ${Math.round(x * 100)}%` : null).filter(Boolean).join(' · ');
        return [w, fmtNum(m.t, 2), m.lo === m.hi ? m.lo : `${m.lo}–${m.hi}`, fmtNum(m.gapMs / 60000, 1) + ' min', fmtNum(arrival[w], 0) + ' min', fmtNum(m.avgHp, 0), fmtNum(m.waveHp, 0), mix];
      });
      return tbl('', ['Wave', 't', 'Aliens', 'Gap after it', 'Arrives at', 'Avg HP', 'Wave HP', 'Tier mix'], rows) +
        `<div class="fsmall">Aliens alive at once are capped at ${fmtVal(V('ALIEN_MAX_ALIVE'))}.</div>`;
    },
  },
  {
    id: 'turrets', title: 'Turret damage vs waves',
    formula: 'DPS = shots/sec × fire-rate bonus ^ upgrades × damage     (Biomass ammo multiplies damage)\nseconds to clear a wave = wave HP / (turrets × DPS)\nammo / min = shots per minute / shots per Waste (or per Biomass)',
    note: 'Compares each turret tier with a chosen wave from the Alien waves table above. Fire Rate I and II (Science Lab) each multiply shots/sec. This ignores travel time, overkill and aliens that are out of reach.',
    params: [...['TILE_TURRET_WASTE', 'TILE_TURRET_ELECTRIC', 'TILE_TURRET_ADVANCED'].flatMap((t) => [`TURRET_STATS.${t}.shotsPerSec`, `TURRET_STATS.${t}.damage`, `TURRET_STATS.${t}.powerCostPerShot`]), 'TURRET_FIRE_RATE_UPGRADE_MULTIPLIER', 'WASTE_TURRET_SHOTS_PER_WASTE', 'BIOMASS_TURRET_SHOTS_PER_AMMO', 'BIOMASS_TURRET_DAMAGE_MULTIPLIER', 'ADVANCED_TURRET_BIOMASS_DAMAGE'],
    inputs: [
      { key: 'turrets', label: 'Turrets', value: 5, min: 1, max: 200, step: 1 },
      { key: 'upgrades', label: 'Fire Rate nodes bought', value: 0, options: [0, 1, 2] },
      { key: 'wave', label: 'Wave', value: 10, min: 1, max: 200, step: 1 },
      { key: 'biomass', label: 'Ammo', value: 'waste', options: ['waste', 'biomass'] },
    ],
    render(inp) {
      const m = waveModel(inp.wave);
      const bonus = Math.pow(V('TURRET_FIRE_RATE_UPGRADE_MULTIPLIER', 1), inp.upgrades);
      const bio = inp.biomass === 'biomass';
      const rows = ['TILE_TURRET_WASTE', 'TILE_TURRET_ELECTRIC', 'TILE_TURRET_ADVANCED'].filter((t) => has(`TURRET_STATS.${t}.shotsPerSec`)).map((t) => {
        const shots = V(`TURRET_STATS.${t}.shotsPerSec`) * bonus;
        const advanced = t === 'TILE_TURRET_ADVANCED';
        const dmg = V(`TURRET_STATS.${t}.damage`) * (bio && !advanced ? V('BIOMASS_TURRET_DAMAGE_MULTIPLIER', 1) : 1);
        const dps = shots * dmg;
        const ammoPerMin = advanced ? null : shots * 60 / (bio ? V('BIOMASS_TURRET_SHOTS_PER_AMMO', 1) : V('WASTE_TURRET_SHOTS_PER_WASTE', 1));
        return [tileName(t), fmtNum(shots, 2), fmtNum(dmg, 1), fmtNum(dps, 1), fmtNum(dps * inp.turrets, 0), ammoPerMin == null ? 'none needed' : fmtNum(ammoPerMin * inp.turrets, 1) + (bio ? ' Biomass' : ' Waste'), fmtNum(V(`TURRET_STATS.${t}.powerCostPerShot`) * shots * inp.turrets, 0) + ' mw', fmtNum(m.waveHp / Math.max(1, dps * inp.turrets), 1) + ' s'];
      });
      return tbl(`Wave ${inp.wave}: about ${fmtNum(m.count, 1)} aliens, ${fmtNum(m.waveHp, 0)} total HP — with ${inp.turrets} turrets`, ['Tier', 'Shots / s', 'Damage / shot', 'DPS each', 'DPS total', 'Ammo / min (all)', 'Power (all)', 'Time to clear'], rows);
    },
  },
  {
    id: 'fishHealth', title: 'Fish health vs alien damage',
    formula: 'seconds to kill a fish = fish HP / alien damage per second',
    note: 'How long a single alien of each tier needs to kill a fish of each growth stage that it keeps touching (damage ticks once per interval while they overlap). Fish regenerate to full over the regen time once no alien is alive.',
    params: ['FISH_HEALTH_BABY', 'FISH_HEALTH_MID', 'FISH_HEALTH_ADULT', 'FISH_HEALTH_REGEN_DURATION_MS', 'FISH_HEALTH_UPGRADE_BONUS_PER_LEVEL', ...[0, 1, 2, 3, 4].map((i) => `ALIEN_ARCHETYPES.${i}.fishDamagePerSec`), 'BOSS_FISH_DAMAGE_PER_SEC'],
    render() {
      const arch = archetypes();
      const stages = [['Baby', V('FISH_HEALTH_BABY')], ['Mid', V('FISH_HEALTH_MID')], ['Adult', V('FISH_HEALTH_ADULT')]];
      const rows = arch.map((a) => [a.name + ` (${fmtNum(a.dmg, 1)}/s)`, ...stages.map(([, hp]) => fmtNum(hp / Math.max(0.0001, a.dmg), 1) + ' s')]);
      rows.push(['Boss (' + fmtNum(V('BOSS_FISH_DAMAGE_PER_SEC'), 0) + '/s)', ...stages.map(([, hp]) => fmtNum(hp / Math.max(0.0001, V('BOSS_FISH_DAMAGE_PER_SEC', 1)), 1) + ' s')]);
      return tbl('', ['Alien', ...stages.map(([n, hp]) => `${n} (${fmtNum(hp, 0)} HP)`)], rows);
    },
  },
  {
    id: 'fan', title: 'Fan lift (hover height)',
    formula: 'an item hovers where the fan’s push equals its weight:\nhover fraction = 1 − mass × gravity / max force      (food uses its own lighter gravity)\nhover distance = hover fraction × range;   if the fraction is ≤ 0 the fan can’t lift it',
    note: 'The fan’s push fades linearly from its max force at the fan to zero at its range. Heavier items need a stronger fan and hover lower. Table shows hover height in tiles above the fan.',
    params: ['GRAVITY', 'FOOD_GRAVITY', ...['T2', 'T3', 'T4'].flatMap((t) => [`FAN_${t}_MAX_FORCE`, `FAN_${t}_MAX_RANGE`]), ...['food', 'waste', 'coin', 'science', 'biomass'].map((i) => `ITEM_MASS_BY_TYPE.${i}`)],
    render() {
      const tile = meta.tileSize || 32;
      const items = ['food', 'waste', 'coin', 'science', 'biomass'].filter((i) => has(`ITEM_MASS_BY_TYPE.${i}`));
      const rows = items.map((it) => {
        const mass = V(`ITEM_MASS_BY_TYPE.${it}`), g = it === 'food' ? V('FOOD_GRAVITY') : V('GRAVITY');
        return [`${it} (mass ${fmtVal(mass)})`, ...['T2', 'T3', 'T4'].map((t) => {
          const f = 1 - mass * g / V(`FAN_${t}_MAX_FORCE`, 1);
          return f <= 0 ? { t: 'can’t lift', cls: 'warn' } : fmtNum(f * V(`FAN_${t}_MAX_RANGE`) / tile, 1) + ' tiles';
        })];
      });
      return tbl('Hover height above the fan', ['Item', ...['T2', 'T3', 'T4'].map((t) => `${tileName('TILE_FAN_' + t)} (range ${fmtNum(V(`FAN_${t}_MAX_RANGE`) / tile, 1)} tiles)`)], rows);
    },
  },
  {
    id: 'throughput', title: 'Building throughput & power',
    formula: 'items / min = 60000 / process time ms\npower per item = power draw (mw) × process seconds\nManufacturer cycle = sum of its two ingredients’ process times;  Bio-Sludge takes the Refinery ×multiplier longer',
    note: 'What each processing building can chew through per minute, and how much electricity each item costs. Use it to size how many Collectors/Refineries a base of N fish needs.',
    params: [...['TILE_COLLECTOR', 'TILE_COLLECTOR_ELECTRIC', 'TILE_COLLECTOR_ADVANCED'].flatMap((t) => [`PROCESSOR_STATS.${t}.coinMs`, `PROCESSOR_STATS.${t}.powerCostPerSecCoin`]),
      ...['TILE_REFINERY', 'TILE_REFINERY_ELECTRIC', 'TILE_REFINERY_ADVANCED'].flatMap((t) => [`REFINERY_STATS.${t}.foodProcessMs`, `REFINERY_STATS.${t}.powerCostPerSec`]), 'ALIEN_DNA_REFINERY_TIME_MULTIPLIER',
      ...['waste', 'food', 'biomass', 'science'].flatMap((i) => [`MANUFACTURER_ITEM_PROCESS_MS.${i}`, `MANUFACTURER_ITEM_POWER_COST_MW.${i}`])],
    render() {
      const col = ['TILE_COLLECTOR', 'TILE_COLLECTOR_ELECTRIC', 'TILE_COLLECTOR_ADVANCED'].filter((t) => has(`PROCESSOR_STATS.${t}.coinMs`)).map((t) => {
        const ms = V(`PROCESSOR_STATS.${t}.coinMs`, 1), sci = V(`PROCESSOR_STATS.${t}.scienceMs`, 1);
        return [tileName(t), fmtNum(60000 / ms, 1) + ' coins', fmtNum(V(`PROCESSOR_STATS.${t}.powerCostPerSecCoin`) * ms / 1000, 0) + ' mw·s', fmtNum(60000 / sci, 1) + ' Science', fmtNum(V(`PROCESSOR_STATS.${t}.powerCostPerSecScience`) * sci / 1000, 0) + ' mw·s'];
      });
      const ref = ['TILE_REFINERY', 'TILE_REFINERY_ELECTRIC', 'TILE_REFINERY_ADVANCED'].filter((t) => has(`REFINERY_STATS.${t}.foodProcessMs`)).map((t) => {
        const ms = V(`REFINERY_STATS.${t}.foodProcessMs`, 1), mult = V('ALIEN_DNA_REFINERY_TIME_MULTIPLIER', 1), p = V(`REFINERY_STATS.${t}.powerCostPerSec`);
        return [tileName(t), fmtNum(60000 / ms, 1) + ' Waste', fmtNum(p * ms / 1000, 0) + ' mw·s', fmtNum(60000 / (ms * mult), 1) + ' Bio-Sludge', fmtNum(p * ms * mult / 1000, 0) + ' mw·s'];
      });
      const man = (meta.manufacturerRecipes || []).map((r) => {
        const ms = r.inputs.reduce((a, i) => a + V(`MANUFACTURER_ITEM_PROCESS_MS.${i}`), 0);
        const e = r.inputs.reduce((a, i) => a + V(`MANUFACTURER_ITEM_POWER_COST_MW.${i}`) * V(`MANUFACTURER_ITEM_PROCESS_MS.${i}`) / 1000, 0);
        return [r.name, r.inputs.join(' + '), fmtNum(ms / 1000, 0) + ' s', fmtNum(60000 / ms, 1) + ' / min', fmtNum(e, 0) + ' mw·s'];
      });
      return tbl('Collector', ['', 'Coins / min', 'Power per coin', 'Science / min', 'Power per Science'], col) +
        tbl('Refinery', ['', 'Waste → Food / min', 'Power per Food', 'Bio-Sludge → Biomass / min', 'Power per Biomass'], ref) +
        tbl('Manufacturer (one recipe cycle)', ['Recipe', 'Ingredients', 'Cycle', 'Rate', 'Power per output'], man);
    },
  },
  {
    id: 'progression', title: 'Progression costs',
    formula: 'Mound: tease → crack 1 → crack 2 (shatters into the Science Lab)\nScience Lab: every node costs gold, Science and sometimes Green Science',
    note: 'Total price of everything in the Science Lab and the Mound, so you can see the size of the whole progression and its most expensive nodes. The per-node numbers are in the Variables tab (Science Lab).',
    params: ['MOUND_TEASE_COST', 'MOUND_CRACK_COST.1', 'MOUND_CRACK_COST.2', ...[0, 1, 2, 3, 4].map((i) => `TANK_EXPANSION_UPGRADE_COSTS.${i}`)],
    render() {
      const nodes = {};
      for (const v of vars.values()) {
        const m = /^SCIENCE_LAB_UPGRADES\.([^.]+)\.(goldCost|scienceCost|scienceGreenCost)$/.exec(v.id);
        if (m) { (nodes[m[1]] ||= { name: v.label.split(':')[0], gold: 0, sci: 0, green: 0 }); nodes[m[1]][m[2] === 'goldCost' ? 'gold' : m[2] === 'scienceCost' ? 'sci' : 'green'] = v.value; }
      }
      const list = Object.values(nodes);
      const sum = (k) => list.reduce((a, n) => a + n[k], 0);
      const top = [...list].sort((a, b) => b.gold - a.gold).slice(0, 8);
      const tp = [0, 1, 2, 3, 4].reduce((a, i) => a + V(`TANK_EXPANSION_UPGRADE_COSTS.${i}`), 0);
      return tbl('Science Lab totals', ['', ''], [['Nodes', list.length], ['Total gold', money(sum('gold'))], ['Total Science', fmtNum(sum('sci'), 0)], ['Total Green Science', fmtNum(sum('green'), 0)]]) +
        tbl('Most expensive nodes (gold)', ['Node', 'Gold', 'Science', 'Green'], top.map((n) => [n.name, money(n.gold), fmtNum(n.sci, 0), fmtNum(n.green, 0)])) +
        tbl('Mound & tank expansion', ['', ''], [['Mound: tease + both cracks', money(V('MOUND_TEASE_COST') + V('MOUND_CRACK_COST.1') + V('MOUND_CRACK_COST.2'))], ['Tank expansion (all tiers, Tank Points)', fmtNum(tp, 0)]]);
    },
  },
  {
    id: 'gems', title: 'Fishy Gems vs hats',
    formula: 'gems you can earn = Σ over achievements of (reward for its tier)\ntotal hat cost = Σ hat prices',
    note: 'The gem economy was tuned so that all hats cost somewhat less than all achievements pay (so you do not need every hard achievement). This shows the current balance.',
    params: ['ACHIEVEMENT_GEM_REWARD_BY_TIER.easy', 'ACHIEVEMENT_GEM_REWARD_BY_TIER.medium', 'ACHIEVEMENT_GEM_REWARD_BY_TIER.hard'],
    render() {
      const counts = meta.achievementTierCounts || {};
      const earn = ['easy', 'medium', 'hard'].reduce((a, t) => a + (counts[t] || 0) * V(`ACHIEVEMENT_GEM_REWARD_BY_TIER.${t}`), 0);
      const hats = [...vars.values()].filter((v) => /^HATS\.[^.]+\.gemCost$/.test(v.id));
      const cost = hats.reduce((a, v) => a + v.value, 0);
      const costs = hats.map((v) => v.value).sort((a, b) => a - b);
      return tbl('', ['', ''], [
        ['Achievements (easy / medium / hard)', ['easy', 'medium', 'hard'].map((t) => counts[t] || 0).join(' / ')],
        ['Gems from all achievements', fmtNum(earn, 0)],
        ['Hats', hats.length],
        ['Total hat cost', fmtNum(cost, 0)],
        ['Hats cost ÷ gems earnable', { t: earn ? fmtNum(cost / earn * 100, 1) + '%' : '—', cls: '' }],
        ['Cheapest / dearest hat', costs.length ? `${costs[0]} / ${costs[costs.length - 1]}` : '—'],
      ]) + `<div class="fsmall">Hat prices are in the Variables tab (Achievements & hats).</div>`;
    },
  },
];

const cardState = {};     // card id -> { inputs, previewEl }
function buildFormulas() {
  const root = VIEWS.formulas;
  root.classList.add('wide');
  root.replaceChildren(h('div', { class: 'tnote', html: '<b>Formulas.</b> Each card shows how a number in the game is calculated, the values it depends on (sliders — same values and same saving as the Variables tab; <b>reload the game tab</b> to see them in play), and a live table of what the formula produces. Tables update as you drag. Tables use the current slider values, not the game’s live state.' }));
  for (const f of FORMULAS) {
    const present = f.params.filter(has);
    const st = (cardState[f.id] = { inputs: {}, previewEl: h('div', { class: 'fprev' }) });
    const card = h('section', { class: 'fcard' }, h('h2', {}, f.title), h('div', { class: 'formula' }, f.formula), h('div', { class: 'fnote' }, f.note));
    if (present.length) {
      const det = h('details', { class: 'fparams' }, h('summary', {}, `Adjust values (${present.length})`));
      if (present.length <= 8) det.open = true;
      const grid = h('div', { class: 'fgrid' });
      for (const id of present) grid.append(buildRow(vars.get(id)));
      det.append(grid);
      card.append(det);
    }
    if (f.inputs) {
      const bar = h('div', { class: 'finputs' });
      for (const inp of f.inputs) {
        st.inputs[inp.key] = inp.value;
        const control = inp.options
          ? h('select', { onchange: (e) => { st.inputs[inp.key] = typeof inp.value === 'number' ? +e.target.value : e.target.value; renderCard(f); } }, inp.options.map((o) => h('option', { value: o, selected: o === inp.value }, o)))
          : h('input', { type: 'number', min: inp.min, max: inp.max, step: inp.step, value: inp.value, oninput: (e) => { st.inputs[inp.key] = +e.target.value || inp.min; renderCard(f); } });
        bar.append(h('label', {}, inp.label + ' ', control));
      }
      card.append(bar);
    }
    card.append(st.previewEl);
    root.append(card);
    renderCard(f);
  }
}
function renderCard(f) {
  const st = cardState[f.id];
  if (!st) return;
  try { st.previewEl.innerHTML = f.render(st.inputs); } catch (e) { st.previewEl.textContent = 'Could not compute: ' + e.message; }
}
function renderAllPreviews() { for (const f of FORMULAS) renderCard(f); }

// After a commit the "default" (last commit) values have moved, so re-read everything.
window.addEventListener('devtools:committed', () => { if (loadPromise) { loadPromise = null; ensureLoaded(); } });

showTab(startTab);
