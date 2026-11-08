// El Estudio: todo a mano en una pantalla, y lo que se toca suena y queda en el proyecto.
import { expect, test } from '@playwright/test';
import {
  clicks,
  countSounds,
  goto,
  gotoStudioEditing,
  openSection,
  plucks,
  watchErrors,
} from './fixtures/helpers';

const FITS = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 800 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
];

for (const viewport of FITS) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('abre para escuchar: las pistas a la vista y sin editores ni mezcla', async ({ page }) => {
      await goto(page, '/estudio');
      await expect(page.getByTestId('song-tracks')).toBeInViewport();
      await expect(page.locator('#song-edit')).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByTestId('song-drums')).toBeHidden();
      await expect(page.getByRole('button', { name: 'Silenciar Batería' })).toBeHidden();
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollHeight,
        client: document.documentElement.clientHeight,
      }));
      expect(scroll).toBeLessThanOrEqual(client);
    });

    test('entra entero: la página no se desplaza', async ({ page }) => {
      const errors = watchErrors(page);
      await gotoStudioEditing(page);
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollHeight,
        client: document.documentElement.clientHeight,
      }));
      expect(scroll).toBeLessThanOrEqual(client);
      await expect(page.locator('#song-play')).toBeInViewport();
      await expect(page.getByTestId('song-tracks')).toBeInViewport();
      await expect(page.getByTestId('song-drums')).toBeInViewport();
      expect(errors).toEqual([]);
    });
  });
}

test.describe('con todos los editores a la vista', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('no hace falta desplazar ningún panel', async ({ page }) => {
    await gotoStudioEditing(page);
    for (const panel of ['bateria', 'acordes', 'drone', 'letra', 'melodia']) {
      const locator = page.locator(`[data-panel="${panel}"]`);
      await expect(locator).toBeInViewport({ ratio: 1 });
      const { scroll, client } = await locator.evaluate((element) => ({
        scroll: element.scrollHeight,
        client: element.clientHeight,
      }));
      expect(scroll, panel).toBeLessThanOrEqual(client + 1);
    }
  });

  test('tocar programa sonido, y parar lo corta', async ({ page }) => {
    await countSounds(page);
    await gotoStudioEditing(page);
    await page.locator('[data-track="bombo"] [data-step="0"]').click();
    await page.locator('#song-play').click();
    await expect(page.getByRole('button', { name: 'Parar el tema' })).toBeVisible();
    await expect(page.getByTestId('playhead')).toBeVisible();
    await expect(page.getByTestId('song-position')).toContainText('cc');
    await expect.poll(() => plucks(page)).toBeGreaterThan(0);
    await expect.poll(() => clicks(page)).toBeGreaterThan(0);
    await page.locator('#song-play').click();
    await expect(page.getByTestId('playhead')).toBeHidden();
  });

  test('el metrónomo suelto se calla al tocar el tema', async ({ page }) => {
    await goto(page, '/ritmo');
    await page
      .getByRole('button', { name: /Tocar|Empezar/ })
      .first()
      .click();
    await expect(page.getByTestId('dock-ritmo')).toBeVisible();
    await openSection(page, 'Estudio');
    await editStudio(page);
    await page.locator('#song-play').click();
    await expect(page.getByTestId('dock-ritmo')).toBeHidden();
  });

  test('sigue sonando al navegar, y se para desde la barra de abajo', async ({ page }) => {
    await gotoStudioEditing(page);
    await page.locator('#song-play').click();
    await openSection(page, 'Cartas');
    const dock = page.getByTestId('dock-estudio');
    await expect(dock).toBeVisible();
    await dock.getByRole('button', { name: 'Parar el tema' }).click();
    await expect(dock).toBeHidden();
  });

  test('silenciar y hacer solo cambian lo que se oye', async ({ page }) => {
    await gotoStudioEditing(page);
    const mute = page.getByRole('button', { name: 'Silenciar Batería' });
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Batería del bloque 1' })).toHaveAttribute(
      'data-lane-off',
      'true',
    );
    await mute.click();
    const solo = page.getByRole('button', { name: 'Solo de Acordes' });
    await solo.click();
    await expect(page.getByRole('button', { name: 'Batería del bloque 1' })).toHaveAttribute(
      'data-lane-off',
      'true',
    );
    await expect(page.getByRole('button', { name: /^Acordes del bloque 1/ })).toHaveAttribute(
      'data-lane-off',
      'false',
    );
  });

  test('editar queda por sección, y sobrevive a recargar', async ({ page }) => {
    await goto(page, '/forma?f=AB');
    await openSection(page, 'Estudio');
    await editStudio(page);

    // Sección A
    await page.getByTestId('song-chords').fill('Dm G');
    await page.getByTestId('song-lyric').fill('Una línea de ocho sí');
    await page.locator('[data-track="caja"] [data-step="2"]').click();

    // Sección B: empieza de lo suyo.
    await page.getByRole('button', { name: /^Bloque 2/ }).click();
    await expect(page.getByTestId('form-title')).toContainText('Sección B');
    await expect(page.getByTestId('song-chords')).not.toHaveValue('Dm G');
    await expect(page.getByTestId('song-lyric')).toHaveValue('');

    await page.reload();
    await expect(page.getByTestId('song-tracks')).toBeVisible();
    await expect(page.getByTestId('lane-lyric').first()).toContainText('Una línea de ocho sí');
    await expect(page.getByRole('button', { name: /^Acordes del bloque 1/ })).toContainText('Dm');
  });

  test('cuenta las sílabas, y avisa de un acorde que no existe', async ({ page }) => {
    await gotoStudioEditing(page);
    await page.getByTestId('song-lyric').fill('Hola');
    await expect(page.getByTestId('song-lyric-count')).toContainText('Sílabas: 2');
    await page.getByTestId('song-chords').fill('Dm Qx7');
    await expect(page.getByText('No reconozco: Qx7')).toBeVisible();
    await page.getByTestId('song-chords').fill('Dm');
    await expect(page.getByRole('button', { name: /^Acordes del bloque 1/ })).toContainText('Dm');
  });

  test('la forma se edita ahí mismo y llega a Forma', async ({ page }) => {
    await gotoStudioEditing(page);
    await page.getByTestId('song-add-block').selectOption('C');
    await expect(page.getByRole('button', { name: /^Bloque 5: sección C/ })).toBeVisible();
    await expect(page.getByTestId('form-title')).toContainText('Sección C');
    await page.getByRole('button', { name: 'Más compases' }).click();
    await expect(page.getByTestId('section-bars')).toHaveText('5 cc');
    await page.getByRole('button', { name: 'Quitar el bloque' }).click();
    await expect(page.getByRole('button', { name: /^Bloque 5/ })).toHaveCount(0);
  });

  test('el drone se apaga por sección y su cambio llega a la consigna', async ({ page }) => {
    await gotoStudioEditing(page);
    const cell = page.getByRole('button', { name: 'Drone en la sección A, bloque 1' });
    await expect(cell).toHaveAttribute('aria-pressed', 'true');
    await cell.click();
    await expect(cell).toHaveAttribute('aria-pressed', 'false');
    // Las otras apariciones de la misma sección cambian juntas.
    await expect(page.getByRole('button', { name: 'Drone en la sección A, bloque 2' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await page.getByTestId('song-drone-stack').selectOption('tritono');
    await expect(page.getByTestId('song-drone')).toContainText('Tritono');
    await openSection(page, 'Consigna');
    await expect(page.locator('[data-row="drone"]')).toContainText('Tritono');
  });

  test('la barra espaciadora toca y para, salvo escribiendo', async ({ page }) => {
    await gotoStudioEditing(page);
    await page.locator('main h1').evaluate((element) => (element as HTMLElement).blur());
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Parar el tema' })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Tocar el tema' })).toBeVisible();
    await page.getByTestId('song-lyric').press('Space');
    await expect(page.getByRole('button', { name: 'Tocar el tema' })).toBeVisible();
  });
});

