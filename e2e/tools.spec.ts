// Afinador nuevo, sidebar, armonía, melodía, letras, forma y la conexión entre herramientas.
import { expect, test, type Page } from '@playwright/test';
import { countSounds, goto, gotoStudioEditing, openSection, plucks, watchErrors } from './fixtures/helpers';

test.use({ viewport: { width: 1280, height: 800 } });

test.describe('elegir una afinación', () => {
  test('suena el arpegio ascendente, de grave a agudo y una sola vez', async ({ page }) => {
    await countSounds(page);
    await page.addInitScript(() => {
      const scope = window as unknown as { __rates: number[] };
      scope.__rates = [];
    });
    const errors = watchErrors(page);
    await goto(page, '/afinador/estandar');
    expect(await plucks(page)).toBe(0);
    await page.locator('[data-id="dadgad"]').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('DADGAD');
    await expect.poll(() => plucks(page), { timeout: 4000 }).toBe(6);
    await page.waitForTimeout(800);
    expect(await plucks(page)).toBe(6);
    await expect(page.locator('#play-toggle')).toHaveText('▶ Tocar', { timeout: 4000 });
    expect(errors).toEqual([]);
  });

  test('suena aunque "Repetir" esté activado, y aunque esté elegido otro patrón', async ({ page }) => {
    await countSounds(page);
    await goto(page, '/afinador/estandar');
    await page.locator('#loop').check();
    await page.getByRole('button', { name: 'Rasgueado' }).click();
    await page.locator('[data-id="dropd"]').click();
    await expect.poll(() => plucks(page), { timeout: 4000 }).toBe(6);
    await page.waitForTimeout(2500);
    expect(await plucks(page)).toBe(6);
  });

  test('volver a tocar la afinación actual también suena', async ({ page }) => {
    await countSounds(page);
    await goto(page, '/afinador/dadgad');
    await page.locator('[data-id="dadgad"]').click();
    await expect.poll(() => plucks(page), { timeout: 4000 }).toBe(6);
  });

  test('abrir por URL o tirar una afinación no suena solo', async ({ page }) => {
    await countSounds(page);
    await goto(page, '/afinador/dadgad');
    await page.waitForTimeout(400);
    expect(await plucks(page)).toBe(0);
    await page.locator('#roll-tuning').click();
    await page.waitForTimeout(500);
    expect(await plucks(page)).toBe(0);
  });

  test('en el celular, elegir cierra la lista y suena', async ({ page }) => {
    await countSounds(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await goto(page, '/afinador/estandar');
    await page.getByRole('button', { name: /Elegir entre/ }).click();
    await page.locator('[data-id="dropd"]').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Drop D');
    await expect(page.locator('[data-id="dropd"]')).toBeHidden();
    await expect.poll(() => plucks(page), { timeout: 4000 }).toBe(6);
  });

  test('"Qué suena solo" muestra acordes y los toca', async ({ page }) => {
    await countSounds(page);
    await goto(page, '/afinador/opend');
    const shapes = page.getByTestId('solo-shapes').getByRole('button');
    await expect(shapes.first()).toContainText('Al aire');
    await shapes.nth(1).click();
    await expect.poll(() => plucks(page), { timeout: 3000 }).toBe(6);
    await expect(page.locator('[data-fret$=":1"][aria-pressed="true"]')).toHaveCount(6);
  });
});

test.describe('barra lateral', () => {
  test('se colapsa, da más lugar al contenido y se recuerda', async ({ page }) => {
    await goto(page, '/consigna');
    const nav = page.getByRole('navigation', { name: 'Principal' });
    const wide = (await nav.boundingBox())!.width;
    const mainWide = (await page.locator('main').boundingBox())!.width;
    await page.getByRole('button', { name: 'Colapsar la barra lateral' }).click();
    await expect.poll(async () => (await nav.boundingBox())!.width).toBeLessThan(wide / 2);
    await expect
      .poll(async () => (await page.locator('main').boundingBox())!.width)
      .toBeGreaterThan(mainWide);
    await expect(nav.getByRole('link', { name: 'Diario' })).toBeVisible();
    await expect(nav.getByText('Diario')).toBeHidden();

    await nav.getByRole('link', { name: 'Diario' }).click();
    await expect(page).toHaveURL(/\/diario/);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Expandir la barra lateral' })).toBeVisible();
    await page.getByRole('button', { name: 'Expandir la barra lateral' }).click();
    await expect(nav.getByText('Diario')).toBeVisible();
  });

  test('sin el mood no queda ningún rastro en la pantalla', async ({ page }) => {
    for (const route of ['/', '/consigna', '/ritmo', '/cartas', '/afinador']) {
      await goto(page, route);
      await expect(page.getByText(/Mood|Niebla|Urgencia|Fiebre/)).toHaveCount(0);
    }
  });
});

test.describe('armonía', () => {
  test('tira progresiones con regla y las muestra en la afinación elegida', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/armonia?c=C,Am,F,G');
    await expect(page.getByTestId('chord')).toHaveCount(4);
    await expect(page.getByTestId('frets').nth(1)).toContainText('0 2 2 1 0');
    await page.getByTestId('harmony-tuning').selectOption('opend');
    await expect(page.getByTestId('frets').nth(1)).not.toContainText('0 2 2 1 0');
    await page.locator('#roll-harmony').click();
    await expect(page.getByTestId('harmony-rule')).not.toContainText('Un ejemplo');
    await expect(page).toHaveURL(/c=/);
    expect(errors).toEqual([]);
  });

  test('los acordes trabados no cambian', async ({ page }) => {
    await goto(page, '/armonia?c=C,Am,F,G');
    await page.getByRole('button', { name: 'Trabar Am' }).click();
    for (let i = 0; i < 5; i++) {
      await page.locator('#roll-harmony').click();
      await expect(page.getByTestId('chord').nth(1).getByRole('heading')).toHaveText('Am');
    }
  });

  test('suena, y se puede parar', async ({ page }) => {
    await countSounds(page);
    await goto(page, '/armonia?c=C,Am,F,G');
    await page.locator('#play-harmony').click();
    await expect.poll(() => plucks(page)).toBeGreaterThanOrEqual(12);
    await expect(page.locator('#play-harmony')).toHaveText('■ Parar');
    await page.locator('#play-harmony').click();
    await expect(page.locator('#play-harmony')).toHaveText('▶ Oír');
  });

  const title = (page: Page) => page.getByRole('heading', { level: 1 });
  const choose = (page: Page, name: string) =>
    page.getByRole('button', { name: `Elegir ${name}`, exact: true }).click();

  test('tocar un acorde lo hace sonar y muestra sus controles', async ({ page }) => {
    await countSounds(page);
    await goto(page, '/armonia?c=C,Am,F,G&k=0&m=ionian');
    // Sin un acorde elegido no hay controles sueltos ni una pestaña que varíe uno al azar.
    await expect(page.getByTestId('chord-bar')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Variar/ })).toHaveCount(0);

    await choose(page, 'F');
    await expect.poll(() => plucks(page)).toBeGreaterThan(0);
    await expect(page.getByTestId('chord-bar')).toContainText('F');
    await expect(page.getByTestId('panel-acorde')).toBeVisible();

    // Toda la tarjeta responde, no solo el nombre.
    const card = page.getByTestId('chord').nth(1);
    const box = (await card.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 6);
    await expect(page.getByRole('button', { name: 'Variar Am' })).toBeVisible();

    // El candado no elige el acorde.
    await page.getByRole('button', { name: 'Trabar C' }).click();
    await expect(page.getByRole('button', { name: 'Variar Am' })).toBeVisible();

    await page.getByRole('button', { name: 'Listo' }).click();
    await expect(page.getByTestId('chord-bar')).toHaveCount(0);
    await expect(page.getByTestId('panel-sumar')).toBeVisible();
  });

  test('en el celular, los ajustes se pliegan y los controles quedan a mano', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goto(page, '/armonia?c=C,Am,F,G&k=0&m=ionian');
    await expect(page.getByTestId('harmony-tuning')).toBeHidden();
    await page.getByTestId('harmony-settings-toggle').click();
    await expect(page.getByTestId('harmony-tuning')).toBeVisible();
    await page.getByTestId('harmony-settings-toggle').click();

    await page.getByTestId('panel-sumar').getByTestId('chord-input').scrollIntoViewIfNeeded();
    await expect(page.locator('#roll-harmony')).toBeInViewport();
    await expect(page.locator('#play-harmony')).toBeInViewport();
    await expect(page.getByTestId('harmony-rule')).toBeInViewport();
  });

  test('se suman, se sacan y se mueven acordes, y todo se puede deshacer', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/armonia?c=C,Am,F,G&k=0&m=ionian');
    await expect(page.getByTestId('role').first()).toHaveText('Tónica');

    await page.getByRole('button', { name: 'Sumar Em' }).click();
    await expect(title(page)).toHaveText('C – Am – F – G – Em');
    await page.getByTestId('chord-input').fill('f#m7b5');
    await page.getByTestId('chord-input').press('Enter');
    await expect(title(page)).toHaveText('C – Am – F – G – Em – F#m7b5');
    await page.getByTestId('chord-input').fill('Cloquesea');
    await page.locator('#add-typed-chord').click();
    await expect(page.getByRole('alert')).toContainText('No reconozco');

    await choose(page, 'F#m7b5');
    await page.getByRole('button', { name: 'Sacar F#m7b5' }).click();
    await choose(page, 'Em');
    await page.getByRole('button', { name: 'Sacar Em' }).click();
    await expect(page.getByTestId('chord')).toHaveCount(4);

    await choose(page, 'Am');
    await page.getByRole('button', { name: 'Mover Am antes' }).click();
    await expect(title(page)).toHaveText('Am – C – F – G');
    await page.locator('#undo-harmony').click();
    await expect(title(page)).toHaveText('C – Am – F – G');
    await page.reload();
    await expect(title(page)).toHaveText('C – Am – F – G');
    expect(errors).toEqual([]);
  });

  test('el traba acompaña al acorde cuando se mueve, y el sorteo respeta el largo', async ({ page }) => {
    await goto(page, '/armonia?c=C,Am,F,G,Em&k=0&m=ionian');
    await page.getByRole('button', { name: 'Trabar Am' }).click();
    await choose(page, 'Am');
    await page.getByRole('button', { name: 'Mover Am después' }).click();
    await expect(page.getByTestId('chord').nth(2)).toHaveAttribute('data-locked', 'true');
    await page.locator('#roll-harmony').click();
    await expect(page.getByTestId('chord')).toHaveCount(5);
    await expect(page.getByTestId('chord').nth(2).getByRole('heading')).toHaveText('Am');
  });

  test('dos toques seguidos no pierden ninguna edición', async ({ page }) => {
    await goto(page, '/armonia?c=C,Am,F,G,Em,Dm&k=0&m=ionian');
    await choose(page, 'C');
    // Cada toque en su propia tarea, como en un dedo real, pero sin esperar a la navegación.
    await page.evaluate(async () => {
      const press = (label: string) =>
        document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click();
      press('Mover C después');
      await new Promise((resolve) => setTimeout(resolve));
      press('Mover C después');
      await new Promise((resolve) => setTimeout(resolve));
      press('Sacar C');
    });
    await expect(page.getByTestId('chord')).toHaveCount(5);
    await expect(title(page)).toHaveText('Am – F – G – Em – Dm');
    await expect(page).toHaveURL(/c=Am%2CF%2CG%2CEm%2CDm/);
    await page.reload();
    await expect(title(page)).toHaveText('Am – F – G – Em – Dm');
  });

  test('no deja bajar de dos acordes ni pasar de dieciséis', async ({ page }) => {
    await goto(page, '/armonia?c=C,G');
    await choose(page, 'C');
    await expect(page.getByRole('button', { name: 'Sacar C' })).toBeDisabled();
    const full = Array.from({ length: 16 }, () => 'C').join(',');
    await goto(page, `/armonia?c=${full}&k=0&m=ionian`);
    await expect(page.getByTestId('add-chord')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sumar Am' })).toBeDisabled();
  });

  test('un acorde elegido se reemplaza, se prepara o cambia de bajo', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/armonia?c=C,Am,F,G&k=0&m=ionian');
    await page.getByRole('button', { name: 'Elegir F', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Elegir F', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page
      .getByTestId('panel-acorde')
      .getByRole('button', { name: /^Fmaj7/ })
      .click();
    await expect(title(page)).toHaveText('C – Am – Fmaj7 – G');
    await expect(page.getByTestId('harmony-rule')).toContainText('F → Fmaj7');

    await page
      .getByTestId('panel-acorde')
      .getByRole('button', { name: /^Fmaj7\/A/ })
      .click();
    await expect(title(page)).toHaveText('C – Am – Fmaj7/A – G');
    await expect(page.getByTestId('frets').nth(2)).not.toHaveText('Sin digitación simple');

    await page
      .getByTestId('panel-acorde')
      .getByRole('button', { name: /^Gm7 C7/ })
      .click();
    await expect(title(page)).toHaveText('C – Am – Gm7 – C7 – Fmaj7/A – G');
    await expect(page.getByTestId('role').nth(3)).toHaveText('V7 de Fmaj7');
    expect(errors).toEqual([]);
  });

  test('sumar con un acorde elegido entra después de él', async ({ page }) => {
    await goto(page, '/armonia?c=C,F&k=0&m=ionian');
    await page.getByRole('button', { name: 'Elegir C', exact: true }).click();
    await page.getByRole('button', { name: 'Sumar', exact: true }).click();
    await expect(page.getByTestId('add-place')).toContainText('después de C');
    await page.getByRole('button', { name: 'Sumar Am' }).click();
    await page.getByRole('button', { name: 'Sumar Em' }).click();
    await expect(title(page)).toHaveText('C – Am – Em – F');
    await page.getByRole('button', { name: 'Mejor al final' }).click();
    await page.getByRole('button', { name: 'Sumar G', exact: true }).click();
    await expect(title(page)).toHaveText('C – Am – Em – F – G');
  });

  test('transforma toda la progresión', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/armonia?c=C,Am,F,G&k=0&m=ionian');
    await page.getByRole('button', { name: 'Toda la progresión' }).click();

    await page.getByRole('button', { name: 'Subir Transponer' }).click();
    await expect(title(page)).toHaveText('Db – Bbm – Gb – Ab');
    await expect(page.getByTestId('transpose-value')).toHaveText('En Db');
    await expect(page.getByTestId('degrees')).toHaveText('I – vi – IV – V');
    await page.getByRole('button', { name: 'Bajar Transponer' }).click();

    await page.getByTestId('whole-sevenths').click();
    await expect(title(page)).toHaveText('Cmaj7 – Am7 – Fmaj7 – G7');
    await page.getByTestId('whole-triads').click();
    await expect(title(page)).toHaveText('C – Am – F – G');

    await page.getByRole('button', { name: 'eólico' }).click();
    await expect(title(page)).toHaveText('Cm – Ab – Fm – Gm');
    await expect(page).toHaveURL(/m=aeolian/);
    await page.locator('#undo-harmony').click();
    await expect(title(page)).toHaveText('C – Am – F – G');

    await page.getByTestId('whole-rotate').click();
    await expect(title(page)).toHaveText('Am – F – G – C');
    await page.getByTestId('whole-reverse').click();
    await expect(title(page)).toHaveText('C – G – F – Am');
    await page.getByTestId('whole-bass').click();
    await expect(page.getByTestId('harmony-rule')).toContainText('→');
    expect(errors).toEqual([]);
  });

  test('lo trabado no cambia con las transformaciones de color', async ({ page }) => {
    await goto(page, '/armonia?c=C,Am,F,G&k=0&m=ionian');
    await page.getByRole('button', { name: 'Trabar Am' }).click();
    await page.getByRole('button', { name: 'Toda la progresión' }).click();
    await page.getByTestId('whole-sevenths').click();
    await expect(title(page)).toHaveText('Cmaj7 – Am – Fmaj7 – G7');
  });

  test('parte de una fórmula en la tónica elegida', async ({ page }) => {
    await goto(page, '/armonia?c=C,F&k=9');
    await page.getByRole('button', { name: 'Fórmulas' }).click();
    await page.getByRole('button', { name: 'Latina y flamenca' }).click();
    await page.getByTestId('formula-andaluza').click();
    await expect(title(page)).toHaveText('Am – G – F – E');
    await expect(page.getByTestId('harmony-rule')).toContainText('Cadencia andaluza');
    await expect(page.getByTestId('harmony-mode')).toHaveValue('aeolian');
  });

  test('suena en loop, marcando el acorde, y toma lo que se edita', async ({ page }) => {
    await countSounds(page);
    await goto(page, '/armonia?c=C,G&k=0&m=ionian');
    await page.locator('#loop-harmony').click();
    for (let i = 0; i < 16; i++) await page.getByRole('button', { name: 'Subir Tempo' }).click();
    await expect(page.getByTestId('harmony-bpm')).toHaveText('200 BPM');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Bajar Tiempos por acorde' }).click();
    await expect(page.getByTestId('harmony-beats')).toHaveText('1 tiempo');

    await page.locator('#play-harmony').click();
    await expect(page.locator('[data-testid="chord"][data-playing="true"]')).toHaveCount(1);
    await expect.poll(() => plucks(page)).toBeGreaterThan(20);
    await expect(page.locator('#play-harmony')).toHaveText('■ Parar');
    await page.getByRole('button', { name: 'Sumar Am' }).click();
    await expect(page.getByTestId('chord').nth(2)).toHaveAttribute('data-playing', 'true', {
      timeout: 10_000,
    });
    await page.locator('#play-harmony').click();
    await expect(page.locator('[data-playing="true"]')).toHaveCount(0);
  });

  test('cada acorde tiene su duración, y la comparte el link', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/armonia?c=C,G&k=0&m=ionian');
    await expect(page.getByTestId('chord-beats').first()).toHaveText('4 t');
    await expect(page).not.toHaveURL(/d=/);

    await choose(page, 'C');
    await page.getByRole('button', { name: 'Alargar C' }).click();
    await choose(page, 'G');
    await page.getByRole('button', { name: 'Acortar G' }).click();
    await expect(page.getByTestId('chord-beats').first()).toHaveText('5 t');
    await expect(page.getByTestId('harmony-beats')).toHaveText('8 en total');
    await expect(page).toHaveURL(/d=5%2C3/);

    await page.reload();
    await expect(page.getByTestId('chord-beats').last()).toHaveText('3 t');

    // La duración viaja con el acorde.
    await choose(page, 'C');
    await page.getByRole('button', { name: 'Mover C después' }).click();
    await expect(title(page)).toHaveText('G – C');
    await expect(page.getByTestId('chord-beats').first()).toHaveText('3 t');
    await page.locator('#undo-harmony').click();
    await expect(title(page)).toHaveText('C – G');
    await expect(page.getByTestId('chord-beats').first()).toHaveText('5 t');

    // Sortear cambia los acordes, no el ritmo armónico.
    await page.locator('#roll-harmony').click();
    await expect(page.getByTestId('chord-beats').first()).toHaveText('5 t');

    // Una fórmula trae su propio ritmo armónico.
    await page.getByRole('button', { name: 'Fórmulas' }).click();
    await page.getByRole('button', { name: 'Jazz', exact: true }).click();
    await page.getByTestId('formula-iiVI').click();
    await expect(page.getByTestId('chord-beats')).toHaveText(['2 t', '2 t', '4 t']);

    // Lo que se suma toma la duración del acorde de al lado.
    await page.getByRole('button', { name: 'Sumar', exact: true }).click();
    await page.getByRole('button', { name: 'Sumar Am' }).click();
    await expect(page.getByTestId('chord-beats').last()).toHaveText('4 t');
    expect(errors).toEqual([]);
  });

  test('una duración rara en la URL se ignora', async ({ page }) => {
    await goto(page, '/armonia?c=C,G&d=2,99');
    await expect(page.getByTestId('chord-beats')).toHaveText(['4 t', '4 t']);
  });

  test('el loop respeta la duración de cada acorde', async ({ page }) => {
    await goto(page, '/armonia?c=C,G&k=0&m=ionian&d=1,6');
    await page.locator('#play-harmony').click();
    const playing = page.getByTestId('chord').nth(1);
    await expect(playing).toHaveAttribute('data-playing', 'true');
    // El segundo acorde dura seis tiempos a 120: tres segundos.
    await page.waitForTimeout(1500);
    await expect(playing).toHaveAttribute('data-playing', 'true');
  });

  test('la duración llega a la sección, a la forma y al estudio', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/armonia?c=C,G&k=0&m=ionian&d=6,2');
    await expect(page.getByTestId('harmony-fit')).toContainText('dura 8 tiempos');
    await page.locator('#save-harmony').click();

    const saved = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem('scordatura-proyecto')!).state.sections.A);
    expect(await saved()).toMatchObject({ chords: ['C', 'G'], chordBeats: [6, 2] });

    await page.reload();
    await expect(page.getByTestId('chord-beats').first()).toHaveText('6 t');
    await page.getByRole('button', { name: 'Sumar Am' }).click();
    await page.locator('#load-harmony').click();
    await expect(page.getByTestId('chord-beats')).toHaveText(['6 t', '2 t']);

    await goto(page, '/forma');
    await expect(page.getByTestId('section-chords').getByRole('link').first()).toHaveAttribute(
      'href',
      /d=6,2/,
    );
    await gotoStudioEditing(page);
    await expect(page.locator('a[href*="d=6,2"]').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('guarda en la sección y la vuelve a traer', async ({ page }) => {
    await goto(page, '/armonia?c=C,Am,F,G&k=0&m=ionian');
    await expect(page.locator('#load-harmony')).toHaveCount(0);
    await page.locator('#save-harmony').click();
    await page.getByRole('button', { name: 'Sumar Em' }).click();
    await expect(page.getByTestId('chord')).toHaveCount(5);
    await page.locator('#load-harmony').click();
    await expect(title(page)).toHaveText('C – Am – F – G');
  });

  test('lo que se edita llega a la consigna', async ({ page }) => {
    await goto(page, '/armonia?c=C,Am&k=0&m=ionian');
    await page.getByRole('button', { name: 'Sumar F', exact: true }).click();
    await expect(title(page)).toHaveText('C – Am – F');
    await goto(page, '/consigna');
    await expect(page.locator('[data-row="armonia"]').getByTestId('mini-degrees')).toHaveText('I – vi – IV');
  });
});

