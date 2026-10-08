// node bench/accurate.cjs <fixture|none>  -> F3 ACCURATE mode phase breakdown (each phase forced to finish drawing)
const { openGame } = require('./lib.cjs');
(async () => {
  const fixture = process.argv[2] === 'none' ? null : (process.argv[2] || 'stress.json');
  const h = await openGame({ fixture }); const { page } = h;
  await page.waitForTimeout(3000);
  await page.keyboard.press('F3'); // basic -> accurate
  await page.waitForTimeout(2500);
  const runs = [];
  for (let i = 0; i < 6; i++) { runs.push(await page.evaluate(() => document.getElementById('perf-overlay').textContent)); await page.waitForTimeout(700); }
  const acc = {};
  let cnt = 0;
  for (const t of runs) { if (!/ACCURATE/.test(t)) continue; cnt++; const i = t.indexOf('ms per frame by phase'); for (const l of t.slice(i).split('\n').slice(1)) { const m = l.match(/^\s*([\d.]+)\s+(.+)$/); if (m) acc[m[2]] = (acc[m[2]] || 0) + parseFloat(m[1]); } }
  console.log(runs[runs.length - 1].split('\n').slice(0, 7).join('\n'));
  console.log('\nphase (ms/frame, accurate mode, avg of', cnt, 'reads):');
  Object.entries(acc).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(String((v / cnt).toFixed(1)).padStart(7), k));
  await h.browser.close();
})();
