// CPU sampling profile of a scenario: node bench/profile.cjs <fixture|none> [secs=8] [topN=30]
const { openGame } = require('./lib.cjs');
(async () => {
  const fixture = process.argv[2] === 'none' ? null : (process.argv[2] || 'stress.json');
  const secs = parseInt(process.argv[3] || '8', 10), topN = parseInt(process.argv[4] || '30', 10);
  const h = await openGame({ fixture }); const { page, cdp } = h;
  await page.waitForTimeout(3000);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
  await cdp.send('Profiler.start'); await page.waitForTimeout(secs * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map(); const dt = profile.timeDeltas; let total = 0;
  profile.samples.forEach((id, i) => { const d = dt[i] || 0; total += d; const n = byId.get(id); const cf = n.callFrame; const key = `${cf.functionName || '(anon)'}  ${cf.url.split('/').slice(-1)[0]}:${cf.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + d); });
  const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);
  console.log(`total sampled ${(total / 1000).toFixed(0)}ms over ${secs}s`);
  for (const [k, v] of rows) console.log(`${((v / total) * 100).toFixed(1).padStart(5)}%  ${(v / 1000 / secs).toFixed(1).padStart(6)}ms/s  ${k}`);
  await h.browser.close();
})();
