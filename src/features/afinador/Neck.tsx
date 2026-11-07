// Mástil interactivo: cuadrícula de botones con las cuerdas dibujadas en un canvas encima.
import { useEffect, useImperativeHandle, useRef, type PointerEvent, type Ref } from 'react';
import { midiToNote, noteLabel, noteToMidi, type Notation } from '~/core/notes';
import styles from './afinador.module.css';

const STRINGS = 6;
const FRETS = [1, 2, 3, 4, 5, 6, 7];

export interface NeckHandle {
  excite(stringIndex: number, velocity: number): void;
}

interface NeckProps {
  ref: Ref<NeckHandle>;
  notes: string[];
  capo: number;
  frets: number[];
  notation: Notation;
  onPluck: (stringIndex: number, velocity?: number) => void;
  onToggleFret: (stringIndex: number, fret: number) => void;
}

export function Neck({ ref, notes, capo, frets, notation, onPluck, onToggleFret }: NeckProps) {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const motion = useRef({
    amplitudes: new Array<number>(STRINGS).fill(0),
    phases: new Array<number>(STRINGS).fill(0),
    frame: 0,
  });
  const fretsRef = useRef(frets);
  const lastRow = useRef<number | null>(null);

  const draw = () => {
    const root = container.current;
    const surface = canvas.current;
    const context = surface?.getContext('2d');
    if (!root || !surface || !context) return;
    const box = root.getBoundingClientRect();
    if (box.width === 0) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(box.width * ratio);
    const height = Math.round(box.height * ratio);
    if (surface.width !== width || surface.height !== height) {
      surface.width = width;
      surface.height = height;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, box.width, box.height);

    const css = getComputedStyle(root);
    const stringColor = css.getPropertyValue('--neck-ink');
    const activeColor = css.getPropertyValue('--accent');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const { amplitudes, phases } = motion.current;

    for (let stringIndex = 0; stringIndex < STRINGS; stringIndex++) {
      const label = root.querySelector<HTMLElement>(`[data-label="${stringIndex}"]`);
      if (!label) continue;
      const labelBox = label.getBoundingClientRect();
      const y = labelBox.top - box.top + labelBox.height / 2;
      const startX = labelBox.right - box.left;
      const fret = fretsRef.current[stringIndex]!;
      // En pantallas chicas algunos trastes están ocultos: la cuerda se dibuja entera.
      const pressedBox = fret
        ? root.querySelector<HTMLElement>(`[data-fret="${stringIndex}:${fret}"]`)?.getBoundingClientRect()
        : null;
      const pressedX = pressedBox && pressedBox.width > 0 ? pressedBox.right - box.left : startX;
      const amplitude = still ? 0 : amplitudes[stringIndex]!;

      context.lineWidth = 0.9 + (STRINGS - 1 - stringIndex) * 0.32;
      context.globalAlpha = 0.45;
      context.strokeStyle = stringColor;
      context.beginPath();
      context.moveTo(startX, y);
      context.lineTo(pressedX, y);
      context.stroke();

      context.globalAlpha = 1;
      context.strokeStyle = amplitudes[stringIndex]! > 0.05 ? activeColor : stringColor;
      context.beginPath();
      context.moveTo(pressedX, y);
      const span = box.width - pressedX;
      for (let x = 3; x <= span; x += 3) {
        const wobble = amplitude * 4 * Math.sin((Math.PI * x) / span) * Math.sin(phases[stringIndex]!);
        context.lineTo(pressedX + x, y + wobble);
      }
      context.stroke();
    }
  };

  const animate = () => {
    const state = motion.current;
    state.frame = 0;
    let moving = false;
    for (let i = 0; i < STRINGS; i++) {
      state.amplitudes[i]! *= 0.955;
      if (state.amplitudes[i]! < 0.02) state.amplitudes[i] = 0;
      else moving = true;
      state.phases[i]! += 0.9;
    }
    draw();
    if (moving) state.frame = requestAnimationFrame(animate);
  };

  useImperativeHandle(ref, () => ({
    excite(stringIndex, velocity) {
      const state = motion.current;
      state.amplitudes[stringIndex] = Math.max(state.amplitudes[stringIndex]!, velocity);
      if (!state.frame) state.frame = requestAnimationFrame(animate);
    },
  }));

  useEffect(() => {
    fretsRef.current = frets;
    draw();
  });

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(root);
    const state = motion.current;
    return () => {
      observer.disconnect();
      if (state.frame) cancelAnimationFrame(state.frame);
    };
    // Solo al montar: draw lee todo desde refs y el DOM.
  }, []);

  const rowAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * STRINGS);
    return Math.min(STRINGS - 1, Math.max(0, row));
  };
  const hitRow = (row: number) => onPluck(STRINGS - 1 - row, 0.85);

  return (
    <div ref={container} className={styles.neck}>
      <canvas ref={canvas} className={styles.neckCanvas} aria-hidden="true" />
      <div className={styles.neckGrid}>
        {Array.from({ length: STRINGS }, (_, row) => {
          const stringIndex = STRINGS - 1 - row;
          const fret = frets[stringIndex]!;
          const sounding = midiToNote(noteToMidi(notes[stringIndex]!) + capo + fret);
          const label =
            fret || capo ? noteLabel(sounding, notation) : noteLabel(notes[stringIndex]!, notation);
          return [
            <button
              key={`label-${row}`}
              type="button"
              className={styles.neckLabel}
              style={{ gridRow: row + 1 }}
              data-label={stringIndex}
              aria-label={`Tocar cuerda ${STRINGS - stringIndex}, suena ${label}`}
              onClick={() => onPluck(stringIndex)}
            >
              {label}
            </button>,
            ...FRETS.map((column) => (
              <button
                key={`fret-${row}-${column}`}
                type="button"
                className={styles.fret}
                style={{ gridRow: row + 1 }}
                data-fret={`${stringIndex}:${column}`}
                data-position={column}
                aria-pressed={fret === column}
                aria-label={`Cuerda ${STRINGS - stringIndex}, traste ${capo + column}`}
                onClick={() => onToggleFret(stringIndex, column)}
              >
                <span>{fret === column ? label : ''}</span>
              </button>
            )),
          ];
        })}
        <div
          className={styles.strumZone}
          data-testid="strum-zone"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            lastRow.current = rowAt(event);
            hitRow(lastRow.current);
          }}
          onPointerMove={(event) => {
            if (lastRow.current === null) return;
            const row = rowAt(event);
            const direction = Math.sign(row - lastRow.current);
            // Un gesto rápido puede saltear filas: suenan todas las cuerdas cruzadas.
            for (let current = lastRow.current; current !== row;) {
              current += direction;
              hitRow(current);
            }
            lastRow.current = row;
          }}
          onPointerUp={() => {
            lastRow.current = null;
          }}
          onPointerCancel={() => {
            lastRow.current = null;
          }}
        />
        <div className={styles.fretNumber} style={{ gridRow: STRINGS + 1 }}>
          {capo ? `C${capo}` : ''}
        </div>
        {FRETS.map((column) => (
          <div
            key={column}
            className={styles.fretNumber}
            style={{ gridRow: STRINGS + 1 }}
            data-position={column}
          >
            {capo + column}
          </div>
        ))}
        <div className={styles.fretNumber} style={{ gridRow: STRINGS + 1 }}>
          Rasgueá
        </div>
      </div>
    </div>
  );
}
