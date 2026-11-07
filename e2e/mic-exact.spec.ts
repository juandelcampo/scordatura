import { expect, test } from '@playwright/test';
import { goto } from './fixtures/helpers';
import { micWith } from './fixtures/mic';

test.use(micWith('c2-exact.wav'));

test('con un C2 exacto, marca la cuerda afinada y pasa a la siguiente', async ({ page }) => {
  await goto(page, '/afinador/cgcfce');
  await page.locator('#mic-toggle').click();
  const pills = page.locator('[class*="pill_"][aria-pressed]');
  await expect(pills.nth(0)).toHaveAttribute('data-tuned', 'true', { timeout: 5000 });
  await expect(pills.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#mic-toggle').click();
  await expect(page.locator('#mic-toggle')).toHaveText('Activar micrófono');
});
