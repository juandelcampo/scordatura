// Lo que toca cada sección cuando todavía no tiene acordes propios. Si todas copiaran la
// progresión de la consigna, la forma sería solo un nombre: A, B y C sonarían igual.
import { degreeOf } from './chords';
import { chordName, tonicSpelling, triad, type ModeId } from './harmony';
import { keyOfProgression } from './variations';

export interface BaseHarmony {
  chords: string[];
  beats?: number[];
  tonic?: number;
  mode?: ModeId;
}

export interface SectionHarmony {
  chords: string[];
  chordBeats?: number[];
  /** Cómo sale de la consigna. Vacío en la sección que la toca tal cual. */
  how: string;
}

/** El contraste de un puente: arranca lejos de la tónica y vuelve por la dominante. */
const CONTRAST = [5, 3, 1, 4];

/**
 * El orden de las secciones: la A primero si está, y las demás como aparecen en la forma. La
 * primera toca la consigna tal cual; las otras, variaciones en el mismo tono.
 */
function sectionOrder(blocks: readonly string[]): string[] {
  const letters = [...new Set(blocks)];
  return letters.includes('A') ? ['A', ...letters.filter((letter) => letter !== 'A')] : letters;
}

const rotate = <T>(list: readonly T[], by: number): T[] => {
  const shift = ((by % list.length) + list.length) % list.length;
  return [...list.slice(shift), ...list.slice(0, shift)];
};

/** Si un grado es disminuido o aumentado, o ya se usó, se prueba con estos corrimientos. */
const NEIGHBORS = [0, 2, -2, 1, -1, 3, -3];

/** Un grado de la tonalidad como acorde mayor o menor, sin repetir los que ya están. */
function degreeChord(tonic: number, mode: ModeId, degree: number, used: readonly string[]): string {
  for (const offset of NEIGHBORS) {
    const chord = triad(tonicSpelling(tonic), mode, (((degree + offset) % 7) + 7) % 7);
    const name = chordName(chord);
    if ((chord.quality === '' || chord.quality === 'm') && !used.includes(name)) return name;
  }
  return chordName(triad(tonicSpelling(tonic), mode, degree));
}

export function sectionHarmony(letter: string, blocks: readonly string[], base: BaseHarmony): SectionHarmony {
  const plain = { chords: base.chords, ...(base.beats ? { chordBeats: base.beats } : {}), how: '' };
  const index = sectionOrder(blocks).indexOf(letter);
  const count = base.chords.length;
  if (index <= 0 || count === 0) return plain;

  if (index === 2) {
    const key = keyOfProgression(base.chords, base.tonic, base.mode);
    const chords: string[] = [];
    for (let i = 0; i < Math.max(count, 2); i++) {
      // Dentro de una vuelta no se repite ningún acorde; en la siguiente, la vuelta se repite igual.
      const lap = chords.slice(i - (i % CONTRAST.length));
      chords.push(
        i < CONTRAST.length
          ? degreeChord(key.tonic, key.mode, CONTRAST[i]!, lap)
          : chords[i % CONTRAST.length]!,
      );
    }
    const degrees = chords.map((name) => degreeOf(name, key.tonic) ?? '?');
    const back = degrees[Math.min(chords.length, CONTRAST.length) - 1];
    return {
      chords,
      how: `Contraste en el mismo tono (${degrees.join(' – ')}): sale de la tónica y vuelve por el ${back}.`,
    };
  }

  // Las demás son la misma progresión empezando en otro acorde: la regla de la consigna sigue ahí.
  const half = Math.max(1, Math.floor(count / 2));
  // Después de la B, las que siguen prueban los otros arranques, sin repetir el de la B.
  const others = Array.from({ length: count - 1 }, (_, i) => i + 1).filter((by) => by !== half);
  const shift = index === 1 || others.length === 0 ? half : others[(index - 3) % others.length]!;
  const chords = rotate(base.chords, shift);
  if (chords.join() === base.chords.join()) return plain;
  return {
    chords,
    ...(base.beats ? { chordBeats: rotate(base.beats, shift) } : {}),
    how: `La progresión de la consigna, empezando por ${chords[0]}.`,
  };
}
