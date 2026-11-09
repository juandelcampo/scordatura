// Detección de altura (YIN) y suavizado de lecturas.

export function rms(buffer: Float32Array): number {
  let sum = 0;
  for (const sample of buffer) sum += sample * sample;
  return Math.sqrt(sum / buffer.length);
}

/**
 * Pasabajos Butterworth de segundo orden, aplicado dos veces: corta 24 dB por octava. Devuelve la
 * señal sin el comienzo, donde el filtro todavía se está acomodando y deformaría los períodos.
 */
function lowpass(buffer: Float32Array, sampleRate: number, cutoff: number): Float32Array {
  if (cutoff >= sampleRate / 2.5) return buffer;
  const w = Math.tan((Math.PI * cutoff) / sampleRate);
  const q = Math.SQRT1_2;
  const norm = 1 / (1 + w / q + w * w);
  const b0 = w * w * norm;
  const b1 = 2 * b0;
  const a1 = 2 * (w * w - 1) * norm;
  const a2 = (1 - w / q + w * w) * norm;
  for (let pass = 0; pass < 2; pass++) {
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < buffer.length; i++) {
      const x = buffer[i]!;
      const y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      buffer[i] = y;
    }
  }
  return buffer.subarray(Math.min(Math.ceil((6 * sampleRate) / cutoff), buffer.length >> 3));
}

export interface PitchOptions {
  minFreq?: number;
  maxFreq?: number;
  /** Qué tan parecido a sí mismo tiene que ser el período para aceptarlo enseguida. */
  threshold?: number;
  /**
   * Si ningún período pasa el umbral, se acepta el mejor mientras no pase de este valor. Sirve
   * con ruido de fondo; sin él, una lectura dudosa no se da.
   */
  fallback?: number;
  /** Corte de agudos: arriba de las notas buscadas solo queda ruido, que corre la lectura. */
  lowpass?: number;
  minRms?: number;
}

export function detectPitch(
  input: Float32Array,
  sampleRate: number,
  {
    minFreq = 50,
    maxFreq = 1400,
    threshold = 0.12,
    fallback = threshold,
    minRms = 0.003,
    lowpass: lowpassCutoff = maxFreq * 1.25,
  }: PitchOptions = {},
): { freq: number; clarity: number } | null {
  // Sin el nivel de continua: algunos micrófonos lo traen y engaña a la diferencia.
  let mean = 0;
  for (const sample of input) mean += sample;
  mean /= input.length;
  const centered = input.map((sample) => sample - mean);
  if (rms(centered) < minRms) return null;
  const buffer = lowpass(centered, sampleRate, lowpassCutoff);

  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
  const tauMax = Math.min(Math.ceil(sampleRate / minFreq), Math.floor(buffer.length / 2));
  if (tauMax <= tauMin + 2) return null;
  const windowSize = buffer.length - tauMax;
  const diff = new Float32Array(tauMax + 1);
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;

  let runningSum = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < windowSize; i++) {
      const delta = buffer[i]! - buffer[i + tau]!;
      sum += delta * delta;
    }
    diff[tau] = sum;
    runningSum += sum;
    cmnd[tau] = runningSum > 0 ? (sum * tau) / runningSum : 1;
  }

  // El primer valle que baja del umbral. Con ruido puede no haber ninguno: entonces vale el
  // primero que quede cerca del más hondo, así no salta a una octava abajo.
  const valleyFrom = (start: number) => {
    let tau = start;
    while (tau + 1 < tauMax && cmnd[tau + 1]! < cmnd[tau]!) tau++;
    return tau;
  };
  let best = -1;
  for (let tau = tauMin; tau < tauMax; tau++) {
    if (cmnd[tau]! < threshold) {
      best = valleyFrom(tau);
      break;
    }
  }
  if (best < 0) {
    let deepest = Infinity;
    for (let tau = tauMin; tau < tauMax; tau++) deepest = Math.min(deepest, cmnd[tau]!);
    if (deepest > fallback) return null;
    const near = deepest + 0.05;
    for (let tau = tauMin; tau < tauMax; tau++) {
      if (cmnd[tau]! <= near) {
        best = valleyFrom(tau);
        break;
      }
    }
  }
  if (best <= tauMin || best >= tauMax - 1) return null;

  // El ajuste fino sale de la diferencia sin normalizar: la normalización corre el valle hacia
  // períodos más cortos, y la nota se leería unos cents alta.
  let tau = best;
  while (tau - 1 > tauMin && diff[tau - 1]! < diff[tau]!) tau--;
  while (tau + 1 < tauMax - 1 && diff[tau + 1]! < diff[tau]!) tau++;
  const a = diff[tau - 1]!;
  const b = diff[tau]!;
  const c = diff[tau + 1]!;
  const denominator = a - 2 * b + c;
  const offset = denominator > 0 ? Math.max(-1, Math.min(1, (0.5 * (a - c)) / denominator)) : 0;
  return { freq: sampleRate / (tau + offset), clarity: 1 - cmnd[best]! };
}

/** Suaviza las lecturas con una mediana y descarta los saltos sueltos. */
export class PitchTracker {
  private values: number[] = [];

  constructor(private readonly size = 5) {}

  push(freq: number): number {
    this.values.push(freq);
    if (this.values.length > this.size) this.values.shift();
    const sorted = [...this.values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)]!;
  }

  reset(): void {
    this.values = [];
  }
}
