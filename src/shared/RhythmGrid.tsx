// Las casillas de un ritmo. La activa se marca leyendo el reloj cuadro a cuadro, sin renders.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { metronome } from '~/audio/metronome';
import { canonical } from '~/core/canonical';
import { cycleFor, type Cycle, type RhythmConfig } from '~/core/rhythm';
import styles from './ui/rhythmGrid.module.css';

export function RhythmGrid({ config, compact }: { config: RhythmConfig; compact?: boolean }) {
  const [shown, setShown] = useState<Cycle | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const cycle = shown ?? cycleFor(config, 0);
  // En chico, una batería muestra solo lo que suena: seis filas vacías no dicen nada.
  const sounding = (lane: number) => !compact || cycle.hits.some((hit) => hit.lane === lane);
  const showAll = cycle.hits.length === 0;

  useEffect(() => {
    let frame = 0;
    let previous = '';
    let drawn: Cycle | null = null;
    const draw = () => {
      const playhead = metronome.playhead();
      // Solo se marca si lo que suena es este ritmo: la consigna puede mostrar otro.
      const mine = canonical(metronome.getState().config) === canonical(config);
      const current = mine ? playhead : null;
      // Un compás mutante cambia de forma mientras suena: solo ahí hace falta redibujar.
      if (current?.cycle && current.cycle !== drawn) {
        drawn = current.cycle;
        setShown(current.cycle);
      }
      const key = current?.cells.join() ?? '';
      if (key !== previous && container.current) {
        previous = key;
        container.current
          .querySelectorAll('[data-active]')
          .forEach((cell) => cell.removeAttribute('data-active'));
        current?.cells.forEach((cell, lane) => {
          if (cell !== null) {
            container.current
              ?.querySelector(`[data-cell="${lane}:${cell}"]`)
              ?.setAttribute('data-active', '');
          }
        });
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [config]);

  useEffect(() => {
    setShown(null); // eslint-disable-line react-hooks/set-state-in-effect -- otro ritmo vuelve al primer ciclo
  }, [config]);

  return (
    <div
      ref={container}
      className={styles.grid}
      data-compact={compact}
      aria-hidden="true"
      data-testid="rhythm-grid"
    >
      {cycle.lanes.map((count, lane) =>
        !showAll && !sounding(lane) ? null : (
          <div key={lane} className={styles.lane} style={{ '--cells': count } as CSSProperties}>
            {Array.from({ length: count }, (_, cell) => {
              const hit = cycle.hits.find((item) => item.lane === lane && item.cell === cell);
              return (
                <span
                  key={cell}
                  className={styles.cell}
                  data-cell={`${lane}:${cell}`}
                  data-level={hit ? hit.level : 'rest'}
                />
              );
            })}
          </div>
        ),
      )}
    </div>
  );
}
