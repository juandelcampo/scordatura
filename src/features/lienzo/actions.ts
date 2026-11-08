// Las acciones del lienzo. Leen y escriben el store directo, así se pueden llamar desde un menú
// contextual o una ventana sin pasar nada por props.
import { makeHarmony, keyFor, applyHR, type HrPreset } from '~/core/lienzo/harmony';
import { sectionId } from '~/core/lienzo/form';
import { makeRhythm } from '~/core/lienzo/rhythm';
import type { LienzoRules } from '~/core/lienzo/rules';
import type { Chord, LaneId, LaneRhythm, Project, Section, Variant, VariantKind } from '~/core/lienzo/types';
import { CONTOURS, type ContourId } from '~/core/melody';
import type { Risk } from '~/core/roll';
import { createRng, randomSeed } from '~/core/rng';
import { newId, useLienzo, type VariantInput } from '~/shared/lienzo';
import { useLienzoUi } from '~/shared/lienzoUi';

const store = () => useLienzo.getState();
const project = () => store().project!;
const rng = () => createRng(randomSeed());

const NAMES: Record<VariantKind, string> = {
  armonia: 'Armonía',
  melodia: 'Melodía',
  ritmo: 'Ritmo',
  letra: 'Letra',
};
export const nextName = (kind: VariantKind) =>
  `${NAMES[kind]} ${project().lib.filter((v) => v.kind === kind).length + 1}`;

export const rootOf = (p: Project, sec: Section) =>
  sec.of ? (p.secs.find((s) => s.id === sec.of) ?? sec) : sec;

/** Suma una variante y la pone en esa sección. */
export function putVariant(sec: Section, variant: VariantInput): string {
  const id = store().addVariant(variant);
  store().place(variant.kind as LaneId, sec, id);
  const lane = variant.kind as LaneId;
  useLienzoUi.getState().select({ lane, sec: lane === 'letra' ? sec.id : (sec.of ?? sec.id), take: null });
  return id;
}

export function rollVariant(
  kind: Exclude<VariantKind, 'letra'>,
  sec: Section,
  rules: LienzoRules,
  risk: Risk,
  mode?: LaneRhythm['mode'],
): string {
  const r = rng();
  const p = project();
  if (kind === 'armonia')
    return putVariant(sec, {
      kind,
      name: nextName(kind),
      chords: makeHarmony(p.key, rules.harmony, risk, r),
    });
  if (kind === 'ritmo')
    return putVariant(sec, { kind, name: nextName(kind), config: makeRhythm(rules.meter, risk, r, mode) });
  const contours = Object.keys(CONTOURS) as ContourId[];
  return putVariant(sec, {
    kind,
    name: nextName(kind),
    contour: rules.melody === 'sube-y-cae' ? 'arco' : r.pick(contours),
    fill: 'apoyos',
    seed: r.int(1, 999),
    shift: sec.energy >= 3 ? 3 : sec.energy <= 1 ? -2 : 0,
    notes: null,
  });
}

/** Sortea armonías para todas las secciones raíz que no están trabadas. */
export function rollAllHarmony(rules: LienzoRules, risk: Risk) {
  const p = project();
  for (const sec of p.secs) if (!sec.of && !p.lockedSecs[sec.id]) rollVariant('armonia', sec, rules, risk);
}

export function harmonyOf(sec: Section) {
  const p = project();
  const v = p.lib.find((x) => x.id === p.clips[keyFor('armonia', sec)]);
  return v?.kind === 'armonia' ? v : undefined;
}

/** Suma un acorde al final de la armonía de la sección (o crea una). Como mucho, 8. */
export function addChord(sec: Section, chord: Chord) {
  const h = harmonyOf(sec);
  if (h) store().updateVariant(h.id, (v) => ({ chords: [...(v as typeof h).chords, chord].slice(-8) }));
  else putVariant(sec, { kind: 'armonia', name: nextName('armonia'), chords: [chord] });
  useLienzoUi.getState().select({ lane: 'armonia', sec: sec.of ?? sec.id, take: null });
}

export function putChords(sec: Section, chords: Chord[], name: string) {
  putVariant(sec, { kind: 'armonia', name, chords });
}

