const { test, expect } = require('@playwright/test');

test('page loads and canvas visible with startup asset', async ({ page }) => {
  await page.goto('/atari800.html');
  await expect(page.locator('#canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__a8StartupReady)).toBeTruthy();
  await expect(page.locator('#status')).toContainText('Altirra default ROM');
});


test('runtime stays alive without Emscripten exit error', async ({ page }) => {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto('/atari800.html');
  await expect.poll(() => page.evaluate(() => window.__a8StartupReady)).toBeTruthy();
  await page.waitForTimeout(1500);
  expect(errors.filter(e => e.includes('program exited')).length).toBe(0);
});

test('centered layout, fullscreen, import ui and keyboard path', async ({ page }) => {
  await page.goto('/atari800.html');
  const centered = await page.evaluate(() => {
    const c = document.getElementById('canvas').getBoundingClientRect();
    return Math.abs((window.innerWidth / 2) - (c.left + c.width / 2)) < 30;
  });
  expect(centered).toBeTruthy();
  await expect(page.locator('#media-import')).toBeAttached();
  await page.keyboard.press('KeyA');
  await expect.poll(() => page.evaluate(() => window.__a8LastKey)).toContain('KeyA');
  await page.locator('#fullscreen-btn').click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBeTruthy();
});

test('audio unlock and responsive ui', async ({ page }) => {
  await page.goto('/atari800.html');
  await page.locator('#audio-unlock').click();
  expect(await page.evaluate(() => window.__a8AudioUnlocked)).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#fullscreen-btn')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator('#refresh-library')).toBeVisible();
});

test('touch controls appear and emit input on touch device', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 820, height: 1180 }, isMobile: true });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/atari800.html');
  await expect(page.locator('#touch-controls')).toBeVisible();
  await page.locator('#touch-controls .fire').dispatchEvent('pointerdown', { pointerId: 1 });
  await page.locator('#touch-controls .fire').dispatchEvent('pointerup', { pointerId: 1 });
  await expect.poll(() => page.evaluate(() => window.__a8LastKey)).toContain('ControlLeft');
  await context.close();
});
