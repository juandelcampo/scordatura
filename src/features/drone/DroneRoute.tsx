import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams, type MetaFunction } from 'react-router';
import { drone } from '~/audio/drone';
import {
  describeDrone,
  droneFromParams,
  droneToParams,
  droneVoices,
  ROOT_RANGE,
  STACKS,
  TIMBRES,
  type DroneConfig,
  type StackId,
  type TimbreId,
} from '~/core/drone';
import { midiToNote, noteLabel } from '~/core/notes';
import { createRng, randomSeed } from '~/core/rng';
import { rollDrone } from '~/core/rollers';
import { publishToConsigna } from '~/shared/consigna';
import { Fader } from '~/shared/Fader';
import { useSettings } from '~/shared/settings';
import { Button, PageTitle, Segmented, Slab, SlabHead, Stepper } from '~/shared/ui/ui';
import styles from './drone.module.css';

export const meta: MetaFunction = () => [
  { title: 'Drone online: un sinte que sostiene una nota para tocar encima · Scordatura' },
  {
    name: 'description',
    content:
      'Un sintetizador de drones para practicar y componer: elegí la nota, el acorde y el timbre, y tocá encima. También sostiene las cuerdas de cualquier afinación.',
  },
];

/** Dibuja la onda en un canvas leyendo el audio cuadro a cuadro, sin renders. */
function Scope() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let frame = 0;
    const data = new Float32Array(1024);
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const surface = canvas.current;
      const context = surface?.getContext('2d');
      if (!surface || !context) return;
      const ratio = window.devicePixelRatio || 1;
      const width = Math.round(surface.clientWidth * ratio);
      const height = Math.round(surface.clientHeight * ratio);
      if (surface.width !== width || surface.height !== height) {
        surface.width = width;
        surface.height = height;
      }
      context.clearRect(0, 0, width, height);
      const active = drone.waveform(data);
      let energy = 0;
      context.lineWidth = 2 * ratio;
      context.strokeStyle = getComputedStyle(surface).color;
      context.beginPath();
      for (let i = 0; i < data.length; i++) {
        const sample = active ? data[i]! : 0;
        energy += sample * sample;
        const x = (i / (data.length - 1)) * width;
        const y = height / 2 - sample * height * 0.9;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
      surface.dataset.level = Math.sqrt(energy / data.length).toFixed(4);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvas} className={styles.scope} aria-hidden="true" data-testid="scope" />;
}

export default function DroneRoute() {
  const { running, config } = useSyncExternalStore(drone.subscribe, drone.getState, drone.getState);
  const risk = useSettings((s) => s.risk);
  const notation = useSettings((s) => s.notation);
  const [params, setParams] = useSearchParams();
  const loaded = useRef(false);

  // Un link o la consigna pueden traer un drone en la URL.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const shared = droneFromParams(params);
    if (shared) drone.setConfig(shared);
  }, [params]);

  useEffect(() => {
    const encoded = droneToParams(drone.getState().config);
    if (params.toString() !== encoded.toString()) {
      setParams(encoded, { replace: true, preventScrollReset: true });
    }
  }, [config, params, setParams]);

  const [undo, setUndo] = useState<DroneConfig[]>([]);

  /** Lo que se cambia a mano acá también pasa a la consigna. */
  const apply = (next: DroneConfig) => {
    drone.setConfig(next);
    publishToConsigna('drone', next);
  };
  const goBack = () => {
    const previous = undo[undo.length - 1];
    if (!previous) return;
    setUndo(undo.slice(0, -1));
    apply(previous);
  };

  const { name, rule } = describeDrone(config);
  const voices = droneVoices(config).map((midi) => noteLabel(midiToNote(midi), notation));
  const fromTuning = !!config.notes;

  return (
    <div>
      <Slab>
        <PageTitle eyebrow="Drone" title={name}>
          <p>
            <strong>Regla →</strong> <span data-testid="drone-rule">{rule}</span>
          </p>
        </PageTitle>
      </Slab>

      <Slab>
        <Scope />
        <p className={styles.voices} data-testid="drone-voices">
          {voices.join(' · ')}
        </p>
        <div className={styles.actions}>
          <Button
            variant="primary"
            id="drone-toggle"
            onClick={() => (running ? drone.stop() : drone.start())}
          >
            {running ? '■ Parar' : '▶ Sostener'}
          </Button>
          <Button
            id="roll-drone"
            onClick={() => {
              setUndo((stack) => [...stack, config].slice(-30));
              apply(rollDrone({ risk, rng: createRng(randomSeed()) }).value);
            }}
          >
            Sortear drone
          </Button>
          <Button id="undo-drone" onClick={goBack} disabled={undo.length === 0}>
            ↩ Volver
          </Button>
          <Fader channel="drone" />
        </div>
        <p className={styles.hint}>Sigue sonando aunque cambies de herramienta, para que toques encima.</p>
      </Slab>

      <Slab>
        <SlabHead title="Armar" />
        {fromTuning && (
          <p className={styles.tuningNote}>
            Están sonando las cuerdas de una afinación.{' '}
            <Button
              variant="mini"
              id="drone-unlink"
              onClick={() => {
                const { notes: _notes, ...rest } = config;
                apply(rest);
              }}
            >
              Volver a la nota raíz
            </Button>
          </p>
        )}
        <div className={styles.fields}>
          {!fromTuning && (
            <>
              <div className={styles.field}>
                <span>Nota raíz</span>
                <Stepper
                  label="nota raíz"
                  value={<span data-testid="drone-root">{midiToNote(config.root)}</span>}
                  onDown={() => apply({ ...config, root: Math.max(ROOT_RANGE[0], config.root - 1) })}
                  onUp={() => apply({ ...config, root: Math.min(ROOT_RANGE[1], config.root + 1) })}
                />
              </div>
              <label className={styles.field}>
                <span>Qué se apila</span>
                <select
                  value={config.stack}
                  data-testid="drone-stack"
                  onChange={(event) => apply({ ...config, stack: event.target.value as StackId })}
                >
                  {(Object.keys(STACKS) as StackId[]).map((id) => (
                    <option key={id} value={id}>
                      {STACKS[id].name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <div className={styles.field}>
            <span>Timbre</span>
            <Segmented<TimbreId>
              label="Timbre"
              value={config.timbre}
              options={(Object.keys(TIMBRES) as TimbreId[]).map((id) => ({
                value: id,
                label: TIMBRES[id].name,
              }))}
              onChange={(timbre) => apply({ ...config, timbre })}
            />
          </div>
        </div>
        <div className={styles.fields}>
          <label className={styles.field}>
            <span>Brillo</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={config.brightness}
              onChange={(event) => apply({ ...config, brightness: Number(event.target.value) })}
            />
          </label>
          <label className={styles.field}>
            <span>Movimiento</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={config.motion}
              onChange={(event) => apply({ ...config, motion: Number(event.target.value) })}
            />
          </label>
          <label className={styles.field}>
            <span>Batido: {Math.round(config.detune)} cents</span>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={config.detune}
              onChange={(event) => apply({ ...config, detune: Number(event.target.value) })}
            />
          </label>
        </div>
      </Slab>
    </div>
  );
}
