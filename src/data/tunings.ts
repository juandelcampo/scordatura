// Catálogo de afinaciones. Las notas van de la 6.ª cuerda (grave) a la 1.ª (aguda).
// Es solo datos: el acorde al aire, los intervalos y los avisos se calculan en core/.

export interface HeardItem {
  artist: string;
  song?: string;
  /** ID de YouTube, comprobado con `npm run check:videos`. */
  video?: string;
  /** Traste del capo en esa grabación. */
  capo?: number;
  /** 'fan': lista armada de oído por fans. 'duda': las fuentes se contradicen. */
  conf?: 'fan' | 'duda';
  who?: string;
}

export interface Tuning {
  id: string;
  name: string;
  group: string;
  notes: string[];
  desc: string;
  /** 'est': la fuente da las notas sin octava y la octava es una estimación. */
  octaves?: 'est';
  /** Pensada para encordar a medida: con cuerdas comunes puede no ser viable. */
  restring?: boolean;
  /** Dónde se escuchó. Es un dato anecdótico y opcional. */
  heard?: HeardItem[];
}

export interface TuningGroup {
  id: string;
  name: string;
}

export interface Source {
  label: string;
  url: string;
}

export const GROUPS: TuningGroup[] = [
  { id: 'estandar', name: 'Estándar y transpuestas' },
  { id: 'drop', name: 'Drop' },
  { id: 'mayores', name: 'Abiertas mayores' },
  { id: 'menores', name: 'Abiertas menores' },
  { id: 'extendidas', name: 'Abiertas con séptima o sexta' },
  { id: 'modales', name: 'Modales y suspendidas' },
  { id: 'estrechas', name: 'Rango estrecho y unísonos' },
  { id: 'regulares', name: 'Regulares' },
  { id: 'zumbido', name: 'Zumbido' },
];

export const STANDARD: string[] = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
const DRAKE = 'Nick Drake';
const SY = 'Sonic Youth';

