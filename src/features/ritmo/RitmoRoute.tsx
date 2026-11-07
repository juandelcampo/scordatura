import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams, type MetaFunction } from 'react-router';
import { CLICK_SOUNDS, type ClickSound } from '~/audio/drums';
import { metronome } from '~/audio/metronome';
import { DRUM_PRESETS } from '~/data/drums';
import { createRng, randomSeed } from '~/core/rng';
import { rollRhythm } from '~/core/rollers';
import {
  DEFAULT_POLY_VOICES,
  describeRhythm,
  DRUMS,
  parseMeter,
  rhythmFromParams,
  rhythmToParams,
  type DrumId,
  type Meter,
  type RhythmConfig,
} from '~/core/rhythm';
import { publishToConsigna } from '~/shared/consigna';
import { Fader } from '~/shared/Fader';
import { useProject } from '~/shared/project';
import { RhythmGrid } from '~/shared/RhythmGrid';
import { SectionPicker } from '~/shared/SectionPicker';
import { useSettings } from '~/shared/settings';
import { Button, PageTitle, Segmented, Slab, SlabHead, Stepper, Tabs } from '~/shared/ui/ui';
import { DrumMachine } from './DrumMachine';
import styles from './ritmo.module.css';

export const meta: MetaFunction = () => [
  { title: 'Metrónomo raro: compases irregulares y ritmos euclidianos · Scordatura' },
  {
    name: 'description',
    content:
      'Metrónomo online para 7/8, 5/4 y otros compases irregulares, ritmos euclidianos, polirritmias y compases que mutan.',
  },
];

type Mode = RhythmConfig['mode'];

const PRESETS: ReadonlyArray<{ label: string; meter: Meter }> = [
  { label: '4/4', meter: { groups: [1, 1, 1, 1], denom: 4 } },
  { label: '3/4', meter: { groups: [1, 1, 1], denom: 4 } },
  { label: '5/4', meter: { groups: [3, 2], denom: 4 } },
  { label: '6/8', meter: { groups: [3, 3], denom: 8 } },
  { label: '5/8', meter: { groups: [3, 2], denom: 8 } },
  { label: '7/8 2+2+3', meter: { groups: [2, 2, 3], denom: 8 } },
  { label: '7/8 3+2+2', meter: { groups: [3, 2, 2], denom: 8 } },
  { label: '9/8 2+2+2+3', meter: { groups: [2, 2, 2, 3], denom: 8 } },
  { label: '11/8 3+3+3+2', meter: { groups: [3, 3, 3, 2], denom: 8 } },
];

