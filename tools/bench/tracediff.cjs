const { openGame } = require('./lib.cjs');
async function agg(frozen) {
  const h = await openGame({ fixture: 'stress.json' }); const { page, browser } = h;
  if (frozen) await page.click('#time-pause-btn');
  await page.waitForTimeout(3000);
  await browser.startTracing(page, { categories: ['-*', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'cc', 'gpu', 'viz', 'toplevel', 'benchmark', 'skia'] });
  await page.waitForTimeout(4000);
  const ev = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
  const thr = {}, proc = {}; for (const e of ev) { if (e.ph === 'M' && e.name === 'thread_name') thr[e.pid + ':' + e.tid] = e.args.name; if (e.ph === 'M' && e.name === 'process_name') proc[e.pid] = e.args.name; }
  const a = {}, cnt = {};
  for (const e of ev) { if (e.ph !== 'X' || !e.dur) continue; const k = `${(proc[e.pid] || '?').slice(0, 6)}/${thr[e.pid + ':' + e.tid] || '?'} :: ${e.name}`; a[k] = (a[k] || 0) + e.dur / 1000 / 4; cnt[k] = (cnt[k] || 0) + 1; }
  await h.browser.close(); return { a, cnt };
}
(async () => {
  const live = await agg(false), froz = await agg(true);
  const keys = [...new Set([...Object.keys(live.a), ...Object.keys(froz.a)])].filter((k) => !/RunTask|ThreadController|Scheduler|ExecuteDeferred|CommandBuffer|GpuChannel|OnAsyncFlush|PutChanged|GPUTask$/.test(k));
  keys.sort((x, y) => ((live.a[y] || 0) - (froz.a[y] || 0)) - ((live.a[x] || 0) - (froz.a[x] || 0)));
  console.log('ms per second   live   frozen   (sorted by live-minus-frozen)');
  for (const k of keys.slice(0, 22)) console.log(`${(live.a[k] || 0).toFixed(0).padStart(11)} ${(froz.a[k] || 0).toFixed(0).padStart(7)}   ${k}`);
})();
