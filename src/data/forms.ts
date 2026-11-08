// Ejemplos de forma con video. La estructura está simplificada para ver la idea, y los
// minutos los marca cada persona al escucharlos: no vienen cargados porque nadie los verificó de oído.
export interface FormExample {
  artist: string;
  song: string;
  video: string;
  blocks: string[];
  rule: string;
}

const split = (form: string) => form.split(' ');

export const FORM_EXAMPLES: FormExample[] = [
  {
    artist: 'Bob Dylan',
    song: "Blowin' in the Wind",
    video: 'MMFj8uDubsE',
    blocks: split('A A A'),
    rule: 'Estrófica: la misma música tres veces, y todo el peso en la letra.',
  },
  {
    artist: 'Nick Drake',
    song: 'Pink Moon',
    video: 'xqe6TF2y8i4',
    blocks: split('A A A'),
    rule: 'Estrófica y breve: casi no necesita desviarse.',
  },
  {
    artist: 'The Velvet Underground',
    song: 'Heroin',
    video: 'foptT2bsKww',
    blocks: split('A A A A'),
    rule: 'Estrófica, y la forma la hacen el tempo y la intensidad.',
  },
  {
    artist: 'Judy Garland',
    song: 'Over the Rainbow',
    video: 'YdvV-uKef_A',
    blocks: split('A A B A'),
    rule: 'AABA: la forma clásica del cancionero de Broadway.',
  },
  {
    artist: 'The Beatles',
    song: 'Yesterday',
    video: 'NrgmdOz227I',
    blocks: split('A A B A B A'),
    rule: 'AABA con el puente repetido.',
  },
  {
    artist: 'The Police',
    song: 'Every Breath You Take',
    video: 'OMOGaugKpzs',
    blocks: split('A A B A'),
    rule: 'AABA en plena era del estribillo: no hay un estribillo separado.',
  },
  {
    artist: 'Pixies',
    song: 'Where Is My Mind?',
    video: '49FB9hhoO6c',
    blocks: split('A B A B'),
    rule: 'Estrofa y estribillo, con muy poco más.',
  },
  {
    artist: 'Nirvana',
    song: 'Smells Like Teen Spirit',
    video: 'hTWKbfoikeg',
    blocks: split('A B A B C A B'),
    rule: 'Estrofa, estribillo y un solo como tercera parte.',
  },
  {
    artist: 'The Beatles',
    song: 'Hey Jude',
    video: 'mQER0A0ej0M',
    blocks: split('A A B A B A C'),
    rule: 'AABA, y después una coda que dura casi tanto como todo lo anterior.',
  },
  {
    artist: 'Derek and the Dominos',
    song: 'Layla',
    video: 'TngViNw2pOo',
    blocks: split('A B'),
    rule: 'Dos canciones unidas: la segunda parte nunca vuelve a la primera.',
  },
  {
    artist: 'The Beach Boys',
    song: 'Good Vibrations',
    video: 'apBWI6xrbLY',
    blocks: split('A B A B C D'),
    rule: 'Armada por secciones: las últimas partes no se repiten.',
  },
  {
    artist: 'Led Zeppelin',
    song: 'Stairway to Heaven',
    video: 'QkF3oxziUI4',
    blocks: split('A B C D'),
    rule: 'Forma lineal: crece de sección en sección sin volver.',
  },
  {
    artist: 'Queen',
    song: 'Bohemian Rhapsody',
    video: 'fJ9rUzIMcZQ',
    blocks: split('A B C D E F'),
    rule: 'Sin estribillo: una sección distinta atrás de la otra.',
  },
  {
    artist: 'The Beatles',
    song: 'Happiness Is a Warm Gun',
    video: 'vdvnOH060Qg',
    blocks: split('A B C D'),
    rule: 'Cuatro ideas distintas en menos de tres minutos.',
  },
  {
    artist: 'Radiohead',
    song: 'Paranoid Android',
    video: 'Lt8AfIeJOxw',
    blocks: split('A B C A'),
    rule: 'Por secciones, con un regreso parcial al principio.',
  },
];

/** Plantillas del lienzo: etiquetas, intensidad de cada sección y, si hace falta, sus compases. */
export const FORM_TEMPLATES: ReadonlyArray<{
  label: string;
  hint: string;
  labels: string[];
  energies: number[];
  bars?: number[];
}> = [
  {
    label: 'Estrófica · A A A A',
    hint: 'la misma música, otra letra',
    labels: ['A', 'A', 'A', 'A'],
    energies: [2, 2, 3, 3],
  },
  {
    label: 'AABA',
    hint: 'dos veces, un contraste y vuelta',
    labels: ['A', 'A', 'B', 'A'],
    energies: [2, 2, 3, 2],
  },
  {
    label: 'Verso y estribillo',
    hint: 'Intro A B A B C B',
    labels: ['Intro', 'A', 'B', 'A', 'B', 'C', 'B'],
    energies: [1, 2, 3, 2, 3, 2, 4],
  },
  {
    label: 'Bajo / alto / bajo',
    hint: 'verso callado, estribillo fuerte',
    labels: ['A', 'B', 'A', 'B', 'C', 'B'],
    energies: [1, 4, 1, 4, 2, 4],
  },
  {
    label: 'Una idea que crece',
    hint: 'A A A A, cada vez más fuerte',
    labels: ['A', 'A', 'A', 'A'],
    energies: [1, 2, 3, 4],
  },
  {
    label: 'Frases impares · 5 5 3 5',
    hint: 'el oído no sabe cuándo termina',
    labels: ['A', 'A', 'B', 'A'],
    energies: [2, 2, 3, 2],
    bars: [5, 5, 3, 5],
  },
  {
    label: 'Arrancar por el estribillo',
    hint: 'B A B A B',
    labels: ['B', 'A', 'B', 'A', 'B'],
    energies: [4, 2, 4, 2, 4],
  },
];
