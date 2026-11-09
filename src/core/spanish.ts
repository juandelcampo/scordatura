// Métrica en español: sílabas, acento, sinalefa, rima y prosodia.
// Sigue las reglas generales. La poesía admite licencias (diéresis, sinéresis) que dependen
// de la lectura, así que el resultado es una guía y no un veredicto.

const STRONG = 'aeoáéó';
const WEAK = 'iuü';
const ACCENTED = 'áéíóú';
const VOWELS = 'aeiouáéíóúü';

const isVowel = (char: string | undefined) => !!char && VOWELS.includes(char);
/** La u de "que", "qui", "gue" y "gui" no suena: es parte de la consonante. */
const silentU = (text: string, i: number) =>
  text[i] === 'u' && (text[i - 1] === 'q' || text[i - 1] === 'g') && 'eiéí'.includes(text[i + 1] ?? '');
const vowelAt = (text: string, i: number) => isVowel(text[i]) && !silentU(text, i);
// "tl" va junto, como se pronuncia en América: a-tlas. "qu" y "gu" con la u muda, también: a-quí.
const INSEPARABLE = /^(?:[bcfgkp][lr]|[dt]r|tl|ch|ll|rr|qu|gu)$/;

/** Parte una palabra en sílabas ortográficas. */
export function syllabify(word: string): string[] {
  const text = word.toLowerCase().replace(/[^a-záéíóúüñ]/g, '');
  const syllables: string[] = [];
  let current = '';
  let i = 0;
  while (i < text.length) {
    const char = text[i]!;
    current += char;
    if (!vowelAt(text, i)) {
      i += 1;
      continue;
    }
    // Núcleo: junta vocales mientras formen diptongo o triptongo.
    let j = i + 1;
    while (vowelAt(text, j) && !splitsVowels(text[j - 1]!, text[j]!)) {
      current += text[j];
      j += 1;
    }
    let k = j;
    while (k < text.length && !vowelAt(text, k)) k += 1;
    const consonants = text.slice(j, k);
    if (k >= text.length) {
      current += consonants;
      j = k;
    } else if (consonants.length === 0) {
      // Vocales en hiato: la siguiente abre otra sílaba.
    } else if (consonants.length === 1) {
      // Una consonante entre vocales va con la sílaba que sigue.
    } else {
      const lastTwo = consonants.slice(-2);
      const keep = INSEPARABLE.test(lastTwo) ? consonants.length - 2 : consonants.length - 1;
      current += consonants.slice(0, keep);
      j += keep;
    }
    syllables.push(current);
    current = '';
    i = j;
  }
  if (current) {
    if (syllables.length) syllables[syllables.length - 1] += current;
    else syllables.push(current);
  }
  return syllables;
}

function splitsVowels(first: string, second: string): boolean {
  // Dos fuertes, o una débil con tilde, forman hiato.
  if (STRONG.includes(first) && STRONG.includes(second)) return true;
  if ('íú'.includes(first) || 'íú'.includes(second)) return true;
  // "ui" y "iu" forman diptongo; dos iguales, hiato.
  if (first === second) return true;
  return false;
}

export type StressType = 'aguda' | 'llana' | 'esdrujula';

/** Índice de la sílaba tónica, contado desde el principio. */
export function stressIndex(word: string): number {
  const syllables = syllabify(word);
  const withAccent = syllables.findIndex((syllable) => [...syllable].some((char) => ACCENTED.includes(char)));
  if (withAccent >= 0) return withAccent;
  if (syllables.length === 1) return 0;
  const clean = word.toLowerCase().replace(/[^a-záéíóúüñ]/g, '');
  return /[aeiouns]$/.test(clean) ? syllables.length - 2 : syllables.length - 1;
}

export function stressType(word: string): StressType {
  const fromEnd = syllabify(word).length - 1 - stressIndex(word);
  return fromEnd <= 0 ? 'aguda' : fromEnd === 1 ? 'llana' : 'esdrujula';
}

