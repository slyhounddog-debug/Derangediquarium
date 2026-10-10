// Text engine for the dev tool's Text tab.
//
// Same idea as tuning.mjs, but for words instead of numbers: it finds the player-facing strings in the game's own
// source (js/*.js string and template literals, plus the static text in index.html), lists them with a stable id, and
// writes an edited string back by replacing just that literal's character range - comments and formatting around it
// are left alone. "Default" is whatever the same string is in the last git commit (git show HEAD:...), so Reset never
// needs a separate copy of the text.
//
// Ids are structural, not positional, so editing one string never shifts another's id (and HEAD's copy lines up
// with the working copy even when other code has changed):
//   tables / constants   FILE:NAME.path.to.field            e.g. Config:SPECIES.guppy.description
//   strings in functions FILE:function/context#n            e.g. UI:setupLab/textContent#2
//   index.html           html:#nearest-id#n  (or html:body#n)
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as acorn from 'acorn';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'sfx', 'text.json'), 'utf8'));

// ---- reading source ----
const relPath = (file) => (file === 'html' ? 'index.html' : `js/${file}.js`);
function readFile(file) { return fs.readFileSync(path.join(ROOT, relPath(file)), 'utf8'); }
const headCache = new Map(); // `${commit}:${file}` -> text, so a listing costs one `git rev-parse` instead of a `git show` per file
function headSha() {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
}
function readHead(file, sha = headSha()) {
  if (!sha) return null;
  const key = sha + ':' + file;
  if (!headCache.has(key)) {
    if (headCache.size > 40) headCache.clear();
    let text = null;
    try { text = execFileSync('git', ['show', 'HEAD:' + relPath(file)], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { /* not in the last commit */ }
    headCache.set(key, text);
  }
  return headCache.get(key);
}
const jsFiles = () => fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)).filter((f) => !DEFS.skipFiles.includes(f));

// ---- scanning cache (the source files are large; scanning is only redone when the text changes) ----
const scanCache = new Map(); // `${file}\0${text}` -> every string found, each with a `listed` flag (does it read like words)
function scanCached(file, text) {
  const key = file + '\0' + text;
  let hit = scanCache.get(key);
  if (!hit) {
    if (scanCache.size > 60) scanCache.clear();
    hit = file === 'html' ? scanHtml(text) : scanJs(file, text);
    scanCache.set(key, hit);
  }
  return hit;
}

// ====================================================================================================
//  JS files
// ====================================================================================================
const RX = (s) => new RegExp(s);
const TEXT_KEYS = new Set(DEFS.textKeys);
const TEXT_CALLS = new Set(DEFS.textCalls);
const TEXT_PROPS = new Set(DEFS.textProps);
const DENY_CALLS = new Set(DEFS.denyCalls);
const DENY_PROPS = new Set(DEFS.denyProps);
const DENY_KEYS = new Set(DEFS.denyKeys);
const MESSAGE_DECL = RX(DEFS.messageDecl);

