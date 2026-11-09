// Biblioteca de formas y vocabulario de secciones. Cada forma se escribe con los nombres de sus
// secciones, y las letras salen solas: la primera sección distinta es A, la segunda B, y así.
// Si vuelve la misma música, vuelve la misma letra. El riesgo de cada familia decide en qué nivel
// del sorteo entran sus formas.

export const FORM_FAMILIES = [
  { value: 'pop', risk: 0, label: 'Pop y rock', about: 'Estrofa y estribillo, con todas sus variantes.' },
  {
    value: 'cancionero',
    risk: 1,
    label: 'Cancionero, jazz y blues',
    about: 'Formas de frases medidas: 8, 12 o 32 compases, y la vuelta como unidad.',
  },
  {
    value: 'estrofica',
    risk: 0,
    label: 'Estróficas y folk',
    about: 'La misma música una y otra vez: el peso está en la letra o en cómo crece.',
  },
  {
    value: 'baile',
    risk: 1,
    label: 'Electrónica, rap y baile',
    about: 'Formas pensadas para la pista: la energía manda más que la melodía.',
  },
  {
    value: 'latina',
    risk: 1,
    label: 'Latinoamérica',
    about: 'Danzas y canciones con forma fija. Varían de región en región: esto es lo más frecuente.',
  },
  {
    value: 'academica',
    risk: 2,
    label: 'Clásicas',
    about: 'Formas de la música académica que también sirven para una canción.',
  },
  {
    value: 'raras',
    risk: 2,
    label: 'Por secciones y raras',
    about: 'Formas que no vuelven, que vuelven al revés o que se cortan.',
  },
] as const;

export type FormFamilyId = (typeof FORM_FAMILIES)[number]['value'];

export interface SongForm {
  id: string;
  family: FormFamilyId;
  name: string;
  /** Las secciones en orden. Mismo nombre, misma música. */
  sections: string[];
  /** Qué es y cómo funciona. */
  about: string;
  /** Cuándo probarla. */
  tip: string;
  /** Dónde se oye. Solo ejemplos conocidos y comprobables. */
  heard?: string;
}

/** La regla que se muestra al usar o sortear la forma. */
export const formRule = (form: SongForm) => `${form.name}. ${form.tip}`;

/** Una letra por sección distinta, en orden de aparición. */
export function formLetters(sections: readonly string[]): string[] {
  const seen = new Map<string, string>();
  return sections.map((section) => {
    if (!seen.has(section)) seen.set(section, String.fromCharCode(65 + seen.size));
    return seen.get(section)!;
  });
}

const s = (form: string) => form.split(' · ');

