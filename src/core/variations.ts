// Variar una progresión ya escrita: qué le cabe a cada acorde, qué rol cumple en la tonalidad y cómo
// transformarla entera. Todo devuelve también el porqué, igual que los sorteos.
import type { Formula } from '~/data/formulas';
import { parseChord, type ParsedChord } from './chords';
import {
  chordName,
  FUNCTION_DEGREES,
  MODES,
  spell,
  tonicSpelling,
  triad,
  type HarmonicFunction,
  type ModeId,
  type Spelled,
} from './harmony';

export const MIN_CHORDS = 2;
/** El mismo tope que acepta una consigna compartida. */
export const MAX_CHORDS = 16;

export interface Key {
  tonic: number;
  mode: ModeId;
}

/** Un acorde en su lugar. Trabado quiere decir que las transformaciones no lo cambian. */
export interface Slot {
  name: string;
  locked: boolean;
  /** Cuántos tiempos dura. */
  beats: number;
}

export const keyName = ({ tonic, mode }: Key) => `${spell(tonicSpelling(tonic))} ${MODES[mode].name}`;

// ---- Anatomía de un acorde escrito ----

const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

type Family = 'major' | 'minor' | 'dim' | 'aug' | 'sus';

const FAMILY: Record<string, Family> = {
  '': 'major',
  '6': 'major',
  '7': 'major',
  maj7: 'major',
  '9': 'major',
  maj9: 'major',
  add9: 'major',
  m: 'minor',
  m6: 'minor',
  m7: 'minor',
  m9: 'minor',
  madd9: 'minor',
  dim: 'dim',
  dim7: 'dim',
  m7b5: 'dim',
  aug: 'aug',
  sus2: 'sus',
  sus4: 'sus',
  '7sus4': 'sus',
};

const TRIAD_OF_FAMILY: Record<Family, string> = {
  major: '',
  minor: 'm',
  dim: 'dim',
  aug: 'aug',
  sus: 'sus4',
};

interface Anatomy extends ParsedChord {
  spelled: Spelled;
  family: Family;
}

function anatomy(name: string): Anatomy | null {
  const parsed = parseChord(name);
  if (!parsed) return null;
  return {
    ...parsed,
    spelled: { letter: LETTER_INDEX[name[0]!]!, pitch: parsed.root },
    family: FAMILY[parsed.suffix] ?? 'major',
  };
}

const rootText = (chord: Anatomy) => spell(chord.spelled);
const stripBass = (name: string) => name.split('/')[0]!;

/** Una nota a cierta distancia de la raíz, escrita con la letra que le corresponde. */
const noteAt = (chord: Anatomy, letters: number, semitones: number) =>
  spell({ letter: chord.spelled.letter + letters, pitch: chord.root + semitones });

/** Cuántas letras hay de la raíz a cada intervalo: la tercera siempre es dos letras más arriba. */
const LETTERS_OF_INTERVAL: Record<number, number> = {
  2: 1,
  3: 2,
  4: 2,
  5: 3,
  6: 4,
  7: 4,
  8: 4,
  9: 5,
  10: 6,
  11: 6,
};

/** Cambia la cifra y conserva el bajo solo si sigue siendo una nota del acorde. */
function withSuffix(chord: Anatomy, suffix: string): string {
  const base = rootText(chord) + suffix;
  if (chord.bass === undefined) return base;
  const next = parseChord(base);
  const keeps = next?.intervals.some((step) => (chord.root + step) % 12 === chord.bass);
  return keeps ? `${base}${chord.name.slice(chord.name.indexOf('/'))}` : base;
}

// ---- La tonalidad ----

const FUNCTION_NAMES: Record<HarmonicFunction, string> = {
  T: 'Tónica',
  S: 'Subdominante',
  D: 'Dominante',
};

const functionOfDegree = (degree: number): HarmonicFunction =>
  (Object.keys(FUNCTION_DEGREES) as HarmonicFunction[]).find((name) =>
    (FUNCTION_DEGREES[name] as readonly number[]).includes(degree),
  )!;

