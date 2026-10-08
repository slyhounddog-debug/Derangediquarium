const { openGame, measureWindow } = require('./lib.cjs');
(async () => {
  for (const clear of [false, true]) {
    const h = await openGame({ fixture: 'stress.json' });
    if (clear) await h.page.keyboard.press('KeyK');
    await h.page.waitForTimeout(4000);
    const m = await measureWindow(h, 6);
    const g = (k) => m.phases[k] ?? '-';
    console.log(clear ? 'LIVE, items cleared (K)' : 'LIVE, 1000 items      ', `interval ${m.intervalAvg}ms  main ${m.mainTask}ms  F3 update ${m.updateMs} render ${m.renderMs}  | mask copy ${g('r: caustic: mask copy of foreground')}  items ${g('r: items')}  fish ${g('r: fish + overlays')}  | items now ${m.objects.itemsEnd}`);
    await h.browser.close();
  }
})();
