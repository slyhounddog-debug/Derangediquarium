// Procedural art for the seabed ("city") backdrop: wavy alternating layers of
// sand and dirt with slight colour drift, sprinkled with one-off generated
// pebbles, rocks, boulders, cracks, shells, fossils, bones and roots.
//
// Baked ONCE to an offscreen canvas (see bakeSeabedCanvas); Grid.js's
// renderSeabedGrid just blits it each frame. Every object is generated fresh
// from random parameters rather than stamped from a shared sprite, and
// placement is a jittered grid with random skips, so the result is evenly
// spread without looking tiled.

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const hsl = (h, s, l, a = 1) => `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${a})`;

// Rock colour families: gray / tan / brown / dark brown.
function rockColor() {
  const family = Math.random();
  if (family < 0.27) return { h: rand(28, 45), s: rand(3, 12), l: rand(32, 58) }; // gray
  if (family < 0.55) return { h: rand(32, 42), s: rand(22, 40), l: rand(46, 64) }; // tan
  if (family < 0.82) return { h: rand(22, 30), s: rand(28, 44), l: rand(28, 42) }; // brown
  return { h: rand(18, 26), s: rand(30, 45), l: rand(12, 22) }; // dark brown
}
const shade = (c, dl, a = 1) => hsl(c.h, c.s, Math.max(3, Math.min(85, c.l + dl)), a);

// Irregular closed blob, smoothed through edge midpoints.
function blobPath(ctx, rx, ry, pts, jitter) {
  const p = [];
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const k = 1 + (Math.random() - 0.5) * 2 * jitter;
    p.push({ x: Math.cos(a) * rx * k, y: Math.sin(a) * ry * k });
  }
  ctx.beginPath();
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = mid(p[pts - 1], p[0]);
  ctx.moveTo(start.x, start.y);
  for (let i = 0; i < pts; i++) {
    const m = mid(p[i], p[(i + 1) % pts]);
    ctx.quadraticCurveTo(p[i].x, p[i].y, m.x, m.y);
  }
  ctx.closePath();
}

function polyPath(ctx, rx, ry, pts, jitter) {
  const p = [];
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2 + rand(-0.25, 0.25);
    const k = 1 + (Math.random() - 0.5) * 2 * jitter;
    p.push({ x: Math.cos(a) * rx * k, y: Math.sin(a) * ry * k });
  }
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < pts; i++) ctx.lineTo(p[i].x, p[i].y);
  ctx.closePath();
  return p;
}

