// Piezas chicas del lienzo: opciones subrayadas, candado, diagramas de acordes, ventanas flotantes y la
// posición de la reproducción.
import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react';
import { lienzoPlayer } from '~/audio/lienzo';
import type { ChordInfo } from '~/core/lienzo/harmony';
import { findShape } from '~/core/lienzo/voicing';
import { useLienzoUi, type CtxItem, type WinId } from '~/shared/lienzoUi';
import s from './lienzo.module.css';

export function Opt({
  on,
  onClick,
  children,
  struck,
  title,
  small,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  struck?: boolean;
  title?: string;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${s.opt} ${struck && !on ? s.struck : ''}`}
      aria-pressed={on}
      onClick={onClick}
      title={title}
      style={small ? { fontSize: 12 } : undefined}
    >
      {children}
    </button>
  );
}

export function LinkBtn({
  onClick,
  children,
  title,
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={s.link} onClick={onClick} title={title} disabled={disabled}>
      {children}
    </button>
  );
}

export function Lock({ locked, onClick, what }: { locked: boolean; onClick: () => void; what: string }) {
  return (
    <button
      type="button"
      className={s.lock}
      aria-pressed={locked}
      aria-label={`${locked ? 'Destrabar' : 'Trabar'} ${what}`}
      onClick={onClick}
    >
      <svg width="9" height="10" viewBox="0 0 10 11" aria-hidden="true">
        <rect
          x="1"
          y="5"
          width="8"
          height="5.5"
          fill={locked ? 'currentColor' : 'none'}
          stroke="currentColor"
        />
        <path
          d={locked ? 'M3 5V3.2a2 2 0 0 1 4 0V5' : 'M3 5V3.2a2 2 0 0 1 4 0V3'}
          fill="none"
          stroke="currentColor"
        />
      </svg>
      <span>{locked ? 'trabada' : 'trabar'}</span>
    </button>
  );
}

/** Pasos de un compás como barritas: alto = acento. */
export function Steps({
  levels,
  height,
  faded,
  accent,
}: {
  levels: number[];
  height: number;
  faded?: boolean;
  accent?: boolean;
}) {
  return (
    <span className={s.steps} style={{ height, width: '100%' }} aria-hidden="true">
      {levels.map((lvl, i) => (
        <span
          key={i}
          className={s.step}
          style={{
            height: [2, height * 0.45, height * 0.7, height][lvl] ?? 2,
            opacity: faded ? 0.5 : lvl ? 1 : 0.35,
            background: accent ? 'var(--accent)' : undefined,
          }}
        />
      ))}
    </span>
  );
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const XS = [10, 21, 32, 43, 54, 65];

/** Diagrama de guitarra para la afinación actual, o teclado de una octava. Colores fijos: no se invierten. */
export function ChordDiagram({
  chord,
  tuning,
  guitar,
  size = 0.62,
}: {
  chord: Pick<ChordInfo, 'name' | 'root' | 'pcs'>;
  tuning: (number | null)[];
  guitar: boolean;
  size?: number;
}) {
  if (!guitar) {
    const white = [0, 2, 4, 5, 7, 9, 11];
    const black: Array<[number, number]> = [
      [1, 10],
      [3, 24],
      [6, 52],
      [8, 66],
      [10, 80],
    ];
    return (
      <svg
        width={Math.round(130 * size)}
        height={Math.round(70 * size)}
        viewBox="0 0 100 54"
        role="img"
        aria-label={`${chord.name} en piano`}
      >
        {white.map((pc, i) => (
          <rect
            key={pc}
            x={1 + i * 14}
            y={1}
            width={14}
            height={52}
            fill={chord.pcs.includes(pc) ? '#C2551F' : '#F5F3EE'}
            stroke="#141413"
          />
        ))}
        {black.map(([pc, x]) => (
          <rect
            key={pc}
            x={x}
            y={1}
            width={9}
            height={32}
            fill={chord.pcs.includes(pc) ? '#C2551F' : '#141413'}
            stroke="#141413"
          />
        ))}
      </svg>
    );
  }
  const shape = findShape(tuning, chord) ?? tuning.map(() => -1);
  const strings = shape.length;
  const xs =
    strings === 6 ? XS : Array.from({ length: strings }, (_, i) => 10 + (i * 55) / Math.max(1, strings - 1));
  const fretted = shape.filter((f) => f > 0);
  const lo = fretted.length && Math.max(...fretted) > 5 ? Math.min(...fretted) : 1;
  return (
    <svg
      width={Math.round(86 * size)}
      height={Math.round(104 * size)}
      viewBox="0 0 86 104"
      role="img"
      aria-label={`${chord.name}, trastes ${shape.map((f) => (f < 0 ? 'x' : f)).join(' ')}`}
      style={{ color: 'currentColor' }}
    >
      {lo === 1 && <path d="M10 18H65" stroke="currentColor" strokeWidth="4" />}
      <path
        d={
          (lo === 1 ? '' : 'M10 18H65') +
          [33, 48, 63, 78, 93].map((y) => `M10 ${y}H65`).join('') +
          xs.map((x) => `M${x} 18V93`).join('')
        }
        fill="none"
        stroke="currentColor"
      />
      {shape.map((f, i) => {
        const x = xs[i]!;
        if (f > 0) return <path key={i} d={circle(x, 18 + (f - lo + 0.5) * 15, 5)} fill="currentColor" />;
        if (f === 0)
          return <path key={i} d={circle(x, 9, 3.5)} fill="none" stroke="currentColor" strokeWidth="1.4" />;
        return (
          <path
            key={i}
            d={`M${x - 3.5} 5.5L${x + 3.5} 12.5M${x + 3.5} 5.5L${x - 3.5} 12.5`}
            stroke="currentColor"
            strokeWidth="1.4"
          />
        );
      })}
      {lo !== 1 && (
        <text x="70" y="30" fontSize="11" fill="currentColor">
          {lo}ª
        </text>
      )}
    </svg>
  );
}

/** ¿Está sonando? */
export function usePlaying(): boolean {
  return useSyncExternalStore(lienzoPlayer.subscribe, lienzoPlayer.isPlaying, () => false);
}

/**
 * La posición en compases, refrescada unas 12 veces por segundo mientras suena. Solo la usan los
 * componentes que resaltan lo que suena.
 */
export function usePosition(fps = 12): number {
  const playing = usePlaying();
  const [pos, setPos] = useState(() => lienzoPlayer.position());
  useEffect(() => {
    const update = () => setPos(lienzoPlayer.position());
    const off = lienzoPlayer.subscribe(update);
    if (!playing) return off;
    let frame = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 1000 / fps) {
        last = t;
        update();
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      off();
    };
  }, [playing, fps]);
  return pos;
}

/** Abre el menú contextual en la posición del click. */
export function openCtx(event: MouseEvent, title: string, items: CtxItem[]) {
  event.preventDefault();
  event.stopPropagation();
  const root = (event.currentTarget as HTMLElement).closest('[data-lienzo]') as HTMLElement | null;
  const r = root?.getBoundingClientRect() ?? { left: 0, top: 0, width: 1200, height: 800 };
  const x = Math.min(event.clientX - r.left, r.width - 280);
  const y = Math.min(event.clientY - r.top, r.height - 300);
  useLienzoUi.getState().set({ ctx: { x: Math.max(4, x), y: Math.max(4, y), title, items }, menu: false });
}

const WIDTHS: Record<WinId, number> = {
  tono: 480,
  letra: 420,
  acordes: 460,
  ritmo: 450,
  reglas: 400,
  circulo: 400,
};

/** Una ventana flotante: se arrastra por la barra, se cierra con ✕ y pasa al frente al tocarla. */
export function Win({ id, title, children }: { id: WinId; title: string; children: ReactNode }) {
  const win = useLienzoUi((st) => st.wins[id]);
  const set = useLienzoUi((st) => st.set);
  const close = useLienzoUi((st) => st.closeWin);
  const front = useLienzoUi((st) => st.front);
  const ref = useRef<HTMLDivElement>(null);
  if (!win.open) return null;
  const drag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const { x: ox, y: oy } = win;
    const move = (ev: PointerEvent) => {
      const wins = useLienzoUi.getState().wins;
      set({
        wins: {
          ...wins,
          [id]: { ...wins[id], x: Math.max(0, ox + ev.clientX - sx), y: Math.max(0, oy + ev.clientY - sy) },
        },
      });
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      className={s.win}
      data-ctx="1"
      onPointerDown={() => front(id)}
      onKeyDown={(e) => e.key === 'Escape' && close(id)}
      style={{ left: win.x, top: win.y, width: WIDTHS[id], zIndex: 10 + win.z }}
    >
      <div className={s.winBar} onPointerDown={drag}>
        <span>{title}</span>
        <button
          type="button"
          className={s.close}
          aria-label={`Cerrar ${title.split(' ·')[0]!.toLowerCase()}`}
          onClick={() => close(id)}
        >
          ×
        </button>
      </div>
      <div className={s.winBody}>{children}</div>
    </div>
  );
}

export const fmtLen = (len: number) =>
  len === 0.5 ? '½' : len === 0.25 ? '¼' : len === 1.5 ? '1½' : String(len);
