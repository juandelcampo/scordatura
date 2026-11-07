/**
 * Piano sintetizado por suma de parciales. Las cuerdas reales son rígidas, así que sus armónicos
 * quedan apenas más agudos (inarmonicidad): por eso suena a piano y no a órgano. La fundamental
 * se compensa para que la nota quede afinada.
 */
export function pianoTone(freq: number, sampleRate: number, seconds = 4): Float32Array {
  const length = Math.floor(seconds * sampleRate);
  const output = new Float32Array(length);
  // Las notas agudas tienen cuerdas más cortas y rígidas, y se apagan antes.
  const stiffness = 0.00005 + 0.00035 * Math.min(1, freq / 2000);
  const baseDecay = Math.max(0.7, 2.6 - freq / 500);
  const fundamental = freq / Math.sqrt(1 + stiffness);

  for (let partial = 1; partial <= 14; partial++) {
    const partialFreq = fundamental * partial * Math.sqrt(1 + stiffness * partial * partial);
    if (partialFreq >= sampleRate * 0.45) break;
    // El martillo excita más los armónicos bajos, y las notas graves tienen más armónicos.
    const amplitude =
      Math.pow(partial, -1.35) *
      (partial % 7 === 0 ? 0.4 : 1) *
      (freq < 300 ? 1 : Math.pow(300 / freq, (partial - 1) * 0.18));
    const decay = baseDecay / (1 + (partial - 1) * 0.28);
    const step = (2 * Math.PI * partialFreq) / sampleRate;
    // Rotación incremental: mucho más rápida que llamar a seno en cada muestra.
    const stepCos = Math.cos(step);
    const stepSin = Math.sin(step);
    const fall = Math.exp(-1 / (decay * sampleRate));
    let re = 0;
    let im = 1;
    let gain = amplitude;
    for (let n = 0; n < length; n++) {
      output[n]! += re * gain;
      const nextRe = re * stepCos + im * stepSin;
      im = im * stepCos - re * stepSin;
      re = nextRe;
      gain *= fall;
      if (gain < 0.00002) break;
    }
  }

  let peak = 0;
  for (const sample of output) peak = Math.max(peak, Math.abs(sample));
  if (peak > 0) for (let n = 0; n < length; n++) output[n]! /= peak;

  // Ataque muy corto del martillo, y fundido final para que el corte no haga clic.
  const attack = Math.floor(0.002 * sampleRate);
  for (let n = 0; n < attack; n++) output[n]! *= n / attack;
  const fade = Math.floor(0.08 * sampleRate);
  for (let n = 0; n < fade; n++) output[length - 1 - n]! *= n / fade;
  return output;
}
