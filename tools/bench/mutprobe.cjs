const { openGame } = require('./lib.cjs');
(async () => {
  const h = await openGame({ fixture: null });
  const { page } = h;
  const obs = () => page.evaluate(() => new Promise((res) => {
    const counts = {};
    const desc = (n) => { const e = n.nodeType === 3 ? n.parentElement : n; return e ? (e.id ? '#' + e.id : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '')) : '?'; };
    const mo = new MutationObserver((list) => { for (const m of list) { const k = m.type + (m.attributeName ? ':' + m.attributeName : '') + ' ' + desc(m.target); counts[k] = (counts[k] || 0) + 1; } });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    setTimeout(() => { mo.disconnect(); res(counts); }, 1000);
  }));
  for (const [name, key] of [['SHOP', 'KeyE'], ['TANK', 'KeyT'], ['LAB', 'KeyS']]) {
    await page.keyboard.press(key); await page.waitForTimeout(1500);
    const c = await obs();
    const frames = 100;
    console.log(`--- ${name}: mutations in 1s (~${frames} frames), top 16`);
    Object.entries(c).filter(([k]) => !k.includes('perf-overlay')).sort((a, b) => b[1] - a[1]).slice(0, 16).forEach(([k, v]) => console.log(String(v).padStart(5), k));
    await page.keyboard.press(key); await page.waitForTimeout(800);
  }
  await h.browser.close();
})();
