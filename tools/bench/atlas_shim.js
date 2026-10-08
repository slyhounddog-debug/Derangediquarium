// Runtime experiment only: redirect drawImage of small (sprite-sized) canvases to a shared atlas copy of them.
(function () {
  const AW = 4096, AH = 2048, GUT = 2;
  const atlas = document.createElement('canvas'); atlas.width = AW; atlas.height = AH;
  const actx = atlas.getContext('2d');
  const map = new WeakMap(); let cx = 0, cy = 0, rowH = 0, full = false;
  const orig = CanvasRenderingContext2D.prototype.drawImage;
  window.__atlasStats = { redirected: 0, passthrough: 0, sprites: 0 };
  CanvasRenderingContext2D.prototype.drawImage = function (src, ...a) {
    if (!(src instanceof HTMLCanvasElement) || src.width > 160 || src.height > 160 || src === atlas || full) { window.__atlasStats.passthrough++; return orig.call(this, src, ...a); }
    let r = map.get(src);
    if (!r) {
      const w = src.width, h = src.height;
      if (cx + w + GUT > AW) { cx = 0; cy += rowH + GUT; rowH = 0; }
      if (cy + h + GUT > AH) { full = true; return orig.call(this, src, ...a); }
      orig.call(actx, src, cx, cy); r = { x: cx, y: cy, w, h }; map.set(src, r); cx += w + GUT; rowH = Math.max(rowH, h); window.__atlasStats.sprites++;
    }
    window.__atlasStats.redirected++;
    if (a.length === 2) return orig.call(this, atlas, r.x, r.y, r.w, r.h, a[0], a[1], r.w, r.h);
    if (a.length === 4) return orig.call(this, atlas, r.x, r.y, r.w, r.h, a[0], a[1], a[2], a[3]);
    // 8-arg form: (sx, sy, sw, sh, dx, dy, dw, dh) relative to the sprite
    return orig.call(this, atlas, r.x + a[0], r.y + a[1], a[2], a[3], a[4], a[5], a[6], a[7]);
  };
})();
