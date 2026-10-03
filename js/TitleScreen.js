// TitleScreen.js — the start screen's animated "FINSANITY" logo, orbiting
// fish, ambient bubbles and draggable loose coins/waste, per direct request
// to completely rework the title/start screen. Pure decoration: nothing here
// reads or writes state.meta/state.level, and nothing touches physics — the
// loose coins/waste are title-only visuals with their own tiny integrator, not
// real items (they can be dragged, never collected, and vanish on Start).
//
// Cheapness is the whole design (per direct request): the two words are baked
// ONCE into offscreen sprites (outline, extrusion, gradient fill and gloss are
// all pre-composited), so a frame is just a handful of drawImage calls plus
// six fish. The tank behind is a single half-resolution snapshot of the real
// game canvas that CSS stretches back up — bilinear upscaling IS the "very
// slight blur", with no per-frame blur filter at all (see captureTitleBackdrop)
// — and main.js skips rendering the world entirely while this screen is up
// (see titleBlocksWorldRender).
//
// Forbidden: no game-state reads; main.js/UI.js wire this in via the exports
// at the bottom, same one-directional import discipline as FishRenderer.js.

import { drawFish } from './FishRenderer.js';
import { SPECIES, COIN_TIERS, COIN_RADIUS, WASTE_COLOR } from './Config.js';

const FONT_STACK = "'Fredoka', 'Baloo 2', 'Segoe UI', system-ui, sans-serif";
const glyphFont = (px) => `700 ${px}px ${FONT_STACK}`;

// ---- Look ----
const FIN_FILL = [[0, '#8fe6ff'], [0.4, '#42C5F4'], [1, '#0077B6']];
const SANITY_FILL = [[0, '#FFB08A'], [0.45, '#FF7448'], [1, '#FF4500']];
const OUTLINE_DARK = '#1B263B';
const OUTLINE_DEEP = '#0e1624';
const WHITE_BORDER_RATIO = 0.028; // thin white inner stroke, relative to font size
const DARK_BORDER_RATIO = 0.065; // heavy dark outer border
const EXTRUDE_RATIO = 0.06; // how far the dark border is stacked downward for a chunky 3D lip

// The "A" is built from round-capped strokes instead of the font's glyph (see
// aPath), purely so its counter can be sized to hold a crab — the font's own
// counter is far too small once the thick borders eat into it. Units are
// fractions of the font size.
const A_ADV = 0.94;
const A_THICK = 0.16;
const A_BAR_Y = 0.16; // crossbar centerline height above the baseline

// Per-letter wave/tilt/size (fractions of font size / degrees). FIN climbs
// upward to the right; SANITY is bigger, bobs up and down and "bursts" out
// larger toward its middle — per direct request for expressive distortion.
const WORDS = {
  fin: {
    text: 'FIN', sizeRatio: 0.74, fill: FIN_FILL, track: 0.0,
    letters: [{ rot: -9, dy: 0.02, sc: 1.0 }, { rot: -6, dy: -0.07, sc: 0.98 }, { rot: -3, dy: -0.15, sc: 1.04 }],
  },
  sanity: {
    text: 'SANITY', sizeRatio: 1, fill: SANITY_FILL, track: 0.03,
    letters: [
      { rot: -4, dy: 0.04, sc: 1.06, fin: true }, { rot: 3, dy: -0.04, sc: 1.12 }, { rot: -3, dy: 0.04, sc: 1.1 },
      { rot: 4, dy: -0.04, sc: 1.14 }, { rot: -4, dy: 0.04, sc: 1.08 }, { rot: 5, dy: -0.03, sc: 1.12 },
    ],
  },
};

// ---- Timeline (seconds since the title appeared) ----
const FIN_IN_START_S = 0.15;
const FIN_IN_DUR_S = 1.0;
const SLAM_START_S = 1.05;
const SLAM_DUR_S = 0.38;
const IMPACT_S = SLAM_START_S + SLAM_DUR_S;
const FISH_SPAWN_START_S = IMPACT_S + 0.3;
const FISH_SPAWN_WINDOW_S = 5; // per direct request — all fish spawn over 5s so their orbits don't line up
const FISH_ORBIT_GROW_S = 1.6; // an orbit widens from nothing, so a new fish emerges from behind the letters
const BOB_OMEGA = 1.5;
const BOB_AMP_PX = 6;

const EXIT_SANITY_DUR_S = 0.85;
const EXIT_FIN_DELAY_S = 0.35; // FIN starts rising before SANITY has left the screen, but slower
const EXIT_FIN_DUR_S = 1.35;
const EXIT_DONE_S = 1.85;
const EXIT_SANITY_BUBBLES_PER_S = 120;
const EXIT_FIN_BUBBLES_PER_S = 30; // fewer than SANITY's, per direct request

// ---- Fish / loose items ----
const FISH_LINEUP = ['guppy', 'guppy', 'dartfin', 'dartfin', 'blimpfish', 'blimpfish'];
const FISH_DRAW_SCALE = 1.5;
const FISH_ORBIT_SCALE = 0.9; // orbits 10% smaller than the first pass, per direct request
const FISH_ORBIT_SPEED_SCALE = 0.9; // and 10% slower around the loop
// Horizontal position blends a cosine with a triangle wave. A plain cosine
// crawls through the far ends of the ellipse; the triangle wave never slows
// down, so mixing it in keeps fish from lingering at the edges (per direct
// request) while still easing the turn-around.
const ORBIT_COS_WEIGHT = 0.45;
const orbitX = (th) => ORBIT_COS_WEIGHT * Math.cos(th) + (1 - ORBIT_COS_WEIGHT) * (2 / Math.PI) * Math.asin(Math.cos(th));
const orbitVx = (th) => -ORBIT_COS_WEIGHT * Math.sin(th) - (1 - ORBIT_COS_WEIGHT) * (2 / Math.PI) * Math.sign(Math.sin(th));
const COIN_INTERVAL_S = [5, 10];
const WASTE_INTERVAL_S = [10, 15];
const ITEM_MAX = 30;
const ITEM_FADE_AFTER_S = 30;
const ITEM_FADE_S = 1.5;
const ITEM_RADIUS = 11;
const ITEM_SPRITE_SCALE = 2;
const ITEM_GRAVITY = 75;
const ITEM_DRAG = 1.3; // per-second velocity decay — terminal sink speed is gravity/drag, ~58 px/s
const ITEM_THROW_MAX = 900;
const ITEM_GRAB_RADIUS_MULT = 1.7;