const stepAbove = (mode: ModeId, degree: number, distance: number) => {
  const steps = MODES[mode].steps;
  const target = degree + distance;
  return steps[target % 7]! + (target >= 7 ? 12 : 0) - steps[degree]!;
};

function seventhSuffix(mode: ModeId, degree: number): string {
  const third = stepAbove(mode, degree, 2);
  const fifth = stepAbove(mode, degree, 4);
  const seventh = stepAbove(mode, degree, 6);
  if (fifth === 6) return 'm7b5';
  if (third === 3) return 'm7';
  return seventh === 11 ? 'maj7' : '7';
}

const degreeOfRoot = (root: number, { tonic, mode }: Key) => {
  const distance = (root - tonic + 12) % 12;
  return (MODES[mode].steps as readonly number[]).indexOf(distance);
};

/** ¿Sale de esta tonalidad? Una tríada tiene que coincidir, y una séptima también en su séptima. */
function belongsTo(chord: Anatomy, key: Key): number | null {
  const degree = degreeOfRoot(chord.root, key);
  if (degree < 0) return null;
  if (chord.family === 'sus') return degree;
  const own = triad(tonicSpelling(key.tonic), key.mode, degree).quality;
  if (TRIAD_OF_FAMILY[chord.family] !== own) return null;
  const seventh = seventhSuffix(key.mode, degree);
  const asked: Record<string, string> = {
    '7': '7',
    '9': '7',
    maj7: 'maj7',
    maj9: 'maj7',
    m7: 'm7',
    m9: 'm7',
    m7b5: 'm7b5',
  };
  if (chord.suffix === 'dim7') return null;
  const wanted = asked[chord.suffix];
  return wanted === undefined || wanted === seventh ? degree : null;
}

const parallelMode = (mode: ModeId): ModeId => (MODES[mode].steps[2] === 4 ? 'aeolian' : 'ionian');

export interface PaletteChord {
  name: string;
  role: string;
}

/** Los siete acordes de la tonalidad, en orden y con su función. */
export function diatonicChords(key: Key): PaletteChord[] {
  const tonic = tonicSpelling(key.tonic);
  return [0, 1, 2, 3, 4, 5, 6].map((degree) => ({
    name: chordName(triad(tonic, key.mode, degree)),
    role: FUNCTION_NAMES[functionOfDegree(degree)],
  }));
}

/** Los que se pueden pedir prestados al modo paralelo sin salir de la tónica. */
export function borrowedChords(key: Key): PaletteChord[] {
  const own = new Set(diatonicChords(key).map((chord) => chord.name));
  const parallel = parallelMode(key.mode);
  const tonic = tonicSpelling(key.tonic);
  return [0, 1, 2, 3, 4, 5, 6]
    .map((degree) => triad(tonic, parallel, degree))
    .filter((chord) => chord.quality !== 'dim' && !own.has(chordName(chord)))
    .map((chord) => ({ name: chordName(chord), role: `De ${MODES[parallel].name}` }));
}

/** Qué hace este acorde acá. Mira al siguiente, porque una dominante se define por adónde va. */
export function roleOf(chords: readonly string[], index: number, key: Key): string {
  const chord = anatomy(chords[index] ?? '');
  if (!chord) return '';
  const degree = belongsTo(chord, key);
  if (degree !== null) return FUNCTION_NAMES[functionOfDegree(degree)];
  const next = chords.length > 1 ? anatomy(chords[(index + 1) % chords.length]!) : null;
  if (next && (chord.suffix === '7' || chord.suffix === '9')) {
    const target = stripBass(next.name);
    if ((chord.root + 5) % 12 === next.root) return `V7 de ${target}`;
    if ((chord.root + 11) % 12 === next.root) return `subV de ${target}`;
  }
  // Una séptima ajena no le cambia el rol: el F7 de un blues sigue siendo la subdominante.
  const asTriad = { ...chord, suffix: TRIAD_OF_FAMILY[chord.family] };
  const triadDegree = belongsTo(asTriad, key);
  if (triadDegree !== null) return FUNCTION_NAMES[functionOfDegree(triadDegree)];
  if (belongsTo(asTriad, { tonic: key.tonic, mode: parallelMode(key.mode) }) !== null) return 'Prestado';
  return 'Fuera del tono';
}

