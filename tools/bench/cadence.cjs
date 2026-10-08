const { chromium } = require('./pw.cjs');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist', '--disable-renderer-backgrounding'] });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 950 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8080/?perf', { waitUntil: 'domcontentloaded' });
  const fps = async () => { await page.waitForTimeout(1600); return page.evaluate(() => (document.getElementById('perf-overlay').textContent.match(/([\d.]+) fps/) || [])[1]); };
  // title screen (click once to pass the click-to-begin gate, wait for the title to be up)
  for (let gi = 0; gi < 60 && (await page.$('#start-overlay.hidden') || !(await page.$('#start-overlay'))); gi++) { await page.waitForTimeout(400); await page.mouse.click(8, 8); }
  await page.waitForTimeout(2500);
  console.log('title screen     render fps:', await fps(), '(display is 100Hz; title should render every display frame)');
  await page.click('text=New Game'); await page.waitForTimeout(800); await page.click('#start-mode-exp-btn'); await page.waitForTimeout(3500);
  for (let i = 0; i < 3 && !(await page.isVisible('#pause-save-btn')); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
  for (let i = 0; i < 3 && (await page.isVisible('#pause-save-btn')); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  console.log('in game, 1x      render fps:', await fps(), '(sim is 60Hz; expect ~60)');
  await page.keyboard.press('KeyX'); console.log('in game, 2x speed render fps:', await fps(), '(2 steps per step interval; expect every display frame)'); await page.keyboard.press('KeyX');
  for (let i = 0; i < 6; i++) await page.keyboard.press('Minus'); // debug time scale to 0x — update() never runs
  console.log('debug 0x (no steps) render fps:', await fps(), '(fallback keeps UI/hover alive; expect ~30)');
  for (let i = 0; i < 6; i++) await page.keyboard.press('Equal');
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  console.log('pause menu open  render fps:', await fps());
  console.log('page errors:', errors);
  await browser.close();
})();
