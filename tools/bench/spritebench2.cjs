// GPU-bound version: N sprites per frame (default 4000) so GPU cost shows in the frame interval; also reports GPU busy via trace.
const { chromium } = require('./pw.cjs');
const N = parseInt(process.env.N || '4000', 10);
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 950 } })).newPage();
  await page.goto('about:blank');
  await page.evaluate(({ N }) => {
    const W = 1600, H = 950, TYPES = 6, S = 28;
    const main = document.createElement('canvas'); main.width = W; main.height = H; document.body.appendChild(main);
    const fg = document.createElement('canvas'); fg.width = W; fg.height = H;
    const mctx = main.getContext('2d'), fctx = fg.getContext('2d');
    const makeSprite = (t) => { const c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d'); const gr = g.createRadialGradient(S * .4, S * .4, 2, S / 2, S / 2, S / 2); gr.addColorStop(0, `hsl(${t * 55},80%,75%)`); gr.addColorStop(1, `hsl(${t * 55},70%,35%)`); g.fillStyle = gr; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 1, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.stroke(); return c; };
    const sprites = Array.from({ length: TYPES }, (_, t) => makeSprite(t));
    const atlas = document.createElement('canvas'); atlas.width = S * TYPES; atlas.height = S; const actx = atlas.getContext('2d'); sprites.forEach((s, i) => actx.drawImage(s, i * S, 0));
    let seed = 1; const r = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const items = Array.from({ length: N }, () => ({ t: Math.floor(r() * TYPES), x: 40 + r() * (W - 80), y: 40 + r() * (H - 80), a: r() * 6.28 }));
    const sorted = [...items].sort((p, q) => p.t - q.t);
    const rot = (it, img, sx) => { const c = Math.cos(it.a), s = Math.sin(it.a); fctx.setTransform(c, s, -s, c, it.x, it.y); if (sx === undefined) fctx.drawImage(img, -S / 2, -S / 2, S, S); else fctx.drawImage(img, sx, 0, S, S, -S / 2, -S / 2, S, S); fctx.setTransform(1, 0, 0, 1, 0, 0); };
    window.__strategies = {
      'current: separate canvases, rotated': () => { for (const it of items) rot(it, sprites[it.t]); },
      'atlas, rotated': () => { for (const it of items) rot(it, atlas, it.t * S); },
      'separate canvases, NOT rotated': () => { for (const it of items) fctx.drawImage(sprites[it.t], it.x - S / 2, it.y - S / 2, S, S); },
      'atlas, NOT rotated': () => { for (const it of items) fctx.drawImage(atlas, it.t * S, 0, S, S, it.x - S / 2, it.y - S / 2, S, S); },
      'separate, rotated, 2 draws/item (body+glint)': () => { for (const it of items) { rot(it, sprites[it.t]); fctx.drawImage(sprites[(it.t + 1) % TYPES], it.x - S / 2, it.y - S / 2, S, S); } },
      'atlas, rotated, 2 draws/item (body+glint)': () => { for (const it of items) { rot(it, atlas, it.t * S); fctx.drawImage(atlas, ((it.t + 1) % TYPES) * S, 0, S, S, it.x - S / 2, it.y - S / 2, S, S); } },
    };
    window.__run = (name, frames) => new Promise((res) => {
      const fn = window.__strategies[name]; const ts = []; let f = 0, last = performance.now();
      (function step(now) { for (const it of items) { it.x += (r() - .5) * 2; it.a += 0.02; } fctx.clearRect(0, 0, W, H); fn(); mctx.drawImage(fg, 0, 0); ts.push(now - last); last = now; if (++f < frames) requestAnimationFrame(step); else res(ts.slice(10)); })(last);
      requestAnimationFrame((n) => { last = n; });
    });
  }, { N });
  const names = await page.evaluate(() => Object.keys(window.__strategies));
  console.log(`${N} sprites per frame; frame interval (100Hz display => 10ms floor) and GPU busy ms/frame`);
  for (const name of names) {
    await browser.startTracing(page, { categories: ['-*', 'gpu', 'viz', 'toplevel', 'cc', 'benchmark', 'devtools.timeline'] });
    const ts = await page.evaluate((n) => window.__run(n, 100), name);
    const ev = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
    const thr = {}; for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') thr[e.pid + ':' + e.tid] = e.args.name;
    let gpu = 0; for (const e of ev) if (e.ph === 'X' && e.dur && thr[e.pid + ':' + e.tid] === 'CrGpuMain' && e.name === 'GPUTask') gpu += e.dur / 1000;
    const avg = ts.reduce((a, b) => a + b, 0) / ts.length;
    console.log(name.padEnd(48), `frame ${avg.toFixed(1).padStart(5)}ms   GPU busy ${(gpu / (ts.length + 10)).toFixed(1).padStart(5)}ms/frame`);
  }
  await browser.close();
})();
