// El lienzo: la forma arriba, un carril por dimensión musical y las tomas. Cada celda es la variante
// que suena en esa sección; las repeticiones muestran la de su raíz.
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type PointerEvent as RPointerEvent,
} from 'react';
import { lienzoPlayer } from '~/audio/lienzo';
import { applyForm, faster, titleBar } from '~/core/lienzo/form';
import { applyHR, chordOf, degName, keyFor, segsOf, tensionOf } from '~/core/lienzo/harmony';
import { linesOf } from '~/core/lienzo/lyrics';
import { melDegs, melSlots } from '~/core/lienzo/melody';
import { barsToSeconds, clipOf, formatTime, totalBars, variantById } from '~/core/lienzo/project';
import { rBar } from '~/core/lienzo/rhythm';
import { LANES, type LaneId, type Section, type Variant } from '~/core/lienzo/types';
import { describeRhythm, type RhythmConfig } from '~/core/rhythm';
import { createRng, randomSeed } from '~/core/rng';
import { FORM_TEMPLATES } from '~/data/forms';
import { useJournal } from '~/shared/journal';
import { useLienzo } from '~/shared/lienzo';
import { useLienzoUi, type CtxItem } from '~/shared/lienzoUi';
import {
  addSection,
  convertTo,
  deleteSection,
  editChords,
  graft,
  moveSection,
  newLyric,
  repeatAtEnd,
  rollVariant,
  rootOf,
} from './actions';
import { fmtLen, openCtx, Steps, usePlaying, usePosition } from './bits';
import { checkCell } from './checks';
import { Detail as DetailSlot } from './Detail';
import { useModel } from './model';
import s from './lienzo.module.css';

export const rhythmName = (config: Extract<Variant, { kind: 'ritmo' }>['config']) =>
  describeRhythm({ ...config, bpm: 100 } as RhythmConfig).label;

export function variantLabel(v: Variant, key: Parameters<typeof chordOf>[1]): string {
  if (v.kind === 'armonia')
    return (
      v.chords
        .map((c) => chordOf(c, key).name + ((c.len ?? 1) !== 1 ? `·${fmtLen(c.len!)}` : ''))
        .filter((n, i, a) => i === 0 || n !== a[i - 1])
        .join(' ') || v.name
    );
  if (v.kind === 'ritmo') return rhythmName(v.config);
  if (v.kind === 'melodia') return `${v.name} · ${v.contour}`;
  return v.name;
}

function Browser() {
  const { project } = useModel();
  const ui = useLienzoUi();
  const [open, setOpen] = useState<Record<string, boolean>>({
    armonia: true,
    ritmo: true,
    melodia: false,
    letra: false,
  });
  if (!ui.browser)
    return (
      <button
        type="button"
        className={s.asideClosed}
        aria-label="Abrir variantes"
        onClick={() => ui.set({ browser: true })}
      >
        <span aria-hidden="true">›</span>
        <span className={s.vertical}>Variantes</span>
      </button>
    );
  const uses = (id: string) => {
    const where = new Set<string>();
    for (const sec of project.secs)
      for (const lane of LANES) if (project.clips[`${lane.id}:${sec.id}`] === id) where.add(sec.label);
    return where.size ? [...where].join(' ') : '—';
  };
  return (
    <aside aria-label="Variantes del proyecto" className={s.aside}>
      <div className={s.asideHead}>
        <span>Variantes</span>
        <button
          type="button"
          className={s.close}
          aria-label="Plegar variantes"
          onClick={() => ui.set({ browser: false })}
        >
          ‹
        </button>
      </div>
      {LANES.map((lane) => {
        const items = project.lib.filter((v) => v.kind === lane.id);
        return (
          <div key={lane.id} className={s.group}>
            <button
              type="button"
              className={s.groupBtn}
              aria-expanded={!!open[lane.id]}
              onClick={() => setOpen({ ...open, [lane.id]: !open[lane.id] })}
            >
              <span>{lane.name}</span>
              <span className={`${s.mono} ${s.small}`}>
                {items.length} {open[lane.id] ? '−' : '+'}
              </span>
            </button>
            {open[lane.id] &&
              items.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  draggable
                  className={s.variant}
                  aria-pressed={ui.armed === v.id}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/x-variant', v.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => ui.set({ armed: ui.armed === v.id ? null : v.id })}
                >
                  <span className={s.ellipsis}>{variantLabel(v, project.key)}</span>
                  <span className={`${s.mono} ${s.small}`}>{uses(v.id)}</span>
                </button>
              ))}
          </div>
        );
      })}
      <span className={s.small} style={{ padding: '12px 16px' }}>
        Arrastrá una a su carril, o elegila y tocá una sección.
      </span>
    </aside>
  );
}