const DEFAULTS: { [K in Mode]: (bpm: number) => Extract<RhythmConfig, { mode: K }> } = {
  meter: (bpm) => ({ mode: 'meter', groups: [2, 2, 3], denom: 8, bpm }),
  euclid: (bpm) => ({ mode: 'euclid', pulses: 3, steps: 8, rotation: 0, bpm }),
  poly: (bpm) => ({ mode: 'poly', a: 3, b: 2, bpm }),
  mutante: (bpm) => ({
    mode: 'mutante',
    meters: [
      { groups: [1, 1, 1, 1], denom: 4 },
      { groups: [2, 2, 3], denom: 8 },
    ],
    barsEach: 2,
    bpm,
  }),
  drum: (bpm) => ({ ...(DRUM_PRESETS[0]!.config as Extract<RhythmConfig, { mode: 'drum' }>), bpm }),
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function MeterEditor({ meter, onChange }: { meter: Meter; onChange: (meter: Meter) => void }) {
  const key = meter.groups.join('+');
  const [text, setText] = useState(key);
  const [syncedKey, setSyncedKey] = useState(key);
  if (key !== syncedKey) {
    setSyncedKey(key);
    setText(key);
  }
  const parsed = parseMeter(text, meter.denom);
  return (
    <div className={styles.editor}>
      <div className={styles.presets}>
        {PRESETS.map((preset) => {
          const active =
            preset.meter.denom === meter.denom && preset.meter.groups.join() === meter.groups.join();
          return (
            <Button
              key={preset.label}
              variant="mini"
              ariaPressed={active}
              onClick={() => onChange(preset.meter)}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Agrupación</span>
          <input
            value={text}
            inputMode="text"
            aria-invalid={!parsed}
            onChange={(event) => {
              setText(event.target.value);
              const next = parseMeter(event.target.value, meter.denom);
              if (next) onChange(next);
            }}
          />
        </label>
        <div className={styles.field}>
          <span>Unidad</span>
          <Segmented
            label="Unidad del compás"
            value={String(meter.denom) as '4' | '8' | '16'}
            options={[
              { value: '4', label: '/4' },
              { value: '8', label: '/8' },
              { value: '16', label: '/16' },
            ]}
            onChange={(value) => onChange({ ...meter, denom: Number(value) as Meter['denom'] })}
          />
        </div>
      </div>
      {!parsed && <p className={styles.error}>Escribí grupos como 2+2+3, de 1 a 9 cada uno.</p>}
    </div>
  );
}

function Editor({ config, onChange }: { config: RhythmConfig; onChange: (config: RhythmConfig) => void }) {
  switch (config.mode) {
    case 'drum':
      return null;
    case 'meter':
      return <MeterEditor meter={config} onChange={(meter) => onChange({ ...config, ...meter })} />;
    case 'euclid': {
      const { pulses, steps, rotation } = config;
      return (
        <div className={styles.fields}>
          <div className={styles.field}>
            <span>Golpes</span>
            <Stepper
              label="golpes"
              value={pulses}
              onDown={() => onChange({ ...config, pulses: clamp(pulses - 1, 1, steps) })}
              onUp={() => onChange({ ...config, pulses: clamp(pulses + 1, 1, steps) })}
            />
          </div>
          <div className={styles.field}>
            <span>Pulsos</span>
            <Stepper
              label="pulsos"
              value={steps}
              onDown={() => {
                const next = clamp(steps - 1, 2, 32);
                onChange({
                  ...config,
                  steps: next,
                  pulses: Math.min(pulses, next),
                  rotation: Math.min(rotation, next - 1),
                });
              }}
              onUp={() => onChange({ ...config, steps: clamp(steps + 1, 2, 32) })}
            />
          </div>
          <div className={styles.field}>
            <span>Rotación</span>
            <Stepper
              label="rotación"
              value={rotation}
              onDown={() => onChange({ ...config, rotation: (rotation - 1 + steps) % steps })}
              onUp={() => onChange({ ...config, rotation: (rotation + 1) % steps })}
            />
          </div>
        </div>
      );
    }
    case 'poly': {
      const voices = config.voices ?? DEFAULT_POLY_VOICES;
      const lines = [
        { key: 'a', count: config.a },
        { key: 'b', count: config.b },
      ] as const;
      return (
        <div className={styles.editor}>
          {lines.map(({ key, count }, line) => (
            <div key={key} className={styles.fields}>
              <div className={styles.field}>
                <span>Línea {line + 1}</span>
                <Stepper
                  label={`golpes de la línea ${line + 1}`}
                  value={count}
                  onDown={() => onChange({ ...config, [key]: clamp(count - 1, 1, 16) })}
                  onUp={() => onChange({ ...config, [key]: clamp(count + 1, 1, 16) })}
                />
              </div>
              <label className={styles.field}>
                <span>Instrumento</span>
                <select
                  value={voices[line]}
                  data-testid={`poly-voice-${line}`}
                  onChange={(event) => {
                    const voice = event.target.value as DrumId;
                    onChange({
                      ...config,
                      voices: line === 0 ? [voice, voices[1]] : [voices[0], voice],
                    });
                  }}
                >
                  {DRUMS.map((drum) => (
                    <option key={drum.id} value={drum.id}>
                      {drum.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>
      );
    }
    case 'mutante': {
      const { meters, barsEach } = config;
      return (
        <div className={styles.editor}>
          <p className={styles.fieldNote}>
            Tocá los compases que entran en la rotación. Suenan en el orden en que los elegís.
          </p>
          <div className={styles.presets}>
            {PRESETS.map((preset) => {
              const key = (meter: Meter) => `${meter.groups.join()}/${meter.denom}`;
              const active = meters.some((meter) => key(meter) === key(preset.meter));
              return (
                <Button
                  key={preset.label}
                  variant="mini"
                  ariaPressed={active}
                  onClick={() => {
                    const next = active
                      ? meters.filter((meter) => key(meter) !== key(preset.meter))
                      : [...meters, preset.meter];
                    if (next.length > 0) onChange({ ...config, meters: next });
                  }}
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>
          <div className={styles.field}>
            <span>Cambia cada</span>
            <Stepper
              label="compases entre cambios"
              value={`${barsEach} ${barsEach === 1 ? 'compás' : 'compases'}`}
              onDown={() => onChange({ ...config, barsEach: clamp(barsEach - 1, 1, 16) })}
              onUp={() => onChange({ ...config, barsEach: clamp(barsEach + 1, 1, 16) })}
            />
          </div>
        </div>
      );
    }
  }
}

export default function RitmoRoute() {
  const { running, config } = useSyncExternalStore(
    metronome.subscribe,
    metronome.getState,
    metronome.getState,
  );
  const risk = useSettings((s) => s.risk);
  const [params, setParams] = useSearchParams();
  const loaded = useRef(false);

  // Un link compartido o la consigna pueden traer un ritmo en la URL.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const shared = rhythmFromParams(params);
    if (shared) metronome.setConfig(shared);
  }, [params]);

  // La URL refleja el ritmo. Se lee el estado actual del metrónomo, no el de este render:
  // el efecto anterior puede acabar de cargar el ritmo que venía en el link.
  useEffect(() => {
    const encoded = rhythmToParams(metronome.getState().config);
    if (params.toString() !== encoded.toString()) {
      setParams(encoded, { replace: true, preventScrollReset: true });
    }
  }, [config, params, setParams]);

  const active = useProject((s) => s.active);
  const updateSection = useProject((s) => s.updateSection);
  const { name, rule } = describeRhythm(config);
  const clickSound = useSettings((s) => s.clickSound);
  const set = useSettings((s) => s.set);
  const [undo, setUndo] = useState<RhythmConfig[]>([]);

  /** Lo que se cambia a mano acá también pasa a la consigna. */
  const apply = (next: RhythmConfig) => {
    metronome.setConfig(next);
    publishToConsigna('ritmo', metronome.getState().config);
  };
  const applyRolled = (next: RhythmConfig) => {
    setUndo((stack) => [...stack, config].slice(-30));
    apply(next);
  };
  const roll = () => applyRolled(rollRhythm({ risk, rng: createRng(randomSeed()) }).value);
  const goBack = () => {
    const previous = undo[undo.length - 1];
    if (!previous) return;
    setUndo(undo.slice(0, -1));
    apply(previous);
  };

  return (
    <div>
      <Slab>
        <PageTitle eyebrow="Metrónomo raro" title={name}>
          <p>
            <strong>Regla →</strong> {rule}
          </p>
        </PageTitle>
      </Slab>

      <Slab>
        {config.mode !== 'drum' && <RhythmGrid config={config} />}
        <div className={styles.transport}>
          <Button
            variant="primary"
            onClick={() => (running ? metronome.stop() : metronome.start())}
            id="metro-toggle"
          >
            {running ? '■ Parar' : '▶ Tocar'}
          </Button>
          <label className={styles.tempo}>
            <span>
              Tempo: <output data-testid="bpm">{config.bpm} ppm</output>
            </span>
            <input
              type="range"
              min={20}
              max={300}
              value={config.bpm}
              onChange={(event) => apply({ ...config, bpm: Number(event.target.value) })}
            />
          </label>
          {/* La batería y la polirritmia eligen el instrumento en cada línea. */}
          {config.mode !== 'drum' && config.mode !== 'poly' && (
            <label className={styles.field}>
              <span>Sonido</span>
              <select
                value={clickSound}
                data-testid="click-sound"
                onChange={(event) => set({ clickSound: event.target.value as ClickSound })}
              >
                {CLICK_SOUNDS.map((sound) => (
                  <option key={sound.id} value={sound.id}>
                    {sound.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Fader channel="ritmo" />
        </div>
      </Slab>

      <Slab>
        <SlabHead title="Armar">
          <div className={styles.fields}>
            <Button onClick={goBack} id="undo-rhythm" disabled={undo.length === 0}>
              ↩ Volver
            </Button>
            <Button onClick={roll} id="roll-rhythm">
              Sortear ritmo
            </Button>
          </div>
        </SlabHead>
        <Tabs<Mode>
          label="Tipo de ritmo"
          value={config.mode}
          options={[
            { value: 'meter', label: 'Compás' },
            { value: 'euclid', label: 'Euclid.' },
            { value: 'poly', label: 'Poli' },
            { value: 'mutante', label: 'Mutante' },
            { value: 'drum', label: 'Batería' },
          ]}
          onChange={(mode) => {
            if (mode === config.mode) return;
            apply({ ...(metronome.lastOfMode(mode) ?? DEFAULTS[mode](config.bpm)), bpm: config.bpm });
          }}
        />
        <div className={styles.editorWrap}>
          {config.mode === 'drum' ? (
            <DrumMachine config={config} onChange={apply} onRoll={applyRolled} />
          ) : (
            <Editor config={config} onChange={apply} />
          )}
        </div>
      </Slab>

      <Slab>
        <SlabHead title="Usar en la canción">
          <div className={styles.fields}>
            <SectionPicker />
            <Button id="save-rhythm" onClick={() => updateSection(active, { rhythm: config })}>
              Guardar en {active}
            </Button>
          </div>
        </SlabHead>
      </Slab>
    </div>
  );
}