// ---- Variaciones de un acorde ----

export interface Variation {
  /** Lo que se muestra. */
  label: string;
  /** Los acordes que entran: uno si reemplaza, uno o dos si se agregan antes. */
  chords: string[];
  why: string;
  action: 'replace' | 'before';
}

export interface VariationGroup {
  title: string;
  items: Variation[];
}

const COLORS: Record<string, string> = {
  '': 'La tríada sola: lo más directo.',
  '6': 'Sexta agregada: dulce, sin la tensión de la séptima.',
  '7': 'Séptima menor: pide caer una quinta abajo.',
  maj7: 'Séptima mayor: abierto, como suspendido en el aire.',
  '9': 'Dominante con novena: más grueso, de blues y funk.',
  maj9: 'Séptima mayor y novena: el máximo de aire.',
  add9: 'Novena sin séptima: brillo, sin pedir resolución.',
  aug: 'Quinta aumentada: empuja hacia arriba.',
  m: 'La tríada menor sola: lo más directo.',
  m6: 'Menor con sexta mayor: dórico, de bossa y de cine.',
  m7: 'Menor con séptima: más blando, menos dramático.',
  m9: 'Menor con novena: profundo y sin apuro.',
  madd9: 'Novena sin séptima: melancolía con brillo.',
  dim: 'Dos terceras menores: muy inestable.',
  dim7: 'Simétrico: cualquiera de sus notas puede ser la raíz.',
  m7b5: 'Semidisminuido: el ii de las tonalidades menores.',
  sus2: 'Sin tercera, con la 2.ª: ni mayor ni menor.',
  sus4: 'Sin tercera, con la 4.ª: queda esperando volver.',
  '7sus4': 'Dominante sin tercera: tensión que no se define.',
};

const COLORS_OF_FAMILY: Record<Family, string[]> = {
  major: ['', '6', '7', 'maj7', '9', 'maj9', 'add9', 'sus2', 'sus4', '7sus4', 'aug'],
  minor: ['m', 'm6', 'm7', 'm9', 'madd9', 'sus2', 'sus4', '7sus4'],
  dim: ['dim', 'dim7', 'm7b5'],
  aug: ['aug', '', '7'],
  sus: ['', 'm', 'sus2', 'sus4', '7sus4'],
};

function colorGroup(chord: Anatomy): VariationGroup {
  return {
    title: 'Color: misma raíz',
    items: COLORS_OF_FAMILY[chord.family]
      .filter((suffix) => suffix !== chord.suffix)
      .map((suffix) => {
        const name = withSuffix(chord, suffix);
        return { label: name, chords: [name], why: COLORS[suffix] ?? '', action: 'replace' as const };
      }),
  };
}

const BASS_WHY: Record<string, string> = {
  third: 'La 3.ª en el bajo: liviano, pide seguir caminando.',
  fifth: 'La 5.ª en el bajo: queda flotando, sirve de paso.',
  other: 'Otra nota del acorde en el bajo: tira hacia la que sigue.',
};

function inversionGroup(chord: Anatomy): VariationGroup {
  const plain = stripBass(chord.name);
  const items: Variation[] = [];
  if (chord.bass !== undefined) {
    items.push({
      label: plain,
      chords: [plain],
      why: 'Con la raíz en el bajo: firme, sin vuelta.',
      action: 'replace',
    });
  }
  for (const step of chord.intervals) {
    const letters = LETTERS_OF_INTERVAL[step];
    if (letters === undefined) continue;
    const bassText = noteAt(chord, letters, step);
    const name = `${plain}/${bassText}`;
    if (name === chord.name) continue;
    const kind =
      step === 3 || step === 4 ? 'third' : step === 7 || step === 6 || step === 8 ? 'fifth' : 'other';
    items.push({ label: name, chords: [name], why: BASS_WHY[kind]!, action: 'replace' });
  }
  return { title: 'Bajo: otra nota abajo', items };
}