function keyName(prop) {
  if (prop.type !== 'Property' && prop.type !== 'MethodDefinition') return null;
  const k = prop.key;
  if (k.type === 'Identifier') return k.name;
  if (k.type === 'Literal') return String(k.value);
  return null;
}
function calleeName(c) {
  if (c.type === 'Identifier') return c.name;
  if (c.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier') return c.property.name;
  return '';
}
function calleeRoot(c) { while (c && c.type === 'MemberExpression') c = c.object; return c && c.type === 'Identifier' ? c.name : ''; }
function isFn(n) { return n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression'; }
function fnLabel(stack) {
  for (let i = stack.length - 1; i >= 0; i--) {
    const n = stack[i];
    if (!isFn(n)) continue;
    if (n.id) return n.id.name;
    const p = stack[i - 1];
    if (p && p.type === 'VariableDeclarator' && p.id.type === 'Identifier') return p.id.name;
    if (p && (p.type === 'Property' || p.type === 'MethodDefinition') && keyName(p)) return keyName(p);
    if (p && p.type === 'AssignmentExpression' && p.left.type === 'MemberExpression' && p.left.property.type === 'Identifier') return p.left.property.name;
    // an anonymous callback: belongs to whatever named function (or declaration) holds it
  }
  return '';
}
function declLabel(stack) {
  // the top-level `const NAME = ...` this node sits in (stack[0] is Program)
  const top = stack[1];
  const decl = top && top.type === 'ExportNamedDeclaration' ? top.declaration : top;
  if (decl && decl.type === 'VariableDeclaration') {
    const d = decl.declarations.find((x) => stack.includes(x));
    if (d && d.id.type === 'Identifier') return d.id.name;
  }
  return '';
}

// Literal source text -> the string a player sees. A template with ${} stays "raw" (shown with its ${} parts).
function describeNode(node, src) {
  if (node.type === 'Literal') return { value: node.value, raw: false };
  const hasExpr = node.expressions.length > 0;
  if (!hasExpr) return { value: node.quasis[0].value.cooked, raw: false };
  return { value: src.slice(node.start + 1, node.end - 1), raw: true };
}

// Never words a player reads, wherever the string sits: colours, CSS/SVG/URL strings, font stacks, file names.
function isCode(v) {
  const t = v.trim();
  if (/^(#[0-9a-f]{3,8}|(rgba?|hsla?|url|linear-gradient|radial-gradient)\()/i.test(t) || /^<(svg|defs|g|polygon|path|rect|circle|line|filter|fe[A-Z])\b/.test(t)) return true;
  if (/^(https?:|data:|\/|\.\/)/.test(t) || /\.(mp3|mp4|wav|png|jpg|json|js|css)\b/.test(t) || /\d+(\.\d+)?px\b/.test(t) || /(sans-serif|system-ui|monospace)/.test(t)) return true;
  if (/^[a-z-]+=["'\\]/.test(t)) return true; // an HTML attribute fragment inside a template
  return false;
}
// Letters outside the ${ } parts the game fills in, HTML tags and CSS units: a string that is only placeholders,
// markup and symbols has nothing to edit.
const hasWords = (v) => /[A-Za-z]{2}/.test(v.replace(/\$\{[^}]*}/g, '').replace(/<[^>]*>/g, '').replace(/\b(px|ms|em|rem|vh|vw)\b/g, ''));
// Reads like words a person wrote (not a CSS selector, class list, key name or reason code).
function prose(v) {
  const t = v.trim();
  if (/^[#.\[>]/.test(t)) return false;
  if (/^[a-z0-9_-]+( [a-z0-9_-]+)*$/.test(t)) return false; // class lists, ids, reason codes
  return /\s/.test(t) || /[.!?:]$/.test(t) || /^[A-Z][a-z]{2,}$/.test(t);
}

// Returns every string that sits in a text-like place; `listed` says whether it also reads like words a player sees
// (the Text tab only shows those). Keeping the rest means an edit can never make its own entry vanish mid-save, and
// ids stay stable no matter what an edit does to the text.
export function scanJs(file, src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', ranges: true });
  const entries = [];
  const counters = new Map();
  const walk = (node, stack) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') return;
    const isStr = (node.type === 'Literal' && typeof node.value === 'string') || node.type === 'TemplateLiteral';
    if (isStr) consider(node, stack);
    stack.push(node);
    for (const k in node) {
      if (k === 'type' || k === 'start' || k === 'end' || k === 'range' || k === 'loc') continue;
      const c = node[k];
      if (Array.isArray(c)) { for (const x of c) walk(x, stack); } else if (c && typeof c.type === 'string') walk(c, stack);
    }
    stack.pop();
  };
  const consider = (node, stack) => {
    const parent = stack[stack.length - 1];
    if (!parent) return;
    // climb through expression plumbing (a ? 'x' : 'y', a || 'x', 'a' + b, parens) to the node that actually uses the string
    let child = node, i = stack.length - 1, p = parent;
    while (p && (p.type === 'ConditionalExpression' && p.test !== child || p.type === 'LogicalExpression' || (p.type === 'BinaryExpression' && p.operator === '+') || p.type === 'ParenthesizedExpression' || p.type === 'SequenceExpression' || p.type === 'AwaitExpression')) { child = p; p = stack[--i]; }
    if (!p) return;
    let ctx = '', allow = false;
    switch (p.type) {
      case 'Property':
        if (p.value !== child) return; // a key
        { const k = keyName(p); if (k == null || p.computed || DENY_KEYS.has(k)) return; ctx = k + ':'; allow = TEXT_KEYS.has(k); }
        break;
      case 'CallExpression': case 'NewExpression': {
        if (p.callee === child) return;
        const name = calleeName(p.callee), root = calleeRoot(p.callee);
        if (p.type === 'NewExpression' || DENY_CALLS.has(name) || DENY_CALLS.has(root) || /^perf/.test(name)) return;
        if ((name === 'setAttribute' || name === 'getAttribute') && !(p.arguments[0] && p.arguments[0].type === 'Literal' && ['title', 'aria-label', 'placeholder', 'alt'].includes(p.arguments[0].value) && p.arguments[1] === child)) return;
        ctx = name + '()'; allow = TEXT_CALLS.has(name);
        break;
      }
      case 'AssignmentExpression': {
        if (p.right !== child) return;
        const l = p.left;
        const prop = l.type === 'MemberExpression' && !l.computed && l.property.type === 'Identifier' ? l.property.name : (l.type === 'Identifier' ? l.name : '');
        if (!prop || DENY_PROPS.has(prop)) return;
        // x.style.foo = '...'  /  x.dataset.foo = '...'
        if (l.type === 'MemberExpression' && l.object.type === 'MemberExpression' && ['style', 'dataset'].includes(l.object.property.name)) return;
        ctx = '.' + prop; allow = TEXT_PROPS.has(prop);
        break;
      }
      case 'VariableDeclarator': ctx = (p.id.type === 'Identifier' ? p.id.name : '') + '='; break;
      case 'ArrayExpression': ctx = '[]'; break;
      case 'ReturnStatement': ctx = 'return'; break;
      case 'ArrowFunctionExpression': ctx = 'return'; break;
      case 'TemplateLiteral': ctx = '${}'; break; // a string nested in another template's ${ }
      case 'BinaryExpression': case 'SwitchCase': case 'UnaryExpression': case 'MemberExpression': case 'ForOfStatement': case 'ForInStatement': case 'TaggedTemplateExpression': case 'ThrowStatement': return;
      default: ctx = p.type; break;
    }
    // inside a throw/Error/console call anywhere up the chain? (those are for developers, not players)
    for (let j = stack.length - 1; j >= 0; j--) {
      const a = stack[j];
      if (a.type === 'ThrowStatement') return;
      if (a.type === 'CallExpression' && DENY_CALLS.has(calleeRoot(a.callee))) return;
      if (a.type === 'CallExpression' && DENY_CALLS.has(calleeName(a.callee))) return;
      if (isFn(a) && j > 1) break;
    }

    const top = declLabel(stack);
    // path of property keys / array indexes from the top-level declaration down (only when no function in between)
    let segs = null;
    if (top) {
      segs = [];
      for (let j = 2; j < stack.length; j++) {
        const a = stack[j], n = stack[j + 1] || node;
        if (isFn(a)) { segs = null; break; }
        if (a.type === 'Property') { const k = keyName(a); if (k == null) { segs = null; break; } segs.push(a.computed && a.key.type === 'Identifier' ? a.key.name : k); }
        else if (a.type === 'ArrayExpression') segs.push(String(a.elements.indexOf(n)));
        else if (a.type === 'ObjectExpression' || a.type === 'VariableDeclaration' || a.type === 'VariableDeclarator' || a.type === 'ExportNamedDeclaration' || a.type === 'SpreadElement') continue;
        else if (a.type === 'ConditionalExpression' || a.type === 'LogicalExpression' || a.type === 'BinaryExpression') { segs = null; break; }
        else { segs = null; break; }
      }
    }
    const fn = fnLabel(stack);
    const ctxKey = `${fn}/${ctx}`;
    let id;
    const tableId = top && segs ? `${file}:${top}${segs.length ? '.' + segs.join('.') : ''}` : null;
    if (!tableId) { const n = (counters.get(ctxKey) || 0) + 1; counters.set(ctxKey, n); id = `${file}:${fn || '(top level)'}/${ctx}#${n}`; } else id = tableId;
    const { value, raw } = describeNode(node, src);
    if (typeof value !== 'string') return;
    const tableAllow = top && segs && MESSAGE_DECL.test(top);
    const listed = hasWords(value) && !isCode(value) && (allow || tableAllow || prose(value));
    // sibling string properties of the row this string sits in: the row's display name (for grouping in the tab)
    let rowName = '', field = '';
    if (tableId) {
      const own = stack[stack.length - 1];
      const row = own.type === 'Property' ? stack[stack.length - 2] : (own.type === 'ArrayExpression' ? own : null);
      field = own.type === 'Property' ? keyName(own) : '';
      if (row && row.type === 'ObjectExpression') {
        for (const key of ['name', 'label', 'title', 'id']) {
          const pr = row.properties.find((x) => x.type === 'Property' && !x.computed && keyName(x) === key && x.value.type === 'Literal' && typeof x.value.value === 'string');
          if (pr) { rowName = pr.value.value; break; }
        }
      }
    }
    entries.push({
      id, file, start: node.start, end: node.end, value, raw, template: node.type === 'TemplateLiteral',
      quote: node.type === 'Literal' ? src[node.start] : '`', top: top || '', fn, ctx, segs: segs || [], tableId: !!tableId, rowName, field,
      nested: ctx === '${}', hasNested: false, listed,
    });
  };
  walk(ast, []);
  // an outer template that has other listed strings inside its ${ }: flag both so the page can keep them in sync
  for (const e of entries) {
    if (!e.nested || !e.listed) continue;
    for (const o of entries) if (o.listed && o.template && o.raw && o.start < e.start && o.end > e.end) { o.hasNested = true; e.parent = o.id; }
  }
  return entries;
}

// ====================================================================================================
//  index.html (static text nodes and tooltip attributes)
// ====================================================================================================
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const SKIP_TEXT_IN = new Set(['script', 'style', 'kbd', 'svg', 'code', 'pre']);
const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
const collapse = (s) => s.replace(/\s+/g, ' ').trim();

export function scanHtml(src) {
  const entries = [];
  const counters = new Map();
  const tagRx = /<!--[\s\S]*?-->|<!doctype[^>]*>|<(\/?)([A-Za-z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
  const stack = []; // { tag, id, hidden }
  const nearestId = () => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].id) return stack[i].id; return 'body'; };
  const outerId = () => { for (let i = 0; i < stack.length; i++) if (stack[i].id) return stack[i].id; return 'body'; };
  const push = (start, end, value, kind, tag, attr) => {
    const nid = nearestId();
    const key = '#' + nid;
    const n = (counters.get(key) || 0) + 1; counters.set(key, n);
    entries.push({ id: `html:${key}#${n}`, file: 'html', start, end, value, raw: false, html: kind, tag, attr: attr || '', top: '', fn: '', ctx: '', segs: [], section: outerId(), nearest: nid, listed: true });
  };
  const addText = (from, to) => {
    const chunk = src.slice(from, to);
    const lead = chunk.length - chunk.trimStart().length;
    const body = chunk.trim();
    if (!/[A-Za-z]{2}/.test(body)) return;
    if (stack.some((s) => SKIP_TEXT_IN.has(s.tag))) return;
    const top = stack[stack.length - 1];
    push(from + lead, from + lead + body.length, collapse(body), 'text', top ? top.tag : 'body');
  };
  let last = 0, m;
  while ((m = tagRx.exec(src))) {
    addText(last, m.index);
    last = tagRx.lastIndex;
    if (m[0].startsWith('<!')) continue;
    const closing = m[1] === '/', tag = m[2].toLowerCase();
    if (closing) {
      let i = stack.length - 1;
      while (i >= 0 && stack[i].tag !== tag) i--;
      if (i >= 0) stack.length = i;
      continue;
    }
    const attrSrc = m[3];
    const attrStart = m.index + 1 + m[2].length;
    const ent = { tag, id: '' };
    const arx = /([A-Za-z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let a;
    const found = [];
    while ((a = arx.exec(attrSrc))) {
      const name = a[1].toLowerCase();
      const val = a[2] ?? a[3] ?? a[4];
      if (val === undefined) continue;
      const valStart = attrStart + a.index + a[0].length - val.length - (a[2] !== undefined || a[3] !== undefined ? 1 : 0);
      if (name === 'id') ent.id = val;
      else if (ATTRS.includes(name) && /[A-Za-z]{2}/.test(val)) found.push({ name, val, valStart });
    }
    stack.push(ent); // so the tooltip is filed under this element's own id
    for (const f of found) push(f.valStart, f.valStart + f.val.length, collapse(f.val), 'attr', tag, f.name);
    if (VOID.has(tag) || /\/\s*$/.test(attrSrc)) { stack.pop(); continue; }
    if (tag === 'script' || tag === 'style') {
      const close = src.toLowerCase().indexOf('</' + tag, last);
      last = tagRx.lastIndex = close < 0 ? src.length : close;
      stack.pop();
    }
  }
  addText(last, src.length);
  return entries;
}

// ====================================================================================================
//  listing
// ====================================================================================================
const KEY_WORDS = { description: 'Description', desc: 'Description', name: 'Name', label: 'Label', title: 'Title', text: 'Text', effect: 'Effect', statLabel: 'Stat label', tip: 'Tip', hint: 'Hint', note: 'Note', message: 'Message' };
function words(s) { return String(s).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^TILE /, '').trim().toLowerCase(); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
const pretty = (s) => cap(words(s));

function groupFor(e) {
  for (const g of DEFS.groups) {
    for (const t of g.any) {
      if (t.file && !t.file.includes(e.file)) continue;
      if (t.decl && !(e.top && RX(t.decl).test(e.top))) continue;
      if (t.ctx && !RX(t.ctx).test(e.ctx)) continue;
      return g.id;
    }
  }
  return 'other';
}

function describe(e) {
  const fileLabel = e.file === 'html' ? 'index.html' : e.file + '.js';
  if (e.file === 'html') {
    const where = e.nearest === 'body' ? '' : '#' + e.nearest;
    const what = e.html === 'attr' ? `${e.tag} ${e.attr}=` : e.tag;
    return {
      sub: pretty(e.section), label: e.html === 'attr' ? `Tooltip (${e.attr})` : `<${e.tag}> text`,
      code: `index.html · ${where || 'page'} › ${what}`,
    };
  }
  if (e.tableId) {
    const rowTitle = e.rowName ? e.rowName : '';
    const segs = e.segs;
    const field = e.field;
    const isIdx = /^[0-9]+$/.test(segs[segs.length - 1] || '');
    const parentSegs = segs.slice(0, segs.length - 1);
    // sub header: the table, then the row (its display name when it has one)
    let subParts = [pretty(e.top)];
    if (rowTitle) {
      const inner = parentSegs.slice(0, -1).filter((s) => !/^[0-9]+$/.test(s));
      subParts = [pretty(e.top), ...inner.map(pretty), rowTitle];
    } else if (parentSegs.length) subParts = [pretty(e.top), ...parentSegs.map((s) => (/^[0-9]+$/.test(s) ? `#${+s + 1}` : pretty(s)))];
    const label = field ? (KEY_WORDS[field] || pretty(field)) : (isIdx ? `Line ${+segs[segs.length - 1] + 1}` : segs.length ? pretty(segs[segs.length - 1]) : 'Text');
    return { sub: subParts.join(' · '), label, code: `${fileLabel} · ${e.top}${segs.length ? '.' + segs.join('.') : ''}` };
  }
  const where = e.fn || '(top level)';
  return { sub: `${fileLabel} · ${where}()`, label: ctxLabel(e.ctx), code: `${fileLabel} · ${where} · ${e.ctx.replace('${}', 'inside a template ${ }')}` };
}
function ctxLabel(ctx) {
  if (ctx === '${}') return 'Text inside a template';
  if (/\(\)$/.test(ctx)) return `Text passed to ${ctx}`;
  if (ctx.startsWith('.')) return `Text set as ${ctx.slice(1)}`;
  if (ctx.endsWith(':')) return `Text for “${ctx.slice(0, -1)}”`;
  if (ctx.endsWith('=')) return `Text for ${ctx.slice(0, -1)}`;
  return 'Text';
}

// Which committed string did each working-copy string come from? Table entries have a fixed id (a path), so they pair
// by id. Strings inside functions are numbered per function and context (#1, #2, ...), and uncommitted code edits can
// shift those numbers, so within each such group the two lists are aligned by content instead (longest common run of
// identical strings; whatever lies between two matches pairs up in order, the leftovers are new). An edited string
// therefore still pairs with its committed original, and a newly added one shows as "new" rather than as a change.
function similarity(a, b) {
  const wa = new Set(a.toLowerCase().match(/[a-z0-9]+/g) || []), wb = new Set(b.toLowerCase().match(/[a-z0-9]+/g) || []);
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / (wa.size + wb.size - common || 1);
}
const pairKey = (e) => (e.tableId ? e.id : e.id.replace(/#\d+$/, ''));
function pairWithHead(now, head) {
  const pairs = new Map();
  const group = (list) => { const m = new Map(); for (const e of list) { const k = pairKey(e); if (!m.has(k)) m.set(k, []); m.get(k).push(e); } return m; };
  const headG = group(head);
  for (const [k, ns] of group(now)) {
    const hs = headG.get(k);
    if (!hs) continue;
    if (ns.length === 1 && hs.length === 1) { pairs.set(ns[0].id, hs[0]); continue; }
    const n = ns.length, m = hs.length;
    const lcs = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = ns[i].value === hs[j].value ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    const matches = [];
    for (let i = 0, j = 0; i < n && j < m;) {
      if (ns[i].value === hs[j].value) matches.push([i++, j++]);
      else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
      else j++;
    }
    let pi = 0, pj = 0;
    const gap = (iEnd, jEnd) => {
      if (iEnd - pi === jEnd - pj) { for (let a = pi, b = pj; a < iEnd; a++, b++) pairs.set(ns[a].id, hs[b]); return; } // same count: assume edits, in order
      // different counts (something was added or removed next to an edit): pair only strings that share most of their words
      const cand = [];
      for (let a = pi; a < iEnd; a++) for (let b = pj; b < jEnd; b++) cand.push([similarity(ns[a].value, hs[b].value), a, b]);
      cand.sort((x, y) => y[0] - x[0]);
      const usedA = new Set(), usedB = new Set();
      for (const [score, a, b] of cand) {
        if (score < 0.4) break;
        if (usedA.has(a) || usedB.has(b)) continue;
        usedA.add(a); usedB.add(b); pairs.set(ns[a].id, hs[b]);
      }
    };
    for (const [mi, mj] of matches) { gap(mi, mj); pairs.set(ns[mi].id, hs[mj]); pi = mi + 1; pj = mj + 1; }
    gap(n, m);
  }
  return pairs;
}

// All text entries, from the working copy, with the last commit's text alongside.
export function listText() {
  const files = ['html', ...jsFiles()];
  const byGroup = new Map(DEFS.groups.map((g) => [g.id, { id: g.id, label: g.label, note: g.note || '', entries: [] }]));
  byGroup.set('other', { id: 'other', label: DEFS.otherLabel, note: DEFS.otherNote || '', entries: [] });
  const problems = [];
  const sha = headSha();
  for (const file of files) {
    let now;
    try { now = scanCached(file, readFile(file)); } catch (e) { problems.push(`${relPath(file)}: could not be read (${e.message})`); continue; }
    const headText = readHead(file, sha);
    let pairs = new Map();
    if (headText) { try { pairs = pairWithHead(now, scanCached(file, headText)); } catch { /* no comparison for this file */ } }
    for (const e of now) {
      if (!e.listed) continue;
      const d = describe(e);
      const o = pairs.get(e.id);
      const original = o ? o.value : null;
      const g = byGroup.get(groupFor(e)) || byGroup.get('other');
      g.entries.push({
        id: e.id, file: relPath(file), label: d.label, code: d.code, sub: d.sub, value: e.value, original,
        raw: e.raw, linked: !!(e.parent || e.hasNested),
      });
    }
  }
  return { groups: [...byGroup.values()].filter((g) => g.entries.length), problems, files: files.map(relPath) };
}

// ====================================================================================================
//  writing
// ====================================================================================================
function escapeJs(value, quote) {
  let out = '';
  for (const ch of value) {
    if (ch === '\\') out += '\\\\';
    else if (ch === '\n') out += quote === '`' ? '\n' : '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\u2028') out += '\\u2028';
    else if (ch === '\u2029') out += '\\u2029';
    else if (ch === quote) out += '\\' + ch;
    else out += ch;
  }
  if (quote === '`') out = out.replace(/\$\{/g, '\\${');
  return out;
}
function placeholders(rawTemplate) {
  // the ${ ... } parts, brace-matched (strings inside them can hold braces, so skip quoted runs)
  const out = [];
  for (let i = 0; i < rawTemplate.length; i++) {
    if (rawTemplate[i] === '\\') { i++; continue; }
    if (rawTemplate[i] === '$' && rawTemplate[i + 1] === '{') {
      let depth = 1, j = i + 2, q = null;
      for (; j < rawTemplate.length && depth; j++) {
        const c = rawTemplate[j];
        if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
        if (c === '"' || c === "'" || c === '`') q = c;
        else if (c === '{') depth++;
        else if (c === '}') depth--;
      }
      out.push(rawTemplate.slice(i, j));
      i = j - 1;
    }
  }
  return out;
}

function find(file, id) {
  const text = readFile(file);
  const entries = scanCached(file, text);
  const e = entries.find((x) => x.id === id);
  if (!e) throw new Error('that text is no longer in the file (reload the Text tab)');
  return { text, e };
}
function fileOfId(id) {
  const m = /^([A-Za-z]+):/.exec(id);
  if (!m || (m[1] !== 'html' && !jsFiles().includes(m[1]))) throw new Error('unknown text id');
  return m[1];
}

export function setText(id, value, base) {
  const file = fileOfId(id);
  if (typeof value !== 'string') throw new Error('not text');
  const { text, e } = find(file, id);
  if (base !== undefined && base !== null && base !== e.value) throw new Error('this text was changed somewhere else since the tab loaded - reload the Text tab (the other change was kept)');
  let next;
  if (file === 'html') {
    const v = collapse(value);
    if (!/[A-Za-z]{2}/.test(v)) throw new Error('keep at least a word of text here');
    if (e.html === 'text' && /</.test(v)) throw new Error('use plain text here - a "<" would start an HTML tag');
    if (e.html === 'attr' && /["<]/.test(v)) throw new Error('tooltips cannot contain " or <');
    if (v === e.value) return e.value;
    next = text.slice(0, e.start) + v + text.slice(e.end);
    scanHtml(next); // refuse anything that cannot be re-read
    return commit(file, text, next, id, v);
  }
  if (!value.trim()) throw new Error('text cannot be empty');
  if (e.raw) {
    const before = placeholders(text.slice(e.start + 1, e.end - 1));
    if (JSON.stringify(placeholders(value)) !== JSON.stringify(before)) throw new Error('this text has ${ } parts the game fills in - keep each one exactly as it is (same order)');
    next = text.slice(0, e.start) + '`' + value + '`' + text.slice(e.end);
  } else {
    const q = e.quote;
    next = text.slice(0, e.start) + q + escapeJs(value, q) + q + text.slice(e.end);
  }
  try { acorn.parse(next, { ecmaVersion: 'latest', sourceType: 'module' }); } catch (err) { throw new Error('that would break the file: ' + err.message); }
  // the same id must now hold the new text (guards against escapes or backticks reshaping the code around it)
  const after = scanCached(file, next).find((x) => x.id === id);
  if (!after || after.value !== value) throw new Error('that text could not be written safely');
  return commit(file, text, next, id, after.value);
}
function commit(file, before, next, id, value) {
  if (readFile(file) !== before) throw new Error('the file changed while saving - try again');
  fs.writeFileSync(path.join(ROOT, relPath(file)), next);
  return value;
}

export function resetText(id) {
  const file = fileOfId(id);
  const head = readHead(file);
  if (!head) throw new Error('no committed version to reset to');
  // the committed string this one came from (see pairWithHead: ids inside functions can shift when code was edited)
  const { text, e } = find(file, id);
  const k = pairKey(e);
  const o = pairWithHead(scanCached(file, text).filter((x) => pairKey(x) === k), scanCached(file, head).filter((x) => pairKey(x) === k)).get(id);
  if (!o) throw new Error('no committed text for this one');
  return setText(id, o.value);
}
