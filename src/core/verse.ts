// La letra verso por verso: estrofas, la pauta que se le pide (sílabas y esquema de rima), los
// acentos comparados entre versos y una lupa sobre las palabras. Todo sale de core/spanish.
import { ABSTRACT_WORDS } from '~/data/lyrics-material';
import {
  assonantKey,
  consonantKey,
  lastWord,
  metricCount,
  metricSyllables,
  rhymeScheme,
  wordsIn,
  type MetricCount,
} from './spanish';

export type RhymeKind = 'consonante' | 'asonante';

/**
 * Lo que se le pide a cada estrofa. `pattern` son las sílabas de cada verso y se repite; vacío, no
 * se mide. `scheme` es una letra por verso: las iguales riman, x queda libre y - no tiene que rimar
 * con ningún otro (verso blanco). Vacío, no se mide.
 */
export interface Pauta {
  pattern: number[];
  scheme: string;
}

export const FREE: Pauta = { pattern: [], scheme: '' };

const SYLLABLE_WORDS: Array<[string, number]> = [
  ['tetrasílab', 4],
  ['pentasílab', 5],
  ['hexasílab', 6],
  ['heptasílab', 7],
  ['octosílab', 8],
  ['eneasílab', 9],
  ['decasílab', 10],
  ['endecasílab', 11],
  ['dodecasílab', 12],
  ['alejandrin', 14],
];

/** La pauta que trae la consigna de letra, si trae alguna: "Octosílabos, rima ABAB". */
export function pautaFromConsigna(label: string): Pauta | null {
  const text = label.toLowerCase();
  let syllables = SYLLABLE_WORDS.find(([word]) => text.includes(word))?.[1] ?? null;
  const numeric = /(\d+) s[íi]labas/.exec(text);
  if (numeric) syllables = Number(numeric[1]);
  const scheme = /rima ([a-e]{2,})\b/.exec(text)?.[1] ?? (/sin rimar/.test(text) ? '-' : '');
  if (!syllables && !scheme) return null;
  return { pattern: syllables ? [syllables] : [], scheme };
}

const keyOf = (kind: RhymeKind) => (kind === 'consonante' ? consonantKey : assonantKey);

export interface VerseLine {
  /** Posición en el texto, contando las líneas vacías. */
  row: number;
  text: string;
  stanza: number;
  /** Posición dentro de la estrofa. */
  index: number;
  count: MetricCount;
  /** Las sílabas que pide la pauta, o null. */
  want: number | null;
  /** Letra de rima dentro de la estrofa: A, B… o – si no rima con ningún otro. */
  letter: string;
  /** Lo que pide el esquema para este verso: a, b, x, - o vacío. */
  wantLetter: string;
  /** Con qué verso (row) tendría que rimar y no rima; -1 si cumple o no se pide. */
  missesRow: number;
  /** Rima con otro verso aunque el esquema pide verso blanco. */
  rhymesWhenBlank: boolean;
  forbidden: boolean;
}

export interface Stanza {
  lines: VerseLine[];
}

