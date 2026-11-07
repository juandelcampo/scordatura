// Afinación por micrófono: lee el audio fuera de los renders y publica solo lo que cambia.
import { useCallback, useEffect, useRef, useState } from 'react';
import { isInstrumentSounding } from '~/audio/instrument';
import { openMic, type MicError, type MicInput } from '~/audio/mic';
import { centsBetween, centsToTarget, midiToHz, noteToMidi } from '~/core/notes';
import { detectPitch, PitchTracker } from '~/core/pitch';
import type { TunerMode } from '~/shared/settings';

const TUNED_CENTS = 4;
const TUNED_HOLD_MS = 700;
const SILENCE_RESET_MS = 500;
const AFTER_TUNED_PAUSE_MS = 900;
const POLL_MS = 50;

export interface Reading {
  cents: number;
  freq: number;
}

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
  // El bucle de lectura corre fuera de los renders y consulta siempre el último estado.
  const latest = useRef({ notes, a4, mode, selected, tuned });
  useEffect(() => {
    latest.current = { notes, a4, mode, selected, tuned };
  });

  useEffect(() => {
    if (!active) return;
    const tracker = new PitchTracker(5);
    let tunedSince: number | null = null;
    let lastHeard = performance.now();
    let ignoreUntil = 0;

    const timer = setInterval(() => {
      const input = mic.current;
      if (!input) return;
      const now = performance.now();
      if (isInstrumentSounding() || now < ignoreUntil) {
        tracker.reset();
        tunedSince = null;
        return;
      }
      const result = detectPitch(input.read(), input.sampleRate);
      if (!result) {
        if (now - lastHeard > SILENCE_RESET_MS) {
          tracker.reset();
          tunedSince = null;
          setReading(null);
        }
        return;
      }
      lastHeard = now;
      const freq = tracker.push(result.freq);
      const state = latest.current;
      const targets = state.notes.map((note) => midiToHz(noteToMidi(note), state.a4));

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
          tunedSince = null;
        }
      }

      const cents = centsToTarget(freq, targets[current]!);
      setReading({ cents, freq });
      if (Math.abs(cents) > TUNED_CENTS) {
        tunedSince = null;
        return;
      }
      tunedSince ??= now;
      if (now - tunedSince < TUNED_HOLD_MS || state.tuned[current]) return;

      tunedSince = null;
      const nextTuned = state.tuned.map((value, index) => value || index === current);
      latest.current = { ...latest.current, tuned: nextTuned };
      setTuned(nextTuned);
      if (state.mode === 'guided') {
        const next = nextTuned.findIndex((value, index) => !value && index > current);
        const target = next >= 0 ? next : nextTuned.findIndex((value) => !value);
        if (target >= 0) {
          ignoreUntil = now + AFTER_TUNED_PAUSE_MS;
          tracker.reset();
          latest.current = { ...latest.current, selected: target };
          setSelected(target);
          setReading(null);
        }
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [active]);

  useEffect(
    () => () => {
      mic.current?.stop();
      mic.current = null;
    },
    [],
  );

  const toggle = useCallback(async () => {
    if (mic.current) {
      mic.current.stop();
      mic.current = null;
      setActive(false);
      setReading(null);
      return;
    }
    setMessage(null);
    const input = await openMic();
    if (typeof input === 'string') {
      setMessage(MIC_MESSAGES[input]);
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
