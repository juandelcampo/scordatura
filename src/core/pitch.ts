// Detección de altura (YIN) y suavizado de lecturas.

export function rms(buffer: Float32Array): number {
  let sum = 0;
  for (const sample of buffer) sum += sample * sample;
  return Math.sqrt(sum / buffer.length);
}

export interface PitchOptions {
  minFreq?: number;
  maxFreq?: number;
  threshold?: number;
  minRms?: number;
}

export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
  { minFreq = 50, maxFreq = 1400, threshold = 0.12, minRms = 0.003 }: PitchOptions = {},
): { freq: number; clarity: number } | null {
  if (rms(buffer) < minRms) return null;

  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
  const tauMax = Math.min(Math.floor(sampleRate / minFreq), Math.floor(buffer.length / 2));
  const windowSize = buffer.length - tauMax;
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;

  let runningSum = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    let diff = 0;
    for (let i = 0; i < windowSize; i++) {
      const delta = buffer[i]! - buffer[i + tau]!;
      diff += delta * delta;
    }
    runningSum += diff;
    cmnd[tau] = runningSum > 0 ? (diff * tau) / runningSum : 1;
  }

  let best = -1;
  for (let tau = tauMin; tau < tauMax; tau++) {
    if (cmnd[tau]! < threshold) {
      while (tau + 1 < tauMax && cmnd[tau + 1]! < cmnd[tau]!) tau++;
      best = tau;
      break;
    }
  }
  if (best < 0) return null;

  const a = cmnd[best - 1]!;
  const b = cmnd[best]!;
  const c = cmnd[best + 1]!;
  const denominator = a - 2 * b + c;
  const offset = denominator !== 0 ? (0.5 * (a - c)) / denominator : 0;
  return { freq: sampleRate / (best + offset), clarity: 1 - b };
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
