// Del formato anterior al lienzo: la forma de la consigna (A A B A…) más lo que cada letra guardaba en
// el proyecto (acordes por nombre, duraciones en negras, ritmo, letra, compases). No modifica lo viejo:
// lo lee y arma un proyecto nuevo.
import { isChordBeats, parseChord } from '../chords';
import type { ModeId } from '../harmony';
import { noteToMidi } from '../notes';
import { cycleFor, type RhythmConfig } from '../rhythm';
import { refToMine } from './harmony';
import { newProject } from './project';
import type { Chord, ChordQuality, Key, KeyMode, LaneRhythm, Project, Section, Variant } from './types';

export interface LegacySection {
  chords?: string[];
  chordBeats?: number[];
  rhythm?: RhythmConfig;
  text?: string;
  bars?: number;
}

export interface LegacyInput {
  /** La forma: una letra por bloque. */
  blocks: string[];
  sections: Record<string, LegacySection | undefined>;
  /** Lo que usaba una sección sin acordes o sin ritmo propios: lo de la consigna. */
  fallback: { chords: string[]; chordBeats?: number[]; rhythm: RhythmConfig };
  tonic: number;
  mode: ModeId;
  tempo: number | null;
  tuning: { name: string; notes: string[] };
  consigna: string | null;
}

const LEGACY_BARS = 4;
const MODE_MAP: Record<ModeId, KeyMode> = {
  ionian: 'ionian',
  lydian: 'ionian',
  mixolydian: 'mixolydian',
  dorian: 'dorian',
  aeolian: 'aeolian',
  phrygian: 'aeolian',
};

function qualityOf(intervals: number[]): ChordQuality {
  if (intervals.includes(4)) return 'M';
  if (intervals.includes(3)) return intervals.includes(6) && !intervals.includes(7) ? 'dim' : 'm';
  return intervals.includes(7) ? '5' : 'M';
}

const quarter = (x: number) => Math.round(x * 4) / 4;

/**
 * Los acordes por nombre pasados a grados, con su duración en compases. Sin duraciones, el formato
 * viejo repartía la sección en partes iguales (uno por compás si entraban). Las extensiones (7, maj7,
 * sus) se reducen a la tríada: el lienzo todavía no las tiene.
 */
export function chordsFromNames(
  names: readonly string[],
  beats: readonly number[] | undefined,
  bars: number,
  quartersPerBar: number,
  key: Key,
): Chord[] {
  const parsed = names.map(parseChord);
  const timed = isChordBeats(beats, names.length);
  const total = timed ? beats.reduce((a, b) => a + b, 0) : 0;
  const scale = timed && total > bars * quartersPerBar ? (bars * quartersPerBar) / total : 1;
  const even = names.length > bars ? bars / names.length : 1;
  return parsed.flatMap((chord, i) => {
    if (!chord) return [];
    const len = timed ? Math.max(0.25, quarter((beats[i]! * scale) / quartersPerBar)) : even;
    return [refToMine((chord.root - key.tonic + 12) % 12, qualityOf(chord.intervals), len, key)];
  });
}

const omitBpm = ({ bpm: _bpm, ...rest }: RhythmConfig): LaneRhythm => rest as LaneRhythm;

export function fromLegacy(input: LegacyInput): Project {
  const key: Key = { tonic: input.tonic, mode: MODE_MAP[input.mode] };
  const lib: Variant[] = [];
  const clips: Record<string, string> = {};
  const secs: Section[] = [];
  const rootOf = new Map<string, string>();
  const count = new Map<string, number>();

  for (const letter of input.blocks) {
    const n = (count.get(letter) ?? 0) + 1;
    count.set(letter, n);
    const id = `sec-${letter.toLowerCase()}${n > 1 ? `-${n}` : ''}`;
    const root = rootOf.get(letter);
    const saved = input.sections[letter];
    const bars = saved?.bars ?? LEGACY_BARS;
    if (root) {
      secs.push({ id, label: letter, bars, of: root, energy: 2 });
      continue;
    }
    rootOf.set(letter, id);
    secs.push({ id, label: letter, bars, energy: 2 });

    const rhythm = saved?.rhythm ?? input.fallback.rhythm;
    const qpb = cycleFor(rhythm, 0).beats;
    const own = !!saved?.chords;
    const harmonyId = own ? `h-${letter.toLowerCase()}` : 'h-consigna';
    if (!lib.some((v) => v.id === harmonyId)) {
      const chords = own
        ? chordsFromNames(saved!.chords!, saved!.chordBeats, bars, qpb, key)
        : chordsFromNames(input.fallback.chords, input.fallback.chordBeats, bars, qpb, key);
      if (chords.length)
        lib.push({
          id: harmonyId,
          kind: 'armonia',
          name: own ? `Armonía ${letter}` : 'De la consigna',
          chords,
        });
    }
    if (lib.some((v) => v.id === harmonyId)) clips[`armonia:${id}`] = harmonyId;

    const rhythmId = saved?.rhythm ? `r-${letter.toLowerCase()}` : 'r-consigna';
    if (!lib.some((v) => v.id === rhythmId)) {
      lib.push({
        id: rhythmId,
        kind: 'ritmo',
        name: saved?.rhythm ? `Ritmo ${letter}` : 'De la consigna',
        config: omitBpm(rhythm),
      });
    }
    clips[`ritmo:${id}`] = rhythmId;

    if (saved?.text?.trim()) {
      const lyricId = `l-${letter.toLowerCase()}`;
      lib.push({ id: lyricId, kind: 'letra', name: `Letra ${letter}`, text: saved.text });
      clips[`letra:${id}`] = lyricId;
    }
  }

  const firstRhythm = input.sections[input.blocks[0] ?? '']?.rhythm ?? input.fallback.rhythm;
  return newProject({
    key,
    bpm: input.tempo ?? firstRhythm.bpm,
    tuning: {
      name: input.tuning.name,
      notes: input.tuning.notes,
      pcs: input.tuning.notes.map((note) => noteToMidi(note) % 12),
    },
    secs: secs.length ? secs : newProject().secs,
    lib,
    clips,
    consigna: input.consigna,
  });
}
