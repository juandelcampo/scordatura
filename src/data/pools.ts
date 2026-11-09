// De qué sortea cada módulo según el nivel de riesgo.
import type { ModeId } from '~/core/harmony';
import type { DroneConfig } from '~/core/drone';
import { drumConfig, type Meter, type RhythmConfig } from '~/core/rhythm';
import type { Risk } from '~/core/roll';
import {
  FORM_FAMILIES,
  SONG_FORMS,
  formLetters,
  formNames,
  formRule,
  type SectionNames,
} from '~/data/structures';

export interface Constraint {
  label: string;
  rule: string;
}

export interface FormEntry extends Constraint {
  blocks: string[];
  /** Qué es cada sección, cuando la forma viene de la biblioteca. */
  names?: SectionNames;
}

const meter = (groups: number[], denom: 4 | 8 | 16, bpm: number): RhythmConfig => ({
  mode: 'meter',
  groups,
  denom,
  bpm,
});

const FOUR: Meter = { groups: [1, 1, 1, 1], denom: 4 };

export const TUNING_POOL: Record<Risk, string[]> = {
  0: ['estandar', 'dropd', 'dstd', 'eb', 'opend', 'openg', 'dadgad', 'g6', 'cmaj9', 'dminor', 'c6'],
  1: [
    'cgcfce',
    'dgddad',
    'dgdgad',
    'cgcgcd',
    'eadeae',
    'doubledrop',
    'dropc',
    'eminor',
    'cminor',
    'cgcfcf',
    'vihuela',
    'fourths',
  ],
  2: [
    'bebebe',
    'dadead',
    'ggddgg',
    'ggddaa',
    'ostrich',
    'dropb',
    'droned',
    'gabdeg',
    'fsharp',
    'egdged',
    'ggddebeb',
    'ggcsdgg',
    'accggsc',
    'fsfsggaa',
    'tritones',
    'minorthirds',
    'egsegs',
  ],
};

export const RHYTHM_POOL: Record<Risk, RhythmConfig[]> = {
  0: [
    drumConfig(112, { bombo: 'x.......x.x.....', caja: '....x.......x...', hihat: 'x.x.x.x.x.x.x.x.' }),
    drumConfig(122, { bombo: 'x...x...x...x...', palma: '....x.......x...', hihat: '..x...x...x...x.' }),
    meter([1, 1, 1, 1], 4, 58),
    meter([1, 1, 1], 4, 54),
    meter([3, 3], 8, 50),
    meter([1, 1, 1, 1], 4, 156),
    meter([1, 1, 1, 1], 4, 120),
    meter([1, 1, 1], 4, 128),
  ],
  1: [
    drumConfig(104, { bombo: 'x..x..x.x..x..x.', cencerro: 'x.x.x.xx.x.x.xx.', caja: '....x.......x...' }),
    { mode: 'euclid', pulses: 3, steps: 8, rotation: 0, bpm: 56 },
    { mode: 'euclid', pulses: 2, steps: 7, rotation: 0, bpm: 52 },
    { mode: 'euclid', pulses: 5, steps: 8, rotation: 0, bpm: 110 },
    meter([3, 2], 4, 54),
    meter([2, 2, 3], 8, 160),
    meter([3, 3, 2], 8, 152),
    meter([2, 2, 2, 3], 8, 124),
  ],
  2: [
    drumConfig(150, { bombo: 'x...x...x.....', caja: '....x.......x.', hihat: 'x.x.x.x.x.x.x.' }),
    { mode: 'euclid', pulses: 3, steps: 11, rotation: 0, bpm: 48 },
    { mode: 'euclid', pulses: 7, steps: 12, rotation: 2, bpm: 104 },
    { mode: 'poly', a: 2, b: 3, bpm: 44 },
    { mode: 'poly', a: 4, b: 3, bpm: 96 },
    meter([3, 3, 3, 2], 8, 168),
    meter([3, 2, 3, 2, 3], 8, 132),
    { mode: 'mutante', meters: [FOUR, { groups: [1, 1, 1], denom: 4 }], barsEach: 3, bpm: 50 },
    { mode: 'mutante', meters: [FOUR, { groups: [2, 2, 3], denom: 8 }], barsEach: 2, bpm: 164 },
    {
      mode: 'mutante',
      meters: [
        { groups: [2, 3], denom: 8 },
        { groups: [2, 2, 3], denom: 8 },
        { groups: [3, 3, 3, 2], denom: 8 },
      ],
      barsEach: 1,
      bpm: 120,
    },
  ],
};

