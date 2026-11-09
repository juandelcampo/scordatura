// Clic derecho y doble clic: atajos sobre cada cosa de la consigna y de la forma.
import { expect, test, type Page } from '@playwright/test';
import { goto, watchErrors } from './fixtures/helpers';

test.use({ viewport: { width: 1280, height: 800 } });

const row = (page: Page, id: string) => page.locator(`[data-row="${id}"]`);
const menu = (page: Page) => page.getByTestId('context-menu');

test.describe('clic derecho y doble clic', () => {
  test('una tarjeta tiene su menú: trabar, cambiar y cerrar con Escape', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/');
    await expect(page).toHaveURL(/\?t=/);
    const ritmo = row(page, 'ritmo');
    await ritmo.locator('p').first().click({ button: 'right' });
    await expect(menu(page)).toBeVisible();
    await expect(menu(page)).toHaveAttribute('aria-label', 'Ritmo');
    await expect(menu(page).getByRole('menuitem', { name: 'Abrir Ritmo ↗' })).toBeVisible();
    await expect(menu(page).getByRole('menuitem', { name: '▶ Oír' })).toBeVisible();

    await menu(page).getByRole('menuitemcheckbox', { name: 'Trabada' }).click();
    await expect(menu(page)).toBeHidden();
    await expect(ritmo).toHaveAttribute('data-locked', 'true');

    await ritmo.locator('p').first().click({ button: 'right' });
    await expect(menu(page).getByRole('menuitemcheckbox', { name: 'Trabada' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.keyboard.press('Escape');
    await expect(menu(page)).toBeHidden();

    const before = await row(page, 'drone').locator('p').first().textContent();
    let after = before;
    for (let i = 0; i < 6 && after === before; i++) {
      await row(page, 'drone').locator('p').first().click({ button: 'right' });
      await menu(page).getByRole('menuitem', { name: 'Cambiar', exact: true }).click();
      after = await row(page, 'drone').locator('p').first().textContent();
    }
    expect(after).not.toBe(before);
    expect(errors).toEqual([]);
  });

  test('doble clic en una tarjeta abre su herramienta encima', async ({ page }) => {
    await goto(page, '/');
    await expect(page).toHaveURL(/\?t=/);
    await row(page, 'drone').locator('p').first().dblclick();
    await expect(page).toHaveURL(/\/drone/);
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('en el fondo, el menú de toda la consigna', async ({ page }) => {
    await goto(page, '/');
    await expect(page).toHaveURL(/\?t=/);
    const first = new URL(page.url()).searchParams.get('t');
    await page.getByRole('heading', { level: 1 }).click({ button: 'right' });
    await menu(page).getByRole('menuitem', { name: 'Nueva consigna' }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('t')).not.toBe(first);
    await page.getByRole('heading', { level: 1 }).click({ button: 'right' });
    await menu(page).getByRole('menuitem', { name: '↩ Volver a la anterior' }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('t')).toBe(first);
  });

  test('un acorde se traba con doble clic, y se mueve o se quita desde su menú', async ({ page }) => {
    await goto(page, '/');
    await expect(page).toHaveURL(/\?t=/);
    const harmony = row(page, 'armonia');
    const names = harmony.getByTestId('mini-chord-name');
    const chords = await names.allTextContents();
    expect(chords.length).toBeGreaterThan(1);

    await harmony.getByRole('button', { name: `Oír ${chords[0]}`, exact: true }).dblclick();
    await expect(harmony.getByRole('button', { name: `Destrabar ${chords[0]}` })).toBeVisible();

    await names.nth(0).click({ button: 'right' });
    await menu(page).getByRole('menuitem', { name: 'Después →' }).click();
    await expect(names).toHaveText([chords[1]!, chords[0]!, ...chords.slice(2)]);
    // El candado viaja con su acorde.
    await expect(harmony.getByRole('button', { name: `Destrabar ${chords[0]}` })).toBeVisible();

    if (chords.length > 2) {
      await names.nth(1).click({ button: 'right' });
      await menu(page).getByRole('menuitem', { name: 'Quitar de la progresión' }).click();
      await expect(names).toHaveText([chords[1]!, ...chords.slice(2)]);
    }
  });

  test('un acorde de afuera entra con doble clic', async ({ page }) => {
    await goto(page, '/');
    await expect(page).toHaveURL(/\?t=/);
    const harmony = row(page, 'armonia');
    const names = harmony.getByTestId('mini-chord-name');
    const count = await names.count();
    const spare = harmony.getByTestId('mini-outside').getByRole('button', { name: /^Oír / }).first();
    test.skip((await spare.count()) === 0, 'la progresión ya usa todos los grados');
    await spare.dblclick();
    await expect(names).toHaveCount(count + 1);
  });

  test('un bloque de la forma: doble clic lo elige y suena desde ahí; su menú suma compases', async ({
    page,
  }) => {
    await goto(page, '/');
    await expect(page).toHaveURL(/\?t=/);
    const form = row(page, 'forma');
    const block = form.getByTestId('form-strip').getByRole('button').first();
    await block.dblclick();
    await expect(block).toHaveAttribute('aria-pressed', 'true');
    await expect(form.getByRole('button', { name: 'Parar la forma' })).toBeVisible();

    const bars = form.getByRole('group', { name: /los compases de/ }).locator('output');
    const before = await bars.textContent();
    await block.click({ button: 'right' });
    await menu(page).getByRole('menuitem', { name: /Un compás más/ }).click();
    await expect(bars).not.toHaveText(before!);
    await block.click({ button: 'right' });
    await menu(page).getByRole('menuitem', { name: '■ Parar' }).click();
    await expect(form.getByRole('button', { name: 'Oír la forma' })).toBeVisible();
  });

  test('en la letra queda el menú del navegador', async ({ page }) => {
    await goto(page, '/');
    await page.getByTestId('mini-lyric').click({ button: 'right' });
    await expect(menu(page)).toBeHidden();
  });

  test('en Forma, un bloque se repite y se quita desde su menú', async ({ page }) => {
    await goto(page, '/forma');
    const strip = page.getByTestId('timeline');
    const blocks = strip.getByRole('button');
    const count = await blocks.count();
    await blocks.first().click({ button: 'right' });
    await menu(page).getByRole('menuitem', { name: /^Repetir/ }).click();
    await expect(blocks).toHaveCount(count + 1);
    await blocks.first().click({ button: 'right' });
    await menu(page).getByRole('menuitem', { name: 'Quitar el bloque' }).click();
    await expect(blocks).toHaveCount(count);
  });
});
