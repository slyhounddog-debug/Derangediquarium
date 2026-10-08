// node tools/bench/profilelines.cjs <fixture|none> <secs> fn1,fn2,...  -> hottest SOURCE LINES inside the named functions (V8 positionTicks; inlined callees show up under the line that holds their code)
const { openGame } = require('./lib.cjs');
(async () => {
  const fixture = process.argv[2] === 'none' ? null : (process.argv[2] || 'stress.json');
  const secs = parseInt(process.argv[3] || '10', 10);
  const want = new Set((process.argv[4] || 'updateEntities').split(','));
  const h = await openGame({ fixture }); const { page, cdp } = h;
  await page.waitForTimeout(parseInt(process.env.PROFILE_WARMUP || '8000', 10));
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start'); await page.waitForTimeout(secs * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  const per = {}; let total = 0;
  for (const dt of profile.timeDeltas) total += dt;
  const usPerTick = total / profile.samples.length;
  for (const n of profile.nodes) {
    const cf = n.callFrame; if (!want.has(cf.functionName) || !n.positionTicks) continue;
    const file = cf.url.split('/').slice(-1)[0];
    for (const t of n.positionTicks) { const k = `${cf.functionName} ${file}:${t.line}`; per[k] = (per[k] || 0) + t.ticks * usPerTick; }
  }
  console.log(`lines inside ${[...want].join(', ')} (ms per second):`);
  Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, parseInt(process.env.TOP || '24', 10)).forEach(([k, v]) => console.log(`${(v / 1000 / secs).toFixed(1).padStart(7)}  ${k}`));
  await h.browser.close();
})();
