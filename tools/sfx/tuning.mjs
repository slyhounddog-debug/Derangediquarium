// Game-tuning engine for the dev tool's Variables/Formulas tabs.
//
// It edits the game's own source: every variable is a plain numeric literal somewhere in js/Config.js (or
// js/Sound.js). acorn gives the exact character range of each literal, so setting a value replaces just
// that number and leaves the surrounding comments/formatting alone. "Default" is whatever the literal is in
// the last git commit (git show HEAD:...), so Reset never needs a separate copy of the numbers.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import * as acorn from 'acorn';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'sfx', 'tuning.json'), 'utf8'));
const FILES = DEFS.files;

// ---- reading source ----
function readFile(fileKey) { return fs.readFileSync(path.join(ROOT, FILES[fileKey]), 'utf8'); }
function readHead(fileKey) {
  try { return execFileSync('git', ['show', 'HEAD:' + FILES[fileKey]], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch { return null; }
}
function parse(text) { return acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', ranges: true }); }

function declInit(ast, name) {
  for (const node of ast.body) {
    const decl = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
    if (!decl || decl.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations) if (d.id.type === 'Identifier' && d.id.name === name) return { init: d.init, declNode: node };
  }
  return null;
}

// The path-segment name for an object property: plain/string/number keys use their text, a computed
// [IDENTIFIER] key uses the identifier's name (the tables here are keyed by TILE_* constants).
function propName(prop) {
  if (prop.type !== 'Property') return null;
  const k = prop.key;
  if (prop.computed) return k.type === 'Identifier' ? k.name : null;
  if (k.type === 'Identifier') return k.name;
  if (k.type === 'Literal') return String(k.value);
  return null;
}
function numericValue(node) {
  if (!node) return undefined;
  if (node.type === 'Literal' && typeof node.value === 'number') return node.value;
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number') return -node.argument.value;
  return undefined;
}
function nodeAt(init, segs) {
  let node = init;
  for (const seg of segs) {
    if (!node) return null;
    if (node.type === 'ObjectExpression') node = (node.properties.find((p) => propName(p) === seg) || {}).value;
    else if (node.type === 'ArrayExpression') node = node.elements[Number(seg)];
    else return null;
  }
  return node || null;
}

// ---- the game's runtime values (for row names / computed-key resolution) ----
async function loadRuntime() {
  const file = path.join(ROOT, FILES.Config);
  const mtime = fs.statSync(file).mtimeMs;
  return import(pathToFileURL(file).href + '?v=' + mtime);
}

// ---- labels ----
// A table key as shown to a person: TILE_* keys become the building's name, others are left as written.
function displayKey(key) {
  const k = String(key);
  if (/^TILE_/.test(k) && rtGlobal && typeof rtGlobal[k] === 'string') {
    const b = rtGlobal.BUILDING_TYPES && rtGlobal.BUILDING_TYPES[rtGlobal[k]];
    if (b && b.name) return b.name;
  }
  return k;
}
const FIELD_LABELS = {
  cost: ['Price', '$'], swimSpeed: ['Swim speed', 'px/s'], hungerRate: ['Hunger rate', 'pts/s'],
  wastePoopIntervalMultiplier: ['Waste interval multiplier', 'x'], dropValue: ['Coin value', '$'], dropInterval: ['Coin interval', 'ms'],
  feedsRequired: ['Feeds required', ''], pixelsPerMW: ['Pixels swum per 1 mw', 'px'], eatCooldownMs: ['Eat cooldown', 'ms'],
  scienceCost: ['Science cost', ''], scienceGreenCost: ['Green science cost', ''], goldCost: ['Gold cost', '$'],
  hpMin: ['HP min', ''], hpMax: ['HP max', ''], speed: ['Speed', 'px/s'], dnaYield: ['Bio-Sludge dropped', ''],
  fishDamagePerSec: ['Damage to fish', '/s'], coinMs: ['Coin time', 'ms'], scienceMs: ['Science time', 'ms'], scienceGreenMs: ['Green science time', 'ms'],
  powerCostPerSecCoin: ['Power (coin)', 'mw'], powerCostPerSecScience: ['Power (science)', 'mw'], foodProcessMs: ['Waste to Food time', 'ms'],
  powerCostPerSec: ['Power draw', 'mw'], powerOutputMw: ['Power output', 'mw'], durationMs: ['Burn time', 'ms'],
  shotsPerSec: ['Shots per second', '/s'], damage: ['Damage per shot', ''], powerCostPerShot: ['Power per shot', 'mw'],
  gemCost: ['Gem cost', ''], threshold: ['Goal', ''], t: ['Progress point', ''],
};
const STAGE_NAMES = ['Baby', 'Juvenile', 'Adult'];
function words(camel) { return camel.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase(); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function constLabel(name) {
  let unit = '';
  let base = name;
  const suffixes = [['_MS', 'ms'], ['_PX', 'px'], ['_MW', 'mw'], ['_S', 's'], ['_DEG', 'deg'], ['_PX_PER_S', 'px/s'], ['_PER_SEC', '/s']];
  for (const [suf, u] of suffixes) if (name.endsWith(suf)) { unit = u; base = name.slice(0, -suf.length); break; }
  const text = base.toLowerCase().split('_').map((w) => (/^t[0-9]$/.test(w) || ['hp', 'dna', 'mw', 'ai'].includes(w)) ? w.toUpperCase() : w).join(' ');
  return { label: cap(text), unit };
}

// The comment block directly above a declaration, flattened — shown as the "notes" tooltip.
function commentAbove(text, node) {
  const before = text.slice(0, node.start);
  const lines = before.split(/\r?\n/);
  lines.pop(); // the partial line the declaration starts on
  const out = [];
  while (lines.length && /^\s*\/\//.test(lines[lines.length - 1])) out.unshift(lines.pop().replace(/^\s*\/\/\s?/, ''));
  const flat = out.join(' ').replace(/\s+/g, ' ').trim();
  return flat.length > 420 ? flat.slice(0, 417) + '...' : flat;
}

// ---- slider ranges ----
function decimals(v) { const s = String(v); if (s.includes('e')) return 6; const i = s.indexOf('.'); return i < 0 ? 0 : Math.min(6, s.length - i - 1); }
function niceMax(x) { const p = Math.pow(10, Math.floor(Math.log10(x))); for (const m of [1, 2, 5, 10]) if (m * p >= x) return m * p; return 10 * p; }
function sliderSpec(name, base, spec) {
  const out = {};
  const isFraction = /(FRACTION|CHANCE|RATIO|THRESHOLD)/i.test(name) && Math.abs(base) <= 1.0001;
  if (spec.min !== undefined) out.min = spec.min;
  if (spec.max !== undefined) out.max = spec.max;
  if (out.min === undefined || out.max === undefined) {
    if (isFraction) { out.min ??= 0; out.max ??= 1; }
    else if (base === 0) { out.min ??= 0; out.max ??= 10; }
    else if (base < 0) { out.min ??= base * 3; out.max ??= 0; }
    else { out.min ??= 0; out.max ??= niceMax(base * 3); }
  }
  if (spec.step !== undefined) out.step = spec.step;
  else {
    const k = decimals(base);
    if (k === 0) out.step = Math.abs(base) < 200 ? 1 : Math.pow(10, Math.floor(Math.log10(Math.abs(base))) - 1);
    else out.step = Math.pow(10, -Math.min(6, k + 1));
  }
  return out;
}

function fmt(v) { return String(+Number(v).toPrecision(12)); }

// ---- enumerating the curated variables ----
// Walks a table's AST and the runtime object together (the runtime copy gives each row's display name).
function enumerateDeep(init, rt, spec, out, segs = [], names = [], depth = 0) {
  if (!init) return;
  const fields = spec.fields ? new Set(spec.fields) : null;
  if (init.type === 'ObjectExpression') {
    for (const p of init.properties) {
      const key = propName(p);
      if (key === null) continue;
      const rtKey = p.computed && p.key.type === 'Identifier' ? rtGlobal?.[p.key.name] : key;
      const childRt = rt == null ? undefined : rt[rtKey];
      visit(p.value, childRt, key, spec, fields, out, segs, names, depth, /*isIndex*/ false);
    }
  } else if (init.type === 'ArrayExpression') {
    init.elements.forEach((el, i) => visit(el, rt == null ? undefined : rt[i], String(i), spec, fields, out, segs, names, depth, true));
  }
}
let rtGlobal = null;
function visit(valueNode, rtChild, key, spec, fields, out, segs, names, depth, isIndex) {
  if (!valueNode) return;
  const path = [...segs, key];
  const num = numericValue(valueNode);
  if (num !== undefined) {
    // a numeric leaf: keep it if no field filter, or if the final key (or, for array items, the parent key) is in it
    const field = isIndex ? segs[segs.length - 1] : key;
    if (!fields || fields.has(field) || fields.has(key)) out.push({ path, node: valueNode, value: num, names, field, isIndex, leafIndex: isIndex ? Number(key) : null });
    return;
  }
  if (valueNode.type !== 'ObjectExpression' && valueNode.type !== 'ArrayExpression') return;
  if (depth > 6) return;
  // a row/table name for labels: the runtime object's own .name when it has one
  let nextNames = names;
  if (rtChild && typeof rtChild === 'object' && typeof rtChild.name === 'string') nextNames = [...names, { depth, text: rtChild.name }];
  else if (!isIndex && valueNode.type === 'ObjectExpression' && depth <= 1) nextNames = [...names, { depth, text: displayKey(key), raw: true }];
  enumerateDeep(valueNode, rtChild, spec, out, path, nextNames, depth + 1);
}

function buildLabel(spec, item, rootLabel) {
  const field = item.field;
  const meta = FIELD_LABELS[field];
  const rowParts = item.names.map((n) => n.text);
  // stage name for growthStages[i]
  const pathSegs = item.path;
  const gsIdx = pathSegs.indexOf('growthStages');
  let stage = '';
  if (gsIdx >= 0 && pathSegs[gsIdx + 1] !== undefined) {
    const si = Number(pathSegs[gsIdx + 1]);
    stage = STAGE_NAMES[si] ? ` (${STAGE_NAMES[si].toLowerCase()})` : ` (stage ${si + 1})`;
  }
  let fieldText;
  let unit = '';
  if (item.isIndex && pathSegs.length === 1) {
    // a flat array of numbers (e.g. a cost ladder): label by position, using the spec's own label
    fieldText = `${spec.label || rootLabel} ${item.leafIndex + (spec.firstIndex ?? 1)}`.replace(/^./, (c) => c.toUpperCase());
    return { label: fieldText, unit };
  }
  const shown = displayKey(field);
  if (meta) { fieldText = meta[0]; unit = meta[1]; } else fieldText = shown !== String(field) ? shown : cap(words(String(field).replace(/_/g, ' ')));
  if (!rowParts.length) {
    // unnamed rows (e.g. the wave-mix keyframes, or a { 1: 500, 2: 1500 } table): label by position
    const first = pathSegs[0];
    const rowNo = first !== undefined && /^[0-9]+$/.test(first) && pathSegs.length > 1 ? ` ${Number(first) + 1}` : '';
    const last = pathSegs[pathSegs.length - 1];
    const prev = pathSegs[pathSegs.length - 2];
    if (prev === 'weights') return { label: `${spec.label || ''}${rowNo}: Tier ${Number(last) + 1} weight`.trim(), unit };
    if (rowNo) return { label: `${spec.label || ''}${rowNo}: ${fieldText}`.trim(), unit };
    return { label: `${spec.label || ''} ${fieldText}`.trim(), unit };
  }
  if (spec.label && rowParts.length) return { label: `${rowParts.join(' · ')}${stage}: ${fieldText}`, unit, group: spec.label };
  return { label: `${rowParts.join(' · ')}${stage}: ${fieldText}`, unit };
}

function makeId(file, name, segs) { return (file === 'Config' ? '' : file + ':') + name + (segs.length ? '.' + segs.join('.') : ''); }
function parseId(id) {
  let file = 'Config';
  let rest = id;
  const m = /^([A-Za-z]+):(.*)$/.exec(id);
  if (m && FILES[m[1]]) { file = m[1]; rest = m[2]; }
  const parts = rest.split('.');
  return { file, name: parts[0], segs: parts.slice(1) };
}

const astCache = new Map(); // text -> ast (cheap enough, but the file is large and re-read per request)
function astFor(text) {
  if (astCache.size > 6) astCache.clear();
  let a = astCache.get(text);
  if (!a) { a = parse(text); astCache.set(text, a); }
  return a;
}

export async function listTuning() {
  const runtime = await loadRuntime();
  rtGlobal = runtime;
  const texts = {}, asts = {}, heads = {}, headAsts = {};
  for (const k of Object.keys(FILES)) {
    texts[k] = readFile(k); asts[k] = astFor(texts[k]);
    const h = readHead(k); heads[k] = h; headAsts[k] = h ? astFor(h) : null;
  }
  const groups = [];
  const problems = [];
  for (const g of DEFS.groups) {
    const variables = [];
    for (const raw of g.items) {
      const spec = typeof raw === 'string' ? { name: raw } : raw;
      const fileKey = spec.file || 'Config';
      const ast = asts[fileKey];
      const tableName = spec.deep || spec.name;
      const found = declInit(ast, tableName);
      if (!found) { problems.push(`${tableName}: not found in ${FILES[fileKey]}`); continue; }
      const commentText = commentAbove(texts[fileKey], found.declNode);
      const entries = [];
      if (spec.deep) enumerateDeep(found.init, runtime[tableName], spec, entries);
      else {
        const v = numericValue(found.init);
        if (v === undefined) { problems.push(`${tableName}: not a plain number (left out)`); continue; }
        entries.push({ path: [], node: found.init, value: v, names: [], field: null, scalar: true });
      }
      for (const e of entries) {
        const id = makeId(fileKey, tableName, e.path);
        let label, unit = '';
        if (e.scalar) { const c = constLabel(tableName); label = spec.label || c.label; unit = spec.unit ?? c.unit; }
        else { const b = buildLabel(spec, e, tableName); label = b.label; unit = spec.unit ?? b.unit; }
        // original (last commit) value at the same location
        let original = null;
        if (headAsts[fileKey]) {
          const hf = declInit(headAsts[fileKey], tableName);
          const hv = hf ? numericValue(nodeAt(hf.init, e.path)) : undefined;
          if (hv !== undefined) original = hv;
        }
        const sl = sliderSpec(tableName, original ?? e.value, spec);
        variables.push({
          id, file: fileKey, label, unit, value: e.value, original,
          desc: e.scalar ? (spec.desc || commentText) : '',
          code: tableName + (e.path.length ? '[' + e.path.join('][') + ']' : ''),
          table: spec.deep ? tableName : null,
          sub: spec.deep ? ((e.names && e.names[0] && e.names[0].text) || spec.label || tableName) : '',
          ...sl,
        });
      }
    }
    groups.push({ id: g.id, label: g.label, variables });
  }
  // facts the Formulas tab needs that are not editable numbers
  const meta = {
    problems,
    achievementTierCounts: runtime.ACHIEVEMENT_LIST.reduce((m, a) => { m[a.tier] = (m[a.tier] || 0) + 1; return m; }, {}),
    hatCount: Object.keys(runtime.HATS).filter((k) => k !== 'none').length,
    speciesNames: Object.fromEntries(Object.entries(runtime.SPECIES).map(([k, s]) => [k, s.name])),
    speciesBehavior: Object.fromEntries(Object.entries(runtime.SPECIES).map(([k, s]) => [k, s.behavior])),
    // The game's own wastePoopIntervalMultiplier for each species — Dartfin's is written as a sum of divisions, not a plain
    // number, so it is not an editable variable; the Formulas tab reads it from here instead.
    speciesWasteIntervalMultiplier: Object.fromEntries(Object.entries(runtime.SPECIES).map(([k, s]) => [k, s.wastePoopIntervalMultiplier || 1])),
    stageCounts: Object.fromEntries(Object.entries(runtime.SPECIES).map(([k, s]) => [k, s.growthStages.length])),
    archetypeNames: runtime.ALIEN_ARCHETYPES.map((a) => a.name),
    tileIds: Object.fromEntries(Object.entries(runtime).filter(([k, v]) => /^TILE_/.test(k) && typeof v === 'string')),
    buildingNames: Object.fromEntries(Object.entries(runtime.BUILDING_TYPES).map(([k, b]) => [k, b.name])),
    tileSize: runtime.TILE_SIZE,
    manufacturerRecipes: Object.values(runtime.MANUFACTURER_RECIPES).map((r) => ({ id: r.id, name: r.name, inputs: r.inputs, output: r.output })),
    powerPlantRecipes: Object.values(runtime.POWER_PLANT_RECIPES).map((r) => ({ id: r.id, name: r.name })),
    archetypeIds: runtime.ALIEN_ARCHETYPES.map((a) => a.id),
  };
  return { groups, meta, files: Object.values(FILES) };
}

function locate(text, id) {
  const { file, name, segs } = parseId(id);
  if (!FILES[file]) throw new Error('unknown file');
  const ast = astFor(text[file] ?? (text[file] = readFile(file)));
  const found = declInit(ast, name);
  if (!found) throw new Error('constant not found: ' + name);
  const node = nodeAt(found.init, segs);
  if (!node || numericValue(node) === undefined) throw new Error('not an editable number: ' + id);
  return { file, node };
}

export function setValue(id, value) {
  const v = Number(value);
  if (!Number.isFinite(v)) throw new Error('not a number');
  const { file } = parseId(id);
  const text = readFile(file);
  const { node } = locate({ [file]: text }, id);
  const next = text.slice(0, node.start) + fmt(v) + text.slice(node.end);
  parse(next); // refuse to write anything that would not parse
  fs.writeFileSync(path.join(ROOT, FILES[file]), next);
  return +fmt(v);
}

export function resetValue(id) {
  const { file, name, segs } = parseId(id);
  const head = readHead(file);
  if (!head) throw new Error('no committed version to reset to');
  const hf = declInit(astFor(head), name);
  const hv = hf ? numericValue(nodeAt(hf.init, segs)) : undefined;
  if (hv === undefined) throw new Error('no committed default for ' + id);
  return setValue(id, hv);
}
