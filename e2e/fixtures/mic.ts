import { join } from 'node:path';
import { FIXTURES } from './setup';

/** Opciones de Chrome para que un archivo de audio haga de micrófono. */
export const micWith = (file: string) => ({
  launchOptions: {
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${join(FIXTURES, file)}`,
    ],
  },
});