test.describe('en el celular más chico', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('una batería larga no achica las casillas', async ({ page }) => {
    await gotoStudioEditing(page);
    for (const steps of ['24', '32', '16']) {
      await page.getByTestId('song-drum-steps').selectOption(steps);
      const box = await page.locator('[data-track="bombo"] [data-step="0"]').boundingBox();
      expect(box!.width, `${steps} pasos`).toBeGreaterThanOrEqual(30);
      expect(box!.height, `${steps} pasos`).toBeGreaterThanOrEqual(40);
    }
  });
});

test.describe('en el celular', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('tocar una pista abre su editor', async ({ page }) => {
    await gotoStudioEditing(page);
    await expect(page.locator('[data-panel="bateria"]')).toBeVisible();
    await expect(page.locator('[data-panel="letra"]')).toBeHidden();
    await page.getByRole('button', { name: 'Editar Letra' }).click();
    await expect(page.locator('[data-panel="letra"]')).toBeVisible();
    await expect(page.locator('[data-panel="bateria"]')).toBeHidden();
    await page.getByRole('button', { name: 'Editar Forma' }).click();
    await expect(page.getByTestId('song-add-block')).toBeVisible();
  });

  test('muchos bloques se desplazan dentro de las pistas, no la página', async ({ page }) => {
    await goto(page, '/forma?f=ABCDEFGHABCDEFGH');
    await page.getByRole('button', { name: 'Menú' }).click();
    await openSection(page, 'Estudio');
    await editStudio(page);
    await expect(page.getByTestId('song-tracks')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
