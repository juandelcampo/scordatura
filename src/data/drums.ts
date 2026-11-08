// Patrones de partida para la caja de ritmos. Cada letra x es un golpe y cada punto, un silencio.
import { drumConfig, type RhythmConfig } from '~/core/rhythm';

export interface DrumPreset {
  id: string;
  name: string;
  config: RhythmConfig;
}

export const DRUM_PRESETS: DrumPreset[] = [
  {
    id: 'rock',
    name: 'Rock',
    config: drumConfig(112, {
      bombo: 'x.......x.x.....',
      caja: '....x.......x...',
      hihat: 'x.x.x.x.x.x.x.x.',
    }),
  },
  {
    id: 'pista',
    name: 'Cuatro al piso',
    config: drumConfig(122, {
      bombo: 'x...x...x...x...',
      palma: '....x.......x...',
      hihat: '..x...x...x...x.',
    }),
  },
  {
    id: 'funk',
    name: 'Funk',
    config: drumConfig(98, {
      bombo: 'x..x..x...x.....',
      caja: '....x..x.x..x...',
      hihat: 'xxxxxxxxxxxxxxxx',
    }),
  },
  {
    id: 'tresillo',
    name: 'Tresillo',
    config: drumConfig(104, {
      bombo: 'x..x..x.x..x..x.',
      cencerro: 'x.x.x.xx.x.x.xx.',
      caja: '....x.......x...',
    }),
  },
  {
    id: 'bossa',
    name: 'Bossa',
    config: drumConfig(132, {
      bombo: 'x..xx..xx..xx..x',
      tom: 'x..x..x...x..x..',
      hihat: 'x.x.x.x.x.x.x.x.',
    }),
  },
  {
    id: 'lento',
    name: 'Vals',
    config: drumConfig(84, { bombo: 'x...........', caja: '....x...x...', hihat: 'x.x.x.x.x.x.' }),
  },
  {
    id: 'siete',
    name: '7/8',
    config: drumConfig(150, { bombo: 'x...x...x.....', caja: '....x.......x.', hihat: 'x.x.x.x.x.x.x.' }),
  },
  {
    id: 'cinco',
    name: '5/8',
    config: drumConfig(160, { bombo: 'x.....x...', caja: '......x...', hihat: 'x.x.x.x.x.' }),
  },
];

/** El kit de objetos de la casa: las mismas filas, con lo que tengas a mano. */
export const OBJECT_KIT: Record<string, string> = {
  bombo: 'Cartón',
  caja: 'Mesa',
  hihat: 'Llaves',
  palma: 'Palmas',
  tom: 'Tupper',
  cencerro: 'Vaso',
};
