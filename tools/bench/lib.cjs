// Benchmark harness for Finsanity. Drives a real (headed) Chromium window so the GPU is the real GPU.
// Nothing here touches project files; it only reads the running game through the page + CDP.
const fs = require('fs');
const path = require('path');
const { chromium } = require('./pw.cjs');

const URL = process.env.BENCH_URL || 'http://localhost:8080/';
const FIXTURES = path.join(__dirname, 'fixtures');

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

// fixture: null for a fresh New Game (experienced), or a file name in fixtures/ to Continue from.
async function openGame({ fixture = null, headless = false, onError } = {}) {
  const browser = await chromium.launch({
    headless,
    args: ['--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', ...(process.env.BENCH_UNCAPPED ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [])],
  });
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => { errors.push('PAGEERROR: ' + e.message); if (onError) onError(e); });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text() + ' @ ' + m.location().url); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  if (fixture) {
    const json = fs.readFileSync(path.join(FIXTURES, fixture), 'utf8');
    await page.addInitScript((j) => { try { localStorage.setItem('finsanity_save_v1', j); } catch (e) { /* ignore */ } }, json);
  }
  if (process.env.BENCH_NOCAUSTIC) await page.route('**/lighting%20effect.mp4', (r) => r.abort());
  if (process.env.BENCH_INIT) await page.addInitScript({ path: require('path').resolve(process.env.BENCH_INIT) }); // any experiment script, injected before the game loads
  if (process.env.BENCH_ATLAS) await page.addInitScript({ path: require('path').join(__dirname, 'atlas_shim.js') });
  if (process.env.BENCH_OPAQUE) await page.addInitScript({ path: require('path').join(__dirname, 'opaque_shim.js') });
  if (process.env.BENCH_ABLATE) {
    // Experiment: every fill/stroke/drawImage/fillRect/fillText issued by a function whose name matches this regex becomes a no-op (the function's own JS still runs), so a scenario's cost with vs without it shows what that drawing really costs.
    await page.addInitScript((re) => {
      const rx = new RegExp(re); const P = CanvasRenderingContext2D.prototype;
      for (const m of ['fill', 'stroke', 'drawImage', 'fillRect', 'strokeRect', 'fillText', 'strokeText']) {
        const o = P[m];
        P[m] = function (...a) { const st = new Error().stack.split('\n'); for (let i = 2; i < st.length; i++) { const mm = st[i].match(/at (?:async )?([^\s(]+) \(/); if (mm) { if (rx.test(mm[1])) return; break; } } return o.apply(this, a); };
      }
    }, process.env.BENCH_ABLATE);
  }
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.goto(URL + '?perf', { waitUntil: 'domcontentloaded' });
  for (let gi = 0; gi < 60 && (await page.$('#start-overlay.hidden') || !(await page.$('#start-overlay'))); gi++) { await page.waitForTimeout(400); await page.mouse.click(8, 8); }
  await page.waitForTimeout(1500);
  if (fixture) {
    await page.click('#start-continue-btn');
  } else {
    await page.click('text=New Game'); await page.waitForTimeout(800); await page.click('#start-mode-exp-btn');
  }
  await page.waitForTimeout(2500);
  for (let i = 0; i < 4 && !(await page.isVisible('#pause-save-btn')) ; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); } // first Escapes skip any tutorial overlay; stop as soon as the pause menu shows
  for (let i = 0; i < 3 && (await page.isVisible('#pause-save-btn')); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } // ...then make sure we end UNpaused
  if (!fixture) {
    await page.keyboard.press('KeyM');
    for (let i = 0; i < 12; i++) { await page.keyboard.press('KeyN'); await page.waitForTimeout(150); } // crack the Mound open so the Science Lab exists
  }
  await page.mouse.move(800, 420);
  return { browser, context, page, cdp, errors };
}

