// Isolated canvas micro-benchmark: how much does it cost to draw ~1000 rotated sprites onto a 1600x950 canvas, by strategy.
const { chromium } = require('./pw.cjs');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 950 } })).newPage();
  await page.goto('about:blank');
  const out = await page.evaluate(async () => {
    const W = 1600, H = 950, N = 1000, TYPES = 6, S = 28;
    const main = document.createElement('canvas'); main.width = W; main.height = H; document.body.appendChild(main);
    const fg = document.createElement('canvas'); fg.width = W; fg.height = H;
    const mctx = main.getContext('2d'), fctx = fg.getContext('2d');
    // sprites: little shaded discs
    const makeSprite = (t) => { const c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d'); const gr = g.createRadialGradient(S * .4, S * .4, 2, S / 2, S / 2, S / 2); gr.addColorStop(0, `hsl(${t * 55},80%,75%)`); gr.addColorStop(1, `hsl(${t * 55},70%,35%)`); g.fillStyle = gr; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 1, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.stroke(); return c; };
    const sprites = Array.from({ length: TYPES }, (_, t) => makeSprite(t));
    const atlas = document.createElement('canvas'); atlas.width = S * TYPES; atlas.height = S; const actx = atlas.getContext('2d'); sprites.forEach((s, i) => actx.drawImage(s, i * S, 0));
    const bitmaps = await Promise.all(sprites.map((s) => createImageBitmap(s)));
    const swSprites = sprites.map((s) => { const c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(s, 0, 0); return c; }); // forced CPU-backed canvases
    let seed = 1; const r = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const items = Array.from({ length: N }, () => ({ t: Math.floor(r() * TYPES), x: 40 + r() * (W - 80), y: 40 + r() * (H - 80), a: r() * 6.28 }));
    const sorted = [...items].sort((p, q) => p.t - q.t);
    const strategies = {
      'separate canvases, rotated (current)': (list) => { for (const it of list) { const c = Math.cos(it.a), s = Math.sin(it.a); fctx.setTransform(c, s, -s, c, it.x, it.y); fctx.drawImage(sprites[it.t], -S / 2, -S / 2, S, S); fctx.setTransform(1, 0, 0, 1, 0, 0); } },
      'separate canvases, NOT rotated': (list) => { for (const it of list) fctx.drawImage(sprites[it.t], it.x - S / 2, it.y - S / 2, S, S); },
      'single atlas canvas, rotated': (list) => { for (const it of list) { const c = Math.cos(it.a), s = Math.sin(it.a); fctx.setTransform(c, s, -s, c, it.x, it.y); fctx.drawImage(atlas, it.t * S, 0, S, S, -S / 2, -S / 2, S, S); fctx.setTransform(1, 0, 0, 1, 0, 0); } },
      'single atlas canvas, NOT rotated': (list) => { for (const it of list) fctx.drawImage(atlas, it.t * S, 0, S, S, it.x - S / 2, it.y - S / 2, S, S); },
      'ImageBitmaps (separate), rotated': (list) => { for (const it of list) { const c = Math.cos(it.a), s = Math.sin(it.a); fctx.setTransform(c, s, -s, c, it.x, it.y); fctx.drawImage(bitmaps[it.t], -S / 2, -S / 2, S, S); fctx.setTransform(1, 0, 0, 1, 0, 0); } },
      'CPU-backed sprite canvases, rotated': (list) => { for (const it of list) { const c = Math.cos(it.a), s = Math.sin(it.a); fctx.setTransform(c, s, -s, c, it.x, it.y); fctx.drawImage(swSprites[it.t], -S / 2, -S / 2, S, S); fctx.setTransform(1, 0, 0, 1, 0, 0); } },
      'separate canvases, rotated, SORTED by type': (list) => { for (const it of sorted) { const c = Math.cos(it.a), s = Math.sin(it.a); fctx.setTransform(c, s, -s, c, it.x, it.y); fctx.drawImage(sprites[it.t], -S / 2, -S / 2, S, S); fctx.setTransform(1, 0, 0, 1, 0, 0); } },
    };
    const results = {};
    for (const [name, fn] of Object.entries(strategies)) {
      const rec = [], flush = [];
      for (let f = 0; f < 90; f++) {
        // jitter positions a bit so nothing is cached between frames
        for (const it of items) { it.x += (r() - .5) * 2; it.a += 0.02; }
        fctx.clearRect(0, 0, W, H);
        const t0 = performance.now(); fn(items); const t1 = performance.now();
        mctx.drawImage(fg, 0, 0); const t2 = performance.now(); // first consumer of fg => playback of everything drawn into it
        rec.push(t1 - t0); flush.push(t2 - t1);
        if (f % 10 === 9) mctx.getImageData(0, 0, 1, 1); // occasionally wait for the GPU so queue depth stays honest
        await new Promise((res) => requestAnimationFrame(res));
      }
      const avg = (a) => a.slice(20).reduce((x, y) => x + y, 0) / (a.length - 20);
      results[name] = { record_ms: +avg(rec).toFixed(2), flush_ms: +avg(flush).toFixed(2) };
    }
    return results;
  });
  console.log('1000 sprites/frame onto a 1600x950 GPU canvas; record = JS draw calls, flush = first drawImage(fg->main), where playback happens');
  for (const [k, v] of Object.entries(out)) console.log(k.padEnd(46), `record ${String(v.record_ms).padStart(5)}ms   flush ${String(v.flush_ms).padStart(5)}ms   total ${(v.record_ms + v.flush_ms).toFixed(2)}ms`);
  await browser.close();
})();
