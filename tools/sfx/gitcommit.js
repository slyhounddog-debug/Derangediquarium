// The persistent "Commit to GitHub" button in the header (works from every tab) and its review dialog.
// The server (gitcommit.mjs) summarises what changed; nothing is committed or pushed until the dialog's
// confirm button is pressed.

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

document.head.append(h('style', { html: `
  #commitBtn { background:#245c3d; border-color:#33895a; font-weight:600; display:flex; gap:8px; align-items:center; }
  #commitBtn:hover { background:#2c7549; }
  #commitBtn .badge { background:var(--acc); color:#1b1204; border-radius:99px; padding:0 8px; font-size:12px; min-width:20px; text-align:center; }
  #commitBtn .badge.zero { background:#35516a; color:var(--mute); }
  #commitOverlay { position:fixed; inset:0; background:rgba(5,10,16,.7); z-index:50; display:flex; align-items:flex-start; justify-content:center; padding:5vh 16px; overflow:auto; }
  #commitModal { background:var(--card); border:1px solid var(--line); border-radius:14px; width:min(820px, 100%); padding:18px 22px; box-shadow:0 20px 60px rgba(0,0,0,.5); }
  #commitModal h2 { margin:0 0 4px; font-size:19px; }
  #commitModal .sub { color:var(--mute); font-size:13px; margin-bottom:12px; }
  #commitModal label.lbl { display:block; color:var(--mute); font-size:12px; margin:10px 0 3px; }
  #commitModal input[type=text], #commitModal textarea { width:100%; font:inherit; color:var(--ink); background:#16273a; border:1px solid var(--line); border-radius:8px; padding:7px 10px; }
  #commitModal textarea { min-height:180px; font-family:Consolas, monospace; font-size:13px; resize:vertical; }
  #commitModal .files { max-height:230px; overflow:auto; border:1px solid var(--line); border-radius:8px; background:#10202f; padding:6px 10px; font-size:13px; }
  #commitModal .files .grp { color:var(--acc); font-weight:600; margin:6px 0 2px; }
  #commitModal .files label { display:flex; gap:8px; align-items:baseline; padding:1px 0; cursor:pointer; }
  #commitModal .files .st { color:var(--mute); font-size:11px; min-width:52px; }
  #commitModal .files .dif { color:var(--mute); font-size:11px; margin-left:auto; white-space:nowrap; }
  #commitModal .actions { display:flex; gap:10px; justify-content:flex-end; margin-top:14px; align-items:center; }
  #commitModal .result { margin-top:10px; padding:9px 12px; border-radius:8px; font-size:13px; white-space:pre-wrap; }
  #commitModal .result.ok { background:#1f4a35; color:#b9f0d0; }
  #commitModal .result.bad { background:#4a2323; color:#ffc9c9; }
  #revertBtn { background:#5a2d2d; border-color:#8a4747; font-weight:600; }
  #revertBtn:hover { background:#733a3a; }
  #commitModal button.revert { background:#8a3030; border-color:#b34a4a; }
  #commitModal button.revert:hover { background:#a43a3a; }
  #commitModal button.revert.armed { background:#c22; border-color:#f66; }
  #commitModal .files .grp.warn { color:var(--bad); }
` }));

const btn = $('#commitBtn');
const badge = $('#commitBadge');
let counts = { count: 0, ahead: 0, branch: '' };

async function refreshCounts() {
  if (document.hidden) return;
  try {
    const r = await fetch('/api/git/counts');
    if (!r.ok) return;
    counts = await r.json();
    badge.textContent = counts.count;
    badge.classList.toggle('zero', counts.count === 0 && counts.ahead === 0);
    btn.title = `${counts.count} changed file${counts.count === 1 ? '' : 's'}` + (counts.ahead ? `, ${counts.ahead} commit${counts.ahead === 1 ? '' : 's'} not pushed` : '') + ` — on branch ${counts.branch}`;
  } catch { /* server restarting */ }
}
setInterval(refreshCounts, 5000);
window.addEventListener('devtools:changed', () => setTimeout(refreshCounts, 400));
window.addEventListener('focus', refreshCounts);
refreshCounts();

let overlay = null;
let reloadOnClose = false; // set by a successful revert: the Variables/Audio tabs are showing values that no longer exist
function closeModal() { if (overlay) { overlay.remove(); overlay = null; if (reloadOnClose) location.reload(); } }

