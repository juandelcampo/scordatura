// El camino de una sesión: se entra por la consigna, se escucha, se baja, y las herramientas son un desvío.
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { goto, openSection, watchErrors } from './fixtures/helpers';

test.use({ viewport: { width: 1280, height: 800 } });

test.describe('la consigna es la entrada', () => {
  test('la primera pantalla es una consigna ya sorteada, y su link funciona', async ({ page, context }) => {
    const errors = watchErrors(page);
    await goto(page, '/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Consigna');
    await expect(page).toHaveURL(/\/\?t=/);
    const rule = await page.locator('[data-row="ritmo"] p').first().textContent();

    const other = await context.newPage();
    await goto(other, page.url());
    await expect(other.locator('[data-row="ritmo"] p').first()).toHaveText(rule!);
    expect(errors).toEqual([]);
  });

  test('un link viejo a /consigna abre la misma consigna', async ({ page }) => {
    await goto(page, '/');
    await expect(page).toHaveURL(/\?t=/);
    const code = new URL(page.url()).searchParams.get('t')!;
    const value = await page.locator('[data-row="armonia"] p').first().textContent();
    await page.evaluate(() => localStorage.clear());
    await goto(page, `/consigna?t=${encodeURIComponent(code)}`);
    await expect(page.locator('[data-row="armonia"] p').first()).toHaveText(value!);
  });

  test('el menú tiene tres entradas, y marca dónde cuelga cada pantalla', async ({ page }) => {
    await goto(page, '/ritmo');
    const nav = page.getByRole('navigation', { name: 'Principal' });
    await expect(nav.getByRole('listitem')).toHaveCount(3);
    await expect(nav.getByRole('link', { name: 'Herramientas', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await goto(page, '/estudio');
    await expect(nav.getByRole('link', { name: 'Sorteo', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('toda herramienta tiene el camino de vuelta a la consigna', async ({ page }) => {
    await goto(page, '/');
    await openSection(page, 'Letras');
    await expect(page).toHaveURL(/\/letras/);
    await page.getByRole('link', { name: '← Consigna' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Consigna');
  });

  test('cada fila abre su herramienta encima de la consigna, y al cerrarla se vuelve igual', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await goto(page, '/');
    await expect(page).toHaveURL(/\?t=/);
    const home = page.url();
    await page.getByRole('link', { name: 'Abrir Letra' }).click();
    await expect(page).toHaveURL(/\/letras/);
    const modal = page.getByTestId('tool-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { level: 1 })).toHaveText('Letras');

    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    await expect(page).toHaveURL(home);

    // "Atrás" también cierra, y "Pantalla completa" la deja como página.
    await page.getByRole('link', { name: 'Abrir Ritmo' }).click();
    await expect(modal).toBeVisible();
    await page.goBack();
    await expect(modal).toHaveCount(0);
    await page.getByRole('link', { name: 'Abrir Forma' }).click();
    await modal.getByRole('button', { name: 'Pantalla completa' }).click();
    await expect(modal).toHaveCount(0);
    await expect(page).toHaveURL(/\/forma/);
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Consigna');
    expect(errors).toEqual([]);
  });

  test('lo que se elige en la herramienta llega a la tarjeta de atrás', async ({ page }) => {
    await goto(page, '/');
    await page.getByRole('link', { name: 'Abrir Forma' }).click();
    const modal = page.getByTestId('tool-modal');
    await modal.getByRole('button', { name: 'Agregar sección C' }).click();
    await page.locator('#tool-close').click();
    await expect(page.locator('[data-row="forma"]')).toHaveAttribute('data-chosen', 'true');
    await expect(page).toHaveURL(/\/\?t=/);
  });

  test('en una pantalla de escritorio, las ocho tarjetas entran sin desplazarse', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await goto(page, '/');
    const rows = page.locator('[data-row]');
    await expect(rows).toHaveCount(8);
    // Según el texto que toque, alguna tarjeta puede crecer unos píxeles: la grilla se desplaza, la página no.
    for (const row of await rows.all()) await expect(row).toBeInViewport({ ratio: 0.9 });
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight - innerHeight),
    ).toBeLessThanOrEqual(0);
  });
});

test.describe('de la consigna al Estudio', () => {
  test('"Escuchar todo" lleva al Estudio, que abre para escuchar', async ({ page }) => {
    await goto(page, '/');
    await page.getByTestId('listen').click();
    await expect(page).toHaveURL(/\/estudio/);
    await page.locator('#song-play').click();
    await expect(page.getByRole('button', { name: 'Parar el tema' })).toBeVisible();
    await page.getByRole('button', { name: 'Parar el tema' }).click();
    await expect(page.getByTestId('song-drums')).toBeHidden();
  });

  test('tocar una pista abre su editor, y la preferencia se recuerda', async ({ page }) => {
    await goto(page, '/estudio');
    await page.getByRole('button', { name: 'Editar Letra' }).click();
    await expect(page.locator('#song-edit')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-panel="letra"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('#song-edit')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#song-edit').click();
    await expect(page.locator('[data-panel="letra"]')).toBeHidden();
  });
});

test.describe('la idea sale de la app', () => {
  for (const route of ['/', '/estudio']) {
    test(`baja un MIDI válido desde ${route}`, async ({ page }) => {
      await goto(page, route);
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#export-midi').click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^scordatura-consigna-.+\.mid$/);
      const bytes = await readFile(await download.path());
      expect(bytes.subarray(0, 4).toString('latin1')).toBe('MThd');
      expect(bytes.includes('MTrk', 0, 'latin1')).toBe(true);
    });
  }

  test('la hoja lleva lo que hay que respetar, y no los controles', async ({ page }) => {
    await goto(page, '/');
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('navigation', { name: 'Principal' })).toBeHidden();
    await expect(page.locator('#roll')).toBeHidden();
    await expect(page.locator('#export-midi')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Trabar Ritmo' })).toBeHidden();
    await expect(page.locator('[data-row="ritmo"] p').first()).toBeVisible();
    await expect(page.getByText('Para volver a abrirla')).toBeVisible();

    const pdf = await page.pdf({ format: 'A4' });
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });
});

test.describe('armonía por grados', () => {
  test('cambiar la tónica transpone los acordes y deja los grados', async ({ page }) => {
    await goto(page, '/armonia?c=C,Am&k=0&m=ionian');
    await page.getByRole('button', { name: 'Sumar F', exact: true }).click();
    await goto(page, '/consigna');
    const harmony = page.locator('[data-row="armonia"]');
    const chords = harmony.getByTestId('mini-chord-name');
    await expect(harmony.getByTestId('mini-degrees')).toHaveText('I – vi – IV');
    await expect(chords).toHaveText(['C', 'Am', 'F']);
    await harmony.getByRole('button', { name: 'Tónica D', exact: true }).click();
    await expect(chords).toHaveText(['D', 'Bm', 'G']);
    await expect(harmony.getByTestId('mini-degrees')).toHaveText('I – vi – IV');
    await expect(harmony.getByRole('button', { name: 'Tónica D', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Queda trabada como tu elección, y sobrevive a recargar.
    await expect(harmony.getByRole('button', { name: 'Destrabar Armonía' })).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-row="armonia"]').getByTestId('mini-chord-name')).toHaveText([
      'D',
      'Bm',
      'G',
    ]);
  });
});

test.describe('la consigna de arriba', () => {
  test('se cambia ahí mismo, sin abrir nada encima, y no toca lo demás', async ({ page }) => {
    await goto(page, '/');
    await expect(page).toHaveURL(/\?t=/);
    const band = page.locator('[data-row="carta"]');
    await expect(band.getByRole('heading', { level: 2 })).toHaveText('Consigna');
    await expect(band.getByRole('link')).toHaveCount(0);
    const before = await band.locator('p').first().textContent();
    const rhythm = await page.locator('[data-row="ritmo"] p').first().textContent();

    await band.getByRole('button', { name: 'Sacar otra consigna' }).click();
    await expect(band.locator('p').first()).not.toHaveText(before!);
    await expect(page.locator('[data-row="ritmo"] p').first()).toHaveText(rhythm!);
    await expect(page.getByTestId('tool-modal')).toHaveCount(0);
  });
});