function substituteGroup(chord: Anatomy, key: Key): VariationGroup {
  const items: Variation[] = [];
  const add = (name: string, why: string) => {
    if (name === stripBass(chord.name) || items.some((item) => item.label === name)) return;
    items.push({ label: name, chords: [name], why, action: 'replace' });
  };

  // Primero lo que cumple el mismo rol en la tonalidad.
  const degree = belongsTo(chord, key);
  if (degree !== null) {
    const fn = functionOfDegree(degree);
    const tonic = tonicSpelling(key.tonic);
    for (const other of FUNCTION_DEGREES[fn]) {
      if (other === degree) continue;
      const candidate = triad(tonic, key.mode, other);
      if (candidate.quality === 'dim' || candidate.quality === 'aug') continue;
      add(
        chordName(candidate),
        `Misma función en ${keyName(key)} (${FUNCTION_NAMES[fn].toLowerCase()}): cambia el color, no el rol.`,
      );
    }
  }

  if (chord.family === 'major') {
    add(noteAt(chord, -2, -3) + 'm', 'Relativo menor: dos notas en común, y más sombra.');
    add(noteAt(chord, 2, 4) + 'm', 'Mediante menor: dos notas en común, una tercera arriba.');
    add(rootText(chord) + 'm', 'Paralelo: misma raíz, otra luz. Es intercambio modal.');
    add(noteAt(chord, 2, 4), 'Mediante cromática: una sola nota en común, salto de color.');
  }
  if (chord.family === 'minor') {
    add(noteAt(chord, 2, 3), 'Relativo mayor: dos notas en común, y más luz.');
    add(noteAt(chord, -2, -4), 'Mediante mayor: dos notas en común, una tercera abajo.');
    add(rootText(chord), 'Paralelo: misma raíz, otra luz. Es intercambio modal.');
    add(`${noteAt(chord, -2, -3)}m`, 'Mediante cromática: una sola nota en común, salto de color.');
  }
  if (chord.suffix === '7' || chord.suffix === '9') {
    add(`${noteAt(chord, 4, 6)}7`, 'Sustituto tritonal: comparte el tritono, y baja por semitono a destino.');
    add(`${noteAt(chord, 0, 1)}dim7`, 'Disminuido medio tono arriba: tres notas en común, sin la raíz.');
  }
  if (chord.family === 'dim') {
    add(`${noteAt(chord, -2, -4)}7`, 'Es la dominante con raíz: un disminuido es un V7 sin su fundamental.');
  }
  return { title: 'Reemplazos: otra raíz', items };
}

function preparationGroup(chord: Anatomy): VariationGroup {
  const target = stripBass(chord.name);
  const dominant = `${noteAt(chord, 4, 7)}7`;
  const substitute = `${noteAt(chord, 1, 1)}7`;
  const second = noteAt(chord, 1, 2) + (chord.family === 'minor' ? 'm7b5' : 'm7');
  const passing = `${noteAt(chord, -1, -1)}dim7`;
  const items: Variation[] = [
    {
      label: dominant,
      chords: [dominant],
      why: `Dominante secundaria: ${dominant} es el V7 de ${target}.`,
      action: 'before',
    },
    {
      label: `${second} ${dominant}`,
      chords: [second, dominant],
      why: `ii–V: ${target} se vuelve una tónica de paso por dos acordes.`,
      action: 'before',
    },
    {
      label: substitute,
      chords: [substitute],
      why: `Sustituto tritonal: baja por semitono hacia ${target}.`,
      action: 'before',
    },
    {
      label: passing,
      chords: [passing],
      why: `Disminuido de paso: sube por semitono hacia ${target}.`,
      action: 'before',
    },
  ];
  if (chord.family === 'major' || chord.family === 'minor') {
    const suspended = `${rootText(chord)}sus4`;
    items.push({
      label: suspended,
      chords: [suspended],
      why: `Retardo: la 4.ª cae sobre la 3.ª de ${target}.`,
      action: 'before',
    });
  }
  return { title: 'Preparar: entra antes', items };
}