btn.addEventListener('click', async () => {
  if (overlay) return;
  btn.disabled = true;
  let s;
  try {
    const r = await fetch('/api/git/summary');
    s = await r.json();
    if (!r.ok) throw new Error(s.error);
  } catch (e) { alert('Could not read the git status: ' + e.message); btn.disabled = false; return; }
  btn.disabled = false;
  openModal(s);
});

function openModal(s) {
  const noFiles = s.files.length === 0;
  const subject = h('input', { type: 'text', value: s.subject });
  const body = h('textarea', {}, s.body);
  body.value = s.body;
  const checks = [];
  const filesBox = h('div', { class: 'files' });
  const groups = [['variables', 'Values changed in the Variables tab (Config.js / Sound.js)'], ['audio', 'Sounds changed in the Audio tab (audio/sfx)'], ['other', 'Other changed files in the project']];
  for (const [key, title] of groups) {
    const list = s.files.filter((f) => f.group === key);
    if (!list.length) continue;
    filesBox.append(h('div', { class: 'grp' }, title));
    for (const f of list) {
      const cb = h('input', { type: 'checkbox', checked: true });
      checks.push({ cb, path: f.path });
      filesBox.append(h('label', {}, cb, h('span', { class: 'st' }, f.status), h('span', {}, f.path), h('span', { class: 'dif' }, f.adds != null ? `+${f.adds} −${f.dels}` : '')));
    }
  }
  const result = h('div');
  const go = h('button', { class: 'use' }, noFiles ? `Push ${s.ahead} commit${s.ahead === 1 ? '' : 's'}` : 'Commit & push');
  const cancel = h('button', {}, 'Cancel');
  overlay = h('div', { id: 'commitOverlay', onmousedown: (e) => { if (e.target === overlay) closeModal(); } },
    h('div', { id: 'commitModal' },
      h('h2', {}, 'Commit to GitHub'),
      h('div', { class: 'sub' }, `Branch ${s.branch} → origin. The message below was written from what changed; edit it if you like. Nothing is committed until you press the green button.` + (s.ahead && !noFiles ? ` (${s.ahead} earlier commit${s.ahead === 1 ? '' : 's'} not pushed yet will be pushed too.)` : '')),
      noFiles && !s.ahead ? h('div', { class: 'result ok' }, 'Nothing to commit — no files have changed since the last commit.') : null,
      noFiles ? null : [h('label', { class: 'lbl' }, 'Summary line'), subject, h('label', { class: 'lbl' }, 'Details'), body,
        h('label', { class: 'lbl' }, `Files (${s.files.length}) — untick anything you do not want in this commit`), filesBox,
        h('div', { style: 'margin-top:6px;display:flex;gap:10px' }, h('button', { onclick: () => checks.forEach((c) => (c.cb.checked = true)) }, 'Tick all'), h('button', { onclick: () => checks.forEach((c) => (c.cb.checked = false)) }, 'Untick all'))],
      result,
      h('div', { class: 'actions' }, cancel, (noFiles && !s.ahead) ? null : go)));
  document.body.append(overlay);
  cancel.addEventListener('click', closeModal);
  if (!noFiles) subject.select();
  go.addEventListener('click', async () => {
    const chosen = checks.filter((c) => c.cb.checked).map((c) => c.path);
    if (!noFiles && !chosen.length && !s.ahead) { result.className = 'result bad'; result.textContent = 'Tick at least one file.'; return; }
    go.disabled = cancel.disabled = true;
    result.className = 'result'; result.textContent = 'Committing and pushing…';
    try {
      const r = await fetch('/api/git/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: chosen, subject: subject.value, body: body.value }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (j.pushed) {
        result.className = 'result ok';
        result.textContent = (j.commit ? `Committed ${j.commit} (${j.files} file${j.files === 1 ? '' : 's'}) and pushed to origin/${j.branch}.` : `Pushed to origin/${j.branch}.`);
      } else {
        result.className = 'result bad';
        result.textContent = (j.commit ? `Committed ${j.commit}, but the push failed:\n` : 'The push failed:\n') + j.pushError + '\n\nThe commit is saved locally; press the button again to retry the push.';
      }
      window.dispatchEvent(new Event('devtools:committed'));
      refreshCounts();
    } catch (e) {
      result.className = 'result bad'; result.textContent = 'Failed: ' + e.message;
    }
    cancel.disabled = false; cancel.textContent = 'Close';
  });
}
// ---- Revert changes (button next to Commit) ----
// Same dialog shape as the commit one: tick which uncommitted files to throw away (or all of them). Modified and
// deleted files go back to the last commit; brand-new files have nothing to go back to, so they are DELETED, which
// is why they sit in their own group, start unticked, and the red button needs a second click to confirm.
const revertBtn = $('#revertBtn');
revertBtn.addEventListener('click', async () => {
  if (overlay) return;
  revertBtn.disabled = true;
  let s;
  try {
    const r = await fetch('/api/git/revert-list');
    s = await r.json();
    if (!r.ok) throw new Error(s.error);
  } catch (e) { alert('Could not read the git status: ' + e.message); revertBtn.disabled = false; return; }
  revertBtn.disabled = false;
  openRevertModal(s);
});

