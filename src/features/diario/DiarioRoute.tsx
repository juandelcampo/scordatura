import { useEffect, useState } from 'react';
import { Link, type MetaFunction } from 'react-router';
import { addEntry, removeEntry, updateEntry, useJournal, type JournalEntry } from '~/shared/journal';
import { encodeConsigna, consignaNumber as numberOf } from '~/core/consigna';
import { useConsigna } from '~/shared/consigna';
import { useProject } from '~/shared/project';
import { RecordButton } from '~/shared/RecordButton';
import { Button, PageTitle, Slab, SlabHead } from '~/shared/ui/ui';
import styles from './diario.module.css';

export const meta: MetaFunction = () => [
  { title: 'Diario de semillas · Scordatura' },
  {
    name: 'description',
    content: 'Cada idea grabada queda pegada a la consigna y a la sección donde nació.',
  },
];

function AudioPlayer({ blob, name }: { blob: Blob; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const created = URL.createObjectURL(blob);
    setUrl(created); // eslint-disable-line react-hooks/set-state-in-effect -- la URL existe solo mientras está montado
    return () => URL.revokeObjectURL(created);
  }, [blob]);
  if (!url) return null;
  return (
    <div className={styles.audio}>
      <audio controls src={url} preload="metadata" aria-label={`Oír ${name}`} />
      <a className={styles.download} href={url} download={`${name.replace(/[^\w-]+/g, '_')}.webm`}>
        Descargar
      </a>
    </div>
  );
}

function Entry({ entry }: { entry: JournalEntry }) {
  const [note, setNote] = useState(entry.note);
  return (
    <li className={styles.entry} data-testid="entry" data-kind={entry.kind}>
      <div className={styles.entryHead}>
        <h3>{entry.name}</h3>
        <Button variant="mini" ariaLabel={`Borrar ${entry.name}`} onClick={() => void removeEntry(entry.id)}>
          Borrar
        </Button>
      </div>
      {entry.blob && <AudioPlayer blob={entry.blob} name={entry.name} />}
      <p className={styles.conditions}>
        {entry.consignaCode ? (
          <Link to={`/consigna?t=${encodeURIComponent(entry.consignaCode)}`}>
            Consigna Nº {entry.consignaNumber}
          </Link>
        ) : (
          'Sin consigna'
        )}
        {entry.section && ` · Sección ${entry.section}`}
      </p>
      <label className={styles.note}>
        <span>Nota</span>
        <textarea
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => {
            if (note !== entry.note) void updateEntry({ ...entry, note });
          }}
        />
      </label>
    </li>
  );
}

export default function DiarioRoute() {
  const { entries, failed } = useJournal();
  const consigna = useConsigna((s) => s.consigna);
  const started = useConsigna((s) => s.started);
  const consignaCode = started ? encodeConsigna(consigna) : null;
  const consignaNumber = started ? numberOf(consigna) : null;
  const section = useProject((s) => s.active);

  return (
    <div>
      <Slab>
        <PageTitle eyebrow="Diario de semillas" title="Diario">
          <p>Cada riff queda pegado a las condiciones en las que nació: su consigna y su sección.</p>
        </PageTitle>
        <div className={styles.actions}>
          <RecordButton />
          {consignaCode && (
            <Button
              id="save-consigna"
              onClick={() =>
                void addEntry({
                  kind: 'consigna',
                  name: `Consigna Nº ${consignaNumber}`,
                  note: '',
                  consignaCode,
                  consignaNumber,
                  section,
                })
              }
            >
              Guardar la consigna actual
            </Button>
          )}
        </div>
      </Slab>
      <Slab>
        <SlabHead title="Semillas" />
        {failed && <p>No se pudo abrir el diario en este navegador. Puede pasar en una ventana privada.</p>}
        {entries?.length === 0 && (
          <p className={styles.empty}>Todavía no hay nada. Grabá una idea y va a aparecer acá.</p>
        )}
        <ul className={styles.entries}>
          {entries?.map((entry) => (
            <Entry key={entry.id} entry={entry} />
          ))}
        </ul>
        <p className={styles.hint}>
          Queda guardado solo en este navegador: si borrás sus datos, se pierde. Descargá lo que quieras
          conservar.
        </p>
      </Slab>
    </div>
  );
}
