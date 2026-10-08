const { openGame } = require('./lib.cjs');
(async () => {
  const h = await openGame({ fixture: null }); const { page } = h; const out = [];
  // SHOP: family cycling updates title/dataset/dots/price
  await page.keyboard.press('KeyE'); await page.waitForTimeout(1000);
  const fam = await page.$('.tool-btn-build:has(.tool-btn-family-dots span:nth-child(2))'); // a family with >1 tier
  const snap = () => fam.evaluate((b) => ({ tool: b.dataset.tool, title: b.title, price: b.querySelector('.building-icon-price').textContent, current: [...b.querySelectorAll('.tool-btn-family-dots span')].findIndex((s) => s.classList.contains('current')) }));
  const s0 = await snap(); await fam.click(); await page.waitForTimeout(150); await fam.click(); await page.waitForTimeout(250); const s1 = await snap();
  out.push(['shop family cycle changed', JSON.stringify(s0) !== JSON.stringify(s1), JSON.stringify(s0), JSON.stringify(s1)]);
  // money change updates a price tag's affordability live
  const priceTxt0 = await page.$eval('.species-icon-price', (e) => e.textContent);
  await page.keyboard.press('KeyE'); await page.waitForTimeout(500);
  // TANK: buy an upgrade; level + points text update
  await page.keyboard.press('KeyT'); await page.waitForTimeout(1000);
  const lvl0 = await page.$$eval('.tank-upgrade-level', (els) => els.map((e) => e.textContent)); const pts0 = await page.$eval('#tank-points-display', (e) => e.textContent);
  const buy = await page.$('.tank-upgrade-buy:not([disabled])'); if (buy) { await buy.click(); await page.waitForTimeout(400); }
  const lvl1 = await page.$$eval('.tank-upgrade-level', (els) => els.map((e) => e.textContent)); const pts1 = await page.$eval('#tank-points-display', (e) => e.textContent);
  out.push(['tank buy updated level+points', JSON.stringify(lvl0) !== JSON.stringify(lvl1) && pts0 !== pts1, lvl0.join('|') + ' ' + pts0, lvl1.join('|') + ' ' + pts1]);
  await page.keyboard.press('KeyT'); await page.waitForTimeout(500);
  // LAB: purchase a node via the modal; cost text becomes Unlocked, readout changes
  await page.keyboard.press('KeyS'); await page.waitForTimeout(1200);
  const ro0 = await page.$eval('#lab-science-readout', (e) => e.textContent);
  const node = await page.$('button.lab-node:not(.locked):not(.purchased)');
  const nodeCost0 = node ? await node.$eval('.lab-node-cost', (e) => e.textContent) : null;
  if (node) { await node.click(); await page.waitForTimeout(500); const ok = await page.$('#lab-purchase-confirm-btn'); if (ok && !(await ok.isDisabled())) { await ok.click(); await page.waitForTimeout(600); } }
  const nodeCost1 = node ? await node.$eval('.lab-node-cost', (e) => e.textContent) : null; const ro1 = await page.$eval('#lab-science-readout', (e) => e.textContent);
  out.push(['lab purchase flips node to Unlocked + readout updates', /Unlocked/.test(nodeCost1 || '') && ro0 !== ro1, `${nodeCost0} | ${ro0}`, `${nodeCost1} | ${ro1}`]);
  for (const o of out) console.log(o[1] ? 'PASS' : 'FAIL', o[0], '\n   before:', o[2], '\n   after: ', o[3]);
  console.log('console errors (excl favicon):', h.errors.filter((e) => !/favicon/.test(e)));
  await h.browser.close();
})();
