// Cada celda contra la consigna: ✓, ✗ o nada si la regla no se puede medir.
import { checkHarmony, type Check } from '~/core/lienzo/harmony';
import { checkLyric } from '~/core/lienzo/lyrics';
import { checkMelody, melDegs, melSlots } from '~/core/lienzo/melody';
import { clipOf } from '~/core/lienzo/project';
import { checkRhythm } from '~/core/lienzo/rhythm';
import type { LienzoRules } from '~/core/lienzo/rules';
import type { LaneId, Project, Section, Variant } from '~/core/lienzo/types';

export function checkCell(
  lane: LaneId,
  v: Variant | undefined,
  sec: Section,
  p: Project,
  rules: LienzoRules,
): Check | null {
  if (!v) return null;
  if (lane === 'armonia' && v.kind === 'armonia') return checkHarmony(v.chords, rules.harmony, p.key);
  if (lane === 'ritmo' && v.kind === 'ritmo') return checkRhythm(v.config, rules.meter);
  if (lane === 'letra' && v.kind === 'letra') return checkLyric(v.text, rules.lyric);
  if (lane === 'melodia' && v.kind === 'melodia') {
    const slots = melSlots(sec, clipOf(p, 'letra', sec)?.text);
    const degs = melDegs(v, sec, slots, clipOf(p, 'armonia', sec)?.chords ?? null, p.key, rules.melody);
    return checkMelody(degs, slots, rules.melody, p.key);
  }
  return null;
}

/** Qué regla de la consigna mira cada carril, para mostrarla en el detalle. */
export const RULE_ROW = { armonia: 'armonia', ritmo: 'ritmo', letra: 'letra', melodia: 'melodia' } as const;
