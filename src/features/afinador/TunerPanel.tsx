import { pluckString } from '~/audio/instrument';
import { noteToMidi, splitNote, noteLabel, type Notation } from '~/core/notes';
import { isFarFromStandard, shiftString, stringOffsets } from '~/core/tuning';
import { useSettings } from '~/shared/settings';
import { Button, Segmented, Slab, SlabHead } from '~/shared/ui/ui';
import styles from './afinador.module.css';
import { useTuner, type Reading } from '~/shared/useTuner';

const NEAR_CENTS = 15;
const TUNED_CENTS = 4;

function NoteName({ note, notation }: { note: string; notation: Notation }) {
  return (
    <>
      {noteLabel(note, notation)}
      <sub>{splitNote(note).octave}</sub>
    </>
  );
}

function statusOf(reading: Reading | null, listening: boolean, stringNumber: number) {
  if (!reading) {
    return {
      state: 'idle',
      text: listening
        ? `Tocá la ${stringNumber}.ª cuerda al aire.`
        : 'Tocá una cuerda de arriba para oír su nota, o activá el micrófono para afinar.',
    };
  }
  const size = Math.abs(reading.cents);
  const direction = reading.cents < 0 ? 'Subí' : 'Bajá';
  if (size <= TUNED_CENTS) return { state: 'ok', text: '¡Afinada!' };
  if (size <= NEAR_CENTS) return { state: 'near', text: `${direction} un poquito` };
  if (size < 60) return { state: 'off', text: direction };
  const semitones = Math.round(size / 100);
  return { state: 'off', text: `${direction} ${semitones} ${semitones === 1 ? 'semitono' : 'semitonos'}` };
}

interface TunerPanelProps {
  notes: string[];
  editable: boolean;
  onEdit: (notes: string[]) => void;
}

export function TunerPanel({ notes, editable, onEdit }: TunerPanelProps) {
  const notation = useSettings((s) => s.notation);
  const a4 = useSettings((s) => s.a4);
  const mode = useSettings((s) => s.tunerMode);
  const set = useSettings((s) => s.set);
  const tuner = useTuner(notes, a4, mode);

  const offsets = stringOffsets(notes);
  const { reading, selected } = tuner;
  const status = statusOf(reading, tuner.active, notes.length - selected);
  const needle = reading ? 50 + Math.max(-50, Math.min(50, reading.cents)) : 50;

  const playReference = (index: number) => {
    pluckString(index, noteToMidi(notes[index]!), { a4 });
  };

  return (
    <Slab>
      <SlabHead title="Afinar">
        <Segmented
          label="Modo de afinación"
          value={mode}
          options={[
            { value: 'guided', label: 'Cuerda por cuerda' },
            { value: 'auto', label: 'Automático' },
          ]}
          onChange={(value) => set({ tunerMode: value })}
        />
      </SlabHead>

      <div className={styles.pills}>
        {notes.map((note, index) => {
          const offset = offsets[index]!;
          const number = notes.length - index;
          return (
            <div key={index} className={styles.pillWrap}>
              <button
                type="button"
                className={styles.pill}
                data-tuned={tuner.tuned[index]}
                aria-pressed={index === selected}
                aria-label={`Cuerda ${number}, ${noteLabel(note, notation)} ${splitNote(note).octave}${tuner.tuned[index] ? ', afinada' : ''}. Tocar nota de referencia.`}
                onClick={() => {
                  tuner.selectString(index);
                  playReference(index);
                }}
              >
                <span className={styles.pillNumber}>{tuner.tuned[index] ? '✓' : number}</span>
                <span className={styles.pillNote}>
                  <NoteName note={note} notation={notation} />
                </span>
                <span className={styles.pillDelta} data-far={isFarFromStandard(offset)}>
                  {offset === 0 ? '=' : `${offset > 0 ? '+' : '−'}${Math.abs(offset)}`}
                </span>
              </button>
              {editable && (
                <div className={styles.pillSteppers}>
                  {([-1, 1] as const).map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      aria-label={`${delta < 0 ? 'Bajar' : 'Subir'} cuerda ${number} un semitono`}
                      onClick={() => {
                        const next = shiftString(notes, index, delta);
                        onEdit(next);
                        tuner.selectString(index);
                        pluckString(index, noteToMidi(next[index]!), { a4 });
                      }}
                    >
                      {delta < 0 ? '−' : '+'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className={styles.meter}
        data-state={status.state}
        data-testid="meter"
        data-cents={reading?.cents.toFixed(1)}
      >
        <div className={styles.meterReadout}>
          <span className={styles.meterNote}>
            <NoteName note={notes[selected]!} notation={notation} />
          </span>
          <div className={styles.meterActions}>
            {reading && (
              <span className={styles.meterCents}>
                {reading.freq.toFixed(1)} Hz
                <br />
                {reading.cents >= 0 ? '+' : '−'}
                {Math.abs(reading.cents).toFixed(0)} cents
              </span>
            )}
            <Button variant="primary" onClick={() => void tuner.toggle()} id="mic-toggle">
              {tuner.active ? 'Apagar micrófono' : 'Activar micrófono'}
            </Button>
          </div>
        </div>
        <div className={styles.meterScale} aria-hidden="true">
          <div className={styles.meterZone} />
          <div className={styles.meterNeedle} style={{ left: `${needle}%` }} />
          <div className={styles.meterLabels}>
            <span>−50</span>
            <span>0</span>
            <span>+50</span>
          </div>
        </div>
        <p className={styles.meterStatus} role="status" data-testid="meter-status">
          {tuner.message ?? status.text}
        </p>
      </div>
    </Slab>
  );
}
