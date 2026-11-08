// Las herramientas son un desvío para ir más hondo en una fila de la consigna. Acá están todas juntas
// para quien ya sabe cuál quiere.
import { Link, type MetaFunction } from 'react-router';
import { TUNINGS } from '~/data/tunings';
import { PageTitle, Slab } from '~/shared/ui/ui';
import styles from './herramientas.module.css';

export const meta: MetaFunction = () => [
  { title: 'Herramientas para componer · Scordatura' },
  {
    name: 'description',
    content: `Afinador con ${TUNINGS.length} afinaciones, ritmo, drone, armonía, melodía, letras y forma, para ir más hondo en cada parte de una consigna.`,
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
    to: '/forma',
    name: 'Forma',
    breaks: 'La arquitectura',
    what: 'El esqueleto de la canción, en bloques, sección por sección.',
  },
];

export default function HerramientasRoute() {
  return (
    <div>
      <Slab>
        <PageTitle title="Herramientas">
          <p>
            Para ir más hondo en una parte de la consigna. Lo que elijas en cada una vuelve a su fila, y queda
            trabado.
          </p>
        </PageTitle>
      </Slab>
      <ul className={styles.tools}>
        {TOOLS.map((tool) => (
          <li key={tool.to}>
            <Link to={tool.to} aria-label={tool.name}>
              <small>{tool.breaks}</small>
              <strong>{tool.name}</strong>
              <span>{tool.what}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Slab>
        <p className={styles.more}>
          Desde la consigna también se abren <Link to="/estudio">el Estudio</Link>, para escuchar todo junto,
          y <Link to="/cartas">las Cartas</Link>, con tu propio mazo.
        </p>
      </Slab>
    </div>
  );
}
