// Lo que usa el micrófono fuera del afinador: grabar ideas, transcribir y el ritmo del habla.
import { expect, test } from '@playwright/test';
import { goto, watchErrors } from './fixtures/helpers';
import { micWith } from './fixtures/mic';

test.use({ ...micWith('a3-exact.wav'), viewport: { width: 1280, height: 800 } });

test('grabar una idea la guarda en el diario con su consigna y su sección', async ({ page }) => {
  const errors = watchErrors(page);
  await goto(page, '/consigna');
  await expect(page).toHaveURL(/\?t=/);
  await page.locator('#record').click();
  await expect(page.locator('#record')).toContainText('Terminar');
  await page.waitForTimeout(1200);
  await page.locator('#record').click();
  await expect(page.getByText('Guardada en el diario.')).toBeVisible();

  await page.getByRole('navigation', { name: 'Herramientas' }).getByRole('link', { name: 'Diario' }).click();
  const entry = page.getByTestId('entry').first();
  await expect(entry).toBeVisible();
  await expect(entry).toContainText(/Consigna Nº \w+/);
  await expect(entry).toContainText('Sección A');
  const audioSize = await entry
    .locator('audio')
    .evaluate(async (audio: HTMLAudioElement) => (await (await fetch(audio.src)).blob()).size);
  expect(audioSize).toBeGreaterThan(1000);

  // Sobrevive a recargar, y la nota también.
  await entry.getByLabel('Nota').fill('Riff en 7/8');
  await entry.getByLabel('Nota').blur();
  await page.waitForTimeout(200);
  await page.reload();
  await expect(page.getByTestId('entry').first().getByLabel('Nota')).toHaveValue('Riff en 7/8');

  // Desde el diario se vuelve a la consigna donde nació.
  const number = /Consigna Nº (\w+)/.exec((await page.getByTestId('entry').first().textContent())!)![1]!;
  await page
    .getByTestId('entry')
    .first()
    .getByRole('link', { name: /Consigna Nº/ })
    .click();
  await expect(page.getByText(`Consigna Nº ${number}`)).toBeVisible();

  await page.getByRole('navigation', { name: 'Herramientas' }).getByRole('link', { name: 'Diario' }).click();
  await page.getByRole('button', { name: /Borrar Idea/ }).click();
  await expect(page.getByTestId('entry')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('se puede guardar la consigna sin grabar nada', async ({ page }) => {
  await goto(page, '/consigna');
  await expect(page).toHaveURL(/\?t=/);
  await page.getByRole('navigation', { name: 'Herramientas' }).getByRole('link', { name: 'Diario' }).click();
  await page.locator('#save-consigna').click();
  await expect(page.getByTestId('entry').first()).toHaveAttribute('data-kind', 'consigna');
});

test('cantar transcribe la nota que entra por el micrófono', async ({ page }) => {
  const errors = watchErrors(page);
  await goto(page, '/melodia');
  await page.getByRole('button', { name: 'Voz' }).click();
  await page.locator('#sing').click();
  await expect(page.locator('#sing')).toContainText('Escuchando');
  await expect(page.locator('#sing')).toHaveText('● Cantar', { timeout: 10000 });
  await expect(page.getByTestId('note-names')).toHaveText('A3');
  expect(errors).toEqual([]);
});

test('hablar devuelve una grilla sin romperse', async ({ page }) => {
  const errors = watchErrors(page);
  await goto(page, '/melodia');
  await page.getByRole('button', { name: 'Voz' }).click();
  await page.locator('#speak').click();
  await expect(page.locator('#speak')).toContainText('Escuchando');
  await expect(page.locator('#speak')).toHaveText('● Hablar', { timeout: 10000 });
  await expect(page.getByTestId('speech-grid')).toBeAttached();
  expect(errors).toEqual([]);
});
