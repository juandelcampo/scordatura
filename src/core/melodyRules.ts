// Las restricciones de melodía de la consigna, llevadas a notas: un ejemplo que las cumple sobre
// los acordes de la consigna, y la regla dicha con las notas de esa tonalidad.
import { chordClasses, parseChord } from './chords';
import { MODES, type ModeId } from './harmony';
import { CONTOURS, scaleNotes, textToNotes, type Note } from './melody';
import type { Rng } from './rng';

export type MelodyKind =
  | 'quinta'
  | 'una-por-compas'
  | 'tonica-tercera'
  | 'frases-de-dos'
  | 'repetida-y-salto'
  | 'anacrusa'
  | 'secuencia'
  | 'novena-grave'
  | 'ola-por-terceras'
  | 'fuera-del-acorde'
  | 'contratiempo'
  | 'sin-saltos-abajo'
  | 'sin-tercera'
  | 'motivo-desplazado'
  | 'semitono'
  | 'sin-tonica'
  | 'retrogradacion'
  | 'inversion'
  | 'tritonos-y-semitonos'
  | 'titulo'
  | 'sin-quinta';

/** Corcheas por compás: el ejemplo va en 4/4, un acorde por compás. */
export const BAR = 8;
/** Hasta cuatro compases: alcanza para oír la idea sin que el ejemplo pase a ser la canción. */
const MAX_BARS = 4;
/** La palabra del ejemplo de "notas desde texto", hasta que la canción tenga título. */
export const EXAMPLE_WORD = 'Scordatura';

export interface MelodyContext {
  tonic: number;
  mode: ModeId;
  /** Los acordes de la consigna, uno por compás. */
  chords: readonly string[];
  rng: Rng;
  /** Cómo escribir una clase de altura en esta tonalidad (Sol# o Lab, Mi o E). */
  name: (pitchClass: number) => string;
}

export interface MelodyExample {
  notes: Note[];
  /** Cuántas corcheas dura el ejemplo, con los silencios del final. */
  length: number;
  /** El acorde de cada compás. */
  bars: string[];
  /** La regla con las notas de esta tonalidad: "Sin Sol#, la 3.ª de Mi". */
  hint: string;
}

/** Restricciones de un paseo por las notas posibles. Todo lo que no dice está permitido. */
interface WalkRules {
  /** Las notas que se pueden usar en cada compás. */
  pool: (bar: number) => number[];
  first?: number;
  /** Saltos permitidos entre notas seguidas, en semitonos y sin signo. */
  allowed?: (interval: number, from: number, to: number) => boolean;
  /** Hacia dónde tira la línea, entre 0 (abajo) y 1 (arriba), según el momento. */
  contour?: (x: number) => number;
  /** En los tiempos fuertes busca una nota del acorde, si la regla lo permite. */
  chordTones?: boolean;
}

const pc = (midi: number) => ((midi % 12) + 12) % 12;
const mod12 = (value: number) => ((value % 12) + 12) % 12;

/** Ritmos de un compás, en corcheas desde su comienzo. El último compás cierra con una nota larga. */
const BAR_RHYTHMS = [
  [0, 2, 4, 6],
  [0, 2, 3, 4, 6],
  [0, 1, 2, 4, 6],
  [0, 3, 4, 6],
  [0, 2, 4, 5, 6],
  [0, 2, 4],
];
const CLOSING = [
  [0, 2, 4],
  [0, 4],
  [0, 2],
];

/** La nota de la escala más cercana a la tónica en la cuarta octava, para que la voz quede cómoda. */
function homeOf(tonic: number): number {
  const home = 60 + tonic;
  return home > 66 ? home - 12 : home;
}

function chordPitches(name: string | undefined): number[] {
  const chord = name ? parseChord(name) : null;
  return chord ? chordClasses(chord) : [];
}

/** Arma el ritmo: las corcheas donde arranca cada nota. */
function rhythmFor(rng: Rng, bars: number, shapes = BAR_RHYTHMS): number[] {
  const onsets: number[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const pattern = bar === bars - 1 ? rng.pick(CLOSING) : rng.pick(shapes);
    pattern.forEach((step) => onsets.push(bar * BAR + step));
  }
  return onsets;
}