async function readOverlay(page) {
  const txt = await page.evaluate(() => (document.getElementById('perf-overlay') || {}).textContent || '');
  const num = (re) => { const m = txt.match(re); return m ? parseFloat(m[1]) : NaN; };
  const phases = {};
  const idx = txt.indexOf('ms per frame by phase');
  if (idx >= 0) for (const line of txt.slice(idx).split('\n').slice(1)) { const m = line.match(/^\s*([\d.]+)\s+(.+)$/); if (m) phases[m[2]] = parseFloat(m[1]); }
  return {
    updateMs: num(/update:.*?([\d.]+)ms\/frame/), stepsPerFrame: num(/update:\s*(?:!! )?([\d.]+) steps\/frame/),
    renderMs: num(/render:\s*([\d.]+)ms\/frame/),
    items: num(/items (\d+)/), fish: num(/fish (\d+)/), buildings: num(/buildings (\d+)/), phases,
  };
}

const startSampler = (page) => page.evaluate(() => { window.__f = []; let l = performance.now(); (function t(n) { window.__f.push(n - l); l = n; window.__raf = requestAnimationFrame(t); })(l); });
const stopSampler = (page) => page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__f.slice(1); });
const getMetrics = async (cdp) => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));

// One normal measurement window: frame intervals, main-thread cost (CDP), and the game's own F3 per-phase JS timings (averaged over the window).
async function measureWindow(h, secs = 6) {
  const { page, cdp } = h;
  await startSampler(page);
  const m0 = await getMetrics(cdp);
  const wall0 = Date.now();
  const first = await readOverlay(page);
  const reads = [];
  const end = Date.now() + secs * 1000;
  while (Date.now() < end) { await page.waitForTimeout(500); reads.push(await readOverlay(page)); }
  const m1 = await getMetrics(cdp);
  const wallSecs = (Date.now() - wall0) / 1000;
  const f = await stopSampler(page);
  const n = f.length, sorted = [...f].sort((a, b) => a - b);
  const d = (k) => ((m1[k] - m0[k]) * 1000) / n;
  const phases = {};
  for (const r of reads) for (const [k, v] of Object.entries(r.phases)) (phases[k] ||= []).push(v);
  for (const k of Object.keys(phases)) phases[k] = +(mean(phases[k]) || 0).toFixed(2);
  const good = reads.filter((r) => !isNaN(r.renderMs));
  return {
    frames: n, intervalAvg: +mean(f).toFixed(2), p50: +sorted[Math.floor(n * 0.5)].toFixed(1), p95: +sorted[Math.floor(n * 0.95)].toFixed(1), p99: +sorted[Math.floor(n * 0.99)].toFixed(1), max: +sorted[n - 1].toFixed(1),
    fps: +(1000 / mean(f)).toFixed(1),
    mainMsPerSec: +(((m1.TaskDuration - m0.TaskDuration) * 1000) / wallSecs).toFixed(0), scriptMsPerSec: +(((m1.ScriptDuration - m0.ScriptDuration) * 1000) / wallSecs).toFixed(0),
    mainTask: +d('TaskDuration').toFixed(2), script: +d('ScriptDuration').toFixed(2), layout: +d('LayoutDuration').toFixed(2), style: +d('RecalcStyleDuration').toFixed(2),
    updateMs: +mean(good.map((r) => r.updateMs)).toFixed(2), renderMs: +mean(good.map((r) => r.renderMs)).toFixed(2),
    stepsPerFrame: +mean(good.map((r) => r.stepsPerFrame)).toFixed(2),
    objects: { fish: first.fish, items: first.items, buildings: first.buildings, itemsEnd: reads.length ? reads[reads.length - 1].items : NaN },
    phases,
  };
}

// GPU busy time: a short Chromium trace; sums the GPU process's GPUTask events (what the GPU actually spent) per rendered frame.
async function measureGpu(h, secs = 3) {
  const { page, browser } = h;
  await startSampler(page);
  await browser.startTracing(page, { categories: ['-*', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'cc', 'gpu', 'viz', 'benchmark', 'toplevel'] });
  await page.waitForTimeout(secs * 1000);
  const buf = await browser.stopTracing();
  const frames = (await stopSampler(page)).length;
  const ev = JSON.parse(buf.toString()).traceEvents;
  const thr = {}; for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') thr[e.pid + ':' + e.tid] = e.args.name;
  let gpuTask = 0, raster = 0;
  for (const e of ev) {
    if (e.ph !== 'X' || !e.dur) continue;
    const t = thr[e.pid + ':' + e.tid];
    if (t === 'CrGpuMain' && e.name === 'GPUTask') gpuTask += e.dur / 1000;
    if (t === 'CrGpuMain' && e.name === 'RasterDecoderImpl::DoEndRasterCHROMIUM') raster += e.dur / 1000;
  }
  return { gpuMsPerSec: +((gpuTask / secs)).toFixed(0), gpuBusyMsPerFrame: +(gpuTask / frames).toFixed(2), gpuBusyPct: +((gpuTask / (secs * 1000)) * 100).toFixed(1), rasterMsPerFrame: +(raster / frames).toFixed(2) };
}

