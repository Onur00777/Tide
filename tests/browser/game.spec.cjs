const { test, expect } = require('@playwright/test');
test('desktop renders every weather and region, survives reload, opens journal and map', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#weather-label')).toHaveText('Açık gece');
  await page.screenshot({ path: 'test-results/harbor.png' });
  await page.keyboard.press('m'); await expect(page.locator('#chart')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#chart')).not.toBeVisible();
  await page.evaluate(() => {
    game.harbor.crew = new Set(Object.keys(CREW)); game.harbor.projects = new Set(Object.keys(CREW));
    game.harbor.fittings = new Set(Object.keys(BOAT_UPGRADES)); game.harbor.tier = 3;
    game.harbor.relics = new Set(Object.keys(RELICS)); game.harbor.scrap = 40;
    game.configureBoat(); game.port.settle(game); game.persist(game.harbor);
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'test-results/harbor-developed.png' });
  for (const destination of ['oldtown', 'lighthouse', 'cathedral']) {
    await page.evaluate(id => {
      const gate = game.map.gates.find(g => g.region.id === id);
      Object.assign(game.boat, { x: gate.x, y: gate.y }); game.boat.stop(); game.interact();
      game.weather.kind = id === 'oldtown' ? 'fog' : 'storm'; game.weather.intensity = 1;
      game.boat.x = 750; game.boat.y = 65;
    }, destination);
    await page.waitForTimeout(350);
    await page.screenshot({ path: 'test-results/' + destination + '.png' });
  }
  await page.evaluate(() => {
    game.tide.index = 2; game.onPhaseChange(2); game.mode = 'foot';
    Object.assign(game.walker, {x: 760, y: 300});
    game.diving.enter(game, game.expedition.sites.find(s => s.cellar));
  });
  await page.waitForTimeout(200); await page.screenshot({ path: 'test-results/cellar.png' });
  await page.keyboard.press('e');
  expect(await page.evaluate(() => game.diving.active)).toBeNull();
  await page.reload(); await expect(page.locator('#final-beacon')).toBeVisible();
  await page.locator('#final-beacon').click(); expect(await page.evaluate(() => game.harbor.ending)).toBe(true);
  await page.locator('#collection-open').click(); await expect(page.locator('#collection')).toBeVisible();
  expect(await page.locator('#collection-items p').count()).toBe(16);
  expect(errors).toEqual([]);
});

test('mobile layout and reduced-motion rendering remain usable', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await expect(page.locator('#chart-open')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile.png' });
  await page.locator('#chart-open').click(); await expect(page.locator('#chart')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => { game.boat.x = 460; game.weather.kind = 'storm'; game.weather.flash = 1; });
  await page.waitForTimeout(100); await page.screenshot({ path: 'test-results/mobile-sea.png' });
  expect(errors).toEqual([]);
});
