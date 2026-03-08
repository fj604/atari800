import { test, expect } from '@playwright/test';

test('app loads and centered layout/canvas visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Atari800');
  await expect(page.locator('#canvas')).toBeVisible();
  const box = await page.locator('#displayWrap').boundingBox();
  expect(box).toBeTruthy();
  const viewport = page.viewportSize()!;
  const center = (box!.x + box!.width / 2);
  expect(Math.abs(center - viewport.width / 2)).toBeLessThan(40);
});

test('fullscreen, media UI, keyboard wiring, audio unlock', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#fileInput')).toBeAttached();

  await page.click('#audioBtn', { force: true });
  await expect.poll(async () => page.evaluate(() => !!window.__audioUnlocked)).toBeTruthy();

  await page.click('#fullscreenBtn', { force: true });
  await expect.poll(async () => page.evaluate(() => !!document.fullscreenElement)).toBeTruthy();
  await page.keyboard.press('Escape');

  await page.locator('#canvas').focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => page.evaluate(() => window.__lastKey)).toBe('ArrowUp');
});
