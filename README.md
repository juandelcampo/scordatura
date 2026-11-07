# Scordatura

Suite para componer fuera de tus costumbres. Genera restricciones con teoría real detrás; la música la hacés vos.

| Sección  | Qué hace                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Consigna | Una consigna por módulo. Es el hub: cada parte se escucha y se usa ahí mismo, se traba, se vuelve a tirar y se comparte con un link.        |
| Estudio  | El tema entero en una pantalla sin desplazarse: la forma, con sus pistas de acordes, batería, melodía, drone y letra. Suena y se edita ahí. |
| Inicio   | Explica la idea, y lleva a la consigna.                                                                                                     |
| Afinador | 68 afinaciones, afinador por micrófono, escuchador interactivo y lo que suena con un solo dedo.                                             |
| Ritmo    | Metrónomo de compases agrupados, ritmos euclidianos, polirritmias y compases que mutan.                                                     |
| Drone    | Un sinte que sostiene una nota, o las cuerdas de una afinación, para tocar encima.                                                          |
| Armonía  | Progresiones con su regla a la vista, un editor para sumar, sacar y variar acordes, y cómo tocarlas en cada afinación.                      |
| Melodía  | Contornos, restricciones, motivos, notas desde texto, mapa de tensiones, y transcribir lo que cantás.                                       |
| Letras   | Sílabas métricas, esquemas de rima, prosodia, diccionario de rimas, material, cut-up y escritura con reloj.                                 |
| Cartas   | Mazo de consignas, y las tuyas.                                                                                                             |
| Forma    | Bloques que se arrastran, sección por sección, y ejemplos con video donde marcás los minutos.                                               |
| Diario   | Notas de voz y consignas guardadas, pegadas a las condiciones en las que nacieron.                                                          |

El slider seguro ↔ raro define qué tan lejos sortea cada herramienta, y siempre está en el mismo lugar.

## Comandos

```sh
./iniciar.sh            # instala si hace falta, levanta la app y abre el navegador
npm run dev             # servidor de desarrollo
npm run build           # genera el sitio estático en build/client
npm run preview         # sirve ese build en http://localhost:4173
npm run check           # tipos, lint, tests, build y pruebas de navegador, en build y en desarrollo
npm run e2e:dev         # pruebas contra el servidor de desarrollo, donde React ejecuta los efectos dos veces
npm run check:videos    # comprueba que los videos del catálogo sigan disponibles (necesita conexión)
```

Las pruebas de navegador usan el Chrome instalado en el sistema. Para revisar capturas de cada pantalla:
`SCREENSHOTS=1 npx playwright test screens` (quedan en `test-results/screens`).

El micrófono solo funciona en `localhost` o por `https`, así que para usarlo desde el celular hay que publicar la app.

## Arquitectura

```text
src/
  core/        teoría, ritmo, melodía, métrica en español, detección de altura y azar con semilla. TypeScript puro.
  data/        afinaciones, lo que se sortea, cartas y ejemplos de forma. Solo datos.
  audio/       AudioContext, instrumento (guitarra), drone, micrófono, grabación y metrónomo. Sin React.
  shared/      preferencias, proyecto, diario y componentes de interfaz.
  shell/       barra lateral, menú y barra de riesgo.
  features/    una carpeta por herramienta.
tests/         lógica y validación de datos (Vitest)
e2e/           pruebas en Chrome real, incluida la responsive (Playwright)
```

### Reglas

ESLint hace cumplir las tres primeras, y `npm run lint` falla si se rompen.

1. **`core` y `data` no conocen React, el audio ni la interfaz.** Así se testean solos y se pueden reusar en cualquier herramienta.
2. **`audio` no depende de React.** La interfaz observa al audio, no al revés. Por eso el metrónomo no se corta al navegar y su reloj no depende de los renders.
3. **Las herramientas no se importan entre sí.** Se conectan por `core`, por URL y por el proyecto compartido.
4. **Todo lo que se sortea cumple el contrato `Roller`** de `core/roll.ts`. Devuelve `{ value, label, rule }`, y `rule` es obligatoria: un resultado que no explica su teoría no compila.
5. **Dónde va el estado:**
   - La URL guarda lo que se comparte (una consigna, un ritmo, una progresión, una carta).
   - Zustand guarda las preferencias (`shared/settings.ts`) y el proyecto (`shared/project.ts`), en `localStorage`.
   - IndexedDB guarda el diario (`shared/journal.ts`), porque incluye audio.
   - Lo guardado se valida al leerlo, porque puede venir corrupto o de otra versión.
6. **Las páginas estáticas no conocen la URL.** Un componente que lee parámetros durante el render usa `useHydrated`; si no, React encuentra un HTML distinto del que esperaba.
7. **Los datos se validan con esquemas** en `tests/data.test.ts`: un error en el catálogo falla ahí, no en pantalla.

### El proyecto

La forma es el esqueleto. Cada letra (A, B, C…) guarda su progresión, su ritmo, su consigna y su letra. Armonía, Ritmo y Letras guardan en la sección elegida, Melodía lee sus acordes, y Forma lleva los compases de cada sección al metrónomo. Una idea grabada queda pegada a la consigna y a la sección donde nació.

En el Estudio, cada sección además guarda cuántos compases dura y si lleva drone, y el proyecto guarda el tempo y la mezcla. Una sección sin armonía o ritmo propio usa los de la consigna, y cualquier ritmo se ve y se edita como batería. `core/song.ts` calcula lo que suena en cada momento, y `audio/song.ts` lo programa.

### Responsive

Es un requisito, no un detalle:

- **Se diseña primero para el celular.** La barra lateral aparece recién a partir de 900 px, y se puede colapsar; antes hay un menú a pantalla completa.
- **Las herramientas usan container queries** sobre `main`, no el ancho de la pantalla, porque la barra lateral también ocupa lugar.
- **`e2e/responsive.spec.ts` recorre cada pantalla en 12 tamaños**, de 320 px a 1920 px, y falla si algo se sale de la pantalla, si se corta un texto o si un control queda chico para el dedo (menos de 40 px de alto o 30 px de ancho).
- Los campos de texto usan al menos 16 px para que iOS no acerque el zoom al escribir.

### Agregar cosas

- **Una afinación:** una entrada en `data/tunings.ts`. El acorde al aire, los intervalos, los avisos y su página estática se generan solos.
- **Una carta:** una entrada en `data/cards.ts`.
- **Un ejemplo de forma:** una entrada en `data/forms.ts`.
- **Una herramienta:** una carpeta en `features/`, su ruta en `routes.ts` y en `react-router.config.ts`, su entrada en `shell/AppShell.tsx` y su nombre en `FEATURES` de `eslint.config.js`.

## Sobre los datos

- Muchas afinaciones por canción se transcribieron de oído. Cada tema marca su confiabilidad con `conf`, y `octaves: 'est'` indica que la fuente no daba octavas y son estimadas.
- Lo que se sortea (`data/pools.ts`) y el mazo de cartas son un primer borrador para editar.
- Las estructuras de `data/forms.ts` están simplificadas, y los minutos de cada sección los marca cada persona al escuchar.
- La lista del diccionario de rimas (`public/palabras.txt`) sale del paquete [an-array-of-spanish-words](https://www.npmjs.com/package/an-array-of-spanish-words), con licencia MIT. Se regenera con `scripts/build-words.ts`.
