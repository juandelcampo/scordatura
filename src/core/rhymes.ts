// El diccionario de rimas. La lista viene agrupada por rima consonante (ver scripts/build-words.ts):
// buscar es leer un grupo, y la asonancia sale de las vocales de cada clave.
import { assonantKey, assonantOfTail, consonantKey, syllabify } from './spanish';

export type RhymeMode = 'consonante' | 'asonante' | 'final';

export interface RhymeIndex {
  groups: Map<string, string[]>;
}

/** Una línea por rima: "on\tacción canción corazón". */
export function parseRhymeIndex(text: string): RhymeIndex {
  const groups = new Map<string, string[]>();
  for (const line of text.split('\n')) {
    const tab = line.indexOf('\t');
    if (tab > 0) groups.set(line.slice(0, tab), line.slice(tab + 1).split(' '));
  }
  return { groups };
}

const clean = (query: string) =>
  query
    .trim()
    .toLowerCase()
    .replace(/[^a-záéíóúüñ]/g, '');

/** Todas las palabras que riman con la consulta, sin la consulta misma. */
export function findRhymes(index: RhymeIndex, query: string, mode: RhymeMode): string[] {
  const word = clean(query);
  if (!word) return [];
  if (mode === 'final') {
    const out: string[] = [];
    for (const words of index.groups.values())
      for (const item of words) if (item.endsWith(word)) out.push(item);
    return out.filter((item) => item !== word).sort((a, b) => a.localeCompare(b, 'es'));
  }
  const key = consonantKey(word);
  if (mode === 'consonante') return (index.groups.get(key) ?? []).filter((item) => item !== word);
  // Asonante sin las consonantes, que ya tienen su búsqueda: "camino" trae "olvido", no "destino".
  const vowels = assonantKey(word);
  const out: string[] = [];
  for (const [other, words] of index.groups)
    if (other !== key && assonantOfTail(other) === vowels) out.push(...words);
  return out.sort((a, b) => a.localeCompare(b, 'es'));
}

export interface RhymeGroup {
  syllables: number;
  words: string[];
  /** Cuántas hay en total con ese largo; si son más que las que se muestran, hay muestra. */
  total: number;
}

/**
 * Agrupa por cantidad de sílabas, que es lo que se busca al escribir: "una de tres que rime con
 * verde". De cada grupo muestra hasta `each`, repartidas por el alfabeto desde `offset` (0 a 1).
 */
export function groupBySyllables(words: string[], each: number, offset: number): RhymeGroup[] {
  const bySize = new Map<number, string[]>();
  for (const word of words) {
    const size = syllabify(word).length;
    if (!bySize.has(size)) bySize.set(size, []);
    bySize.get(size)!.push(word);
  }
  return [...bySize]
    .sort(([a], [b]) => a - b)
    .map(([syllables, list]) => {
      if (list.length <= each) return { syllables, words: list, total: list.length };
      const step = list.length / each;
      const start = Math.floor(offset * step);
      return {
        syllables,
        total: list.length,
        words: Array.from({ length: each }, (_, i) => list[(start + Math.floor(i * step)) % list.length]!),
      };
    });
}