/** Cada nota dura hasta la siguiente; la última, hasta el final del compás. */
function withDurations(onsets: number[], midis: number[], length: number): Note[] {
  return midis.map((midi, index) => {
    const next = onsets[index + 1] ?? Math.min(length, (Math.floor(onsets[index]! / BAR) + 1) * BAR);
    return { midi, start: onsets[index]!, dur: Math.max(1, Math.min(4, next - onsets[index]!)) };
  });
}

/**
 * Elige cada altura entre las permitidas: cerca de la anterior y de donde tira el contorno, con
 * notas del acorde en los tiempos fuertes. Si nada cumple, repite la anterior antes que romper la regla.
 */
function walk(onsets: number[], length: number, chords: string[], rng: Rng, rules: WalkRules): number[] {
  const midis: number[] = [];
  // Sin contorno, la línea tiene dirección: sigue para un lado unos pasos y después gira.
  let direction: 1 | -1 = rng.next() < 0.5 ? 1 : -1;
  onsets.forEach((start, index) => {
    const bar = Math.floor(start / BAR);
    const previous = midis[index - 1];
    if (index === 0 && rules.first !== undefined) {
      midis.push(rules.first);
      return;
    }
    let pool = rules.pool(bar);
    if (previous !== undefined && rules.allowed) {
      pool = pool.filter((midi) => rules.allowed!(Math.abs(midi - previous), previous, midi));
    }
    if (pool.length === 0) {
      midis.push(previous ?? rules.pool(bar)[0] ?? 60);
      return;
    }
    const all = rules.pool(bar);
    const low = Math.min(...all);
    const high = Math.max(...all);
    if (previous !== undefined && !rules.contour) {
      if (previous + direction * 2 > high || previous + direction * 2 < low || rng.next() < 0.25) {
        direction = direction === 1 ? -1 : 1;
      }
    }
    const target = rules.contour
      ? low + rules.contour(start / Math.max(1, length - 1)) * (high - low)
      : previous === undefined
        ? (low + high) / 2
        : previous + direction * rng.int(1, 4);
    const strong = start % 4 === 0;
    const tones = chordPitches(chords[bar]);
    const scored = pool.map((midi) => {
      let score = Math.abs(midi - target) + rng.next() * 2;
      // Repetir alguna vez está bien; tres veces seguidas ya es un pedal.
      if (midi === previous) score += midi === midis[index - 2] ? 6 : 2.5;
      if (rules.chordTones !== false && strong && tones.includes(pc(midi))) score -= 2.5;
      return { midi, score };
    });
    scored.sort((a, b) => a.score - b.score);
    midis.push(scored[0]!.midi);
  });
  return midis;
}

/** En un motivo corto cada nota se mueve: si repite, deja de ser una figura. */
const moves = (interval: number) => interval > 0 && interval <= 5;

/** Repite una figura en otros compases, corrida en el tiempo y movida en altura. */
function placeFigure(
  figure: Note[],
  offset: number,
  move: (midi: number) => number = (midi) => midi,
): Note[] {
  return figure.map((note) => ({ ...note, start: note.start + offset, midi: move(note.midi) }));
}

/** Lleva una nota a la de la escala más cercana. */
function snap(midi: number, scale: number[]): number {
  return scale.reduce(
    (best, note) => (Math.abs(note - midi) < Math.abs(best - midi) ? note : best),
    scale[0]!,
  );
}