/** Parte la letra en estrofas (las separa una línea vacía) y mide cada verso contra la pauta. */
export function analyze(text: string, pauta: Pauta, kind: RhymeKind, forbidden = ''): Stanza[] {
  const banned = forbidden.trim().toLowerCase();
  const rows = text.split('\n');
  const groups: Array<Array<{ row: number; text: string }>> = [];
  let current: Array<{ row: number; text: string }> = [];
  rows.forEach((line, row) => {
    if (wordsIn(line).length === 0) {
      if (current.length) groups.push(current);
      current = [];
    } else current.push({ row, text: line });
  });
  if (current.length) groups.push(current);

  const key = keyOf(kind);
  return groups.map((group, stanza) => {
    const letters = rhymeScheme(
      group.map((line) => line.text),
      kind,
    );
    const keys = group.map((line) => key(lastWord(line.text)));
    const size = pauta.scheme.length;
    const lines = group.map(({ row, text: line }, index): VerseLine => {
      const wantLetter = size ? pauta.scheme[index % size]! : '';
      // El esquema se repite: cada vuelta compara solo con los versos de su misma vuelta.
      const start = size ? index - (index % size) : 0;
      let missesRow = -1;
      if (wantLetter && wantLetter !== 'x' && wantLetter !== '-') {
        for (let j = start; j < index; j++) {
          if (pauta.scheme[j % size] === wantLetter && keys[j] !== keys[index]) {
            missesRow = group[j]!.row;
            break;
          }
        }
      }
      const rhymesWhenBlank =
        wantLetter === '-' && keys.some((other, j) => j !== index && other !== '' && other === keys[index]);
      return {
        row,
        text: line,
        stanza,
        index,
        count: metricCount(line),
        want: pauta.pattern.length ? pauta.pattern[index % pauta.pattern.length]! : null,
        letter: letters[index] ?? '',
        wantLetter,
        missesRow,
        rhymesWhenBlank,
        forbidden: banned !== '' && wordsIn(line).some((word) => word.toLowerCase() === banned),
      };
    });
    return { lines };
  });
}

