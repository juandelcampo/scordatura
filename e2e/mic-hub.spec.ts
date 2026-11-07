import { expect, test } from '@playwright/test';
import { goto } from './fixtures/helpers';
import { micWith } from './fixtures/mic';

test.use({ ...micWith('a3-exact.wav'), viewport: { width: 1280, height: 800 } });

test('el afinador de la consigna escucha sin salir de la pantalla, y solo pide el micrófono al usarlo', async ({
  page,
}) => {
  await goto(page, '/consigna');
  await expect(page.getByTestId('mini-tuner')).toHaveCount(0);
  await page.getByRole('button', { name: 'Afinar con el micrófono' }).click();
  const status = page.getByTestId('mini-tuner-status');
  await expect(status).toHaveText(/Subí|Bajá|Afinada/, { timeout: 8000 });
  await page.getByRole('button', { name: 'Cerrar afinador' }).click();
  await expect(page.getByTestId('mini-tuner')).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe('/consigna');
});
