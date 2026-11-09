// La biblioteca de formas y el vocabulario de Forma.
import { expect, test } from '@playwright/test';
import { goto, watchErrors } from './fixtures/helpers';

test.use({ viewport: { width: 1280, height: 800 } });

test('la biblioteca cambia de familia, usa una forma y se puede volver', async ({ page }) => {
  const errors = watchErrors(page);
  await goto(page, '/forma?f=AB');
  const title = page.getByRole('heading', { level: 1 });
  const library = page.getByTestId('form-library');

  await page.getByRole('button', { name: 'Usar la forma Con puente' }).click();
  await expect(title).toHaveText('ABABCB');
  await expect(page.getByTestId('form-rule')).toContainText('Con puente.');

  await page
    .getByRole('group', { name: 'Familia de formas' })
    .getByRole('button', { name: 'Latinoamérica' })
    .click();
  await expect(library.getByRole('heading', { name: 'Zamba' })).toBeVisible();
  await expect(library.getByRole('heading', { name: 'Con puente' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Usar la forma Zamba' }).click();
  await expect(title).toHaveText('ABBCABBC');

  await page.locator('#undo-form').click();
  await expect(title).toHaveText('ABABCB');
  await page.locator('#undo-form').click();
  await expect(title).toHaveText('AB');

  await expect(page.getByRole('heading', { name: 'Vocabulario' })).toBeVisible();
  await expect(page.getByText('pre-chorus')).toBeVisible();
  expect(errors).toEqual([]);
});

test('en el teléfono la biblioteca no desborda la página', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await goto(page, '/forma');
  await page.getByRole('button', { name: 'Electrónica, rap y baile' }).click();
  await expect(page.getByRole('heading', { name: 'Pop coreano' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
