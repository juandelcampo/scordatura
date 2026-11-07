// Botón de grabar: guarda la nota de voz pegada a la consigna y a la sección donde nació.
import { useEffect, useRef, useState } from 'react';
import { startRecording, type Recording, type RecordError } from '~/audio/recorder';
import { addEntry } from './journal';
import { currentConsigna } from './consigna';
import { useProject } from './project';
import { Button } from './ui/ui';
import styles from './ui/ui.module.css';

const MESSAGES: Record<RecordError, string> = {
  unsupported: 'Este navegador no permite grabar en esta página. Abrila desde localhost o por https.',
  denied: 'No hay permiso para usar el micrófono.',
  missing: 'No se encontró ningún micrófono.',
  failed: 'No se pudo empezar a grabar.',
};

export function RecordButton() {
  const [seconds, setSeconds] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const recording = useRef<Recording | null>(null);

  useEffect(() => {
    if (seconds === null) return;
    const timer = setTimeout(() => setSeconds(seconds + 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  useEffect(
    () => () => {
      recording.current?.cancel();
      recording.current = null;
    },
    [],
  );

  const toggle = async () => {
    if (recording.current) {
      const current = recording.current;
      recording.current = null;
      setSeconds(null);
      const blob = await current.stop();
      const { code: consignaCode, number: consignaNumber } = currentConsigna();
      const section = useProject.getState().active;
      const when = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
      await addEntry({
        kind: 'audio',
        blob,
        name: `Idea del ${when}`,
        note: '',
        consignaCode,
        consignaNumber,
        section,
      });
      setMessage('Guardada en el diario.');
      return;
    }
    setMessage(null);
    const started = await startRecording();
    if (typeof started === 'string') {
      setMessage(MESSAGES[started]);
      return;
    }
    recording.current = started;
    setSeconds(0);
  };

  return (
    <div className={styles.recorder}>
      <Button onClick={() => void toggle()} id="record">
        {seconds === null ? '● Grabar idea' : `■ Terminar (${seconds} s)`}
      </Button>
      <span role="status">{message}</span>
    </div>
  );
}
