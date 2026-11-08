// Letra del lienzo: sílabas métricas (con sinalefa, de core/spanish), rima asonante, estabilidad y
// versos espejo. Todo se mide por verso.
import { assonantKey, lastWord, metricCount } from '../spanish';
import type { Check } from './harmony';

export const linesOf = (text: string | undefined) => (text ?? '').split('\n').filter((line) => line.trim());

/** Sílabas métricas: sinalefa, y la final aguda suma una. */
export const syllables = (line: string) => metricCount(line).total;

/** Asonancia: la vocal tónica y la última de la última palabra. */
export const rhymeKey = (line: string) => assonantKey(lastWord(line));

export interface Stability {
  /** null si no hay versos. */
  stable: boolean | null;
  label: string;
  why: string;
  /** Una letra de rima por verso: ABAB. */
  scheme: string[];
}

/** Estable si los versos son pares, de largo parejo (±1) y el último rima con alguno. */
export function stability(lines: readonly string[]): Stability {
  if (!lines.length) return { stable: null, label: 'Todavía vacía', why: '', scheme: [] };
  const counts = lines.map(syllables);
  const letters: Record<string, string> = {};
  const scheme = lines.map((line) => {
    const key = rhymeKey(line);
    letters[key] ??= String.fromCharCode(65 + Object.keys(letters).length);
    return letters[key];
  });
  const even = lines.length % 2 === 0;
  const level = Math.max(...counts) - Math.min(...counts) <= 1;
  const closes = lines.length > 1 && scheme.slice(0, -1).includes(scheme[scheme.length - 1]!);
  const against = [
    ...(even ? [] : [`${lines.length} versos, impar`]),
    ...(level ? [] : ['largos distintos']),
    ...(closes ? [] : ['el último no rima']),
  ];
  const favor = [
    ...(even ? [`${lines.length} versos`] : []),
    ...(level ? ['largos parejos'] : []),
    ...(closes ? [`rima que cierra (${scheme.join('')})`] : []),
  ];
  const stable = against.length === 0;
  return {
    stable,
    scheme,
    label: stable
      ? 'Estable: cierra.'
      : against.length === 1
        ? 'Casi estable.'
        : 'Inestable: deja algo abierto.',
    why: [
      favor.length ? `A favor: ${favor.join(', ')}.` : '',
      against.length ? `En contra: ${against.join(', ')}.` : '',
    ]
      .filter(Boolean)
      .join(' '),
  };
}

/** Versos espejo: el verso y su pareja (1-2, 3-4…) tienen las mismas sílabas. */
export function mirrors(lines: readonly string[]): boolean[] {
  const counts = lines.map(syllables);
  return counts.map((n, i) => {
    const pair = i % 2 ? counts[i - 1] : counts[i + 1];
    return pair !== undefined && pair === n;
  });
}

/** Lo que la consigna le pide a la letra. */
export type LyricRule = { kind: 'metro'; syllables: number } | { kind: 'sin'; word: string } | null;

export function checkLyric(text: string, rule: LyricRule): Check | null {
  if (!rule) return null;
  const lines = linesOf(text);
  if (!lines.length) return { ok: false, why: 'Sin versos todavía.' };
  if (rule.kind === 'sin') {
    const word = rule.word.toLowerCase();
    const bad = lines.filter((line) => line.toLowerCase().includes(word)).length;
    return bad
      ? { ok: false, why: `${bad} versos dicen “${rule.word}”.` }
      : { ok: true, why: `Ninguno dice “${rule.word}”.` };
  }
  const good = lines.filter((line) => syllables(line) === rule.syllables).length;
  return { ok: good === lines.length, why: `${good} de ${lines.length} versos de ${rule.syllables}.` };
}
