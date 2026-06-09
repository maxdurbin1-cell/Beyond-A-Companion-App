// smoke-tests/combat-mode-interaction.smoke.mjs
// Playwright smoke test for VTT Combat Mode core interactions
// Ensures overlays, asset paint/spawn, draw drag, quick setup, and settings modal all work

import { test, expect } from '@playwright/test';

// Adjust the URL as needed for your local dev server or static preview
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080/index.html';

test.describe('Combat Mode Core Interactions', () => {
  test('Overlay/modal opens and closes', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('[data-test="open-settings"]');
    await expect(page.locator('.modal-content')).toBeVisible();
    await page.click('.modal-close');
    await expect(page.locator('.modal-content')).not.toBeVisible();
  });

  test('Asset paint and spawn', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('[data-test="open-asset-browser"]');
    await page.click('[data-test="asset-paint-mode"]');
    await page.mouse.move(300, 300);
    await page.mouse.down();
    await page.mouse.move(350, 350);
    await page.mouse.up();
    // Check for asset presence (icon or marker)
    await expect(page.locator('.scene-asset')).toBeVisible();
  });

  test('Drawing tool drag', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('[data-test="draw-tool"]');
    await page.mouse.move(400, 400);
    await page.mouse.down();
    await page.mouse.move(450, 450);
    await page.mouse.up();
    // Check for drawing presence
    await expect(page.locator('.scene-drawing')).toBeVisible();
  });

  test('Quick Setup: random template', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('[data-test="quick-setup"]');
    await page.click('[data-test="quick-setup-random"]');
    // Check for template presence (e.g., grid or assets)
    await expect(page.locator('.scene-template')).toBeVisible();
  });

  test('Settings modal opens from toolbar', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('[data-test="open-settings"]');
    await expect(page.locator('.modal-content')).toBeVisible();
  });
});
