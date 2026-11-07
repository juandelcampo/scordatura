// Prueba con el YouTube real. Depende de la red, así que solo corre con LIVE=1.
import { expect, test } from '@playwright/test';
import { goto, watchErrors } from './fixtures/helpers';

test.skip(!process.env.LIVE, 'Solo con LIVE=1');
test.use({ viewport: { width: 1280, height: 800 } });

test('marcar el minuto de una sección y saltar a ella', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = watchErrors(page);
  await goto(page, '/forma');
  await page.getByRole('button', { name: 'Oír Yesterday' }).click();

  const frame = page.frameLocator('iframe[src*="embed/NrgmdOz227I"]');
  const video = frame.locator('video');
  await expect(video).toBeAttached({ timeout: 20_000 });
  const time = () => video.evaluate((element: HTMLVideoElement) => element.currentTime);
  await expect.poll(time, { timeout: 20_000 }).toBeGreaterThan(5);

  await page.getByRole('button', { name: 'Marcar minutos' }).click();
  const block = page.getByRole('button', { name: /^B, bloque 3/ });
  await block.click();
  const marked = /en (\d+):(\d+)/.exec((await block.getAttribute('aria-label'))!)!;
  const seconds = Number(marked[1]) * 60 + Number(marked[2]);
  expect(seconds).toBeGreaterThan(4);

  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'Terminar de marcar' }).click();
  await block.click();
  await expect.poll(time, { timeout: 5000 }).toBeLessThan(seconds + 2.5);

  await page.reload();
  await page.getByRole('button', { name: 'Oír Yesterday' }).click();
  await expect(page.getByRole('button', { name: /^B, bloque 3, en/ })).toBeVisible();
  expect(errors).toEqual([]);
});
