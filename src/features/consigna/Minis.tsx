// Versiones concisas de cada herramienta, para usar la consigna sin cambiar de pantalla.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { drone } from '~/audio/drone';
import { getAudio } from '~/audio/engine';
import { playMelody, pluckString, stopInstrument, strum } from '~/audio/instrument';
import { metronome } from '~/audio/metronome';
import { song } from '~/audio/song';
import { canonical } from '~/core/canonical';
import { closeVoicing, degreeOf, parseChord, voicingFor } from '~/core/chords';
import type { DroneConfig } from '~/core/drone';
import { exampleMelody, type Note } from '~/core/melody';
import { noteLabel, noteToMidi, splitNote } from '~/core/notes';
import type { RhythmConfig } from '~/core/rhythm';
import { createRng } from '~/core/rng';
import { metricCount, wordsIn } from '~/core/spanish';
import { PianoRoll } from '~/shared/PianoRoll';
import { useProject } from '~/shared/project';
import { RhythmGrid } from '~/shared/RhythmGrid';
import { useSettings } from '~/shared/settings';
import { Button } from '~/shared/ui/ui';
import { useTuner } from '~/shared/useTuner';
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

/** Se monta recién al activarlo: hasta entonces la consigna no pide el micrófono. */
function MiniTuner({ notes, onClose }: { notes: string[]; onClose: () => void }) {
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
  let status = active ? `Tocá la ${notes.length - selected}.ª cuerda al aire.` : 'Abriendo el micrófono…';
  if (message) status = message;
  else if (reading) {
    const size = Math.abs(reading.cents);
    const direction = reading.cents < 0 ? 'Subí' : 'Bajá';
    status =
      size <= 4
        ? '¡Afinada!'
        : size < 60
          ? `${direction} ${Math.round(size)} cents`
          : `${direction} ${Math.round(size / 100)} semitonos`;
  }

  return (
    <div className={styles.tuner} data-testid="mini-tuner">
      <div className={styles.strings}>
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
      <div className={styles.tunerStatus} role="status" data-testid="mini-tuner-status">
        {status}
      </div>
      <Button
        variant="mini"
        onClick={() => {
          if (active) void toggle();
          onClose();
        }}
      >
        Cerrar afinador
      </Button>
    </div>
  );
}

