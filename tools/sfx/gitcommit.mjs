// "Commit to GitHub" support for the dev tool: summarises what changed (slider edits, sound picks, other files),
// then stages the chosen files, commits and pushes. Always driven by a button press in the page, with the
// message and file list shown for review first.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { listTuning } from './tuning.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SLOTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'sfx', 'slots.json'), 'utf8'));
const slotLabel = Object.fromEntries(SLOTS.map((s) => [s.id, s.label.replace(/ \(new\)$/, '')]));

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: opts.timeout || 30000, stdio: ['ignore', 'pipe', 'pipe'] });
}
function tryGit(args, opts) { try { return git(args, opts); } catch { return null; } }

// Changed files (untracked files listed one by one; ignored files never appear).
function changedFiles() {
  const out = git(['status', '--porcelain=v1', '-z', '-uall']);
  const files = [];
  const parts = out.split('\0').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const code = parts[i].slice(0, 2);
    const file = parts[i].slice(3);
    if (code[0] === 'R' || code[0] === 'C') i++; // rename/copy: the next entry is the source path
    files.push({ path: file, status: code.trim() === '??' ? 'new' : code.includes('D') ? 'deleted' : 'modified' });
  }
  return files;
}
function groupOf(file) {
  if (file === 'js/Config.js' || file === 'js/Sound.js') return 'variables';
  if (file.startsWith('audio/sfx/')) return 'audio';
  return 'other';
}
function numstat(files) {
  const map = {};
  const tracked = files.filter((f) => f.status !== 'new').map((f) => f.path);
  if (tracked.length) {
    const out = tryGit(['diff', 'HEAD', '--numstat', '--', ...tracked]) || '';
    for (const line of out.split('\n')) { const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line); if (m) map[m[3]] = { adds: m[1] === '-' ? null : +m[1], dels: m[2] === '-' ? null : +m[2] }; }
  }
  return map;
}

export function gitCounts() {
  const files = changedFiles();
  const branch = (tryGit(['rev-parse', '--abbrev-ref', 'HEAD']) || '').trim();
  const ahead = +(tryGit(['rev-list', '--count', '@{u}..HEAD']) || '0').trim() || 0;
  return { count: files.length, ahead, branch };
}

const fmt = (v) => String(+Number(v).toPrecision(8));

function manifestChanges() {
  const lines = [];
  let head = {}, now = {};
  try { head = JSON.parse(tryGit(['show', 'HEAD:audio/sfx/manifest.json']) || '{}'); } catch { head = {}; }
  try { now = JSON.parse(fs.readFileSync(path.join(ROOT, 'audio/sfx/manifest.json'), 'utf8')); } catch { now = {}; }
  for (const id of new Set([...Object.keys(head), ...Object.keys(now)])) {
    const a = head[id], b = now[id];
    const name = slotLabel[id] || id;
    if (!a && b) lines.push(`${name}: new sound${b.source ? ` (${b.source})` : ''}, gain ${fmt(b.gain)}`);
    else if (a && !b) lines.push(`${name}: sound removed`);
    else {
      const parts = [];
      const fa = JSON.stringify(a.files || a.file), fb = JSON.stringify(b.files || b.file);
      if (fa !== fb || a.source !== b.source) parts.push(`new file${b.source ? ` (${b.source})` : ''}`);
      if (a.gain !== b.gain) parts.push(`gain ${fmt(a.gain)} → ${fmt(b.gain)}`);
      if (parts.length) lines.push(`${name}: ${parts.join(', ')}`);
    }
  }
  return lines;
}

