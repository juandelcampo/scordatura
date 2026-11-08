// Herramientas de letra: la Lupa, el molde, la letra de relleno, de sonido a palabra, la escalera y
// el texto encontrado. Todo recibe el azar de afuera para poder repetirlo.
import type { Rng } from '../rng';
import {
  ABSTRACT_WORDS,
  DUMMY_FILL,
  DUMMY_RHYMES,
  JOBS,
  NEAR_THINGS,
  SOUND_BANK,
  type Mold,
} from '~/data/lyrics-material';
import { rhymeKey, syllables } from './lyrics';

export interface LupaItem {
  tone: 'ok' | 'warn' | '';
  t: string;
}

const WORD = /[a-záéíóúüñ]+/g;
const plain = (w: string) => w.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function lupa(lines: readonly string[], title: string): LupaItem[] {
  if (!lines.length) return [];
  const out: LupaItem[] = [];
  const words = lines.join(' ').toLowerCase().match(WORD) ?? [];
  const uniq = <T>(xs: T[]) => [...new Set(xs)];
  const abstract = uniq(words.filter((w) => ABSTRACT_WORDS.includes(w)));
  out.push(
    abstract.length
      ? { tone: 'warn', t: `Abstractas: ${abstract.join(', ')}.` }
      : { tone: 'ok', t: 'Nada abstracto.' },
  );
  const names = uniq(
    lines.flatMap((l) =>
      l
        .split(/\s+/)
        .slice(1)
        .map((w) => w.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, ''))
        .filter((w) => /^[A-ZÁÉÍÓÚÑ]/.test(w)),
    ),
  );
  out.push(
    names.length
      ? { tone: 'ok', t: `Nombres: ${names.join(', ')}.` }
      : { tone: '', t: 'Sin nombres propios.' },
  );
  const count = (list: string[]) => words.filter((w) => list.includes(w)).length;
  const yo = count(['yo', 'me', 'mi', 'mis', 'conmigo', 'tengo', 'soy', 'estoy']);
  const vos = count(['vos', 'te', 'tu', 'tus', 'contigo', 'ti', 'tú']);
  const el = count(['él', 'ella', 'ellos', 'ellas', 'su', 'sus']);
  const who =
    yo && yo >= el
      ? `Habla un yo${vos ? ' a un vos' : ''}.`
      : el > vos
        ? 'Tercera persona.'
        : vos
          ? 'Le habla a un vos.'
          : 'No se sabe quién habla.';
  out.push({ tone: '', t: who });
  const lowTitle = title.toLowerCase();
  const tally = new Map<string, number>();
  for (const w of words) if (w.length > 3 && !lowTitle.includes(w)) tally.set(w, (tally.get(w) ?? 0) + 1);
  const repeated = [...tally].filter(([, n]) => n > 2);
  if (repeated.length)
    out.push({ tone: 'warn', t: `Repetís ${repeated.map(([w, n]) => `“${w}” ${n}x`).join(', ')}.` });
  const ends = lines.map((l) => plain((l.toLowerCase().match(WORD) ?? []).at(-1) ?? ''));
  const keys = lines.map(rhymeKey);
  let consonant = 0;
  let assonant = 0;
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++)
      if (keys[i] && keys[i] === keys[j]) {
        if (ends[i]!.slice(-3) === ends[j]!.slice(-3)) consonant += 1;
        else assonant += 1;
      }
  out.push({
    tone: '',
    t: consonant || assonant ? (consonant >= assonant ? 'Rima consonante.' : 'Rima asonante.') : 'Sin rima.',
  });
  return out;
}

export interface MoldCheck {
  ok: boolean;
  count: boolean;
  lengths: boolean;
  rhymes: boolean;
  t: string;
}

/** La letra contra un molde: sílabas por verso, cantidad de versos y lugar de la rima. */
export function checkMold(lines: readonly string[], mold: Mold): MoldCheck {
  const { pattern, scheme } = mold;
  const lengths = lines.every((l, i) => syllables(l) === pattern[i % pattern.length]);
  const keys = lines.map(rhymeKey);
  let rhymes = true;
  lines.forEach((_, i) => {
    const letter = scheme[i % scheme.length];
    if (letter === 'x') return;
    for (let j = 0; j < i; j++) {
      if (
        Math.floor(j / scheme.length) === Math.floor(i / scheme.length) &&
        scheme[j % scheme.length] === letter &&
        keys[j] !== keys[i]
      )
        rhymes = false;
    }
  });
  const count = lines.length > 0 && lines.length % pattern.length === 0;
  const ok = count && lengths && rhymes;
  const parts = [
    count ? `${lines.length} versos` : `pide ${pattern.length}, tiene ${lines.length}`,
    lengths ? 'sílabas justas' : 'sílabas fuera',
    rhymes ? 'rima en su lugar' : `rima fuera de ${scheme}`,
  ];
  return { ok, count, lengths, rhymes, t: `${ok ? '✓' : '✗'} ${mold.name}: ${parts.join(', ')}.` };
}

