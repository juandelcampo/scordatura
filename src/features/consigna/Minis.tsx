// Versiones concisas de cada herramienta, para usar la consigna sin cambiar de pantalla.
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { drone } from '~/audio/drone';
import { getAudio } from '~/audio/engine';
import { playMelody, pluckString, stopInstrument, strum } from '~/audio/instrument';
import { metronome } from '~/audio/metronome';
import { song } from '~/audio/song';
import { canonical } from '~/core/canonical';
import { closeVoicing, degreeOf, parseChord, voicingFor } from '~/core/chords';
import { MODES, spell, tonicSpelling, type ModeId } from '~/core/harmony';
import { STACKS, TIMBRES, type DroneConfig, type StackId, type TimbreId } from '~/core/drone';
import { exampleMelody, type Note } from '~/core/melody';
import { BAR, melodyExample, type MelodyKind } from '~/core/melodyRules';
import { noteLabel, noteToMidi, splitNote } from '~/core/notes';
import { clampBpm, type RhythmConfig } from '~/core/rhythm';
import { createRng } from '~/core/rng';
import { diatonicChords, MAX_CHORDS, MIN_CHORDS, spellInKey, type Key } from '~/core/variations';
import { DEFAULT_BARS, MAX_BARS } from '~/core/song';
import { metricCount, wordsIn } from '~/core/spanish';
import { editBlocks, useForm } from '~/shared/consigna';
import { contextMenu } from '~/shared/ContextMenu';
import { draggable, dropTarget, insertionIndex, reorderTo } from '~/shared/drag';
import { FormLegend, FormStrip, useSongPlayer } from '~/shared/FormStrip';
import { PianoRoll } from '~/shared/PianoRoll';
import { useProject } from '~/shared/project';
import { RhythmGrid } from '~/shared/RhythmGrid';
import { useSettings } from '~/shared/settings';
import { Button } from '~/shared/ui/ui';
import { needlePosition, tuningStatus, useTuner } from '~/shared/useTuner';
import styles from './consigna.module.css';

const SECONDS_PER_CHORD = 1.8;
const ARPEGGIO_BPM = 84;

/** Algo que suena un rato y se puede cortar: al salir de la pantalla no queda sonando. */
function usePlayback() {
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    stopInstrument();
    setPlaying(false);
  };

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        stopInstrument();
      }
    },
    [],
  );

  const play = (seconds: number, sound: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    if (song.getState().running) song.stop();
    stopInstrument();
    sound();
    setPlaying(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setPlaying(false);
    }, seconds * 1000);
  };

  return { playing, play, stop };
}

const arpeggioOf = (notes: string[]) => notes.map((note, start) => ({ midi: noteToMidi(note), start }));

/** Lo que se toca va al pie de la tarjeta, en una sola fila: así los pies vecinos quedan alineados. */
export function Foot({ children }: { children?: ReactNode }) {
  return <div className={styles.foot}>{children}</div>;
}

/**
 * Se monta recién al activarlo: hasta entonces la consigna no pide el micrófono. Las mismas
 * cuerdas pasan a escuchar, y en lugar de la regla aparece una aguja chica.
 */
function MiniTuner({ notes }: { notes: string[] }) {
  const a4 = useSettings((s) => s.a4);
  const tuner = useTuner(notes, a4, 'guided');
  const { active, toggle } = tuner;
  const notation = useSettings((s) => s.notation);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void toggle();
  }, [toggle]);

  const { reading, selected, tuned, message } = tuner;
  const status = tuningStatus(reading, active, notes.length - selected);
  const text = message ?? (active ? status.text : 'Abriendo el micrófono…');

  return (
    <>
      <div className={`${styles.strings} ${styles.stripStrings}`} data-testid="mini-tuner" data-print="hide">
        {notes.map((note, index) => (
          <button
            key={index}
            type="button"
            aria-pressed={index === selected}
            data-tuned={tuned[index]}
            aria-label={`Afinar cuerda ${notes.length - index}, ${noteLabel(note, notation)}`}
            onClick={() => tuner.selectString(index)}
          >
            {tuned[index] ? '✓' : noteLabel(note, notation)}
          </button>
        ))}
      </div>
      <div className={styles.stripMeter} data-state={status.state} data-print="hide">
        <div className={styles.needleScale} aria-hidden="true">
          <span className={styles.needleZone} />
          {reading && <span className={styles.needle} style={{ left: `${needlePosition(reading)}%` }} />}
        </div>
        <span className={styles.tunerStatus} role="status" data-testid="mini-tuner-status">
          {text}
        </span>
        {reading && Math.abs(reading.cents) < 100 && (
          <span className={styles.tunerCents}>
            {reading.cents >= 0 ? '+' : '−'}
            {Math.abs(reading.cents).toFixed(0)} c
          </span>
        )}
      </div>
    </>
  );
}