/** "verso 3", "versos 1, 2 y 4". */
function verses(rows: number[]): string {
  const numbers = rows.map((row) => row + 1);
  if (numbers.length === 1) return `verso ${numbers[0]}`;
  return `versos ${numbers.slice(0, -1).join(', ')} y ${numbers[numbers.length - 1]}`;
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Lo que no cumple, en palabras. Los versos con el mismo problema van juntos. */
export function problems(stanzas: Stanza[], pauta: Pauta): string[] {
  const lines = stanzas.flatMap((stanza) => stanza.lines);
  const out: string[] = [];
  const offBy = new Map<string, number[]>();
  for (const line of lines) {
    if (line.want === null || line.count.total === line.want) continue;
    const key = `${line.count.total}/${line.want}`;
    offBy.set(key, [...(offBy.get(key) ?? []), line.row]);
  }
  for (const [key, rows] of offBy) {
    const [count, want] = key.split('/');
    out.push(`${capital(verses(rows))}: ${count} sílabas, ${rows.length > 1 ? 'piden' : 'pide'} ${want}.`);
  }
  for (const line of lines)
    if (line.missesRow >= 0)
      out.push(`${capital(verses([line.row]))}: no rima con el ${line.missesRow + 1}.`);
  const blank = lines.filter((line) => line.rhymesWhenBlank).map((line) => line.row);
  if (blank.length) out.push(`${capital(verses(blank))}: riman, y la pauta pide versos sin rima.`);
  const banned = lines.filter((line) => line.forbidden).map((line) => line.row);
  if (banned.length)
    out.push(`${capital(verses(banned))}: usa${banned.length > 1 ? 'n' : ''} la palabra prohibida.`);
  const size = pauta.scheme.length;
  if (size > 1 && /[a-e]/.test(pauta.scheme))
    for (const stanza of stanzas) {
      const count = stanza.lines.length;
      if (count % size !== 0)
        out.push(
          `La estrofa del verso ${stanza.lines[0]!.row + 1} tiene ${count} versos: el esquema va de a ${size}.`,
        );
    }
  return out;
}

export interface StressCell {
  text: string;
  stressed: boolean;
  /** Acento donde el verso de referencia no lo tiene: no va a caer bien sobre la misma melodía. */
  clash: boolean;
  /** La referencia acentúa acá y este verso no. */
  missing: boolean;
}

export interface StressRow {
  row: number;
  /** Celdas vacías antes, para alinear. */
  offset: number;
  cells: StressCell[];
  /** Posiciones de los acentos, contadas desde 1: "3 · 7". */
  positions: number[];
}

export type Align = 'final' | 'inicio';

/**
 * Los acentos de cada verso, uno debajo del otro. Los versos que van sobre la misma melodía tienen
 * que acentuar en los mismos lugares. Alineados por el último acento, que es donde cierra la frase
 * musical, las sílabas de más quedan como anacrusa al principio.
 */
export function stressRows(lines: VerseLine[], reference: number, align: Align): StressRow[] {
  const parsed = lines.map((line) => {
    const syllables = metricSyllables(line.text);
    const positions = syllables.flatMap((syllable, index) => (syllable.stressed ? [index] : []));
    return { line, syllables, positions, last: positions[positions.length - 1] ?? syllables.length - 1 };
  });
  const anchor = Math.max(0, ...parsed.map((item) => item.last));
  const withOffset = parsed.map((item) => ({ ...item, offset: align === 'final' ? anchor - item.last : 0 }));
  const ref = withOffset.find((item) => item.line.row === reference) ?? withOffset[0];
  const refStress = new Set(ref ? ref.positions.map((position) => position + ref.offset) : []);
  const refLength = ref ? ref.offset + ref.syllables.length : 0;
  return withOffset.map(({ line, syllables, positions, offset }) => {
    const isRef = line.row === ref?.line.row;
    return {
      row: line.row,
      offset,
      positions: positions.map((position) => position + 1),
      cells: syllables.map((syllable, index) => {
        const column = index + offset;
        const inRef = column < refLength;
        return {
          text: syllable.text,
          stressed: syllable.stressed,
          clash: !isRef && syllable.stressed && inRef && !refStress.has(column),
          missing: !isRef && !syllable.stressed && refStress.has(column),
        };
      }),
    };
  });
}

/** Palabras que no dicen nada de quién habla ni de qué: se saltean al buscar repeticiones. */
const FILLER = new Set(
  'para pero como cuando donde porque todo toda todos todas nada algo esta este esto estas estos aquí allí siempre nunca solo sola muy más menos hasta desde entre sobre tengo tiene estoy está están eres somos'.split(
    ' ',
  ),
);

export interface LupaNote {
  tone: 'warn' | 'ok' | '';
  text: string;
}

/** Una mirada a las palabras: abstracciones, repeticiones y quién le habla a quién. */
export function lupa(text: string): LupaNote[] {
  const words = wordsIn(text).map((word) => word.toLowerCase());
  if (words.length === 0) return [];
  const notes: LupaNote[] = [];
  const abstract = [...new Set(words.filter((word) => ABSTRACT_WORDS.includes(word)))];
  notes.push(
    abstract.length
      ? {
          tone: 'warn',
          text: `Palabras abstractas: ${abstract.join(', ')}. Probá con algo que se vea o se toque.`,
        }
      : { tone: 'ok', text: 'Nada abstracto: todo se puede ver o tocar.' },
  );
  const tally = new Map<string, number>();
  for (const word of words)
    if (word.length > 3 && !FILLER.has(word)) tally.set(word, (tally.get(word) ?? 0) + 1);
  const repeated = [...tally].filter(([, times]) => times > 2).sort((a, b) => b[1] - a[1]);
  if (repeated.length)
    notes.push({
      tone: 'warn',
      text: `Se repite ${repeated.map(([word, times]) => `“${word}” (${times})`).join(', ')}. Si es el gancho, está bien.`,
    });
  const count = (list: string[]) => words.filter((word) => list.includes(word)).length;
  const yo = count(['yo', 'me', 'mi', 'mis', 'conmigo', 'soy', 'estoy', 'tengo']);
  const vos = count(['vos', 'tú', 'te', 'tu', 'tus', 'ti', 'contigo', 'sos', 'estás', 'tenés']);
  const third = count(['él', 'ella', 'ellos', 'ellas']);
  const who =
    yo && vos
      ? 'Habla un yo a un vos.'
      : yo
        ? 'Habla un yo, sin nadie enfrente.'
        : vos
          ? 'Le habla a un vos.'
          : third
            ? 'Cuenta sobre otros, en tercera persona.'
            : 'No se sabe quién habla.';
  notes.push({ tone: '', text: who });
  return notes;
}