export function melodyExample(kind: MelodyKind, context: MelodyContext): MelodyExample {
  const { tonic, mode, rng, name } = context;
  const bars = context.chords.slice(0, MAX_BARS);
  if (bars.length === 0) bars.push('');
  const length = bars.length * BAR;
  const steps = MODES[mode].steps as readonly number[];
  const home = homeOf(tonic);
  const scale = scaleNotes(tonic, mode, home - 8, home + 17);
  const scaleFrom = (from: number, count: number) => {
    const first = scale.indexOf(from);
    return scale.slice(Math.max(0, first), Math.max(0, first) + count);
  };
  const tonicName = name(tonic);
  const third = mod12(tonic + steps[2]!);
  const chordOf = (bar: number) => bars[bar] ?? '';
  const done = (notes: Note[], hint: string): MelodyExample => ({ notes, length, bars: [...bars], hint });
  const plain = (rules: WalkRules, onsets = rhythmFor(rng, bars.length)) =>
    withDurations(onsets, walk(onsets, length, bars, rng, rules), length);

  switch (kind) {
    case 'quinta': {
      const five = scaleFrom(home, 5);
      const notes = plain({
        pool: () => five,
        first: home,
        allowed: (_, from, to) => Math.abs(five.indexOf(from) - five.indexOf(to)) <= 1,
      });
      return done(notes, `Entre ${tonicName} y ${name(pc(five.at(-1)!))}, de a un grado por vez.`);
    }
    case 'una-por-compas': {
      const onsets = bars.map((_, bar) => bar * BAR);
      const midis = walk(onsets, length, bars, rng, {
        pool: (bar) => scale.filter((midi) => chordPitches(chordOf(bar)).includes(pc(midi))),
      });
      const notes = midis.map((midi, bar) => ({ midi, start: bar * BAR, dur: 6 }));
      return done(notes, 'Una nota larga por compás, y que el resto lo llene el silencio.');
    }
    case 'tonica-tercera': {
      const low = scaleFrom(home, 3);
      const notes = plain({ pool: () => low, first: home });
      return done(notes, `Arrancá en ${tonicName} y no pases de ${name(third)}.`);
    }
    case 'frases-de-dos': {
      // Dos compases que hablan y un respiro al final de cada frase.
      const onsets: number[] = [];
      for (let bar = 0; bar < bars.length; bar++) {
        const closing = bar % 2 === 1 || bar === bars.length - 1;
        (closing ? [0, 2, 4] : rng.pick(BAR_RHYTHMS)).forEach((step) => onsets.push(bar * BAR + step));
      }
      const midis = walk(onsets, length, bars, rng, { pool: () => scale.filter((m) => m <= home + 12) });
      const notes = midis.map((midi, index) => {
        const start = onsets[index]!;
        const next = onsets[index + 1] ?? length;
        const endOfPhrase = start % BAR === 4 && Math.floor(start / BAR) % 2 === 1;
        return { midi, start, dur: endOfPhrase ? 2 : Math.max(1, Math.min(4, next - start)) };
      });
      return done(notes, 'Una frase cada dos compases, con aire antes de la siguiente: una por verso.');
    }
    case 'repetida-y-salto': {
      const tones = chordPitches(bars[0]);
      const center =
        scale.find((midi) => midi >= home && tones.includes(pc(midi)) && pc(midi) !== tonic) ?? home;
      const onsets = rhythmFor(rng, bars.length);
      const leap = snap(center + rng.pick([5, 7, 9]), scale);
      const notes = withDurations(
        onsets,
        onsets.map((_, index) => (index === onsets.length - 1 ? leap : center)),
        length,
      );
      return done(
        notes,
        `Repetí ${name(pc(center))} como si hablaras, y cerrá saltando a ${name(pc(leap))}.`,
      );
    }
    case 'anacrusa': {
      // Cada frase entra dos corcheas antes del compás: el tiempo fuerte es la llegada.
      const onsets: number[] = [];
      for (let bar = 0; bar < bars.length; bar += 2) {
        [6, 7].forEach((step) => onsets.push(bar * BAR + step));
        const into = bar + 1;
        if (into < bars.length) [0, 2, 4].forEach((step) => onsets.push(into * BAR + step));
      }
      const notes = plain({ pool: () => scale.filter((m) => m <= home + 12) }, onsets);
      return done(
        notes,
        'La frase entra antes del 1: dos notas de impulso y la llegada en el tiempo fuerte.',
      );
    }
    case 'secuencia': {
      const half = Math.max(1, Math.floor(bars.length / 2));
      const onsets = rhythmFor(rng, half, BAR_RHYTHMS.slice(0, 5)).filter((start) => start < half * BAR);
      const figure = withDurations(
        onsets,
        walk(onsets, half * BAR, bars, rng, { pool: () => scale.filter((m) => m <= home + 7) }),
        half * BAR,
      );
      const up = (midi: number) => scale[Math.min(scale.length - 1, scale.indexOf(midi) + 2)] ?? midi;
      const notes = bars.length > 1 ? [...figure, ...placeFigure(figure, half * BAR, up)] : figure;
      return done(notes, 'La misma frase dos veces: la segunda, una 3.ª más arriba dentro de la escala.');
    }
    case 'novena-grave': {
      const root = parseChord(bars[0] ?? '')?.root ?? tonic;
      const ninth = mod12(root + 2);
      const low = scaleNotes(tonic, mode, home - 12, home + 4);
      const first = low.find((midi) => pc(midi) === ninth) ?? snap(home - 10, low);
      const notes = plain({ pool: () => low, first });
      return done(
        notes,
        `Arrancá en ${name(ninth)}, la 9.ª de ${bars[0] || tonicName}, y quedate en el grave.`,
      );
    }
    case 'ola-por-terceras': {
      const notes = plain({
        pool: () => scale,
        contour: CONTOURS.ola.shape,
        allowed: (interval) => interval <= 4,
        chordTones: false,
      });
      return done(notes, 'Subí y bajá en olas amplias, sin saltar más que una 3.ª.');
    }
    case 'fuera-del-acorde': {
      const outside = (bar: number) => scale.filter((midi) => !chordPitches(chordOf(bar)).includes(pc(midi)));
      const notes = plain({ pool: outside, chordTones: false });
      const firstOutside = [...new Set(outside(0).map(pc))].sort(
        (x, y) => mod12(x - tonic) - mod12(y - tonic),
      );
      return done(
        notes,
        `Sobre ${bars[0] || tonicName}, solo ${firstOutside.map(name).join(', ')}: cambian con cada acorde.`,
      );
    }
    case 'contratiempo': {
      const offbeat = [
        [1, 3, 4, 6],
        [1, 2, 4, 6],
        [1, 3, 5],
        [3, 4, 6, 7],
      ];
      const onsets: number[] = [];
      bars.forEach((_, bar) => rng.pick(offbeat).forEach((step) => onsets.push(bar * BAR + step)));
      const midis = walk(onsets, length, bars, rng, {
        pool: () => scale.filter((m) => m <= home + 12),
        chordTones: false,
      });
      // Cada compás es una frase: termina antes del 1 siguiente, que queda en silencio.
      const notes = midis.map((midi, index) => {
        const start = onsets[index]!;
        const barEnd = (Math.floor(start / BAR) + 1) * BAR;
        const next = Math.min(onsets[index + 1] ?? barEnd, barEnd);
        return { midi, start, dur: Math.max(1, Math.min(4, next - start)) };
      });
      return done(notes, 'Cada frase entra en el "y", medio tiempo después del pulso.');
    }
    case 'sin-saltos-abajo': {
      const notes = plain({
        pool: () => scale,
        contour: (x) => 0.15 + 0.7 * x,
        allowed: (interval, from, to) => to >= from || interval <= 2,
      });
      return done(notes, 'Para abajo, solo de a un grado. Para arriba, saltá lo que quieras.');
    }
    case 'sin-tercera': {
      const notes = plain({ pool: () => scale.filter((midi) => pc(midi) !== third) });
      return done(notes, `Sin ${name(third)}, la 3.ª de ${tonicName}: que no se sepa si es mayor o menor.`);
    }
    case 'motivo-desplazado': {
      const onsets = [0, 1, 2, 4];
      const figure = withDurations(
        onsets,
        walk(onsets, BAR, bars, rng, { pool: () => scaleFrom(home, 6), allowed: moves }),
        BAR,
      );
      const notes = bars
        .flatMap((_, bar) => placeFigure(figure, bar * BAR + (bar % 2) * 2))
        .map((note) => ({ ...note, dur: Math.min(note.dur, length - note.start) }));
      const names = figure.map((note) => name(pc(note.midi))).join(' ');
      return done(notes, `${names}, y lo mismo un tiempo más tarde: cambia qué nota cae en el 1.`);
    }
    case 'semitono': {
      const pairs = scale
        .filter((midi) => midi >= home - 2 && midi <= home + 12)
        .filter((midi) => scale.includes(midi + 1));
      const lower = pairs.length ? rng.pick(pairs) : home;
      const pair = [lower, lower + 1];
      const onsets = rhythmFor(rng, bars.length);
      const notes = withDurations(
        onsets,
        onsets.map((_, index) => pair[(index + (rng.next() < 0.3 ? 1 : 0)) % 2]!),
        length,
      );
      return done(notes, `Solo ${name(pc(pair[0]!))} y ${name(pc(pair[1]!))}: el ritmo hace todo lo demás.`);
    }
    case 'sin-tonica': {
      const notes = plain({ pool: () => scale.filter((midi) => pc(midi) !== tonic) });
      return done(notes, `Sin ${tonicName}: rodeala sin tocarla nunca.`);
    }
    case 'retrogradacion':
    case 'inversion': {
      const onsets = [0, 2, 4];
      const figure = withDurations(
        onsets,
        walk(onsets, BAR, bars, rng, { pool: () => scaleFrom(home, 6), allowed: moves, chordTones: false }),
        BAR,
      );
      const turned =
        kind === 'retrogradacion'
          ? figure.map((note, index) => ({ ...note, midi: figure[figure.length - 1 - index]!.midi }))
          : figure.map((note) => ({ ...note, midi: snap(2 * figure[0]!.midi - note.midi, scale) }));
      const notes = bars.flatMap((_, bar) => placeFigure(bar % 2 === 0 ? figure : turned, bar * BAR));
      const shown = (list: Note[]) => list.map((note) => name(pc(note.midi))).join(' ');
      return done(
        notes,
        kind === 'retrogradacion'
          ? `${shown(figure)}, y después al revés: ${shown(turned)}.`
          : `${shown(figure)}, y después espejado: ${shown(turned)}.`,
      );
    }
    case 'tritonos-y-semitonos': {
      const chromatic = Array.from({ length: 20 }, (_, i) => home - 4 + i);
      const notes = plain({
        pool: () => chromatic,
        first: home,
        allowed: (interval) => interval === 1 || interval === 6,
        chordTones: false,
      });
      return done(notes, 'Cada paso es un semitono o un tritono, aunque salga de la escala.');
    }
    case 'titulo': {
      const { notes: raw } = textToNotes(EXAMPLE_WORD, tonic, mode);
      const notes = raw.slice(0, length / 2).map((note, index) => ({ ...note, start: index * 2, dur: 2 }));
      return done(notes, `Así suena «${EXAMPLE_WORD}». Con tu título: Melodía → Texto.`);
    }
    case 'sin-quinta': {
      const notes = plain({
        pool: () => scale,
        contour: CONTOURS.arco.shape,
        allowed: (interval) => interval !== 7,
      });
      return done(notes, 'Ningún salto de 5.ª justa (7 semitonos), ni para arriba ni para abajo.');
    }
  }
}

