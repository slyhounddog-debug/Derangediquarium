// The Text tab of the dev tool: every player-facing string in the game (shop and building descriptions, Science Lab
// nodes, recipes, achievements, the chat messages, tutorials, the windows and buttons in index.html, ...), editable in place.
//
// Same model as the Variables tab: an edit is written straight into the game's own source file through /api/text
// (see text.mjs), "default" is the string in the last git commit, and you reload the game tab to see it.

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

const view = $('#view-text');
const statusEl = $('#status');
let statusTimer = null;
function say(msg, bad) {
  statusEl.textContent = msg;
  statusEl.style.color = bad ? 'var(--bad)' : 'var(--mute)';
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (statusEl.textContent = ''), 3500);
}

document.head.append(h('style', { html: `
  .trow { display:grid; grid-template-columns: minmax(190px, .8fr) minmax(280px, 2.6fr) 150px; gap:6px 14px; align-items:start; padding:6px 0; border-bottom:1px solid #1d2f3f; }
  .trow.changed { background:rgba(255,179,71,.07); }
  .trow .vname { padding-top:4px; }
  .trow textarea { width:100%; font:inherit; font-size:14px; line-height:1.4; color:var(--ink); background:#16273a; border:1px solid var(--line); border-radius:6px; padding:5px 8px; resize:vertical; min-height:30px; field-sizing:content; }
  .trow textarea:focus { outline:1px solid var(--acc); }
  .trow.bad textarea { border-color:var(--bad); }
  .trow .tflag { color:var(--mute); font-size:11px; margin-top:2px; }
  .trow .tdef { display:flex; flex-direction:column; gap:4px; align-items:flex-start; color:var(--mute); font-size:12px; padding-top:2px; }
  .trow .tdef button { padding:2px 8px; font-size:12px; }
  .trow .tdef button:disabled { opacity:.35; cursor:default; }
  .trow .tdef .was { max-height:3.9em; overflow:hidden; overflow-wrap:anywhere; }
  .tgroupnote { color:var(--mute); font-size:13px; margin:6px 0 4px; }
` }));

let data = null;
const entries = new Map();      // id -> entry
const updaters = new Map();     // id -> fn that refreshes that entry's row if it is on screen
const groupEls = [];
let loaded = false, loadPromise = null;
const fieldSizing = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('field-sizing', 'content');

const isChanged = (e) => e.original !== null && e.value !== e.original;
const excerpt = (s, n = 140) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

async function load() {
  try {
    const r = await fetch('/api/text');
    if (!r.ok) throw new Error((await r.json()).error || r.status);
    data = await r.json();
    entries.clear();
    updaters.clear();
    for (const g of data.groups) for (const e of g.entries) { e.search = `${e.sub} ${e.label} ${e.code}`.toLowerCase(); entries.set(e.id, e); }
    build();
    loaded = true;
  } catch (e) {
    view.replaceChildren(h('div', { class: 'tnote' }, 'Could not load the game text: ' + e.message));
    loadPromise = null;
  }
}
function ensureLoaded() { if (!loadPromise) loadPromise = load(); return loadPromise; }

// Pull fresh values for everything (used after an edit to a string that sits inside another string's template,
// where saving one changes what the other one looks like).
async function syncAll() {
  try {
    const r = await fetch('/api/text');
    if (!r.ok) return;
    const fresh = await r.json();
    for (const g of fresh.groups) for (const f of g.entries) {
      const e = entries.get(f.id);
      if (!e) continue;
      e.value = f.value; e.original = f.original;
      (updaters.get(e.id) || (() => {}))();
    }
    updateCounts();
  } catch { /* the next full reload will catch up */ }
}

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error);
  return j;
}
async function save(e, text, row) {
  try {
    const j = await post('/api/text/set', { id: e.id, value: text, base: e.value });
    e.value = j.value;
    say(`Saved “${e.sub} · ${e.label}” (reload the game tab to see it)`);
    window.dispatchEvent(new Event('devtools:changed'));
    if (e.linked) syncAll();
  } catch (err) {
    say('Could not save: ' + err.message, true);
    row.classList.add('bad');
    setTimeout(() => row.classList.remove('bad'), 2500);
  }
  (updaters.get(e.id) || (() => {}))();
  updateCounts();
}
async function reset(e) {
  try {
    const j = await post('/api/text/reset', { id: e.id });
    e.value = j.value;
    say(`Reset “${e.sub} · ${e.label}” to the committed text`);
    window.dispatchEvent(new Event('devtools:changed'));
    if (e.linked) syncAll();
  } catch (err) { say('Could not reset: ' + err.message, true); }
  (updaters.get(e.id) || (() => {}))();
  updateCounts();
}

