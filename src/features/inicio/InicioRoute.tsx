// La idea en veinte segundos. La app arranca en la consigna: esto es para quien pregunta qué es.
import { Link, type MetaFunction } from 'react-router';
import styles from './inicio.module.css';

export const meta: MetaFunction = () => [
  { title: 'Qué es Scordatura: restricciones para componer fuera de tus costumbres' },
  {
    name: 'description',
    content:
      'Scordatura sortea restricciones con teoría real para sacarte de tus costumbres al componer. No compone por vos.',
  },
];

export default function InicioRoute() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>Tus canciones se parecen entre sí.</h1>
        <p className={styles.lead}>
          Siempre la misma afinación, el mismo 4/4, las mismas cuatro progresiones. Scordatura te saca de ahí:
          sortea restricciones con teoría real detrás, y vos las convertís en música. No compone por vos.
        </p>
      </section>

      <section className={styles.block} aria-labelledby="como">
        <h2 id="como">Cómo funciona</h2>
        <ol className={styles.steps}>
          <li>
            <strong>Sorteás.</strong> Sale una consigna completa: afinación, ritmo, armonía, melodía, letra,
            forma, una carta y un drone.
          </li>
          <li>
            <strong>Trabás.</strong> Oís cada parte, te quedás con lo que te sirve y volvés a sortear el
            resto. Cada resultado muestra la regla que lo generó.
          </li>
          <li>
            <strong>Tocás y grabás.</strong> Agarrás el instrumento sobre la base. La idea queda en tu Diario,
            junto con la consigna que la generó.
          </li>
        </ol>
      </section>

      <section className={styles.closing}>
        <p>Una scordatura es afinar un instrumento de otra manera, para que tus manos no sepan adónde ir.</p>
        <Link to="/" className={styles.cta} data-testid="cta">
          Sortear una consigna →
        </Link>
      </section>
    </div>
  );
}