export const TUNINGS: Tuning[] = [
  // Estándar y transpuestas
  {
    id: 'estandar',
    name: 'Estándar',
    group: 'estandar',
    notes: STANDARD,
    desc: 'El punto de partida: cuartas justas y una tercera mayor entre la 3.ª y la 2.ª. Ese salto es lo que obliga a cambiar las formas de escala al cruzar esas cuerdas.',
    heard: [
      { artist: DRAKE, song: 'River Man', capo: 3, conf: 'fan', video: 'fv49xKB8xUI' },
      { artist: DRAKE, song: 'Know', conf: 'fan', video: 'Dq8jgE2RYaU' },
    ],
  },
  {
    id: 'eb',
    name: 'Medio tono abajo',
    group: 'estandar',
    notes: ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'],
    desc: 'Las mismas formas que en estándar, con menos tensión. Las cuerdas se doblan más fácil y el color se oscurece apenas.',
    heard: [
      { artist: 'Jimi Hendrix', song: 'Little Wing', video: '35luFxHO5E0' },
      { artist: 'Stevie Ray Vaughan', song: 'Pride and Joy', video: 'I3MTGhRC82s' },
    ],
  },
  {
    id: 'dstd',
    name: 'Re estándar',
    group: 'estandar',
    notes: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'],
    desc: 'Todo un tono abajo. Las cuerdas quedan más blandas y el sonido gana peso sin cambiar ninguna forma.',
    heard: [{ artist: 'Nirvana', song: 'Come as You Are', video: 'vabnZ9-ex7o' }],
  },
  {
    id: 'csstd',
    name: 'Do# estándar',
    group: 'estandar',
    notes: ['C#2', 'F#2', 'B2', 'E3', 'G#3', 'C#4'],
    desc: 'Un tono y medio abajo. Con cuerdas comunes ya se siente floja: conviene subir el calibre.',
  },
  {
    id: 'baritono',
    name: 'Barítono',
    group: 'estandar',
    notes: ['B1', 'E2', 'A2', 'D3', 'F#3', 'B3'],
    restring: true,
    desc: 'Una cuarta abajo de la estándar: las mismas formas suenan en otro registro. Lo ideal es un mástil más largo.',
  },
  {
    id: 'vihuela',
    name: 'Vihuela',
    group: 'estandar',
    notes: ['E2', 'A2', 'D3', 'F#3', 'B3', 'E4'],
    desc: 'Solo baja medio tono la 3.ª y mueve la tercera mayor al centro del mástil, como en la vihuela y el laúd renacentista.',
  },
  {
    id: 'nashville',
    name: 'Nashville',
    group: 'estandar',
    notes: ['E3', 'A3', 'D4', 'G4', 'B3', 'E4'],
    restring: true,
    desc: 'Las cuatro graves suenan una octava arriba, con las cuerdas finas de un juego de 12. Queda un brillo de campana, sin ningún bajo.',
    heard: [{ artist: 'The Rolling Stones', song: 'Wild Horses', video: 'nY_GgPi5eCM' }],
  },

  // Drop
  {
    id: 'dropd',
    name: 'Drop D',
    group: 'drop',
    notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    desc: 'Solo baja la 6.ª. Con un dedo tenés un power chord, y aparece un bordón grave en Re.',
    heard: [
      { artist: 'Foo Fighters', song: 'Everlong', video: 'eBG7P-K-r1Y' },
      { artist: 'The Beatles', song: 'Dear Prudence', video: 'I4xw_Dx0pIg' },
    ],
  },
  {
    id: 'doubledrop',
    name: 'Doble Drop D',
    group: 'drop',
    notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'D4'],
    desc: 'Las dos Mi bajan a Re: el bordón queda en las dos puntas del acorde.',
    heard: [{ artist: 'Neil Young', song: 'Cinnamon Girl', video: 'KNp6ENVVZvc' }],
  },
  {
    id: 'dropdb',
    name: 'Drop Db',
    group: 'drop',
    notes: ['Db2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'],
    desc: 'Drop D medio tono abajo: el mismo power chord a un dedo, con cuerdas algo más blandas.',
  },
  {
    id: 'dropc',
    name: 'Drop C',
    group: 'drop',
    notes: ['C2', 'G2', 'C3', 'F3', 'A3', 'D4'],
    desc: 'Drop D un tono más abajo. Conviene un encordado más grueso.',
    heard: [{ artist: 'System of a Down', song: 'Chop Suey!', video: 'CSvFpBOe8eY' }],
  },
  {
    id: 'dropb',
    name: 'Drop B',
    group: 'drop',
    notes: ['B1', 'F#2', 'B2', 'E3', 'G#3', 'C#4'],
    desc: 'Drop D bajada una tercera menor, con la 6.ª en un Si muy grave. Pide cuerdas gruesas.',
    heard: [{ artist: 'Slipknot', song: 'Duality', video: '6fVE8kSM43I' }],
  },
  {
    id: 'dropa',
    name: 'Drop A',
    group: 'drop',
    notes: ['A1', 'E2', 'A2', 'D3', 'F#3', 'B3'],
    restring: true,
    desc: 'Barítono con la 6.ª bajada un tono: un La grave que casi se siente más de lo que se oye.',
  },

  // Abiertas mayores
  {
    id: 'openg',
    name: 'Sol abierta',
    group: 'mayores',
    notes: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'],
    desc: 'Al aire suena un Sol mayor. Con una cejilla recta tocás cualquier acorde mayor. Es la clásica de slide y, en Hawái, el taro patch del slack-key.',
    heard: [
      { artist: 'The Rolling Stones', song: 'Brown Sugar', who: 'sin la 6.ª cuerda', video: 'Bar7SzNLnY0' },
    ],
  },
  {
    id: 'opend',
    name: 'Re abierta',
    group: 'mayores',
    notes: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'],
    desc: 'Al aire suena un Re mayor, con la tercera en el medio. Moviendo solo esa cuerda se pasa de mayor a menor.',
    heard: [
      { artist: 'Elmore James', song: 'Dust My Broom', video: '5jcGY7NbaQw' },
      { artist: 'Joni Mitchell', song: 'Both Sides, Now', video: 'yXr2EFomFkU' },
    ],
  },
  {
    id: 'opene',
    name: 'Mi abierta',
    group: 'mayores',
    notes: ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'],
    desc: 'Re abierta un tono más arriba: más tensa y brillante, muy usada con slide.',
    heard: [{ artist: 'The Allman Brothers Band', song: 'Statesboro Blues', video: 'w1V5XNLLwFU' }],
  },
  {
    id: 'opena',
    name: 'La abierta',
    group: 'mayores',
    notes: ['E2', 'A2', 'E3', 'A3', 'C#4', 'E4'],
    desc: 'Sol abierta un tono más arriba, con el mismo juego de intervalos.',
    heard: [{ artist: 'Led Zeppelin', song: 'In My Time of Dying', video: 'scpqae3P7Dg' }],
  },
  {
    id: 'openc',
    name: 'Do abierta',
    group: 'mayores',
    notes: ['C2', 'G2', 'C3', 'G3', 'C4', 'E4'],
    desc: 'Muy amplia y resonante: el acorde al aire ocupa más de dos octavas.',
    heard: [
      { artist: 'Led Zeppelin', song: 'Bron-Yr-Aur', video: 'iVYDUB6UF_Y' },
      {
        artist: 'Soundgarden',
        song: 'Burden in My Hand',
        conf: 'duda',
        who: 'varias tabs dicen CGCGGE',
        video: 'XmIqIVxUuKs',
      },
      {
        artist: 'Soundgarden',
        song: 'Pretty Noose',
        conf: 'duda',
        who: 'varias tabs dicen CGCGGE',
        video: 'f8nkHrv_4Mg',
      },
    ],
  },
  {
    id: 'openf',
    name: 'Fa abierta',
    group: 'mayores',
    notes: ['C2', 'F2', 'C3', 'F3', 'A3', 'C4'],
    desc: 'Bajo en Do y raíz en la 5.ª: el Fa queda apoyado sobre su quinta, en un registro grave y redondo.',
  },
  {
    id: 'openb',
    name: 'Si abierta',
    group: 'mayores',
    notes: ['B1', 'F#2', 'B2', 'F#3', 'B3', 'D#4'],
    desc: 'Mi abierta una cuarta más abajo. Muy grave para una guitarra común: conviene encordar más grueso.',
  },
  {
    id: 'dobro',
    name: 'Sol aguda',
    group: 'mayores',
    notes: ['G2', 'B2', 'D3', 'G3', 'B3', 'D4'],
    restring: true,
    desc: 'El Sol mayor repetido en dos octavas, sin bajos en Re. Es la afinación tradicional del dobro.',
  },

  // Abiertas menores
  {
    id: 'dminor',
    name: 'Re menor abierta',
    group: 'menores',
    notes: ['D2', 'A2', 'D3', 'F3', 'A3', 'D4'],
    desc: 'También llamada cross-note. Al aire suena un Re menor, crudo y dramático.',
    heard: [{ artist: 'Skip James', song: "Hard Time Killin' Floor Blues", video: '0cyGmLF8FpE' }],
  },
  {
    id: 'eminor',
    name: 'Mi menor abierta',
    group: 'menores',
    notes: ['E2', 'B2', 'E3', 'G3', 'B3', 'E4'],
    desc: 'Cambia solo la 5.ª y la 4.ª respecto de la estándar, y todo queda sobre un Mi menor oscuro.',
  },
  {
    id: 'gminor',
    name: 'Sol menor abierta',
    group: 'menores',
    notes: ['D2', 'G2', 'D3', 'G3', 'Bb3', 'D4'],
    desc: 'Sol abierta con la tercera medio tono abajo. Con un dedo en el traste 1 de la 2.ª cuerda vuelve a ser mayor.',
  },
  {
    id: 'aminor',
    name: 'La menor abierta',
    group: 'menores',
    notes: ['E2', 'A2', 'E3', 'A3', 'C4', 'E4'],
    desc: 'Toda en La y Mi, con un solo Do arriba que le da el color menor.',
  },
  {
    id: 'cminor',
    name: 'Do menor abierta',
    group: 'menores',
    notes: ['C2', 'G2', 'C3', 'G3', 'C4', 'Eb4'],
    desc: 'Do abierta con la 1.ª medio tono abajo: una tercera menor en la cima de un acorde muy grave.',
  },

  // Abiertas con séptima o sexta
  {
    id: 'c6',
    name: 'Do6',
    group: 'extendidas',
    notes: ['C2', 'A2', 'C3', 'G3', 'C4', 'E4'],
    desc: 'Do abierta con un La en la 5.ª cuerda: el acorde al aire gana una sexta y un aire ambiguo.',
    heard: [{ artist: 'Led Zeppelin', song: 'Friends', video: 'fk5lfjNH4cE' }],
  },
  {
    id: 'g6',
    name: 'Sol6',
    group: 'extendidas',
    notes: ['D2', 'G2', 'D3', 'G3', 'B3', 'E4'],
    desc: 'Sol abierta con la 1.ª sin bajar: las cuatro agudas quedan como en la estándar y el Mi suma la sexta.',
  },
  {
    id: 'gmaj7',
    name: 'Sol maj7',
    group: 'extendidas',
    notes: ['D2', 'G2', 'D3', 'F#3', 'B3', 'D4'],
    desc: 'Sol con séptima mayor, cálido y suspendido. En el slack-key hawaiano es la familia de las wahine.',
  },
  {
    id: 'dmaj7',
    name: 'Re maj7',
    group: 'extendidas',
    notes: ['D2', 'A2', 'D3', 'F#3', 'A3', 'C#4'],
    desc: 'Re abierta con la 1.ª bajada a la séptima mayor: suave y sin bordes.',
  },
  {
    id: 'cmaj7',
    name: 'Do maj7',
    group: 'extendidas',
    notes: ['C2', 'G2', 'E3', 'G3', 'B3', 'E4'],
    desc: 'Do mayor séptima repartido en voces abiertas, con la tercera bien separada del bajo.',
  },
  {
    id: 'cmaj9',
    name: 'CGDGBE',
    group: 'extendidas',
    notes: ['C2', 'G2', 'D3', 'G3', 'B3', 'E4'],
    desc: 'Las tres agudas quedan como en la estándar y abajo se abren quintas: un Do maj9 entero al aire.',
  },
  {
    id: 'em7',
    name: 'Mi menor 7',
    group: 'extendidas',
    notes: ['E2', 'B2', 'D3', 'G3', 'B3', 'E4'],
    desc: 'Un solo cambio respecto de la estándar: la 5.ª sube a Si. Solo eso ya alcanza para que todo suene a Em7.',
  },

  // Modales y suspendidas
  {
    id: 'dadgad',
    name: 'DADGAD',
    group: 'modales',
    notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'],
    desc: 'Re suspendido, sin tercera: no es mayor ni menor, y la melodía decide. Muy usada en folk celta.',
    heard: [
      { artist: 'Led Zeppelin', song: 'Kashmir', video: 'ww9484EM2OQ' },
      { artist: 'Davey Graham', song: 'She Moved Through the Fair', video: 'PrWGwdsYifw' },
    ],
  },
  {
    id: 'dadead',
    name: 'DADEAD',
    group: 'modales',
    notes: ['D2', 'A2', 'D3', 'E3', 'A3', 'D4'],
    desc: 'Re con novena en lugar de cuarta: Re y Mi quedan pegados en el centro y frotan.',
  },
  {
    id: 'dgdgcd',
    name: 'DGDGCD',
    group: 'modales',
    notes: ['D2', 'G2', 'D3', 'G3', 'C4', 'D4'],
    desc: 'Sol suspendido: como Sol abierta con la tercera subida a la cuarta. Pide resolver todo el tiempo.',
  },
  {
    id: 'cgcgcd',
    name: 'CGCGCD',
    group: 'modales',
    notes: ['C2', 'G2', 'C3', 'G3', 'C4', 'D4'],
    desc: 'Do modal: quintas y octavas amplias, con un Re arriba que frota contra el Do.',
  },
  {
    id: 'eadeae',
    name: 'EADEAE',
    group: 'modales',
    notes: ['E2', 'A2', 'D3', 'E3', 'A3', 'E4'],
    desc: 'La suspendido con Mi repetido en tres octavas. Las graves quedan como en la estándar y las agudas se abren.',
  },
  {
    id: 'cgcfce',
    name: 'CGCFCE',
    group: 'modales',
    notes: ['C2', 'G2', 'C3', 'F3', 'C4', 'E4'],
    desc: 'Do con Fa y Mi juntos: dos notas a medio tono que no se resuelven. Con capo en el traste 2 da las mismas notas que DADGDF#, sin tensar de más.',
    heard: [
      { artist: DRAKE, song: 'Which Will', conf: 'fan', video: 'AZsxbWHlXyY' },
      { artist: DRAKE, song: 'Hazey Jane II', conf: 'fan', video: 'lCaDp1gb6D4' },
      { artist: DRAKE, song: 'Free Ride', conf: 'fan', video: 'UpzvQLdpjDA' },
      {
        artist: DRAKE,
        song: 'Hanging on a Star',
        conf: 'fan',
        who: 'quizás medio tono abajo',
        video: 'ikocOSQW_9M',
      },
    ],
  },
  {
    id: 'cgcfcf',
    name: 'CGCFCF',
    group: 'modales',
    notes: ['C2', 'G2', 'C3', 'F3', 'C4', 'F4'],
    desc: 'CGCFCE con la 1.ª medio tono arriba: desaparece la tercera y queda un acorde suspendido, sin tensión de semitono.',
    heard: [{ artist: DRAKE, song: 'From the Morning', conf: 'fan', video: 'xPe5ZQx0OpQ' }],
  },
  {
    id: 'dadgdfs',
    name: 'DADGDF#',
    group: 'modales',
    notes: ['D2', 'A2', 'D3', 'G3', 'D4', 'F#4'],
    desc: 'CGCFCE un tono más arriba. La 2.ª y la 1.ª quedan muy tensas: es más seguro CGCFCE con capo en el traste 2.',
    heard: [
      { artist: DRAKE, song: 'Northern Sky', capo: 1, conf: 'fan', video: 'qFFyFcSQiI4' },
      { artist: DRAKE, song: 'Cello Song', capo: 1, conf: 'fan', video: 'h4y8WGOJu_c' },
      { artist: DRAKE, song: 'Time Has Told Me', capo: 3, conf: 'fan', video: 'G8SmkwS82u4' },
      {
        artist: DRAKE,
        song: 'Pink Moon',
        capo: 1,
        conf: 'duda',
        who: 'la afinación del tema es debatida',
        video: 'xqe6TF2y8i4',
      },
    ],
  },
  {
    id: 'dadgdg',
    name: 'DADGDG',
    group: 'modales',
    notes: ['D2', 'A2', 'D3', 'G3', 'D4', 'G4'],
    desc: 'Como DADGDF# con la 1.ª medio tono más alta. Esa cuerda queda al límite: es más seguro CGCFCF con capo en el traste 2.',
    heard: [{ artist: DRAKE, song: 'Fly', capo: 1, conf: 'fan', video: 'SFr9WYRiwZc' }],
  },
  {
    id: 'dadgafs',
    name: 'DADGAF#',
    group: 'modales',
    notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'F#4'],
    desc: 'Muy cercana a DADGDF#: cambia solo la 2.ª cuerda, y por eso cuesta distinguirlas de oído.',
    heard: [
      {
        artist: DRAKE,
        song: 'Place to Be',
        capo: 3,
        conf: 'duda',
        who: 'otras fuentes dicen CGCFCE',
        video: 'JQFWzexfCh0',
      },
    ],
  },
  {
    id: 'dgddad',
    name: 'DGDDAD',
    group: 'modales',
    notes: ['D2', 'G2', 'D3', 'D3', 'A3', 'D4'],
    desc: 'Con dos cuerdas al unísono en Re, que baten entre sí y dan un zumbido grave.',
    heard: [
      { artist: DRAKE, song: 'Road', capo: 3, conf: 'fan', video: 'oQJmaKBcMzo' },
      { artist: DRAKE, song: 'Things Behind the Sun', capo: 6, conf: 'fan', video: 'j14PgxHghjQ' },
      { artist: DRAKE, song: 'Fruit Tree', capo: 2, conf: 'fan', video: 'lBBeyHk8Gmw' },
    ],
  },
  {
    id: 'dgdgad',
    name: 'DGDGAD',
    group: 'modales',
    notes: ['D2', 'G2', 'D3', 'G3', 'A3', 'D4'],
    desc: 'Pariente de DADGAD con la 5.ª en Sol: más ambigua todavía sobre cuál es la nota base.',
    heard: [
      { artist: DRAKE, song: 'Joey', capo: 5, conf: 'fan', video: 'G3gs78cIz3E' },
      { artist: DRAKE, song: 'Clothes of Sand', capo: 3, conf: 'fan', video: 'oE6PfDsYVjA' },
    ],
  },
  {
    id: 'cgdgcd',
    name: 'CGDGCD',
    group: 'modales',
    notes: ['C2', 'G2', 'D3', 'G3', 'C4', 'D4'],
    octaves: 'est',
    desc: 'Do con novena, grave y abierto, sin tercera. Las cuerdas sueltas se apilan en quintas y cuartas.',
    heard: [{ artist: SY, song: 'Karen Revisited', conf: 'fan', video: 'FXp8c1yYzy4' }],
  },
  {
    id: 'bebebe',
    name: 'BEBEBE',
    group: 'modales',
    notes: ['B1', 'E2', 'B2', 'E3', 'B3', 'E4'],
    desc: 'Solo dos notas alternadas en tres octavas, muy grave y desnuda. Cualquier dedo que se agregue cambia todo el color.',
    heard: [{ artist: DRAKE, who: 'citada para su etapa final, sin un tema confirmado' }],
  },

  // Rango estrecho y unísonos
  {
    id: 'ggddgg',
    name: 'GGDDGG',
    group: 'estrechas',
    notes: ['G2', 'G2', 'D3', 'D3', 'G3', 'G3'],
    octaves: 'est',
    restring: true,
    desc: 'Tres pares al unísono en rango estrecho: cada par bate y vibra como una sola cuerda gigante.',
    heard: [
      { artist: SY, song: 'Teen Age Riot', who: 'Lee Ranaldo', conf: 'fan', video: '10rLJjBLQZ8' },
      { artist: SY, song: 'Tunic', who: 'Lee Ranaldo', conf: 'fan', video: 'reSOp1domrU' },
    ],
  },
  {
    id: 'ggddaa',
    name: 'GGDDAA',
    group: 'estrechas',
    notes: ['G2', 'G2', 'D3', 'D3', 'A3', 'A3'],
    octaves: 'est',
    restring: true,
    desc: 'Pares al unísono apilados en quintas: amplia, abierta y sin tercera.',
  },
  {
    id: 'ggccff',
    name: 'GGCCFF',
    group: 'estrechas',
    notes: ['G2', 'G2', 'C3', 'C3', 'F3', 'F3'],
    octaves: 'est',
    restring: true,
    desc: 'Pares al unísono apilados en cuartas: compacta y sin un centro tonal claro.',
  },
  {
    id: 'ggddebeb',
    name: 'GGDDEbEb',
    group: 'estrechas',
    notes: ['G2', 'G2', 'D3', 'D3', 'Eb3', 'Eb3'],
    octaves: 'est',
    restring: true,
    desc: 'Medio tono entre el segundo y el tercer par: una disonancia que vibra por sí sola.',
    heard: [
      { artist: SY, song: 'The Wonder', who: 'Lee Ranaldo', conf: 'fan', video: 'OyuA9JiboIU' },
      { artist: SY, song: 'Hyperstation', who: 'Lee Ranaldo', conf: 'fan', video: 'THarNd-jhgo' },
      { artist: SY, song: 'Sugar Kane', who: 'Lee Ranaldo', conf: 'fan', video: 'RIIEbrMXs20' },
    ],
  },
  {
    id: 'ggcsdgg',
    name: 'GGC#DGG',
    group: 'estrechas',
    notes: ['G2', 'G2', 'C#3', 'D3', 'G3', 'G3'],
    octaves: 'est',
    restring: true,
    desc: 'Un tritono y un semitono en el centro de dos pares de Sol. De las más ásperas que hay.',
    heard: [
      { artist: SY, song: 'The Wonder', who: 'Thurston Moore', conf: 'fan', video: 'OyuA9JiboIU' },
      { artist: SY, song: 'Hyperstation', who: 'Thurston Moore', conf: 'fan', video: 'THarNd-jhgo' },
    ],
  },
  {
    id: 'gabdeg',
    name: 'GABDEG',
    group: 'estrechas',
    notes: ['G2', 'A2', 'B2', 'D3', 'E3', 'G3'],
    octaves: 'est',
    restring: true,
    desc: 'La pentatónica de Sol en una sola octava: las cuerdas sueltas ya forman una escala.',
    heard: [{ artist: SY, song: 'Teen Age Riot', who: 'Thurston Moore', video: '10rLJjBLQZ8' }],
  },
  {
    id: 'fsharp',
    name: 'F#F#F#F#EB',
    group: 'estrechas',
    notes: ['F#2', 'F#2', 'F#3', 'F#3', 'E3', 'B3'],
    octaves: 'est',
    restring: true,
    desc: 'Cuatro cuerdas casi como un solo bordón, con dos notas que abren el acorde arriba.',
    heard: [
      { artist: SY, song: "Death Valley '69", conf: 'fan', video: 'y2Gf0MmRz9g' },
      { artist: SY, song: 'Kool Thing', conf: 'fan', video: 'SDTSUwIZdMk' },
      { artist: SY, song: '100%', conf: 'fan', video: 'N3gN9Up6hmc' },
    ],
  },
  {
    id: 'egdged',
    name: 'EGDGED',
    group: 'estrechas',
    notes: ['E2', 'G2', 'D3', 'G3', 'E3', 'D4'],
    octaves: 'est',
    desc: 'Las cuerdas sueltas forman un Em7 sin quinta, con notas que se cruzan: la 2.ª suena más grave que la 3.ª.',
    heard: [
      { artist: SY, song: 'Dirty Boots', who: 'Thurston Moore', conf: 'fan', video: 'fbBT0dftZKA' },
      { artist: SY, song: 'Sugar Kane', who: 'Thurston Moore', conf: 'fan', video: 'RIIEbrMXs20' },
      { artist: SY, song: 'Hits of Sunshine', conf: 'fan', video: 'dO_Kx6YajI0' },
    ],
  },
  {
    id: 'accggsc',
    name: 'ACCGG#C',
    group: 'estrechas',
    notes: ['A2', 'C3', 'C3', 'G3', 'G#3', 'C4'],
    octaves: 'est',
    restring: true,
    desc: 'Unísono en Do y medio tono arriba que ensucia todo con mucha intención.',
    heard: [
      { artist: SY, song: 'Silver Rocket', conf: 'fan', video: 'wWTkb1xVin0' },
      { artist: SY, song: 'The Sprawl', conf: 'fan', video: 't6QW1KcDV8M' },
      { artist: SY, song: "Cinderella's Big Score", conf: 'fan', video: 'xi3ZPT9iSNo' },
    ],
  },
  {
    id: 'fsfsggaa',
    name: 'F#F#GGAA',
    group: 'estrechas',
    notes: ['F#2', 'F#2', 'G3', 'G3', 'A3', 'A3'],
    octaves: 'est',
    restring: true,
    desc: 'Tres pares al unísono muy cercanos entre sí, con mucha tensión armónica.',
    heard: [
      { artist: SY, song: 'Tom Violence', conf: 'fan', video: 'DSqQ7Bc9PlQ' },
      { artist: SY, song: 'Schizophrenia', conf: 'fan', video: 'fWzFkVy3s14' },
      {
        artist: SY,
        song: 'Starpower',
        conf: 'duda',
        who: 'otra fuente dice F#F#F#F#EB',
        video: '1FaOJn0F5F0',
      },
    ],
  },
  {
    id: 'egsegs',
    name: 'EG#EG#EG#',
    group: 'estrechas',
    notes: ['E2', 'G#2', 'E3', 'G#3', 'E3', 'G#3'],
    octaves: 'est',
    restring: true,
    desc: 'Solo dos notas repetidas: una tercera mayor que se apila y flota.',
    heard: [{ artist: SY, song: 'Expressway to Yr Skull', conf: 'fan', video: '4tk4aEhping' }],
  },

  // Regulares
  {
    id: 'fourths',
    name: 'Todas cuartas',
    group: 'regulares',
    notes: ['E2', 'A2', 'D3', 'G3', 'C4', 'F4'],
    desc: 'Corrige el salto de tercera de la estándar: toda forma de escala se puede mover a cualquier cuerda.',
    heard: [{ artist: 'Stanley Jordan', who: 'con su técnica de tapping a dos manos' }],
  },
  {
    id: 'fifths',
    name: 'Todas quintas',
    group: 'regulares',
    notes: ['C2', 'G2', 'D3', 'A3', 'E4', 'B4'],
    restring: true,
    desc: 'Como el violonchelo y la mandolina: abarca un rango enorme, pero los acordes cerrados se vuelven imposibles.',
  },
  {
    id: 'nst',
    name: 'Nueva estándar',
    group: 'regulares',
    notes: ['C2', 'G2', 'D3', 'A3', 'E4', 'G4'],
    restring: true,
    desc: 'Quintas justas con una tercera menor arriba: amplia en el grave y tocable en el agudo.',
    heard: [{ artist: 'Robert Fripp', who: 'la creó y la enseña en Guitar Craft' }],
  },
  {
    id: 'thirds',
    name: 'Terceras mayores',
    group: 'regulares',
    notes: ['E2', 'G#2', 'C3', 'E3', 'G#3', 'C4'],
    restring: true,
    desc: 'Divide la octava en tres partes iguales: las notas se repiten cada tres cuerdas y el mástil se vuelve simétrico.',
  },
  {
    id: 'minorthirds',
    name: 'Terceras menores',
    group: 'regulares',
    notes: ['C3', 'Eb3', 'Gb3', 'A3', 'C4', 'Eb4'],
    restring: true,
    desc: 'Al aire suena un acorde disminuido. El rango es muy corto, pero se tocan acordes con muy poco movimiento.',
  },
  {
    id: 'tritones',
    name: 'Tritonos',
    group: 'regulares',
    notes: ['C2', 'F#2', 'C3', 'F#3', 'C4', 'F#4'],
    restring: true,
    desc: 'Solo dos notas a un tritono de distancia, el intervalo más inestable. Todo el mástil queda sin centro.',
  },

  // Zumbido
  {
    id: 'ostrich',
    name: 'Ostrich en Re',
    group: 'zumbido',
    notes: ['D3', 'D3', 'D3', 'D3', 'D4', 'D4'],
    restring: true,
    desc: 'Toda la guitarra en una sola nota. El acorde desaparece y queda un zumbido que late por las pequeñas diferencias entre cuerdas.',
    heard: [
      { artist: 'The Velvet Underground', song: "All Tomorrow's Parties", video: 'nfAK-IAlcsY' },
      {
        artist: 'The Velvet Underground',
        song: 'Venus in Furs',
        conf: 'duda',
        who: 'su uso aquí está en discusión',
        video: 'KR7Lv8XZtkk',
      },
    ],
  },
  {
    id: 'ostriche',
    name: 'Ostrich en Mi',
    group: 'zumbido',
    notes: ['E2', 'E3', 'E3', 'E3', 'E3', 'E4'],
    restring: true,
    desc: 'La misma idea en Mi, repartida en tres octavas: un bajo, un gran unísono al medio y un Mi agudo encima.',
  },
  {
    id: 'dronee',
    name: 'Quinta en Mi',
    group: 'zumbido',
    notes: ['E2', 'B2', 'E3', 'E3', 'B3', 'E4'],
    desc: 'Solo Mi y Si, sin tercera. Queda un power chord permanente al aire, con la 4.ª y la 3.ª al unísono.',
  },
  {
    id: 'droned',
    name: 'Quinta en Re',
    group: 'zumbido',
    notes: ['D2', 'A2', 'D3', 'A3', 'A3', 'D4'],
    desc: 'Solo Re y La, sin tercera: una base abierta para tocar melodía sobre un bordón constante.',
  },
];

