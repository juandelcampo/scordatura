// El tema tal como lo arman el proyecto y la consigna: lo que suena y lo que dibuja el Estudio.
import { useMemo } from 'react';
import { parseChord } from '~/core/chords';
import { resolveRow, rowIndex, type Consigna, type RowId, type RowOverrides } from '~/core/consigna';
import type { DroneConfig } from '~/core/drone';
import { exampleMelody, type Note } from '~/core/melody';
import type { RhythmConfig } from '~/core/rhythm';
import { createRng } from '~/core/rng';
import { buildSong, type Song } from '~/core/song';
import { useConsigna } from './consigna';
import { useProject } from './project';
import { useSettings } from './settings';

export interface ConsignaParts {
  tuning: { notes: string[]; label: string };
  harmony: { chords: string[]; tonic?: number; beats?: number[] };
  rhythm: RhythmConfig;
  melody: { notes: Note[]; chosen: boolean; label: string; rule: string };
  lyric: { label: string; rule: string };
  card: string;
  drone: DroneConfig;
}

export function consignaParts(consigna: Consigna): ConsignaParts {
  const row = (id: RowId) => resolveRow(rowIndex(id), consigna.rows[rowIndex(id)]!);
  const harmony = row('armonia').value as ConsignaParts['harmony'];
  const melody = row('melodia');
  const chosen = (melody.value as RowOverrides['melodia'] | null)?.notes;
  const first = parseChord(harmony.chords[0] ?? '');
  const minor = first?.intervals.includes(3) ?? true;
  const lyric = row('letra');
  return {
    tuning: { notes: (row('afinacion').value as { notes: string[] }).notes, label: row('afinacion').label },
    harmony,
    rhythm: row('ritmo').value as RhythmConfig,
    melody: {
      notes:
        chosen ??
        exampleMelody(
          createRng(consigna.rows[rowIndex('melodia')]!.seed),
          first?.root ?? 9,
          minor ? 'aeolian' : 'ionian',
        ),
      chosen: !!chosen,
      label: melody.label,
      rule: melody.rule,
    },
    lyric: { label: lyric.label, rule: lyric.rule },
    card: row('carta').label,
    drone: row('drone').value as DroneConfig,
  };
}

export function useConsignaParts(): ConsignaParts {
  const consigna = useConsigna((s) => s.consigna);
  return useMemo(() => consignaParts(consigna), [consigna]);
}

export function useSong(): Song {
  const parts = useConsignaParts();
  const blocks = useProject((s) => s.blocks);
  const sections = useProject((s) => s.sections);
  const tempo = useProject((s) => s.tempo);
  const mix = useProject((s) => s.mix);
  const a4 = useSettings((s) => s.a4);
  return useMemo(
    () =>
      buildSong({
        blocks,
        sections,
        fallback: { chords: parts.harmony.chords, chordBeats: parts.harmony.beats, rhythm: parts.rhythm },
        tuning: parts.tuning.notes,
        melody: parts.melody.notes,
        melodyChosen: parts.melody.chosen,
        drone: parts.drone,
        tempo,
        mix,
        a4,
      }),
    [blocks, sections, tempo, mix, a4, parts],
  );
}