export function MiniTuning({ notes }: { notes: string[] }) {
  const a4 = useSettings((s) => s.a4);
  const notation = useSettings((s) => s.notation);
  const { playing, play, stop } = usePlayback();
  const [tuning, setTuning] = useState(false);
  const midis = notes.map(noteToMidi);
  const eighth = 60 / ARPEGGIO_BPM / 2;

  return (
    <div className={styles.mini}>
      <div className={styles.strings}>
        {notes.map((note, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Oír cuerda ${notes.length - index}: ${noteLabel(note, notation)}`}
            onClick={() => pluckString(index, midis[index]!, { a4 })}
          >
            {noteLabel(note, notation)}
            <sub>{splitNote(note).octave}</sub>
          </button>
        ))}
      </div>
      <div className={styles.buttons}>
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
        {!tuning && (
          <Button variant="mini" onClick={() => setTuning(true)} ariaLabel="Afinar con el micrófono">
            Afinar
          </Button>
        )}
      </div>
      {tuning && <MiniTuner key={notes.join()} notes={notes} onClose={() => setTuning(false)} />}
    </div>
  );
}

const sameConfig = (a: unknown, b: unknown) => canonical(a) === canonical(b);

export function MiniRhythm({ config }: { config: RhythmConfig }) {
  const state = useSyncExternalStore(metronome.subscribe, metronome.getState, metronome.getState);
  const mine = state.running && sameConfig(state.config, config);
  return (
    <div className={styles.mini}>
      <RhythmGrid config={config} compact />
      <div className={styles.buttons}>
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
      </div>
    </div>
  );
}

export function MiniHarmony({
  chords,
  tonic,
  tuningNotes,
}: {
  chords: string[];
  tonic: number | undefined;
  tuningNotes: string[];
}) {
  const a4 = useSettings((s) => s.a4);
  const { playing, play, stop } = usePlayback();
  const center = tonic ?? parseChord(chords[0] ?? '')?.root ?? 0;
  const shapes = chords.map((name) => {
    const parsed = parseChord(name);
    const voicing = parsed ? voicingFor(tuningNotes, name) : null;
    return { name, voicing, midis: voicing?.midis ?? (parsed ? closeVoicing(parsed) : []) };
  });
  return (
    <div className={styles.mini}>
      <div className={styles.chords}>
        {shapes.map((shape, index) => (
          <button
            key={`${shape.name}-${index}`}
            type="button"
            aria-label={`Oír ${shape.name}`}
            onClick={() => play(1.5, () => strum(shape.midis, a4))}
          >
            <strong>{shape.name}</strong>
            <small data-testid="mini-frets">
              {shape.voicing ? shape.voicing.frets.map((fret) => fret ?? 'x').join(' ') : 'sin digitación'}
            </small>
          </button>
        ))}
      </div>
      <div className={styles.degrees} data-testid="mini-degrees">
        {chords.map((name) => degreeOf(name, center) ?? '?').join(' – ')}
      </div>
      <div className={styles.caption}>Grados, y trastes en la afinación de esta consigna.</div>
      <div className={styles.buttons}>
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
      </div>
    </div>
  );
}

export function MiniMelody({
  seed,
  chord,
  chosen,
}: {
  seed: number;
  chord: string | undefined;
  chosen: Note[] | null;
}) {
  const a4 = useSettings((s) => s.a4);
  const { playing, play, stop } = usePlayback();
  const parsed = chord ? parseChord(chord) : null;
  const minor = parsed?.intervals.includes(3) ?? true;
  const notes = chosen ?? exampleMelody(createRng(seed), parsed?.root ?? 9, minor ? 'aeolian' : 'ionian');
  return (
    <div className={styles.mini}>
      <PianoRoll notes={notes} label={chosen ? 'Tu melodía' : 'Una línea de ejemplo'} compact />
      <div className={styles.caption}>
        {chosen
          ? 'La que armaste en Melodía.'
          : `Una línea posible sobre ${chord ?? 'el primer acorde'}, para oír la idea. La tuya va a ser otra.`}
      </div>
      <div className={styles.buttons}>
        <Button
          variant="mini"
          ariaLabel={playing ? 'Parar el ejemplo' : 'Oír un ejemplo de melodía'}
          onClick={() => (playing ? stop() : play(4, () => playMelody(notes, 100, a4)))}
        >
          {playing ? '■ Parar' : '▶ Ejemplo'}
        </Button>
      </div>
    </div>
  );
}

export function MiniLyric() {
  const active = useProject((s) => s.active);
  const text = useProject((s) => s.sections[s.active]?.text) ?? '';
  const updateSection = useProject((s) => s.updateSection);
  const counts = text
    .split('\n')
    .filter((line) => wordsIn(line).length > 0)
    .map((line) => metricCount(line).total);
  return (
    <div className={styles.mini}>
      <label className={styles.lyric}>
        <span>Letra de la sección {active}</span>
        <textarea
          rows={2}
          value={text}
          data-testid="mini-lyric"
          onChange={(event) => updateSection(active, { text: event.target.value })}
        />
      </label>
      <div className={styles.caption} data-testid="mini-lyric-count">
        {counts.length
          ? `Sílabas por verso: ${counts.join(' · ')}`
          : 'Escribí y acá se cuentan las sílabas de cada verso.'}
      </div>
    </div>
  );
}

export function MiniForm({ blocks }: { blocks: string[] }) {
  return (
    <div className={styles.mini}>
      <div className={styles.blocks}>
        {blocks.map((letter, index) => (
          <span key={index} data-letter={letter}>
            {letter}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MiniDrone({ config }: { config: DroneConfig }) {
  const state = useSyncExternalStore(drone.subscribe, drone.getState, drone.getState);
  const mine = state.running && sameConfig(state.config, config);
  return (
    <div className={styles.mini}>
      <div className={styles.buttons}>
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
      </div>
      <div className={styles.caption}>Sigue sonando mientras usás el resto, para tocar encima.</div>
    </div>
  );
}
