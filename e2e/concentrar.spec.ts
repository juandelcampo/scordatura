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
    await expect(nav.getByRole('listitem')).toHaveCount(4);
    await expect(nav.getByRole('link', { name: 'Herramientas', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await goto(page, '/estudio');
    await expect(nav.getByRole('link', { name: 'Consigna', exact: true })).toHaveAttribute(
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

  test('cada fila abre su herramienta', async ({ page }) => {
    await goto(page, '/');
    await page.getByRole('link', { name: 'Abrir Letra →' }).click();
    await expect(page).toHaveURL(/\/letras/);
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

test.describe('carta suelta', () => {
  test('saca una carta sin tocar la consigna, y se puede sumar a ella', async ({ page }) => {
    await goto(page, '/');
    await expect(page).toHaveURL(/\?t=/);
    const before = await page.locator('[data-row="ritmo"] p').first().textContent();
    await page.locator('#loose-card').click();
    const card = page.getByTestId('loose-card');
    await expect(card).toBeVisible();
    const text = await card.locator('p').first().textContent();
    await expect(page.locator('[data-row="ritmo"] p').first()).toHaveText(before!);

    await card.getByRole('button', { name: 'Ponerla en la consigna' }).click();
    await expect(card).toBeHidden();
    await expect(page.locator('[data-row="carta"] p').first()).toContainText(text!);
    await expect(page.getByRole('button', { name: 'Destrabar Carta' })).toBeVisible();
  });
});
