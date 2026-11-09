// Los editores de la sección elegida. Lo que se cambia acá se oye enseguida y queda en el proyecto.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { strum } from '~/audio/instrument';
import { song } from '~/audio/song';
import { closeVoicing, degreeOf, harmonyHref, parseChord, voicingFor } from '~/core/chords';
import {
  describeDrone,
  ROOT_RANGE,
  STACKS,
  TIMBRES,
  type DroneConfig,
  type StackId,
  type TimbreId,
} from '~/core/drone';
import { midiToNote } from '~/core/notes';
import { DRUMS, DRUM_STEPS, randomDrumPattern, rhythmToDrums, type DrumConfig } from '~/core/rhythm';
import { createRng, randomSeed } from '~/core/rng';
import { rollHarmony, rollLyric, rollRhythm } from '~/core/rollers';
import { DEFAULT_BARS, MAX_BARS } from '~/core/song';
import { metricCount, wordsIn } from '~/core/spanish';
import { DRUM_PRESETS } from '~/data/drums';
import { editBlocks, publishToConsigna, useBlocks } from '~/shared/consigna';
import { PianoRoll } from '~/shared/PianoRoll';
import { useProject } from '~/shared/project';
import { RecordButton } from '~/shared/RecordButton';
import { useSettings } from '~/shared/settings';
import type { ConsignaParts } from '~/shared/song';
import { useSectionHarmony, useSong } from '~/shared/song';
import { Button } from '~/shared/ui/ui';
import styles from './estudio.module.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const MAX_BLOCKS = 24;