/** Versos sin sentido con la métrica justa, para sostener la melodía. */
export function makeDummy(pattern: readonly number[], scheme: string, rng: Rng): string[] {
  const families = new Map<string, string[]>();
  let family = rng.int(0, DUMMY_RHYMES.length - 1);
  return pattern.map((target, i) => {
    const letter = scheme[i % scheme.length] ?? 'x';
    let end: string;
    if (letter !== 'x') {
      if (!families.has(letter)) {
        const list = [...DUMMY_RHYMES[family % DUMMY_RHYMES.length]!];
        for (let k = list.length - 1; k > 0; k--) {
          const j = rng.int(0, k);
          [list[k], list[j]] = [list[j]!, list[k]!];
        }
        families.set(letter, list);
        family += 1;
      }
      end = families.get(letter)!.pop() ?? 'limón';
    } else end = rng.pick(DUMMY_FILL.slice(9));
    const need = target - syllables(end);
    for (let attempt = 0; attempt < 120; attempt++) {
      const words: string[] = [];
      while (syllables(words.join(' ')) < need) words.push(rng.pick(DUMMY_FILL));
      const line = [...words, end].join(' ');
      if (syllables(line) === target) return line;
    }
    return end;
  });
}

/** Las vocales que se cantan: en un diptongo cuenta la fuerte. */
export function vowelsOf(text: string): string {
  const n = plain(text.toLowerCase())
    .replace(/qu(?=[ei])/g, 'q')
    .replace(/gu(?=[ei])/g, 'g');
  return (n.match(/[aeiou]+/g) ?? [])
    .map((g) => {
      if (g.length === 1) return g;
      const strong = g.replace(/[iu]/g, '');
      return strong.length ? strong[0]! : g.slice(-1);
    })
    .join('');
}

/** Tres versos con palabras que tienen esas vocales en ese orden. */
export function soundWords(sequence: string, rng: Rng): string[] {
  return [0, 1, 2].map(() => {
    let rest = sequence;
    const line: string[] = [];
    for (let guard = 0; rest && guard < 60; guard++) {
      const options = SOUND_BANK.filter((w) => {
        const v = vowelsOf(w);
        return v && rest.startsWith(v) && (v.length > 1 || rng.next() < 0.5);
      });
      if (!options.length) {
        line.push('la');
        rest = rest.slice(1);
        continue;
      }
      const w = rng.pick(options);
      line.push(w);
      rest = rest.slice(vowelsOf(w).length);
    }
    return line.join(' ');
  });
}

/** Verbos de un oficio cruzados con cosas que tenés cerca. */
export function ladder(rng: Rng): { job: string; pairs: string[] } {
  const [job, verbs] = rng.pick(JOBS);
  const things = [...NEAR_THINGS];
  for (let k = things.length - 1; k > 0; k--) {
    const j = rng.int(0, k);
    [things[k], things[j]] = [things[j]!, things[k]!];
  }
  return { job, pairs: verbs.slice(0, 5).map((v, i) => `${v} ${things[i]}`) };
}

/** Un afiche o un diario cortado en frases de 3 a 9 palabras, sin repetir las que ya hay. */
export function foundPhrases(text: string, have: readonly string[]): string[] {
  const known = new Set(have.map((t) => t.toLowerCase()));
  const out: string[] = [];
  for (const raw of text.split(/[.,;:!?¡¿\n()“”"]+/)) {
    const t = raw.trim().replace(/\s+/g, ' ');
    const words = t.split(' ').length;
    if (words < 3 || words > 9) continue;
    const lower = t.charAt(0).toLowerCase() + t.slice(1);
    if (known.has(lower.toLowerCase())) continue;
    known.add(lower.toLowerCase());
    out.push(lower);
  }
  return out;
}

/** Corta un texto en pedazos de tres palabras y los mezcla de a dos. */
export function cutAndMix(text: string, rng: Rng): string[] {
  const words = text
    .replace(/[“”.,]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += 3) chunks.push(words.slice(i, i + 3).join(' '));
  for (let k = chunks.length - 1; k > 0; k--) {
    const j = rng.int(0, k);
    [chunks[k], chunks[j]] = [chunks[j]!, chunks[k]!];
  }
  return [0, 1, 2, 3].map((i) => `${chunks[i * 2] ?? ''} ${chunks[i * 2 + 1] ?? ''}`.trim()).filter(Boolean);
}