function openRevertModal(s) {
  const noFiles = s.files.length === 0;
  const checks = [];
  const filesBox = h('div', { class: 'files' });
  const groups = [
    ['variables', 'Values changed in the Variables tab (Config.js / Sound.js)'],
    ['audio', 'Sounds changed in the Audio tab (audio/sfx)'],
    ['other', 'Other changed files in the project'],
  ];
  const sections = [];
  for (const [key, title] of groups) sections.push([title, s.files.filter((f) => f.group === key && f.status !== 'new'), true, false]);
  sections.push(['New files — reverting these DELETES them (there is no earlier version)', s.files.filter((f) => f.status === 'new'), false, true]);
  for (const [title, list, ticked, warn] of sections) {
    if (!list.length) continue;
    filesBox.append(h('div', { class: 'grp' + (warn ? ' warn' : '') }, title));
    for (const f of list) {
      const cb = h('input', { type: 'checkbox', checked: ticked });
      checks.push({ cb, path: f.path });
      filesBox.append(h('label', {}, cb, h('span', { class: 'st' }, f.status), h('span', {}, f.path), h('span', { class: 'dif' }, f.adds != null ? `+${f.adds} −${f.dels}` : '')));
    }
  }
  filesBox.style.maxHeight = '340px';
  const result = h('div');
  const go = h('button', { class: 'revert' }, 'Revert selected');
  const cancel = h('button', {}, 'Cancel');
  let armed = null;
  overlay = h('div', { id: 'commitOverlay', onmousedown: (e) => { if (e.target === overlay) closeModal(); } },
    h('div', { id: 'commitModal' },
      h('h2', {}, 'Revert changes'),
      h('div', { class: 'sub' }, `Branch ${s.branch}. Ticked files are put back exactly as they were in the last commit and your edits to them are lost. Nothing happens until you press the red button twice.`),
      noFiles ? h('div', { class: 'result ok' }, 'Nothing to revert — no files have changed since the last commit.') : [
        h('label', { class: 'lbl' }, `Files (${s.files.length}) — untick anything you want to keep`), filesBox,
        h('div', { style: 'margin-top:6px;display:flex;gap:10px' },
          h('button', { onclick: () => checks.forEach((c) => (c.cb.checked = true)) }, 'Tick all'),
          h('button', { onclick: () => checks.forEach((c) => (c.cb.checked = false)) }, 'Untick all'))],
      result,
      h('div', { class: 'actions' }, cancel, noFiles ? null : go)));
  document.body.append(overlay);
  cancel.addEventListener('click', closeModal);
  const disarm = () => { clearTimeout(armed); armed = null; go.classList.remove('armed'); go.textContent = 'Revert selected'; };
  go.addEventListener('click', async () => {
    const chosen = checks.filter((c) => c.cb.checked).map((c) => c.path);
    if (!chosen.length) { result.className = 'result bad'; result.textContent = 'Tick at least one file.'; return; }
    if (armed === null) {
      const del = s.files.filter((f) => f.status === 'new' && chosen.includes(f.path)).length;
      go.classList.add('armed');
      go.textContent = `Really revert ${chosen.length} file${chosen.length === 1 ? '' : 's'}${del ? ` (deletes ${del} new)` : ''}? Click again`;
      armed = setTimeout(disarm, 4000);
      return;
    }
    disarm();
    go.disabled = cancel.disabled = true;
    result.className = 'result'; result.textContent = 'Reverting…';
    try {
      const r = await fetch('/api/git/revert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: chosen }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      result.className = 'result ok';
      result.textContent = `Restored ${j.restored} file${j.restored === 1 ? '' : 's'} to the last commit${j.deleted ? ` and deleted ${j.deleted} new file${j.deleted === 1 ? '' : 's'}` : ''}. The page reloads when you close this.`;
      reloadOnClose = true;
      window.dispatchEvent(new Event('devtools:changed'));
      cancel.textContent = 'Close & reload';
    } catch (e) {
      result.className = 'result bad'; result.textContent = 'Failed: ' + e.message;
      go.disabled = false;
    }
    cancel.disabled = false;
  });
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
