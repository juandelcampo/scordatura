# Scordatura

Suite para componer fuera de tus costumbres. Genera restricciones con teoría real detrás; la música la hacés vos.

Una sesión tiene un solo camino: sortear la consigna, trabar lo que sirve, tocar sobre la base, grabar y que la idea quede en el Diario. El menú tiene tres entradas: Consigna, Diario y Herramientas.

| Sección  | Lugar       | Qué hace                                                                                                                                                                |
| -------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consigna | Centro      | La pantalla de entrada (`/`). Una fila por módulo: cada parte se escucha ahí mismo, se traba, se vuelve a sortear y se comparte con un link, un MIDI o una hoja en PDF. |
| Diario   | Centro      | Notas de voz y consignas guardadas, pegadas a las condiciones en las que nacieron.                                                                                      |
| Cartas   | Centro      | Una fila de la consigna y una carta suelta rápida. El mazo completo, con las tuyas, se abre desde ahí.                                                                  |
| Estudio  | Boceto      | Escuchar la consigna entera, a lo largo de su forma, para tocar encima. "Editar" muestra los editores y la mezcla.                                                      |
| Afinador | Herramienta | 68 afinaciones, afinador por micrófono, escuchador interactivo y lo que suena con un solo dedo.                                                                         |
| Ritmo    | Herramienta | Metrónomo de compases agrupados, ritmos euclidianos, polirritmias y compases que mutan.                                                                                 |
| Drone    | Herramienta | Un sinte que sostiene una nota, o las cuerdas de una afinación, para tocar encima.                                                                                      |
| Armonía  | Herramienta | Progresiones con su regla a la vista, un editor para sumar, sacar y variar acordes, y cómo tocarlas en cada afinación.                                                  |
| Melodía  | Herramienta | Contornos, restricciones, motivos, notas desde texto, mapa de tensiones, y transcribir lo que cantás.                                                                   |
| Letras   | Herramienta | Sílabas métricas, esquemas de rima, prosodia, diccionario de rimas, material, cut-up y escritura con reloj.                                                             |
| Forma    | Herramienta | Bloques que se arrastran, sección por sección, y ejemplos con video donde marcás los minutos.                                                                           |
| Acerca   | Aparte      | Explica la idea en veinte segundos (`/acerca`).                                                                                                                         |

Las herramientas son un desvío para ir más hondo en una fila: se abren desde esa fila o desde `/herramientas`, y lo que se elige ahí vuelve a la consigna.

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

Con varias sesiones trabajando a la vez, `E2E_PORT=5299 npx playwright test` sirve el build en otro puerto. `sirv` lee la lista de archivos al arrancar: después de un build nuevo, hay que reiniciar el servidor.

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
  shell/       barra lateral, menú, barra de riesgo y el camino de vuelta a la consigna.
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

### El lienzo

Por ahora no tiene ruta: la vista se sacó y el código queda para rescatar piezas. Era la canción como proyecto: un proyecto es una canción. Las secciones forman el tema y cada carril (Armonía, Melodía, Ritmo, Letra, más las Tomas) pone en cada sección una variante de la biblioteca del proyecto. La consigna queda arriba: propone, sortea y chequea cada celda con ✓ o ✗.

- **Modelo** (`core/lienzo/types.ts`): los acordes se guardan por grado y con duración en compases, así cambiar la tónica transporta todo. Armonía, melodía y ritmo de una repetición son los de su raíz; la letra es propia de cada sección.
- **Core** (`core/lienzo/`): armonía y grados, ritmo por paso sobre `core/rhythm`, melodía por sílabas sobre los contornos de `core/melody`, letra con la métrica de `core/spanish`, forma y contraste, círculo, digitaciones para cualquier afinación, Tus reglas, la agenda de lo que suena por compás y el MIDI.
- **Estado**: `shared/lienzo.ts` guarda el proyecto y las canciones anteriores; `shared/lienzoUi.ts`, lo que es de la pantalla. La posición de reproducción no pasa por ningún store: la da `audio/lienzo.ts` desde el reloj de audio.
- **Migración**: la primera vez, el lienzo arma el proyecto con la forma de la consigna y lo que el Estudio guardaba por letra. Lo viejo no se toca.
- **Pendiente**: acordes con séptima, cambio de tonalidad por sección, sinalefa entre versos en la melodía, transcribir lo tarareado a la grilla, manejo por teclado del editor de melodía y videos puntuales en Referencias (hoy son búsquedas).

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
- **Una herramienta:** una carpeta en `features/`, su ruta en `routes.ts` (dentro del layout de la consigna, para que se abra encima de ella en un modal) y en `react-router.config.ts`, su nombre en `TOOL_ROUTES` de `shared/toolModal.ts`, su entrada en `features/herramientas/HerramientasRoute.tsx` y en `routes` de `shell/AppShell.tsx`, y su nombre en `FEATURES` de `eslint.config.js`.

## Sobre los datos

- Muchas afinaciones por canción se transcribieron de oído. Cada tema marca su confiabilidad con `conf`, y `octaves: 'est'` indica que la fuente no daba octavas y son estimadas.
- Lo que se sortea (`data/pools.ts`) y el mazo de cartas son un primer borrador para editar.
- Las estructuras de `data/forms.ts` están simplificadas, y los minutos de cada sección los marca cada persona al escuchar.
- La lista del diccionario de rimas (`public/palabras.txt`) sale del paquete [an-array-of-spanish-words](https://www.npmjs.com/package/an-array-of-spanish-words), con licencia MIT. Se regenera con `scripts/build-words.ts`.
