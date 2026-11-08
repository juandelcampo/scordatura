// La consigna leída como reglas que el lienzo puede chequear. La consigna de la app es más rica que
// estas reglas: lo que no se puede medir queda como texto, sin ✓ ni ✗.
import { cycleFor, type Meter, type RhythmConfig } from '../rhythm';
import type { HarmonyRule } from './harmony';
import type { LyricRule } from './lyrics';
import type { MelodyRule } from './melody';
import type { LaneRhythm } from './types';

export interface RuleText {
  label: string;
  rule: string;
}

export interface LienzoRules {
  meter: Meter;
  harmony: HarmonyRule;
  melody: MelodyRule;
  lyric: LyricRule;
}

const withBpm = (config: RhythmConfig | LaneRhythm): RhythmConfig =>
  ('bpm' in config ? config : { ...config, bpm: 120 }) as RhythmConfig;

/** El compás que marca un ritmo: el agrupado tal cual; los demás, por lo que mide un compás. */
export function meterOf(config: RhythmConfig | LaneRhythm): Meter {
  if (config.mode === 'meter') return { groups: [...config.groups], denom: config.denom };
  if (config.mode === 'mutante') return config.meters[0] ?? { groups: [4], denom: 4 };
  const quarters = cycleFor(withBpm(config), 0).beats;
  if (Number.isInteger(quarters)) return { groups: [quarters], denom: 4 };
  const eighths = Math.round(quarters * 2);
  return { groups: [eighths], denom: 8 };
}

export function harmonyRuleOf(text: string): HarmonyRule {
  const t = text.toLowerCase();
  if (/prestad|intercambio modal|modo paralelo/.test(t)) return 'intercambio';
  if (/un (solo )?acorde por secci|un solo acorde/.test(t)) return 'un-acorde';
  if (/sin (la )?v\b|sin dominante|prohibid[oa] (el|la) (v|dominante)/.test(t)) return 'sin-v';
  return null;
}

export function melodyRuleOf(text: string): MelodyRule {
  const t = text.toLowerCase();
  if (/(prohibida|sin) la t[óo]nica/.test(t)) return 'sin-tonica';
  if (/solo saltos|nada de notas vecinas/.test(t)) return 'solo-saltos';
  if (/sube y cae|contorno en arco|\barco\b/.test(t)) return 'sube-y-cae';
  return null;
}

const SYLLABLE_WORDS: Record<string, number> = {
  pentasílab: 5,
  hexasílab: 6,
  heptasílab: 7,
  octosílab: 8,
  eneasílab: 9,
  decasílab: 10,
  endecasílab: 11,
};

export function lyricRuleOf(text: string): LyricRule {
  const t = text.toLowerCase();
  for (const [word, n] of Object.entries(SYLLABLE_WORDS))
    if (t.includes(word)) return { kind: 'metro', syllables: n };
  const numeric = /(\d+) s[íi]labas/.exec(t);
  if (numeric) return { kind: 'metro', syllables: Number(numeric[1]) };
  const banned = /(?:sin decir|prohibid[oa]|sin)\s+[“"«]([^”"»]+)[”"»]/i.exec(text);
  if (banned) return { kind: 'sin', word: banned[1]!.trim() };
  return null;
}

export interface RulesInput {
  rhythm: RhythmConfig;
  harmony: RuleText;
  melody: RuleText;
  lyric: RuleText;
}

export const rulesOf = ({ rhythm, harmony, melody, lyric }: RulesInput): LienzoRules => ({
  meter: meterOf(rhythm),
  harmony: harmonyRuleOf(`${harmony.label} ${harmony.rule}`),
  melody: melodyRuleOf(`${melody.label} ${melody.rule}`),
  lyric: lyricRuleOf(lyric.label),
});
