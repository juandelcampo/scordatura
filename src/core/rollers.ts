// Un sorteador por módulo. Todos cumplen el mismo contrato (roll.ts), así la consigna
// y cada herramienta suelta usan exactamente la misma lógica.
import { CARDS } from '~/data/cards';
import {
  FORM_POOL,
  IMAGE_POOL,
  LYRIC_POOL,
  MELODY_POOL,
  MODE_POOL,
  DRONE_POOL,
  RHYTHM_POOL,
  TUNING_POOL,
} from '~/data/pools';
import type { SectionNames } from '~/data/structures';
import { GROUPS, STANDARD, TUNINGS, type Tuning } from '~/data/tunings';
import { rollProgression, type ModeId, type RollOptions } from './harmony';
import { midiToNote, noteLabel, noteToMidi } from './notes';
import { describeDrone, droneToParams, type DroneConfig } from './drone';
import { describeRhythm, rhythmToParams, type RhythmConfig } from './rhythm';
import type { Rng } from './rng';
import type { Rolled, RollInput, Roller } from './roll';
import { changeSummary, openChordName } from './tuning';

/** Máximo que se mueve una cuerda en una afinación generada. No se aplica a la biblioteca. */
export const SAFE_TUNING_RANGE = 3;

export function randomSafeTuning(rng: Rng, range = SAFE_TUNING_RANGE): string[] {
  for (;;) {
    const notes = STANDARD.map((note) => midiToNote(noteToMidi(note) + rng.int(-range, range)));
    if (changeSummary(notes).changed >= 3) return notes;
  }
}

function tuningRule(tuning: Tuning): string {
  const group = GROUPS.find((item) => item.id === tuning.group)?.name ?? 'Afinación';
  return `${group}. Al aire suena ${openChordName(tuning.notes)}.`;
}

export const rollTuning: Roller<{ notes: string[] }> = ({ risk, rng }) => {
  // En el nivel raro, una de cada tres veces la afinación se inventa en lugar de elegirse.
  if (risk === 2 && rng.next() < 1 / 3) {
    const notes = randomSafeTuning(rng);
    return {
      value: { notes },
      label: notes.map((note) => noteLabel(note)).join(''),
      rule: `Generada al azar: ninguna cuerda se mueve más de ${SAFE_TUNING_RANGE} semitonos. Al aire suena ${openChordName(notes)}.`,
      href: `/afinador/tuya?n=${notes.join(',').replaceAll('#', 's')}`,
    };
  }
  const id = rng.pick(TUNING_POOL[risk]);
  const tuning = TUNINGS.find((item) => item.id === id);
  if (!tuning) throw new Error(`La receta nombra una afinación inexistente: ${id}`);
  return {
    value: { notes: tuning.notes },
    label: tuning.name,
    rule: tuningRule(tuning),
    href: `/afinador/${tuning.id}`,
  };
};

export const rollRhythm: Roller<RhythmConfig> = ({ risk, rng }) => {
  const config = rng.pick(RHYTHM_POOL[risk]);
  const { label, rule } = describeRhythm(config);
  return { value: config, label, rule, href: `/ritmo?${rhythmToParams(config)}` };
};

export type HarmonyRoll = { chords: string[]; tonic: number; mode: ModeId };

/** Sorteo de armonía con pedido: un largo, o una tonalidad ya elegida. */
export function rollHarmonyWith(
  { risk, rng }: RollInput,
  { mode: fixedMode, ...options }: RollOptions & { mode?: ModeId } = {},
): Rolled<HarmonyRoll> {
  const modes = fixedMode ? [fixedMode] : MODE_POOL[risk];
  const { chords, rule, tonic, mode } = rollProgression(modes, risk, rng, rng.next() < 0.25, options);
  return {
    value: { chords, tonic, mode },
    label: chords.join(' – '),
    rule,
    href: `/armonia?c=${encodeURIComponent(chords.join(','))}`,
  };
}

export const rollHarmony: Roller<HarmonyRoll> = (input) => rollHarmonyWith(input);

export const rollMelody: Roller<null> = ({ risk, rng }) => {
  const { label, rule } = rng.pick(MELODY_POOL[risk]);
  return { value: null, label, rule, href: '/melodia' };
};

export const rollLyric: Roller<null> = ({ risk, rng }) => {
  const constraint = rng.pick(LYRIC_POOL[risk]);
  const object = rng.pick(IMAGE_POOL.objects);
  const place = rng.pick(IMAGE_POOL.places);
  return {
    value: null,
    label: `${constraint.label}. Imagen: ${object} en ${place}`,
    rule: `${constraint.rule} La imagen concreta evita las palabras abstractas de siempre.`,
    href: '/letras',
  };
};

export const rollForm: Roller<{ blocks: string[]; names?: SectionNames }> = ({ risk, rng }) => {
  const { label, rule, blocks, names } = rng.pick(FORM_POOL[risk]);
  return { value: names ? { blocks, names } : { blocks }, label, rule, href: `/forma?f=${blocks.join('')}` };
};

export const rollCard: Roller<{ id: number }> = ({ risk, rng }) => {
  const card = rng.pick(CARDS.filter((item) => item.risk === risk));
  return {
    value: { id: card.id },
    label: `“${card.text}”`,
    rule: `Carta Nº ${String(card.id).padStart(3, '0')}. Rompe ${card.breaks}.`,
    href: `/cartas?c=${card.id}`,
  };
};

export const rollDrone: Roller<DroneConfig> = ({ risk, rng }) => {
  const entry = rng.pick(DRONE_POOL[risk]);
  const config: DroneConfig = { ...entry, root: rng.int(38, 48) };
  const { label, rule } = describeDrone(config);
  return { value: config, label, rule, href: `/drone?${droneToParams(config)}` };
};