/** La línea de reproducción: se mueve sola, sin re-renderizar el lienzo. */
function Playhead({ total }: { total: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const playing = usePlaying();
  useEffect(() => {
    let frame = 0;
    const place = () => {
      if (ref.current)
        ref.current.style.left = `calc(120px + (100% - 156px) * ${lienzoPlayer.position() / Math.max(1, total)})`;
    };
    place();
    const off = lienzoPlayer.subscribe(place);
    if (playing) {
      const loop = () => {
        place();
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(frame);
      off();
    };
  }, [playing, total]);
  return <div ref={ref} className={s.playhead} aria-hidden="true" />;
}

function Scrub({ total, seconds, span }: { total: number; seconds: number; span: number }) {
  const pos = usePosition(8);
  const frac = Math.min(1, pos / Math.max(1, total));
  const seek = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    lienzoPlayer.seek(((clientX - r.left) / r.width) * total);
  };
  const down = (e: RPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    seek(e.clientX, el);
    const move = (ev: PointerEvent) => seek(ev.clientX, el);
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  return (
    <>
      <div className={s.clock} style={{ paddingLeft: 24 }}>
        {formatTime(frac * seconds)} / {formatTime(seconds)}
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Posición en el tema. Arrastrá o usá las flechas."
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(frac * 100)}
        className={s.scrub}
        style={{
          gridColumn: `2 / span ${span}`,
          backgroundImage: `repeating-linear-gradient(90deg, var(--faint) 0 1px, transparent 1px calc(100% / ${total}))`,
        }}
        onPointerDown={down}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            lienzoPlayer.seek(
              Math.floor(lienzoPlayer.position()) + (e.key === 'ArrowRight' ? 1 : -1) + 0.001,
            );
          }
        }}
      >
        <span className={s.scrubFill} style={{ width: `${frac * 100}%` }} />
      </div>
      <div />
    </>
  );
}