export const SONG_FORMS: readonly SongForm[] = [
  // Pop y rock
  {
    id: 'abab',
    family: 'pop',
    name: 'Estrofa y estribillo',
    sections: s('Estrofa · Estribillo · Estrofa · Estribillo'),
    about:
      'Lo mínimo del pop: una parte que cuenta y otra que resume. Si las dos usan los mismos acordes y solo cambian melodía y letra, es la forma simple que viene del blues.',
    tip: 'Cuando la canción se alarga sin necesidad: sacar el puente suele salvarla.',
    heard: '«Where Is My Mind?», Pixies.',
  },
  {
    id: 'ababcb',
    family: 'pop',
    name: 'Con puente',
    sections: s('Estrofa · Estribillo · Estrofa · Estribillo · Puente · Estribillo'),
    about:
      'La forma más usada del pop. Después del segundo estribillo el oído ya sabe todo: el puente trae algo nuevo, y el último estribillo vuelve con más fuerza.',
    tip: 'El punto de partida más seguro. Lo difícil es que el puente diga algo que el resto no dijo.',
  },
  {
    id: 'pre',
    family: 'pop',
    name: 'Con preestribillo',
    sections: s(
      'Estrofa · Preestribillo · Estribillo · Estrofa · Preestribillo · Estribillo · Puente · Estribillo',
    ),
    about:
      'Igual que la anterior, con una rampa antes del estribillo. El preestribillo sube la tensión: acordes que no resuelven, melodía que trepa, batería que se acumula.',
    tip: 'Cuando el salto de la estrofa al estribillo se siente brusco o el estribillo no despega.',
  },
  {
    id: 'post',
    family: 'pop',
    name: 'Con posestribillo',
    sections: s(
      'Estrofa · Preestribillo · Estribillo · Posestribillo · Estrofa · Preestribillo · Estribillo · Posestribillo · Puente · Estribillo · Posestribillo',
    ),
    about:
      'Después del estribillo viene una parte corta que lo estira: casi siempre un gancho de pocas palabras o sílabas sin sentido (“oh-oh”). Es lo que queda pegado aunque no te acuerdes del estribillo.',
    tip: 'Si tenés una frase o un riff demasiado bueno para usarlo una sola vez.',
    heard: '«Shake It Off», Taylor Swift.',
  },
  {
    id: 'gancho',
    family: 'pop',
    name: 'Con gancho aparte',
    sections: s(
      'Estrofa · Estribillo · Gancho · Estrofa · Estribillo · Gancho · Puente · Estribillo · Gancho',
    ),
    about:
      'El gancho, que suele ser el título, sale del estribillo y tiene su propia sección. El estribillo prepara y el gancho remata.',
    tip: 'Cuando el estribillo es largo y la frase central se pierde adentro.',
  },
  {
    id: 'estribillo-primero',
    family: 'pop',
    name: 'Arrancar por el estribillo',
    sections: s('Estribillo · Estrofa · Estribillo · Estrofa · Estribillo · Puente · Estribillo'),
    about:
      'Sin intro ni estrofa: lo primero que suena es lo mejor. La primera estrofa ya llega con el oído enganchado.',
    tip: 'Para canciones cortas o cuando la estrofa sola no se sostiene al principio.',
    heard: '«She Loves You», The Beatles.',
  },
  {
    id: 'doble-estrofa',
    family: 'pop',
    name: 'Dos estrofas antes del estribillo',
    sections: s('Estrofa · Estrofa · Estribillo · Estrofa · Estribillo · Puente · Estribillo'),
    about:
      'La historia necesita más tiempo para arrancar, así que el estribillo se hace esperar. Después ya va de a una estrofa.',
    tip: 'Para letras narrativas, o cuando el estribillo es tan fuerte que conviene demorarlo.',
  },
  {
    id: 'rock-solo',
    family: 'pop',
    name: 'Rock con solo',
    sections: s('Intro · Estrofa · Estribillo · Estrofa · Estribillo · Solo · Estrofa · Estribillo · Outro'),
    about:
      'El solo ocupa el lugar del puente, casi siempre sobre los acordes de la estrofa. La intro y el outro suelen ser el mismo riff.',
    tip: 'Cuando la canción pide aire instrumental antes de la última vuelta.',
  },
  {
    id: 'bajo-alto',
    family: 'pop',
    name: 'Silencio y ruido',
    sections: s('Estrofa · Estribillo · Estrofa · Estribillo · Puente · Estribillo'),
    about:
      'Las letras son las de siempre; la forma la hace el volumen. Estrofa casi susurrada, estribillo con todo. El contraste de intensidad hace el trabajo que en otras canciones hace la armonía.',
    tip: 'Si las partes se parecen mucho: separalas por intensidad antes de cambiar acordes.',
    heard: '«Smells Like Teen Spirit», Nirvana.',
  },
  {
    id: 'modulacion',
    family: 'pop',
    name: 'Último estribillo un tono arriba',
    sections: s('Estrofa · Estribillo · Estrofa · Estribillo · Puente · Estribillo · Estribillo modulado'),
    about:
      'El último estribillo sube medio tono o un tono entero: la canción “cambia de marcha”. Es un efecto viejo y muy reconocible, por eso suena a final de fiesta.',
    tip: 'Usalo sabiendo que se nota. Para que no suene a truco, prepará el salto con un acorde de paso.',
    heard: "«Livin' on a Prayer», Bon Jovi.",
  },
  {
    id: 'doble-final',
    family: 'pop',
    name: 'Estribillo doble y salida',
    sections: s(
      'Intro · Estrofa · Estribillo · Estrofa · Estribillo · Puente · Estribillo · Estribillo · Outro',
    ),
    about:
      'Al final, el estribillo se repite dos veces seguidas, a veces con el segundo más liviano o con la letra cambiada. El outro baja la canción en lugar de cortarla.',
    tip: 'Para que la última impresión sea el estribillo, y bien larga.',
  },

  // Cancionero, jazz y blues
  {
    id: 'aaba',
    family: 'cancionero',
    name: 'AABA de 32 compases',
    sections: s('Estrofa · Estrofa · Puente · Estrofa'),
    about:
      'Cuatro partes de 8 compases. La A dice la idea y la repite; el puente (B) se va a otro lugar, y la última A vuelve a casa. No hay estribillo separado: el título suele ir al principio o al final de cada A, como un refrán.',
    tip: 'Para una sola idea fuerte que no necesita estribillo.',
    heard: '«Over the Rainbow», Judy Garland; «Yesterday», The Beatles.',
  },
  {
    id: 'aaba-extendida',
    family: 'cancionero',
    name: 'AABA con puente repetido',
    sections: s('Estrofa · Estrofa · Puente · Estrofa · Puente · Estrofa'),
    about:
      'La AABA del rock: después de la forma completa vuelven el puente y la última A, a veces con un solo encima.',
    tip: 'Cuando la AABA queda corta y no querés agregar una parte nueva.',
    heard: '«Every Breath You Take», The Police.',
  },
  {
    id: 'abac',
    family: 'cancionero',
    name: 'ABAC',
    sections: s('Frase A · Frase B · Frase A · Frase C'),
    about:
      'Otra forma de 32 compases, muy del cancionero. Empieza como algo que se repite, pero en la cuarta frase toma otro camino y cierra distinto.',
    tip: 'Cuando la última frase de tu A no termina de cerrar: dejala abierta y escribí otro final.',
    heard: '«All of Me».',
  },
  {
    id: 'verso-standard',
    family: 'cancionero',
    name: 'Estrofa introductoria y estribillo',
    sections: s('Intro hablada · Estrofa · Estrofa · Puente · Estrofa'),
    about:
      'En los standards viejos, el “verse” era una introducción libre, casi hablada, y el “chorus” era toda la AABA. Por eso en jazz “chorus” quiere decir una vuelta completa a la forma, no el estribillo.',
    tip: 'Para presentar la escena antes de que entre el tema, sin tempo fijo.',
    heard: '«Over the Rainbow» tiene una, y casi nunca se canta.',
  },
  {
    id: 'jazz',
    family: 'cancionero',
    name: 'Tema, solos, tema',
    sections: s('Intro · Tema · Solo · Solo · Tema · Coda'),
    about:
      'El tema se toca entero, después cada músico improvisa sobre la misma forma (una vuelta o varias) y al final vuelve el tema. La forma de adentro, casi siempre AABA o blues, no cambia nunca.',
    tip: 'Para tocar con otros: alcanza con que todos sepan la forma.',
  },
  {
    id: 'blues12',
    family: 'cancionero',
    name: 'Blues de 12 compases',
    sections: s('Intro · Vuelta · Vuelta · Solo · Solo · Vuelta · Turnaround'),
    about:
      'Cada vuelta dura 12 compases sobre I, IV y V. La letra va en tres líneas, A A B: se dice una línea, se repite, y la tercera responde o remata. También existen blues de 8 y de 16 compases.',
    tip: 'Para escribir rápido: la forma ya está, solo falta qué decir en dos líneas y media.',
    heard: '«Johnny B. Goode», Chuck Berry.',
  },
  {
    id: 'bar',
    family: 'cancionero',
    name: 'Forma bar · AAB',
    sections: s('Frase A · Frase A · Remate'),
    about:
      'Dos frases iguales y una tercera más larga que se va a otro lado. Viene de los trovadores alemanes y de los corales luteranos, y está adentro de muchas estrofas de pop: dos líneas parecidas y una que se escapa.',
    tip: 'Para escribir una estrofa: si las dos primeras líneas riman y repiten, la tercera puede romper.',
  },

  // Estróficas y folk
  {
    id: 'aaa',
    family: 'estrofica',
    name: 'Estrófica',
    sections: s('Estrofa · Estrofa · Estrofa · Estrofa'),
    about:
      'La misma música en cada estrofa, con otra letra. La forma más vieja de canción. Funciona cuando la melodía aguanta la repetición y la letra avanza.',
    tip: 'Para letras largas o narrativas, y para canciones que se cantan entre muchos.',
    heard: '«Pink Moon», Nick Drake.',
  },
  {
    id: 'refran',
    family: 'estrofica',
    name: 'Estrófica con refrán',
    sections: s('Estrofa · Estrofa · Estrofa'),
    about:
      'Estrófica, pero cada estrofa termina con la misma línea. Ese refrán hace el trabajo del estribillo sin ser una sección aparte.',
    tip: 'Cuando el título es una frase sola y no da para un estribillo entero.',
    heard: "«Blowin' in the Wind», Bob Dylan.",
  },
  {
    id: 'crece',
    family: 'estrofica',
    name: 'Una idea que crece',
    sections: s('Estrofa · Estrofa · Estrofa · Estrofa'),
    about:
      'Estrófica, pero cada vuelta suma algo: un instrumento, una voz, más velocidad, más volumen. La forma no está en las partes sino en la curva.',
    tip: 'Si tenés una sola idea buena: no le busques otra parte, hacela crecer.',
    heard: '«Heroin», The Velvet Underground; el «Bolero» de Ravel.',
  },
  {
    id: 'balada',
    family: 'estrofica',
    name: 'Balada narrativa',
    sections: s('Estrofa · Estrofa · Interludio · Estrofa · Estrofa · Interludio · Estrofa · Estrofa'),
    about:
      'Muchas estrofas que cuentan una historia, con un respiro instrumental cada tanto para que el oído descanse de la letra.',
    tip: 'Para una historia con principio, nudo y final que no entra en tres estrofas.',
  },
  {
    id: 'binaria',
    family: 'estrofica',
    name: 'Binaria · AABB',
    sections: s('Parte A · Parte A · Parte B · Parte B'),
    about:
      'Dos partes, cada una repetida. Es la forma de casi todas las melodías de violín de baile (reels, jigs) y de muchas danzas viejas. Se toca varias veces seguida.',
    tip: 'Para una pieza instrumental: dos ideas cortas y que se repitan.',
  },

  // Electrónica, rap y baile
  {
    id: 'edm',
    family: 'baile',
    name: 'Subida y drop',
    sections: s('Intro · Subida · Drop · Breakdown · Subida · Drop · Outro'),
    about:
      'Medidas habituales: intro 16 compases, subida 8, drop 16, breakdown 16, subida 8, drop 16, outro 16. La energía arranca baja, explota en el drop, cae en el breakdown y vuelve a explotar. El segundo drop conviene que cambie algo.',
    tip: 'Pensá la canción como una curva de energía antes que como una melodía.',
    heard: '«Animals», Martin Garrix.',
  },
  {
    id: 'house',
    family: 'baile',
    name: 'House para pasar',
    sections: s('Intro · Groove · Breakdown · Groove · Outro'),
    about:
      'Intro y outro largos (16 a 32 compases), casi solo con batería, para que quien pasa música pueda mezclar. En el medio no hay un drop grande: cada 8 compases entra o sale algo.',
    tip: 'Para música que se escucha mezclada, no de principio a fin.',
  },
  {
    id: 'pop-drop',
    family: 'baile',
    name: 'Pop con drop',
    sections: s(
      'Estrofa · Preestribillo · Estribillo · Drop · Estrofa · Preestribillo · Estribillo · Drop · Puente · Drop',
    ),
    about:
      'Una canción pop con un drop de electrónica en el lugar del posestribillo. El estribillo cantado arma la expectativa y el drop, casi sin voz, la descarga.',
    tip: 'Si el estribillo es bueno pero la canción necesita un golpe más.',
    heard: '«Clarity», Zedd.',
  },
  {
    id: 'rap',
    family: 'baile',
    name: 'Rap de tres estrofas',
    sections: s('Intro · Estrofa · Gancho · Estrofa · Gancho · Estrofa · Gancho · Outro'),
    about:
      'Estrofas de 16 compases y ganchos de 8 (o uno de 4 repetido). En rap el estribillo se llama gancho o hook. Casi nunca hay puente: la canción no frena.',
    tip: 'Si tenés mucho para decir: cada estrofa puede ser un punto de vista distinto.',
  },
  {
    id: 'kpop',
    family: 'baile',
    name: 'Pop coreano',
    sections: s(
      'Intro · Estrofa · Preestribillo · Estribillo · Posestribillo · Estrofa · Preestribillo · Estribillo · Posestribillo · Puente · Pausa de baile · Estribillo modulado',
    ),
    about:
      'El pop con todo junto: posestribillo, una segunda estrofa que suele ser rapeada, un puente que cambia el ritmo, una parte instrumental para la coreografía y el último estribillo modulado.',
    tip: 'Para una canción larga que nunca deja de cambiar.',
    heard: '«Dynamite», BTS.',
  },
  {
    id: 'vamp',
    family: 'baile',
    name: 'Funk sobre un acorde',
    sections: s('Intro · Vamp · Vamp · Corte · Vamp · Puente · Vamp'),
    about:
      'Un groove de uno o dos acordes que se repite, con cortes donde la banda frena de golpe y un puente que es el único cambio de acorde. La forma la marcan la banda y quien canta, a veces en el momento.',
    tip: 'Para tocar en vivo: el groove aguanta y los cortes sorprenden.',
    heard: 'James Brown.',
  },

  // Latinoamérica
  {
    id: 'zamba',
    family: 'latina',
    name: 'Zamba',
    sections: s('Intro · Estrofa · Estrofa · Estribillo · Intro · Estrofa · Estrofa · Estribillo'),
    about:
      'Intro, dos estrofas y estribillo; después todo de nuevo con otra letra. Se baila en dos partes iguales, la primera y la segunda. Estrofas y estribillo suelen tener 12 compases, en tres frases de 4, en 6/8.',
    tip: 'Para escribir con una forma que ya trae su respiración: la letra entra en coplas.',
    heard: '«Zamba de mi esperanza».',
  },
  {
    id: 'chacarera',
    family: 'latina',
    name: 'Chacarera',
    sections: s(
      'Interludio · Estrofa · Interludio · Estrofa · Interludio · Estrofa · Estribillo · Interludio · Estrofa · Interludio · Estrofa · Interludio · Estrofa · Estribillo',
    ),
    about:
      'Un interludio instrumental que también sirve de intro, tres estrofas separadas por el interludio y el estribillo, que es la parte más intensa. Todo se repite en dos partes iguales. En la chacarera doble cambian los compases de las estrofas.',
    tip: 'Para trabajar con un interludio que vuelve: es el que le da identidad a la pieza.',
  },
  {
    id: 'tango',
    family: 'latina',
    name: 'Tango',
    sections: s('Intro · Primera parte · Segunda parte · Primera parte · Segunda parte · Variación'),
    about:
      'Dos partes que se alternan, la primera rítmica y la segunda más cantable, y al final una variación: la melodía de una de las partes tocada rápido y en notas cortas, muchas veces por el bandoneón.',
    tip: 'Para cerrar con un lucimiento instrumental en lugar de un último estribillo.',
  },
  {
    id: 'bolero',
    family: 'latina',
    name: 'Bolero',
    sections: s('Intro · Primera parte · Segunda parte · Interludio · Segunda parte · Coda'),
    about:
      'Una forma frecuente: dos partes de 16 compases, separadas por un interludio instrumental, con la segunda repetida al final. Muchos boleros pasan de menor a mayor en la segunda parte.',
    tip: 'Para una canción romántica: la segunda parte puede abrir la tonalidad y la emoción.',
  },
  {
    id: 'son',
    family: 'latina',
    name: 'Son y salsa',
    sections: s('Intro · Tema · Tema · Montuno · Mambo · Montuno · Coda'),
    about:
      'Dos mitades: primero una canción con su letra; después el montuno, un ciclo corto de acordes donde el coro repite una frase y quien canta improvisa entre medio (el pregón). El mambo es un corte de vientos que reaviva el montuno.',
    tip: 'Para que la segunda mitad sea un juego de pregunta y respuesta con el público.',
  },
  {
    id: 'huayno',
    family: 'latina',
    name: 'Huayno con fuga',
    sections: s('Intro · Estrofa · Estrofa · Fuga · Fuga'),
    about:
      'Estrofas de frases cortas, a menudo AABB, en ritmo binario. Al final viene la fuga: una parte más rápida y animada que cierra la pieza y se baila con más fuerza.',
    tip: 'Para terminar subiendo el tempo en lugar del volumen.',
  },
  {
    id: 'cueca',
    family: 'latina',
    name: 'Cueca',
    sections: s('Intro · Cuarteta · Seguidilla · Remate'),
    about:
      'La forma la arma la letra: una cuarteta, una seguidilla de siete versos y un remate de dos que cierra todo. La música sigue esas frases, y se canta y baila varias veces seguidas.',
    tip: 'Para escribir al revés: primero la métrica de la letra, después la música.',
  },

  // Clásicas
  {
    id: 'ternaria',
    family: 'academica',
    name: 'Ternaria · ABA',
    sections: s('Parte A · Parte B · Parte A'),
    about:
      'Una idea, un contraste y la vuelta a la primera. El contraste suele ser fuerte: más lento, más suave o en otra tonalidad. Es la forma de muchas arias barrocas (“da capo”) y minuetos.',
    tip: 'Para una canción corta con un desvío claro en el medio.',
  },
  {
    id: 'rondo',
    family: 'academica',
    name: 'Rondó · ABACA',
    sections: s('Tema · Episodio 1 · Tema · Episodio 2 · Tema'),
    about:
      'El tema vuelve después de cada desvío, y cada desvío es distinto. Con un tercer regreso queda ABACABA. Funciona como un estribillo que vuelve, pero entre medio nunca hay dos estrofas iguales.',
    tip: 'Cuando tenés un tema que aguanta volver y varias ideas cortas que no dan para canción.',
    heard: '«Para Elisa», Beethoven.',
  },
  {
    id: 'sonata',
    family: 'academica',
    name: 'Sonata',
    sections: s('Tema 1 · Tema 2 · Desarrollo · Tema 1 · Tema 2 · Coda'),
    about:
      'Se presentan dos temas en tonalidades distintas, después se los desarma y mezcla (el desarrollo), y al final vuelven los dos, ahora en la misma tonalidad. Es una forma de conflicto y resolución.',
    tip: 'Para una canción larga con dos ideas que se pelean y terminan juntas.',
    heard: 'Mozart, Sonata en Do mayor K. 545, primer movimiento.',
  },
  {
    id: 'arco',
    family: 'academica',
    name: 'Forma de arco · ABCBA',
    sections: s('Parte A · Parte B · Centro · Parte B · Parte A'),
    about:
      'Simétrica: se avanza hasta un centro y se vuelve por el mismo camino, al revés. El centro es lo más importante.',
    tip: 'Para una letra que va y vuelve, o que termina donde empezó.',
    heard: 'Bartók, Cuarteto de cuerdas n.º 4.',
  },

  // Por secciones y raras
  {
    id: 'lineal',
    family: 'raras',
    name: 'Lineal',
    sections: s('Parte A · Parte B · Parte C · Parte D'),
    about:
      'Ninguna sección vuelve: la canción siempre va para adelante. En música académica se dice que está “compuesta de corrido”. Lo que da unidad es la letra, el sonido o un motivo que sobrevive de parte en parte.',
    tip: 'Para una historia que avanza, o cuando cada parte pide su propia música.',
    heard: '«Stairway to Heaven», Led Zeppelin.',
  },
  {
    id: 'suite',
    family: 'raras',
    name: 'Suite',
    sections: s('Intro · Parte A · Parte B · Parte C · Parte D · Parte E · Parte A'),
    about:
      'Varias canciones cortas pegadas como una sola, cada una con su tempo y su carácter. A veces el final trae de vuelta algo del principio para cerrar.',
    tip: 'Si tenés fragmentos sueltos que no llegan a canción: pegalos.',
    heard: '«Bohemian Rhapsody», Queen; «Paranoid Android», Radiohead.',
  },
  {
    id: 'dos-canciones',
    family: 'raras',
    name: 'Dos canciones en una',
    sections: s('Estrofa · Estribillo · Estrofa · Estribillo · Coda · Coda'),
    about:
      'Una canción completa, y después otra que nunca vuelve a la primera. La segunda suele ser instrumental o un mantra repetido.',
    tip: 'Cuando la canción termina pero todavía queda algo para decir sin palabras.',
    heard: '«Layla», Derek and the Dominos; «Hey Jude», The Beatles.',
  },
  {
    id: 'climax',
    family: 'raras',
    name: 'Clímax al final',
    sections: s('Estrofa · Estrofa · Estrofa · Clímax'),
    about:
      'Lo más intenso y lo más nuevo llega al final y no se había escuchado antes. Todo lo anterior es preparación.',
    tip: 'Para canciones que se escuchan de principio a fin, no a pedazos.',
  },
  {
    id: 'invertida',
    family: 'raras',
    name: 'Invertida',
    sections: s('Clímax · Puente · Estribillo · Estrofa'),
    about:
      'Arranca por lo más fuerte y va desarmándose hasta la idea más simple. Es una canción pop leída al revés.',
    tip: 'Para una letra que se va apagando, o que termina en una pregunta.',
  },
  {
    id: 'falso-final',
    family: 'raras',
    name: 'Falso final',
    sections: s('Estrofa · Estribillo · Estrofa · Estribillo · Silencio · Estribillo'),
    about:
      'La canción parece terminar, hay un silencio o un fundido, y vuelve. La sorpresa hace que el último estribillo pese el doble.',
    tip: 'Usalo una vez: la segunda ya no sorprende.',
    heard: '«Strawberry Fields Forever», The Beatles.',
  },
  {
    id: 'monoforma',
    family: 'raras',
    name: 'Una sola parte',
    sections: s('Parte A'),
    about:
      'Una sola sección, sin repetición ni contraste. Funciona si es corta o si cambia por dentro despacio, como un drone o una frase que se transforma.',
    tip: 'Para una canción de un minuto, o un experimento de textura.',
  },
];

