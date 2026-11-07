// Comprueba en línea que los videos del catálogo sigan disponibles para embeber.
// No forma parte de los tests normales porque depende de la red.
import { FORM_EXAMPLES } from '../src/data/forms.ts';
import { TUNINGS } from '../src/data/tunings.ts';

const items = [...TUNINGS.flatMap((tuning) => tuning.heard ?? []), ...FORM_EXAMPLES].filter(
  (item) => item.video,
);
const videos = new Map(items.map((item) => [item.video!, item]));
let failed = 0;

for (const [id, item] of videos) {
  const watchUrl = `https://www.youtube.com/watch?v=${id}`;
  const response = await fetch(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`,
  );
  if (response.ok) {
    const { title, author_name: author } = (await response.json()) as { title: string; author_name: string };
    console.log(`OK    ${id}  ${item.artist} — ${item.song}  =>  ${author}: ${title}`);
  } else {
    failed += 1;
    console.log(`FALLA ${id}  ${item.artist} — ${item.song}  (HTTP ${response.status})`);
  }
}

console.log(`\n${videos.size - failed} de ${videos.size} videos disponibles`);
process.exitCode = failed ? 1 : 0;