const WORD_PATTERN = /[a-záéíóúüñ]+/gi;

export const wordsIn = (line: string): string[] => line.match(WORD_PATTERN) ?? [];

/** Palabras átonas: al cantarlas o recitarlas no llevan acento propio. */
const UNSTRESSED = new Set(
  'a al ante con de del el en la las le les lo los me mi mis nos o os para pero por que se si sin su sus te tu tus u un una unas unos y e ni como'.split(
    ' ',
  ),
);

export interface MetricSyllable {
  text: string;
  stressed: boolean;
}

/** Sílabas métricas de un verso: aplica sinalefa entre palabras y conserva los acentos. */
export function metricSyllables(line: string): MetricSyllable[] {
  const result: MetricSyllable[] = [];
  let previousLength = 0;
  let previousWord = '';
  for (const word of wordsIn(line)) {
    const syllables = syllabify(word);
    const stress = stressIndex(word);
    const unstressed = UNSTRESSED.has(word.toLowerCase());
    syllables.forEach((syllable, index) => {
      const stressed = !unstressed && index === stress;
      const previous = result[result.length - 1];
      // "y" sola es una vocal. "Hie-" y "hue-" (hierba, huella) suenan con consonante y frenan la
      // sinalefa. Una y final (soy, muy) pasa a ser consonante de la sílaba que sigue: so-yun.
      const lower = word.toLowerCase();
      const startsWithVowel =
        lower === 'y' || (isVowel(syllable.replace(/^h/, '')[0]) && !/^h[iu][aeoáéó]/.test(lower));
      const endsWithVowel =
        !!previous && (isVowel(previous.text[previous.text.length - 1]) || previousWord === 'y');
      // La sinalefa une el final y el principio de dos palabras. Si ambas sílabas son tónicas suele
      // leerse en hiato, salvo con monosílabos: "no hay" se dice en una sola sílaba.
      const bothStressed = !!previous?.stressed && stressed;
      const hiatus = bothStressed && previousLength > 1 && syllables.length > 1;
      if (index === 0 && previous && startsWithVowel && endsWithVowel && !hiatus) {
        previous.text += `‿${syllable}`;
        previous.stressed = previous.stressed || stressed;
      } else {
        result.push({ text: syllable, stressed });
      }
    });
    previousLength = syllables.length;
    previousWord = word.toLowerCase();
  }
  return result;
}

export interface MetricCount {
  syllables: number;
  adjustment: number;
  total: number;
  ending: StressType | null;
}

/** Cuenta métrica: una final aguda suma una sílaba y una esdrújula resta una. */
export function metricCount(line: string): MetricCount {
  const words = wordsIn(line);
  const syllables = metricSyllables(line).length;
  const lastWord = words[words.length - 1];
  if (!lastWord) return { syllables: 0, adjustment: 0, total: 0, ending: null };
  const ending = stressType(lastWord);
  const adjustment = ending === 'aguda' ? 1 : ending === 'esdrujula' ? -1 : 0;
  return { syllables, adjustment, total: syllables + adjustment, ending };
}

const stripAccents = (text: string) => text.normalize('NFD').replace(/[̀-̂̄-ͯ]/g, '').normalize('NFC');

/** Terminación de la palabra desde la vocal tónica. Base de la rima. */
function rhymeTail(word: string): string {
  const syllables = syllabify(word);
  const index = stressIndex(word);
  const tail = syllables.slice(index);
  const first = tail[0] ?? '';
  // La rima arranca en la última vocal del núcleo tónico.
  let position = first.length - 1;
  while (position > 0 && !isVowel(first[position])) position -= 1;
  const accented = [...first].findIndex((char) => ACCENTED.includes(char));
  if (accented >= 0) position = accented;
  else {
    while (position > 0 && isVowel(first[position - 1]) && STRONG.includes(first[position - 1]!))
      position -= 1;
    while (position > 0 && WEAK.includes(first[position]!) && isVowel(first[position - 1])) position -= 1;
  }
  return stripAccents(first.slice(position) + tail.slice(1).join(''))
    .replace(/[áà]/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/ü/g, 'u');
}

