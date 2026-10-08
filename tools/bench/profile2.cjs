// node bench/profile2.cjs <fixture|none> [secs=8]  -> self time of native canvas calls grouped by their JS caller, plus top inclusive JS functions
const { openGame } = require('./lib.cjs');
(async () => {
  const fixture = process.argv[2] === 'none' ? null : (process.argv[2] || 'stress.json');
  const secs = parseInt(process.argv[3] || '8', 10);
  const h = await openGame({ fixture }); const { page, cdp } = h;
  await page.waitForTimeout(3000);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
  await cdp.send('Profiler.start'); await page.waitForTimeout(secs * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  const nodes = new Map(profile.nodes.map((n) => [n.id, n])); const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const name = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').slice(-1)[0]}:${n.callFrame.lineNumber + 1}`;
  const selfByNode = new Map(); let total = 0;
  profile.samples.forEach((id, i) => { const d = profile.timeDeltas[i] || 0; total += d; selfByNode.set(id, (selfByNode.get(id) || 0) + d); });
  // native leaf calls grouped by nearest JS caller
  const native = new Map();
  for (const [id, t] of selfByNode) { const n = nodes.get(id); if (n.callFrame.url) continue; const p = nodes.get(parent.get(id)); const key = `${n.callFrame.functionName || '(native)'}  <-  ${p ? name(p) : '?'}`; native.set(key, (native.get(key) || 0) + t); }
  console.log(`total ${(total / 1000).toFixed(0)}ms / ${secs}s. Native calls by caller (ms per second):`);
  [...native.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, v]) => console.log(`${(v / 1000 / secs).toFixed(1).padStart(7)}  ${k}`));
  // inclusive time per JS function
  const incl = new Map();
  for (const [id, t] of selfByNode) { const seen = new Set(); let cur = id; while (cur != null) { const n = nodes.get(cur); const k = name(n); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + t); } cur = parent.get(cur); } }
  console.log('\nInclusive (ms per second), top JS functions:');
  [...incl.entries()].filter(([k]) => !k.startsWith('(')).sort((a, b) => b[1] - a[1]).slice(0, 22).forEach(([k, v]) => console.log(`${(v / 1000 / secs).toFixed(1).padStart(7)}  ${k}`));
  await h.browser.close();
})();
