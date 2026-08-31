// Engine.js — fixed-timestep loop, camera, raw input, coordinate transforms.
// Forbidden: no knowledge of fish/items/grid contents. This module moves the
// camera and hands out coordinates; gameplay lives elsewhere.

import { CAMERA_PAN_SPEED, CAMERA_SCROLL_SENSITIVITY, WORLD_W, WORLD_H, CAMERA_BOTTOM_BUFFER_PX } from './Config.js';

export function worldToScreen(x, y, camera) {
  return {
    x: (x - camera.x) * camera.zoom,
    y: (y - camera.y) * camera.zoom,
  };
}

export function screenToWorld(x, y, camera) {
  return {
    x: x / camera.zoom + camera.x,
    y: y / camera.zoom + camera.y,
  };
}

// Raw keyboard + mouse state, plus click/keydown handler registries that
// main.js and UI.js populate with gameplay-specific behavior.
export function createInput(canvas) {
  const input = {
    keysDown: new Set(),
    mouse: { x: 0, y: 0, inside: false },
    mouseDown: false, // left button held — build-mode drag-placement reads this each tick, see main.js
    clickHandlers: [],
    rightClickHandlers: [], // build-mode tile removal; contextmenu is prevented so it never opens the browser menu
    mouseDownHandlers: [], // fired once, at press — main.js uses this to arm an Economy Fish Combining drag when the press lands on a combinable fish
    mouseUpHandlers: [], // fired once, at release (screen coords are the last tracked in-canvas mouse position — see the window mouseup listener below) — main.js uses this to resolve a combining drag
    keydownHandlers: [],
    wheelDeltaX: 0, // accumulated scroll since the last updateCamera consumed it
    wheelDeltaY: 0,
  };

  window.addEventListener('keydown', (e) => {
    input.keysDown.add(e.code);
    for (const handler of input.keydownHandlers) handler(e);
  });
  window.addEventListener('keyup', (e) => {
    input.keysDown.delete(e.code);
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - rect.left;
    input.mouse.y = e.clientY - rect.top;
    input.mouse.inside = true;
  });
  canvas.addEventListener('mouseleave', () => {
    input.mouse.inside = false;
  });
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    for (const handler of input.clickHandlers) handler(sx, sy, e);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    input.mouseDown = true;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    for (const handler of input.mouseDownHandlers) handler(sx, sy, e);
  });
  window.addEventListener('mouseup', (e) => {
    // Listens on window, not the canvas, so a drag that releases outside
    // the canvas still clears mouseDown instead of leaving it stuck true.
    // mouseUpHandlers fire with the last tracked in-canvas mouse position
    // (input.mouse.x/y) rather than this event's own coordinates, since a
    // release outside the canvas has no canvas-relative position to give.
    if (e.button !== 0) return;
    input.mouseDown = false;
    for (const handler of input.mouseUpHandlers) handler(input.mouse.x, input.mouse.y, e);
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // right-click is build-mode tile removal, not the browser menu
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    for (const handler of input.rightClickHandlers) handler(sx, sy, e);
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault(); // don't let the page itself scroll
      input.wheelDeltaX += e.deltaX;
      input.wheelDeltaY += e.deltaY;
    },
    { passive: false }
  );

  return input;
}

// Panning is driven only by deliberate input — WASD/arrows and the scroll
// wheel. Mouse position alone never pans the camera (no edge-scroll): it
// used to fire by accident during ordinary play (e.g. moving the cursor
// toward the bottom of the screen to click a coin near the floor).
export function updateCamera(camera, input, canvas, dtMs) {
  const dt = dtMs / 1000;
  let dx = 0;
  let dy = 0;

  // KeyS is deliberately not bound here — it's the shop collapse/expand
  // hotkey (see main.js). ArrowDown remains the way to pan down by keyboard.
  if (input.keysDown.has('KeyW') || input.keysDown.has('ArrowUp')) dy -= 1;
  if (input.keysDown.has('ArrowDown')) dy += 1;
  if (input.keysDown.has('KeyA') || input.keysDown.has('ArrowLeft')) dx -= 1;
  if (input.keysDown.has('KeyD') || input.keysDown.has('ArrowRight')) dx += 1;

  camera.x += dx * CAMERA_PAN_SPEED * dt;
  camera.y += dy * CAMERA_PAN_SPEED * dt;

  camera.x += input.wheelDeltaX * CAMERA_SCROLL_SENSITIVITY;
  camera.y += input.wheelDeltaY * CAMERA_SCROLL_SENSITIVITY;
  input.wheelDeltaX = 0;
  input.wheelDeltaY = 0;

  const viewW = canvas.width / camera.zoom;
  const viewH = canvas.height / camera.zoom;
  camera.x = Math.max(0, Math.min(camera.x, Math.max(0, WORLD_W - viewW)));
  // Allowed to scroll CAMERA_BOTTOM_BUFFER_PX past the world's real bottom
  // edge — a pure-visual buffer strip, per direct request, that's always
  // reachable so the fixed bottom tool-bar has somewhere to live that never
  // covers real gameplay content.
  camera.y = Math.max(0, Math.min(camera.y, Math.max(0, WORLD_H + CAMERA_BOTTOM_BUFFER_PX - viewH)));
}

// Fixed 60Hz accumulator loop (§3.4). rAF drives rendering only; update()
// always advances by exactly simDtMs so physics never sees a variable delta.
// getTimeScale() scales how much sim time each rendered frame accumulates,
// not the size of a single step — this keeps physics stable at 10x speed.
export function createGameLoop({ update, render, getTimeScale, simDtMs, maxFrameSkip }) {
  let accumulator = 0;
  let lastTime = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);

    let frameTime = now - lastTime;
    lastTime = now;
    if (frameTime > 250) frameTime = 250; // clamp huge stalls (e.g. backgrounded tab) before they hit the accumulator

    accumulator += frameTime * getTimeScale();

    let steps = 0;
    while (accumulator >= simDtMs && steps < maxFrameSkip) {
      update(simDtMs);
      accumulator -= simDtMs;
      steps++;
    }
    if (steps >= maxFrameSkip) accumulator = 0; // drop backlog rather than spiral after a stall

    render();
  }

  requestAnimationFrame(frame);
}
