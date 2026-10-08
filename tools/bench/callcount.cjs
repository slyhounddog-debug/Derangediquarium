// node bench/callcount.cjs <fixture|none> -> canvas 2D calls per rendered frame, by method, split by target canvas size
const { chromium } = require('./pw.cjs');
const fs = require('fs'); const path = require('path');
(async () => {
  const fixture = process.argv[2] === 'none' ? null : (process.argv[2] || 'stress.json');
  const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist', '--disable-renderer-backgrounding'] });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 950 } })).newPage();
  if (fixture) { const j = fs.readFileSync(path.join(__dirname, 'fixtures', fixture), 'utf8'); await page.addInitScript((s) => localStorage.setItem('finsanity_save_v1', s), j); }
  await page.addInitScript(() => {
    window.__cc = { on: false, counts: {}, frames: 0 };
    const P = CanvasRenderingContext2D.prototype;
    const wrapM = ['save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'setTransform', 'arc', 'ellipse', 'rect', 'fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'drawImage', 'createRadialGradient', 'createLinearGradient', 'createPattern', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'clip', 'measureText', 'putImageData', 'getImageData', 'setLineDash'];
    for (const m of wrapM) { const o = P[m]; P[m] = function (...a) { if (window.__cc.on) { const k = m; window.__cc.counts[k] = (window.__cc.counts[k] || 0) + 1; if (m === 'drawImage') { const s = a[0]; const sz = s && s.width ? (s.width > 600 ? 'BIG' : 'small') : '?'; window.__cc.counts['drawImage:' + sz] = (window.__cc.counts['drawImage:' + sz] || 0) + 1; } } return o.apply(this, a); }; }
    for (const s of ['shadowBlur', 'filter', 'globalCompositeOperation', 'globalAlpha', 'fillStyle', 'strokeStyle', 'font', 'lineWidth']) { const d = Object.getOwnPropertyDescriptor(P, s); if (!d || !d.set) continue; Object.defineProperty(P, s, { get: d.get, set(v) { if (window.__cc.on) window.__cc.counts['set:' + s] = (window.__cc.counts['set:' + s] || 0) + 1; d.set.call(this, v); }, configurable: true }); }
    (function loop() { if (window.__cc.on) window.__cc.frames++; requestAnimationFrame(loop); })();
  });
  await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded' });
  for (let gi = 0; gi < 60 && (await page.$('#start-overlay.hidden') || !(await page.$('#start-overlay'))); gi++) { await page.waitForTimeout(400); await page.mouse.click(8, 8); }
  await page.waitForTimeout(1500);
  if (fixture) await page.click('#start-continue-btn'); else { await page.click('text=New Game'); await page.waitForTimeout(800); await page.click('#start-mode-exp-btn'); }
  await page.waitForTimeout(3500);
  for (let i = 0; i < 3 && !(await page.isVisible('#pause-save-btn')); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
  for (let i = 0; i < 3 && (await page.isVisible('#pause-save-btn')); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  await page.mouse.move(800, 420); await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__cc.counts = {}; window.__cc.frames = 0; window.__cc.on = true; });
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => { window.__cc.on = false; return window.__cc; });
  console.log('rendered frames counted:', r.frames);
  Object.entries(r.counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log((v / r.frames).toFixed(0).padStart(7), 'per frame ', k));
  await browser.close();
})();
