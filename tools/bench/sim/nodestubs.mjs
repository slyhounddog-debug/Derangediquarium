// Minimal browser stubs so the game's pure-logic modules (Grid.js, Entities.js...) load in plain Node for offline equivalence tests.
const noop = () => {};
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === 'canvas' ? {} : () => ({ addColorStop: noop }))), set: (t, k, v) => { t[k] = v; return true; } });
const el = () => ({ getContext: () => ctx, style: { setProperty: noop }, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, appendChild: noop, addEventListener: noop, setAttribute: noop, querySelector: () => null, querySelectorAll: () => [], width: 0, height: 0, play: () => Promise.resolve() });
globalThis.window = globalThis; globalThis.addEventListener = noop; globalThis.location = { search: '' };
globalThis.document = { createElement: el, getElementById: () => null, addEventListener: noop, body: el(), documentElement: el(), querySelector: () => null, querySelectorAll: () => [], fonts: { ready: Promise.resolve(), load: () => Promise.resolve() } };
globalThis.localStorage = { getItem: () => null, setItem: noop };
globalThis.requestAnimationFrame = () => 0;
globalThis.Audio = function () { return el(); };
globalThis.Image = function () { return el(); };
