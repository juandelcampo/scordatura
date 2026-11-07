// Entrada de micrófono en crudo: sin cancelación de eco ni control de ganancia, que
// deforman justo lo que un afinador necesita medir.
import { getAudio } from './engine';

export type MicError = 'unsupported' | 'denied' | 'missing' | 'failed';

export interface MicInput {
  read(): Float32Array;
  sampleRate: number;
  stop(): void;
}

export async function openMic(): Promise<MicInput | MicError> {
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  const { ctx } = getAudio();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
    if (name === 'NotFoundError') return 'missing';
    return 'failed';
  }

  const analyser = ctx.createAnalyser();
  // A mayor frecuencia de muestreo hace falta una ventana mayor para los graves.
  analyser.fftSize = ctx.sampleRate > 60000 ? 8192 : 4096;
  const source = ctx.createMediaStreamSource(stream);
  source.connect(analyser);
  // Salida silenciosa: algunos navegadores no procesan un analizador sin destino.
  const silence = ctx.createGain();
  silence.gain.value = 0;
  analyser.connect(silence).connect(ctx.destination);

  const buffer = new Float32Array(analyser.fftSize);
  return {
    sampleRate: ctx.sampleRate,
    read() {
      analyser.getFloatTimeDomainData(buffer);
      return buffer;
    },
    stop() {
      source.disconnect();
      analyser.disconnect();
      silence.disconnect();
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}
