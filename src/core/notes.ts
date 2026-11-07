// Notas, frecuencias e intervalos.

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const SOLFEGE: Record<string, string> = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
const INTERVAL_NAMES = ['=', '2m', '2M', '3m', '3M', '4J', 'TT', '5J', '6m', '6M', '7m', '7M', '8J'] as const;

export type Notation = 'letters' | 'solfege';

const NOTE_PATTERN = /^([A-G])([#b]?)(-?\d)$/;

export function splitNote(note: string) {
  const match = NOTE_PATTERN.exec(note);
  if (!match) throw new Error(`Nota inválida: ${note}`);
  return { letter: match[1]!, accidental: match[2]!, octave: match[3]! };
}

export function isNote(note: unknown): note is string {
  return typeof note === 'string' && NOTE_PATTERN.test(note);
}

export function noteToMidi(note: string): number {
  const { letter, accidental, octave } = splitNote(note);
  const offset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (Number(octave) + 1) * 12 + SEMITONES[letter]! + offset;
}

export function midiToNote(midi: number): string {
  return `${SHARP_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function midiToHz(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function centsBetween(freq: number, reference: number): number {
  return 1200 * Math.log2(freq / reference);
}

/**
 * Desvío respecto del objetivo. Un error de exactamente una octava se pliega, porque
 * suele ser un armónico mal detectado y no una cuerda realmente una octava corrida.
 */
export function centsToTarget(freq: number, target: number): number {
  const cents = centsBetween(freq, target);
  if (Math.abs(Math.abs(cents) - 1200) < 60) return cents - Math.sign(cents) * 1200;
  return cents;
}

/** Nombre de la nota sin octava, en la notación elegida. */
export function noteLabel(note: string, notation: Notation = 'letters'): string {
  const { letter, accidental } = splitNote(note);
  return (notation === 'solfege' ? SOLFEGE[letter]! : letter) + accidental;
}

/** Intervalo entre dos cuerdas vecinas. Si la aguda suena más grave, lleva una flecha. */
export function intervalName(from: number, to: number): string {
  const semitones = Math.abs(to - from);
  const name = INTERVAL_NAMES[semitones] ?? `${semitones}st`;
  return to < from ? `↓${name}` : name;
}
