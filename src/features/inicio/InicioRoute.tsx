import { Link, type MetaFunction } from 'react-router';
import { TUNINGS } from '~/data/tunings';
import styles from './inicio.module.css';

export const meta: MetaFunction = () => [
  { title: 'Scordatura: herramientas para componer fuera de tus costumbres' },
  {
    name: 'description',
    content:
      'Consignas con teoría real para salir de tus mañas al componer: afinaciones, ritmos, armonía, melodía, letras y forma. No compone por vos.',
  },
];

const TOOLS: ReadonlyArray<{ to: string; name: string; breaks: string; what: string }> = [
  {
    to: '/afinador',
    name: 'Afinador',
    breaks: 'La mano',
    what: `${TUNINGS.length} afinaciones para afinar y escuchar, de DADGAD a las de Nick Drake y Sonic Youth.`,
  },
  {
    to: '/ritmo',
    name: 'Ritmo',
    breaks: 'El cuerpo',
    what: 'Un metrónomo para 7/8, ritmos euclidianos, polirritmias y compases que cambian solos.',
  },
  {
    to: '/drone',
    name: 'Drone',
    breaks: 'La mano',
    what: 'Un sinte que sostiene una nota, o las cuerdas de tu afinación, para tocar encima.',
  },
  {
    to: '/armonia',
    name: 'Armonía',
    breaks: 'El oído',
    what: 'Progresiones sorteadas con su regla, para variarlas acorde por acorde y tocarlas en la afinación que elijas.',
  },
  {
    to: '/melodia',
    name: 'Melodía',
    breaks: 'El oído',
    what: 'Contornos, motivos, notas prohibidas y lo que chocan sobre cada acorde.',
  },
  {
    to: '/letras',
    name: 'Letras',
    breaks: 'La voz',
    what: 'Sílabas, rimas, prosodia y material crudo. La letra la escribís vos.',
  },
  {
    to: '/cartas',
    name: 'Cartas',
    breaks: 'La cabeza',
    what: 'Un mazo de consignas para cuando no sabés cómo seguir.',
  },
  {
    to: '/forma',
    name: 'Forma',
    breaks: 'La arquitectura',
    what: 'El esqueleto de la canción, en bloques, sección por sección.',
  },
  {
    to: '/diario',
    name: 'Diario',
    breaks: 'La memoria',
    what: 'Tus ideas grabadas, pegadas a las condiciones en las que nacieron.',
  },
];

const PRINCIPLES: ReadonlyArray<[string, string]> = [
  [
    'Azar con reglas',
    'Todo lo que se sortea sale de teoría real. El azar elige dentro de un sistema, no tira ruido.',
  ],
  ['Teoría a la vista', 'Cada resultado muestra la regla que lo generó. La app enseña mientras la usás.'],
  ['Trabar y volver a sortear', 'Lo que te gusta se queda. El resto se vuelve a sortear.'],
  ['No compone por vos', 'Te propone una consigna. La música la hacés vos.'],
];

export default function InicioRoute() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>Tus canciones se parecen entre sí.</h1>
        <p className={styles.lead}>
          Siempre la misma afinación, el mismo 4/4, las mismas cuatro progresiones. Scordatura te saca de ahí:
          te da restricciones con teoría real detrás, y vos las convertís en música.
        </p>
        <Link to="/consigna" className={styles.cta} data-testid="cta">
          Armar una consigna →
        </Link>
      </section>

      <section className={styles.block} aria-labelledby="como">
        <h2 id="como">Cómo funciona</h2>
        <ol className={styles.steps}>
          <li>
            <strong>Sorteás.</strong> Sale una consigna completa: afinación, ritmo, armonía, melodía, letra,
            forma, una carta y un drone.
          </li>
          <li>
            <strong>Escuchás y trabás.</strong> Oís cada parte ahí mismo, trabás lo que te sirve y volvés a
            sortear el resto.
          </li>
          <li>
            <strong>Tocás.</strong> Agarrás el instrumento y grabás la idea. Queda guardada junto con la
            consigna que la generó.
          </li>
        </ol>
        <div className={styles.example} aria-label="Ejemplo de consigna">
          <p className={styles.exampleTitle}>Por ejemplo</p>
          <dl>
            <div>
              <dt>Afinación</dt>
              <dd>BEBEBE</dd>
            </div>
            <div>
              <dt>Ritmo</dt>
              <dd>7/8, agrupado 2+2+3</dd>
            </div>
            <div>
              <dt>Armonía</dt>
              <dd>Con intercambio modal</dd>
            </div>
            <div>
              <dt>Letra</dt>
              <dd>Octosílabos, sin decir “noche”</dd>
            </div>
            <div>
              <dt>Carta</dt>
              <dd>“Sacá el acorde que más te gusta”</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className={styles.block} aria-labelledby="herramientas">
        <h2 id="herramientas">Cada herramienta rompe una costumbre</h2>
        <p className={styles.note}>Cada una funciona sola. Juntas, se pasan cosas entre sí.</p>
        <ul className={styles.tools}>
          {TOOLS.map((tool) => (
            <li key={tool.to}>
              <Link to={tool.to}>
                <small>{tool.breaks}</small>
                <strong>{tool.name}</strong>
                <span>{tool.what}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.block} aria-labelledby="principios">
        <h2 id="principios">Las reglas del juego</h2>
        <dl className={styles.principles}>
          {PRINCIPLES.map(([name, text]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.closing}>
        <p>Una scordatura es afinar un instrumento de otra manera, para que tus manos no sepan adónde ir.</p>
        <Link to="/consigna" className={styles.cta}>
          Empezar →
        </Link>
      </section>
    </div>
  );
}
