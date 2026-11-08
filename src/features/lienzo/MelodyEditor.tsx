// El editor de melodía: filas = grados de la escala, columnas = sílabas de la letra. En cada columna se
// sombrean las notas del acorde que suena ahí. Tocar una celda pone o saca la nota.
import { previewNote } from '~/audio/lienzo';
import { getAudio } from '~/audio/engine';
import { pluckString } from '~/audio/instrument';
import { chordAtT, chordOf } from '~/core/lienzo/harmony';
import { degMidi, degPc, genMel, melDegs, melSlots } from '~/core/lienzo/melody';
import { clipOf } from '~/core/lienzo/project';
import { quartersPerBar } from '~/core/lienzo/rhythm';
import type { Section, VariantOf } from '~/core/lienzo/types';
import { CONTOURS, type ContourId } from '~/core/melody';
import { useLienzo } from '~/shared/lienzo';
import { useSettings } from '~/shared/settings';
import { LinkBtn, Opt } from './bits';
import { currentPlan } from './plan';
import { useModel } from './model';
import s from './lienzo.module.css';

const NN = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const ROWS = 15;

export function playSectionMelody(sec: Section) {
  const { project: p, rules, a4 } = currentPlan();
  const v = clipOf(p, 'melodia', sec);
  if (!v) return;
  const slots = melSlots(sec, clipOf(p, 'letra', sec)?.text);
  const degs = melDegs(v, sec, slots, clipOf(p, 'armonia', sec)?.chords ?? null, p.key, rules.melody);
  const bar = (quartersPerBar(rules.meter) * 60) / p.bpm;
  const { ctx } = getAudio();
  const t0 = ctx.currentTime + 0.05;
  slots.forEach((slot, i) => {
    const d = degs[i];
    if (d !== null && d !== undefined) pluckString(5, degMidi(d, p.key), { a4, when: t0 + slot.t * bar });
  });
}