/** Los nombres de las secciones, con el término en inglés cuando se usa así. */
export interface Term {
  term: string;
  english?: string;
  meaning: string;
}

export const SECTION_TERMS: readonly Term[] = [
  {
    term: 'Intro',
    meaning:
      'La parte corta que arranca la canción, casi siempre instrumental. Suele presentar un riff o una frase que vuelve después.',
  },
  {
    term: 'Estrofa',
    english: 'verse',
    meaning:
      'La parte que cuenta: quién, qué, dónde, por qué. Mueve la historia. Misma música, otra letra cada vez. Ojo: en castellano un verso es una sola línea, y la sección entera es la estrofa.',
  },
  {
    term: 'Preestribillo',
    english: 'pre-chorus',
    meaning: 'Une la estrofa con el estribillo. Se siente como una rampa que sube la tensión.',
  },
  {
    term: 'Estribillo',
    english: 'chorus',
    meaning:
      'La parte que se repite igual y se canta entre todos. Suele volver tres veces y resume la canción; contiene el gancho o lleva a él.',
  },
  {
    term: 'Posestribillo',
    english: 'post-chorus',
    meaning:
      'Una parte corta pegada al estribillo, a veces con sílabas sin sentido o un drop. Estira el estribillo o cierra el bloque.',
  },
  {
    term: 'Refrán',
    english: 'refrain',
    meaning:
      'Una o dos líneas que se repiten al final de cada estrofa. Es el gancho de las formas sin estribillo, como la AABA.',
  },
  {
    term: 'Gancho',
    english: 'hook',
    meaning:
      'La frase que engancha: casi siempre el título y el corazón de la canción. Aparece al principio o al final del estribillo, o en su propia sección. En rap, el estribillo entero se llama gancho.',
  },
  {
    term: 'Puente',
    english: 'bridge',
    meaning:
      'El giro de la canción, casi siempre después del segundo estribillo. Agrega algo nuevo: otra parte de la historia, otros acordes, otra melodía u otro ritmo.',
  },
  {
    term: 'Middle 8',
    meaning: 'Como se le dice al puente en Inglaterra. Suele durar 8 compases.',
  },
  {
    term: 'Interludio',
    meaning: 'Una parte instrumental entre estrofas. En el folklore suele ser la misma música de la intro.',
  },
  {
    term: 'Solo',
    meaning:
      'Un instrumento toma la melodía, en general sobre acordes que ya sonaron (los de la estrofa o el estribillo).',
  },
  {
    term: 'Breakdown',
    meaning:
      'En rock y funk, un momento donde la banda se reduce y alguien se luce. En electrónica, la caída de energía entre dos drops.',
  },
  {
    term: 'Subida',
    english: 'build-up',
    meaning:
      'La rampa de la electrónica: redoblantes cada vez más rápidos, filtros que se abren, ruido que sube. Exagera la espera del drop.',
  },
  {
    term: 'Drop',
    meaning:
      'La descarga después de la subida: entra todo el sonido de golpe y la música, más que la voz, pasa al frente.',
  },
  {
    term: 'Groove',
    meaning: 'El cuerpo rítmico de un tema de baile, que se repite con cambios chicos cada 8 compases.',
  },
  {
    term: 'Vamp',
    meaning: 'Uno o dos acordes que se repiten sin fin, a la espera de que alguien marque el cambio.',
  },
  {
    term: 'Corte',
    english: 'break',
    meaning: 'La banda frena de golpe: un silencio o un golpe solo, y vuelve.',
  },
  {
    term: 'Pausa de baile',
    english: 'dance break',
    meaning: 'Una parte instrumental hecha para la coreografía, típica del pop coreano.',
  },
  {
    term: 'Modulación',
    meaning:
      'Cambiar de tonalidad. Al final de una canción pop, subir el último estribillo medio tono o un tono para levantarlo.',
  },
  {
    term: 'Vuelta',
    english: 'chorus en jazz',
    meaning:
      'Una pasada completa por la forma. En blues son 12 compases; en jazz, toda la AABA. Por eso un músico de jazz dice “tomate dos chorus” y no habla del estribillo.',
  },
  {
    term: 'Turnaround',
    meaning:
      'Los dos últimos compases de una vuelta, que llevan de nuevo al principio. Si es el final, cierra.',
  },
  {
    term: 'Montuno',
    meaning:
      'En el son y la salsa, la segunda mitad: un ciclo corto de acordes donde el coro repite una frase y quien canta improvisa.',
  },
  {
    term: 'Pregón',
    meaning: 'Lo que improvisa quien canta entre las respuestas del coro en el montuno.',
  },
  {
    term: 'Variación',
    meaning:
      'En el tango, el final instrumental: la melodía tocada rápido y en notas cortas, muchas veces por el bandoneón.',
  },
  {
    term: 'Fuga',
    meaning: 'En el huayno y otras danzas andinas, el cierre más rápido y animado. No es la fuga de Bach.',
  },
  {
    term: 'Copla',
    meaning:
      'Una estrofa breve de la canción popular, casi siempre de cuatro versos. La zamba y la chacarera se escriben en coplas.',
  },
  {
    term: 'Coda',
    meaning:
      'Una parte nueva al final que cierra la canción y no vuelve. A veces dura tanto como todo lo anterior.',
  },
  {
    term: 'Outro',
    meaning: 'La salida de la canción. Suele repetir la intro o bajarse despacio, a veces con un fundido.',
  },
  {
    term: 'Tag',
    meaning: 'Repetir la última línea del estribillo una o dos veces más al final, como un eco.',
  },
  {
    term: 'Topline',
    meaning:
      'La melodía y la letra juntas, lo que se canta. Hay quien escribe solo eso sobre una pista que hizo otra persona.',
  },
];
