// Visual-regression harness. Makes the game deterministic (seeded Math.random, Playwright fake clock so
// rAF/performance.now/timers advance only when we say, caustic video frozen on frame 0), screenshots fixed
// views, and diffs them against a saved reference set with a perceptual-ish metric.
//
//   node bench/visual.cjs capture <set>              -> bench/visual/<set>/<view>.png
//   node bench/visual.cjs compare <refSet> [curSet]  -> captures curSet (default "_cur"), diffs vs refSet, writes diff PNGs
//   node bench/visual.cjs diff <setA> <setB>         -> diffs two existing sets
const fs = require('fs');
const path = require('path');
const { chromium } = require('./pw.cjs');

const URL = process.env.BENCH_URL || 'http://localhost:8080/';
const ROOT = path.join(__dirname, 'visual');
const FIXTURES = path.join(__dirname, 'fixtures');

const VIEWS = [
  { id: 'empty_top', fixture: null, scroll: false, menu: null },
  { id: 'empty_bottom', fixture: null, scroll: true, menu: null },
  { id: 'stress_top', fixture: 'stress.json', scroll: false, menu: null },
  { id: 'stress_bottom', fixture: 'stress.json', scroll: true, menu: null },
  { id: 'stress_shop', fixture: 'stress.json', scroll: true, menu: 'KeyE' },
  { id: 'stress_tank', fixture: 'stress.json', scroll: true, menu: 'KeyT' },
  { id: 'stress_lab', fixture: 'stress.json', scroll: true, menu: 'KeyS' },
  { id: 'looks', fixture: 'looks.json', scroll: false, menu: null }, // every fish look (tiers, tints, stages, dying, hat) — see mklooks.cjs
];

function seedScript() {
  let s = 0x12345678;
  window.__reseed = () => { s = 0x12345678; };
  Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  Object.defineProperty(HTMLMediaElement.prototype, 'autoplay', { get() { return false; }, set() {}, configurable: true });
  HTMLMediaElement.prototype.play = function () { return Promise.resolve(); }; // caustic video stays on frame 0 -> deterministic light
}

async function captureView(browser, view, outFile) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(seedScript);
  if (view.fixture) {
    const json = fs.readFileSync(path.join(FIXTURES, view.fixture), 'utf8');
    await page.addInitScript((j) => { try { localStorage.setItem('finsanity_save_v1', j); } catch (e) { /* ignore */ } }, json);
  }
  await page.clock.install({ time: 1700000000000 });
  await page.clock.pauseAt(1700000000100); // install() alone leaves the fake clock running in real time (non-deterministic); from here time only moves via runFor
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  for (let gi = 0; gi < 60 && (await page.$('#start-overlay.hidden') || !(await page.$('#start-overlay'))); gi++) { await page.clock.runFor(400); await page.waitForTimeout(60); await page.mouse.click(8, 8); }
  await page.clock.runFor(1500);
  await page.evaluate(() => window.__reseed()); // title-screen frames consume a timing-dependent number of random calls; restart the sequence exactly at game start
  if (view.fixture) { await page.click('#start-continue-btn'); await page.click('#time-pause-btn'); } // Pause Time at once (zero frames elapsed under the paused fake clock) so fish/items stay exactly at their fixture positions — the live stress sim isn't reproducible run-to-run
  else { await page.click('text=New Game'); await page.clock.runFor(800); await page.click('#start-mode-exp-btn'); }
  await page.clock.runFor(2500);
  for (let i = 0; i < 4 && !(await page.isVisible('#pause-save-btn')); i++) { await page.keyboard.press('Escape'); await page.clock.runFor(250); }
  for (let i = 0; i < 3 && (await page.isVisible('#pause-save-btn')); i++) { await page.keyboard.press('Escape'); await page.clock.runFor(300); }
  if (!view.fixture) {
    await page.keyboard.press('KeyM');
    for (let i = 0; i < 12; i++) { await page.keyboard.press('KeyN'); await page.clock.runFor(150); }
  }
  await page.mouse.move(800, 420);
  await page.clock.runFor(parseInt(process.env.SETTLE_MS || '4000', 10)); // let the sim settle deterministically
  if (view.scroll) { await page.keyboard.down('ArrowDown'); await page.clock.runFor(3000); await page.keyboard.up('ArrowDown'); await page.clock.runFor(500); }
  if (view.menu) { await page.keyboard.press(view.menu); await page.clock.runFor(1500); await page.waitForTimeout(1200); }
  await page.clock.runFor(200);
  await page.screenshot({ path: outFile, animations: 'disabled', caret: 'hide' });
  await context.close();
  return errors;
}

