// Arrastrar y soltar: ordenar acordes, bloques y versos, traer acordes y palabras, pintar golpes y
// mover notas. Más los menús del clic derecho de las herramientas.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { goto, watchErrors } from './fixtures/helpers';

test.use({ viewport: { width: 1280, height: 800 } });

/** Arrastra con el mouse, en pasos, y suelta en el borde izquierdo o derecho de `to`. */
async function drag(page: Page, from: Locator, to: Locator, side: 'left' | 'right' | 'top' | 'bottom') {
  await from.scrollIntoViewIfNeeded();
  const a = (await from.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 });
  const b = (await to.boundingBox())!;
  const x = side === 'left' ? b.x + 4 : side === 'right' ? b.x + b.width - 4 : b.x + b.width / 2;
  const y = side === 'top' ? b.y + 3 : side === 'bottom' ? b.y + b.height - 3 : b.y + b.height / 2;
  await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.up();
}

const menu = (page: Page) => page.getByTestId('context-menu');

test.describe('arrastrar y soltar', () => {
  test('en Armonía, un acorde se mueve arrastrándolo y uno de la paleta entra donde se suelta', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await goto(page, '/armonia?c=Am,F,C,G');
    const names = page.getByTestId('chord').locator('h3');
    await expect(names).toHaveText(['Am', 'F', 'C', 'G']);

    await drag(page, page.getByTestId('chord').first(), page.getByTestId('chord').nth(2), 'right');
    await expect(names).toHaveText(['F', 'C', 'Am', 'G']);

    const palette = page.getByTestId('palette-chord').filter({ hasText: 'Dm' }).first();
    await drag(page, palette, page.getByTestId('chord').first(), 'left');
    await expect(names).toHaveText(['Dm', 'F', 'C', 'Am', 'G']);
    // Soltar no cuenta como clic: el acorde no se suma otra vez al final.
    await expect(page.getByTestId('chord')).toHaveCount(5);
    expect(errors).toEqual([]);
  });

  test('en Armonía, el menú de un acorde lo repite, y Escape corta un arrastre', async ({ page }) => {
    await goto(page, '/armonia?c=Am,F,C,G');
    const names = page.getByTestId('chord').locator('h3');
    await page.getByTestId('chord').nth(1).click({ button: 'right' });
    await menu(page).getByRole('menuitem', { name: 'Repetirlo al lado' }).click();
    await expect(names).toHaveText(['Am', 'F', 'F', 'C', 'G']);

    const first = page.getByTestId('chord').first();
    const box = (await first.boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + 20, { steps: 6 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(names).toHaveText(['Am', 'F', 'F', 'C', 'G']);
  });

  test('en la consigna, los acordes se ordenan y uno de afuera entra arrastrándolo', async ({ page }) => {
    await goto(page, '/');
    await expect(page).toHaveURL(/\?t=/);
    const harmony = page.locator('[data-row="armonia"]');
    const names = harmony.getByTestId('mini-chord-name');
    const chords = await names.allTextContents();
    const cells = harmony.locator('[data-drop="consigna-acorde"]');

    await drag(page, cells.first(), cells.nth(1), 'right');
    await expect(names).toHaveText([chords[1]!, chords[0]!, ...chords.slice(2)]);

    const spare = harmony.getByTestId('mini-outside').getByRole('button', { name: /^Oír / }).first();
    test.skip((await spare.count()) === 0, 'la progresión ya usa todos los grados');
    const name = (await spare.textContent())!.replace(/^[ivIV♭#°+]+/, '');
    await drag(page, spare, cells.first(), 'left');
    await expect(names).toHaveCount(chords.length + 1);
    await expect(names.first()).toHaveText(name);
  });

  test('en Forma, un "+ A" se suelta en el lugar de la tira donde va', async ({ page }) => {
    await goto(page, '/forma');
    const blocks = page.getByTestId('timeline').getByRole('button');
    const count = await blocks.count();
    const second = await blocks.nth(1).getAttribute('aria-label');
    const add = page.getByRole('button', { name: /^Agregar sección / }).last();
    await drag(page, add, blocks.first(), 'right');
    await expect(blocks).toHaveCount(count + 1);
    // Entró en el segundo lugar: el que estaba ahí pasó a ser el tercero.
    await expect(blocks.nth(2)).toHaveAttribute('aria-label', second!.replace(/^Bloque 2/, 'Bloque 3'));
  });

  test('en Letras, un verso se mueve desde el margen y una rima se arrastra hasta la letra', async ({
    page,
  }) => {
    await goto(page, '/letras');
    const text = page.getByTestId('lyric-text');
    await text.fill('uno\ndos\ntres');
    const lines = page.getByTestId('line');
    await drag(page, lines.first(), lines.nth(2), 'bottom');
    await expect(text).toHaveValue('dos\ntres\nuno');

    await lines.nth(1).click({ button: 'right' });
    await menu(page).getByRole('menuitem', { name: 'Repetirlo abajo' }).click();
    await expect(text).toHaveValue('dos\ntres\ntres\nuno');

    await page.getByTestId('panel-rimas').getByTestId('rhyme-query').fill('camino');
    await page.locator('#rhyme-search').click();
    const word = page.getByTestId('rhyme-results').getByRole('button').first();
    const value = (await word.textContent())!;
    await word.dragTo(text);
    await expect(text).toHaveValue(new RegExp(value));
  });

  test('en la batería, arrastrar por una fila pinta los golpes, y el menú la vacía', async ({ page }) => {
    await goto(page, '/ritmo');
    await page.getByRole('button', { name: 'Batería' }).click();
    const lane = page.getByTestId('drum-machine').locator('[data-track]').first();
    await lane.getByRole('button', { name: /paso/ }).first().click({ button: 'right' });
    await menu(page).getByRole('menuitem', { name: 'Vaciar la fila' }).click();
    const steps = lane.getByRole('button', { name: /paso/ });
    await expect(steps.and(page.locator('[aria-pressed="true"]'))).toHaveCount(0);

    const a = (await steps.nth(0).boundingBox())!;
    const b = (await steps.nth(3).boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(steps.and(page.locator('[aria-pressed="true"]'))).toHaveCount(4);

    // Un clic suelto sigue prendiendo y apagando de a una.
    await steps.nth(0).click();
    await expect(steps.nth(0)).toHaveAttribute('aria-pressed', 'false');
  });

  test('en Melodía, una nota del motivo sube arrastrándola y con las flechas', async ({ page }) => {
    await goto(page, '/melodia');
    await page.getByRole('button', { name: 'Motivo' }).click();
    const note = page.getByRole('slider', { name: 'Nota 1' });
    const before = Number(await note.getAttribute('aria-valuenow'));
    await note.focus();
    await page.keyboard.press('ArrowUp');
    await expect(note).toHaveAttribute('aria-valuenow', String(before + 1));

    const box = (await note.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 30, { steps: 6 });
    await page.mouse.up();
    expect(Number(await note.getAttribute('aria-valuenow'))).toBeGreaterThan(before + 1);
  });
});
