// TextSprites.js — canvas text drawn from a cached sprite instead of fillText.
//
// Per direct request (frame rate): drawing colour-emoji text (the ⚡ ⏳ ✨ 🔬 in the building status
// badges, power-plant popups and tier badges) with ctx.fillText re-rasterises the emoji glyph on the CPU every
// single draw and stalls the whole canvas flush — about a dozen of them on screen cost ~7ms a frame in a busy
// tank, more than every other draw call in the frame put together (plain ASCII text is cheap and stays on
// fillText). Each distinct (text, font, colour, alignment) is rasterised once, at 2x, into a small sprite and
// then blitted with one drawImage.
//
// Reads the context's CURRENT font, fillStyle (must be a plain colour string, otherwise it just falls back to
// fillText), textAlign and textBaseline, so a call site only has to swap `ctx.fillText(...)` for
// `drawCachedText(ctx, ...)`; globalAlpha and any transform apply to the sprite exactly as they did to the text.

const SPRITE_SCALE = 2;
const SPRITE_PAD = 2;
const SPRITE_CACHE_MAX = 600; // pickup popups carry numbers, so the set of distinct strings is open-ended; start over past this
const sprites = new Map();
let measureCtx = null;

function bakeTextSprite(text, font, color, align, baseline) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = font;
  measureCtx.textAlign = align;
  measureCtx.textBaseline = baseline;
  const m = measureCtx.measureText(text);
  const left = Math.ceil(m.actualBoundingBoxLeft) + SPRITE_PAD; // distance from the anchor point to the sprite's left edge
  const ascent = Math.ceil(m.actualBoundingBoxAscent) + SPRITE_PAD;
  const w = left + Math.ceil(m.actualBoundingBoxRight) + SPRITE_PAD;
  const h = ascent + Math.ceil(m.actualBoundingBoxDescent) + SPRITE_PAD;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w * SPRITE_SCALE);
  canvas.height = Math.max(1, h * SPRITE_SCALE);
  const c = canvas.getContext('2d');
  c.scale(SPRITE_SCALE, SPRITE_SCALE);
  c.font = font;
  c.textAlign = align;
  c.textBaseline = baseline;
  c.fillStyle = color;
  c.fillText(text, left, ascent);
  return { canvas, dx: -left, dy: -ascent, w, h };
}

export function drawCachedText(ctx, text, x, y) {
  const color = ctx.fillStyle;
  if (typeof color !== 'string') { ctx.fillText(text, x, y); return; } // a gradient/pattern fill can't be baked by colour
  const font = ctx.font;
  const align = ctx.textAlign;
  const baseline = ctx.textBaseline;
  const key = font + '|' + color + '|' + align + '|' + baseline + '|' + text;
  let sprite = sprites.get(key);
  if (!sprite) {
    if (sprites.size >= SPRITE_CACHE_MAX) sprites.clear();
    sprite = bakeTextSprite(text, font, color, align, baseline);
    sprites.set(key, sprite);
  }
  ctx.drawImage(sprite.canvas, x + sprite.dx, y + sprite.dy, sprite.w, sprite.h);
}