function SectionHead({ sec, idx, total }: { sec: Section; idx: number; total: number }) {
  const { project, rules, risk } = useModel();
  const ui = useLienzoUi();
  const store = useLienzo();
  const gridWidth = useRef(0);
  const on = ui.sel.sec === sec.id || ui.sel.sec === sec.of;
  const root = rootOf(project, sec);
  const items = (): CtxItem[] => {
    const others = project.secs.filter((x) => !x.of && x.id !== root.id);
    const copies = project.secs.filter((x) => x.of === root.id);
    const list: CtxItem[] = [
      { label: 'Sortear armonía', fn: () => rollVariant('armonia', root, rules, risk) },
      { label: 'Sortear ritmo', fn: () => rollVariant('ritmo', root, rules, risk) },
      {
        label: project.lockedSecs[root.id] ? 'Destrabar armonía' : 'Trabar armonía',
        fn: () => store.toggleLockSec(root.id),
      },
      { label: 'Mover a la izquierda', fn: () => moveSection(idx, idx - 1) },
      { label: 'Mover a la derecha', fn: () => moveSection(idx, idx + 1) },
      {
        label: sec.phrase === 'back' ? 'Frases en el uno' : 'Frases después del uno',
        hint: sec.phrase === 'back' ? 'más firme' : 'más flotante',
        fn: () => store.patchSection(sec.id, { phrase: sec.phrase === 'back' ? 'front' : 'back' }),
      },
      { label: 'Repetir al final', fn: () => repeatAtEnd(sec) },
      {
        label: 'Sumar un puente de ocho después',
        hint: 'entra por otro acorde',
        fn: () =>
          graft(
            sec,
            (rules.harmony === 'sin-v' ? [3, 5, 3, 6] : [3, 5, 3, 4]).map((d) => ({ d })),
            'Puente',
          ),
      },
    ];
    const previous = useLienzo.getState().archive[0];
    if (previous) {
      const prevRoot = previous.secs.find((x) => !x.of && clipOf(previous, 'armonia', x));
      const prevHarmony = prevRoot ? clipOf(previous, 'armonia', prevRoot) : undefined;
      if (prevRoot && prevHarmony)
        list.push({
          label: `Injertar un pedazo de “${previous.title || 'la anterior'}”`,
          hint: 'juntá dos canciones a medio hacer',
          fn: () =>
            graft(
              sec,
              prevHarmony.chords,
              `De “${previous.title || 'la anterior'}”`,
              clipOf(previous, 'letra', prevRoot)?.text,
            ),
        });
    }
    for (const o of others)
      list.push({
        label: `Convertir en repetición de ${o.label}`,
        hint: 'toma su armonía y su ritmo',
        fn: () => convertTo(sec, o),
      });
    if (sec.of) list.push({ label: 'Hacer única', fn: () => import('./actions').then((a) => a.unlink(sec)) });
    else if (copies.length)
      list.push({
        label: 'Hacer únicas las repeticiones',
        fn: () => import('./actions').then((a) => copies.forEach(a.unlink)),
      });
    if (project.secs.length > 1)
      list.push({ label: 'Borrar sección', danger: true, fn: () => deleteSection(sec) });
    return list;
  };
  const resize = (e: RPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const grid = (e.currentTarget as HTMLElement).closest('[data-grid]') as HTMLElement | null;
    gridWidth.current = grid ? grid.clientWidth - 156 : 900;
    const perBar = Math.max(8, gridWidth.current / total);
    const sx = e.clientX;
    const start = sec.bars;
    const move = (ev: PointerEvent) => store.setBars(sec.id, start + Math.round((ev.clientX - sx) / perBar));
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  return (
    <div
      className={s.sec}
      data-on={on}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/x-section', String(idx));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => e.dataTransfer.types.includes('text/x-section') && e.preventDefault()}
      onDrop={(e) => {
        const from = e.dataTransfer.getData('text/x-section');
        if (from) {
          e.preventDefault();
          moveSection(Number(from), idx);
        }
      }}
      onContextMenu={(e) => openCtx(e, `Sección ${sec.label}`, items())}
    >
      <button
        type="button"
        className={s.energy}
        aria-label={`Intensidad de ${sec.label}: ${sec.energy} de 4. Tocá para cambiarla.`}
        onClick={() => store.patchSection(sec.id, { energy: ((sec.energy % 4) + 1) as Section['energy'] })}
      >
        {[1, 2, 3, 4].map((lv) => (
          <span key={lv} data-on={lv <= sec.energy} style={{ height: 3 + lv * 3 }} />
        ))}
      </button>
      <button
        type="button"
        className={s.secName}
        aria-label={`Elegir la sección ${sec.label}`}
        onClick={() =>
          ui.select({
            lane: ui.sel.take ? 'armonia' : ui.sel.lane,
            sec: ui.sel.lane === 'letra' ? sec.id : (sec.of ?? sec.id),
            take: null,
          })
        }
      >
        <span className={s.secLabel}>{sec.label}</span>
        <span className={`${s.mono} ${s.small}`} style={{ whiteSpace: 'nowrap' }}>
          {sec.bars} c.{sec.of ? ' · repite' : ''}
        </span>
      </button>
      <button
        type="button"
        className={s.resize}
        aria-label={`Duración de ${sec.label}: ${sec.bars} compases. Flechas izquierda y derecha.`}
        onPointerDown={resize}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            store.setBars(sec.id, sec.bars + (e.key === 'ArrowRight' ? 1 : -1));
          }
        }}
      >
        <span />
      </button>
    </div>
  );
}

interface Now {
  sec: Section;
  bar: number;
  t: number;
}

