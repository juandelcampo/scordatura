// Las notas en una grilla: altura hacia arriba, tiempo hacia la derecha.
import type { Note } from '~/core/melody';
import { midiToNote } from '~/core/notes';
import styles from './ui/pianoRoll.module.css';

export function PianoRoll({ notes, label, compact }: { notes: Note[]; label: string; compact?: boolean }) {
  if (notes.length === 0) return <div className={styles.empty}>Todavía no hay notas.</div>;
  const pitches = notes.map((note) => note.midi);
  const low = Math.min(...pitches);
  const high = Math.max(...pitches);
  const end = Math.max(...notes.map((note) => note.start + note.dur));
  const rows = Math.max(1, high - low + 1);
  return (
    <figure className={styles.roll} data-compact={compact} aria-label={label} data-testid="piano-roll">
      {notes.map((note, index) => (
        <span
          key={index}
          className={styles.note}
          style={{
            left: `${(note.start / end) * 100}%`,
            width: `${(note.dur / end) * 100}%`,
            bottom: `${((note.midi - low) / rows) * 100}%`,
            height: `${(1 / rows) * 100}%`,
          }}
          data-note={midiToNote(note.midi)}
        />
      ))}
    </figure>
  );
}
