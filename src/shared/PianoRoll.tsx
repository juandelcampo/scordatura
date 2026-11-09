// Las notas en una grilla: altura hacia arriba, tiempo hacia la derecha.
import type { KeyboardEvent, PointerEvent } from 'react';
import type { Note } from '~/core/melody';
import { midiToNote } from '~/core/notes';
import { contextMenu } from './ContextMenu';
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
  /** Con esto, cada nota sube o baja arrastrándola (o con las flechas), y tiene su menú. */
  onNoteChange?: (index: number, midi: number) => void;
  /** Para oír una nota al tocarla o moverla. */
  onAudition?: (midi: number) => void;
}

const LOWEST = 36;
const HIGHEST = 96;
const clampMidi = (midi: number) => Math.min(HIGHEST, Math.max(LOWEST, midi));

export function PianoRoll({ notes, label, compact, length, bars, onNoteChange, onAudition }: PianoRollProps) {
  if (notes.length === 0) return <div className={styles.empty}>Todavía no hay notas.</div>;
  const pitches = notes.map((note) => note.midi);
  // Al menos una octava de alto: con dos notas, cada una ocuparía media figura y no se leería la altura.
  const span = Math.max(...pitches) - Math.min(...pitches) + 1;
  const low = Math.min(...pitches) - Math.floor(Math.max(0, MIN_ROWS - span) / 2);
  const high = Math.max(low + MIN_ROWS - 1, Math.max(...pitches));
  const end = Math.max(length ?? 0, ...notes.map((note) => note.start + note.dur));
  const rows = Math.max(1, high - low + 1);

  const change = (index: number, midi: number) => {
    const next = clampMidi(midi);
    if (!onNoteChange || next === notes[index]?.midi) return;
    onNoteChange(index, next);
    onAudition?.(next);
  };

  /** Se arrastra a lo alto: cada fila es un semitono. La altura de fila queda fija durante el gesto. */
  const drag = (index: number) => (event: PointerEvent<HTMLSpanElement>) => {
    if (!onNoteChange || event.button !== 0) return;
    event.preventDefault();
    const figure = event.currentTarget.parentElement!;
    const rowHeight = (figure.clientHeight * (bars ? 0.78 : 1)) / rows;
    const startY = event.clientY;
    const startMidi = notes[index]!.midi;
    let last = startMidi;
    onAudition?.(startMidi);
    event.currentTarget.setPointerCapture(event.pointerId);
    const target = event.currentTarget;
    const move = (e: globalThis.PointerEvent) => {
      const midi = clampMidi(startMidi + Math.round((startY - e.clientY) / rowHeight));
      if (midi === last) return;
      last = midi;
      onNoteChange(index, midi);
      onAudition?.(midi);
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };

  const keys = (index: number) => (event: KeyboardEvent<HTMLSpanElement>) => {
    const step = { ArrowUp: 1, ArrowDown: -1, PageUp: 12, PageDown: -12 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    change(index, notes[index]!.midi + (event.shiftKey ? step * 12 : step));
  };

  const noteMenu = (index: number) =>
    contextMenu<HTMLSpanElement>(
      () => {
        const midi = notes[index]!.midi;
        return [
          onAudition && { label: `▶ Oír ${midiToNote(midi)}`, onSelect: () => onAudition(midi) },
          null,
          { label: 'Un semitono arriba', disabled: midi >= HIGHEST, onSelect: () => change(index, midi + 1) },
          { label: 'Un semitono abajo', disabled: midi <= LOWEST, onSelect: () => change(index, midi - 1) },
          {
            label: 'Una octava arriba',
            disabled: midi + 12 > HIGHEST,
            onSelect: () => change(index, midi + 12),
          },
          {
            label: 'Una octava abajo',
            disabled: midi - 12 < LOWEST,
            onSelect: () => change(index, midi - 12),
          },
        ];
      },
      `Nota ${index + 1}: ${midiToNote(notes[index]!.midi)}`,
    );
  return (
    <figure
      className={styles.roll}
      data-compact={compact}
      data-bars={bars ? true : undefined}
      aria-label={label}
      data-testid="piano-roll"
      data-editable={onNoteChange ? true : undefined}
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
          {...(onNoteChange
            ? {
                tabIndex: 0,
                role: 'slider',
                'aria-label': `Nota ${index + 1}`,
                'aria-valuenow': note.midi,
                'aria-valuetext': midiToNote(note.midi),
                'aria-valuemin': LOWEST,
                'aria-valuemax': HIGHEST,
                title: 'Arrastrala para subirla o bajarla · flechas: de a semitono · clic derecho: más',
                onPointerDown: drag(index),
                onKeyDown: keys(index),
                onContextMenu: noteMenu(index),
              }
            : {})}
        />
      ))}
    </figure>
  );
}
