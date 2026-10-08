// node tools/bench/callers.cjs <fixture|none> -> per rendered frame, which JS functions issue fill/stroke/drawImage/fillText calls (stack-sampled; diagnostic only, slows the game)
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
    for (const m of ['fill', 'stroke', 'drawImage', 'fillRect', 'strokeRect', 'fillText', 'strokeText']) {
      const o = P[m];
      P[m] = function (...a) {
        if (window.__cc.on) {
          const st = new Error().stack.split('\n'); let fr = '?';
          for (let i = 2; i < st.length; i++) { const mm = st[i].match(/at (?:async )?([^\s(]+) \(.*?([\w.]+\.js):(\d+)/); if (mm) { fr = `${mm[1]} ${mm[2]}` + (mm[1] === 'render' ? ':' + mm[3] : ''); break; } }
          const k = m + '  ' + fr; window.__cc.counts[k] = (window.__cc.counts[k] || 0) + 1;
        }
        return o.apply(this, a);
      };
    }
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
  if (process.env.CLEAR_ITEMS) { await page.keyboard.press('KeyK'); await page.waitForTimeout(3000); } // cheat key: remove every item, isolating fish/buildings/ambience
  await page.evaluate(() => { window.__cc.counts = {}; window.__cc.frames = 0; window.__cc.on = true; });
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => { window.__cc.on = false; return window.__cc; });
  console.log('rendered frames counted:', r.frames);
  Object.entries(r.counts).sort((a, b) => b[1] - a[1]).slice(0, parseInt(process.env.TOP || '30', 10)).forEach(([k, v]) => console.log((v / r.frames).toFixed(1).padStart(7), 'per frame ', k));
  await browser.close();
})();