export const MODE_POOL: Record<Risk, ModeId[]> = {
  0: ['ionian', 'aeolian', 'dorian', 'mixolydian'],
  1: ['aeolian', 'dorian', 'mixolydian', 'lydian', 'phrygian'],
  2: ['lydian', 'dorian', 'phrygian', 'aeolian'],
};

export const MELODY_POOL: Record<Risk, Constraint[]> = {
  0: [
    {
      label: 'Registro de 5 notas, pasos cortos',
      rule: 'Rango de quinta y solo grados vecinos: la línea casi no se mueve.',
    },
    { label: 'Una nota por compás', rule: 'Densidad mínima: el silencio pasa a ser parte de la melodía.' },
    {
      label: 'Arranca en la tónica y no sube de la 3.ª',
      rule: 'Registro grave y estrecho, al borde del recitado.',
    },
    {
      label: 'Frases de 2 compases, una por verso',
      rule: 'Fraseo corto y parejo: entra rápido y deja lugar.',
    },
    {
      label: 'Una nota repetida y un salto final',
      rule: 'Melodía casi hablada: la energía queda en el ritmo.',
    },
    { label: 'Arranca antes del tiempo 1', rule: 'Anacrusa: la frase empuja hacia el tiempo fuerte.' },
    {
      label: 'Repetí cada frase, una vez más alta',
      rule: 'Secuencia: la misma idea transportada sube la temperatura.',
    },
  ],
  1: [
    {
      label: 'Registro grave, arranca en la 9.ª',
      rule: 'La 9.ª es una tensión: la línea empieza suspendida sobre el acorde.',
    },
    {
      label: 'Contorno en ola, sin saltos de más de una 3.ª',
      rule: 'Contorno amplio con pasos chicos: llega lejos sin sobresaltos.',
    },
    {
      label: 'Solo notas que el acorde no tiene',
      rule: 'Melodía de tensiones: nunca reposa sobre una nota del acorde.',
    },
    {
      label: 'Todas las frases empiezan a contratiempo',
      rule: 'Síncopa constante: el acento nunca coincide con el pulso.',
    },
    {
      label: 'Prohibidos los saltos hacia abajo',
      rule: 'Contorno ascendente: la tensión sube sin soltarse.',
    },
    { label: 'Nota tabú: la 3.ª', rule: 'Sin la 3.ª en la voz, la línea no define si es mayor o menor.' },
    {
      label: 'Motivo de 4 notas, desplazado un tiempo',
      rule: 'Desplazamiento rítmico: lo mismo suena distinto sobre otro pulso.',
    },
  ],
  2: [
    {
      label: 'Dos notas a un semitono, y nada más',
      rule: 'Melodía de un solo intervalo: toda la variación pasa al ritmo.',
    },
    { label: 'Prohibida la tónica', rule: 'Una nota tabú: la línea rodea el centro tonal sin tocarlo.' },
    {
      label: 'Motivo de 3 notas, retrogradado a la mitad',
      rule: 'Retrogradación: el motivo se repite de atrás para adelante.',
    },
    {
      label: 'Motivo de 3 notas, invertido cada vuelta',
      rule: 'Inversión: los intervalos se repiten en sentido contrario.',
    },
    {
      label: 'Solo tritonos y semitonos',
      rule: 'Intervalos prohibidos al revés: solo quedan los más tensos.',
    },
    {
      label: 'Convertí el título en notas',
      rule: 'Notas desde texto, como B-A-C-H: las letras dictan la altura.',
    },
    {
      label: 'Prohibida la 5.ª justa',
      rule: 'Intervalo prohibido: desaparece el salto más estable de todos.',
    },
  ],
};

