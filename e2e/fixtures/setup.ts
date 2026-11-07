// Genera los audios que hacen de micrófono simulado en las pruebas.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES = dirname(fileURLToPath(import.meta.url));
export const C2_HZ = 65.40639;

function writeTone(path: string, freq: number, seconds = 4, sampleRate = 48000) {
  const samples = seconds * sampleRate;
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const phase = (2 * Math.PI * freq * i) / sampleRate;
    const value = 0.3 * Math.sin(phase) + 0.2 * Math.sin(2 * phase) + 0.08 * Math.sin(3 * phase);
    data.writeInt16LE(Math.round(value * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([header, data]));
}

export default function setup() {
  writeTone(join(FIXTURES, 'c2-exact.wav'), C2_HZ);
  writeTone(join(FIXTURES, 'c2-sharp20.wav'), C2_HZ * Math.pow(2, 20 / 1200));
  writeTone(join(FIXTURES, 'a3-exact.wav'), 220);
}