test.describe('melodía', () => {
  test('el contorno genera notas, y la nota tabú desaparece', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/melodia');
    await expect(page.getByTestId('note-names')).toContainText('A');
    await page.getByTestId('taboo').selectOption({ label: 'C' });
    await expect(page.getByTestId('note-names')).not.toContainText(/\bC\d/);
    expect(errors).toEqual([]);
  });

  test('se puede dibujar el contorno con el dedo', async ({ page }) => {
    await goto(page, '/melodia');
    const before = await page.getByTestId('note-names').textContent();
    const pad = page.getByTestId('contour-pad');
    await pad.scrollIntoViewIfNeeded();
    const box = (await pad.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + box.height - 5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 10, box.y + 5, { steps: 40 });
    await page.mouse.up();
    await expect(page.getByTestId('note-names')).not.toHaveText(before!);
  });

  test('el motivo se transforma con su regla, y el dado cambia de transformación', async ({ page }) => {
    await goto(page, '/melodia');
    await page.getByRole('button', { name: 'Motivo' }).click();
    await page.getByRole('button', { name: 'Retrogradación' }).click();
    await expect(page.getByTestId('motif-rule')).toContainText('atrás para adelante');
    const rule = await page.getByTestId('motif-rule').textContent();
    await page.locator('#dice').click();
    await expect(page.getByTestId('motif-rule')).not.toHaveText(rule!);
  });

  test('una palabra se convierte en notas', async ({ page }) => {
    await goto(page, '/melodia');
    await page.getByRole('button', { name: 'Texto' }).click();
    await expect(page.getByTestId('text-notes')).toContainText('B → A#');
    await expect(page.getByTestId('text-notes')).toContainText('H → B');
  });

  test('el mapa de tensiones usa los acordes de la sección', async ({ page }) => {
    await goto(page, '/armonia?c=Dm,G7');
    await page.locator('#save-harmony').click();
    await openSection(page, 'Melodía');
    await page.getByRole('button', { name: 'Tensiones' }).click();
    await page.getByRole('button', { name: 'G7' }).click();
    const tensions = page.getByTestId('tension');
    await expect(tensions).toHaveCount(12);
    await expect(tensions.filter({ hasText: 'Reposo' })).toHaveCount(4);
    await expect(tensions.filter({ hasText: 'Choque' }).first()).toBeVisible();
  });
});

