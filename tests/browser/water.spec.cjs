const { test, expect } = require('@playwright/test');

test('GLSL compiles, draws nonuniform water, follows the camera and recovers context', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.waitForFunction(() => typeof ocean !== 'undefined' && game.time > 0);
  const surface = await page.evaluate(() => {
    const gl = ocean.gl; ocean.draw(game, camera);
    const pixels = new Uint8Array(16 * 16 * 4);
    gl.readPixels(0, 0, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return { mode: ocean.mode, reason: ocean.reason, error: gl.getError(), colors: new Set(Array.from(pixels)).size };
  });
  expect(surface.mode, surface.reason).toBe('webgl'); expect(surface.error).toBe(0); expect(surface.colors).toBeGreaterThan(8);
  await page.setViewportSize({ width: 900, height: 700 });
  await page.evaluate(() => { game.boat.x = 480; game.boat.y = 150; game.harbor.fittings.add('lantern'); });
  await page.waitForTimeout(200);
  const cameraState = await page.evaluate(() => ({ css: document.getElementById('ocean-gl').getBoundingClientRect().width, width: camera.width, uniforms: Array.from(ocean.gl.getUniform(ocean.program, ocean.uniforms.camera)), expected: [camera.left, camera.top, camera.scale] }));
  expect(cameraState.css).toBe(cameraState.width);
  cameraState.uniforms.forEach((value, i) => expect(value).toBeCloseTo(cameraState.expected[i], 3));
  await page.evaluate(() => { window.lostExtension = ocean.gl.getExtension('WEBGL_lose_context'); window.lostExtension.loseContext(); });
  await page.waitForFunction(() => ocean.mode === 'fallback');
  await expect(page.locator('#ocean-fallback')).toBeVisible();
  await page.evaluate(() => window.lostExtension.restoreContext());
  await page.waitForFunction(() => ocean.mode === 'webgl');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => ocean.gl.getError())).toBe(0);
  expect(errors).toEqual([]);
});

test('no WebGL produces animated procedural water without changing gameplay', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, options) { return type.startsWith('webgl') ? null : original.call(this, type, options); };
  });
  await page.goto('/'); await page.waitForFunction(() => typeof ocean !== 'undefined' && game.time > 0);
  expect(await page.evaluate(() => ocean.mode)).toBe('fallback');
  await expect(page.locator('#ocean-fallback')).toBeVisible();
  const sample = await page.evaluate(() => {
    const a = ocean.pixels.data.slice(); const tide = game.tide.index;
    game.time += 2; ocean.draw(game, camera);
    return { changed: a.some((n, i) => n !== ocean.pixels.data[i]), tide: game.tide.index === tide, values: new Set(Array.from(ocean.pixels.data)).size };
  });
  expect(sample.changed).toBe(true); expect(sample.tide).toBe(true); expect(sample.values).toBeGreaterThan(30);
  await page.screenshot({ path: 'test-results/water-fallback.png' });
});
