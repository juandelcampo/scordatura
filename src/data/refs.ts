// Canciones analizadas. Es el único lugar de la app con nombres de artistas: las herramientas dan el
// consejo sin nombrar a nadie. Las formas están armadas de memoria y van marcadas como aproximadas.
// Los links son búsquedas en YouTube: no hay IDs de videos verificados todavía.
import type { ChordQuality } from '~/core/lienzo/types';

/** Un acorde de la referencia: semitonos desde su tónica, calidad y compases (1 si falta). */
export type RefChord = [number, ChordQuality] | [number, ChordQuality, number];

export interface Reference {
  id: string;
  title: string;
  by: string;
  /** Lo que se busca en YouTube. */
  query: string;
  /** Un video puntual, cuando se verifique. */
  url?: string;
  /** null: es una forma, no una canción con tonalidad fija. */
  tonic: number | null;
  keyName: string;
  meter: string;
  feel: string;
  form: string[];
  progs: { label: string; ch: RefChord[] }[];
  look: string[];
  tags: RefTag[];
}

export const REF_TAGS = [
  'Progresión',
  'Forma',
  'Ritmo armónico',
  'Prestados',
  'Dinámica',
  'Compás',
  'Ritmo',
  'Melodía',
  'Letra',
] as const;

export type RefTag = (typeof REF_TAGS)[number];