/** Clave de rima consonante: todos los sonidos desde la vocal tónica. */
export const consonantKey = (word: string) =>
  rhymeTail(word)
    .replace(/[vb]/g, 'b')
    .replace(/[zc](?=[ei])/g, 's')
    .replace(/z/g, 's');

/** Clave de rima asonante: solo las vocales, sin las débiles de un diptongo átono. */
export const assonantKey = (word: string) => assonantOfTail(rhymeTail(word));

/**
 * La asonancia sale de la terminación: la vocal tónica y la última. Sirve también con la clave
 * consonante, que cambia consonantes pero deja las vocales.
 */
export function assonantOfTail(tail: string): string {
  const vowels = [...tail].filter((char) => 'aeiou'.includes(char));
  if (vowels.length <= 1) return vowels.join('');
  return `${vowels[0]}${vowels[vowels.length - 1]}`;
}

export const lastWord = (line: string) => {
  const words = wordsIn(line);
  return words[words.length - 1] ?? '';
};

/** Letras de rima de una estrofa: AABB, ABAB… Un verso sin pareja queda con guion. */
export function rhymeScheme(lines: string[], kind: 'consonante' | 'asonante'): string[] {
  const keyOf = kind === 'consonante' ? consonantKey : assonantKey;
  const keys = lines.map((line) => (lastWord(line) ? keyOf(lastWord(line)) : ''));
  const letters = new Map<string, string>();
  return keys.map((key, index) => {
    if (!key) return '';
    const paired = keys.some((other, otherIndex) => otherIndex !== index && other === key);
    if (!paired) return '–';
    if (!letters.has(key)) letters.set(key, String.fromCharCode(65 + letters.size));
    return letters.get(key)!;
  });
}

/** Compara lo escrito con un esquema pedido. Devuelve qué versos no cumplen. */
export function schemeProblems(actualKeys: string[], wanted: string): number[] {
  const groups = new Map<string, Set<string>>();
  [...wanted].forEach((letter, index) => {
    const key = actualKeys[index];
    if (!key) return;
    if (!groups.has(letter)) groups.set(letter, new Set());
    groups.get(letter)!.add(key);
  });
  const owners = new Map<string, string>();
  const problems: number[] = [];
  [...wanted].forEach((letter, index) => {
    const key = actualKeys[index];
    if (!key) return;
    const size = groups.get(letter)!.size;
    const taken = owners.get(key);
    if (size > 1 || (taken && taken !== letter)) problems.push(index);
    owners.set(key, letter);
  });
  return problems;
}

export interface ProsodyCell {
  text: string;
  stressed: boolean;
  /** Tiempo fuerte del compás. */
  strong: boolean;
  /** Sílaba tónica en un tiempo débil: el problema que marca la herramienta. */
  clash: boolean;
}

/**
 * Pone un verso sobre el compás, una sílaba por pulso. `strongEvery` es cada cuántos pulsos cae
 * un tiempo fuerte, y `pickup` cuántas sílabas entran antes del primero.
 */
export function prosody(line: string, strongEvery: number, pickup = 0): ProsodyCell[] {
  return metricSyllables(line).map((syllable, index) => {
    const position = index - pickup;
    const strong = position >= 0 && position % strongEvery === 0;
    return { text: syllable.text, stressed: syllable.stressed, strong, clash: syllable.stressed && !strong };
  });
}

/** Corta frases en pedazos de 2 a 4 palabras, para mezclarlos. */
export function cutUp(text: string, next: () => number): string[] {
  const pieces: string[] = [];
  for (const line of text.split('\n')) {
    const words = line.trim().split(/\s+/).filter(Boolean);
    let i = 0;
    while (i < words.length) {
      const size = 2 + Math.floor(next() * 3);
      pieces.push(words.slice(i, i + size).join(' '));
      i += size;
    }
  }
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j]!, pieces[i]!];
  }
  return pieces;
}