export function editChords(sec: Section, fn: (chords: Chord[]) => Chord[]) {
  const h = harmonyOf(sec);
  if (h) store().updateVariant(h.id, (v) => ({ chords: fn((v as typeof h).chords) }));
}

export const harmonicPreset = (sec: Section, preset: HrPreset) =>
  editChords(sec, (c) => applyHR(c, preset, rng()));

export function newLyric(sec: Section, text = '', name?: string): string {
  const id = store().addVariant({ kind: 'letra', name: name ?? nextName('letra'), text });
  store().place('letra', sec, id);
  useLienzoUi.getState().set({ lyricInst: id, lyricMode: 'write' });
  return id;
}

// --- Secciones -----------------------------------------------------------------------------

const freeLetter = (p: Project) =>
  'ABCDEFGH'.split('').find((l) => !p.secs.some((s) => s.label === l)) ?? 'X';

export function addSection() {
  const p = project();
  store().setSecs([...p.secs, { id: sectionId(), label: freeLetter(p), bars: 4, energy: 2 }]);
}

export function moveSection(from: number, to: number) {
  const secs = [...project().secs];
  if (from === to || from < 0 || to < 0 || from >= secs.length || to >= secs.length) return;
  const [item] = secs.splice(from, 1);
  secs.splice(to, 0, item!);
  store().setSecs(secs);
}

export function repeatAtEnd(sec: Section) {
  const p = project();
  const root = rootOf(p, sec);
  store().setSecs([
    ...p.secs,
    { id: sectionId(), label: root.label, bars: root.bars, of: root.id, energy: sec.energy },
  ]);
}

/** Inserta una sección nueva después de esta, con su armonía (y su letra, si viene). */
export function graft(after: Section, chords: Chord[], name: string, text?: string, label?: string) {
  const p = project();
  const id = sectionId();
  const secs = [...p.secs];
  const sec: Section = {
    id,
    label: label ?? freeLetter(p),
    bars: 8,
    energy: Math.min(4, after.energy + 1) as Section['energy'],
  };
  secs.splice(secs.findIndex((s) => s.id === after.id) + 1, 0, sec);
  store().setSecs(secs);
  putVariant(sec, { kind: 'armonia', name, chords });
  if (text) newLyric(sec, text, name);
}

export function convertTo(sec: Section, root: Section) {
  store().setSecs(
    project().secs.map((s) =>
      s.id === sec.id ? { id: s.id, label: root.label, bars: root.bars, of: root.id, energy: s.energy } : s,
    ),
  );
}

/** Una repetición pasa a ser única: se lleva copia de la armonía, la melodía y el ritmo de su raíz. */
export function unlink(sec: Section) {
  if (!sec.of) return;
  store().update((p) => {
    const clips = { ...p.clips };
    for (const lane of ['armonia', 'melodia', 'ritmo'] as const) {
      const id = clips[`${lane}:${sec.of}`];
      if (id) clips[`${lane}:${sec.id}`] = id;
    }
    return {
      clips,
      secs: p.secs.map((s) =>
        s.id === sec.id
          ? {
              id: s.id,
              label: s.label,
              bars: s.bars,
              energy: s.energy,
              ...(s.phrase ? { phrase: s.phrase } : {}),
            }
          : s,
      ),
    };
  });
}

export function deleteSection(sec: Section) {
  const p = project();
  if (p.secs.length < 2) return;
  const secs = p.secs.filter((s) => s.id !== sec.id && s.of !== sec.id);
  store().setSecs(secs);
  useLienzoUi.getState().select({ sec: secs[0]!.id, take: null });
}

// --- Tomas ---------------------------------------------------------------------------------

export function addTake(take: Omit<Project['takes'][number], 'id'>) {
  const id = newId('t');
  store().update((p) => ({ takes: [...p.takes, { ...take, id }] }));
  useLienzoUi.getState().select({ lane: 'tomas', take: id });
  return id;
}

export const variantsOf = (p: Project, kind: VariantKind) =>
  p.lib.filter((v) => v.kind === kind) as Variant[];
