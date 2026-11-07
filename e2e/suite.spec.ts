import { expect, test } from '@playwright/test';
import { clicks, countSounds, goto, watchErrors } from './fixtures/helpers';

test.use({ viewport: { width: 1280, height: 800 } });

const rowValue = (page: import('@playwright/test').Page, id: string) =>
  page.locator(`[data-row="${id}"] p`).first();

test.describe('consigna', () => {
  test('muestra las ocho filas, cada una con su regla', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/consigna');
    const rows = page.locator('[data-row]');
    await expect(rows).toHaveCount(8);
    for (let i = 0; i < 8; i++) await expect(rows.nth(i).getByText('Regla →')).toBeVisible();
    await expect(page).toHaveURL(/\?t=/);
    expect(errors).toEqual([]);
  });

  test('trabar conserva la fila y tirar cambia el resto', async ({ page }) => {
    await goto(page, '/consigna');
    await expect(page).toHaveURL(/\?t=/);
    await page.getByRole('button', { name: 'Trabar Armonía' }).click();
    const locked = await rowValue(page, 'armonia').textContent();
    const before = new URL(page.url()).searchParams.get('t')!;
    for (let i = 0; i < 6; i++) await page.locator('#roll').click();
    await expect.poll(() => new URL(page.url()).searchParams.get('t')).not.toBe(before);
    await expect(rowValue(page, 'armonia')).toHaveText(locked!);
    const codes = new URL(page.url()).searchParams.get('t')!.split('.').slice(1);
    expect(codes[2]).toBe(before.split('.').slice(1)[2]);
    expect(codes[0]).not.toBe(before.split('.').slice(1)[0]);
  });

  test('volver a tirar una fila deja las otras igual', async ({ page }) => {
    await goto(page, '/consigna');
    await expect(page).toHaveURL(/\?t=/);
    const before = new URL(page.url()).searchParams.get('t')!.split('.');
    await page.getByRole('button', { name: 'Cambiar Forma' }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('t')).not.toBe(before.join('.'));
    const after = new URL(page.url()).searchParams.get('t')!.split('.');
    expect(after[1 + 5]).not.toBe(before[1 + 5]);
    expect(after[1 + 0]).toBe(before[1 + 0]);
  });

  test('un link compartido reproduce exactamente la misma consigna', async ({ page, context }) => {
    await goto(page, '/consigna');
    await page.getByRole('button', { name: 'Trabar Carta' }).click();
    await expect(page.getByRole('button', { name: 'Destrabar Carta' })).toBeVisible();
    await page.getByRole('slider', { name: /Seguro/ }).fill('2');
    await expect.poll(() => page.url()).toMatch(/t=2\./);
    const url = page.url();
    const values = await page.locator('[data-row] p:first-child').allTextContents();

    const other = await context.browser()!.newContext({ viewport: { width: 390, height: 844 } });
    const fresh = await other.newPage();
    await goto(fresh, url);
    await expect(fresh.locator('[data-row] p:first-child')).toHaveText(values);
    await expect(fresh.getByText('Seguro ↔ raro: Raro')).toBeVisible();
    await expect(fresh.getByRole('button', { name: 'Destrabar Carta' })).toBeVisible();
    await other.close();
  });

  test('un link roto no rompe la app', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/consigna?t=esto-no-es-una-consigna');
    await expect(page.locator('[data-row]')).toHaveCount(8);
    expect(errors).toEqual([]);
  });

  test('cambiar el riesgo vuelve a tirar', async ({ page }) => {
    await goto(page, '/consigna');
    await expect(page).toHaveURL(/\?t=/);
    await page.getByRole('slider', { name: /Seguro/ }).fill('0');
    await expect.poll(() => page.url()).toMatch(/t=0\./);
  });

  test('el riesgo elegido se recuerda al recargar', async ({ page }) => {
    await goto(page, '/ritmo');
    await page.getByRole('slider', { name: /Seguro/ }).fill('2');
    await expect(page.getByText('Seguro ↔ raro: Raro')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Seguro ↔ raro: Raro')).toBeVisible();
  });

  test('la consigna no se pierde al ir a otra herramienta y volver', async ({ page }) => {
    await goto(page, '/consigna');
    await expect(page).toHaveURL(/\?t=/);
    const value = await rowValue(page, 'forma').textContent();
    await page
      .getByRole('navigation', { name: 'Herramientas' })
      .getByRole('link', { name: 'Cartas' })
      .click();
    await expect(page).toHaveURL(/\/cartas/);
    await page
      .getByRole('navigation', { name: 'Herramientas' })
      .getByRole('link', { name: 'Consigna' })
      .click();
    await expect(rowValue(page, 'forma')).toHaveText(value!);
  });

  test('las filas abren su herramienta con el resultado cargado', async ({ page }) => {
    await goto(page, '/consigna');
    await expect(page).toHaveURL(/\?t=/);
    const label = (await rowValue(page, 'ritmo').textContent())!;
    await page.locator('[data-row="ritmo"]').getByRole('link').click();
    await expect(page).toHaveURL(/\/ritmo\?/);
    const bpm = /(\d+) ppm/.exec(label)![1];
    await expect(page.getByTestId('bpm')).toHaveText(`${bpm} ppm`);

    await page.goBack();
    await page.locator('[data-row="afinacion"]').getByRole('link').click();
    await expect(page).toHaveURL(/\/afinador\//);
    await expect(page.getByTestId('fact-chord')).toBeVisible();
  });
});