const BUBBLE_MAX = 480;
const AMBIENT_BUBBLES_PER_S = 9;
const SLAM_BUBBLE_COUNT = 280; // was 26, then 130 — and now drawn in front of the words, per direct request
const FISH_BUBBLE_INTERVAL_S = [1, 2]; // per direct request — every fish blows a bubble every 1-2s
const FALL_BUBBLES_PER_S = 700; // SANITY sheds bubbles the whole way down, per direct request
const BACKDROP_SCALE = 0.5;

// ---- Module state ----
const ts = {
  ready: false,
  active: false,
  paused: false,
  exiting: false,
  t: 0,
  exitT: 0,
  lastNow: 0,
  w: 0,
  h: 0,
  backdropReady: false,
  backdropDirty: true,
  resizeTimer: null,
  onExitDone: null,
  fin: null,
  sanity: null,
  layout: null,
  fish: [],
  items: [],
  bubbles: [],
  bubbleAcc: 0,
  trailAccSanity: 0,
  trailAccFin: 0,
  slamFired: false,
  fallAcc: 0,
  nextItemId: 1,
  drag: null,
  hoverItem: false,
  dt: 0,
};

let overlayEl = null;
let canvasEl = null;
let ctx = null;
let backdropEl = null;
let backdropCtx = null;
let bubbleSprite = null;
const itemSprites = new Map();

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const easeOutCubic = (p) => 1 - (1 - p) ** 3;
const easeInQuad = (p) => p * p;

// ---- Sprite baking ----
function aPath(c, S) {
  const t = A_THICK * S;
  const adv = A_ADV * S;
  const capH = ts.capH;
  const baseL = [t / 2, -t / 2];
  const apex = [adv / 2, -(capH - t / 2)];
  const baseR = [adv - t / 2, -t / 2];
  c.beginPath();
  c.moveTo(baseL[0], baseL[1]);
  c.lineTo(apex[0], apex[1]);
  c.lineTo(baseR[0], baseR[1]);
  // crossbar between the two legs at its own height
  const y = -A_BAR_Y * S;
  const f = (y - apex[1]) / (baseL[1] - apex[1]);
  c.moveTo(apex[0] + (baseL[0] - apex[0]) * f, y);
  c.lineTo(apex[0] + (baseR[0] - apex[0]) * f, y);
}

// A shark-fin sitting on top of the "S" — per direct request, the S's top
// curve becomes a fin. Rooted slightly inside the glyph so the outline passes
// merge it into the letter as one shape. Leading edge on the right (the fish
// swims right), concave trailing edge on the left.
function finPath(c, S) {
  const capH = ts.capH;
  const W = 0.5 * S;
  const H = 0.42 * S;
  const bx = 0.04 * S;
  const by = -capH + 0.12 * S;
  c.beginPath();
  c.moveTo(bx + W, by);
  c.bezierCurveTo(bx + W * 0.92, by - H * 0.4, bx + W * 0.58, by - H * 0.88, bx + W * 0.1, by - H);
  c.quadraticCurveTo(bx + W * 0.4, by - H * 0.42, bx, by);
  c.closePath();
}

function eachLetter(c, word, fn) {
  for (const L of word.letters) {
    c.save();
    c.translate(word.padX + L.x, word.baseY + L.dy);
    c.rotate(L.rot);
    c.scale(L.sc, L.sc);
    c.translate(-L.adv / 2, 0);
    fn(L);
    c.restore();
  }
}

function strokeGlyphs(c, word, width) {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.miterLimit = 2;
  eachLetter(c, word, (L) => {
    c.font = glyphFont(word.S);
    if (L.ch === 'A') {
      aPath(c, word.S);
      c.lineWidth = A_THICK * word.S + width / L.sc;
      c.stroke();
    } else {
      c.lineWidth = width / L.sc;
      c.strokeText(L.ch, 0, 0);
    }
    if (L.fin) {
      finPath(c, word.S);
      c.lineWidth = width / L.sc;
      c.stroke();
    }
  });
}

// Opens the A's counter back up. The uniform outline would otherwise swallow
// nearly all of the small triangular hole, leaving no room for the crab, so the
// outline inside the counter is cut back to a thin ring (still white-then-dark,
// just thinner than everywhere else on the letter).
function carveACounter(c, word, L) {
  const S = word.S;
  const t = A_THICK * S;
  const adv = A_ADV * S;
  const tanA = ((adv - t) / 2) / (word.capH - t);
  const sinA = Math.sin(Math.atan(tanA));
  const apexInner = -(word.capH - t / 2) + t / 2 / sinA;
  const barTop = -A_BAR_Y * S - t / 2;
  const holeH = barTop - apexInner;
  const hw = holeH * tanA;
  const leg = Math.hypot(hw, holeH);
  const inradius = (hw * holeH) / (hw + leg);
  const k = Math.max(0.2, (inradius - word.E * 0.55) / inradius);
  const cx = adv / 2;
  const cy = barTop - inradius;
  const pts = [[cx, apexInner], [cx + hw, barTop], [cx - hw, barTop]].map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
  c.save();
  c.translate(word.padX + L.x, word.baseY + L.dy);
  c.rotate(L.rot);
  c.scale(L.sc, L.sc);
  c.translate(-L.adv / 2, 0);
  c.globalCompositeOperation = 'destination-out';
  c.lineJoin = 'round';
  c.lineWidth = S * 0.035;
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  c.lineTo(pts[1][0], pts[1][1]);
  c.lineTo(pts[2][0], pts[2][1]);
  c.closePath();
  c.fill();
  c.stroke();
  c.restore();
}