function drawPebble(ctx) {
  const c = rockColor();
  const rx = rand(2.5, 8), ry = rx * rand(0.55, 0.95);
  blobPath(ctx, rx, ry, 7, 0.14);
  ctx.fillStyle = shade(c, 0);
  ctx.fill();
  ctx.strokeStyle = shade(c, -14, 0.8);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = shade(c, 16, 0.55);
  ctx.beginPath();
  ctx.ellipse(-rx * 0.25, -ry * 0.3, rx * 0.4, ry * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlatStone(ctx) {
  const c = rockColor();
  const rx = rand(8, 20), ry = rx * rand(0.22, 0.4);
  blobPath(ctx, rx, ry, 8, 0.12);
  ctx.fillStyle = shade(c, 0);
  ctx.fill();
  ctx.strokeStyle = shade(c, -16, 0.8);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = shade(c, 14, 0.4);
  ctx.beginPath();
  ctx.ellipse(0, -ry * 0.35, rx * 0.7, ry * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawAngularRock(ctx) {
  const c = rockColor();
  const rx = rand(7, 20), ry = rx * rand(0.6, 1);
  const p = polyPath(ctx, rx, ry, 5 + Math.floor(Math.random() * 4), 0.25);
  ctx.fillStyle = shade(c, 0);
  ctx.fill();
  // Facets: triangles from a off-centre point to alternating edges.
  const cx = rand(-rx * 0.2, rx * 0.2), cy = rand(-ry * 0.2, ry * 0.2);
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    ctx.fillStyle = i % 2 ? shade(c, 13, 0.45) : shade(c, -13, 0.45);
    ctx.beginPath();
    ctx.moveTo(cx, cy); ctx.lineTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
  ctx.closePath();
  ctx.strokeStyle = shade(c, -20, 0.85);
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function drawCrackLine(ctx, len, depth) {
  let x = 0, y = 0, ang = rand(0, Math.PI * 2);
  const pts = [{ x, y }];
  const steps = Math.max(3, Math.floor(len / 7));
  for (let i = 0; i < steps; i++) {
    ang += rand(-0.6, 0.6);
    x += Math.cos(ang) * (len / steps);
    y += Math.sin(ang) * (len / steps);
    pts.push({ x, y });
    if (depth < 2 && Math.random() < 0.18) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang + rand(-0.9, 0.9));
      drawCrackLine(ctx, len * rand(0.25, 0.5), depth + 1);
      ctx.restore();
    }
  }
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x + 1, pts[0].y + 1);
  for (const q of pts) ctx.lineTo(q.x + 1, q.y + 1);
  ctx.strokeStyle = 'rgba(255, 230, 190, 0.1)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const q of pts) ctx.lineTo(q.x, q.y);
  ctx.strokeStyle = `rgba(10, 6, 2, ${rand(0.3, 0.5)})`;
  ctx.lineWidth = rand(0.8, 1.8);
  ctx.stroke();
}
function drawCrack(ctx) { drawCrackLine(ctx, rand(30, 110), 0); }

function drawBoulder(ctx) {
  const c = rockColor();
  const rx = rand(22, 46), ry = rx * rand(0.6, 0.85);
  // Contact shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.ellipse(3, ry * 0.25, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();
  blobPath(ctx, rx, ry, 9, 0.12);
  const g = ctx.createRadialGradient(-rx * 0.3, -ry * 0.4, rx * 0.1, 0, 0, rx * 1.1);
  g.addColorStop(0, shade(c, 12));
  g.addColorStop(1, shade(c, -14));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Mineral flecks and an internal crack.
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? shade(c, 20, 0.35) : shade(c, -22, 0.4);
    ctx.beginPath();
    ctx.arc(rand(-rx, rx), rand(-ry, ry), rand(0.6, 2.4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.translate(rand(-rx * 0.4, rx * 0.4), rand(-ry * 0.3, ry * 0.3));
  drawCrackLine(ctx, rx * rand(0.8, 1.4), 1);
  ctx.restore();
  blobPath(ctx, rx, ry, 9, 0.12);
  ctx.strokeStyle = shade(c, -24, 0.7);
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

function drawShell(ctx) {
  const r = rand(5, 11);
  ctx.fillStyle = hsl(rand(32, 42), rand(25, 40), rand(58, 72), 0.9);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.5);
  ctx.arc(0, r * 0.5, r, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(70, 50, 30, 0.5)';
  ctx.lineWidth = 0.9;
  const ribs = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i <= ribs; i++) {
    const a = Math.PI + (i / ribs) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.5);
    ctx.lineTo(Math.cos(a) * r, r * 0.5 + Math.sin(a) * r);
    ctx.stroke();
  }
}

function drawAmmonite(ctx) {
  const c = { h: rand(30, 40), s: rand(8, 22), l: rand(40, 58) };
  const turns = rand(1.6, 2.4), maxR = rand(8, 16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let t = 0; t <= turns * Math.PI * 2; t += 0.15) {
    const r = (t / (turns * Math.PI * 2)) * maxR + 0.5;
    const x = Math.cos(t) * r, y = Math.sin(t) * r;
    if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = shade(c, 0);
  ctx.lineWidth = rand(3, 4.5);
  ctx.stroke();
  ctx.strokeStyle = shade(c, -24, 0.7);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawBone(ctx) {
  const len = rand(12, 26);
  ctx.strokeStyle = hsl(rand(35, 45), rand(18, 30), rand(62, 76), 0.85);
  ctx.lineCap = 'round';
  ctx.lineWidth = rand(2, 3.2);
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0);
  ctx.stroke();
  ctx.lineWidth = rand(3.4, 4.6);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * len / 2, -1.6); ctx.lineTo(s * len / 2, 1.6);
    ctx.stroke();
  }
}

function drawRoot(ctx) {
  const len = rand(30, 80);
  let x = 0, y = 0, ang = rand(-0.5, 0.5) + (Math.random() < 0.5 ? 0 : Math.PI);
  ctx.lineCap = 'round';
  const steps = 8;
  const col = hsl(rand(20, 30), rand(30, 45), rand(16, 28), 0.85);
  for (let i = 0; i < steps; i++) {
    const nx = x + Math.cos(ang) * (len / steps), ny = y + Math.sin(ang) * (len / steps);
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(0.6, 3.2 * (1 - i / steps));
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
    x = nx; y = ny; ang += rand(-0.5, 0.5);
  }
}

function drawLens(ctx) {
  const rx = rand(25, 70), ry = rand(2.5, 6);
  blobPath(ctx, rx, ry, 8, 0.25);
  ctx.fillStyle = Math.random() < 0.5 ? hsl(rand(32, 42), rand(25, 40), rand(55, 68), rand(0.06, 0.14)) : hsl(rand(20, 28), rand(30, 45), rand(10, 20), rand(0.1, 0.2));
  ctx.fill();
}

function drawGravel(ctx) {
  const n = 6 + Math.floor(Math.random() * 9);
  const spread = rand(14, 30);
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(rand(-spread, spread), rand(-spread * 0.5, spread * 0.5));
    ctx.scale(rand(0.35, 0.7), rand(0.35, 0.7));
    ctx.rotate(rand(0, Math.PI * 2));
    drawPebble(ctx);
    ctx.restore();
  }
}

// [drawer, weight]
const OBJECTS = [
  [drawPebble, 22], [drawFlatStone, 10], [drawAngularRock, 14], [drawBoulder, 4],
  [drawCrack, 9], [drawShell, 3], [drawAmmonite, 1.5], [drawBone, 1.5],
  [drawRoot, 4], [drawLens, 8], [drawGravel, 9],
];
const OBJECT_WEIGHT_TOTAL = OBJECTS.reduce((s, o) => s + o[1], 0);
function pickObject() {
  let r = Math.random() * OBJECT_WEIGHT_TOTAL;
  for (const [fn, w] of OBJECTS) { if ((r -= w) <= 0) return fn; }
  return drawPebble;
}

// Alternating sand / dirt layers, each with its own colour drift. Returns
// nothing; paints onto ctx in unscaled world pixels (caller sets the scale).
function drawLayers(ctx, w, h) {
  const SAND = () => ({ h: rand(33, 41), s: rand(28, 42), l: rand(34, 44) });
  const DIRT = () => ({ h: rand(22, 30), s: rand(28, 42), l: rand(17, 26) });
  // Background fill first so wave gaps never show through.
  ctx.fillStyle = hsl(28, 35, 25);
  ctx.fillRect(0, 0, w, h);
  let y = 0, isSand = true;
  const layers = [];
  while (y < h) {
    const thick = rand(48, 100);
    layers.push({ top: y, bottom: y + thick, sand: isSand });
    y += thick; isSand = !isSand;
  }
  for (const L of layers) {
    const c = L.sand ? SAND() : DIRT();
    const c2 = L.sand ? SAND() : DIRT();
    const a1 = rand(5, 12), f1 = rand(0.003, 0.006), p1 = rand(0, 6.28);
    const a2 = rand(2, 6), f2 = rand(0.011, 0.02), p2 = rand(0, 6.28);
    const wave = (x) => Math.sin(x * f1 + p1) * a1 + Math.sin(x * f2 + p2) * a2;
    const g = ctx.createLinearGradient(0, L.top, 0, L.bottom);
    g.addColorStop(0, hsl(c.h, c.s, c.l));
    g.addColorStop(1, hsl(c2.h, c2.s, c2.l));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, L.top + (L.top === 0 ? 0 : wave(0)));
    for (let x = 0; x <= w; x += 16) ctx.lineTo(x, L.top + (L.top === 0 ? 0 : wave(x)));
    ctx.lineTo(w, L.bottom + 30); ctx.lineTo(0, L.bottom + 30);
    ctx.closePath();
    ctx.fill();
    // Colour drift inside the layer: big soft blotches of nearby hues.
    const blotches = Math.floor(w / 40);
    for (let i = 0; i < blotches; i++) {
      const bc = L.sand ? SAND() : DIRT();
      ctx.fillStyle = hsl(bc.h, bc.s, bc.l + rand(-5, 6), rand(0.12, 0.3));
      ctx.beginPath();
      ctx.ellipse(rand(0, w), rand(L.top, L.bottom), rand(25, 90), rand(6, 22), rand(-0.2, 0.2), 0, Math.PI * 2);
      ctx.fill();
    }
    // Faint highlight along the top edge of sand layers / shadow on dirt.
    ctx.strokeStyle = L.sand ? 'rgba(255, 230, 180, 0.10)' : 'rgba(0, 0, 0, 0.14)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 16) {
      const yy = L.top + (L.top === 0 ? 0 : wave(x)) + 1;
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Fine grain.
  const grains = Math.floor(w * h / 45);
  for (let i = 0; i < grains; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 235, 195, 0.11)';
    const s = rand(0.6, 1.8);
    ctx.fillRect(rand(0, w), rand(0, h), s, s);
  }
}

