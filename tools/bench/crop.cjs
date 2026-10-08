// node tools/bench/crop.cjs <setA> <setB> <view> [x y w h] [zoom]  -> writes visual/crop_<view>.png: A | B | amplified diff, zoomed. Without a region it picks the 160x120 window with the biggest difference.
const { chromium } = require('./pw.cjs');
const fs = require('fs'); const path = require('path');
(async () => {
  const [a, b, view, X, Y, W, H, Z] = process.argv.slice(2);
  const A = fs.readFileSync(path.join(__dirname, 'visual', a, view + '.png')).toString('base64');
  const B = fs.readFileSync(path.join(__dirname, 'visual', b, view + '.png')).toString('base64');
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage(); await page.goto('about:blank');
  const out = await page.evaluate(async ({ A, B, X, Y, W, H, Z }) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = await Promise.all([load(A), load(B)]); const w = ia.width, h = ia.height;
    const get = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
    const da = get(ia), db = get(ib);
    let cx = +X, cy = +Y; const cw = +W || 160, ch = +H || 120, zoom = +Z || 4;
    if (!X) { let best = -1; for (let y = 0; y + ch <= h; y += 20) for (let x = 0; x + cw <= w; x += 20) { let s = 0; for (let yy = y; yy < y + ch; yy += 2) for (let xx = x; xx < x + cw; xx += 2) { const p = (yy * w + xx) * 4; s += Math.abs(da[p] - db[p]) + Math.abs(da[p + 1] - db[p + 1]) + Math.abs(da[p + 2] - db[p + 2]); } if (s > best) { best = s; cx = x; cy = y; } } }
    const out = document.createElement('canvas'); out.width = cw * zoom * 3 + 8; out.height = ch * zoom; const g = out.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(ia, cx, cy, cw, ch, 0, 0, cw * zoom, ch * zoom); g.drawImage(ib, cx, cy, cw, ch, cw * zoom + 4, 0, cw * zoom, ch * zoom);
    const dd = document.createElement('canvas'); dd.width = cw; dd.height = ch; const dg = dd.getContext('2d'); const id = dg.createImageData(cw, ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const p = ((cy + y) * w + cx + x) * 4, q = (y * cw + x) * 4; const m = Math.max(Math.abs(da[p] - db[p]), Math.abs(da[p + 1] - db[p + 1]), Math.abs(da[p + 2] - db[p + 2])); id.data[q] = id.data[q + 1] = id.data[q + 2] = Math.min(255, m * 6); id.data[q + 3] = 255; }
    dg.putImageData(id, 0, 0); g.drawImage(dd, 0, 0, cw, ch, (cw * zoom + 4) * 2, 0, cw * zoom, ch * zoom);
    return { url: out.toDataURL('image/png'), cx, cy };
  }, { A, B, X, Y, W, H, Z });
  fs.writeFileSync(path.join(__dirname, 'visual', `crop_${view}.png`), Buffer.from(out.url.split(',')[1], 'base64'));
  console.log('crop at', out.cx, out.cy, '-> tools/bench/visual/crop_' + view + '.png');
  await browser.close();
})();