function buildWord(def, S) {
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = glyphFont(S);
  ts.capH = meas.measureText('H').actualBoundingBoxAscent || S * 0.7;
  const white = Math.max(2, WHITE_BORDER_RATIO * S);
  const dark = Math.max(3, DARK_BORDER_RATIO * S);
  const E = white + dark;
  const ext = Math.max(3, EXTRUDE_RATIO * S);
  const pad = Math.ceil(E + ext * 1.6 + 0.14 * S);

  const letters = [];
  let x = 0;
  let maxSc = 1;
  let minDy = 0;
  let maxDy = 0;
  let hasFin = false;
  [...def.text].forEach((ch, i) => {
    const spec = def.letters[i];
    const adv = ch === 'A' ? A_ADV * S : meas.measureText(ch).width;
    letters.push({ ch, adv, sc: spec.sc, rot: (spec.rot * Math.PI) / 180, dy: spec.dy * S, x: x + (adv * spec.sc) / 2, fin: !!spec.fin });
    x += adv * spec.sc + def.track * S;
    maxSc = Math.max(maxSc, spec.sc);
    minDy = Math.min(minDy, spec.dy * S);
    maxDy = Math.max(maxDy, spec.dy * S);
    if (spec.fin) hasFin = true;
  });
  const textW = x - def.track * S;
  const topExt = ts.capH * maxSc - minDy + (hasFin ? 0.42 * S : 0);
  const word = {
    S, letters, textW, E, ext, white, dark, padX: pad, baseY: pad + topExt,
    w: Math.ceil(textW + pad * 2), h: Math.ceil(pad * 2 + topExt + maxDy + 0.06 * S),
    capH: ts.capH, fillStops: def.fill, crabs: [],
  };

  const out = document.createElement('canvas');
  out.width = word.w;
  out.height = word.h;
  const c = out.getContext('2d');

  // Fill layer: gradient + gloss, composited as one unit so the shine
  // ('source-atop') can only ever land on painted fill pixels.
  const fillCanvas = document.createElement('canvas');
  fillCanvas.width = word.w;
  fillCanvas.height = word.h;
  const f = fillCanvas.getContext('2d');
  eachLetter(f, word, (L) => {
    const g = f.createLinearGradient(0, -ts.capH, 0, 0.08 * S);
    for (const [stop, color] of def.fill) g.addColorStop(stop, color);
    f.fillStyle = g;
    f.strokeStyle = g;
    f.font = glyphFont(S);
    f.lineJoin = 'round';
    f.lineCap = 'round';
    if (L.ch === 'A') {
      aPath(f, S);
      f.lineWidth = A_THICK * S;
      f.stroke();
    } else {
      f.fillText(L.ch, 0, 0);
    }
    if (L.fin) {
      finPath(f, S);
      f.fill();
    }
  });
  f.globalCompositeOperation = 'source-atop';
  // wet top shine + a soft underside shade across the whole word
  const topY = word.baseY - ts.capH * maxSc + minDy - (hasFin ? 0.1 * S : 0);
  const shine = f.createLinearGradient(0, topY, 0, topY + ts.capH * 0.62);
  shine.addColorStop(0, 'rgba(255,255,255,0.62)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  f.fillStyle = shine;
  f.fillRect(0, 0, word.w, word.h);
  const shade = f.createLinearGradient(0, word.baseY - ts.capH * 0.35, 0, word.baseY + maxDy + 0.05 * S);
  shade.addColorStop(0, 'rgba(0,30,80,0)');
  shade.addColorStop(1, 'rgba(0,30,80,0.22)');
  f.fillStyle = shade;
  f.fillRect(0, 0, word.w, word.h);
  // per-letter glints (little bubble-shaped highlights) and fin rays
  eachLetter(f, word, (L) => {
    f.fillStyle = 'rgba(255,255,255,0.7)';
    f.beginPath();
    f.ellipse(L.adv * 0.28, -ts.capH * 0.8, S * 0.05, S * 0.026, -0.5, 0, Math.PI * 2);
    f.fill();
    f.beginPath();
    f.arc(L.adv * 0.4, -ts.capH * 0.86, S * 0.014, 0, Math.PI * 2);
    f.fill();
    if (L.fin) {
      f.strokeStyle = 'rgba(255,255,255,0.38)';
      f.lineWidth = Math.max(1.5, S * 0.014);
      f.lineCap = 'round';
      for (const k of [0.38, 0.62]) {
        f.beginPath();
        f.moveTo(0.04 * S + 0.5 * S * k + 0.02 * S, -ts.capH + 0.1 * S);
        f.quadraticCurveTo(0.04 * S + 0.5 * S * (k - 0.1), -ts.capH - 0.12 * S, 0.04 * S + 0.5 * S * (k - 0.22), -ts.capH - 0.3 * S);
        f.stroke();
      }
    }
  });

  c.lineJoin = 'round';
  c.save();
  c.translate(0, ext * 1.6);
  c.strokeStyle = 'rgba(0,0,0,0.26)';
  strokeGlyphs(c, word, E * 2);
  c.restore();
  c.strokeStyle = OUTLINE_DEEP;
  for (let d = ext; d >= 1; d -= Math.max(1, ext / 5)) {
    c.save();
    c.translate(0, d);
    strokeGlyphs(c, word, E * 2);
    c.restore();
  }
  c.strokeStyle = OUTLINE_DARK;
  strokeGlyphs(c, word, E * 2);
  c.strokeStyle = '#ffffff';
  strokeGlyphs(c, word, white * 2);
  c.drawImage(fillCanvas, 0, 0);
  const aLetter = letters.find((L) => L.ch === 'A');
  if (aLetter) carveACounter(c, word, aLetter);

  word.canvas = out;
  return word;
}

// Sprite-space position of a point given in a letter's own local space.
function letterPoint(word, L, lx, ly) {
  const x = (lx - L.adv / 2) * L.sc;
  const y = ly * L.sc;
  const cos = Math.cos(L.rot);
  const sin = Math.sin(L.rot);
  return { x: word.padX + L.x + x * cos - y * sin, y: word.baseY + L.dy + x * sin + y * cos };
}

// Finds the A's visible counter in the baked sprite itself (a flood fill over
// the transparent pixels enclosed by the letter) rather than computing it from
// the stroke geometry — the thick borders eat most of the geometric hole, so
// the real visible one is whatever is actually left.
function findEnclosedHole(word, L) {
  const x0 = Math.max(0, Math.floor(word.padX + L.x - L.adv * L.sc * 0.7));
  const x1 = Math.min(word.w, Math.ceil(word.padX + L.x + L.adv * L.sc * 0.7));
  const y0 = Math.max(0, Math.floor(word.baseY + L.dy - word.capH * L.sc * 1.3));
  const y1 = Math.min(word.h, Math.ceil(word.baseY + L.dy + word.S * 0.1));
  const w = x1 - x0;
  const h = y1 - y0;
  const data = word.canvas.getContext('2d').getImageData(x0, y0, w, h).data;
  const seen = new Uint8Array(w * h);
  let best = null;
  const stack = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || data[start * 4 + 3] > 12) continue;
    let count = 0, sx = 0, sy = 0, minX = w, maxX = 0, minY = h, maxY = 0, touchesEdge = false;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      const x = i % w;
      const y = (i / w) | 0;
      count++; sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesEdge = true;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= w * h || seen[j] || data[j * 4 + 3] > 12) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === w - 1)) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    if (!touchesEdge && (!best || count > best.count)) best = { count, cx: x0 + sx / count, cy: y0 + sy / count, minX: x0 + minX, maxX: x0 + maxX, minY: y0 + minY, maxY: y0 + maxY };
  }
  return best;
}

