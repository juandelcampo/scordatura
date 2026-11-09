// Caja de ritmos: una fila de casillas por sonido. Se edita mientras suena.
import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react';
import { metronome } from '~/audio/metronome';
import { DRUMS, DRUM_STEPS, randomDrumPattern, type RhythmConfig } from '~/core/rhythm';
import { createRng, randomSeed } from '~/core/rng';
import { DRUM_PRESETS } from '~/data/drums';
import { contextMenu } from '~/shared/ContextMenu';
import { useSettings } from '~/shared/settings';
import { Button } from '~/shared/ui/ui';
import styles from './ritmo.module.css';

type DrumConfig = Extract<RhythmConfig, { mode: 'drum' }>;

interface DrumMachineProps {
  config: DrumConfig;
  onChange: (config: DrumConfig, continuing?: boolean) => void;
  onRoll: (config: DrumConfig) => void;
}

export function DrumMachine({ config, onChange, onRoll }: DrumMachineProps) {
  const risk = useSettings((s) => s.risk);
  const grid = useRef<HTMLDivElement>(null);

  // Marca la columna que suena leyendo el reloj cuadro a cuadro, sin renders.
  useEffect(() => {
    let frame = 0;
    let previous: number | null = null;
    const draw = () => {
      const step = metronome.playhead()?.step ?? null;
      if (step !== previous && grid.current) {
        previous = step;
        grid.current.querySelectorAll('[data-now]').forEach((cell) => cell.removeAttribute('data-now'));
        if (step !== null) {
          grid.current
            .querySelectorAll(`[data-step="${step}"]`)
            .forEach((cell) => cell.setAttribute('data-now', ''));
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Pintar: apretar una casilla la prende (o la apaga) y pasar por las de al lado de la misma fila
  // hace lo mismo. La config va en una ref, porque cada paso del gesto llega antes del render.
  const latest = useRef(config);
  useEffect(() => {
    latest.current = config;
  }, [config]);
  const setStep = (lane: number, step: number, value: boolean, continuing: boolean) => {
    const current = latest.current;
    if ((current.tracks[lane]?.[step] ?? false) === value) return;
    const next = {
      ...current,
      tracks: current.tracks.map((track, index) =>
        index === lane ? track.map((on, i) => (i === step ? value : on)) : track,
      ),
    };
    latest.current = next;
    onChange(next, continuing);
  };
  const setLane = (lane: number, make: (step: number, on: boolean) => boolean) =>
    onChange({
      ...config,
      tracks: config.tracks.map((track, index) =>
        index === lane ? track.map((on, i) => make(i, on)) : track,
      ),
    });

  const paint = (lane: number, step: number) => (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const value = !(config.tracks[lane]?.[step] ?? false);
    setStep(lane, step, value, false);
    const pointer = event.pointerId;
    const move = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointer) return;
      const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-lane]');
      if (cell && Number(cell.dataset.lane) === lane) setStep(lane, Number(cell.dataset.step), value, true);
    };
    const stop = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointer) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  };

  const laneMenu = (lane: number, name: string) =>
    contextMenu<HTMLElement>(() => {
      const steps = config.steps;
      const track = config.tracks[lane] ?? [];
      return [
        { label: 'Llenar la fila', onSelect: () => setLane(lane, () => true) },
        { label: 'En cada tiempo', onSelect: () => setLane(lane, (i) => i % 4 === 0) },
        { label: 'Uno sí, uno no', onSelect: () => setLane(lane, (i) => i % 2 === 0) },
        { label: 'Dar vuelta', onSelect: () => setLane(lane, (_, on) => !on) },
        null,
        { label: '← Correr', onSelect: () => setLane(lane, (i) => track[(i + 1) % steps] ?? false) },
        { label: 'Correr →', onSelect: () => setLane(lane, (i) => track[(i - 1 + steps) % steps] ?? false) },
        null,
        { label: 'Vaciar la fila', onSelect: () => setLane(lane, () => false) },
      ];
    }, name);

  const resize = (steps: number) => {
    onChange({
      ...config,
      steps,
      tracks: config.tracks.map((track) => Array.from({ length: steps }, (_, i) => track[i] ?? false)),
    });
  };

  const presetId = DRUM_PRESETS.find((preset) => {
    const other = preset.config as DrumConfig;
    return JSON.stringify(other.tracks) === JSON.stringify(config.tracks);
  })?.id;

  return (
    <div className={styles.drums} data-testid="drum-machine">
      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Patrón de partida</span>
          <select
            value={presetId ?? ''}
            data-testid="drum-preset"
            onChange={(event) => {
              const preset = DRUM_PRESETS.find((item) => item.id === event.target.value);
              if (preset) onChange({ ...(preset.config as DrumConfig), levels: config.levels });
            }}
          >
            <option value="" disabled>
              Propio
            </option>
            {DRUM_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Pasos</span>
          <select
            value={config.steps}
            data-testid="drum-steps"
            onChange={(event) => resize(Number(event.target.value))}
          >
            {DRUM_STEPS.map((steps) => (
              <option key={steps} value={steps}>
                {steps}
              </option>
            ))}
          </select>
        </label>
        <Button
          id="roll-drums"
          onClick={() =>
            onRoll(randomDrumPattern(createRng(randomSeed()).next, risk, config.bpm, config.steps))
          }
        >
          Sortear patrón
        </Button>
        <Button
          onClick={() =>
            onChange({ ...config, tracks: config.tracks.map((track) => track.map(() => false)) })
          }
          ariaLabel="Borrar todos los golpes"
        >
          Borrar
        </Button>
      </div>

      <div
        ref={grid}
        className={styles.tracks}
        style={{ '--columns': config.steps > 16 ? config.steps / 2 : config.steps } as CSSProperties}
      >
        {DRUMS.map((drum, lane) => (
          <div
            key={drum.id}
            className={styles.track}
            data-track={drum.id}
            onContextMenu={laneMenu(lane, drum.name)}
          >
            <div className={styles.trackHead}>
              <strong>{drum.name}</strong>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((config.levels[lane] ?? 0.8) * 100)}
                aria-label={`Volumen de ${drum.name}`}
                onChange={(event) =>
                  onChange({
                    ...config,
                    levels: config.levels.map((level, index) =>
                      index === lane ? Number(event.target.value) / 100 : level,
                    ),
                  })
                }
              />
            </div>
            <div className={styles.steps}>
              {Array.from({ length: config.steps }, (_, step) => {
                const on = config.tracks[lane]?.[step] ?? false;
                return (
                  <button
                    key={step}
                    type="button"
                    className={styles.step}
                    data-step={step}
                    data-beat={step % 4 === 0}
                    aria-pressed={on}
                    data-lane={lane}
                    aria-label={`${drum.name}, paso ${step + 1}`}
                    onPointerDown={paint(lane, step)}
                    // Con el teclado no hay puntero: el clic llega solo (detail 0).
                    onClick={(event) => {
                      if (event.detail === 0) setStep(lane, step, !on, false);
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