export const SOURCES: Source[] = [
  {
    label: 'Harlan L. Thompson: “Best guesses on Nick Drake tunings”',
    url: 'https://guitartabs.cc/tabs/d/drake_nick/tunings_tab.html',
  },
  {
    label: 'Art Lee: “Unofficial Sonic Youth Guitar Tunings List” (1993)',
    url: 'https://www.guitartabs.cc/tabs/s/sonic_youth/guitar_tunings_tab.html',
  },
  {
    label: 'Stringjoy: The Alternate Tunings of Sonic Youth',
    url: 'https://stringjoy.com/sonic-youth-alternate-tunings',
  },
  {
    label: 'Premier Guitar: The Narrow-Range Tuning Trick',
    url: 'https://www.premierguitar.com/diy/joe-gores-recording-guitarist/sonic-youth-tunings',
  },
  {
    label: 'Far Out: What guitar tuning did Nick Drake use?',
    url: 'https://faroutmagazine.co.uk/what-guitar-tuning-did-nick-drake-use/',
  },
  { label: 'Wikipedia: Ostrich guitar', url: 'https://en.wikipedia.org/wiki/Ostrich_guitar' },
  { label: 'Wikipedia: Open C tuning', url: 'https://en.wikipedia.org/wiki/Open_C_tuning' },
];
