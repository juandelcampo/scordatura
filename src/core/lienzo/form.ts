// La forma: plantillas, contraste entre secciones, cuándo llega el título y "más rápido y más corto".
import { chordOf, type Check } from './harmony';
import { linesOf, syllables } from './lyrics';
import { melDegs, melSlots, type MelodyRule } from './melody';
import { clipOf } from './project';
import { density } from './rhythm';
import type { Energy, Project, Section } from './types';

let counter = 0;
export const sectionId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

/** La otra sección con la que conviene comparar: A ↔ B, C ↔ B. */
export function partnerOf(secs: readonly Section[], sec: Section): Section | null {
  const roots = secs.filter(
    (x) => !x.of && x.id !== sec.id && x.label !== 'Intro' && x.bars > 1 && x.label !== sec.label,
  );
  if (!roots.length) return null;
  const wanted = ({ A: 'B', B: 'A', C: 'B', D: 'A' } as Record<string, string>)[sec.label];
  return roots.find((x) => x.label === wanted) ?? roots[0]!;
}

export interface ContrastItem {
  /** null: dato, sin juicio. */
  ok: boolean | null;
  t: string;
}

export function contrast(p: Project, melodyRule: MelodyRule, a: Section, b: Section): ContrastItem[] {
  const out: ContrastItem[] = [];
  const ha = clipOf(p, 'armonia', a);
  const hb = clipOf(p, 'armonia', b);
  if (ha?.chords.length && hb?.chords.length) {
    const fa = chordOf(ha.chords[0]!, p.key).name;
    const fb = chordOf(hb.chords[0]!, p.key).name;
    out.push(
      ha.id === hb.id
        ? { ok: false, t: 'Armonía: la misma progresión.' }
        : fa === fb
          ? { ok: false, t: `Armonía: las dos entran por ${fa}.` }
          : { ok: true, t: `Armonía: ${a.label} entra por ${fa}, ${b.label} por ${fb}.` },
    );
  } else out.push({ ok: null, t: `Armonía: falta en ${ha ? b.label : a.label}.` });

  const ra = clipOf(p, 'ritmo', a);
  const rb = clipOf(p, 'ritmo', b);
  if (ra && rb) {
    const da = density(ra.config);
    const db = density(rb.config);
    out.push(
      ra.id === rb.id
        ? { ok: false, t: 'Ritmo: el mismo patrón.' }
        : Math.abs(da - db) < 0.12
          ? { ok: false, t: 'Ritmo: igual de lleno.' }
          : { ok: true, t: `Ritmo: ${da > db ? a.label : b.label} es más lleno.` },
    );
  } else out.push({ ok: null, t: `Ritmo: falta en ${ra ? b.label : a.label}.` });

  const ea = a.energy;
  const eb = b.energy;
  out.push(
    ea === eb
      ? { ok: false, t: `Intensidad: las dos en ${ea}.` }
      : {
          ok: true,
          t: `Intensidad: ${ea > eb ? a.label : b.label} empuja más (${Math.max(ea, eb)} a ${Math.min(ea, eb)}).`,
        },
  );

  const la = linesOf(clipOf(p, 'letra', a)?.text);
  const lb = linesOf(clipOf(p, 'letra', b)?.text);
  if (la.length && lb.length) {
    const avg = (xs: string[]) => xs.reduce((n, l) => n + syllables(l), 0) / xs.length;
    out.push(
      la.length === lb.length && Math.abs(avg(la) - avg(lb)) < 1.5
        ? { ok: false, t: 'Letra: mismos versos, mismo largo.' }
        : {
            ok: true,
            t: `Letra: ${la.length} de ~${Math.round(avg(la))} contra ${lb.length} de ~${Math.round(avg(lb))}.`,
          },
    );
  }

  const ma = clipOf(p, 'melodia', a);
  const mb = clipOf(p, 'melodia', b);
  if (ma && mb) {
    const height = (sec: Section, v: typeof ma) => {
      const slots = melSlots(sec, clipOf(p, 'letra', sec)?.text);
      const ds = melDegs(v, sec, slots, clipOf(p, 'armonia', sec)?.chords ?? null, p.key, melodyRule).filter(
        (x): x is number => x !== null,
      );
      return ds.length ? ds.reduce((s, x) => s + x, 0) / ds.length : 0;
    };
    const pa = height(a, ma);
    const pb = height(b, mb);
    out.push(
      Math.abs(pa - pb) < 1.5
        ? { ok: false, t: 'Melodía: mismo registro.' }
        : { ok: true, t: `Melodía: ${pa > pb ? a.label : b.label} canta más arriba.` },
    );
  }
  if (ea !== eb) {
    const hi = ea > eb ? a : b;
    const lo = ea > eb ? b : a;
    out.push({ ok: null, t: `Cantá ${hi.label} más arriba y más largo que ${lo.label}.` });
  }
  return out;
}

/**
 * Aplica una plantilla y conserva lo que ya había: cada etiqueta vuelve a su sección raíz, así sus
 * variantes siguen en su lugar.
 */
export function applyForm(
  current: readonly Section[],
  labels: readonly string[],
  energies?: readonly number[],
  bars?: readonly number[],
): Section[] {
  const rootByLabel = new Map<string, Section>();
  for (const s of current) if (!s.of && !rootByLabel.has(s.label)) rootByLabel.set(s.label, s);
  const used = new Map<string, Section>();
  return labels.map((label, i) => {
    const energy = (energies?.[i] ?? 2) as Energy;
    const root = used.get(label);
    if (root) return { id: sectionId(), label, bars: root.bars, of: root.id, energy };
    const base = rootByLabel.get(label) ?? {
      id: sectionId(),
      label,
      bars: label === 'Intro' ? 4 : 8,
      energy,
    };
    const sec: Section = {
      id: base.id,
      label,
      bars: bars?.[i] ?? base.bars,
      energy,
      ...(base.phrase ? { phrase: base.phrase } : {}),
    };
    used.set(label, sec);
    return sec;
  });
}

/** Estructura normal, tocada rápido: cuenta de entrada, nada de más de 8 compases, puente de 4. */
export function faster(secs: readonly Section[], bpm: number): { secs: Section[]; bpm: number } {
  let out = secs.map((s) => ({ ...s, bars: s.label === 'C' ? Math.min(s.bars, 4) : Math.min(s.bars, 8) }));
  if (!out.some((s) => s.label === '1-2-3-4')) {
    out = [
      { id: sectionId(), label: '1-2-3-4', bars: 1, energy: 4 },
      ...out.filter((s) => s.label !== 'Intro'),
    ];
  }
  return { secs: out, bpm: Math.max(bpm, 176) };
}

/** En qué compás aparece el título por primera vez en una letra, o -1. */
export function titleBar(p: Project): number {
  const title = p.title.trim().toLowerCase();
  if (!title) return -1;
  let before = 0;
  for (const sec of p.secs) {
    const text = clipOf(p, 'letra', sec)?.text ?? '';
    if (text.toLowerCase().includes(title)) return before;
    before += sec.bars;
  }
  return -1;
}

/** Las secciones cuya letra dice el título. */
export const titleSections = (p: Project) => {
  const title = p.title.trim().toLowerCase();
  return title
    ? [
        ...new Set(
          p.secs
            .filter((s) => (clipOf(p, 'letra', s)?.text ?? '').toLowerCase().includes(title))
            .map((s) => s.label),
        ),
      ]
    : [];
};

export interface FormTemplate {
  label: string;
  hint: string;
  labels: string[];
  energies: number[];
  bars?: number[];
}

export type { Check };