test.describe('letras', () => {
  test('cuenta sílabas, detecta la rima y marca lo que no cumple', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/letras');
    await page
      .getByTestId('lyric-text')
      .fill(
        'En un lugar de la Mancha\nCaminante no hay camino\nesta es una línea demasiado larga para ser octosílabo\nverde que te quiero verde',
      );
    const lines = page.getByTestId('line');
    await expect(lines).toHaveCount(4);
    await expect(lines.nth(0).getByTestId('line-count')).toHaveText('8');
    await expect(lines.nth(1).getByTestId('line-count')).toHaveText('8');
    await expect(lines.nth(0)).toHaveAttribute('data-off', 'false');
    await expect(lines.nth(2)).toHaveAttribute('data-off', 'true');
    await expect(page.getByTestId('prosody-line')).toHaveCount(4);
    expect(errors).toEqual([]);
  });

  test('avisa de la palabra prohibida', async ({ page }) => {
    await goto(page, '/letras');
    await page.getByTestId('forbidden').fill('noche');
    await page.getByTestId('lyric-text').fill('Toda la noche despierto');
    await expect(page.getByTestId('line')).toContainText('usa la palabra prohibida');
  });

  test('la letra se guarda por sección', async ({ page }) => {
    await goto(page, '/letras');
    await page.getByTestId('lyric-text').fill('Letra de la sección A');
    await page.getByTestId('section-picker').selectOption('B');
    await expect(page.getByTestId('lyric-text')).toHaveValue('');
    await page.getByTestId('section-picker').selectOption('A');
    await expect(page.getByTestId('lyric-text')).toHaveValue('Letra de la sección A');
    await page.reload();
    await expect(page.getByTestId('lyric-text')).toHaveValue('Letra de la sección A');
  });

  test('el diccionario busca rimas y se carga recién al usarlo', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('palabras')) requested.push(request.url());
    });
    await goto(page, '/letras');
    await page.getByRole('button', { name: 'Rimas' }).click();
    expect(requested).toEqual([]);
    await page.getByTestId('rhyme-query').fill('camino');
    await page.locator('#rhyme-search').click();
    const results = page.getByTestId('rhyme-results').getByRole('listitem');
    await expect(results.first()).toBeVisible({ timeout: 20000 });
    for (const word of await results.allTextContents()) expect(word).toMatch(/[ií]no$/);
    // Es una muestra repartida: no se queda con el principio del alfabeto.
    const words = await results.allTextContents();
    expect(new Set(words.map((word) => word[0])).size).toBeGreaterThan(6);

    await page.getByTestId('rhyme-mode').selectOption('asonante');
    await page.locator('#rhyme-search').click();
    await expect
      .poll(async () => (await results.allTextContents()).some((word) => !word.endsWith('ino')), {
        timeout: 20000,
      })
      .toBe(true);

    await page.getByTestId('rhyme-mode').selectOption('final');
    await page.getByTestId('rhyme-query').fill('ción');
    await page.locator('#rhyme-search').click();
    await expect
      .poll(async () => (await results.allTextContents()).every((word) => word.endsWith('ción')), {
        timeout: 20000,
      })
      .toBe(true);
  });

  test('el material sortea imágenes, título y restricciones', async ({ page }) => {
    await goto(page, '/letras');
    await page.getByRole('button', { name: 'Material' }).click();
    const material = page.getByTestId('material');
    const before = await material.textContent();
    await page.locator('#roll-material').click();
    await expect(material).not.toHaveText(before!);
  });

  test('el cut-up corta, mezcla y deja rescatar', async ({ page }) => {
    await goto(page, '/letras');
    await page.getByRole('button', { name: 'Cut-up' }).click();
    await page
      .getByTestId('cutup-source')
      .fill('una frase cualquiera para cortar en pedazos\ny otra frase más larga todavía');
    await page.locator('#cut').click();
    const pieces = page.getByTestId('cutup-pieces').getByRole('button');
    await expect(pieces.first()).toBeVisible();
    const piece = await pieces.first().textContent();
    await pieces.first().click();
    await expect(page.getByTestId('cutup-rescued')).toContainText(piece!);
  });

  test('con el reloj corriendo no se puede borrar', async ({ page }) => {
    await goto(page, '/letras');
    await page.getByRole('button', { name: 'Reloj' }).click();
    await expect(page.getByTestId('clock')).toHaveText('3:00');
    await page.locator('#clock-start').click();
    await expect(page.getByTestId('clock')).toHaveText('2:59', { timeout: 2500 });
    const area = page.getByTestId('clock-text');
    await area.pressSequentially('hola');
    await area.press('Backspace');
    await expect(area).toHaveValue('hola');
    await page.locator('#clock-start').click();
    await area.press('Backspace');
    await expect(area).toHaveValue('hol');
  });
});

