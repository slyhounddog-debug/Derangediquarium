// Sound-effect audition tool server. Run: node tools/sfx/server.mjs  ->  http://localhost:8081
// Deliberately a separate server from the game's (server.js, port 8080): it has file-writing
// endpoints, and keeping it separate means the game server never needs restarting for it.
//
// Folders (all under audio/):
//   sfx-candidates/<slot>/   files you are auditioning (drop them in by hand, or drag them onto the page)
//   sfx/<slot>.<ext>         the one you picked (a copy), plus sfx/manifest.json { slot: { file, gain, source } }
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const AUDIO = path.join(ROOT, 'audio');
const CANDIDATES = path.join(AUDIO, 'sfx-candidates');
const CHOSEN = path.join(AUDIO, 'sfx');
const MANIFEST = path.join(CHOSEN, 'manifest.json');
const SLOTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'slots.json'), 'utf8'));
const SLOT_IDS = new Set(SLOTS.map((s) => s.id));
const EXTS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac']);
const PORT = 8081;

for (const slot of SLOTS) fs.mkdirSync(path.join(CANDIDATES, slot.id), { recursive: true });
fs.mkdirSync(CHOSEN, { recursive: true });

function readManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return {}; }
}
function writeManifest(m) { fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2)); }

// Only plain file names with an audio extension; never anything with a path in it.
function safeName(name) {
  const base = path.basename(String(name || ''));
  if (!/^[\w .()\-\[\]]+$/.test(base)) return null;
  if (!EXTS.has(path.extname(base).toLowerCase())) return null;
  return base;
}
function slotOr400(res, slot) {
  if (!SLOT_IDS.has(slot)) { res.status(400).json({ error: 'unknown slot' }); return false; }
  return true;
}

const app = express();
app.use('/js', express.static(path.join(ROOT, 'js')));       // the page imports the game's Sound.js for the "current synth" buttons
app.use('/audio', express.static(AUDIO));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/slots', (req, res) => {
  const manifest = readManifest();
  res.json(SLOTS.map((slot) => {
    const dir = path.join(CANDIDATES, slot.id);
    const files = fs.readdirSync(dir)
      .filter((f) => EXTS.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map((f) => ({ file: f, size: fs.statSync(path.join(dir, f)).size }));
    return { ...slot, candidates: files, chosen: manifest[slot.id] || null };
  }));
});

app.post('/api/upload', express.raw({ type: '*/*', limit: '12mb' }), (req, res) => {
  const slot = String(req.query.slot);
  if (!slotOr400(res, slot)) return;
  const name = safeName(req.query.name);
  if (!name) return res.status(400).json({ error: 'bad file name or type' });
  let target = path.join(CANDIDATES, slot, name);
  for (let n = 2; fs.existsSync(target); n++) {
    const ext = path.extname(name);
    target = path.join(CANDIDATES, slot, `${path.basename(name, ext)} (${n})${ext}`);
  }
  fs.writeFileSync(target, req.body);
  res.json({ ok: true, file: path.basename(target) });
});

app.post('/api/choose', express.json(), (req, res) => {
  const { slot, file } = req.body || {};
  if (!slotOr400(res, slot)) return;
  const name = safeName(file);
  const src = name && path.join(CANDIDATES, slot, name);
  if (!src || !fs.existsSync(src)) return res.status(400).json({ error: 'no such candidate' });
  const manifest = readManifest();
  for (const f of fs.readdirSync(CHOSEN)) {
    if (path.basename(f, path.extname(f)) === slot && EXTS.has(path.extname(f).toLowerCase())) fs.unlinkSync(path.join(CHOSEN, f));
  }
  const out = slot + path.extname(name).toLowerCase();
  fs.copyFileSync(src, path.join(CHOSEN, out));
  manifest[slot] = { file: out, gain: Number.isFinite(+req.body.gain) ? +req.body.gain : 1, source: name };
  writeManifest(manifest);
  res.json({ ok: true });
});

app.post('/api/gain', express.json(), (req, res) => {
  const { slot, gain } = req.body || {};
  if (!slotOr400(res, slot)) return;
  const manifest = readManifest();
  if (!manifest[slot]) return res.status(400).json({ error: 'nothing chosen' });
  manifest[slot].gain = Math.max(0, Math.min(4, +gain || 1));
  writeManifest(manifest);
  res.json({ ok: true });
});

app.post('/api/unchoose', express.json(), (req, res) => {
  const { slot } = req.body || {};
  if (!slotOr400(res, slot)) return;
  const manifest = readManifest();
  if (manifest[slot]) {
    try { fs.unlinkSync(path.join(CHOSEN, manifest[slot].file)); } catch { /* already gone */ }
    delete manifest[slot];
    writeManifest(manifest);
  }
  res.json({ ok: true });
});

app.post('/api/delete', express.json(), (req, res) => {
  const { slot, file } = req.body || {};
  if (!slotOr400(res, slot)) return;
  const name = safeName(file);
  if (!name) return res.status(400).json({ error: 'bad name' });
  try { fs.unlinkSync(path.join(CANDIDATES, slot, name)); } catch { /* already gone */ }
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`SFX audition tool at http://localhost:${PORT}`));