/** Si una regla prohíbe notas o saltos, cuáles: para comprobar que un ejemplo la cumple. */
export function breaksRule(
  kind: MelodyKind,
  notes: Note[],
  context: Omit<MelodyContext, 'rng' | 'name'>,
): string | null {
  const steps = MODES[context.mode].steps as readonly number[];
  const third = mod12(context.tonic + steps[2]!);
  const intervals = notes.slice(1).map((note, i) => note.midi - notes[i]!.midi);
  switch (kind) {
    case 'sin-tercera':
      return notes.some((note) => pc(note.midi) === third) ? 'usa la 3.ª' : null;
    case 'sin-tonica':
      return notes.some((note) => pc(note.midi) === context.tonic) ? 'usa la tónica' : null;
    case 'sin-quinta':
      return intervals.some((step) => Math.abs(step) === 7) ? 'salta una 5.ª' : null;
    case 'ola-por-terceras':
      return intervals.some((step) => Math.abs(step) > 4) ? 'salta más de una 3.ª' : null;
    case 'sin-saltos-abajo':
      return intervals.some((step) => step < -2) ? 'salta hacia abajo' : null;
    case 'tritonos-y-semitonos':
      return intervals.some((step) => ![1, 6].includes(Math.abs(step))) ? 'usa otro intervalo' : null;
    case 'semitono':
      return new Set(notes.map((note) => note.midi)).size > 2 ? 'usa más de dos notas' : null;
    case 'fuera-del-acorde':
      return notes.some((note) =>
        chordPitches(context.chords[Math.floor(note.start / BAR)]).includes(pc(note.midi)),
      )
        ? 'cae en una nota del acorde'
        : null;
    case 'contratiempo': {
      // Una frase empieza donde la nota anterior ya terminó: ahí tiene que caer a contratiempo.
      const starts = notes.filter(
        (note, i) => i === 0 || notes[i - 1]!.start + notes[i - 1]!.dur < note.start,
      );
      return starts.some((note) => note.start % 2 === 0) ? 'una frase empieza en el pulso' : null;
    }
    default:
      return null;
  }
}
