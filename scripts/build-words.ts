// Genera public/palabras.txt, la lista del diccionario de rimas, a partir del diccionario Hunspell
// de español de RLA-ES (licencia MPL 1.1, GPL 3 o LGPL 3, a elección). Hace falta con tildes: sin
// ellas no se sabe dónde va el acento, y "canción" deja de rimar con "corazón".
// Expande cada raíz con sus sufijos y prefijos (plurales, femeninos, conjugaciones) y suma el voseo,
// que el diccionario no trae. La app la pide recién cuando alguien busca la primera rima.
// Sale agrupada por rima consonante, una línea por rima: "on	acción canción corazón…". Buscar una
// rima es leer una línea, sin recorrer cuatrocientas mil palabras en cada búsqueda.
// Uso: node scripts/build-words.ts [carpeta con es_ES.aff y es_ES.dic]
//      En Debian y Ubuntu vienen con el paquete hunspell-es, en /usr/share/hunspell.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { consonantKey } from '../src/core/spanish.ts';

const dir = process.argv[2] ?? '/usr/share/hunspell';
const aff = readFileSync(join(dir, 'es_ES.aff'), 'utf8').split('\n');
const dic = readFileSync(join(dir, 'es_ES.dic'), 'utf8').split('\n').slice(1);

interface Rule {
  strip: string;
  add: string;
  next: string;
  test: RegExp;
}
interface Affix {
  prefix: boolean;
  cross: boolean;
  rules: Rule[];
}

const affixes = new Map<string, Affix>();
for (const line of aff) {
  const parts = line.trim().split(/\s+/);
  if (parts[0] !== 'SFX' && parts[0] !== 'PFX') continue;
  const prefix = parts[0] === 'PFX';
  const flag = parts[1]!;
  if (!affixes.has(flag)) {
    // La primera línea de cada grupo es la cabecera: SFX A Y 14.
    affixes.set(flag, { prefix, cross: parts[2] === 'Y', rules: [] });
    continue;
  }
  const [add = '', next = ''] = (parts[3] ?? '').split('/');
  const condition = parts[4] ?? '.';
  affixes.get(flag)!.rules.push({
    strip: parts[2] === '0' ? '' : parts[2]!,
    add: add === '0' ? '' : add,
    next,
    test: new RegExp(prefix ? `^${condition}` : `${condition}$`),
  });
}

// Los grupos que pegan pronombres al verbo (cantarla, mirándote, dámelo) no sirven para rimar: son
// miles y tapan a las palabras de verdad. Se reconocen porque todas sus reglas terminan en pronombre.
const CLITIC = /(?:me|te|se|nos|os|lo|la|los|las|le|les)$/;
const skip = new Set(
  [...affixes]
    .filter(([, affix]) => !affix.prefix && affix.rules.every((rule) => CLITIC.test(rule.add)))
    .map(([flag]) => flag),
);

const apply = (word: string, affix: Affix, rule: Rule): string | null => {
  if (!rule.test.test(word)) return null;
  if (affix.prefix) return word.startsWith(rule.strip) ? rule.add + word.slice(rule.strip.length) : null;
  return word.endsWith(rule.strip) ? word.slice(0, word.length - rule.strip.length) + rule.add : null;
};

const VERB_FLAGS = 'REIX';

/**
 * Una raíz con todas sus formas: sufijos (y los que estos habilitan) y prefijos. Anota aparte las que
 * salen de conjugar, para poder sacar los tiempos raros sin tocar a "lugares" o "frases".
 */