async function captureSet(set) {
  const dir = path.join(ROOT, set);
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  try {
    for (const v of VIEWS.filter((x) => !process.env.VIEW_FILTER || process.env.VIEW_FILTER.split(",").includes(x.id))) {
      const errs = await captureView(browser, v, path.join(dir, v.id + '.png'));
      console.log(`captured ${set}/${v.id}${errs.length ? '  PAGEERRORS: ' + errs.join(' | ') : ''}`);
    }
  } finally { await browser.close(); }
}

async function diffSets(a, b) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('about:blank');
  const outDir = path.join(ROOT, `diff_${b}_vs_${a}`);
  fs.mkdirSync(outDir, { recursive: true });
  const rows = [];
  for (const v of VIEWS.filter((x) => !process.env.VIEW_FILTER || process.env.VIEW_FILTER.split(",").includes(x.id))) {
    const pa = path.join(ROOT, a, v.id + '.png'), pb = path.join(ROOT, b, v.id + '.png');
    if (!fs.existsSync(pa) || !fs.existsSync(pb)) { rows.push({ id: v.id, missing: true }); continue; }
    const r = await page.evaluate(async ([x, y]) => {
      const load = (b64) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + b64; });
      const [ia, ib] = await Promise.all([load(x), load(y)]);
      const w = ia.width, h = ia.height;
      if (ib.width !== w || ib.height !== h) return { sizeMismatch: true };
      const get = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
      const A = get(ia), B = get(ib);
      const out = document.createElement('canvas'); out.width = w; out.height = h; const og = out.getContext('2d'); const od = og.createImageData(w, h);
      let sum = 0, n8 = 0, n24 = 0, max = 0;
      const BS = 32, bw = Math.ceil(w / BS), bh = Math.ceil(h / BS), blocks = new Float64Array(bw * bh);
      for (let p = 0, px = 0; p < A.length; p += 4, px++) {
        const d0 = Math.abs(A[p] - B[p]), d1 = Math.abs(A[p + 1] - B[p + 1]), d2 = Math.abs(A[p + 2] - B[p + 2]);
        const m = Math.max(d0, d1, d2), avg = (d0 + d1 + d2) / 3;
        sum += avg; if (m > 8) n8++; if (m > 24) n24++; if (m > max) max = m;
        const x0 = px % w, y0 = (px / w) | 0; blocks[((y0 / BS) | 0) * bw + ((x0 / BS) | 0)] += avg;
        const v = Math.min(255, m * 8); od.data[p] = v; od.data[p + 1] = m > 24 ? 0 : v; od.data[p + 2] = m > 24 ? 0 : v; od.data[p + 3] = 255;
      }
      og.putImageData(od, 0, 0);
      let blockMax = 0; for (const s of blocks) if (s / (BS * BS) > blockMax) blockMax = s / (BS * BS);
      const total = w * h;
      return { meanAbs: sum / total, pct8: (n8 / total) * 100, pct24: (n24 / total) * 100, max, blockMax, diffUrl: out.toDataURL('image/png') };
    }, [fs.readFileSync(pa).toString('base64'), fs.readFileSync(pb).toString('base64')]);
    if (r.diffUrl) fs.writeFileSync(path.join(outDir, v.id + '.png'), Buffer.from(r.diffUrl.split(',')[1], 'base64'));
    delete r.diffUrl;
    rows.push({ id: v.id, ...r });
  }
  await browser.close();
  console.log(`\nVisual diff ${b} vs ${a}   (meanAbs 0-255; pct8/pct24 = % pixels whose worst channel differs by >8/>24; blockMax = worst 32x32 block mean diff)`);
  for (const r of rows) {
    if (r.missing) { console.log(r.id.padEnd(15), 'MISSING'); continue; }
    if (r.sizeMismatch) { console.log(r.id.padEnd(15), 'SIZE MISMATCH'); continue; }
    console.log(r.id.padEnd(15), `meanAbs ${r.meanAbs.toFixed(3).padStart(7)}  pct8 ${r.pct8.toFixed(3).padStart(7)}%  pct24 ${r.pct24.toFixed(3).padStart(7)}%  max ${String(r.max).padStart(3)}  blockMax ${r.blockMax.toFixed(2)}`);
  }
  return rows;
}

(async () => {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'capture') await captureSet(a);
  else if (cmd === 'compare') { const cur = b || '_cur'; await captureSet(cur); await diffSets(a, cur); }
  else if (cmd === 'diff') await diffSets(a, b);
  else console.log('usage: capture <set> | compare <refSet> [curSet] | diff <a> <b>');
})();
