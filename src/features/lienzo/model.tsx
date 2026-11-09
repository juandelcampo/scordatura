// Lo que todas las partes del lienzo necesitan saber: el proyecto, la consigna leída como reglas y la
// sección elegida. Se calcula una vez arriba y se reparte por contexto.
import { createContext, useContext } from 'react';
import { consignaKey, encodeConsigna, resolveRows, ROWS, type Consigna, type RowId } from '~/core/consigna';
import { fromLegacy } from '~/core/lienzo/legacy';
import { rulesOf, type LienzoRules, type RuleText } from '~/core/lienzo/rules';
import { meterLabel } from '~/core/lienzo/rhythm';
import type { Project, Section } from '~/core/lienzo/types';
import type { Risk } from '~/core/roll';
import { TUNINGS } from '~/data/tunings';
import { blocksOf } from '~/shared/consigna';
import { consignaParts, type ConsignaParts } from '~/shared/song';
import type { Section as LegacySection } from '~/shared/project';

export type RowText = RuleText & { locked: boolean; index: number };

export interface Model {
  project: Project;
  rules: LienzoRules;
  consigna: Consigna;
  parts: ConsignaParts;
  rows: Record<RowId, RowText>;
  meter: string;
  number: string;
  a4: number;
  risk: Risk;
  /** La sección elegida (en los carriles espejo, siempre la raíz cuando corresponde). */
  selSec: Section;
  guitar: boolean;
}

export const ModelContext = createContext<Model | null>(null);

export function useModel(): Model {
  const model = useContext(ModelContext);
  if (!model) throw new Error('useModel fuera del lienzo');
  return model;
}

export function rowTexts(consigna: Consigna): Record<RowId, RowText> {
  return Object.fromEntries(
    resolveRows(consigna).map((rolled, index) => {
      const state = consigna.rows[index]!;
      const row = ROWS[index]!;
      return [row.id, { label: rolled.label, rule: rolled.rule, locked: state.locked, index }];
    }),
  ) as Record<RowId, RowText>;
}

export function rulesFromConsigna(consigna: Consigna, rows = rowTexts(consigna)) {
  const parts = consignaParts(consigna);
  const rules = rulesOf({
    rhythm: parts.rhythm,
    harmony: rows.armonia,
    melody: rows.melodia,
    lyric: rows.letra,
  });
  const { groups } = rules.meter;
  const meter =
    meterLabel(rules.meter) + (groups.length > 1 && new Set(groups).size > 1 ? ` (${groups.join('+')})` : '');
  return { parts, rules, meter };
}

export { consignaKey };

export function tuningName(notes: string[], fallback: string): string {
  return TUNINGS.find((t) => t.notes.join() === notes.join())?.name ?? fallback;
}

/** Arma el proyecto desde la consigna y lo que ya había en el proyecto anterior a la app del lienzo. */
export function projectFromConsigna(consigna: Consigna, sections: Record<string, LegacySection>): Project {
  const parts = consignaParts(consigna);
  const { tonic, mode } = consignaKey(consigna);
  return fromLegacy({
    blocks: blocksOf(consigna),
    sections,
    fallback: { chords: parts.harmony.chords, chordBeats: parts.harmony.beats, rhythm: parts.rhythm },
    tonic,
    mode,
    tempo: parts.rhythm.bpm,
    tuning: { name: tuningName(parts.tuning.notes, parts.tuning.label), notes: parts.tuning.notes },
    consigna: encodeConsigna(consigna),
  });
}