function expand(stem: string, flags: string[], conjugated: Set<string>, other: Set<string>) {
  other.add(stem);
  const crossable: string[] = [stem];
  const addSuffixes = (word: string, list: string[], verb: boolean, depth: number) => {
    for (const flag of list) {
      const affix = affixes.get(flag);
      if (!affix || affix.prefix || skip.has(flag)) continue;
      const isVerb = verb || VERB_FLAGS.includes(flag);
      for (const rule of affix.rules) {
        const form = apply(word, affix, rule);
        if (!form) continue;
        (isVerb ? conjugated : other).add(form);
        if (affix.cross) crossable.push(form);
        if (rule.next && depth === 0) addSuffixes(form, [...rule.next], isVerb, 1);
      }
    }
  };
  addSuffixes(stem, flags, false, 0);
  for (const flag of flags) {
    const affix = affixes.get(flag);
    if (!affix?.prefix) continue;
    for (const rule of affix.rules)
      for (const base of affix.cross ? crossable : [stem]) {
        const form = apply(base, affix, rule);
        if (form) (conjugated.has(base) ? conjugated : other).add(form);
      }
  }
}

// Voseo rioplatense: vos cantás, comés, vivís; cantá, comé, viví. Las banderas R, E, I y X son las
// de los verbos (X, la de los irregulares).
const VOSEO: Record<string, [string, string]> = { ar: ['ás', 'á'], er: ['és', 'é'], ir: ['ís', 'í'] };

const conjugated = new Set<string>();
const other = new Set<string>();
const verbs = new Set<string>();
for (const entry of dic) {
  const [head = ''] = entry.split(/[\t ]/);
  if (!head) continue;
  const slash = head.indexOf('/');
  const stem = slash < 0 ? head : head.slice(0, slash);
  const flags = slash < 0 ? [] : [...head.slice(slash + 1)];
  expand(stem, flags, conjugated, other);
  const voseo = VOSEO[stem.slice(-2)];
  if (voseo && flags.some((flag) => VERB_FLAGS.includes(flag))) {
    verbs.add(stem);
    for (const ending of voseo) conjugated.add(stem.slice(0, -2) + ending);
  }
}
// Ser e ir no siguen la regla: vos sos, vos vas.
for (const word of ['sos', 'vas', 'andá']) other.add(word);
const all = new Set([...conjugated, ...other]);

// Algunos pronombres pegados vienen en grupos mezclados con otras formas. Si al sacarle el pronombre
// queda un infinitivo o un gerundio (mirarla, mirándote), también se va. "Parte" o "muerte" quedan.
const ACUTE: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };
const plain = (word: string) => word.replace(/[áéíóú]/g, (char) => ACUTE[char]!);
const PRONOUN = /(?:me|te|se|nos|lo|la|los|las|le|les)$/;
function hasClitic(word: string): boolean {
  let base = word;
  for (let i = 0; i < 2 && PRONOUN.test(base); i++) {
    base = base.replace(PRONOUN, '');
    const bare = plain(base);
    // Algunos verbos vienen sin sus banderas (haber, acaecer): un infinitivo largo también cuenta.
    const infinitive = /[aei]r$/.test(bare) && (verbs.has(bare) || (bare.length >= 5 && all.has(bare)));
    if (infinitive || (bare.endsWith('ndo') && all.has(bare))) return true;
  }
  return false;
}

// El vosotros casi no se canta de este lado, y el futuro de subjuntivo y el plural del subjuntivo en
// -se casi no se usan: llenarían la lista de formas que nadie elige (cantáis, dictásemos). Las formas
// cortas que terminan igual (pase, quiere, pare) son de otros tiempos y se quedan.
const RARE =
  /(?:áis|éis|abais|íais|arais|ierais|aseis|ieseis|areis|iereis|aríais|eríais|iríais|asteis|isteis|ásemos|iésemos|áremos|iéremos)$/;
const rare = (word: string) => RARE.test(word) && conjugated.has(word) && !other.has(word);

const kept = [...all].filter((word) => /^[a-záéíóúüñ]{2,12}$/.test(word) && !rare(word) && !hasClitic(word));
const groups = new Map<string, string[]>();
for (const word of kept) {
  const key = consonantKey(word);
  if (!key) continue;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key)!.push(word);
}
const lines = [...groups]
  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  .map(([key, words]) => `${key}\t${words.sort((a, b) => a.localeCompare(b, 'es')).join(' ')}`);
writeFileSync('public/palabras.txt', lines.join('\n'));
console.log(`${kept.length} palabras de ${all.size} formas, en ${groups.size} rimas`);
