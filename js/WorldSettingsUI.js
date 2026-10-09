// WorldSettingsUI.js — the "World Settings" window opened from the New Game dialog (index.html's
// #world-settings-overlay). It edits a DRAFT world (state.ui.worldDraft); UI.js's New Game flow turns the draft
// into state.meta.worldSettings when a run actually starts. See WorldSettings.js for what each rule does.

import { WORLD_RULES, WORLD_GROUPS, WORLD_PRESETS, presetWorldValues, defaultWorldValues, isRuleModified, matchingPreset } from './WorldSettings.js';
import { playPanelOpen, playPanelClose, playUiSelect } from './Sound.js';

let state = null;
let els = null;
const rowEls = {}; // rule id -> { row, slider, valueEl, resetBtn }

function draft() {
  if (!state.ui.worldDraft) state.ui.worldDraft = defaultWorldValues();
  return state.ui.worldDraft;
}
export function worldDraftValues() { return { ...draft() }; }
export function worldDraftModified() { const d = draft(); return WORLD_RULES.some((r) => isRuleModified(r, d[r.id])); }
export function worldDraftPresetLabel() {
  const id = matchingPreset(draft());
  return id === 'custom' ? 'Custom' : WORLD_PRESETS[id].label;
}

function fmtValue(rule, v) {
  if (rule.id === 'sellRefund') return `${Math.round(v * 100)}%`;
  if (rule.kind === 'mult') return `×${+v.toFixed(2)}`;
  if (rule.unit === '$') return `$${Math.round(v).toLocaleString('en-US')}`;
  if (rule.unit === '×') return `${(+v.toFixed(2)).toFixed(2)}×`;
  if (rule.unit === 'waves') return `${Math.round(v)} waves`;
  return String(Math.round(v * 100) / 100);
}

function refreshAll() {
  const d = draft();
  const preset = matchingPreset(d);
  const modified = worldDraftModified();
  els.banner.classList.toggle('modified', modified);
  els.banner.classList.toggle('normal', !modified);
  els.bannerIcon.textContent = modified ? '⚠' : '✔';
  els.bannerText.innerHTML = modified
    ? '<b>Modified world</b> — Achievements and Fishy Gems are <b>disabled</b> for this run.'
    : '<b>Normal world</b> — Achievements and Fishy Gems can be earned.';
  for (const btn of els.presetBtns) btn.classList.toggle('selected', btn.dataset.preset === preset);
  els.customChip.classList.toggle('hidden', preset !== 'custom');
  els.presetDesc.textContent = preset === 'custom' ? 'Your own mix of settings.' : WORLD_PRESETS[preset].desc;
  for (const r of WORLD_RULES) {
    const e = rowEls[r.id];
    const v = d[r.id];
    if (+e.slider.value !== v) e.slider.value = v;
    e.valueEl.textContent = fmtValue(r, v);
    const changed = isRuleModified(r, v);
    e.row.classList.toggle('changed', changed);
    e.resetBtn.classList.toggle('hidden', !changed);
  }
  refreshStartChip();
}

// The chip on the New Game dialog's World Settings button ("Normal", "⚠ Easy", ...).
export function refreshStartChip() {
  if (!els) return;
  const modified = worldDraftModified();
  els.startChip.textContent = modified ? `⚠ ${worldDraftPresetLabel()}` : 'Normal';
  els.startChip.classList.toggle('modified', modified);
  els.startChip.title = modified ? 'Modified world — achievements are disabled for this run' : 'Unmodified world';
}

function buildRows() {
  for (const g of WORLD_GROUPS) {
    const rules = WORLD_RULES.filter((r) => r.group === g.id);
    if (!rules.length) continue;
    const section = document.createElement('section');
    section.className = 'ws-group';
    const title = document.createElement('h3');
    title.textContent = g.label;
    section.append(title);
    for (const r of rules) {
      const row = document.createElement('div');
      row.className = 'ws-row';
      const top = document.createElement('div');
      top.className = 'ws-row-top';
      const label = document.createElement('span');
      label.className = 'ws-label';
      label.textContent = r.label;
      const valueEl = document.createElement('span');
      valueEl.className = 'ws-value';
      const resetBtn = document.createElement('button');
      resetBtn.className = 'ws-reset hidden';
      resetBtn.type = 'button';
      resetBtn.title = 'Put this back to Normal';
      resetBtn.textContent = '↺';
      top.append(label, valueEl, resetBtn);
      const desc = document.createElement('div');
      desc.className = 'ws-desc';
      desc.textContent = r.desc;
      // Same native slider the Fan filter's range slider uses (style.css's #platform-filter-range), per direct request.
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'ws-slider';
      slider.min = r.min; slider.max = r.max; slider.step = r.step;
      slider.addEventListener('input', () => { draft()[r.id] = +slider.value; refreshAll(); });
      resetBtn.addEventListener('click', () => { draft()[r.id] = r.def; playUiSelect(); refreshAll(); });
      row.append(top, desc, slider);
      section.append(row);
      rowEls[r.id] = { row, slider, valueEl, resetBtn };
    }
    els.body.append(section);
  }
}

export function openWorldSettings() {
  refreshAll();
  els.overlay.classList.remove('hidden');
  els.body.scrollTop = 0;
  playPanelOpen();
}
export function closeWorldSettings() {
  if (els.overlay.classList.contains('hidden')) return;
  els.overlay.classList.add('hidden');
  refreshStartChip();
  playPanelClose();
}
export function isWorldSettingsOpen() { return !!els && !els.overlay.classList.contains('hidden'); }

export function initWorldSettingsUI(gameState) {
  state = gameState;
  els = {
    overlay: document.getElementById('world-settings-overlay'),
    modal: document.getElementById('world-settings-modal'),
    body: document.getElementById('world-settings-body'),
    banner: document.getElementById('world-settings-banner'),
    bannerIcon: document.getElementById('world-settings-banner-icon'),
    bannerText: document.getElementById('world-settings-banner-text'),
    presetBtns: [...document.querySelectorAll('#world-settings-presets .ws-preset')],
    customChip: document.getElementById('world-settings-custom-chip'),
    presetDesc: document.getElementById('world-settings-preset-desc'),
    startChip: document.getElementById('start-world-chip'),
    openBtn: document.getElementById('start-world-settings-btn'),
    closeBtn: document.getElementById('world-settings-close-btn'),
    doneBtn: document.getElementById('world-settings-done-btn'),
    resetBtn: document.getElementById('world-settings-reset-btn'),
  };
  buildRows();
  els.openBtn.addEventListener('click', openWorldSettings);
  els.closeBtn.addEventListener('click', closeWorldSettings);
  els.doneBtn.addEventListener('click', closeWorldSettings);
  els.overlay.addEventListener('click', (e) => { if (e.target === els.overlay) closeWorldSettings(); });
  els.resetBtn.addEventListener('click', () => { state.ui.worldDraft = defaultWorldValues(); playUiSelect(); refreshAll(); });
  for (const btn of els.presetBtns) btn.addEventListener('click', () => { state.ui.worldDraft = presetWorldValues(btn.dataset.preset); playUiSelect(); refreshAll(); });
  refreshStartChip();
}