export function MelodyEditor({
  v,
  sec,
  nowT,
}: {
  v: VariantOf<'melodia'>;
  sec: Section;
  nowT: number | null;
}) {
  const { project: p, rules } = useModel();
  const a4 = useSettings((st) => st.a4);
  const update = useLienzo((st) => st.updateVariant);
  const lyric = clipOf(p, 'letra', sec)?.text;
  const harmony = clipOf(p, 'armonia', sec)?.chords ?? null;
  const slots = melSlots(sec, lyric);
  const degs = melDegs(v, sec, slots, harmony, p.key, rules.melody);
  const n = slots.length;
  const lo = -4 + v.shift;
  const hi = lo + ROWS - 1;
  const cw = Math.max(9, Math.min(22, Math.floor(520 / Math.max(1, n))));
  const rh = 11;
  const W = n * cw;
  const H = ROWS * rh;
  const rect = (c: number, r: number, inset = 0) =>
    `M${c * cw + inset} ${r * rh + inset}h${cw - 2 * inset}v${rh - 2 * inset}h${-(cw - 2 * inset)}Z`;
  let tonic = '';
  let grid = '';
  let guide = '';
  let notes = '';
  let now = '';
  let lines = '';
  for (let r = 0; r < ROWS; r++) {
    if (degPc(hi - r, p.key) === p.key.tonic) tonic += `M0 ${r * rh}h${W}v${rh}h${-W}Z`;
    grid += `M0 ${r * rh}H${W}`;
  }
  slots.forEach((slot, c) => {
    const chord = harmony?.length ? chordOf(chordAtT(harmony, sec.bars, slot.t)!, p.key) : null;
    if (chord)
      for (let r = 0; r < ROWS; r++) if (chord.pcs.includes(degPc(hi - r, p.key))) guide += rect(c, r);
    if (slot.first && c) lines += `M${c * cw} 0V${H}`;
    const d = degs[c];
    if (d !== null && d !== undefined && d >= lo && d <= hi) {
      const box = rect(c, hi - d, 1);
      notes += box;
      if (nowT !== null && nowT >= slot.t && nowT < slot.t + slot.dur) now += box;
    }
  });
  const materialize = () => melDegs(v, sec, slots, harmony, p.key, rules.melody);
  const click = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const c = Math.floor((e.clientX - r.left) / cw);
    const row = Math.floor((e.clientY - r.top) / rh);
    if (c < 0 || c >= n || row < 0 || row >= ROWS) return;
    const d = hi - row;
    const next = materialize();
    next[c] = next[c] === d ? null : d;
    if (next[c] !== null) previewNote(degMidi(d, p.key), a4);
    update(v.id, { notes: next });
  };
  const groups: { n: number; label: string; line: number }[] = [];
  for (const slot of slots) {
    const last = groups[groups.length - 1];
    if (last && last.line === slot.line) last.n += 1;
    else groups.push({ n: 1, label: slot.label, line: slot.line });
  }
  const sung = degs.filter((d): d is number => d !== null);
  const onChord = degs.filter(
    (d, i) =>
      d !== null &&
      harmony?.length &&
      chordOf(chordAtT(harmony, sec.bars, slots[i]!.t)!, p.key).pcs.includes(degPc(d, p.key)),
  ).length;
  const last = [...degs].reverse().find((d): d is number => d !== null);
  const read = sung.length
    ? `${NN[degPc(Math.min(...sung), p.key)]}–${NN[degPc(Math.max(...sung), p.key)]} · ${Math.round((onChord / sung.length) * 100)}% sobre el acorde · ${last !== undefined && degPc(last, p.key) === p.key.tonic ? 'cierra' : 'queda abierta'}`
    : 'Tocá la grilla.';
  return (
    <>
      <div className={s.pane}>
        <span className={s.small} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span>{lyric?.trim() ? 'una columna por sílaba' : 'dos notas por compás (sin letra)'}</span>
          <span>
            {sung.length} de {n} notas
          </span>
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <div
            aria-hidden="true"
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'var(--mono)',
              fontSize: 9.5,
              textAlign: 'right',
              width: 28,
            }}
          >
            {Array.from({ length: ROWS }, (_, r) => {
              const pc = degPc(hi - r, p.key);
              return (
                <span
                  key={r}
                  style={{
                    height: rh,
                    lineHeight: `${rh}px`,
                    color: pc === p.key.tonic ? 'var(--accent)' : 'var(--muted)',
                    fontWeight: pc === p.key.tonic ? 600 : 400,
                  }}
                >
                  {NN[pc]}
                </span>
              );
            })}
          </div>
          <div
            role="grid"
            aria-label="Editor de melodía: tocá una celda para poner o sacar una nota"
            className={s.mel}
            style={{ width: W + 2, height: H + 2 }}
            onPointerDown={click}
          >
            <svg
              width={W}
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              aria-hidden="true"
              style={{ display: 'block' }}
            >
              <path d={tonic} fill="var(--faint)" />
              <path d={guide} fill="var(--accent)" fillOpacity="0.16" />
              <path d={grid} fill="none" stroke="var(--faint)" />
              <path d={lines} fill="none" stroke="var(--ink)" />
              <path d={notes} fill="var(--ink)" />
              <path d={now} fill="none" stroke="var(--accent)" strokeWidth="2" />
            </svg>
          </div>
        </div>
        <div style={{ display: 'flex', marginLeft: 34, fontSize: 10.5, color: 'var(--muted)' }}>
          {groups.map((g, i) => (
            <span
              key={i}
              className={s.ellipsis}
              style={{ width: g.n * cw, borderLeft: '1px solid var(--faint)', paddingLeft: 3 }}
            >
              {g.label ? `${g.label.split(' ').slice(0, 2).join(' ')}…` : `frase ${g.line + 1}`}
            </span>
          ))}
        </div>
      </div>
      <div className={s.pane} style={{ width: 270 }}>
        <span className={s.small}>Contorno</span>
        <div className={s.row}>
          {(Object.keys(CONTOURS) as ContourId[]).map((c) => (
            <Opt key={c} on={v.contour === c} onClick={() => update(v.id, { contour: c, notes: null })}>
              {c}
            </Opt>
          ))}
        </div>
        <span className={s.small}>Registro</span>
        <div className={s.row}>
          {(
            [
              ['bajar', -1],
              ['subir', 1],
            ] as const
          ).map(([label, d]) => (
            <LinkBtn
              key={label}
              onClick={() =>
                update(v.id, (x) => {
                  const m = x as VariantOf<'melodia'>;
                  return {
                    shift: m.shift + d,
                    notes: Array.isArray(m.notes) ? m.notes.map((q) => (q === null ? null : q + d)) : null,
                  };
                })
              }
            >
              {label}
            </LinkBtn>
          ))}
        </div>
        <div className={s.row}>
          <LinkBtn onClick={() => playSectionMelody(sec)}>escuchar</LinkBtn>
          <LinkBtn onClick={() => update(v.id, { notes: null, fill: 'apoyos', seed: v.seed + 1 })}>
            sortear apoyos
          </LinkBtn>
          <LinkBtn
            onClick={() => {
              const full = genMel(v, sec, slots, harmony, p.key, rules.melody, 'completa');
              update(v.id, { notes: materialize().map((q, i) => (q === null ? (full[i] ?? null) : q)) });
            }}
          >
            completar con el contorno
          </LinkBtn>
          <LinkBtn onClick={() => update(v.id, { notes: slots.map(() => null) })}>vaciar</LinkBtn>
        </div>
        <span className={s.small}>{read}</span>
      </div>
    </>
  );
}
