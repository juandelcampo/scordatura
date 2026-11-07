import { expect, test } from '@playwright/test';
import { goto, watchErrors } from './fixtures/helpers';
import { micWith } from './fixtures/mic';

test.use(micWith('c2-sharp20.wav'));

test('con un C2 20 cents agudo, lee el desvío e indica bajar', async ({ page }) => {
  const errors = watchErrors(page);
  await goto(page, '/afinador/cgcfce');
  await page.locator('#mic-toggle').click();
  await expect(page.getByTestId('meter-status')).toHaveText(/Bajá/, { timeout: 5000 });
  const cents = Number(await page.getByTestId('meter').getAttribute('data-cents'));
  expect(Math.abs(cents - 20)).toBeLessThan(3);
  expect(errors).toEqual([]);
});