export async function gitSummary() {
  const files = changedFiles();
  const stats = numstat(files);
  for (const f of files) { f.group = groupOf(f.path); Object.assign(f, stats[f.path] || {}); }
  const branch = (tryGit(['rev-parse', '--abbrev-ref', 'HEAD']) || '').trim();
  const ahead = +(tryGit(['rev-list', '--count', '@{u}..HEAD']) || '0').trim() || 0;

  // slider edits
  const tuning = await listTuning();
  const byGroup = [];
  let valueCount = 0;
  for (const g of tuning.groups) {
    const changed = g.variables.filter((v) => v.original !== null && Math.abs(v.value - v.original) > 1e-9);
    if (!changed.length) continue;
    valueCount += changed.length;
    byGroup.push({ label: g.label, items: changed.map((v) => `${v.label.replace(/ \(.*?\)$/, '')} ${fmt(v.original)} → ${fmt(v.value)}${v.unit && v.unit !== '$' ? ' ' + v.unit : ''}`) });
  }
  const sounds = manifestChanges();

  const body = [];
  if (valueCount) {
    body.push('Tuning (Variables tab):');
    for (const g of byGroup) {
      const shown = g.items.slice(0, 12);
      body.push(`- ${g.label}: ${shown.join('; ')}${g.items.length > shown.length ? `; +${g.items.length - shown.length} more` : ''}`);
    }
  }
  if (sounds.length) {
    if (body.length) body.push('');
    body.push('Sounds (Audio tab):');
    for (const s of sounds) body.push(`- ${s}`);
  }
  const jsFiles = files.filter((f) => f.group === 'variables');
  const other = files.filter((f) => f.group === 'other');
  const extra = [];
  for (const f of jsFiles) {
    if (f.adds != null && f.adds + f.dels > 0) extra.push(f);
  }
  const unexplained = jsFiles.filter((f) => f.adds != null && f.adds > valueCount + 2);
  if (unexplained.length) {
    if (body.length) body.push('');
    body.push('Also edited by hand (not slider changes): ' + unexplained.map((f) => `${f.path} (+${f.adds} −${f.dels})`).join(', '));
  }
  if (other.length) {
    if (body.length) body.push('');
    body.push('Other files:');
    for (const f of other.slice(0, 30)) body.push(`- ${f.path}${f.status === 'new' ? ' (new)' : f.status === 'deleted' ? ' (deleted)' : ''}`);
    if (other.length > 30) body.push(`- +${other.length - 30} more`);
  }

  // subject
  const bits = [];
  if (valueCount) bits.push(`tune ${valueCount} value${valueCount > 1 ? 's' : ''}${byGroup.length === 1 ? ` (${byGroup[0].label})` : ''}`);
  if (sounds.length) bits.push(`${sounds.length} sound change${sounds.length > 1 ? 's' : ''}`);
  if (other.length) bits.push(`${other.length} other file${other.length > 1 ? 's' : ''}`);
  let subject = bits.length ? bits.join(', ') : (files.length ? `update ${files.length} file${files.length > 1 ? 's' : ''}` : 'push unpushed commits');
  subject = subject.charAt(0).toUpperCase() + subject.slice(1);
  if (subject.length > 72) subject = subject.slice(0, 69) + '...';
  return { files, subject, body: body.join('\n'), branch, ahead, valueCount, soundCount: sounds.length };
}

export function gitCommit({ files, subject, body }) {
  const current = changedFiles().map((f) => f.path);
  const chosen = (files || []).filter((f) => current.includes(f));
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const result = { ok: false, branch };
  if (chosen.length) {
    if (!String(subject || '').trim()) throw new Error('The commit needs a subject line');
    git(['reset', '-q']);                 // only what is ticked gets committed, even if something else was staged
    git(['add', '--', ...chosen]);
    const msgArgs = ['commit', '-q', '-m', String(subject).trim()];
    if (String(body || '').trim()) msgArgs.push('-m', String(body).trim());
    git(msgArgs);
    result.commit = git(['rev-parse', '--short', 'HEAD']).trim();
    result.files = chosen.length;
  }
  try {
    result.pushOutput = (git(['push', 'origin', branch], { timeout: 120000 }) || '').trim();
    result.pushed = true;
  } catch (e) {
    result.pushed = false;
    result.pushError = String((e.stderr || e.message || e)).trim().split('\n').slice(-4).join('\n');
  }
  result.ok = !!result.commit || result.pushed;
  return result;
}
