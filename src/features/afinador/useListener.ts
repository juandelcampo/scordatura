// Estado y secuenciador del escuchador: arpegios y rasgueos programados con el reloj de audio.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudio } from '~/audio/engine';
import { pluckString } from '~/audio/instrument';
import { noteToMidi } from '~/core/notes';

export type PlayStyle = 'arp' | 'strum';

interface ArpPattern {
  id: string;
  name: string;
  /** Cuerdas por paso, numeradas como en la guitarra (6 grave, 1 aguda). */
  steps: number[][];
}

interface StrumPattern {
  id: string;
  name: string;
  /** Segundos entre cuerda y cuerda de un mismo rasguido. */
  spread: number;
  steps: Array<'down' | 'up' | null>;
}

export const ARP_PATTERNS: ArpPattern[] = [
  { id: 'up', name: 'Ascendente', steps: [[6], [5], [4], [3], [2], [1]] },
  { id: 'updown', name: 'Sube y baja', steps: [[6], [5], [4], [3], [2], [1], [2], [3], [4], [5]] },
  { id: 'travis', name: 'Pulgar alternado', steps: [[6], [2], [4], [3], [5], [2], [4], [3]] },
  { id: 'pinch', name: 'Bajo y agudas', steps: [[6, 1], [3], [2], [3], [5, 1], [3], [2], [3]] },
];

export const STRUM_PATTERNS: StrumPattern[] = [
  { id: 'single', name: 'Una bajada', spread: 0.03, steps: ['down', null, null, null] },
  {
    id: 'slow',
    name: 'Bajada lenta',
    spread: 0.11,
    steps: ['down', null, null, null, null, null, null, null],
  },
  { id: 'folk', name: 'Folk', spread: 0.02, steps: ['down', null, 'down', 'up', null, 'up', 'down', 'up'] },
  { id: 'waltz', name: 'Vals', spread: 0.024, steps: ['down', null, 'down', 'up', 'down', 'up'] },
];

const STRINGS = 6;
const LOOKAHEAD = 0.12;
const SCHEDULE_MS = 30;

export function useListener(
  notes: string[],
  a4: number,
  onSound: (stringIndex: number, velocity: number) => void,
) {
  const [capo, setCapoState] = useState(0);
  const [frets, setFrets] = useState<number[]>(() => new Array(STRINGS).fill(0));
  const [style, setStyle] = useState<PlayStyle>('arp');
  const [patternId, setPatternId] = useState<Record<PlayStyle, string>>({ arp: 'up', strum: 'single' });
  const [tempo, setTempo] = useState(84);
  const [loop, setLoop] = useState(false);
  const [running, setRunning] = useState(false);

  // El secuenciador corre fuera de los renders: siempre lee el último estado.
  const latest = useRef({ notes, a4, capo, frets, tempo, loop, style, patternId, onSound });
  useEffect(() => {
    latest.current = { notes, a4, capo, frets, tempo, loop, style, patternId, onSound };
  });

  const timers = useRef<{
    interval: ReturnType<typeof setInterval> | null;
    end: ReturnType<typeof setTimeout> | null;
  }>({
    interval: null,
    end: null,
  });

  const playString = useCallback((stringIndex: number, when?: number, velocity = 1) => {
    const state = latest.current;
    const midi = noteToMidi(state.notes[stringIndex]!) + state.capo + state.frets[stringIndex]!;
    const start = pluckString(stringIndex, midi, { a4: state.a4, when, velocity });
    const delay = Math.max(0, (start - getAudio().ctx.currentTime) * 1000);
    setTimeout(() => latest.current.onSound(stringIndex, velocity), delay);
  }, []);

  const stop = useCallback(() => {
    if (timers.current.interval !== null) clearInterval(timers.current.interval);
    if (timers.current.end !== null) clearTimeout(timers.current.end);
    timers.current = { interval: null, end: null };
    setRunning(false);
  }, []);

  const start = useCallback(
    (once?: { style: PlayStyle; id: string }) => {
      stop();
      const { ctx } = getAudio();
      const playStyle = once?.style ?? latest.current.style;
      const id = once?.id ?? latest.current.patternId[playStyle];
      const arp = ARP_PATTERNS.find((item) => item.id === id);
      const strum = STRUM_PATTERNS.find((item) => item.id === id);
      const length = playStyle === 'arp' ? (arp?.steps.length ?? 0) : (strum?.steps.length ?? 0);
      let step = 0;
      let nextTime = ctx.currentTime + 0.06;

      const playStep = (index: number, time: number) => {
        if (playStyle === 'arp') {
          arp?.steps[index]?.forEach((stringNumber) => playString(STRINGS - stringNumber, time, 0.9));
          return;
        }
        const direction = strum?.steps[index];
        if (!direction || !strum) return;
        const order = direction === 'up' ? [5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5];
        order.forEach((stringIndex, position) =>
          playString(stringIndex, time + position * strum.spread, direction === 'up' ? 0.62 : 0.85),
        );
      };

      const schedule = () => {
        const stepSeconds = 60 / latest.current.tempo / 2;
        while (nextTime < ctx.currentTime + LOOKAHEAD) {
          if (step >= length) {
            if (once || !latest.current.loop) {
              if (timers.current.interval !== null) clearInterval(timers.current.interval);
              timers.current.interval = null;
              timers.current.end = setTimeout(
                () => setRunning(false),
                Math.max(0, nextTime - ctx.currentTime) * 1000,
              );
              return;
            }
            step = 0;
          }
          playStep(step, nextTime);
          nextTime += stepSeconds;
          step += 1;
        }
      };

      timers.current.interval = setInterval(schedule, SCHEDULE_MS);
      setRunning(true);
      schedule();
    },
    [playString, stop],
  );

  useEffect(() => stop, [stop]);

  // Cambiar el patrón con la música en marcha lo aplica enseguida.
  const restartIfRunning = useCallback(() => {
    if (timers.current.interval !== null) setTimeout(start, 0);
  }, [start]);

  return {
    capo,
    frets,
    style,
    patternId,
    tempo,
    loop,
    running,
    playString,
    start: useCallback(() => start(), [start]),
    playAscending: useCallback(() => start({ style: 'arp', id: 'up' }), [start]),
    stop,
    setTempo,
    setLoop,
    setCapo: (value: number) => setCapoState(Math.max(0, Math.min(12, value))),
    clearFrets: () => setFrets(new Array(STRINGS).fill(0)),
    applyShape: (next: number[]) => {
      latest.current.frets = next;
      setFrets(next);
      start({ style: 'strum', id: 'single' });
    },
    toggleFret: (stringIndex: number, fret: number) => {
      const next = frets.map((value, index) => (index === stringIndex ? (value === fret ? 0 : fret) : value));
      latest.current.frets = next;
      setFrets(next);
      playString(stringIndex);
    },
    chooseStyle: (value: PlayStyle) => {
      latest.current.style = value;
      setStyle(value);
      restartIfRunning();
    },
    choosePattern: (value: string) => {
      const next = { ...patternId, [style]: value };
      latest.current.patternId = next;
      setPatternId(next);
      restartIfRunning();
    },
  };
}
