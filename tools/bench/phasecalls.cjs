// node bench/phasecalls.cjs <fixture> [ablate-phase-tag]  -> per-phase canvas call counts; with a tag, that phase's DRAWING calls are no-ops and timing is reported
const { chromium } = require('./pw.cjs');
const fs = require('fs'); const path = require('path');
(async () => {
  const fixture = process.argv[2] === 'none' ? null : (process.argv[2] || 'stress.json');
  const ablate = process.argv[3] || null;
  const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist', '--disable-renderer-backgrounding'] });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 950 } })).newPage();
  const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
  if (fixture) { const j = fs.readFileSync(path.join(__dirname, 'fixtures', fixture), 'utf8'); await page.addInitScript((s) => localStorage.setItem('finsanity_save_v1', s), j); }
  await page.addInitScript((ab) => {
    window.__cc = { on: false, counts: {}, frames: 0, ablate: ab };
    const P = CanvasRenderingContext2D.prototype;
    const draw = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'drawImage']);
    for (const m of ['save', 'restore', 'translate', 'rotate', 'scale', 'setTransform', 'arc', 'ellipse', 'fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'drawImage', 'beginPath', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'createRadialGradient', 'createLinearGradient', 'clip']) {
      const o = P[m];
      P[m] = function (...a) {
        const tag = window.__phaseAfter || '(start)';
        if (window.__cc.on) { const c = window.__cc.counts[tag] || (window.__cc.counts[tag] = {}); c[m] = (c[m] || 0) + 1; }
        if (window.__cc.ablate && tag === window.__cc.ablate && draw.has(m)) return;
        return o.apply(this, a);
      };
    }
    (function loop() { if (window.__cc.on) window.__cc.frames++; requestAnimationFrame(loop); })();
  }, ablate);
  await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded' });
  for (let gi = 0; gi < 60 && (await page.$('#start-overlay.hidden') || !(await page.$('#start-overlay'))); gi++) { await page.waitForTimeout(400); await page.mouse.click(8, 8); }
  await page.waitForTimeout(1500);
  if (fixture) await page.click('#start-continue-btn'); else { await page.click('text=New Game'); await page.waitForTimeout(800); await page.click('#start-mode-exp-btn'); }
  await page.waitForTimeout(3500);
  for (let i = 0; i < 3 && !(await page.isVisible('#pause-save-btn')); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
  for (let i = 0; i < 3 && (await page.isVisible('#pause-save-btn')); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  if (process.env.PAUSETIME) await page.click('#time-pause-btn');
  await page.mouse.move(800, 420); await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__cc.counts = {}; window.__cc.frames = 0; window.__cc.on = true; window.__f = []; let l = performance.now(); (function t(n) { window.__f.push(n - l); l = n; window.__raf = requestAnimationFrame(t); })(l); });
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  await page.waitForTimeout(6000);
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const r = await page.evaluate(() => { window.__cc.on = false; cancelAnimationFrame(window.__raf); const f = window.__f.slice(1); return { cc: window.__cc, avg: f.reduce((a, b) => a + b, 0) / f.length, n: f.length }; });
  if (ablate) console.log(`ABLATED draws tagged "${ablate}": frame ${r.avg.toFixed(1)}ms  main ${(((m1.TaskDuration - m0.TaskDuration) * 1000) / r.n).toFixed(1)}ms/frame`);
  else {
    console.log(`baseline: frame ${r.avg.toFixed(1)}ms  main ${(((m1.TaskDuration - m0.TaskDuration) * 1000) / r.n).toFixed(1)}ms/frame; frames ${r.cc.frames}`);
    for (const [tag, c] of Object.entries(r.cc.counts)) { const tot = Object.entries(c).map(([k, v]) => `${k}:${(v / r.cc.frames).toFixed(0)}`).join(' '); console.log(`tag "${tag}" (draws belong to the phase AFTER this mark):\n    ${tot}`); }
  }
  await browser.close();
})();
