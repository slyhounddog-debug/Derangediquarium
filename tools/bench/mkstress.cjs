// Builds the stress fixture with the game's own cheat keys (no code changes).
const fs = require('fs');
const { chromium } = require('./pw.cjs');
const Z = 1600 / 1792, TILE = 32 * Z; // auto-fit zoom at 1600 wide: world fits exactly, camera.x = 0
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto('http://localhost:8080/?perf', { waitUntil: 'domcontentloaded' });
  for (let gi = 0; gi < 60 && (await page.$('#start-overlay.hidden') || !(await page.$('#start-overlay'))); gi++) { await page.waitForTimeout(400); await page.mouse.click(8, 8); }
  await page.waitForTimeout(1500);
  await page.click('text=New Game'); await page.waitForTimeout(800); await page.click('#start-mode-exp-btn');
  await page.waitForTimeout(2500);
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
  await page.keyboard.press('KeyM'); await page.keyboard.press('KeyU');
  for (let i = 0; i < 12; i++) { await page.keyboard.press('KeyN'); await page.waitForTimeout(200); }
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(3000); await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(500);
  const saveNow = async () => {
    for (let i = 0; i < 4 && !(await page.isVisible('#pause-save-btn')); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    await page.click('#pause-save-btn', { timeout: 3000 }); await page.waitForTimeout(400);
    const s = await page.evaluate(() => localStorage.getItem('finsanity_save_v1'));
    for (let i = 0; i < 4 && (await page.isVisible('#pause-save-btn')); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    return s;
  };
  // calibrate rows: one probe press at two screen heights
  await page.mouse.move(800, 450); await page.keyboard.press('Shift+KeyT');
  await page.mouse.move(800, 700); await page.keyboard.press('Shift+KeyT');
  const probe = JSON.parse(await saveNow());
  const cells = []; probe.level.grid.forEach((r, ri) => r.forEach((v, ci) => { if (v === 'platform') cells.push([ci, ri]); }));
  console.log('probe cells [col,row]', JSON.stringify(cells));
  const rowAt450 = cells.find((c) => c[0] === Math.floor(800 / TILE))[1];
  const rowTop = rowAt450 + 0.5 - 450 / TILE; // fractional tile row at screen y=0 (approx; +-0.5 tile)
  console.log('row at y=450:', rowAt450, 'rowTop', rowTop.toFixed(2));
  const sx = (col) => (col + 0.5) * TILE, sy = (row) => (row + 0.5 - rowTop) * TILE;
  const place = async (col, row, presses) => { await page.mouse.move(sx(col), sy(row)); for (let i = 0; i < presses; i++) await page.keyboard.press('Shift+KeyT'); };
  // 50 buildings
  let n = 0;
  for (let c = 6; c <= 20; c++) { await place(c, 24, 1); n++; }                   // 15 platforms
  for (let i = 0, c = 6; c <= 20; c += 2, i++) { await place(c, 26, 6 + (i % 3)); n++; } // 8 collectors (3 tiers)
  for (let i = 0, c = 8; c <= 16; c += 2, i++) { await place(c, 28, 9 + (i % 3)); n++; } // 5 fans
  for (let i = 0, c = 30; i < 3; i++, c += 2) { await place(c, 23, 12 + i); n++; }      // 3 turrets
  for (let i = 0, c = 24; i < 3; i++, c += 2) { await place(c, 30, 15 + i); n++; }      // 3 refineries
  for (let i = 0, c = 36; i < 2; i++, c += 2) { await place(c, 30, 18); n++; }          // 2 manufacturers
  for (let i = 0, c = 40; i < 3; i++, c += 2) { await place(c, 32, 19); n++; }          // 3 power plants
  for (let i = 0, c = 46; i < 4; i++, c += 1) { await place(c, 24, 2 + i); n++; }       // 4 half-platforms
  for (let c = 6; c <= 18; c += 2) { await place(c, 34, 6 + (c % 3)); n++; }            // 7 more collectors
  console.log('placed', n);
  // 30 fish across every species the shop offers (select species in shop, then Shift+G in the water)
  await page.keyboard.press('KeyE'); await page.waitForTimeout(800);
  const speciesBtns = await page.$$('.species-icon-btn');
  console.log('species buttons', speciesBtns.length);
  let fish = 0;
  for (let round = 0; fish < 30 && round < 8; round++) {
    for (const b of speciesBtns) {
      if (fish >= 30) break;
      try { await b.click({ timeout: 1000 }); } catch { continue; }
      await page.mouse.move(150 + (fish * 47) % 1300, 120 + (fish * 61) % 380);
      await page.keyboard.press('Shift+KeyG'); fish++;
    }
  }
  await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
  // 10x speed for a while so fish produce authentic items/waste/science
  for (let i = 0; i < 6; i++) await page.keyboard.press('Equal');
  await page.waitForTimeout(45000);
  for (let i = 0; i < 6; i++) await page.keyboard.press('Minus');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'stress_built.png' });
  const final = await saveNow();
  fs.writeFileSync(require('path').join(__dirname, 'fixtures', 'stress_raw.json'), final);
  const s = JSON.parse(final);
  const kinds = {}; for (const it of s.level.items) kinds[it.type] = (kinds[it.type] || 0) + 1;
  console.log('fish', s.level.entities.filter((e) => e.type === 'fish').length, 'aliens', s.level.entities.filter((e) => e.type === 'alien').length, 'items', s.level.items.length, kinds, 'buildings', Object.keys(s.level.buildingData).length);
  await browser.close();
})();