// Opens/closes a menu with its hotkey around a measurement.
async function withMenu(h, key, fn) {
  if (key) { await h.page.keyboard.press(key); await h.page.waitForTimeout(1200); }
  try { return await fn(); } finally { if (key) { await h.page.keyboard.press(key); await h.page.waitForTimeout(700); } }
}

const SCENARIOS = [
  { id: 'empty', fixture: null, menu: null },
  { id: 'empty+shop', fixture: null, menu: 'KeyE' },
  { id: 'empty+tank', fixture: null, menu: 'KeyT' },
  { id: 'empty+lab', fixture: null, menu: 'KeyS' },
  { id: 'stress', fixture: 'stress.json', menu: null },
  { id: 'stress+shop', fixture: 'stress.json', menu: 'KeyE' },
  { id: 'stress+tank', fixture: 'stress.json', menu: 'KeyT' },
  { id: 'stress+lab', fixture: 'stress.json', menu: 'KeyS' },
];

// Runs one scenario on a FRESH page (identical starting state every time) and returns its measurements.
async function runScenario(sc, { secs = 6, gpuSecs = 3, setup } = {}) {
  const h = await openGame({ fixture: sc.fixture });
  try {
    if (setup) await setup(h);
    if (process.env.BENCH_WAIT_BEFORE_PAUSE) await h.page.waitForTimeout(parseInt(process.env.BENCH_WAIT_BEFORE_PAUSE, 10)); // let items fall and pile first
    if (process.env.BENCH_PAUSETIME) await h.page.click('#time-pause-btn'); // entities frozen: isolates render cost
    await h.page.waitForTimeout(3000); // settle
    return await withMenu(h, sc.menu, async () => {
      const m = await measureWindow(h, secs);
      const g = await measureGpu(h, gpuSecs);
      const errs = h.errors.filter((e) => !/favicon/.test(e));
      return { ...m, ...g, errors: errs };
    });
  } finally { await h.browser.close(); }
}

function summarize(runs) {
  const pick = (k) => +median(runs.map((r) => r[k])).toFixed(2);
  const phases = {};
  for (const r of runs) for (const [k, v] of Object.entries(r.phases)) (phases[k] ||= []).push(v);
  for (const k of Object.keys(phases)) phases[k] = +median(phases[k]).toFixed(2);
  return {
    runs: runs.length, intervalAvg: pick('intervalAvg'), p95: pick('p95'), p99: pick('p99'), max: pick('max'), fps: pick('fps'),
    mainMsPerSec: pick('mainMsPerSec'), scriptMsPerSec: pick('scriptMsPerSec'), gpuMsPerSec: pick('gpuMsPerSec'),
    mainTask: pick('mainTask'), script: pick('script'), layout: pick('layout'), style: pick('style'), updateMs: pick('updateMs'), renderMs: pick('renderMs'),
    gpuBusyMsPerFrame: pick('gpuBusyMsPerFrame'), gpuBusyPct: pick('gpuBusyPct'), rasterMsPerFrame: pick('rasterMsPerFrame'),
    items: runs[0].objects.items, itemsEnd: median(runs.map((r) => r.objects.itemsEnd)), fish: runs[0].objects.fish, buildings: runs[0].objects.buildings,
    errors: [...new Set(runs.flatMap((r) => r.errors))], phases,
  };
}

module.exports = { openGame, measureWindow, measureGpu, withMenu, runScenario, summarize, SCENARIOS, median, mean };