function laneItems(
  lane: LaneId,
  sec: Section,
  root: Section,
  v: Variant | undefined,
  ref: boolean,
  ctxApi: ReturnType<typeof useModel>,
): CtxItem[] {
  const { rules, risk } = ctxApi;
  const ui = useLienzoUi.getState();
  const store = useLienzo.getState();
  const select = () => ui.select({ lane, sec: lane === 'letra' ? sec.id : root.id, take: null });
  const list: CtxItem[] = [];
  if (lane === 'armonia') {
    list.push({
      label: v ? 'Sortear otra armonía' : 'Sortear armonía acá',
      fn: () => rollVariant('armonia', root, rules, risk),
    });
    list.push({ label: 'Elegir acordes de la tonalidad', fn: () => (select(), ui.openWin('tono')) });
    if (v) list.push({ label: 'Ver cómo se tocan', fn: () => (select(), ui.openWin('acordes')) });
    if (v && !ref) {
      list.push({
        label: 'Acordes más largos',
        hint: 'ritmo armónico más lento',
        fn: () => editChords(root, (c) => c.map((x) => ({ ...x, len: Math.min(4, (x.len ?? 1) * 2) }))),
      });
      list.push({
        label: 'Acordes más cortos',
        hint: 'ritmo armónico más rápido',
        fn: () => editChords(root, (c) => c.map((x) => ({ ...x, len: Math.max(0.5, (x.len ?? 1) / 2) }))),
      });
      list.push({
        label: 'Que acelere al final',
        fn: () => editChords(root, (c) => applyHR(c, 'acelera', createRng(randomSeed()))),
      });
      if (v.kind === 'armonia' && v.chords.length > 1)
        list.push({
          label: 'Rotar el orden',
          hint: 'el mismo ciclo, otra entrada',
          fn: () => editChords(root, (c) => [...c.slice(1), c[0]!]),
        });
    }
    const locked = !!useLienzo.getState().project!.lockedSecs[root.id];
    list.push({
      label: locked ? `Destrabar en ${root.label}` : `Trabar en ${root.label}`,
      fn: () => store.toggleLockSec(root.id),
    });
  }
  if (lane === 'ritmo') {
    list.push({ label: 'Editar ritmo', fn: () => (select(), ui.openWin('ritmo')) });
    list.push({
      label: v ? 'Sortear otro' : 'Sortear acá',
      hint: 'según el riesgo',
      fn: () => rollVariant('ritmo', root, rules, risk),
    });
    for (const [mode, label] of [
      ['meter', 'Compás agrupado'],
      ['euclid', 'Euclidiano'],
      ['poly', 'Polirritmia'],
      ['drum', 'Batería'],
      ['mutante', 'Mutante'],
    ] as const)
      list.push({ label: `Sortear · ${label}`, fn: () => rollVariant('ritmo', root, rules, risk, mode) });
  }
  if (lane === 'melodia') {
    list.push({
      label: v ? 'Editar melodía' : 'Empezar una melodía',
      fn: () => (v ? select() : rollVariant('melodia', root, rules, risk)),
    });
    list.push({
      label: 'Sortear apoyos',
      hint: 'unas notas sueltas para empezar',
      fn: () => rollVariant('melodia', root, rules, risk),
    });
    if (v)
      list.push({
        label: `Escuchar ${sec.label}`,
        fn: () => import('./MelodyEditor').then((m) => m.playSectionMelody(sec)),
      });
  }
  if (lane === 'letra') {
    if (v)
      list.push({
        label: 'Escribir',
        fn: () => (ui.set({ lyricInst: v.id, lyricMode: 'write' }), ui.openWin('letra')),
      });
    else list.push({ label: 'Escribir letra acá', fn: () => (newLyric(sec), ui.openWin('letra')) });
    list.push({
      label: 'Buscar material',
      hint: 'escalera, cortar y mezclar, objeto',
      fn: () => (ui.set({ lyricMode: 'material' }), ui.openWin('letra')),
    });
  }
  if (v && !ref)
    list.push({ label: `Quitar de ${sec.label}`, danger: true, fn: () => store.unplace(lane, sec) });
  return list;
}