test.describe('ritmo', () => {
  test.beforeEach(async ({ page }) => {
    await countSounds(page);
  });

  test('toca el compás a tiempo: 7/8 a 120 son 7 clics en 1,75 s', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/ritmo?m=meter&bpm=120&g=2%2B2%2B3&d=8');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('7/8 (2+2+3)');
    await page.locator('#metro-toggle').click();
    await page.waitForTimeout(3500);
    await page.locator('#metro-toggle').click();
    const count = await clicks(page);
    // En 3,5 s entran 14 clics, más los que ya están programados por adelantado.
    expect(count).toBeGreaterThanOrEqual(13);
    expect(count).toBeLessThanOrEqual(17);
    expect(errors).toEqual([]);
  });

  test('marca la casilla que suena', async ({ page }) => {
    await goto(page, '/ritmo?m=meter&bpm=120&g=1%2B1%2B1%2B1&d=4');
    await page.locator('#metro-toggle').click();
    await expect(page.locator('[data-active]')).toHaveCount(1, { timeout: 2000 });
    await page.locator('#metro-toggle').click();
  });

  test('la polirritmia dibuja dos carriles', async ({ page }) => {
    await goto(page, '/ritmo?m=poly&bpm=90&a=3&b=2');
    await expect(page.locator('[data-cell^="0:"]')).toHaveCount(3);
    await expect(page.locator('[data-cell^="1:"]')).toHaveCount(2);
  });

  test('la polirritmia cambia el instrumento de cada línea y lo guarda en el link', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/ritmo?m=poly&bpm=90&a=3&b=2');
    await expect(page.getByTestId('click-sound')).toHaveCount(0);
    await expect(page.getByTestId('poly-voice-0')).toHaveValue('hihat');
    await expect(page.getByTestId('poly-voice-1')).toHaveValue('bombo');
    await expect(page.getByTestId('poly-voice-0').locator('option')).toHaveText([
      'Bombo',
      'Caja',
      'Hi-hat',
      'Palma',
      'Tom',
      'Cencerro',
    ]);

    await page.locator('#metro-toggle').click();
    await page.getByTestId('poly-voice-0').selectOption('cencerro');
    await page.getByTestId('poly-voice-1').selectOption('tom');
    await expect(page).toHaveURL(/v=cencerro_tom/);
    await expect(page.locator('[data-cell^="0:"]')).toHaveCount(3);
    await page.locator('#metro-toggle').click();

    await page.reload();
    await expect(page.getByTestId('poly-voice-0')).toHaveValue('cencerro');
    await expect(page.getByTestId('poly-voice-1')).toHaveValue('tom');
    expect(errors).toEqual([]);
  });

  test('el compás mutante redibuja mientras suena', async ({ page }) => {
    await goto(page, '/ritmo?m=mutante&bpm=240&s=1%2B1/4_2%2B3/8&c=1');
    await expect(page.locator('[data-cell^="0:"]')).toHaveCount(2);
    await page.locator('#metro-toggle').click();
    await expect(page.locator('[data-cell^="0:"]')).toHaveCount(5, { timeout: 3000 });
    await page.locator('#metro-toggle').click();
  });

  test('editar actualiza la regla y la URL', async ({ page }) => {
    await goto(page, '/ritmo');
    await page.getByRole('button', { name: 'Euclid.' }).click();
    await expect(page.getByText(/es una rotación de el tresillo/)).toBeVisible();
    await page.getByRole('button', { name: 'Subir golpes' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('E(4,8)');
    await expect.poll(() => page.url()).toContain('k=4');
  });

  test('cada pestaña conserva lo que tenía, también al pasar por otra herramienta', async ({ page }) => {
    await goto(page, '/ritmo');
    const tab = (name: string) => page.getByRole('button', { name, exact: true });
    const heading = page.getByRole('heading', { level: 1 });

    await page.getByRole('button', { name: '5/4', exact: true }).click();
    await tab('Euclid.').click();
    await page.getByRole('button', { name: 'Subir golpes' }).click();
    await expect(heading).toHaveText('E(4,8)');
    await tab('Batería').click();
    const step = page.getByRole('button', { name: 'Cencerro, paso 3', exact: true });
    await step.click();
    await expect(step).toHaveAttribute('aria-pressed', 'true');

    // El tempo es uno solo: se lleva al volver a cualquier pestaña.
    await page
      .locator('label', { has: page.getByTestId('bpm') })
      .locator('input')
      .fill('90');
    await tab('Euclid.').click();
    await expect(heading).toHaveText('E(4,8)');
    await expect(page.getByTestId('bpm')).toHaveText('90 ppm');
    await tab('Compás').click();
    await expect(page.getByRole('button', { name: '5/4', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await tab('Batería').click();
    const tools = page.getByRole('navigation', { name: 'Herramientas' });
    await tools.getByRole('link', { name: 'Cartas' }).click();
    await expect(page).toHaveURL(/\/cartas/);
    await tools.getByRole('link', { name: 'Ritmo' }).click();
    await tab('Euclid.').click();
    await expect(heading).toHaveText('E(4,8)');
    await tab('Batería').click();
    await expect(step).toHaveAttribute('aria-pressed', 'true');
  });

  test('una agrupación inválida avisa y no rompe nada', async ({ page }) => {
    await goto(page, '/ritmo');
    await page.getByLabel('Agrupación').fill('hola');
    await expect(page.getByText(/Escribí grupos como/)).toBeVisible();
    await page.getByLabel('Agrupación').fill('3+3+2');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('8/8 (3+3+2)');
  });

  test('tirar ritmo usa el nivel de riesgo', async ({ page }) => {
    await goto(page, '/ritmo');
    await page.getByRole('slider', { name: /Seguro/ }).fill('2');
    await page.locator('#roll-rhythm').click();
    await expect(page.locator('[data-testid="rhythm-grid"]')).toBeVisible();
    await expect(page).toHaveURL(/m=/);
  });
});

test.describe('datos viejos', () => {
  test('un mood guardado por una versión anterior se ignora', async ({ page }) => {
    const errors = watchErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('scordatura', JSON.stringify({ state: { mood: 'fiebre', risk: 2 }, version: 1 }));
    });
    await goto(page, '/consigna');
    await expect(page.getByText('Seguro ↔ raro: Raro')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('cartas', () => {
  test('saca cartas del mazo del nivel de riesgo', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/cartas');
    await page.getByRole('slider', { name: /Seguro/ }).fill('0');
    const card = page.getByTestId('card');
    await expect(card).toContainText(/Nº \d{3}/);
    const first = await card.textContent();
    await page.locator('#draw').click();
    await expect(card).not.toHaveText(first!);
    await expect(page.getByText('Mazo seguro')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('un link abre una carta concreta', async ({ page }) => {
    await goto(page, '/cartas?c=13');
    await expect(page.getByTestId('card')).toContainText('El estribillo va primero.');
    await expect(page.getByTestId('card')).toContainText('Nº 013');
  });

  test('tus cartas se guardan, entran al mazo y se pueden borrar', async ({ page }) => {
    await goto(page, '/cartas');
    await page.getByLabel('Nueva carta').fill('Tocá con la luz apagada');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Tocá con la luz apagada' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('listitem').filter({ hasText: 'Tocá con la luz apagada' })).toBeVisible();

    const seen = new Set<string>();
    for (let i = 0; i < 80 && !seen.has('Tuya'); i++) {
      await page.locator('#draw').click();
      if ((await page.getByTestId('card').textContent())?.includes('Tuya')) seen.add('Tuya');
    }
    expect(seen.has('Tuya')).toBe(true);

    await page.getByRole('button', { name: /Borrar la carta/ }).click();
    await expect(page.getByText('Todavía no escribiste ninguna.')).toBeVisible();
  });

  test('el botón guardar no funciona con el campo vacío', async ({ page }) => {
    await goto(page, '/cartas');
    await expect(page.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    await page.getByLabel('Nueva carta').fill('   ');
    await expect(page.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });
});

test.describe('datos guardados corruptos', () => {
  test('no rompen la app', async ({ page }) => {
    const errors = watchErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        'scordatura',
        JSON.stringify({
          state: { mood: 'marte', risk: 9, a4: 'x', customNotes: ['Q9'], ownCards: 'nada', notation: 3 },
          version: 1,
        }),
      );
    });
    await goto(page, '/cartas');
    await expect(page.getByText('Seguro ↔ raro: Medio')).toBeVisible();
    await goto(page, '/afinador/tuya');
    await expect(page.getByTestId('fact-changes')).toHaveText('Ninguna');
    expect(errors).toEqual([]);
  });
});