function buildRow(e) {
  const ta = h('textarea', { spellcheck: 'true', rows: Math.max(1, Math.min(8, Math.ceil(e.value.length / 70) + (e.value.split('\n').length - 1))) });
  const resetBtn = h('button', { title: 'Put back the text from the last git commit' }, 'Reset');
  const was = h('span', { class: 'was' });
  const row = h('div', { class: 'trow', 'data-id': e.id },
    h('div', { class: 'vname' }, h('span', { class: 'vlabel' }, e.label), h('span', { class: 'vcode', title: e.code }, e.code)),
    h('div', {}, ta, e.raw ? h('div', { class: 'tflag', title: 'The game fills in each ${ } part while it runs' }, 'Contains ${ } parts the game fills in — keep each one exactly as it is.') : null),
    h('div', { class: 'tdef' }, resetBtn, was));
  const autosize = () => { if (!fieldSizing) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; } };
  const update = () => {
    if (document.activeElement !== ta) { ta.value = e.value; autosize(); }
    const changed = isChanged(e);
    row.classList.toggle('changed', changed);
    resetBtn.disabled = !changed;
    was.textContent = e.original === null ? 'new (not committed)' : changed ? 'was: ' + excerpt(e.original, 120) : '';
    was.title = changed ? e.original : '';
  };
  ta.addEventListener('input', autosize);
  ta.addEventListener('change', () => { if (ta.value !== e.value) save(e, ta.value, row); });
  ta.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { ta.value = e.value; autosize(); ta.blur(); }
    else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) ta.blur();
  });
  resetBtn.addEventListener('click', () => reset(e));
  updaters.set(e.id, update);
  ta.value = e.value;
  update();
  requestAnimationFrame(autosize);
  return row;
}