/**
 * La afinación es una franja, no una tarjeta: se mira al empezar y después queda a mano. Devuelve
 * las cuerdas y los botones sueltos, para que la franja los acomode en una línea.
 */
export function MiniTuning({
  notes,
  tuning,
  onTuning,
}: {
  notes: string[];
  tuning: boolean;
  onTuning: (tuning: boolean) => void;
}) {
  const a4 = useSettings((s) => s.a4);
  const notation = useSettings((s) => s.notation);
  const { playing, play, stop } = usePlayback();
  const midis = notes.map(noteToMidi);
  const eighth = 60 / ARPEGGIO_BPM / 2;

  return (
    <>
      {tuning ? (
        <MiniTuner key={notes.join()} notes={notes} />
      ) : (
        <div className={`${styles.strings} ${styles.stripStrings}`} data-print="hide">
          {notes.map((note, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Oír cuerda ${notes.length - index}: ${noteLabel(note, notation)}`}
              onClick={() => pluckString(index, midis[index]!, { a4 })}
              onContextMenu={contextMenu(
                () => [
                  {
                    label: `▶ Oír ${noteLabel(note, notation)}`,
                    onSelect: () => pluckString(index, midis[index]!, { a4 }),
                  },
                  {
                    label: '▶ Toda la afinación',
                    onSelect: () => play(1.5, () => strum(midis, a4)),
                  },
                  null,
                  { label: 'Afinar con el micrófono', onSelect: () => onTuning(true) },
                ],
                `Cuerda ${notes.length - index}`,
              )}
            >
              {noteLabel(note, notation)}
              <sub>{splitNote(note).octave}</sub>
            </button>
          ))}
        </div>
      )}
      <div className={styles.stripPlay} data-print="hide">
        {/* Mientras se afina, el lugar es para la aguja. */}
        {!tuning && (
          <>
            <Button
              variant="mini"
              ariaLabel="Oír la afinación arpegiada"
              onClick={() =>
                playing
                  ? stop()
                  : play(notes.length * eighth + 1, () => playMelody(arpeggioOf(notes), ARPEGGIO_BPM, a4))
              }
            >
              {playing ? '■ Parar' : '▶ Arpegio'}
            </Button>
            <Button
              variant="mini"
              ariaLabel="Oír la afinación rasgueada"
              onClick={() => play(1.5, () => strum(midis, a4))}
            >
              ▶ Rasgueo
            </Button>
          </>
        )}
        <Button
          variant="mini"
          ariaPressed={tuning}
          onClick={() => onTuning(!tuning)}
          ariaLabel={tuning ? 'Cerrar afinador' : 'Afinar con el micrófono'}
        >
          {tuning ? '■ Listo' : 'Afinar'}
        </Button>
      </div>
    </>
  );
}

const sameConfig = (a: unknown, b: unknown) => canonical(a) === canonical(b);

/** Un valor con − y + a los costados, del tamaño de los botones chicos de la tarjeta. */
function Nudge({
  label,
  value,
  onDown,
  onUp,
}: {
  label: string;
  value: ReactNode;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <div className={styles.nudge} role="group" aria-label={label}>
      <button type="button" aria-label={`Bajar ${label}`} onClick={onDown}>
        −
      </button>
      <output>{value}</output>
      <button type="button" aria-label={`Subir ${label}`} onClick={onUp}>
        +
      </button>
    </div>
  );
}

const TEMPO_STEP = 5;

/** De a cinco, y redondeando: de 52 se baja a 50, no a 47. */
const stepTempo = (bpm: number, direction: 1 | -1) => {
  const rounded = Math.round(bpm / TEMPO_STEP) * TEMPO_STEP;
  const next =
    rounded === bpm || Math.sign(rounded - bpm) !== direction ? rounded + direction * TEMPO_STEP : rounded;
  return clampBpm(next);
};

export function MiniRhythm({
  config,
  onChange,
}: {
  config: RhythmConfig;
  onChange: (next: RhythmConfig) => void;
}) {
  const state = useSyncExternalStore(metronome.subscribe, metronome.getState, metronome.getState);
  const mine = state.running && sameConfig(state.config, config);
  // Si está sonando, el cambio se oye enseguida.
  const apply = (next: RhythmConfig) => {
    if (mine) metronome.setConfig(next);
    onChange(next);
  };
  return (
    <div className={styles.mini}>
      <RhythmGrid config={config} compact />
      {config.mode === 'euclid' && (
        <div className={styles.controls} data-print="hide">
          <Nudge
            label="los golpes"
            value={`${config.pulses} golpes`}
            onDown={() => apply({ ...config, pulses: Math.max(1, config.pulses - 1) })}
            onUp={() => apply({ ...config, pulses: Math.min(config.steps, config.pulses + 1) })}
          />
          <Nudge
            label="los pulsos"
            value={`en ${config.steps}`}
            onDown={() => {
              const steps = Math.max(2, config.steps - 1);
              apply({
                ...config,
                steps,
                pulses: Math.min(config.pulses, steps),
                rotation: config.rotation % steps,
              });
            }}
            onUp={() => apply({ ...config, steps: Math.min(16, config.steps + 1) })}
          />
        </div>
      )}
      <Foot>
        <Button
          variant="mini"
          ariaLabel={mine ? 'Parar el ritmo' : 'Oír el ritmo'}
          onClick={() => {
            if (mine) {
              metronome.stop();
              return;
            }
            metronome.setConfig(config);
            if (!metronome.getState().running) metronome.start();
          }}
        >
          {mine ? '■ Parar' : '▶ Oír'}
        </Button>
        {/* El tempo va al lado de "Oír": es lo que se toca mientras suena. */}
        <Nudge
          label="el tempo"
          value={`${config.bpm} ppm`}
          onDown={() => apply({ ...config, bpm: stepTempo(config.bpm, -1) })}
          onUp={() => apply({ ...config, bpm: stepTempo(config.bpm, 1) })}
        />
      </Foot>
    </div>
  );
}

const TONICS = Array.from({ length: 12 }, (_, tonic) => tonic);

const LockIcon = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <rect x="3" y="7" width="10" height="8" fill="currentColor" />
    <path
      d={open ? 'M5 7V4.5a3 3 0 0 1 5.8-1' : 'M5 7V4.5a3 3 0 0 1 6 0V7'}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

/** Si el acorde ya está en la progresión: misma raíz y misma tercera, aunque tenga séptima. */
function sameTriad(a: string, b: string): boolean {
  const x = parseChord(a);
  const y = parseChord(b);
  if (!x || !y || x.root !== y.root) return false;
  const third = (chord: typeof x) => (chord.intervals.includes(3) ? 3 : chord.intervals.includes(4) ? 4 : 0);
  return third(x) === third(y);
}

export function MiniHarmony({
  chords,
  harmonyKey,
  tuningNotes,
  onTonic,
  onMode,
  locks,
  onLock,
  onAdd,
  onRemove,
  onMove,
}: {
  chords: string[];
  harmonyKey: Key;
  tuningNotes: string[];
  onTonic: (tonic: number) => void;
  /** Sin esto, el modo se muestra pero no se cambia (en una sección con acordes propios). */
  onMode?: (mode: ModeId) => void;
  locks?: readonly boolean[];
  onLock?: (index: number) => void;
  onAdd?: (chord: string, at?: number) => void;
  onRemove?: (index: number) => void;
  onMove?: (index: number, to: number) => void;
}) {
  const a4 = useSettings((s) => s.a4);
  const notation = useSettings((s) => s.notation);
  const { playing, play, stop } = usePlayback();
  // Un acorde suelto tiene su propio reloj: si usara el de la progresión, su botón pasaría a "Parar"
  // y el pie se correría bajo el puntero (el segundo clic de un doble clic caería en otro lado).
  const single = usePlayback();
  const hit = (midis: number[]) => {
    if (playing) stop();
    single.play(1.5, () => strum(midis, a4));
  };
  const shapeOf = (name: string) => {
    const parsed = parseChord(name);
    const voicing = parsed ? voicingFor(tuningNotes, name) : null;
    return { name, voicing, midis: voicing?.midis ?? (parsed ? closeVoicing(parsed) : []) };
  };
  const shapes = chords.map(shapeOf);
  // Los grados de la tonalidad que la progresión no usa: para probarlos y sumarlos.
  const outside = diatonicChords(harmonyKey)
    .map((chord) => chord.name)
    .filter((name) => !chords.some((own) => sameTriad(own, name)));
  // La octava no se muestra: noteLabel solo la necesita para leer la nota.
  const tonicName = (tonic: number) => noteLabel(`${spell(tonicSpelling(tonic))}4`, notation);
  const frets = (shape: ReturnType<typeof shapeOf>) =>
    shape.voicing ? shape.voicing.frets.map((fret) => fret ?? 'x').join(' ') : 'sin digitación';
  const canAdd = !!onAdd && chords.length < MAX_CHORDS;
  // Los acordes se ordenan arrastrándolos, y los de afuera entran donde se los suelta.
  const DROP = 'consigna-acorde';
  const dragChord = (index: number) =>
    draggable<HTMLElement>(() =>
      onMove
        ? {
            group: DROP,
            label: chords[index]!,
            onDrop: (target, after) => onMove(index, reorderTo(index, insertionIndex(target, after))),
          }
        : null,
    );
  const dragSpare = (name: string) =>
    draggable<HTMLElement>(() =>
      canAdd
        ? {
            group: DROP,
            label: `+ ${name}`,
            onDrop: (target, after) => onAdd(name, insertionIndex(target, after)),
          }
        : null,
    );
  /** Un acorde de la progresión: oírlo, trabarlo, moverlo o sacarlo. */
  const chordMenu = (shape: ReturnType<typeof shapeOf>, index: number) =>
    contextMenu(
      () => [
        { label: `▶ Oír ${shape.name}`, onSelect: () => hit(shape.midis) },
        null,
        onLock && {
          label: 'Trabado',
          checked: Boolean(locks?.[index]),
          onSelect: () => onLock(index),
        },
        onMove && {
          label: '← Antes',
          disabled: index === 0,
          onSelect: () => onMove(index, index - 1),
        },
        onMove && {
          label: 'Después →',
          disabled: index === chords.length - 1,
          onSelect: () => onMove(index, index + 1),
        },
        onAdd && {
          label: 'Repetirlo',
          disabled: !canAdd,
          onSelect: () => onAdd(shape.name),
        },
        onRemove && {
          label: 'Quitar de la progresión',
          disabled: chords.length <= MIN_CHORDS,
          onSelect: () => onRemove(index),
        },
      ],
      `${degreeOf(shape.name, harmonyKey.tonic) ?? ''} ${shape.name}`.trim(),
    );
  return (
    <div className={styles.mini}>
      <div className={styles.tonics}>
        <span className={styles.tonicLabel}>
          Tónica
          {onMode ? (
            <select
              className={styles.modeSelect}
              value={harmonyKey.mode}
              aria-label="Modo"
              data-testid="mini-mode"
              onChange={(event) => onMode(event.target.value as ModeId)}
            >
              {(Object.keys(MODES) as ModeId[]).map((id) => (
                <option key={id} value={id}>
                  {MODES[id].name}
                </option>
              ))}
            </select>
          ) : (
            <small>{MODES[harmonyKey.mode].name}</small>
          )}
        </span>
        <div className={styles.tonicStrip} role="group" aria-label="Tónica">
          {TONICS.map((tonic) => (
            <button
              key={tonic}
              type="button"
              aria-pressed={tonic === harmonyKey.tonic}
              aria-label={`Tónica ${tonicName(tonic)}`}
              onClick={() => onTonic(tonic)}
            >
              {tonicName(tonic)}
            </button>
          ))}
        </div>
      </div>
      {outside.length > 0 && (
        <div className={styles.outside} data-print="hide">
          <span className={styles.tonicLabel} title="Acordes de la tonalidad que la progresión no usa">
            Afuera
          </span>
          <div className={styles.spares} data-testid="mini-outside">
            {outside.map((name) => {
              const shape = shapeOf(name);
              return (
                <div key={name} className={styles.spare}>
                  <button
                    type="button"
                    aria-label={`Oír ${name}, que no está en la progresión`}
                    title={canAdd ? `${frets(shape)} · doble clic: sumarlo` : frets(shape)}
                    onClick={() => hit(shape.midis)}
                    onDoubleClick={() => canAdd && onAdd(name)}
                    onPointerDown={dragSpare(name)}
                    onContextMenu={contextMenu(
                      () => [
                        { label: `▶ Oír ${name}`, onSelect: () => hit(shape.midis) },
                        onAdd && {
                          label: 'Sumar a la progresión',
                          disabled: !canAdd,
                          onSelect: () => onAdd(name),
                        },
                      ],
                      `${degreeOf(name, harmonyKey.tonic) ?? ''} ${name} · afuera`.trim(),
                    )}
                  >
                    <small>{degreeOf(name, harmonyKey.tonic)}</small>
                    {name}
                  </button>
                  {canAdd && (
                    <button
                      type="button"
                      aria-label={`Sumar ${name} a la progresión`}
                      onClick={() => onAdd(name)}
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <Foot>
        <Button
          variant="mini"
          ariaLabel={playing ? 'Parar la progresión' : 'Oír la progresión'}
          onClick={() => {
            if (playing) {
              stop();
              return;
            }
            play(shapes.length * SECONDS_PER_CHORD, () => {
              const start = getAudio().ctx.currentTime + 0.05;
              shapes.forEach((shape, index) => strum(shape.midis, a4, start + index * SECONDS_PER_CHORD));
            });
          }}
        >
          {playing ? '■ Parar' : '▶ Progresión'}
        </Button>
        <div className={styles.chords} title="Los acordes en esta tónica, con los trastes de esta afinación">
          {shapes.map((shape, index) => (
            <div
              key={`${shape.name}-${index}`}
              className={styles.chord}
              data-locked={onLock ? Boolean(locks?.[index]) : undefined}
              onContextMenu={chordMenu(shape, index)}
              onPointerDown={dragChord(index)}
              {...dropTarget(DROP, index)}
            >
              <button
                type="button"
                className={styles.chordPlay}
                aria-label={`Oír ${shape.name}`}
                title={
                  onLock
                    ? 'Arrastralo para moverlo · doble clic: trabarlo · clic derecho: más'
                    : 'Arrastralo para moverlo · clic derecho: más'
                }
                onClick={() => hit(shape.midis)}
                onDoubleClick={() => onLock?.(index)}
              >
                <strong data-testid="mini-chord-name">{shape.name}</strong>
                <small data-testid="mini-frets">{frets(shape)}</small>
              </button>
              {onLock && (
                <button
                  type="button"
                  className={styles.chordLock}
                  aria-pressed={Boolean(locks?.[index])}
                  aria-label={`${locks?.[index] ? 'Destrabar' : 'Trabar'} ${shape.name}`}
                  title={locks?.[index] ? 'Trabado: "Cambiar" no lo toca' : 'Trabar este acorde'}
                  onClick={() => onLock(index)}
                >
                  <LockIcon open={!locks?.[index]} />
                </button>
              )}
            </div>
          ))}
        </div>
      </Foot>
    </div>
  );
}

/** Melodía y acordes a la vez: los acordes en las cuerdas graves, la línea en las agudas. */
const EXAMPLE_BPM = 96;

function playOverChords(notes: Note[], bars: readonly string[], a4: number): number {
  const eighth = 60 / EXAMPLE_BPM / 2;
  const origin = getAudio().ctx.currentTime + 0.05;
  bars.forEach((name, bar) => {
    const parsed = parseChord(name);
    if (!parsed) return;
    closeVoicing(parsed)
      .slice(0, 4)
      .forEach((midi, string) =>
        pluckString(string, midi, { a4, when: origin + bar * BAR * eighth + string * 0.02, velocity: 0.45 }),
      );
  });
  notes.forEach((note, index) =>
    pluckString(4 + (index % 2), note.midi, { a4, when: origin + note.start * eighth }),
  );
  const end = Math.max(bars.length * BAR, ...notes.map((note) => note.start + note.dur));
  return end * eighth + 1;
}

export function MiniMelody({
  seed,
  kind,
  harmonyKey,
  chords,
  chosen,
}: {
  seed: number;
  /** La regla sorteada. Sin ella (una elegida a mano sin notas), el ejemplo es libre. */
  kind: MelodyKind | null;
  harmonyKey: Key;
  chords: string[];
  chosen: Note[] | null;
}) {
  const a4 = useSettings((s) => s.a4);
  const notation = useSettings((s) => s.notation);
  const { playing, play, stop } = usePlayback();
  const name = (pitchClass: number) => noteLabel(`${spellInKey(pitchClass, harmonyKey)}4`, notation);
  // Es barato: se arma en cada render, con la misma semilla sale siempre igual.
  const example = kind ? melodyExample(kind, { ...harmonyKey, chords, rng: createRng(seed), name }) : null;
  const bars = example?.bars ?? chords.slice(0, 4);
  const notes = chosen ?? example?.notes ?? exampleMelody(createRng(seed), harmonyKey.tonic, harmonyKey.mode);
  const length = chosen ? undefined : (example?.length ?? undefined);
  const caption = chosen
    ? 'La que armaste en Melodía.'
    : (example?.hint ?? `Una línea en ${name(harmonyKey.tonic)} ${MODES[harmonyKey.mode].name}.`);
  return (
    <div className={styles.mini}>
      <PianoRoll
        notes={notes}
        label={chosen ? 'Tu melodía' : 'Una línea de ejemplo que cumple la regla'}
        compact
        length={length}
        bars={chosen ? undefined : bars}
      />
      <p className={styles.noteNames} data-testid="mini-melody-notes">
        {notes.map((note) => name(((note.midi % 12) + 12) % 12)).join(' ')}
      </p>
      <Foot>
        <Button
          variant="mini"
          ariaLabel={playing ? 'Parar el ejemplo' : 'Oír un ejemplo de melodía sobre los acordes'}
          onClick={() => {
            if (playing) {
              stop();
              return;
            }
            const seconds = playOverChords(notes, chosen ? [] : bars, a4);
            play(seconds, () => undefined);
          }}
        >
          {playing ? '■ Parar' : chosen ? '▶ Oír' : '▶ Ejemplo'}
        </Button>
        <span className={styles.caption} data-testid="mini-melody-hint">
          {caption}
        </span>
      </Foot>
    </div>
  );
}

export function MiniLyric({ syllables }: { syllables?: number }) {
  const active = useProject((s) => s.active);
  const text = useProject((s) => s.sections[s.active]?.text) ?? '';
  const updateSection = useProject((s) => s.updateSection);
  const counts = text
    .split('\n')
    .filter((line) => wordsIn(line).length > 0)
    .map((line) => metricCount(line).total);
  const off = syllables ? counts.filter((count) => count !== syllables).length : 0;
  return (
    <div className={styles.mini}>
      <textarea
        className={styles.lyric}
        rows={2}
        value={text}
        aria-label={`Letra de la sección ${active}`}
        placeholder={
          syllables
            ? `Letra de la sección ${active}: versos de ${syllables}`
            : `Letra de la sección ${active}`
        }
        data-testid="mini-lyric"
        onChange={(event) => updateSection(active, { text: event.target.value })}
      />
      <Foot>
        <span className={styles.caption} data-testid="mini-lyric-count">
          {counts.length ? (
            <>
              Sílabas por verso:{' '}
              {counts.map((count, index) => (
                <span key={index}>
                  {index > 0 && ' · '}
                  <span
                    className={styles.count}
                    data-off={syllables !== undefined && count !== syllables}
                    title={syllables && count !== syllables ? `Pide ${syllables}` : undefined}
                  >
                    {count}
                  </span>
                </span>
              ))}
              {syllables !== undefined &&
                (off
                  ? ` · ${off === 1 ? 'uno no tiene' : `${off} no tienen`} ${syllables}`
                  : ` · todos de ${syllables}`)}
            </>
          ) : syllables ? (
            `Pide versos de ${syllables} sílabas: acá se cuentan.`
          ) : (
            'Acá se cuentan las sílabas de cada verso.'
          )}
        </span>
      </Foot>
    </div>
  );
}

/**
 * La forma se oye entera, con lo que tiene cada sección: el mismo tema que suena en el Estudio.
 * Tocar un bloque entra a esa sección, y la consigna muestra lo suyo.
 */
export function MiniForm({
  selected,
  onSelect,
  onOpenForm,
}: {
  selected: number | null;
  /** Con `keep`, el bloque queda elegido aunque ya lo estuviera. */
  onSelect: (index: number | null, keep?: boolean) => void;
  onOpenForm?: () => void;
}) {
  const { blocks, names } = useForm();
  const player = useSongPlayer();
  const letter = selected !== null ? blocks[selected] : undefined;
  const bars = useProject((s) => (letter ? s.sections[letter]?.bars : undefined)) ?? DEFAULT_BARS;
  const updateSection = useProject((s) => s.updateSection);
  return (
    <div className={styles.mini}>
      <FormStrip
        blocks={blocks}
        names={names}
        bars={player.bars}
        size="mini"
        selected={selected ?? undefined}
        active={letter}
        onSelect={onSelect}
        onMove={(from, to, continuing) => {
          const next = [...blocks];
          const [item] = next.splice(from, 1);
          next.splice(to, 0, item!);
          editBlocks(next, { continuing });
          onSelect(to, true);
        }}
        onDouble={(index) => {
          onSelect(index, true);
          player.playFrom(index);
        }}
        menu={(index) => {
          const at = blocks[index]!;
          const count = useProject.getState().sections[at]?.bars ?? DEFAULT_BARS;
          return [
            { label: '▶ Oír desde acá', onSelect: () => player.playFrom(index) },
            player.running && { label: '■ Parar', onSelect: () => song.stop() },
            null,
            index === selected
              ? { label: 'Toda la canción', onSelect: () => onSelect(null) }
              : { label: `Ver solo ${at}`, onSelect: () => onSelect(index, true) },
            {
              label: `Un compás más (${at}: ${count} cc)`,
              disabled: count >= MAX_BARS,
              onSelect: () => updateSection(at, { bars: Math.min(MAX_BARS, count + 1) }),
            },
            {
              label: 'Un compás menos',
              disabled: count <= 1,
              onSelect: () => updateSection(at, { bars: Math.max(1, count - 1) }),
            },
            null,
            onOpenForm && { label: 'Abrir Forma ↗', onSelect: onOpenForm },
          ];
        }}
      />
      {letter && (
        <div className={styles.controls} data-print="hide">
          <Nudge
            label={`los compases de ${letter}`}
            value={`${letter}: ${bars} cc`}
            onDown={() => updateSection(letter, { bars: Math.max(1, bars - 1) })}
            onUp={() => updateSection(letter, { bars: Math.min(MAX_BARS, bars + 1) })}
          />
        </div>
      )}
      <Foot>
        <Button
          variant="mini"
          id="mini-form-play"
          ariaLabel={player.running ? 'Parar la forma' : 'Oír la forma'}
          onClick={() => player.toggle(selected ?? 0)}
        >
          {player.running ? '■ Parar' : '▶ Oír'}
        </Button>
        {letter ? (
          <Button variant="mini" id="whole-song" onClick={() => onSelect(null)}>
            Toda la canción
          </Button>
        ) : Object.keys(names).length > 0 ? (
          <FormLegend blocks={blocks} names={names} />
        ) : (
          <span className={styles.caption}>Tocá un bloque para ver y cambiar solo esa sección.</span>
        )}
      </Foot>
    </div>
  );
}

export function MiniDrone({
  config,
  onChange,
}: {
  config: DroneConfig;
  onChange: (next: DroneConfig) => void;
}) {
  const state = useSyncExternalStore(drone.subscribe, drone.getState, drone.getState);
  const mine = state.running && sameConfig(state.config, config);
  const apply = (next: DroneConfig) => {
    if (mine) drone.setConfig(next);
    onChange(next);
  };
  return (
    <div className={styles.mini}>
      {!config.notes && (
        <div className={styles.controls} data-print="hide">
          <select
            className={styles.pick}
            value={config.stack}
            aria-label="Qué se apila sobre la raíz"
            data-testid="mini-drone-stack"
            onChange={(event) => apply({ ...config, stack: event.target.value as StackId })}
          >
            {(Object.keys(STACKS) as StackId[]).map((id) => (
              <option key={id} value={id}>
                {STACKS[id].name}
              </option>
            ))}
          </select>
          <select
            className={styles.pick}
            value={config.timbre}
            aria-label="Timbre del drone"
            onChange={(event) => apply({ ...config, timbre: event.target.value as TimbreId })}
          >
            {(Object.keys(TIMBRES) as TimbreId[]).map((id) => (
              <option key={id} value={id}>
                {TIMBRES[id].name}
              </option>
            ))}
          </select>
        </div>
      )}
      <Foot>
        <Button
          variant="mini"
          ariaLabel={mine ? 'Parar el drone' : 'Sostener el drone'}
          onClick={() => {
            if (mine) {
              drone.stop();
              return;
            }
            drone.setConfig(config);
            drone.start();
          }}
        >
          {mine ? '■ Parar' : '▶ Sostener'}
        </Button>
        <span className={styles.caption}>Sigue sonando para tocar encima.</span>
      </Foot>
    </div>
  );
}
