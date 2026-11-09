// Afinación por micrófono: lee el audio fuera de los renders y publica solo lo que cambia.
import { useCallback, useEffect, useRef, useState } from 'react';
import { isInstrumentSounding } from '~/audio/instrument';
import { openMic, type MicError, type MicInput } from '~/audio/mic';
import { centsBetween, centsToTarget, midiToHz, noteToMidi } from '~/core/notes';
import { detectPitch, PitchTracker } from '~/core/pitch';
import type { TunerMode } from '~/shared/settings';

/** Hasta acá, la cuerda está afinada: el oído no distingue menos en una guitarra. */
export const TUNED_CENTS = 5;
const NEAR_CENTS = 15;
/** Para darla por afinada alcanza con que se sostenga un rato, aunque tiemble un poco. */
const TUNED_WINDOW_MS = 400;
const TUNED_SPREAD_CENTS = 10;
const SILENCE_RESET_MS = 500;
const AFTER_TUNED_PAUSE_MS = 900;
const POLL_MS = 50;
/** La aguja sigue a la lectura con un poco de inercia, para que se pueda leer. */
const NEEDLE_EASE = 0.45;

export interface Reading {
  cents: number;
  freq: number;
}

export type TuningState = 'idle' | 'ok' | 'near' | 'off';

/** Qué hacer con la cuerda, en palabras. Lo usan el afinador y la consigna. */
export function tuningStatus(
  reading: Reading | null,
  listening: boolean,
  stringNumber: number,
): { state: TuningState; text: string } {
  if (!reading) {
    return {
      state: 'idle',
      text: listening ? `Tocá la ${stringNumber}.ª cuerda al aire.` : 'Activá el micrófono para afinar.',
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

/** La posición de la aguja, de 0 a 100, con el centro en 50. */
export const needlePosition = (reading: Reading | null) =>
  reading ? 50 + Math.max(-50, Math.min(50, reading.cents)) : 50;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};

const MIC_MESSAGES: Record<MicError, string> = {
  unsupported: 'Este navegador no da acceso al micrófono en esta página. Abrila desde localhost o por https.',
  denied: 'No hay permiso para usar el micrófono. Habilitalo en el navegador y probá de nuevo.',
  missing: 'No se encontró ningún micrófono.',
  failed: 'No se pudo abrir el micrófono.',
};

export function useTuner(notes: string[], a4: number, mode: TunerMode) {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState(0);
  const [tuned, setTuned] = useState<boolean[]>(() => notes.map(() => false));
  const [reading, setReading] = useState<Reading | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const mic = useRef<MicInput | null>(null);
  const opening = useRef(false);
  const mounted = useRef(true);
  // El bucle de lectura corre fuera de los renders y consulta siempre el último estado.
  const latest = useRef({ notes, a4, mode, selected, tuned });
  useEffect(() => {
    latest.current = { notes, a4, mode, selected, tuned };
  });

  useEffect(() => {
    if (!active) return;
    const tracker = new PitchTracker(5);
    // Las últimas lecturas de la cuerda actual: con ellas se decide si está afinada.
    let recent: { at: number; cents: number }[] = [];
    let shown: number | null = null;
    let lastString = -1;
    let lastHeard = performance.now();
    let ignoreUntil = 0;
    const forget = () => {
      tracker.reset();
      recent = [];
      shown = null;
    };

    const timer = setInterval(() => {
      const input = mic.current;
      if (!input) return;
      const now = performance.now();
      if (isInstrumentSounding() || now < ignoreUntil) {
        forget();
        return;
      }
      const state = latest.current;
      const targets = state.notes.map((note) => midiToHz(noteToMidi(note), state.a4));
      // Solo se busca cerca de las cuerdas: así el zumbido de la red o un armónico no se cuelan.
      const result = detectPitch(input.read(), input.sampleRate, {
        minFreq: Math.max(30, Math.min(...targets) / 1.5),
        maxFreq: Math.max(...targets) * 1.5,
        fallback: 0.3,
        minRms: 0.002,
      });
      if (!result) {
        if (now - lastHeard > SILENCE_RESET_MS) {
          forget();
          setReading(null);
        }
        return;
      }
      lastHeard = now;
      const freq = tracker.push(result.freq);

      let current = state.selected;
      if (state.mode === 'auto') {
        // Las cuerdas al unísono empatan: se queda en la actual o pasa a la primera sin afinar.
        const distances = targets.map((target) => Math.abs(centsBetween(freq, target)));
        const minimum = Math.min(...distances);
        const candidates = distances.flatMap((distance, index) => (distance - minimum < 1 ? [index] : []));
        if (!candidates.includes(current)) {
          current = candidates.find((index) => !state.tuned[index]) ?? candidates[0] ?? current;
          latest.current = { ...state, selected: current };
          setSelected(current);
        }
      }
      if (current !== lastString) {
        recent = [];
        shown = null;
        lastString = current;
      }

      const cents = centsToTarget(freq, targets[current]!);
      // Un salto grande (otra cuerda, o el ataque) mueve la aguja de una; lo demás, con inercia.
      shown = shown === null || Math.abs(cents - shown) > 30 ? cents : shown + (cents - shown) * NEEDLE_EASE;
      setReading({ cents: shown, freq });

      recent = [...recent.filter((item) => now - item.at <= TUNED_WINDOW_MS), { at: now, cents }];
      const enough =
        recent.length >= (TUNED_WINDOW_MS / POLL_MS) * 0.75 && now - recent[0]!.at >= TUNED_WINDOW_MS * 0.7;
      const spread = Math.max(...recent.map((item) => Math.abs(item.cents)));
      const settled = Math.abs(median(recent.map((item) => item.cents)));
      if (!enough || settled > TUNED_CENTS || spread > TUNED_SPREAD_CENTS || state.tuned[current]) return;

      recent = [];
      const nextTuned = state.tuned.map((value, index) => value || index === current);
      latest.current = { ...latest.current, tuned: nextTuned };
      setTuned(nextTuned);
      if (state.mode === 'guided') {
        const next = nextTuned.findIndex((value, index) => !value && index > current);
        const target = next >= 0 ? next : nextTuned.findIndex((value) => !value);
        if (target >= 0) {
          ignoreUntil = now + AFTER_TUNED_PAUSE_MS;
          forget();
          latest.current = { ...latest.current, selected: target };
          setSelected(target);
          setReading(null);
        }
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [active]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      mic.current?.stop();
      mic.current = null;
    };
  }, []);

  const toggle = useCallback(async () => {
    if (opening.current) return;
    if (mic.current) {
      mic.current.stop();
      mic.current = null;
      setActive(false);
      setReading(null);
      return;
    }
    setMessage(null);
    opening.current = true;
    const input = await openMic();
    opening.current = false;
    if (typeof input === 'string') {
      if (mounted.current) setMessage(MIC_MESSAGES[input]);
      return;
    }
    // Si la pantalla se cerró mientras se pedía el permiso, el micrófono no queda abierto.
    if (!mounted.current) {
      input.stop();
      return;
    }
    mic.current = input;
    setActive(true);
  }, []);

  const selectString = useCallback((index: number) => {
    setSelected(index);
    setReading(null);
    setTuned((previous) => previous.map((value, i) => (i === index ? false : value)));
  }, []);

  return { active, selected, tuned, reading, message, toggle, selectString };
}