test.describe('forma', () => {
  test('tira formas con regla, y un link carga su forma', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/forma?f=AABCA');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('AABCA');
    await page.locator('#roll-form').click();
    await expect(page.getByTestId('form-rule')).not.toHaveText('Armala a mano o sorteá una forma.');
    expect(errors).toEqual([]);
  });

  test('los bloques se ordenan arrastrando y con las flechas', async ({ page }) => {
    await goto(page, '/forma?f=ABC');
    const title = page.getByRole('heading', { level: 1 });
    const blocks = page.getByTestId('timeline').locator('[data-block]');
    const first = (await blocks.nth(0).boundingBox())!;
    const last = (await blocks.nth(2).boundingBox())!;
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(title).toHaveText('BCA');
    await blocks.nth(2).click();
    await page.getByRole('button', { name: 'Mover el bloque a la izquierda' }).click();
    await expect(title).toHaveText('BAC');
    await page.getByRole('button', { name: 'Agregar sección D' }).click();
    await expect(title).toHaveText('BACD');
    await page.getByRole('button', { name: 'Quitar el bloque' }).click();
    await expect(title).toHaveText('BCD');
  });

  test('cada sección tiene su consigna, y el compás llega al metrónomo', async ({ page }) => {
    await goto(page, '/forma?f=AB');
    await page.getByTestId('timeline').locator('[data-block]').nth(1).click();
    await expect(page.getByRole('heading', { name: 'Sección B' })).toBeVisible();
    await page.locator('#roll-section').click();
    await expect(page.getByTestId('section-chords')).toContainText('–');
    await page.locator('#play-meters').click();
    await expect(page).toHaveURL(/\/ritmo\?.*m=mutante/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('→');
  });

  test('ritmo y armonía se guardan en la sección y aparecen en la forma', async ({ page }) => {
    await goto(page, '/armonia?c=Dm,G7');
    await page.getByTestId('section-picker').selectOption('B');
    await page.locator('#save-harmony').click();
    await openSection(page, 'Ritmo');
    await page.locator('#save-rhythm').click();
    await openSection(page, 'Forma');
    await expect(page.getByRole('heading', { name: 'Sección B' })).toBeVisible();
    await expect(page.getByTestId('section-chords')).toContainText('Dm – G7');
    await expect(page.getByTestId('section-rhythm')).toContainText('ppm');
  });

  test('un ejemplo se abre y se puede usar su forma, sin contactar a YouTube antes', async ({ page }) => {
    const requests: string[] = [];
    await page.route(/youtube/, (route) => {
      requests.push(route.request().url());
      return route.abort();
    });
    await goto(page, '/forma');
    await page.waitForTimeout(200);
    expect(requests).toEqual([]);
    await page.getByRole('button', { name: 'Usar la forma de Yesterday' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('AABABA');
    await page.getByRole('button', { name: 'Oír Yesterday' }).click();
    await expect.poll(() => requests.some((url) => url.includes('iframe_api'))).toBe(true);
    await expect(page.getByTestId('youtube-host')).toBeAttached();
    await page.getByRole('button', { name: 'Oír Yesterday' }).click();
    await expect(page.getByTestId('youtube-host')).toHaveCount(0);
  });
});
