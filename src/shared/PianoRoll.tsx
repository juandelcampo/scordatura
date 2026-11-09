// Las notas en una grilla: altura hacia arriba, tiempo hacia la derecha.
import type { Note } from '~/core/melody';
import { midiToNote } from '~/core/notes';
import styles from './ui/pianoRoll.module.css';

const MIN_ROWS = 12;

interface PianoRollProps {
  notes: Note[];
  label: string;
  compact?: boolean;
  /** Cuántas corcheas mide, con los silencios del final. Sin decirlo, termina con la última nota. */
  length?: number;
  /** El acorde de cada compás de 8 corcheas: se escribe arriba, para leer la línea contra él. */
  bars?: readonly string[];
}

export function PianoRoll({ notes, label, compact, length, bars }: PianoRollProps) {
  if (notes.length === 0) return <div className={styles.empty}>Todavía no hay notas.</div>;
  const pitches = notes.map((note) => note.midi);
  // Al menos una octava de alto: con dos notas, cada una ocuparía media figura y no se leería la altura.
  const span = Math.max(...pitches) - Math.min(...pitches) + 1;
  const low = Math.min(...pitches) - Math.floor(Math.max(0, MIN_ROWS - span) / 2);
  const high = Math.max(low + MIN_ROWS - 1, Math.max(...pitches));
  const end = Math.max(length ?? 0, ...notes.map((note) => note.start + note.dur));
  const rows = Math.max(1, high - low + 1);
  return (
    <figure
      className={styles.roll}
      data-compact={compact}
      data-bars={bars ? true : undefined}
      aria-label={label}
      data-testid="piano-roll"
    >
      {bars?.map((chord, index) => (
        <span
          key={index}
          className={styles.bar}
          style={{ left: `${((index * 8) / end) * 100}%`, width: `${(8 / end) * 100}%` }}
        >
          {chord}
        </span>
      ))}
      {notes.map((note, index) => (
        <span
          key={index}
          className={styles.note}
          style={{
            left: `${(note.start / end) * 100}%`,
            width: `${(note.dur / end) * 100}%`,
            bottom: `${((note.midi - low) / rows) * (bars ? 78 : 100)}%`,
            height: `${(1 / rows) * (bars ? 78 : 100)}%`,
          }}
          data-note={midiToNote(note.midi)}
        />
      ))}
    </figure>
  );
}