export function chordVariations(name: string, key: Key): VariationGroup[] {
  const chord = anatomy(name);
  if (!chord) return [];
  return [
    colorGroup(chord),
    substituteGroup(chord, key),
    inversionGroup(chord),
    preparationGroup(chord),
  ].filter((group) => group.items.length > 0);
}

// ---- Transformaciones de toda la progresión ----

/** Escribe una nota como la pide la tonalidad, y lo que queda afuera con su escritura más común. */
function spellInKey(pitchClass: number, key: Key): string {
  const distance = (pitchClass - key.tonic + 12) % 12;
  const degree = (MODES[key.mode].steps as readonly number[]).indexOf(distance);
  if (degree >= 0) {
    const tonic = tonicSpelling(key.tonic);
    return spell({ letter: tonic.letter + degree, pitch: pitchClass });
  }
  return spell(tonicSpelling(pitchClass));
}

/** `next` es la tonalidad de destino: las notas se escriben según ella. */
export function transposeChord(name: string, semitones: number, next: Key): string {
  const chord = parseChord(name);
  if (!chord) return name;
  const root = spellInKey(chord.root + semitones, next);
  const bass = chord.bass === undefined ? '' : `/${spellInKey(chord.bass + semitones, next)}`;
  return root + chord.suffix + bass;
}

/** Le suma la séptima que le corresponde según la tonalidad; lo que ya tiene color no se toca. */
export function enrichChord(name: string, key: Key): string {
  const chord = anatomy(name);
  if (!chord || !['', 'm', 'dim'].includes(chord.suffix)) return name;
  const own = belongsTo(chord, key);
  if (own !== null) return withSuffix(chord, seventhSuffix(key.mode, own));
  const parallel = parallelMode(key.mode);
  const borrowed = belongsTo(chord, { tonic: key.tonic, mode: parallel });
  if (borrowed !== null) return withSuffix(chord, seventhSuffix(parallel, borrowed));
  return withSuffix(chord, { '': '7', m: 'm7', dim: 'dim7' }[chord.suffix]!);
}

/** Vuelve a la tríada, sin bajo. Los suspendidos siguen sin tercera, que es lo que los define. */
export function simplifyChord(name: string): string {
  const chord = anatomy(name);
  if (!chord) return name;
  const suffix = chord.family === 'sus' && chord.suffix === 'sus2' ? 'sus2' : TRIAD_OF_FAMILY[chord.family];
  return rootText(chord) + suffix;
}

/**
 * Lleva cada acorde de su lugar en un modo al mismo lugar en otro: el IV sigue siendo IV. Lo que no
 * pertenecía al modo de origen ya era una decisión, y no se toca.
 */
export function translateChord(name: string, key: Key, target: ModeId): string {
  const chord = anatomy(name);
  if (!chord) return name;
  const degree = belongsTo(chord, key);
  if (degree === null) return name;
  const tonic = tonicSpelling(key.tonic);
  const moved = triad(tonic, target, degree);
  const root = spell(moved.root);
  if (chord.family === 'sus') return root + chord.suffix;
  const hasSeventh = ['7', '9', 'maj7', 'maj9', 'm7', 'm9', 'm7b5'].includes(chord.suffix);
  return root + (hasSeventh ? seventhSuffix(target, degree) : moved.quality);
}

interface BassOption {
  name: string;
  bass: number;
  bassText: string;
  cost: number;
}

function bassOptions(slot: Slot): BassOption[] {
  const chord = anatomy(slot.name);
  if (!chord) return [];
  const bassOf = (name: string) => name.split('/')[1] ?? rootText(chord);
  if (slot.locked) {
    return [{ name: slot.name, bass: chord.bass ?? chord.root, bassText: bassOf(slot.name), cost: 0 }];
  }
  const plain = stripBass(slot.name);
  const options: BassOption[] = [{ name: plain, bass: chord.root, bassText: rootText(chord), cost: 0 }];
  // La tercera y la quinta del acorde: la raíz sigue mandando salvo que el bajo gane algo real.
  for (const [index, cost] of [
    [1, 0.75],
    [2, 1.25],
  ] as const) {
    const step = chord.intervals[index];
    const letters = step === undefined ? undefined : LETTERS_OF_INTERVAL[step];
    if (step === undefined || letters === undefined) continue;
    const bassText = noteAt(chord, letters, step);
    options.push({ name: `${plain}/${bassText}`, bass: (chord.root + step) % 12, bassText, cost });
  }
  return options;
}