// Bakes the seabed at `scale` x resolution. Returns the canvas; one canvas
// pixel = 1/scale world px.
export function bakeSeabedCanvas(worldW, worldH, scale = 2) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(worldW * scale);
  canvas.height = Math.ceil(worldH * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  drawLayers(ctx, worldW, worldH);

  // Semi-uniform scatter: jittered grid, ~35% of cells skipped, some cells
  // get two objects.
  const CELL = 44;
  const items = [];
  for (let cy = 0; cy < worldH; cy += CELL) {
    for (let cx = 0; cx < worldW; cx += CELL) {
      if (Math.random() < 0.35) continue;
      const n = Math.random() < 0.2 ? 2 : 1;
      for (let i = 0; i < n; i++) items.push({ x: cx + rand(0, CELL), y: cy + rand(0, CELL), fn: pickObject() });
    }
  }
  // Paint small/flat first, boulders later by y order so lower objects overlap upper ones.
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    ctx.save();
    ctx.translate(it.x, it.y);
    const flip = Math.random() < 0.5 ? -1 : 1;
    const big = it.fn === drawBoulder;
    ctx.rotate(big ? rand(-0.15, 0.15) : rand(-0.8, 0.8));
    const s = rand(0.8, 1.25);
    ctx.scale(flip * s, s);
    it.fn(ctx);
    ctx.restore();
  }

  // Overall darkening with depth so the lower city reads deeper.
  const depth = ctx.createLinearGradient(0, 0, 0, worldH);
  depth.addColorStop(0, 'rgba(0, 0, 0, 0)');
  depth.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
  ctx.fillStyle = depth;
  ctx.fillRect(0, 0, worldW, worldH);
  return canvas;
}