function placeCrabs(word) {
  const S = word.S;
  const aL = word.letters.find((L) => L.ch === 'A');
  const nL = word.letters.find((L) => L.ch === 'N');
  const hole = findEnclosedHole(word, aL);
  if (hole) {
    // Sized to the visible counter and resting on its bottom edge, so it
    // reads as peeking out through the loop; drawn behind the sprite.
    const hw = hole.maxX - hole.minX;
    const hh = hole.maxY - hole.minY;
    const size = Math.max(5, Math.min(hw * 0.32, hh * 0.46));
    word.crabs.push({ x: hole.cx, y: hole.maxY - size * 0.75, size, phase: 0 });
  }
  // Second crab peeks over the top edge of the N.
  const n = letterPoint(word, nL, nL.adv * 0.32, -word.capH - word.E * 0.25);
  word.crabs.push({ x: n.x, y: n.y, size: S * 0.12, phase: 2.1 });
}

function bakeSprites() {
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = glyphFont(100);
  const unit = (def) => [...def.text].reduce((sum, ch, i) => {
    const adv = ch === 'A' ? A_ADV * 100 : probe.measureText(ch).width;
    return sum + adv * def.letters[i].sc + def.track * 100;
  }, 0) / 100;
  const finUnit = unit(WORDS.fin) * WORDS.fin.sizeRatio;
  const sanityUnit = unit(WORDS.sanity);
  const gapUnit = 0.1;
  const totalUnit = finUnit + sanityUnit + gapUnit;
  const S = Math.min((ts.w * 0.8) / totalUnit, (ts.h * 0.3) / 1.45, 260);
  ts.fin = buildWord(WORDS.fin, Math.round(S * WORDS.fin.sizeRatio));
  ts.sanity = buildWord(WORDS.sanity, Math.round(S));
  placeCrabs(ts.sanity);
  const gap = gapUnit * S;
  const groupW = ts.fin.textW + gap + ts.sanity.textW;
  const left = (ts.w - groupW) / 2;
  const sanityBase = ts.h * 0.2 + 0.55 * S;
  // Origins are sprite top-left on screen.
  ts.layout = {
    S,
    finX: left - ts.fin.padX,
    finY: sanityBase - 0.08 * S - ts.fin.baseY,
    sanityX: left + ts.fin.textW + gap - ts.sanity.padX,
    sanityY: sanityBase - ts.sanity.baseY,
    cx: ts.w / 2,
    cy: sanityBase - 0.42 * S,
  };
}

function bakeSmallSprites() {
  bubbleSprite = document.createElement('canvas');
  bubbleSprite.width = bubbleSprite.height = 48;
  const b = bubbleSprite.getContext('2d');
  const g = b.createRadialGradient(20, 18, 2, 24, 24, 22);
  g.addColorStop(0, 'rgba(255,255,255,0.18)');
  g.addColorStop(0.75, 'rgba(190,235,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0.7)');
  b.fillStyle = g;
  b.beginPath();
  b.arc(24, 24, 21, 0, Math.PI * 2);
  b.fill();
  b.strokeStyle = 'rgba(255,255,255,0.75)';
  b.lineWidth = 2;
  b.stroke();
  b.fillStyle = 'rgba(255,255,255,0.85)';
  b.beginPath();
  b.ellipse(16, 15, 6, 3.5, -0.6, 0, Math.PI * 2);
  b.fill();
}

// Same blob/coin looks as the in-game items (main.js's drawWastePoop and coin
// render), duplicated here per this codebase's own module-boundary convention
// instead of imported across modules — simplified, since these are title-only.
// The in-game flat coin (main.js's drawFlatCoin + drawCoinDollarMark), reused
// per direct request because it looks better than the first title-only coin —
// duplicated rather than imported, per the module-boundary convention.
function mixHex(hex, to, t) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * t));
  return `rgb(${ch[0]}, ${ch[1]}, ${ch[2]})`;
}