function LaneCell({ lane, sec, now }: { lane: LaneId; sec: Section; now: Now | null }) {
  const model = useModel();
  const { project, rules } = model;
  const ui = useLienzoUi();
  const store = useLienzo();
  const mirror = LANES.find((l) => l.id === lane)!.mirror;
  const ref = !!(sec.of && mirror);
  const root = ref ? rootOf(project, sec) : sec;
  const v = variantById(project, project.clips[keyFor(lane, sec)]);
  const selected =
    ui.sel.lane === lane && !ui.sel.take && (ui.sel.sec === sec.id || (ref && ui.sel.sec === sec.of));
  const armed = ui.armed ? variantById(project, ui.armed) : undefined;
  const target = !!armed && armed.kind === lane && !ref;
  const chk = v && !ref ? checkCell(lane, v, sec, project, rules) : null;
  const locked = lane === 'armonia' && !!project.lockedSecs[root.id];
  const live = now && now.sec.id === sec.id ? now : null;
  const pick = () => {
    if (armed && target) {
      store.place(lane, sec, armed.id);
      ui.set({ armed: null });
      return;
    }
    ui.set({ detail: true, ctx: null });
    ui.select({ lane, sec: lane === 'letra' ? sec.id : root.id, take: null });
    if (lane === 'letra' && v) ui.set({ lyricInst: v.id });
  };
  const drop = (e: DragEvent) => {
    const id = e.dataTransfer.getData('text/x-variant');
    if (!id || ref) return;
    e.preventDefault();
    store.place(lane, sec, id);
  };
  const barsBg: CSSProperties =
    v && (lane === 'armonia' || lane === 'melodia') && !ref
      ? {
          backgroundImage: `repeating-linear-gradient(90deg, transparent 0 calc(100% / ${sec.bars} - 1px), var(--faint) calc(100% / ${sec.bars} - 1px) calc(100% / ${sec.bars}))`,
        }
      : {};
  const name = LANES.find((l) => l.id === lane)!.name;
  let inner: React.ReactNode = null;
  if (v?.kind === 'armonia') {
    inner = segsOf(v.chords, sec.bars).map((g, i) => {
      const isNow = !!live && live.t >= g.t && live.t < g.t + g.len;
      const tension = tensionOf(g.c, project.key);
      return (
        <span
          key={i}
          className={s.chordSeg}
          data-now={isNow}
          style={{
            flex: `${g.len} 1 0`,
            borderLeft: i ? `1px ${Number.isInteger(g.t) ? 'solid' : 'dotted'} var(--faint)` : 'none',
            boxShadow: tension && !isNow ? `inset 0 -${tension * 1.5}px 0 var(--accent)` : 'none',
          }}
        >
          <span>{chordOf(g.c, project.key).name}</span>
          <span className={s.deg}>{degName(g.c, project.key)}</span>
        </span>
      );
    });
  } else if (v?.kind === 'ritmo') {
    inner = Array.from({ length: sec.bars }, (_, bi) => (
      <span
        key={bi}
        className={s.barCell}
        data-now={!!live && live.bar === bi}
        style={{ borderLeft: bi ? '1px solid var(--faint)' : 'none' }}
      >
        <Steps levels={rBar(v.config, bi)} height={16} faded={ref} />
      </span>
    ));
  } else if (v?.kind === 'letra') {
    const lines = linesOf(v.text);
    const current =
      live && lines.length
        ? Math.min(lines.length - 1, Math.floor((live.bar * lines.length) / sec.bars))
        : -1;
    inner = lines.length ? (
      lines.map((l, i) => (
        <span
          key={i}
          className={s.lyricLine}
          data-now={current === i}
          style={{ borderLeft: i ? '1px solid var(--faint)' : 'none' }}
        >
          {l}
        </span>
      ))
    ) : (
      <span className={`${s.lyricLine} ${s.small}`}>{v.name} · vacía</span>
    );
  } else if (v?.kind === 'melodia') {
    const lyric = clipOf(project, 'letra', sec)?.text;
    const slots = melSlots(sec, lyric);
    const degs = melDegs(
      v,
      sec,
      slots,
      clipOf(project, 'armonia', sec)?.chords ?? null,
      project.key,
      rules.melody,
    );
    const y = (d: number) => Math.max(2, Math.min(38, 34 - (d + 4) * 2.2));
    let path = '';
    let nowPath = '';
    degs.forEach((d, i) => {
      if (d === null) return;
      const slot = slots[i]!;
      const seg = `M${((slot.t / sec.bars) * 100).toFixed(2)} ${y(d).toFixed(1)}H${(((slot.t + slot.dur) / sec.bars) * 100).toFixed(2)}`;
      path += seg;
      if (live && live.t >= slot.t && live.t < slot.t + slot.dur) nowPath += seg;
    });
    inner = (
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <path
          d={`M0 ${y(0)}H100M0 ${y(7)}H100`}
          stroke="var(--muted)"
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
        <path d={path} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        <path
          d={nowPath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }
  const height = { armonia: 46, melodia: 40, ritmo: 30, letra: 40 }[lane] + 12;
  return (
    <div
      className={s.cellWrap}
      style={{ height }}
      onDragOver={(e) => !ref && e.dataTransfer.types.includes('text/x-variant') && e.preventDefault()}
      onDrop={drop}
    >
      <button
        type="button"
        className={v ? s.clip : s.empty}
        data-sel={selected}
        data-ref={ref}
        data-target={target}
        style={barsBg}
        aria-label={`${name}, ${sec.label}: ${v ? (v.kind === 'ritmo' ? rhythmName(v.config) : v.name) : 'vacío'}${chk ? (chk.ok ? ', cumple la consigna' : ', no cumple la consigna') : ''}`}
        onClick={pick}
        onContextMenu={(e) => openCtx(e, `${name} · ${sec.label}`, laneItems(lane, sec, root, v, ref, model))}
      >
        {v ? inner : <span>{target ? 'soltar acá' : ''}</span>}
        {v && ref && <span className={s.refTag}>= {root.label}</span>}
        {(chk || locked) && (
          <span className={s.mark} data-bad={!!chk && !chk.ok} aria-hidden="true">
            {locked ? 'trabada ' : ''}
            {chk ? (chk.ok ? '✓' : '✗') : ''}
          </span>
        )}
      </button>
    </div>
  );
}

function Takes({ total, span }: { total: number; span: number }) {
  const { project } = useModel();
  const ui = useLienzoUi();
  const store = useLienzo();
  const { entries } = useJournal();
  const listen = (journalId?: string) => {
    const blob = entries?.find((e) => e.id === journalId)?.blob;
    if (blob) void new Audio(URL.createObjectURL(blob)).play();
  };
  return (
    <>
      <div className={s.laneLabel} data-on={!!ui.sel.take} style={{ height: 48 }}>
        Tomas
      </div>
      <div style={{ gridColumn: `2 / span ${span}`, position: 'relative', height: 48 }}>
        {project.takes.map((tk) => (
          <button
            key={tk.id}
            type="button"
            className={s.take}
            data-sel={ui.sel.take === tk.id}
            data-loop={!!tk.loop}
            aria-label={`${tk.name}, compases ${tk.start} a ${tk.start + tk.len - 1}`}
            style={{ left: `${((tk.start - 1) / total) * 100}%`, width: `${(tk.len / total) * 100}%` }}
            onClick={() => ui.set({ sel: { ...ui.sel, lane: 'tomas', take: tk.id }, detail: true })}
            onContextMenu={(e) =>
              openCtx(e, tk.name, [
                { label: 'Escuchar', fn: () => listen(tk.journalId) },
                {
                  label: 'Borrar toma',
                  danger: true,
                  fn: () => store.update((p) => ({ takes: p.takes.filter((x) => x.id !== tk.id) })),
                },
              ])
            }
          >
            <span style={{ whiteSpace: 'nowrap' }}>{tk.name}</span>
            <span className={s.wave} style={{ opacity: 0.55 - (tk.wear ?? 0) * 0.1 }} />
          </button>
        ))}
      </div>
      <div />
    </>
  );
}

export function Canvas() {
  const { project, rules } = useModel();
  const ui = useLienzoUi();
  const store = useLienzo();
  const pos = usePosition();
  const playing = usePlaying();
  const total = totalBars(project.secs);
  const seconds = barsToSeconds(total, rules.meter, project.bpm);
  const tBar = titleBar(project);
  const titleAt = tBar < 0 ? -1 : barsToSeconds(tBar, rules.meter, project.bpm);
  const shown = playing || pos > 0;
  let now: Now | null = null;
  if (shown) {
    let acc = 0;
    for (const sec of project.secs) {
      if (pos < acc + sec.bars) {
        now = { sec, bar: Math.floor(pos - acc), t: pos - acc };
        break;
      }
      acc += sec.bars;
    }
  }
  const cols = `120px ${project.secs.map((x) => `${x.bars}fr`).join(' ')} 36px`;
  const row: CSSProperties = { gridTemplateColumns: cols };
  const span = project.secs.length;
  return (
    <div className={s.body}>
      <Browser />
      <main className={s.main}>
        <div className={s.formBar}>
          <span style={{ fontWeight: 500 }}>Forma</span>
          <span style={{ flex: 1 }} />
          <span className={`${s.mono} ${s.small}`}>dura {formatTime(seconds)}</span>
          {project.title.trim() && (
            <span
              className={`${s.mono} ${titleAt < 0 ? s.small : titleAt > 60 ? s.bad : s.ok}`}
              style={{ fontSize: 12 }}
              title="Quien escucha suele decidir en el primer minuto."
            >
              {titleAt < 0 ? 'el título todavía no suena' : `el título llega a los ${formatTime(titleAt)}`}
            </span>
          )}
          <button
            type="button"
            className={s.link}
            onClick={(e) =>
              openCtx(
                e,
                'Empezar desde una forma',
                FORM_TEMPLATES.map((t) => ({
                  label: t.label,
                  hint: t.hint,
                  fn: () => store.setSecs(applyForm(project.secs, t.labels, t.energies, t.bars)),
                })),
              )
            }
          >
            empezar desde una forma ▾
          </button>
          <button
            type="button"
            className={s.link}
            onClick={() =>
              store.setSecs(applyForm(project.secs, createRng(randomSeed()).pick(FORM_TEMPLATES).labels))
            }
          >
            sortear forma
          </button>
          <button
            type="button"
            className={s.link}
            title="Estructura normal, tocada rápido: por eso queda corta."
            onClick={() => {
              const next = faster(project.secs, project.bpm);
              store.update(() => next);
            }}
          >
            más rápido y más corto
          </button>
        </div>
        <div className={s.scroller}>
          <div className={s.grid} data-grid style={{ minWidth: 156 + total * ui.zoom }}>
            <div className={s.gridRow} style={row}>
              <Scrub total={total} seconds={seconds} span={span} />
            </div>
            <div className={s.gridRow} style={row}>
              <div className={s.laneLabel} style={{ height: 60 }} />
              {project.secs.map((sec, i) => (
                <SectionHead key={sec.id} sec={sec} idx={i} total={total} />
              ))}
              <div
                style={{
                  height: 60,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 8,
                }}
              >
                <button type="button" className={s.add} aria-label="Agregar sección" onClick={addSection}>
                  +
                </button>
              </div>
            </div>
            {LANES.filter((l) => ui.lanes[l.id]).map((lane) => (
              <div key={lane.id} className={s.gridRow} style={row}>
                <div
                  className={s.laneLabel}
                  data-on={ui.sel.lane === lane.id && !ui.sel.take}
                  style={{ height: { armonia: 58, melodia: 52, ritmo: 42, letra: 52 }[lane.id] }}
                >
                  {lane.name}
                </div>
                {project.secs.map((sec) => (
                  <LaneCell key={sec.id} lane={lane.id} sec={sec} now={now} />
                ))}
                <div />
              </div>
            ))}
            {ui.lanes.tomas && (
              <div style={row} className={s.gridRow}>
                <Takes total={total} span={span} />
              </div>
            )}
            <Playhead total={total} />
          </div>
        </div>
        <DetailSlot />
      </main>
    </div>
  );
}