export const LYRIC_POOL: Record<Risk, Constraint[]> = {
  0: [
    {
      label: 'Octosílabos, rima ABAB',
      rule: 'Rima cruzada: cada final queda abierto hasta dos versos después.',
    },
    { label: 'Rima AABB', rule: 'Rima pareada: cierra cada dos versos, y la letra no para.' },
    { label: 'Todo en presente', rule: 'Un solo tiempo verbal: la escena no avanza, se queda.' },
  ],
  1: [
    {
      label: 'Versos largos, de 11 sílabas',
      rule: 'Endecasílabo: el verso largo baja la densidad de cada frase.',
    },
    { label: 'Versos de 6 sílabas', rule: 'Verso corto: cada frase entra y sale en un golpe de voz.' },
    { label: 'Solo segunda persona', rule: 'Hablarle a alguien: la letra pasa a ser un reclamo.' },
    {
      label: 'Solo verbos de movimiento',
      rule: 'Restricción de vocabulario: la letra no puede quedarse quieta.',
    },
  ],
  2: [
    { label: 'Sin rimar los finales', rule: 'Verso blanco: sin la rima, la frase no pide cierre.' },
    {
      label: 'Cortá y mezclá tus propias frases',
      rule: 'Cut-up: el orden lo pone el azar, y vos rescatás lo que sorprende.',
    },
    {
      label: 'Una sola vocal en todo un verso',
      rule: 'Lipograma: la restricción obliga a buscar palabras que nunca usarías.',
    },
    {
      label: 'Un color distinto por estrofa',
      rule: 'Restricción de imagen: cada estrofa queda atada a una sola pista visual.',
    },
  ],
};

export const IMAGE_POOL = {
  objects: [
    'una llave',
    'un cable pelado',
    'una sábana mojada',
    'un ventilador roto',
    'una radio',
    'un espejo con grietas',
    'una estufa',
    'una ventana empañada',
    'un colectivo',
    'una fruta pasada',
    'un zapato',
    'una foto',
  ],
  places: [
    'un muelle vacío',
    'una ruta sin carteles',
    'una ciudad a la siesta',
    'la cocina a las cinco',
    'un andén',
    'una terraza',
    'un pasillo de hospital',
    'la orilla',
    'un galpón',
    'un kiosco cerrado',
  ],
  verbs: [
    'apagar',
    'correr',
    'esperar',
    'quemar',
    'mojar',
    'cerrar',
    'perder',
    'volver',
    'barrer',
    'romper',
    'cruzar',
    'colgar',
  ],
  titles: [
    'La última parada',
    'Agua para nadie',
    'Después de la siesta',
    'Lo que queda en la mesa',
    'Un cable pelado',
    'Domingo sin luz',
    'Antes del colectivo',
    'Fruta pasada',
    'Radio entre estaciones',
    'La otra orilla',
  ],
  forbidden: ['amor', 'noche', 'corazón', 'luna', 'alma', 'sueño', 'dolor', 'cielo', 'mar', 'tiempo'],
  restrictions: [
    'Solo segunda persona',
    'Todo en presente',
    'Un color por estrofa',
    'Una sola vocal por verso',
    'Ningún adjetivo',
    'Cada verso empieza con la misma palabra',
  ],
};

