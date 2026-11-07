// Capturas para revisar a ojo. Solo corre con SCREENSHOTS=1: no es una prueba, es una ayuda.
import { test } from '@playwright/test';
import { goto } from './fixtures/helpers';

const SCREENS: Array<[string, string, number, number, 'light' | 'dark']> = [
  ['inicio-phone', '/', 390, 844, 'light'],
  ['inicio-desktop', '/', 1280, 800, 'light'],
  ['hub-phone', '/consigna', 390, 844, 'light'],
  ['estudio-phone', '/estudio', 390, 844, 'light'],
  ['estudio-desktop', '/estudio', 1280, 800, 'light'],
  ['estudio-desktop-dark', '/estudio', 1920, 1080, 'dark'],
  ['estudio-notebook', '/estudio', 1024, 768, 'light'],
  [
    'drums-phone',
    '/ritmo?m=drum&bpm=112&n=16&p=1000000010100000_0000100000001000_1010101010101010_0000000000000000_0000000000000000_0000000000000000&l=80_80_80_80_80_80',
    390,
    844,
    'light',
  ],
  [
    'drums-desktop',
    '/ritmo?m=drum&bpm=112&n=16&p=1000000010100000_0000100000001000_1010101010101010_0000000000000000_0000000000000000_0000000000000000&l=80_80_80_80_80_80',
    1280,
    800,
    'dark',
  ],
  ['hub-desktop', '/consigna', 1280, 800, 'dark'],
  ['drone-phone', '/drone', 390, 844, 'dark'],
  ['consigna-phone', '/', 390, 844, 'light'],
  ['afinador-phone', '/afinador/opend', 390, 844, 'light'],
  ['armonia-phone', '/armonia?c=Am,F7,Bbsus2,Ebmaj7', 390, 844, 'light'],
  ['melodia-phone', '/melodia', 360, 740, 'dark'],
  ['letras-phone', '/letras', 390, 844, 'light'],
  ['forma-phone', '/forma?f=AABCA', 390, 844, 'light'],
  ['diario-phone', '/diario', 390, 844, 'dark'],
  ['ritmo-phone', '/ritmo', 320, 568, 'light'],
  ['armonia-desktop', '/armonia?c=Am,F7,Bbsus2,Ebmaj7', 1280, 800, 'light'],
  ['melodia-desktop', '/melodia', 1280, 800, 'light'],
  ['forma-desktop', '/forma?f=AABCA', 1280, 800, 'dark'],
  ['afinador-desktop', '/afinador/dadgad', 1280, 800, 'light'],
  ['drone-desktop', '/drone', 1280, 800, 'light'],
  ['cartas-desktop', '/cartas', 1280, 800, 'dark'],
  ['letras-desktop', '/letras', 1280, 800, 'light'],
  ['diario-desktop', '/diario', 1280, 800, 'light'],
];

test.skip(!process.env.SCREENSHOTS, 'Solo con SCREENSHOTS=1');

for (const [name, path, width, height, colorScheme] of SCREENS) {
  test(name, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme });
    await goto(page, path);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true });
  });
}

test('menu-phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, '/');
  await page.getByRole('button', { name: 'Menú' }).click();
  await page.screenshot({ path: 'test-results/screens/menu-phone.png' });
});

test('collapsed-desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await goto(page, '/afinador/dadgad');
  await page.getByRole('button', { name: 'Colapsar la barra lateral' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/screens/collapsed-desktop.png' });
});

test('letras-llena', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, '/letras');
  await page
    .getByTestId('lyric-text')
    .fill(
      'En un lugar de la Mancha\nde cuyo nombre no quiero\nacordarme, y a la orilla\nCaminante no hay camino',
    );
  await page.screenshot({ path: 'test-results/screens/letras-llena.png', fullPage: true });
});

test('dock-phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, '/consigna');
  await page.locator('[data-row="ritmo"]').getByRole('button', { name: 'Oír el ritmo' }).click();
  await page.locator('[data-row="drone"]').getByRole('button', { name: 'Sostener el drone' }).click();
  await page.locator('[data-row="ritmo"]').getByRole('button', { name: 'Parar el ritmo' }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/screens/dock-phone.png' });
});
