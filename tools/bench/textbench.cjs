// Isolated micro-benchmark: what does canvas fillText cost per frame next to ~1000 sprite draws, vs pre-rendered text sprites?
const { chromium } = require('./pw.cjs');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 950 } })).newPage();
  await page.goto('about:blank');
  const out = await page.evaluate(async () => {
    const W = 1600, H = 950, N = 1000, S = 28;
    const main = document.createElement('canvas'); main.width = W; main.height = H; document.body.appendChild(main);
    const fg = document.createElement('canvas'); fg.width = W; fg.height = H;
    const mctx = main.getContext('2d'), fctx = fg.getContext('2d');
    const spr = document.createElement('canvas'); spr.width = S; spr.height = S; const sc = spr.getContext('2d'); sc.fillStyle = '#c93'; sc.beginPath(); sc.arc(S / 2, S / 2, S / 2 - 1, 0, 7); sc.fill();
    const texts = ['+6', '+12', '+1', '+0.1', '+30', '+2', '+8', '+4'];
    const textSprites = texts.map((t) => { const c = document.createElement('canvas'); c.width = 48; c.height = 20; const g = c.getContext('2d'); g.font = 'bold 13px sans-serif'; g.fillStyle = '#ffd966'; g.fillText(t, 4, 15); return c; });
    let seed = 1; const r = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const items = Array.from({ length: N }, () => ({ x: 40 + r() * (W - 80), y: 40 + r() * (H - 80) }));
    const variants = {
      'sprites only (no text)': (f) => {},
      '5 fillText / frame (changing alpha, like the pickup texts)': (f) => { for (let i = 0; i < 5; i++) { fctx.globalAlpha = 0.3 + 0.14 * i; fctx.fillStyle = '#ffd966'; fctx.font = 'bold 13px sans-serif'; fctx.fillText(texts[i], 300 + i * 150 + (f % 50), 400 - (f % 80)); } fctx.globalAlpha = 1; },
      '20 fillText / frame': (f) => { for (let i = 0; i < 20; i++) { fctx.globalAlpha = 0.3 + 0.03 * i; fctx.fillStyle = '#ffd966'; fctx.font = 'bold 13px sans-serif'; fctx.fillText(texts[i % 8], 100 + i * 70 + (f % 50), 400 - (f % 80)); } fctx.globalAlpha = 1; },
      '5 pre-rendered text sprites / frame': (f) => { for (let i = 0; i < 5; i++) { fctx.globalAlpha = 0.3 + 0.14 * i; fctx.drawImage(textSprites[i], 300 + i * 150 + (f % 50), 385 - (f % 80)); } fctx.globalAlpha = 1; },
      '20 pre-rendered text sprites / frame': (f) => { for (let i = 0; i < 20; i++) { fctx.globalAlpha = 0.3 + 0.03 * i; fctx.drawImage(textSprites[i % 8], 100 + i * 70 + (f % 50), 385 - (f % 80)); } fctx.globalAlpha = 1; },
    };
    const results = {};
    for (const [name, fn] of Object.entries(variants)) {
      const flush = []; const frames = [];
      for (let f = 0; f < 120; f++) {
        fctx.clearRect(0, 0, W, H);
        for (const it of items) { it.x += (r() - .5); fctx.drawImage(spr, it.x, it.y); }
        fn(f);
        const t0 = performance.now(); mctx.drawImage(fg, 0, 0); flush.push(performance.now() - t0);
        const t1 = performance.now(); await new Promise((res) => requestAnimationFrame(res)); frames.push(performance.now() - t1);
      }
      const avg = (a) => (a.slice(30).reduce((x, y) => x + y, 0) / (a.length - 30));
      results[name] = { flush_ms: +avg(flush).toFixed(2), frame_ms: +avg(frames).toFixed(2) };
    }
    return results;
  });
  for (const [k, v] of Object.entries(out)) console.log(k.padEnd(62), `flush ${String(v.flush_ms).padStart(6)}ms   rAF interval ${String(v.frame_ms).padStart(6)}ms`);
  await browser.close();
})();
