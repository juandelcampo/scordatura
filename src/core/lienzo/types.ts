// El modelo del lienzo: un proyecto es una canción. Las secciones forman la canción, y cada carril
// (armonía, melodía, ritmo, letra) pone en cada sección una variante de la biblioteca.
import type { ContourId } from '../melody';
import type { RhythmConfig } from '../rhythm';

/** Los colores que ofrece la ventana de Tonalidad. Son un subconjunto de los modos de core/harmony. */
export const KEY_MODES = {
  ionian: { label: 'Mayor', hint: 'luminoso' },
  aeolian: { label: 'Menor', hint: 'melancólico' },
  dorian: { label: 'Dórico', hint: 'menor con luz' },
  mixolydian: { label: 'Mixolidio', hint: 'mayor con polvo' },
} as const;

export type KeyMode = keyof typeof KEY_MODES;

export interface Key {
  /** Clase de altura de 0 a 11. */
  tonic: number;
  mode: KeyMode;
}

export type ChordQuality = 'M' | 'm' | '5' | 'dim';

/**
 * Un acorde se guarda por grado: cambiar la tónica transporta todo. Si tiene `r`, es un acorde de
 * afuera, contado en semitonos desde la tónica, y `d`/`b` no se usan.
 */
export interface Chord {
  /** Grado de 0 a 6 en el modo actual. */
  d?: number;
  /** Prestado del modo paralelo (mayor ↔ menor). */
  b?: boolean;
  /** Acorde de afuera: semitonos desde la tónica. */
  r?: number;
  /** Calidad, solo junto con `r`. */
  q?: ChordQuality;
  /** Duración en compases. Sin esto, 1. */
  len?: number;
}

export const CHORD_LENGTHS = [0.5, 1, 2, 4] as const;

export type Energy = 1 | 2 | 3 | 4;

export interface Section {
  id: string;
  /** "Intro", "A", "B", "1-2-3-4"... */
  label: string;
  /** De 1 a 32. */
  bars: number;
  /** Si es una repetición: el id de la sección raíz. */
  of?: string;
  energy: Energy;
  /** Las frases arrancan en el uno o después del uno. Sin esto, en el uno. */
  phrase?: 'front' | 'back';
}

export const MIN_BARS = 1;
export const MAX_BARS = 32;

/** Un ritmo de la app sin el tempo: en el lienzo el tempo es del proyecto. */
export type LaneRhythm = RhythmConfig extends infer R
  ? R extends RhythmConfig
    ? Omit<R, 'bpm'>
    : never
  : never;

export type MelodyFill = 'apoyos' | 'completa';

export type Variant =
  | { id: string; kind: 'armonia'; name: string; chords: Chord[] }
  | { id: string; kind: 'ritmo'; name: string; config: LaneRhythm; preset?: string }
  | {
      id: string;
      kind: 'melodia';
      name: string;
      contour: ContourId;
      fill: MelodyFill;
      seed: number;
      /** Corre el registro, en grados de la escala. */
      shift: number;
      /** Grados relativos a la tónica, uno por columna; null es silencio. Sin esto, se genera. */
      notes: (number | null)[] | null;
    }
  | { id: string; kind: 'letra'; name: string; text: string };

export type VariantKind = Variant['kind'];
export type VariantOf<K extends VariantKind> = Extract<Variant, { kind: K }>;

export const LANES = [
  { id: 'armonia', name: 'Armonía', mirror: true },
  { id: 'melodia', name: 'Melodía', mirror: true },
  { id: 'ritmo', name: 'Ritmo', mirror: true },
  { id: 'letra', name: 'Letra', mirror: false },
] as const satisfies ReadonlyArray<{ id: VariantKind; name: string; mirror: boolean }>;

export type LaneId = (typeof LANES)[number]['id'];

export interface Take {
  id: string;
  name: string;
  /** Compás de inicio, contando desde 1. */
  start: number;
  len: number;
  about: string;
  loop?: boolean;
  wear?: 0 | 1 | 2 | 3;
  /** La grabación, en el Diario. */
  journalId?: string;
}

export interface Tuning {
  name: string;
  /** Una clase de altura por cuerda, de la 6ª a la 1ª. null es una cuerda sacada. */
  pcs: (number | null)[];
  /** Las notas con octava, si viene de data/tunings. */
  notes?: (string | null)[];
}

export interface MyRef {
  id: string;
  title: string;
  url: string;
  note: string;
}

export interface Project {
  title: string;
  key: Key;
  bpm: number;
  tuning: Tuning;
  instrument: 'guitarra' | 'piano';
  drone: 'tonica' | 'quinta' | '';
  secs: Section[];
  /** Todas las variantes: cada sorteo queda. */
  lib: Variant[];
  /** `${carril}:${idSección}` → id de variante. */
  clips: Record<string, string>;
  /** Armonía trabada por sección raíz. */
  lockedSecs: Record<string, boolean>;
  takes: Take[];
  /** La consigna con la que se trabaja, codificada como en los links. */
  consigna: string | null;
  /** "Tus reglas" activas. */
  own: Record<string, boolean>;
  notebook: { t: string; used: boolean }[];
  myRefs: MyRef[];
  createdAt: number;
}