const BASE_FORMS: Record<Risk, FormEntry[]> = {
  0: [
    {
      label: 'A A A A',
      blocks: ['A', 'A', 'A', 'A'],
      rule: 'Forma estrófica: se repite la misma música y lo que cambia es la letra.',
    },
    {
      label: 'A B A B',
      blocks: ['A', 'B', 'A', 'B'],
      rule: 'Estrofa y estribillo, sin desvíos ni introducción.',
    },
    {
      label: 'A A B A',
      blocks: ['A', 'A', 'B', 'A'],
      rule: 'Forma AABA: el puente es lo único que se sale de la idea central.',
    },
  ],
  1: [
    {
      label: 'A A B A A',
      blocks: ['A', 'A', 'B', 'A', 'A'],
      rule: 'Un solo desvío en el medio, sin estribillo claro.',
    },
    {
      label: 'A A A B',
      blocks: ['A', 'A', 'A', 'B'],
      rule: 'Forma con coda: lo nuevo aparece recién al final, y no vuelve.',
    },
    {
      label: 'B A B A B',
      blocks: ['B', 'A', 'B', 'A', 'B'],
      rule: 'El estribillo va primero: la canción arranca por su mejor parte.',
    },
    {
      label: 'A B A B C',
      blocks: ['A', 'B', 'A', 'B', 'C'],
      rule: 'Cierra con una parte nueva que nunca vuelve.',
    },
    {
      label: 'A A B C A',
      blocks: ['A', 'A', 'B', 'C', 'A'],
      rule: 'El puente se abre en dos partes distintas antes de volver.',
    },
    {
      label: 'A B A C A',
      blocks: ['A', 'B', 'A', 'C', 'A'],
      rule: 'Rondó: la idea principal vuelve después de cada desvío.',
    },
  ],
  2: [
    { label: 'A', blocks: ['A'], rule: 'Monoforma: una sola idea que crece o se desarma despacio.' },
    {
      label: 'A B C D',
      blocks: ['A', 'B', 'C', 'D'],
      rule: 'Forma lineal: nunca repite una sección, siempre va para adelante.',
    },
    {
      label: 'A B A C A D',
      blocks: ['A', 'B', 'A', 'C', 'A', 'D'],
      rule: 'Rondó que nunca cierra: termina en la parte nueva.',
    },
    {
      label: 'D C B A',
      blocks: ['D', 'C', 'B', 'A'],
      rule: 'Forma invertida: arranca por el clímax y termina por la idea más simple.',
    },
  ],
};

/** Las formas de la biblioteca entran al sorteo según el riesgo de su familia. */
const libraryForms = (risk: Risk): FormEntry[] =>
  SONG_FORMS.filter(
    (form) => FORM_FAMILIES.find((family) => family.value === form.family)?.risk === risk,
  ).map((form) => {
    const blocks = formLetters(form.sections);
    return { label: blocks.join(' '), blocks, names: formNames(form.sections), rule: formRule(form) };
  });

export const FORM_POOL: Record<Risk, FormEntry[]> = {
  0: [...BASE_FORMS[0], ...libraryForms(0)],
  1: [...BASE_FORMS[1], ...libraryForms(1)],
  2: [...BASE_FORMS[2], ...libraryForms(2)],
};

export const DRONE_POOL: Record<Risk, Array<Omit<DroneConfig, 'root'>>> = {
  0: [
    { stack: 'octava', timbre: 'calido', brightness: 0.3, motion: 0.15, detune: 4 },
    { stack: 'quinta', timbre: 'calido', brightness: 0.35, motion: 0.2, detune: 5 },
    { stack: 'tanpura', timbre: 'organo', brightness: 0.45, motion: 0.2, detune: 3 },
  ],
  1: [
    { stack: 'sus2', timbre: 'organo', brightness: 0.45, motion: 0.35, detune: 7 },
    { stack: 'sus4', timbre: 'calido', brightness: 0.4, motion: 0.4, detune: 8 },
    { stack: 'menor', timbre: 'organo', brightness: 0.4, motion: 0.3, detune: 6 },
    { stack: 'mayor', timbre: 'calido', brightness: 0.5, motion: 0.3, detune: 6 },
  ],
  2: [
    { stack: 'tritono', timbre: 'crudo', brightness: 0.45, motion: 0.6, detune: 14 },
    { stack: 'racimo', timbre: 'crudo', brightness: 0.35, motion: 0.7, detune: 18 },
    { stack: 'menor9', timbre: 'crudo', brightness: 0.55, motion: 0.5, detune: 12 },
  ],
};
