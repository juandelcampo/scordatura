// Reproduce la progresión acorde por acorde. Programa uno por vez, así lo que editás mientras suena
// entra en la vuelta que está pasando.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudio } from '~/audio/engine';
import { stopInstrument, strum } from '~/audio/instrument';

export interface PlayerInput {
  midis: number[][];
  /** Cuánto dura cada acorde. */
  seconds: number[];
  loop: boolean;
  a4: number;
}

/** Con cuánta anticipación se le pasa cada acorde al audio. */
const LOOKAHEAD_SECONDS = 0.25;

export function useProgressionPlayer(input: PlayerInput) {
  const latest = useRef(input);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    latest.current = input;
  });

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    stopInstrument();
    setCurrent(null);
  }, [clearTimers]);

  const play = () => {
    const { ctx } = getAudio();
    const after = (seconds: number, action: () => void) => {
      timers.current.push(setTimeout(action, Math.max(0, seconds) * 1000));
    };
    const step = (requested: number, when: number) => {
      timers.current = [];
      const { midis, seconds, loop, a4 } = latest.current;
      let index = requested;
      if (index >= midis.length) {
        if (!loop) {
          after(LOOKAHEAD_SECONDS, () => setCurrent(null));
          return;
        }
        index = 0;
      }
      // Si la pestaña estuvo en segundo plano, se retoma desde ahora en vez de amontonar notas.
      const start = Math.max(when, ctx.currentTime + 0.02);
      strum(midis[index]!, a4, start);
      after(start - ctx.currentTime, () => setCurrent(index));
      const next = start + seconds[index]!;
      after(next - ctx.currentTime - LOOKAHEAD_SECONDS, () => step(index + 1, next));
    };
    stop();
    setCurrent(0);
    step(0, ctx.currentTime + 0.05);
  };

  // Al salir de la pantalla no queda nada sonando ni programado.
  useEffect(
    () => () => {
      clearTimers();
      stopInstrument();
    },
    [clearTimers],
  );

  return { current, playing: current !== null, play, stop };
}
