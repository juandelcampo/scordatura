// La forma como tira: un bloque por parte de la canción, tan ancho como sus compases, con lo que
// es (estrofa, estribillo) y lo que suena adentro. La usan la consigna y Forma, así se ven igual.
// Mientras suena el tema, el bloque que se oye se marca solo, leyendo el reloj y sin renders.
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from 'react';
import { song } from '~/audio/song';
import type { SectionNames } from '~/data/structures';
import { contextMenu, type MenuItem } from './ContextMenu';
import { useSong } from './song';
import styles from './ui/formStrip.module.css';

interface FormStripProps {
  blocks: string[];
  names: SectionNames;
  /** Compases de cada bloque: dan el ancho. */
  bars: number[];
  size?: 'mini' | 'full';
  /** Lo que suena adentro de cada bloque, como sus acordes. */
  detail?: (index: number) => string | undefined;
  /** El bloque marcado y la sección en la que se trabaja. */
  selected?: number;
  active?: string;
  onSelect?: (index: number) => void;
  /** Con esto, los bloques se arrastran. "continuing" es el mismo arrastre, para deshacerlo entero. */
  onMove?: (from: number, to: number, continuing: boolean) => void;
  /** El clic derecho sobre un bloque, y el doble clic (oír desde ahí, en general). */
  menu?: (index: number) => MenuItem[];
  onDouble?: (index: number) => void;
}

/** Cuántos compases entran a lo ancho, con el mínimo que pide cada uno (--per-bar). */
function useRoom(host: RefObject<HTMLElement | null>): number {
  const [room, setRoom] = useState(0);
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    const measure = () => {
      const perBar = parseFloat(getComputedStyle(root).getPropertyValue('--per-bar')) || 16;
      setRoom(Math.max(1, Math.floor(root.clientWidth / perBar)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [host]);
  return room;
}

/** Marca el bloque que se oye y cuánto lleva, cuadro a cuadro. */
function usePlaying(host: RefObject<HTMLElement | null>) {
  const running = useSyncExternalStore(
    song.subscribe,
    () => song.getState().running,
    () => false,
  );
  useEffect(() => {
    const root = host.current;
    if (!running || !root) return;
    let frame = 0;
    let previous = -1;
    const clear = () =>
      root.querySelectorAll<HTMLElement>('[data-now]').forEach((item) => {
        item.removeAttribute('data-now');
        item.style.removeProperty('--done');
      });
    const draw = () => {
      const position = song.position();
      const block = position ? root.querySelector<HTMLElement>(`[data-block="${position.block}"]`) : null;
      if (position && block) {
        if (position.block !== previous) {
          clear();
          previous = position.block;
          block.setAttribute('data-now', '');
        }
        block.style.setProperty('--done', String(position.fraction));
      } else if (previous !== -1) {
        clear();
        previous = -1;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      clear();
    };
  }, [running, host]);
}

export function FormStrip({
  blocks,
  names,
  bars,
  size = 'full',
  detail,
  selected,
  active,
  onSelect,
  onMove,
  menu,
  onDouble,
}: FormStripProps) {
  const host = useRef<HTMLOListElement>(null);
  const room = useRoom(host);
  // Una columna por compás. Si la forma entra, va en un renglón que llena el ancho; si no, baja
  // de renglón sin estirar nada. Los bloques muy cortos se ven un poco más anchos, para que su
  // letra entre.
  const wanted = blocks.map((_, index) => Math.max(bars[index] ?? 4, size === 'mini' ? 4 : 3));
  const total = wanted.reduce((sum, span) => sum + span, 0);
  const columns = room > 0 && total > room ? room : total;
  const spans = wanted.map((span) => Math.min(span, columns));
  const dragging = useRef<number | null>(null);
  const dragged = useRef(false);
  usePlaying(host);

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragging.current === null || !onMove) return;
    const under = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-block]');
    const target = under ? Number(under.dataset.block) : null;
    if (target === null || target === dragging.current) return;
    onMove(dragging.current, target, dragged.current);
    dragging.current = target;
    dragged.current = true;
  };

  return (
    <ol
      ref={host}
      className={styles.strip}
      data-size={size}
      data-testid={size === 'full' ? 'timeline' : 'form-strip'}
      aria-label={`Forma ${blocks.join('')}`}
      title={onSelect && size === 'mini' ? 'Tocá un bloque para ver y cambiar solo esa sección' : undefined}
      style={{ '--columns': columns } as CSSProperties}
    >
      {blocks.map((letter, index) => {
        const name = names[letter];
        const inside = detail?.(index);
        const count = bars[index] ?? 4;
        const content = (
          <>
            <span className={styles.face} data-letter={letter}>
              <b>{letter}</b>
            </span>
            {size === 'full' && (
              <span className={styles.info}>
                {name && <span className={styles.name}>{name}</span>}
                {inside && <span className={styles.detail}>{inside}</span>}
                <span className={styles.bars}>{count} cc</span>
              </span>
            )}
            <span className={styles.progress} aria-hidden="true" />
          </>
        );
        const label = `Bloque ${index + 1}: sección ${letter}${name ? `, ${name.toLowerCase()}` : ''}, ${count} compases`;
        return (
          <li
            key={`${letter}-${index}`}
            className={styles.item}
            style={{ gridColumn: `span ${spans[index]}` }}
          >
            {onSelect ? (
              <button
                type="button"
                className={styles.block}
                data-block={index}
                data-active={letter === active}
                data-draggable={!!onMove}
                aria-pressed={index === selected}
                aria-label={label}
                onClick={() => onSelect(index)}
                onDoubleClick={onDouble ? () => onDouble(index) : undefined}
                onContextMenu={
                  menu
                    ? contextMenu(
                        () => menu(index),
                        `${letter}${name ? ` · ${name.toLowerCase()}` : ''} · bloque ${index + 1}`,
                      )
                    : undefined
                }
                onPointerDown={(event) => {
                  if (!onMove) return;
                  dragging.current = index;
                  dragged.current = false;
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={onPointerMove}
                onPointerUp={() => {
                  dragging.current = null;
                }}
                onPointerCancel={() => {
                  dragging.current = null;
                }}
              >
                {content}
              </button>
            ) : (
              <span className={styles.block} data-block={index} aria-label={label} role="img">
                {content}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** En chico, los nombres no entran en los bloques: van abajo, una vez por sección. */
export function FormLegend({ blocks, names }: { blocks: string[]; names: SectionNames }) {
  const named = [...new Set(blocks)].filter((letter) => names[letter]);
  if (named.length === 0) return null;
  return (
    <p className={styles.legend} data-testid="form-legend">
      {named.map((letter, index) => (
        <span key={letter}>
          {index > 0 && ' · '}
          <b>{letter}</b> {names[letter]!.toLowerCase()}
        </span>
      ))}
    </p>
  );
}

/** Tocar el tema desde cualquier pantalla: el mismo motor y el mismo plan que el Estudio. */
export function useSongPlayer() {
  const plan = useSong();
  const running = useSyncExternalStore(
    song.subscribe,
    () => song.getState().running,
    () => false,
  );
  return {
    plan,
    running,
    toggle: (from = 0) => (running ? song.stop() : song.play(plan, from)),
    /** Arranca en ese bloque aunque ya esté sonando. */
    playFrom: (from: number) => {
      if (song.getState().running) song.stop();
      song.play(plan, from);
    },
    /** Compases de cada bloque, tal como suenan. */
    bars: plan.blocks.map((block) => block.bars.length),
  };
}