function drawFlatCoin(c, cx, cy, r, baseColor) {
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fillStyle = mixHex(baseColor, 0, 0.32);
  c.fill();
  c.beginPath();
  c.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  c.fillStyle = mixHex(baseColor, 255, 0.12);
  c.fill();
  c.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  c.lineWidth = Math.max(0.6, r * 0.05);
  c.beginPath();
  c.arc(cx, cy, r * 0.84, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  c.lineWidth = Math.max(0.6, r * 0.06);
  c.beginPath();
  c.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  c.stroke();
  // embossed "$", drawn before the sheen so the sheen glazes over it
  c.save();
  c.font = `bold ${Math.max(7, r * 1.05)}px sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const textY = cy + r * 0.04;
  const emboss = Math.max(0.6, r * 0.07);
  c.fillStyle = 'rgba(0, 0, 0, 0.5)';
  c.fillText('$', cx + emboss, textY + emboss);
  c.fillStyle = 'rgba(255, 255, 255, 0.65)';
  c.fillText('$', cx - emboss * 0.7, textY - emboss * 0.7);
  c.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  c.lineWidth = Math.max(0.8, r * 0.09);
  c.lineJoin = 'round';
  c.strokeText('$', cx, textY);
  c.fillStyle = mixHex(baseColor, 0, 0.2);
  c.fillText('$', cx, textY);
  c.restore();
  c.save();
  c.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  c.lineWidth = Math.max(1, r * 0.14);
  c.lineCap = 'round';
  c.beginPath();
  c.arc(cx, cy, r * 0.52, Math.PI * 1.12, Math.PI * 1.42);
  c.stroke();
  c.restore();
}

function itemSprite(kind) {
  if (itemSprites.has(kind)) return itemSprites.get(kind);
  const size = ITEM_RADIUS * 3;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size * ITEM_SPRITE_SCALE;
  cv.logical = size; // drawn at this size; baked at ITEM_SPRITE_SCALE for crispness, same as main.js's item sprites
  const c = cv.getContext('2d');
  c.scale(ITEM_SPRITE_SCALE, ITEM_SPRITE_SCALE);
  const cx = size / 2;
  const cy = size / 2;
  const r = ITEM_RADIUS;
  if (kind === 'waste') {
    const wr = r * 1.1;
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const rad = wr * (i % 2 === 0 ? 1.18 : 0.84);
      pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
    }
    c.beginPath();
    c.moveTo((pts[5].x + pts[0].x) / 2, (pts[5].y + pts[0].y) / 2);
    for (let i = 0; i < 6; i++) {
      const next = pts[(i + 1) % 6];
      c.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + next.x) / 2, (pts[i].y + next.y) / 2);
    }
    c.closePath();
    c.fillStyle = WASTE_COLOR;
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.lineWidth = Math.max(1, wr * 0.12);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.32)';
    c.beginPath();
    c.arc(cx - wr * 0.32, cy - wr * 0.32, wr * 0.3, 0, Math.PI * 2);
    c.fill();
  } else {
    const tier = COIN_TIERS[kind === 'coin_silver' ? 1 : kind === 'coin_bronze' ? 0 : 2];
    drawFlatCoin(c, cx, cy, COIN_RADIUS * tier.sizeMultiplier, tier.color);
  }
  itemSprites.set(kind, cv);
  return cv;
}

// ---- Bubbles ----
// opts: front (drawn over the words), ay (buoyancy acceleration, negative = up)
// and damp (per-second velocity drag) — the last two are what let a crash-spray
// bubble shoot down and out, slow, then turn around and float up.
function spawnBubble(x, y, vx, vy, r, life = 99, opts) {
  if (ts.bubbles.length >= BUBBLE_MAX) ts.bubbles.shift();
  ts.bubbles.push({ x, y, vx, vy, r, a: rand(0.55, 0.95), phase: Math.random() * 6.28, life, age: 0, front: !!(opts && opts.front), ay: (opts && opts.ay) || 0, damp: (opts && opts.damp) || 0 });
}

function drawBubbles(front) {
  for (const b of ts.bubbles) {
    if (b.front !== front) continue;
    ctx.globalAlpha = b.a * (b.age > b.life - 0.4 ? clamp((b.life - b.age) / 0.4, 0, 1) : 1);
    ctx.drawImage(bubbleSprite, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
  ctx.globalAlpha = 1;
}

function updateBubbles(dt) {
  const list = ts.bubbles;
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    b.age += dt;
    if (b.damp) { const k = Math.exp(-b.damp * dt); b.vx *= k; b.vy *= k; }
    b.vy += b.ay * dt;
    b.x += (b.vx + Math.sin(ts.t * 2 + b.phase) * 10) * dt;
    b.y += b.vy * dt;
    if (b.y < -20 || b.y > ts.h + 60 || b.age > b.life) { list[i] = list[list.length - 1]; list.pop(); }
  }
}

// ---- Fish & items ----
function makeFish(i) {
  const species = FISH_LINEUP[i];
  const dir = Math.random() < 0.5 ? 1 : -1;
  return {
    species,
    stage: SPECIES[species].growthStages.length - 1,
    rx: rand(0.3, 0.46) * ts.w * FISH_ORBIT_SCALE,
    ry: rand(34, 92) * FISH_ORBIT_SCALE,
    cyOff: rand(-0.16, 0.2) * ts.layout.S,
    omega: dir * rand(0.2, 0.34) * FISH_ORBIT_SPEED_SCALE,
    theta: Math.random() * Math.PI * 2,
    spawnAt: FISH_SPAWN_START_S + Math.random() * FISH_SPAWN_WINDOW_S,
    phase: Math.random() * 6.28,
    coinT: 0,
    wasteT: 0,
    bubbleT: 0,
    x: 0, y: 0, z: 0, sx: 1, alpha: 0, grow: 0, born: false,
  };
}


function addItem(kind, x, y, vx, vy) {
  const live = ts.items.filter((it) => !it.dying);
  if (live.length >= ITEM_MAX) { live[0].dying = true; live[0].age = ITEM_FADE_AFTER_S + ITEM_FADE_S - 0.25; }
  ts.items.push({ id: ts.nextItemId++, kind, x, y, vx, vy, spin: Math.random() * 6.28, age: 0, dying: false });
}

function randomCoinKind() {
  const r = Math.random();
  return r < 0.25 ? 'coin_bronze' : r < 0.55 ? 'coin_silver' : 'coin_gold';
}

function updateItems(dt) {
  const decay = Math.exp(-ITEM_DRAG * dt);
  for (let i = ts.items.length - 1; i >= 0; i--) {
    const it = ts.items[i];
    it.age += dt;
    if (it.age >= ITEM_FADE_AFTER_S + ITEM_FADE_S) { ts.items[i] = ts.items[ts.items.length - 1]; ts.items.pop(); continue; }
    if (ts.drag && ts.drag.item === it) continue;
    // Per direct request there is no floor — items sink right off the bottom of
    // the screen and are dropped the moment they're fully out of sight.
    if (it.y - ITEM_RADIUS > ts.h) { ts.items[i] = ts.items[ts.items.length - 1]; ts.items.pop(); continue; }
    it.vy += ITEM_GRAVITY * dt;
    it.vx *= decay;
    it.vy *= decay;
    it.x += it.vx * dt;
    it.y += it.vy * dt;
    it.spin += it.vy * dt * 0.05;
    const r = ITEM_RADIUS;
    if (it.x < r) { it.x = r; it.vx = Math.abs(it.vx) * 0.5; }
    if (it.x > ts.w - r) { it.x = ts.w - r; it.vx = -Math.abs(it.vx) * 0.5; }
  }
}

function slamBurst() {
  const L = ts.layout;
  const sw = ts.sanity.textW;
  const x0 = L.sanityX + ts.sanity.padX;
  const cy = L.sanityY + ts.sanity.baseY - ts.sanity.capH * 0.4;
  // The crash spray: thrown down and outward from where SANITY lands (away from
  // its center), then buoyancy and drag slow them, turn them around and let
  // them float up. In front of the words (opts.front).
  for (let i = 0; i < SLAM_BUBBLE_COUNT; i++) {
    const bx = x0 + Math.random() * sw;
    const out = (bx - (x0 + sw / 2)) / (sw / 2); // -1 (left end) .. 1 (right end)
    spawnBubble(bx, cy + rand(-10, 50), out * rand(120, 320) + rand(-70, 70), rand(-170, 420), rand(3, 10), rand(2.0, 3.6), { front: true, ay: -330, damp: 2.2 });
  }
  for (let i = 0; i < 6; i++) {
    addItem(randomCoinKind(), x0 + (0.1 + 0.8 * Math.random()) * sw, cy + rand(10, 40), rand(-110, 110), rand(50, 150));
  }
}

// ---- Frame ----
function drawFishOne(f) {
  const scale = FISH_DRAW_SCALE * (0.88 + 0.14 * f.z);
  ctx.save();
  ctx.globalAlpha = f.alpha;
  ctx.translate(f.x, f.y);
  // Minimum width applies only when drawing — clamping the stored value itself
  // snaps it back every frame on high-refresh displays (the per-frame step is
  // smaller than the clamp), leaving the fish stuck edge-on mid-turn.
  const sx = Math.abs(f.sx) < 0.12 ? (f.sx < 0 ? -0.12 : 0.12) : f.sx;
  ctx.scale(scale * sx, scale);
  drawFish(ctx, 0, 0, f.species, f.stage, 1, ts.t * 5 + f.phase, { x: 1, y: 0 });
  ctx.restore();
}

function drawCrab(x, y, size, t, phase) {
  const claw = Math.sin(t * 3.2 + phase);
  const peek = Math.sin(t * 1.3 + phase) * size * 0.08;
  ctx.save();
  ctx.translate(x, y + peek);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const rim = Math.max(1, size * 0.12);
  // arms + claws
  for (const side of [-1, 1]) {
    const raise = (side === 1 ? claw : -claw) * size * 0.28;
    const cx = side * size * 1.28;
    const cy = -size * 0.5 + raise;
    ctx.strokeStyle = '#7a1f10';
    ctx.lineWidth = size * 0.34;
    ctx.beginPath();
    ctx.moveTo(side * size * 0.7, -size * 0.1);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.strokeStyle = '#e2492a';
    ctx.lineWidth = size * 0.34 - rim;
    ctx.stroke();
    ctx.fillStyle = '#e2492a';
    ctx.strokeStyle = '#7a1f10';
    ctx.lineWidth = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7a1f10';
    ctx.beginPath();
    ctx.moveTo(cx + side * size * 0.05, cy - size * 0.05);
    ctx.lineTo(cx + side * size * 0.45, cy - size * 0.32);
    ctx.lineTo(cx + side * size * 0.3, cy + size * 0.02);
    ctx.closePath();
    ctx.fill();
  }
  // eye stalks
  for (const side of [-1, 1]) {
    ctx.strokeStyle = '#7a1f10';
    ctx.lineWidth = size * 0.14;
    ctx.beginPath();
    ctx.moveTo(side * size * 0.32, -size * 0.45);
    ctx.lineTo(side * size * 0.36, -size * 0.95);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(side * size * 0.36, -size * 1.05, size * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a1f10';
    ctx.lineWidth = rim * 0.8;
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(side * size * 0.36 + Math.sin(t * 1.7 + phase) * size * 0.07, -size * 1.07, size * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
  // shell
  ctx.fillStyle = '#e2492a';
  ctx.strokeStyle = '#7a1f10';
  ctx.lineWidth = rim;
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.25, -size * 0.28, size * 0.4, size * 0.17, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWord(word, x, y, scaleX = 1, scaleY = 1, alpha = 1) {
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  if (scaleX === 1 && scaleY === 1) {
    ctx.drawImage(word.canvas, x, y);
  } else {
    // squash/stretch about the sprite's baseline-center, so a slam compresses toward the water
    const ax = x + word.w / 2;
    const ay = y + word.baseY;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(word.canvas, -word.w / 2, -word.baseY);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function step(dt) {
  const L = ts.layout;
  const t = ts.t;
  const exiting = ts.exiting;
  const et = ts.exitT;

  // Slam impact: fires once, the frame SANITY lands.
  if (!ts.slamFired && t >= IMPACT_S) { ts.slamFired = true; slamBurst(); }

  // While SANITY is dropping, it throws off bubbles along its whole body from
  // wherever it currently is (same fall curve draw() uses).
  if (t >= SLAM_START_S && t < IMPACT_S) {
    ts.fallAcc += dt * FALL_BUBBLES_PER_S;
    const p = easeInQuad((t - SLAM_START_S) / SLAM_DUR_S);
    const off = -(1 - p) * (L.sanityY + ts.sanity.h + 40);
    const x0 = L.sanityX + ts.sanity.padX;
    const yMid = L.sanityY + off + ts.sanity.baseY - ts.sanity.capH * 0.4;
    while (ts.fallAcc >= 1) {
      ts.fallAcc -= 1;
      spawnBubble(x0 + Math.random() * ts.sanity.textW, yMid + rand(-ts.sanity.capH * 0.5, ts.sanity.capH * 0.6), rand(-40, 40), rand(-60, 40), rand(3, 8), rand(0.8, 1.8), { front: true });
    }
  }

  // Ambient bubbles drifting up from behind the letters.
  if (!exiting) {
    ts.bubbleAcc += dt * AMBIENT_BUBBLES_PER_S;
    while (ts.bubbleAcc >= 1) {
      ts.bubbleAcc -= 1;
      const x0 = L.finX + ts.fin.padX;
      const x1 = L.sanityX + ts.sanity.padX + ts.sanity.textW;
      spawnBubble(rand(x0, x1), L.sanityY + ts.sanity.baseY + rand(-ts.sanity.capH, 20), 0, rand(-55, -22), rand(2, 6.5), rand(3, 6));
    }
  }

  // Fish: spawn when due, then follow an elliptical orbit that widens from
  // the title's center.
  for (const f of ts.fish) {
    if (t < f.spawnAt) continue;
    if (!f.born) {
      f.born = true;
      f.coinT = rand(COIN_INTERVAL_S[0], COIN_INTERVAL_S[1]);
      f.wasteT = rand(WASTE_INTERVAL_S[0], WASTE_INTERVAL_S[1]);
      f.bubbleT = rand(FISH_BUBBLE_INTERVAL_S[0], FISH_BUBBLE_INTERVAL_S[1]);
    }
    const age = t - f.spawnAt;
    f.grow = easeOutCubic(clamp(age / FISH_ORBIT_GROW_S, 0, 1));
    f.theta += f.omega * dt;
    const sin = Math.sin(f.theta);
    f.x = L.cx + orbitX(f.theta) * f.rx * f.grow;
    f.y = L.cy + f.cyOff * f.grow + sin * f.ry * f.grow;
    f.z = f.grow < 0.6 ? -1 : sin; // newly spawned fish stay behind the letters so their spawn is hidden
    // Facing eases through the turn-around (the orbit's own speed no longer
    // drops to zero there, so it can't be derived from |vx| any more).
    const target = orbitVx(f.theta) * Math.sign(f.omega) >= 0 ? 1 : -1;
    f.sx += (target - f.sx) * Math.min(1, dt * 7);
    f.alpha = clamp(age / 0.4, 0, 1) * (exiting ? clamp(1 - et / 0.7, 0, 1) : 1);
    if (!exiting) {
      f.bubbleT -= dt;
      if (f.bubbleT <= 0) {
        f.bubbleT = rand(FISH_BUBBLE_INTERVAL_S[0], FISH_BUBBLE_INTERVAL_S[1]);
        // Blown from the mouth, and on the same side of the words as the fish.
        const scale = FISH_DRAW_SCALE * (0.88 + 0.14 * f.z);
        const dir = f.sx >= 0 ? 1 : -1;
        spawnBubble(f.x + dir * 20 * scale, f.y - 2 * scale, dir * rand(6, 22), rand(-75, -42), rand(2.5, 5.5), rand(2, 3.5), { front: f.z >= 0 });
      }
      f.coinT -= dt;
      f.wasteT -= dt;
      if (f.coinT <= 0) { f.coinT = rand(COIN_INTERVAL_S[0], COIN_INTERVAL_S[1]); addItem(randomCoinKind(), f.x, f.y + 10, rand(-18, 18), 8); }
      if (f.wasteT <= 0) { f.wasteT = rand(WASTE_INTERVAL_S[0], WASTE_INTERVAL_S[1]); addItem('waste', f.x, f.y + 10, rand(-18, 18), 8); }
    }
  }

  updateItems(dt);
  updateBubbles(dt);
}

function draw() {
  const L = ts.layout;
  const t = ts.t;
  const et = ts.exitT;
  ctx.clearRect(0, 0, ts.w, ts.h);

  // ---- word offsets ----
  let finOff = 0;
  let finAlpha = 1;
  let sanOff = 0;
  let sanSX = 1;
  let sanSY = 1;
  let sanVisible = true;
  const bob = (phase) => Math.sin(t * BOB_OMEGA + phase) * BOB_AMP_PX; // y = A sin(wt), per direct request

  if (t < FIN_IN_START_S) finAlpha = 0;
  else if (t < FIN_IN_START_S + FIN_IN_DUR_S) {
    const p = easeOutCubic((t - FIN_IN_START_S) / FIN_IN_DUR_S);
    finOff = (1 - p) * 90; // floats up into place
    finAlpha = p;
  }
  if (t >= IMPACT_S) {
    const s = t - IMPACT_S;
    finOff += -7 * Math.exp(-4.5 * s) * Math.sin(s * 15); // the slam jolts FIN too
  }
  if (t < SLAM_START_S) sanVisible = false;
  else if (t < IMPACT_S) {
    const p = easeInQuad((t - SLAM_START_S) / SLAM_DUR_S);
    sanOff = -(1 - p) * (L.sanityY + ts.sanity.h + 40);
  } else {
    const s = t - IMPACT_S;
    sanSY = 1 - 0.15 * Math.exp(-5 * s) * Math.cos(s * 13);
    sanSX = 1 + (1 - sanSY) * 0.55;
  }
  let sanTrailY = 0;
  let finTrailY = 0;
  if (ts.exiting) {
    const ps = clamp(et / EXIT_SANITY_DUR_S, 0, 1);
    sanOff += -easeInQuad(ps) * (L.sanityY + ts.sanity.h + 80);
    sanSX = sanSY = 1;
    const pf = clamp((et - EXIT_FIN_DELAY_S) / EXIT_FIN_DUR_S, 0, 1);
    finOff += -easeInQuad(pf) * (L.finY + ts.fin.h + 80);
    sanTrailY = sanOff;
    finTrailY = finOff;
  }
  const sanBob = ts.exiting ? 0 : t >= IMPACT_S ? bob(1.3) : 0;
  const finBob = ts.exiting ? 0 : bob(0);

  // ---- exit bubble trails (spawned from where each word currently is) ----
  if (ts.exiting) {
    const dt = ts.dt;
    ts.trailAccSanity += dt * EXIT_SANITY_BUBBLES_PER_S;
    ts.trailAccFin += dt * (et >= EXIT_FIN_DELAY_S ? EXIT_FIN_BUBBLES_PER_S : 0);
    const sx0 = L.sanityX + ts.sanity.padX;
    const fx0 = L.finX + ts.fin.padX;
    const sBottom = L.sanityY + ts.sanity.baseY + sanTrailY;
    const fBottom = L.finY + ts.fin.baseY + finTrailY;
    while (ts.trailAccSanity >= 1 && et < EXIT_SANITY_DUR_S + 0.1) {
      ts.trailAccSanity -= 1;
      spawnBubble(sx0 + Math.random() * ts.sanity.textW, sBottom + rand(-10, 14), rand(-18, 18), rand(-60, -10), rand(2, 8), rand(0.8, 1.6));
    }
    while (ts.trailAccFin >= 1) {
      ts.trailAccFin -= 1;
      spawnBubble(fx0 + Math.random() * ts.fin.textW, fBottom + rand(-8, 12), rand(-14, 14), rand(-45, -8), rand(2, 6), rand(0.8, 1.5));
    }
    if (ts.trailAccSanity > 4) ts.trailAccSanity = 0;
  }

  // ---- bubbles behind everything ----
  drawBubbles(false);

  // ---- fish behind the words ----
  for (const f of ts.fish) if (f.born && f.z < 0 && f.alpha > 0) drawFishOne(f);

  // ---- crabs (behind SANITY, so its letters frame them) ----
  if (sanVisible) {
    for (const c of ts.sanity.crabs) {
      const cx = L.sanityX + ts.sanity.w / 2 + (c.x - ts.sanity.w / 2) * sanSX;
      const cy = L.sanityY + ts.sanity.baseY + sanBob + sanOff + (c.y - ts.sanity.baseY) * sanSY;
      drawCrab(cx, cy, c.size, t, c.phase);
    }
  }

  drawWord(ts.fin, L.finX, L.finY + finOff + finBob, 1, 1, finAlpha);
  if (sanVisible) drawWord(ts.sanity, L.sanityX, L.sanityY + sanOff + sanBob, sanSX, sanSY, 1);

  // ---- fish in front ----
  for (const f of ts.fish) if (f.born && f.z >= 0 && f.alpha > 0) drawFishOne(f);
  drawBubbles(true); // crash spray and in-front fish bubbles, over the words

  // ---- loose coins/waste on top, so they can always be grabbed ----
  const exitFade = ts.exiting ? clamp(1 - et / 0.5, 0, 1) : 1;
  for (const it of ts.items) {
    const sprite = itemSprite(it.kind);
    const fade = it.age > ITEM_FADE_AFTER_S ? clamp(1 - (it.age - ITEM_FADE_AFTER_S) / ITEM_FADE_S, 0, 1) : 1;
    ctx.globalAlpha = fade * exitFade;
    if (it.kind === 'waste') {
      ctx.drawImage(sprite, it.x - sprite.logical / 2, it.y - sprite.logical / 2, sprite.logical, sprite.logical);
    } else {
      const sx = Math.max(0.15, Math.abs(Math.cos(it.spin)));
      const w = sprite.logical * sx;
      ctx.drawImage(sprite, it.x - w / 2, it.y - sprite.logical / 2, w, sprite.logical);
    }
  }
  ctx.globalAlpha = 1;
}

// ---- Pointer dragging for loose items ----
function itemAt(x, y) {
  let best = null;
  let bestD = Infinity;
  const reach = ITEM_RADIUS * ITEM_GRAB_RADIUS_MULT;
  for (const it of ts.items) {
    const d = (it.x - x) ** 2 + (it.y - y) ** 2;
    if (d <= reach * reach && d < bestD) { best = it; bestD = d; }
  }
  return best;
}

function onPointerDown(e) {
  if (ts.exiting || ts.paused) return;
  const it = itemAt(e.clientX, e.clientY);
  if (!it) return;
  ts.drag = { item: it, samples: [{ t: performance.now(), x: e.clientX, y: e.clientY }] };
  it.vx = it.vy = 0;
  try { canvasEl.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers can't be captured — dragging still works */ }
  canvasEl.style.cursor = 'grabbing';
}

function onPointerMove(e) {
  if (ts.drag) {
    const it = ts.drag.item;
    it.x = clamp(e.clientX, ITEM_RADIUS, ts.w - ITEM_RADIUS);
    it.y = Math.max(ITEM_RADIUS, e.clientY);
    const now = performance.now();
    ts.drag.samples.push({ t: now, x: e.clientX, y: e.clientY });
    while (ts.drag.samples.length > 2 && now - ts.drag.samples[0].t > 100) ts.drag.samples.shift();
    return;
  }
  if (ts.exiting) return;
  const over = !!itemAt(e.clientX, e.clientY);
  if (over !== ts.hoverItem) { ts.hoverItem = over; canvasEl.style.cursor = over ? 'grab' : ''; }
}

function onPointerUp() {
  if (!ts.drag) return;
  const { item, samples } = ts.drag;
  ts.drag = null;
  // Throw velocity from the last ~100ms of cursor travel, same idea as the
  // in-game item drag's averaged window.
  const a = samples[0];
  const b = samples[samples.length - 1];
  const span = Math.max(16, b.t - a.t) / 1000;
  item.vx = clamp((b.x - a.x) / span, -ITEM_THROW_MAX, ITEM_THROW_MAX);
  item.vy = clamp((b.y - a.y) / span, -ITEM_THROW_MAX, ITEM_THROW_MAX);
  canvasEl.style.cursor = ts.hoverItem ? 'grab' : '';
}

// ---- Sizing ----
function sizeCanvases() {
  ts.w = window.innerWidth;
  ts.h = window.innerHeight;
  canvasEl.width = ts.w;
  canvasEl.height = ts.h;
}

function rebuild() {
  sizeCanvases();
  bakeSprites();
  // Fish orbits are sized off the viewport, so re-roll their extents (keeping
  // each one's current phase/timers) rather than leave them stale.
  for (const f of ts.fish) { f.rx = rand(0.3, 0.46) * ts.w * FISH_ORBIT_SCALE; }
  ts.backdropDirty = true;
  ts.backdropReady = false;
}

// ---- Public API ----
// Resolves once the logo font is available; main.js includes it in the
// loading screen's resource list so the sprites never bake with a fallback.
export function loadTitleFonts() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.all([document.fonts.load(glyphFont(100), 'FINSANITY'), document.fonts.load(glyphFont(100), 'A')]).catch(() => {});
}

export function initTitleScreen() {
  overlayEl = document.getElementById('start-overlay');
  canvasEl = document.getElementById('title-canvas');
  backdropEl = document.getElementById('title-backdrop');
  ctx = canvasEl.getContext('2d');
  backdropCtx = backdropEl.getContext('2d');
  bakeSmallSprites();
  sizeCanvases();
  bakeSprites();
  canvasEl.addEventListener('pointerdown', onPointerDown);
  canvasEl.addEventListener('pointermove', onPointerMove);
  canvasEl.addEventListener('pointerup', onPointerUp);
  canvasEl.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('resize', () => {
    clearTimeout(ts.resizeTimer);
    ts.resizeTimer = setTimeout(rebuild, 120); // sprites are baked for one viewport size — rebuilt once resizing settles, not per resize event
  });
  ts.ready = true;
}

// Called the moment #start-overlay becomes visible.
export function showTitle(now) {
  ts.active = true;
  ts.exiting = false;
  ts.t = 0;
  ts.exitT = 0;
  ts.lastNow = now;
  ts.slamFired = false;
  ts.fallAcc = 0;
  ts.items.length = 0;
  ts.bubbles.length = 0;
  ts.fish = FISH_LINEUP.map((_, i) => makeFish(i));
  ts.backdropDirty = true;
  ts.backdropReady = false;
  backdropEl.classList.remove('ready');
}

export function setTitlePaused(paused) {
  ts.paused = paused;
  ts.lastNow = performance.now();
}

// Per-frame hook, called from main.js's render().
export function updateTitle(now) {
  if (!ts.active || ts.paused) return;
  const dt = clamp((now - ts.lastNow) / 1000, 0, 0.05);
  ts.lastNow = now;
  ts.dt = dt;
  ts.t += dt;
  if (ts.exiting) ts.exitT += dt;
  step(dt);
  draw();
  if (ts.exiting && ts.exitT >= EXIT_DONE_S) finishExit();
}

// While the title is up and its backdrop snapshot exists, the whole game
// world is skipped each frame (the snapshot stands in for it).
export function titleBlocksWorldRender() {
  return ts.active && !ts.exiting && ts.backdropReady && !ts.backdropDirty;
}

export function titleNeedsBackdrop() {
  return ts.active && !ts.exiting && ts.backdropDirty;
}

// Half-resolution copy of the real game canvas, tinted — CSS scales it back up
// with bilinear smoothing, which is the entire "very slight blur". No filter
// runs per frame (per direct request for a very cheap blur).
export function captureTitleBackdrop(src) {
  backdropEl.width = Math.max(1, Math.round(src.width * BACKDROP_SCALE));
  backdropEl.height = Math.max(1, Math.round(src.height * BACKDROP_SCALE));
  backdropCtx.imageSmoothingEnabled = true;
  backdropCtx.drawImage(src, 0, 0, backdropEl.width, backdropEl.height);
  backdropCtx.fillStyle = 'rgba(11, 37, 64, 0.3)';
  backdropCtx.fillRect(0, 0, backdropEl.width, backdropEl.height);
  ts.backdropDirty = false;
  ts.backdropReady = true;
  backdropEl.classList.add('ready');
}

export function exitTitle(onDone) {
  if (!ts.active || ts.exiting) { if (onDone) onDone(); return; }
  ts.exiting = true;
  ts.exitT = 0;
  ts.onExitDone = onDone;
  ts.trailAccSanity = ts.trailAccFin = 0;
  if (ts.drag) { ts.drag = null; }
  overlayEl.classList.add('leaving');
}

function finishExit() {
  ts.active = false;
  ts.exiting = false;
  ts.items.length = 0;
  ts.bubbles.length = 0;
  overlayEl.classList.add('hidden');
  overlayEl.classList.remove('leaving');
  const cb = ts.onExitDone;
  ts.onExitDone = null;
  if (cb) cb();
}