function Panel({
  id,
  title,
  open,
  origin,
  actions,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  /** De dónde sale lo que se ve, si no es de la sección. */
  origin?: string | false;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel} data-panel={id} data-open={open} aria-label={title}>
      <header className={styles.panelHead}>
        <h2>
          {title}
          {origin && <small className={styles.origin}>{origin}</small>}
        </h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

const roller = () => ({ risk: useSettings.getState().risk, rng: createRng(randomSeed()) });

export function FormPanel({
  selected,
  onSelect,
  open,
}: {
  selected: number;
  onSelect: (block: number) => void;
  open: boolean;
}) {
  const blocks = useBlocks();
  const updateSection = useProject((s) => s.updateSection);
  const letter = blocks[selected] ?? 'A';
  const bars = useProject((s) => s.sections[letter]?.bars) ?? DEFAULT_BARS;
  const repeats = blocks.filter((block) => block === letter).length;

  const change = (next: string[], position: number) => {
    editBlocks(next);
    onSelect(position);
  };
  const move = (to: number) => {
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(selected, 1);
    next.splice(to, 0, item!);
    change(next, to);
  };

  return (
    <section className={styles.formBar} data-panel="forma" data-open={open} aria-label="Forma y sección">
      <strong className={styles.formTitle} data-testid="form-title">
        Sección {letter}
        <small>{repeats > 1 ? ` · ${repeats} bloques` : ''}</small>
      </strong>
      <div className={styles.tempo} role="group" aria-label="Compases de la sección">
        <button
          type="button"
          aria-label="Menos compases"
          onClick={() => updateSection(letter, { bars: Math.max(1, bars - 1) })}
        >
          −
        </button>
        <output data-testid="section-bars">{bars} cc</output>
        <button
          type="button"
          aria-label="Más compases"
          onClick={() => updateSection(letter, { bars: Math.min(MAX_BARS, bars + 1) })}
        >
          +
        </button>
      </div>
      <Button
        variant="mini"
        id="song-roll-section"
        onClick={() =>
          updateSection(letter, {
            chords: rollHarmony(roller()).value.chords,
            rhythm: rollRhythm(roller()).value,
            lyric: rollLyric(roller()).label,
          })
        }
      >
        Sortear sección
      </Button>
      <Button variant="mini" ariaLabel="Mover el bloque a la izquierda" onClick={() => move(selected - 1)}>
        ←
      </Button>
      <Button variant="mini" ariaLabel="Mover el bloque a la derecha" onClick={() => move(selected + 1)}>
        →
      </Button>
      <Button
        variant="mini"
        ariaLabel="Quitar el bloque"
        disabled={blocks.length <= 1}
        onClick={() =>
          change(
            blocks.filter((_, index) => index !== selected),
            Math.max(0, selected - 1),
          )
        }
      >
        Quitar
      </Button>
      <label className={styles.inlineField}>
        <span className="sr-only">Agregar un bloque</span>
        <select
          value=""
          data-testid="song-add-block"
          disabled={blocks.length >= MAX_BLOCKS}
          onChange={(event) => {
            if (event.target.value) change([...blocks, event.target.value], blocks.length);
          }}
        >
          <option value="">+ Bloque</option>
          {LETTERS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <RecordButton />
    </section>
  );
}

/** Marca la columna que suena, solo si lo que suena es esta sección. */
function useStepPlayhead(letter: string) {
  const plan = useSong();
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    let previous: number | null = null;
    const draw = () => {
      const position = song.position();
      const here = position && plan.blocks[position.block]?.letter === letter ? position.step : null;
      if (here !== previous && grid.current) {
        previous = here;
        grid.current.querySelectorAll('[data-now]').forEach((cell) => cell.removeAttribute('data-now'));
        if (here !== null) {
          grid.current
            .querySelectorAll(`[data-step="${here}"]`)
            .forEach((cell) => cell.setAttribute('data-now', ''));
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [letter, plan]);
  return grid;
}

export function DrumsPanel({ letter, parts, open }: { letter: string; parts: ConsignaParts; open: boolean }) {
  const own = useProject((s) => s.sections[letter]?.rhythm);
  const updateSection = useProject((s) => s.updateSection);
  const risk = useSettings((s) => s.risk);
  const grid = useStepPlayhead(letter);
  const config = rhythmToDrums(own ?? parts.rhythm);
  const save = (next: DrumConfig) => updateSection(letter, { rhythm: next });

  const presetId = DRUM_PRESETS.find(
    (preset) => JSON.stringify((preset.config as DrumConfig).tracks) === JSON.stringify(config.tracks),
  )?.id;
  // Las casillas no se achican más allá del dedo: lo que no entra pasa a otra fila.
  const wide = config.steps > 16 ? Math.ceil(config.steps / 2) : config.steps;
  const narrow = config.steps > 8 ? Math.min(8, Math.ceil(config.steps / 2)) : config.steps;

  return (
    <Panel
      id="bateria"
      title={`Batería ${letter}`}
      origin={!own && 'De la consigna'}
      open={open}
      actions={
        <div className={styles.panelActions}>
          <label className={styles.inlineField}>
            <span className="sr-only">Patrón de partida</span>
            <select
              value={presetId ?? ''}
              data-testid="song-drum-preset"
              onChange={(event) => {
                const preset = DRUM_PRESETS.find((item) => item.id === event.target.value);
                if (preset) save({ ...(preset.config as DrumConfig), levels: config.levels });
              }}
            >
              <option value="" disabled>
                Patrón
              </option>
              {DRUM_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.inlineField}>
            <span className="sr-only">Pasos</span>
            <select
              value={config.steps}
              data-testid="song-drum-steps"
              onChange={(event) => {
                const steps = Number(event.target.value);
                save({
                  ...config,
                  steps,
                  tracks: config.tracks.map((track) =>
                    Array.from({ length: steps }, (_, step) => track[step] ?? false),
                  ),
                });
              }}
            >
              {[...new Set([...DRUM_STEPS, config.steps])]
                .sort((a, b) => a - b)
                .map((steps) => (
                  <option key={steps} value={steps}>
                    {steps}
                  </option>
                ))}
            </select>
          </label>
          <Button
            variant="mini"
            id="song-roll-drums"
            onClick={() =>
              save(randomDrumPattern(createRng(randomSeed()).next, risk, config.bpm, config.steps))
            }
          >
            Sortear
          </Button>
          <Button
            variant="mini"
            ariaLabel="Borrar todos los golpes"
            onClick={() => save({ ...config, tracks: config.tracks.map((track) => track.map(() => false)) })}
          >
            Borrar
          </Button>
        </div>
      }
    >
      <div
        ref={grid}
        className={styles.drumGrid}
        style={{ '--wide': wide, '--narrow': narrow } as CSSProperties}
        data-testid="song-drums"
      >
        {DRUMS.map((drum, lane) => (
          <div key={drum.id} className={styles.drumRow} data-track={drum.id}>
            <span className={styles.drumName}>{drum.name}</span>
            <div className={styles.drumSteps}>
              {Array.from({ length: config.steps }, (_, step) => (
                <button
                  key={step}
                  type="button"
                  className={styles.step}
                  data-step={step}
                  data-beat={step % 4 === 0}
                  aria-pressed={config.tracks[lane]?.[step] ?? false}
                  aria-label={`${drum.name}, paso ${step + 1}`}
                  onClick={() =>
                    save({
                      ...config,
                      tracks: config.tracks.map((track, index) =>
                        index === lane ? track.map((on, i) => (i === step ? !on : on)) : track,
                      ),
                    })
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const splitChords = (text: string) => text.split(/[\s,–-]+/).filter(Boolean);

export function ChordsPanel({
  letter,
  parts,
  open,
}: {
  letter: string;
  parts: ConsignaParts;
  open: boolean;
}) {
  const own = useProject((s) => s.sections[letter]?.chords);
  const ownBeats = useProject((s) => s.sections[letter]?.chordBeats);
  const updateSection = useProject((s) => s.updateSection);
  const a4 = useSettings((s) => s.a4);
  // Sin acordes propios, la sección toca lo que sale de la consigna para ella.
  const derived = useSectionHarmony(letter);
  const chords = derived.chords;
  const joined = chords.join(' ');
  // El borrador se descarta cuando los acordes cambian desde otro lado (otra sección, un sorteo).
  const [draft, setDraft] = useState({ base: joined, text: joined });
  const text = draft.base === joined ? draft.text : joined;
  const typed = splitChords(text);
  const invalid = typed.filter((name) => !parseChord(name));
  // La tónica de la consigna solo vale para sus acordes; los propios se miden desde el primero.
  const center = (own ? undefined : parts.harmony.tonic) ?? parseChord(chords[0] ?? '')?.root ?? 0;

  return (
    <Panel
      id="acordes"
      title={`Acordes ${letter}`}
      origin={`${own ? 'Propios' : derived.how ? 'Variación de la consigna' : 'De la consigna'}, trastes en ${parts.tuning.label}`}
      open={open}
      actions={
        <div className={styles.panelActions}>
          <Button
            variant="mini"
            id="song-roll-chords"
            onClick={() => updateSection(letter, { chords: rollHarmony(roller()).value.chords })}
          >
            Sortear
          </Button>
          <Link
            className={styles.more}
            to={harmonyHref(
              chords,
              ownBeats ?? (own ? undefined : derived.chordBeats),
              own ? undefined : parts.harmony,
            )}
          >
            Armonía
          </Link>
        </div>
      }
    >
      <label className={styles.chordInput}>
        <span className="sr-only">Acordes de la sección {letter}, separados por espacios</span>
        <input
          value={text}
          data-testid="song-chords"
          aria-invalid={invalid.length > 0}
          spellCheck={false}
          autoCapitalize="off"
          onChange={(event) => {
            const value = event.target.value;
            setDraft({ base: joined, text: value });
            const next = splitChords(value);
            if (next.length > 0 && next.length <= 16 && next.every((name) => parseChord(name))) {
              const nextJoined = next.join(' ');
              setDraft({ base: nextJoined, text: value });
              updateSection(letter, { chords: next });
            }
          }}
        />
      </label>
      {invalid.length > 0 && <p className={styles.warn}>No reconozco: {invalid.join(', ')}</p>}
      <div className={styles.chips}>
        {chords.map((name, index) => {
          const parsed = parseChord(name);
          const voicing = voicingFor(parts.tuning.notes, name);
          return (
            <button
              key={`${name}-${index}`}
              type="button"
              aria-label={`Oír ${name}`}
              onClick={() => strum(voicing?.midis ?? (parsed ? closeVoicing(parsed) : []), a4)}
            >
              <strong>
                {name}
                <small>{degreeOf(name, center) ?? '?'}</small>
              </strong>
              <small data-testid="song-frets">
                {voicing ? voicing.frets.map((fret) => fret ?? 'x').join(' ') : '—'}
              </small>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

export function DronePanel({ letter, parts, open }: { letter: string; parts: ConsignaParts; open: boolean }) {
  const sectionChords = useSectionHarmony(letter).chords;
  const config = parts.drone;
  const change = (patch: Partial<DroneConfig>) => {
    // Elegir una raíz o una pila reemplaza a las cuerdas de una afinación, si las había.
    const { notes: _notes, ...rest } = config;
    publishToConsigna('drone', { ...rest, ...patch });
  };
  const chord = parseChord(sectionChords[0] ?? '');
  // La raíz del acorde en la octava grave del drone.
  const toChord = () => {
    if (!chord) return;
    change({ root: 36 + chord.root });
  };
  const stepRoot = (delta: number) =>
    change({ root: Math.min(ROOT_RANGE[1], Math.max(ROOT_RANGE[0], config.root + delta)) });

  return (
    <Panel
      id="drone"
      title="Drone"
      open={open}
      actions={
        <div className={styles.panelActions}>
          <span className={styles.droneName} data-testid="song-drone">
            {describeDrone(config).name}
          </span>
          <Link className={styles.more} to="/drone">
            Drone
          </Link>
        </div>
      }
    >
      <div className={styles.droneControls}>
        <div className={styles.tempo} role="group" aria-label="Raíz del drone">
          <button type="button" aria-label="Bajar la raíz del drone" onClick={() => stepRoot(-1)}>
            −
          </button>
          <output>{midiToNote(config.root)}</output>
          <button type="button" aria-label="Subir la raíz del drone" onClick={() => stepRoot(1)}>
            +
          </button>
        </div>
        <Button
          variant="mini"
          id="song-drone-chord"
          disabled={!chord}
          ariaLabel={`Llevar el drone a la raíz del acorde ${chord?.name ?? ''}`}
          onClick={toChord}
        >
          A la raíz
        </Button>
        <label className={styles.inlineField}>
          <span className="sr-only">Pila del drone</span>
          <select
            value={config.notes ? '' : config.stack}
            data-testid="song-drone-stack"
            onChange={(event) => change({ stack: event.target.value as StackId })}
          >
            {config.notes && <option value="">Cuerdas</option>}
            {(Object.keys(STACKS) as StackId[]).map((id) => (
              <option key={id} value={id}>
                {STACKS[id].name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.inlineField}>
          <span className="sr-only">Timbre del drone</span>
          <select
            value={config.timbre}
            onChange={(event) =>
              publishToConsigna('drone', { ...config, timbre: event.target.value as TimbreId })
            }
          >
            {(Object.keys(TIMBRES) as TimbreId[]).map((id) => (
              <option key={id} value={id}>
                {TIMBRES[id].name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Panel>
  );
}

export function LyricPanel({ letter, parts, open }: { letter: string; parts: ConsignaParts; open: boolean }) {
  const text = useProject((s) => s.sections[letter]?.text) ?? '';
  const rule = useProject((s) => s.sections[letter]?.lyric) ?? parts.lyric.label;
  const updateSection = useProject((s) => s.updateSection);
  const counts = text
    .split('\n')
    .filter((line) => wordsIn(line).length > 0)
    .map((line) => metricCount(line).total);
  return (
    <Panel
      id="letra"
      title={`Letra ${letter}`}
      open={open}
      actions={
        <Link className={styles.more} to="/letras">
          Letras
        </Link>
      }
    >
      <p className={`${styles.note} ${styles.clamp}`} data-testid="song-lyric-rule" title={rule}>
        {rule}
      </p>
      <label className={styles.lyric}>
        <span className="sr-only">Letra de la sección {letter}</span>
        <textarea
          value={text}
          data-testid="song-lyric"
          placeholder="Escribí acá. Queda en esta sección."
          onChange={(event) => updateSection(letter, { text: event.target.value })}
        />
      </label>
      <p
        className={`${styles.note} ${styles.clamp}`}
        data-testid="song-lyric-count"
        title={counts.length ? undefined : parts.card}
      >
        {counts.length ? `Sílabas: ${counts.join(' · ')}` : parts.card}
      </p>
    </Panel>
  );
}

export function MelodyPanel({ parts, open }: { parts: ConsignaParts; open: boolean }) {
  return (
    <Panel
      id="melodia"
      title="Melodía"
      origin={!parts.melody.chosen && 'Un ejemplo, en silencio'}
      open={open}
      actions={
        <Link className={styles.more} to="/melodia">
          Melodía
        </Link>
      }
    >
      <div className={styles.roll}>
        <PianoRoll notes={parts.melody.notes} label="La melodía del tema" compact />
      </div>
      <p className={`${styles.note} ${styles.clamp}`} title={parts.melody.label}>
        {parts.melody.label}
      </p>
    </Panel>
  );
}
