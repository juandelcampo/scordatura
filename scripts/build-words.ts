// Genera public/palabras.txt, la lista del diccionario de rimas, a partir del paquete
// an-array-of-spanish-words (licencia MIT). Se carga recién cuando alguien abre el diccionario.
// Uso: npm i --no-save an-array-of-spanish-words && node scripts/build-words.ts
import { readFileSync, writeFileSync } from 'node:fs';

const words: string[] = JSON.parse(readFileSync('node_modules/an-array-of-spanish-words/index.json', 'utf8'));

// Fuera las formas que casi nunca sirven al escribir: pronombres pegados y tiempos muy raros.
const RARE_ENDING =
  /(?:[aeiáéí]r(?:se|me|te|lo|la|le|nos|los|las|les)|ndo(?:se|me|te|lo|la|le|nos|los|las|les)|[áéí]\w*(?:se|me|te|lo|la|le|nos|los|las|les)|(?:eis|éis|ais|áis|ase|ese|are|iere|asen|esen|aren|ieren|ases|eses|ares|ieres|ásemos|ésemos|áremos|iéremos|isteis|asteis|abais|íais|arais|ierais|aseis|ieseis|areis|iereis|aríais|eríais|iríais|asteis|ásteis))$/;

const kept = words.filter((word) => /^[a-záéíóúüñ]{3,10}$/.test(word) && !RARE_ENDING.test(word));
writeFileSync('public/palabras.txt', kept.sort((a, b) => a.localeCompare(b, 'es')).join('\n'));
console.log(`${kept.length} palabras de ${words.length}`);