function build() {
  view.classList.add('wide');
  view.replaceChildren();
  groupEls.length = 0;
  const total = entries.size;
  const search = h('input', { type: 'search', placeholder: 'Search the text itself or its name (e.g. guppy, wave, tutorial)…' });
  const changedOnly = h('input', { type: 'checkbox' });
  const totals = h('span', { style: 'color:var(--mute)' }, `${total} texts`);
  const resetAll = h('button', { class: 'danger', title: 'Put every text back to the last git commit' }, 'Reset all changed');
  view.append(
    h('div', { class: 'tnote', html: '<b>How this works.</b> Edit any text and click away (or press <b>Ctrl+Enter</b>; <b>Esc</b> undoes the box): the new wording is written straight into the game’s own source file (<code>js/Config.js</code>, <code>js/UI.js</code>, <code>index.html</code>, …); <b>reload the game tab</b> to see it. “Was” is the text in the last git commit, so <b>Reset</b> always has somewhere to go back to, and <code>git diff</code> shows everything you changed. Text with <code>${ }</code> in it has parts the game fills in while it runs (names, numbers) — keep those exactly as they are. Chat messages and descriptions that quote numbers do <b>not</b> follow the Variables tab; change both if you change a price or a rate.' }),
    h('div', { class: 'tbar' }, search, h('label', {}, changedOnly, 'Changed only'), totals,
      h('button', { onclick: () => groupEls.forEach((g) => (g.det.open = true)) }, 'Expand all'),
      h('button', { onclick: () => groupEls.forEach((g) => (g.det.open = false)) }, 'Collapse all'), resetAll));
  if (data.problems.length) view.append(h('div', { class: 'tnote' }, 'Skipped: ' + data.problems.join('; ')));

  const filterOf = () => {
    const q = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const co = changedOnly.checked;
    return { q, co, active: q.length > 0 || co, test: (e) => (!co || isChanged(e)) && q.every((t) => e.search.includes(t) || e.value.toLowerCase().includes(t)) };
  };
  // A group's rows are only built when it is open (there are well over a thousand texts), and rebuilt when the filter changes.
  const renderGroup = (ge) => {
    if (!ge.det.open) { ge.dirty = true; return; }
    ge.dirty = false;
    const f = ge.filter = filterOf();
    const list = ge.g.entries.filter(f.test);
    ge.shown = list.length;
    const frag = document.createDocumentFragment();
    if (ge.g.note) frag.append(h('div', { class: 'tgroupnote' }, ge.g.note));
    let lastSub = null;
    for (const e of list) {
      if (e.sub !== lastSub) { frag.append(h('div', { class: 'vsub' }, e.sub)); lastSub = e.sub; }
      frag.append(buildRow(e));
    }
    if (!list.length) frag.append(h('div', { class: 'fsmall' }, 'Nothing matches.'));
    ge.body.replaceChildren(frag);
  };
  for (const g of data.groups) {
    const countEl = h('span', { class: 'vcount' });
    const changedEl = h('span', { class: 'vchanged' });
    const det = h('details', { class: 'vgroup' }, h('summary', {}, g.label, countEl, changedEl));
    const body = h('div', { class: 'vbody' });
    det.append(body);
    const ge = { det, g, body, countEl, changedEl, dirty: true, shown: g.entries.length };
    det.addEventListener('toggle', () => { if (det.open && ge.dirty) renderGroup(ge); });
    view.append(det);
    groupEls.push(ge);
  }
  const applyFilter = () => {
    const f = filterOf();
    let shown = 0;
    for (const ge of groupEls) {
      const n = ge.g.entries.filter(f.test).length;
      shown += n;
      ge.det.style.display = n ? '' : 'none';
      if (f.active && n) ge.det.open = true;
      ge.dirty = true;
      renderGroup(ge);
      ge.countEl.textContent = f.active ? `${n} of ${ge.g.entries.length} texts` : `${ge.g.entries.length} texts`;
    }
    totals.textContent = f.active ? `${shown} of ${total} shown` : `${total} texts`;
  };
  let t = null;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(applyFilter, 120); });
  changedOnly.addEventListener('change', applyFilter);
  resetAll.addEventListener('click', async () => {
    const changed = [...entries.values()].filter(isChanged);
    if (!changed.length) { say('Nothing is changed'); return; }
    if (!confirm(`Reset ${changed.length} changed text${changed.length > 1 ? 's' : ''} to the last git commit?`)) return;
    for (const e of changed) await reset(e);
    say(`Reset ${changed.length} texts`);
  });
  view.applyFilter = applyFilter;
  updateCounts();
}

function updateCounts() {
  for (const ge of groupEls) {
    const changed = ge.g.entries.filter(isChanged).length;
    ge.changedEl.textContent = changed ? `${changed} changed` : '';
    if (!ge.filter || !ge.filter.active) ge.countEl.textContent = `${ge.g.entries.length} texts`;
  }
}

// ---- hooking into the tab bar (tuning.js owns the tab switching and announces which tab opened) ----
window.addEventListener('devtools:tab', (ev) => { if (ev.detail === 'text') ensureLoaded(); });
// After a commit the "was" text (last commit) has moved, so re-read everything.
window.addEventListener('devtools:committed', () => { if (loaded) { loaded = false; loadPromise = null; ensureLoaded(); } });
if ($('#tabs .tab.on')?.dataset.tab === 'text') ensureLoaded();
