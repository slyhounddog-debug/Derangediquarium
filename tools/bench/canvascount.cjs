const { openGame } = require('./lib.cjs');
async function run(frozen) {
  const h = await openGame({ fixture: 'stress.json' }); const { page } = h;
  await page.evaluate(() => { window.__cn = { canvases: 0, resizes: 0, on: false }; const o = document.createElement.bind(document); document.createElement = function (t, ...a) { const el = o(t, ...a); if (window.__cn.on && String(t).toLowerCase() === 'canvas') window.__cn.canvases++; return el; };
    for (const p of ['width', 'height']) { const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, p); Object.defineProperty(HTMLCanvasElement.prototype, p, { get: d.get, set(v) { if (window.__cn.on) window.__cn.resizes++; d.set.call(this, v); }, configurable: true }); } });
  if (frozen) await h.page.click('#time-pause-btn');
  await page.waitForTimeout(3000);
  await page.evaluate(() => { window.__cn.on = true; }); await page.waitForTimeout(5000);
  const r = await page.evaluate(() => window.__cn); await h.browser.close();
  console.log(frozen ? 'FROZEN' : 'LIVE  ', `canvases created/s: ${(r.canvases / 5).toFixed(1)}   canvas width/height assignments/s: ${(r.resizes / 5).toFixed(1)}`);
}
(async () => { await run(false); await run(true); })();