export const REFS: Reference[] = [
  {
    id: 'letitbe',
    title: 'Let It Be',
    by: 'The Beatles · 1970',
    query: 'the beatles let it be',
    tonic: 0,
    keyName: 'Do mayor',
    meter: '4/4',
    feel: 'lento',
    form: ['Intro', 'Verso', 'Estribillo', 'Verso', 'Estribillo', 'Solo', 'Verso', 'Estribillo', 'Coda'],
    progs: [
      {
        label: 'Verso',
        ch: [
          [0, 'M'],
          [7, 'M'],
          [9, 'm'],
          [5, 'M'],
          [0, 'M'],
          [7, 'M'],
          [5, 'M'],
          [0, 'M'],
        ],
      },
      {
        label: 'Estribillo',
        ch: [
          [9, 'm'],
          [7, 'M'],
          [5, 'M'],
          [0, 'M'],
        ],
      },
    ],
    look: [
      'El estribillo arranca en el vi: misma familia, otra luz.',
      'I–V–vi–IV: de las vueltas más usadas del pop.',
    ],
    tags: ['Progresión', 'Forma'],
  },
  {
    id: 'standbyme',
    title: 'Stand by Me',
    by: 'Ben E. King · 1961',
    query: 'ben e king stand by me',
    tonic: 9,
    keyName: 'La mayor',
    meter: '4/4',
    feel: 'medio',
    form: ['Intro', 'Verso', 'Estribillo', 'Verso', 'Estribillo', 'Instrumental', 'Estribillo'],
    progs: [
      {
        label: 'Todo el tema',
        ch: [
          [0, 'M', 2],
          [9, 'm', 2],
          [5, 'M'],
          [7, 'M'],
          [0, 'M', 2],
        ],
      },
    ],
    look: [
      'Una sola vuelta para todo el tema, sobre un bajo que se repite.',
      'Acordes de dos compases: la letra respira.',
    ],
    tags: ['Progresión', 'Ritmo armónico'],
  },
  {
    id: 'hitroad',
    title: 'Hit the Road Jack',
    by: 'Ray Charles · 1961',
    query: 'ray charles hit the road jack',
    tonic: 9,
    keyName: 'La menor',
    meter: '4/4',
    feel: 'rápido',
    form: ['Estribillo', 'Verso', 'Estribillo', 'Verso', 'Estribillo'],
    progs: [
      {
        label: 'Todo el tema',
        ch: [
          [0, 'm'],
          [10, 'M'],
          [8, 'M'],
          [7, 'M'],
        ],
      },
    ],
    look: ['Baja por escalones: la menor, sol, fa, mi.', 'Pregunta y respuesta entre la voz y el coro.'],
    tags: ['Progresión'],
  },
  {
    id: 'creep',
    title: 'Creep',
    by: 'Radiohead · 1992',
    query: 'radiohead creep',
    tonic: 7,
    keyName: 'Sol mayor',
    meter: '4/4',
    feel: 'medio',
    form: ['Verso', 'Estribillo', 'Verso', 'Estribillo', 'Puente', 'Estribillo'],
    progs: [
      {
        label: 'Todo el tema',
        ch: [
          [0, 'M'],
          [4, 'M'],
          [5, 'M'],
          [5, 'm'],
        ],
      },
    ],
    look: ['Dos de afuera: el III mayor y el iv prestado.', 'Verso contenido, estribillo a todo volumen.'],
    tags: ['Progresión', 'Prestados', 'Dinámica'],
  },
  {
    id: 'teen',
    title: 'Smells Like Teen Spirit',
    by: 'Nirvana · 1991',
    query: 'nirvana smells like teen spirit',
    tonic: 5,
    keyName: 'Fa menor',
    meter: '4/4',
    feel: 'medio',
    form: [
      'Intro',
      'Verso',
      'Pre',
      'Estribillo',
      'Verso',
      'Pre',
      'Estribillo',
      'Solo',
      'Verso',
      'Pre',
      'Estribillo',
      'Coda',
    ],
    progs: [
      {
        label: 'Todo el tema',
        ch: [
          [0, '5'],
          [5, '5'],
          [3, '5'],
          [8, '5'],
        ],
      },
    ],
    look: ['Los mismos cuatro acordes de quinta en todo el tema.', 'La forma la hace el volumen.'],
    tags: ['Progresión', 'Dinámica', 'Forma'],
  },
  {
    id: 'heyjude',
    title: 'Hey Jude',
    by: 'The Beatles · 1968',
    query: 'the beatles hey jude',
    tonic: 5,
    keyName: 'Fa mayor',
    meter: '4/4',
    feel: 'medio',
    form: ['Verso', 'Verso', 'Puente', 'Verso', 'Puente', 'Verso', 'Coda'],
    progs: [
      {
        label: 'Coda',
        ch: [
          [0, 'M'],
          [10, 'M'],
          [5, 'M'],
          [0, 'M'],
        ],
      },
    ],
    look: [
      'La coda repite I–♭VII–IV–I durante minutos y crece en cada vuelta.',
      'El ♭VII prestado le da aire rockero a lo mayor.',
    ],
    tags: ['Prestados', 'Forma', 'Dinámica'],
  },
  {
    id: 'takefive',
    title: 'Take Five',
    by: 'The Dave Brubeck Quartet · 1959',
    query: 'dave brubeck take five',
    tonic: 3,
    keyName: 'Mi♭ menor',
    meter: '5/4',
    feel: 'medio',
    form: [],
    progs: [
      {
        label: 'Vamp',
        ch: [
          [0, 'm'],
          [7, 'm'],
        ],
      },
    ],
    look: ['Cinco tiempos agrupados 3+2.', 'Dos acordes que se mecen: i y v.'],
    tags: ['Compás', 'Progresión'],
  },
  {
    id: 'money',
    title: 'Money',
    by: 'Pink Floyd · 1973',
    query: 'pink floyd money',
    tonic: 11,
    keyName: 'Si menor',
    meter: '7/4',
    feel: 'medio',
    form: [],
    progs: [
      {
        label: 'Blues de 12 compases',
        ch: [
          [0, 'm', 4],
          [5, 'm', 2],
          [0, 'm', 2],
          [7, 'm'],
          [5, 'm'],
          [0, 'm', 2],
        ],
      },
    ],
    look: ['Blues menor en 7/4: el riff de bajo marca el compás impar.', 'El solo pasa a 4/4 y vuelve.'],
    tags: ['Compás', 'Ritmo armónico'],
  },
  {
    id: 'rainbow',
    title: 'Over the Rainbow',
    by: 'Judy Garland · 1939 · Arlen y Harburg',
    query: 'judy garland over the rainbow',
    tonic: 3,
    keyName: 'Mi♭ mayor',
    meter: '4/4',
    feel: 'lento',
    form: ['A', 'A', 'B', 'A'],
    progs: [],
    look: [
      'AABA de 32 compases: la idea dos veces, un contraste y vuelta.',
      'Arranca con un salto de octava.',
      'El puente usa notas cortas contra las largas del verso.',
    ],
    tags: ['Forma', 'Melodía'],
  },
  {
    id: 'ipanema',
    title: 'Garota de Ipanema',
    by: 'Tom Jobim y Vinicius de Moraes · 1962',
    query: 'garota de ipanema jobim',
    tonic: 5,
    keyName: 'Fa mayor',
    meter: '4/4 · bossa',
    feel: 'medio',
    form: ['A', 'A', 'B', 'A'],
    progs: [
      {
        label: 'A',
        ch: [
          [0, 'M', 2],
          [2, 'M', 2],
          [2, 'm'],
          [1, 'M'],
          [0, 'M', 2],
        ],
      },
      {
        label: 'Puente, comienzo',
        ch: [
          [1, 'M', 2],
          [6, 'M', 2],
        ],
      },
    ],
    look: [
      'El puente sube medio tono y después vuelve.',
      'El ♭II antes de casa es de afuera y suena natural.',
      'Las séptimas no están: el lienzo todavía usa tríadas.',
    ],
    tags: ['Forma', 'Prestados', 'Ritmo armónico'],
  },
  {
    id: 'heroin',
    title: 'Heroin',
    by: 'The Velvet Underground · 1967',
    query: 'velvet underground heroin',
    tonic: 2,
    keyName: 'Re mayor',
    meter: '4/4',
    feel: 'lento → rápido',
    form: [],
    progs: [
      {
        label: 'Todo el tema',
        ch: [
          [0, 'M'],
          [5, 'M'],
        ],
      },
    ],
    look: ['Re y sol durante siete minutos.', 'La forma la hace el tempo: acelera y frena con la letra.'],
    tags: ['Progresión', 'Dinámica'],
  },
  {
    id: 'hallelujah',
    title: 'Hallelujah',
    by: 'Leonard Cohen · 1984',
    query: 'leonard cohen hallelujah',
    tonic: 0,
    keyName: 'Do mayor',
    meter: '12/8',
    feel: 'lento',
    form: ['Verso', 'Estribillo', 'Verso', 'Estribillo', 'Verso', 'Estribillo'],
    progs: [
      {
        label: 'Verso, comienzo',
        ch: [
          [0, 'M'],
          [9, 'm'],
          [0, 'M'],
          [9, 'm'],
          [5, 'M'],
          [7, 'M'],
          [0, 'M'],
          [7, 'M'],
        ],
      },
      {
        label: 'Estribillo',
        ch: [
          [5, 'M'],
          [9, 'm'],
          [5, 'M'],
          [0, 'M'],
          [7, 'M'],
          [0, 'M'],
        ],
      },
    ],
    look: [
      'La letra nombra los acordes justo cuando suenan.',
      'Estrófica: el estribillo es una sola palabra.',
    ],
    tags: ['Progresión', 'Letra'],
  },
  {
    id: 'despacito',
    title: 'Despacito',
    by: 'Luis Fonsi y Daddy Yankee · 2017',
    query: 'luis fonsi despacito',
    tonic: 11,
    keyName: 'Si menor',
    meter: '4/4',
    feel: 'medio',
    form: [],
    progs: [
      {
        label: 'Todo el tema',
        ch: [
          [0, 'm'],
          [8, 'M'],
          [3, 'M'],
          [10, 'M'],
        ],
      },
    ],
    look: ['Un solo ciclo de cuatro acordes en todo el tema.', 'El ritmo se apoya en un tresillo: 3+3+2.'],
    tags: ['Progresión', 'Ritmo'],
  },
  {
    id: 'zamba',
    title: 'La zamba',
    by: 'Forma tradicional del noroeste argentino',
    query: 'zamba folklore argentino',
    tonic: null,
    keyName: '—',
    meter: '6/8',
    feel: 'lento',
    form: ['Intro', 'Estrofa', 'Estrofa', 'Estribillo', 'Interludio', 'Estrofa', 'Estrofa', 'Estribillo'],
    progs: [],
    look: [
      'Primera y segunda: dos vueltas iguales.',
      'El 6/8 se cruza con un 3/4: la hemiola mueve el pulso.',
      'Las estrofas suelen ser coplas octosílabas.',
    ],
    tags: ['Forma', 'Compás', 'Letra'],
  },
];

export const refUrl = (ref: Pick<Reference, 'url' | 'query' | 'title'>) =>
  ref.url || `https://www.youtube.com/results?search_query=${encodeURIComponent(ref.query || ref.title)}`;

/** Las partes de una forma de referencia como etiquetas del lienzo, con su intensidad. */
export function refFormToSections(form: readonly string[]): { labels: string[]; energies: number[] } {
  const letter: Record<string, string> = {
    Verso: 'A',
    Estrofa: 'A',
    Estribillo: 'B',
    Puente: 'C',
    A: 'A',
    B: 'B',
    C: 'C',
  };
  const labels = form.map((t) => letter[t] ?? (t === 'Intro' ? 'Intro' : t === 'Coda' ? 'Coda' : 'D'));
  const energies = form.map((t) =>
    /Estribillo|^B$/.test(t) ? 4 : /Verso|Estrofa|^A$/.test(t) ? 2 : /Solo|Puente|Pre/.test(t) ? 3 : 1,
  );
  return { labels, energies };
}
