// El lienzo: el proyecto sale de la consigna, se edita por carril y suena con sus duraciones reales.
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/lienzo');
  await expect(page.locator('[data-lienzo]')).toBeVisible();
  return errors;
}

test.describe('lienzo', () => {
  test('arma el proyecto desde la consigna y lo edita por carril', async ({ page }) => {
    const errors = await open(page);
    await expect(page.getByRole('region', { name: 'Consigna' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Armonía, / }).first()).toBeVisible();

    await page
      .getByRole('button', { name: /^Armonía, / })
      .first()
      .click({ button: 'right' });
    await page
      .getByRole('menuitem', { name: /Sortear/ })
      .first()
      .click();
    await expect(page.getByRole('region', { name: 'Detalle' })).toContainText('Armonía');

    await page.getByRole('button', { name: /^Tonalidad:/ }).click();
    const tono = page.getByRole('dialog', { name: 'Tonalidad' });
    await tono.getByRole('button', { name: 'Do', exact: true }).click();
    await tono.getByRole('button', { name: 'Mayor luminoso' }).click();
    await expect(page.getByRole('button', { name: /^Tonalidad: Do mayor/ })).toBeVisible();
    await tono.getByRole('button', { name: /^Poner El engaño/ }).click();
    await expect(page.getByRole('region', { name: 'Detalle' })).toContainText('C – F – G – Am');
    await page.getByRole('button', { name: 'Cerrar tonalidad' }).click();

    // Cambiar la tónica transporta lo que ya está.
    await page.getByRole('button', { name: /^Tonalidad:/ }).click();
    await tono.getByRole('button', { name: 'Re', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Detalle' })).toContainText('D – G – A – Bm');
    await page.getByRole('button', { name: 'Cerrar tonalidad' }).click();
    expect(errors).toEqual([]);
  });

  test('escribe letra, mide sílabas y la melodía toma una columna por sílaba', async ({ page }) => {
    const errors = await open(page);
    await page
      .getByRole('button', { name: /^Letra, / })
      .first()
      .click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Escribir/ }).click();
    await page.locator('#letra-texto').fill('Tengo la mesa servida\npara la gente que vuelve');
    await expect(page.getByRole('dialog', { name: 'Letra' })).toContainText('Lupa');
    await page.getByRole('button', { name: 'Cerrar letra' }).click();

    await page
      .getByRole('button', { name: /^Melodía, / })
      .first()
      .click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Empezar una melodía|Editar/ }).click();
    await page
      .getByRole('button', { name: /^Melodía, / })
      .first()
      .click();
    await expect(page.getByRole('region', { name: 'Detalle' })).toContainText('una columna por sílaba');
    await expect(page.getByRole('region', { name: 'Detalle' })).toContainText('de 16 notas');
    expect(errors).toEqual([]);
  });

  test('suena, se pausa y las otras vistas abren', async ({ page }) => {
    const errors = await open(page);
    await page.getByRole('button', { name: 'Reproducir' }).click();
    await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Pausar' }).click();
    const vista = page.getByRole('group', { name: 'Vista' });
    await vista.getByRole('button', { name: 'Hoja' }).click();
    await expect(page.getByRole('article', { name: 'Hoja de la canción' })).toBeVisible();
    await vista.getByRole('button', { name: 'Instrumento' }).click();
    await expect(page.getByText('Con un solo dedo')).toBeVisible();
    await vista.getByRole('button', { name: 'Referencias' }).click();
    await page.getByRole('button', { name: /^Creep/ }).click();
    await page.getByRole('button', { name: /^probar en/ }).click();
    await expect(page.getByText(/en tu tonalidad/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('en el celular no se desborda', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = await open(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
});
