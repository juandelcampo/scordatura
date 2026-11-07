/**
 * Cuerda pulsada Karplus-Strong con ajuste fino de la afinación: un filtro pasa-todo
 * compensa la parte fraccionaria del período, así el tono de referencia es confiable.
 */
export function pluck(
  freq: number,
  sampleRate: number,
  seconds = 4,
  { pickPosition = 0.14, seed = 12345 } = {},
): Float32Array {
  const output = new Float32Array(Math.floor(seconds * sampleRate));
  const period = sampleRate / freq;
  const omega = (2 * Math.PI * freq) / sampleRate;

  // Las cuerdas agudas se amortiguan menos por vuelta para que no suenen apagadas.
  const damping = freq < 200 ? 0.5 : Math.max(0.22, 0.5 - ((freq - 200) / 800) * 0.28);
  const filterDelay =
    -Math.atan2(-damping * Math.sin(omega), 1 - damping + damping * Math.cos(omega)) / omega;

  const length = Math.max(2, Math.floor(period - filterDelay - 0.1));
  const fraction = period - filterDelay - length;
  const allpass = (1 - fraction) / (1 + fraction);

  // El decaimiento depende de la nota: los graves sostienen más que los agudos.
  const ringSeconds = Math.max(2.2, 7 - freq / 150);
  const loopGain = Math.pow(0.001, 1 / (freq * ringSeconds));

  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2147483648 - 1;
  };

  // Excitación: ruido suavizado, con un filtro peine que imita dónde ataca la púa.
  const line = new Float32Array(length);
  let smoothed = 0;
  for (let i = 0; i < length; i++) {
    smoothed += 0.55 * (random() - smoothed);
    line[i] = smoothed;
  }
  const pickOffset = Math.max(1, Math.round(pickPosition * length));
  const excitation = Float32Array.from(line);
  for (let i = 0; i < length; i++) {
    line[i] = excitation[i]! - 0.9 * excitation[(i - pickOffset + length) % length]!;
  }

  let index = 0;
  let previous = 0;
  let allpassIn = 0;
  let allpassOut = 0;
  for (let n = 0; n < output.length; n++) {
    const sample = line[index]!;
    output[n] = sample;
    const filtered = (1 - damping) * sample + damping * previous;
    previous = sample;
    const tuned = allpass * filtered + allpassIn - allpass * allpassOut;
    allpassIn = filtered;
    allpassOut = tuned;
    line[index] = tuned * loopGain;
    index = (index + 1) % length;
  }

  let peak = 0;
  for (const sample of output) peak = Math.max(peak, Math.abs(sample));
  if (peak > 0) for (let n = 0; n < output.length; n++) output[n]! /= peak;

  // Fundido final para que el corte del búfer no haga clic.
  const fade = Math.floor(0.08 * sampleRate);
  for (let n = 0; n < fade; n++) output[output.length - 1 - n]! *= n / fade;
  return output;
}
