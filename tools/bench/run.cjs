// Usage: node bench/run.cjs <tag> [scenarioIds comma-sep | all] [runs=3]
//   e.g. node bench/run.cjs baseline all 3   |   node bench/run.cjs quick stress,stress+shop 1
const fs = require('fs');
const path = require('path');
const { runScenario, summarize, SCENARIOS } = require('./lib.cjs');

(async () => {
  const tag = process.argv[2] || 'adhoc';
  const which = (process.argv[3] || 'all');
  const runsN = parseInt(process.argv[4] || '3', 10);
  const list = which === 'all' ? SCENARIOS : SCENARIOS.filter((s) => which.split(',').includes(s.id));
  const out = { tag, when: new Date().toISOString(), scenarios: {} };
  for (const sc of list) {
    const runs = [];
    for (let i = 0; i < runsN; i++) runs.push(await runScenario(sc));
    out.scenarios[sc.id] = summarize(runs);
    const s = out.scenarios[sc.id];
    console.log(`${sc.id.padEnd(12)} BUSY per wall-second: main ${s.mainMsPerSec}ms  gpu ${s.gpuMsPerSec}ms | interval ${String(s.intervalAvg).padStart(5)}ms (p95 ${s.p95}, p99 ${s.p99}, max ${s.max}) ${s.fps}fps | main ${s.mainTask}ms (script ${s.script}) | F3 update ${s.updateMs} render ${s.renderMs} | GPU busy ${s.gpuBusyMsPerFrame}ms/frame (${s.gpuBusyPct}%) raster ${s.rasterMsPerFrame} | items ${s.items}->${s.itemsEnd} fish ${s.fish} bldg ${s.buildings}${s.errors.length ? ' | ERRORS ' + s.errors.join(';') : ''}`);
  }
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'results', tag + '.json'), JSON.stringify(out, null, 2));
  console.log('saved results/' + tag + '.json');
})();