const bassDistance = (a: number, b: number) => {
  const direct = Math.abs(a - b);
  return Math.min(direct, 12 - direct);
};

/** Elige inversiones para que el bajo se mueva lo menos posible. Devuelve también la línea que queda. */
export function smoothBass(slots: readonly Slot[]): { slots: Slot[]; line: string[] } {
  const options = slots.map(bassOptions);
  if (options.some((list) => list.length === 0)) return { slots: [...slots], line: [] };
  // Programación dinámica: el mejor camino que termina en cada opción de cada acorde.
  const best: Array<Array<{ total: number; from: number }>> = [];
  options.forEach((list, index) => {
    best.push(
      list.map((option) => {
        if (index === 0) return { total: option.cost, from: -1 };
        let total = Infinity;
        let from = 0;
        options[index - 1]!.forEach((previous, previousIndex) => {
          const value =
            best[index - 1]![previousIndex]!.total + bassDistance(previous.bass, option.bass) + option.cost;
          if (value < total) {
            total = value;
            from = previousIndex;
          }
        });
        return { total, from };
      }),
    );
  });

  let choice = 0;
  best[best.length - 1]!.forEach((entry, index, list) => {
    if (entry.total < list[choice]!.total) choice = index;
  });
  const picked: BassOption[] = [];
  for (let index = options.length - 1; index >= 0; index--) {
    picked.unshift(options[index]![choice]!);
    choice = best[index]![choice]!.from;
  }
  return {
    slots: picked.map((option, index) => ({ ...slots[index]!, name: option.name })),
    line: picked.map((option) => option.bassText),
  };
}

/** Le pone una dominante secundaria a cada acorde que todavía no llega preparado. */
export function prepareWithDominants(slots: readonly Slot[], key: Key): { slots: Slot[]; added: string[] } {
  const result: Slot[] = [];
  const added: string[] = [];
  slots.forEach((slot, index) => {
    const chord = anatomy(slot.name);
    const previous = index > 0 ? anatomy(slots[index - 1]!.name) : null;
    const hasRoom = slots.length + added.length < MAX_CHORDS;
    const worthIt =
      chord &&
      previous &&
      hasRoom &&
      chord.root !== key.tonic &&
      (chord.family === 'major' || chord.family === 'minor') &&
      (previous.root + 5) % 12 !== chord.root;
    if (worthIt) {
      const dominant = `${noteAt(chord, 4, 7)}7`;
      result.push({ name: dominant, locked: false, beats: slot.beats });
      added.push(dominant);
    }
    result.push(slot);
  });
  return { slots: result, added };
}

// ---- Listas de acordes ----

export const insertAt = <T>(list: readonly T[], index: number, items: readonly T[]): T[] => [
  ...list.slice(0, index),
  ...items,
  ...list.slice(index),
];

export const removeAt = <T>(list: readonly T[], index: number): T[] => list.filter((_, i) => i !== index);

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** Empieza desde otro acorde del ciclo: mismos acordes, otro punto de partida. */
export const rotate = <T>(list: readonly T[]): T[] => [...list.slice(1), ...list.slice(0, 1)];

// ---- Fórmulas ----

const MAJOR_STEPS = MODES.ionian.steps;

/** Escribe una fórmula en una tónica: "b7" en Do es Bb, "2m7" en Do es Dm7. */
export function chordsOfFormula(formula: Formula, tonic: number): string[] {
  const start = tonicSpelling(tonic);
  return formula.degrees.map((degree) => {
    const match = /^(b|#)?([1-7])(.*)$/.exec(degree)!;
    const index = Number(match[2]) - 1;
    const accidental = match[1] === 'b' ? -1 : match[1] === '#' ? 1 : 0;
    return (
      spell({ letter: start.letter + index, pitch: start.pitch + MAJOR_STEPS[index]! + accidental }) +
      match[3]!
    );
  });
}
