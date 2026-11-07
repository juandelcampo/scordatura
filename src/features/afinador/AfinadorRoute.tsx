import { useEffect, useMemo, useRef, useState, type MouseEvent, type RefObject } from 'react';
import { Link, NavLink, useNavigate, useParams, useSearchParams, type MetaFunction } from 'react-router';
import { isNote, noteLabel } from '~/core/notes';
import { createRng, randomSeed } from '~/core/rng';
import { rollTuning } from '~/core/rollers';
import { changeSummary, openChordName, soloShapes, stringIntervals, tensionWarning } from '~/core/tuning';
import { GROUPS, SOURCES, TUNINGS, type HeardItem, type Tuning } from '~/data/tunings';
import { publishToConsigna } from '~/shared/consigna';
import { Fader } from '~/shared/Fader';
import { useSettings } from '~/shared/settings';
import { useHydrated } from '~/shared/useHydrated';
import { Button, PageTitle, Segmented, Slab, SlabHead, Stepper } from '~/shared/ui/ui';
import styles from './afinador.module.css';
import { Neck, type NeckHandle } from './Neck';
import { TunerPanel } from './TunerPanel';
import { ARP_PATTERNS, STRUM_PATTERNS, useListener } from './useListener';

const DEFAULT_ID = 'cgcfce';
const CUSTOM_ID = 'tuya';
const CUSTOM_DESC = 'Armala con los botones − y + de cada cuerda. Queda guardada en este navegador.';

const findTuning = (id: string | undefined) => TUNINGS.find((tuning) => tuning.id === (id ?? DEFAULT_ID));

export const meta: MetaFunction = ({ params }) => {
  const tuning = findTuning(params.tuningId);
  if (!tuning || params.tuningId === CUSTOM_ID) {
    return [
      { title: 'Afinador de guitarra con afinaciones alternativas · Scordatura' },
      {
        name: 'description',
        content:
          'Afiná y escuchá 68 afinaciones de guitarra: abiertas, drop, modales, DADGAD y las de Nick Drake o Sonic Youth.',
      },
    ];
  }
  return [
    { title: `${tuning.name}: afinación de guitarra, notas y cómo suena · Scordatura` },
    {
      name: 'description',
      content: `${tuning.notes.map((note) => noteLabel(note)).join(' ')}. ${tuning.desc}`,
    },
  ];
};

const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function matches(tuning: Tuning, query: string): { match: boolean; item?: HeardItem } {
  if (!query) return { match: true };
  const texts = [tuning.name, tuning.notes.map((note) => note.replace(/\d/, '')).join('')];
  if (texts.some((text) => normalize(text).includes(query))) return { match: true };
  const item = (tuning.heard ?? []).find((entry) =>
    normalize(`${entry.artist} ${entry.song ?? ''} ${entry.who ?? ''}`).includes(query),
  );
  if (item) return { match: true, item };
  return { match: normalize(GROUPS.find((group) => group.id === tuning.group)?.name ?? '').includes(query) };
}

function TuningList({
  currentId,
  customNotes,
  onSelect,
}: {
  currentId: string;
  customNotes: string[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const notation = useSettings((s) => s.notation);
  const query = normalize(search.trim());

  const describe = (notes: string[]) =>
    notes.map((note) => noteLabel(note, notation)).join(notation === 'solfege' ? ' ' : '');
  const sections = GROUPS.map((group) => ({
    ...group,
    items: TUNINGS.filter((tuning) => tuning.group === group.id)
      .map((tuning) => ({ tuning, info: matches(tuning, query) }))
      .filter(({ info }) => info.match),
  })).filter((section) => section.items.length > 0);
  const empty = sections.length === 0;
  const select = (event: MouseEvent, id: string) => {
    // Abrir en otra pestaña no cuenta como elegir en esta.
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey) onSelect(id);
  };

  return (
    <aside className={styles.catalog} data-open={open}>
      <button
        type="button"
        className={styles.catalogToggle}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{open ? 'Cerrar lista' : `Elegir entre ${TUNINGS.length} afinaciones`}</span>
        <span aria-hidden="true">{open ? '↑' : '↓'}</span>
      </button>
      <div className={styles.catalogBody}>
        <label className={styles.search}>
          <span className="sr-only">Buscar por afinación, nota, artista o canción</span>
          <input
            type="search"
            value={search}
            placeholder="BUSCAR"
            autoComplete="off"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <nav className={styles.catalogList} aria-label="Afinaciones" onClick={() => setOpen(false)}>
          <div className={styles.groupTitle}>Tuya</div>
          <NavLink
            to={`/afinador/${CUSTOM_ID}`}
            onClick={(event) => select(event, CUSTOM_ID)}
            className={styles.tuningItem}
            aria-current={currentId === CUSTOM_ID ? 'page' : undefined}
          >
            <strong>Tu afinación</strong>
            <small>{describe(customNotes)}</small>
          </NavLink>
          {sections.map((section) => (
            <div key={section.id}>
              <div className={styles.groupTitle}>{section.name}</div>
              {section.items.map(({ tuning, info }) => {
                const noteText = describe(tuning.notes);
                return (
                  <NavLink
                    key={tuning.id}
                    to={`/afinador/${tuning.id}`}
                    onClick={(event) => select(event, tuning.id)}
                    className={styles.tuningItem}
                    data-id={tuning.id}
                    aria-current={tuning.id === currentId ? 'page' : undefined}
                  >
                    <strong>{tuning.name}</strong>
                    {noteText !== tuning.name && <small>{noteText}</small>}
                    {info.item && (
                      <small>
                        {info.item.song ? `${info.item.song} · ${info.item.artist}` : info.item.artist}
                      </small>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
          {empty && <p className={styles.empty}>No hay afinaciones con esa búsqueda.</p>}
        </nav>
      </div>
    </aside>
  );
}

function Hero({
  tuning,
  onRoll,
  onUndo,
}: {
  tuning: Tuning;
  onRoll: () => void;
  onUndo: (() => void) | null;
}) {
  const notation = useSettings((s) => s.notation);
  const { changed, semitones } = changeSummary(tuning.notes);
  const warning = tensionWarning(tuning);
  const group = GROUPS.find((item) => item.id === tuning.group);
  return (
    <Slab>
      <PageTitle eyebrow={group?.name ?? 'Personalizada'} title={tuning.name}>
        <p>{tuning.desc}</p>
      </PageTitle>
      <dl className={styles.facts}>
        <div>
          <dt>Al aire</dt>
          <dd data-testid="fact-chord">{openChordName(tuning.notes, notation)}</dd>
        </div>
        <div>
          <dt>Entre cuerdas</dt>
          <dd data-testid="fact-intervals">{stringIntervals(tuning.notes).join(' ')}</dd>
        </div>
        <div>
          <dt>Cuerdas que cambian</dt>
          <dd data-testid="fact-changes">
            {changed === 0
              ? 'Ninguna'
              : `${changed} de 6 · ${semitones} ${semitones === 1 ? 'semitono' : 'semitonos'}`}
          </dd>
        </div>
      </dl>
      {warning && <p className={styles.warning}>{warning}</p>}
      <div className={styles.heroActions}>
        <Button onClick={onRoll} id="roll-tuning">
          Sortear afinación
        </Button>
        <Button onClick={() => onUndo?.()} id="undo-tuning" disabled={!onUndo}>
          ↩ Volver
        </Button>
      </div>
    </Slab>
  );
}

function Heard({
  tuning,
  onCapo,
  onVideoOpen,
}: {
  tuning: Tuning;
  onCapo: (capo: number) => void;
  onVideoOpen: () => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const items = tuning.heard ?? [];
  if (items.length === 0 && tuning.octaves !== 'est') return null;
  return (
    <Slab className={styles.heard} label="Dónde se escuchó">
      {items.length > 0 && <h2 className={styles.heardTitle}>Se escuchó en</h2>}
      <ul>
        {items.map((item, index) => {
          const open = openIndex === index;
          const details = [
            item.artist,
            item.who,
            item.conf === 'fan' ? 'lista de fans' : item.conf === 'duda' ? 'discutida' : null,
          ].filter(Boolean);
          return (
            <li key={`${item.artist}-${item.song ?? ''}-${index}`}>
              <div className={styles.heardRow}>
                <div className={styles.heardText}>
                  {item.song && <strong>{item.song} </strong>}
                  <span>{details.join(' · ')}</span>
                </div>
                {(item.capo || item.video) && (
                  <div className={styles.heardActions}>
                    {item.capo && (
                      <Button
                        variant="mini"
                        ariaLabel={`Poner el capo en el traste ${item.capo} y tocar`}
                        onClick={() => onCapo(item.capo!)}
                      >
                        Capo {item.capo}
                      </Button>
                    )}
                    {item.video && (
                      <Button
                        variant="mini"
                        ariaExpanded={open}
                        ariaLabel={`Oír ${item.song}, de ${item.artist}`}
                        onClick={() => {
                          if (!open) onVideoOpen();
                          setOpenIndex(open ? null : index);
                        }}
                      >
                        {open ? '■ Cerrar' : '▶ Oír'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {/* El reproductor se crea recién al abrirlo: hasta entonces no se contacta a YouTube. */}
              {open && item.video && (
                <div className={styles.video}>
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${item.video}?autoplay=1&rel=0`}
                    title={`${item.song}, de ${item.artist}`}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {tuning.octaves === 'est' && (
        <p className={styles.hint}>
          Las fuentes dan estas notas sin octava: las octavas de esta afinación son una estimación.
        </p>
      )}
    </Slab>
  );
}

function TuningPage({
  tuning,
  editable,
  onEdit,
  onRoll,
  onUndo,
  pendingPlayRef,
  playTick,
}: {
  onUndo: (() => void) | null;
  tuning: Tuning;
  editable: boolean;
  onEdit: (notes: string[]) => void;
  onRoll: () => void;
  pendingPlayRef: RefObject<string | null>;
  playTick: number;
}) {
  const notation = useSettings((s) => s.notation);
  const a4 = useSettings((s) => s.a4);
  const neck = useRef<NeckHandle>(null);
  const listener = useListener(tuning.notes, a4, (stringIndex, velocity) =>
    neck.current?.excite(stringIndex, velocity),
  );
  const listenerTitle = useRef<HTMLDivElement>(null);
  const patterns = listener.style === 'arp' ? ARP_PATTERNS : STRUM_PATTERNS;
  const { playAscending } = listener;
  const shapes = useMemo(() => soloShapes(tuning.notes), [tuning.notes]);

  // Al elegir una afinación de la lista suena su arpegio ascendente, una sola vez.
  useEffect(() => {
    if (pendingPlayRef.current !== tuning.id) return;
    // En diferido: en desarrollo React monta, desmonta y vuelve a montar, y ese desmontaje
    // cortaría el arpegio después de la primera nota.
    const timer = setTimeout(() => {
      pendingPlayRef.current = null;
      playAscending();
    }, 0);
    return () => clearTimeout(timer);
  }, [playTick, tuning.id, pendingPlayRef, playAscending]);

  return (
    <>
      <Hero tuning={tuning} onRoll={onRoll} onUndo={onUndo} />
      <TunerPanel notes={tuning.notes} editable={editable} onEdit={onEdit} />

      <Slab>
        <div ref={listenerTitle}>
          <SlabHead title="Escuchar">
            <Segmented
              label="Forma de tocar"
              value={listener.style}
              options={[
                { value: 'arp', label: 'Arpegiado' },
                { value: 'strum', label: 'Rasgueado' },
              ]}
              onChange={listener.chooseStyle}
            />
          </SlabHead>
        </div>
        <Neck
          ref={neck}
          notes={tuning.notes}
          capo={listener.capo}
          frets={listener.frets}
          notation={notation}
          onPluck={(stringIndex, velocity) => listener.playString(stringIndex, undefined, velocity)}
          onToggleFret={listener.toggleFret}
        />
        <p className={styles.hint}>
          Tocá un traste para pisarlo y pasá el dedo por la zona de la derecha para rasguear a mano.
        </p>

        <div className={styles.controls}>
          <Button
            variant="primary"
            onClick={() => (listener.running ? listener.stop() : listener.start())}
            id="play-toggle"
          >
            {listener.running ? '■ Parar' : '▶ Tocar'}
          </Button>
          <label className={styles.field}>
            <span>Patrón</span>
            <select
              id="pattern"
              value={listener.patternId[listener.style]}
              onChange={(event) => listener.choosePattern(event.target.value)}
            >
              {patterns.map((pattern) => (
                <option key={pattern.id} value={pattern.id}>
                  {pattern.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Velocidad: {listener.tempo} ppm</span>
            <input
              type="range"
              min={40}
              max={160}
              step={5}
              value={listener.tempo}
              onChange={(event) => listener.setTempo(Number(event.target.value))}
            />
          </label>
          <div className={styles.field}>
            <span>Capo</span>
            <Stepper
              label="capo"
              value={
                <span data-testid="capo-value">{listener.capo ? `Traste ${listener.capo}` : 'Sin capo'}</span>
              }
              onDown={() => listener.setCapo(listener.capo - 1)}
              onUp={() => listener.setCapo(listener.capo + 1)}
            />
          </div>
          <label className={styles.check}>
            <input
              id="loop"
              type="checkbox"
              checked={listener.loop}
              onChange={(event) => listener.setLoop(event.target.checked)}
            />{' '}
            Repetir
          </label>
          <Button onClick={listener.clearFrets}>Soltar trastes</Button>
          <Fader channel="instrumento" />
          <Link className={styles.droneLink} to={`/drone?n=${tuning.notes.join(',').replaceAll('#', 's')}`}>
            Drone con estas cuerdas →
          </Link>
        </div>
      </Slab>

      <Slab>
        <SlabHead title="Qué suena solo" />
        <p className={styles.hint}>
          Acordes y bordones con las cuerdas al aire o un solo dedo. Tocá uno para oírlo.
        </p>
        <div className={styles.shapes} data-testid="solo-shapes">
          {shapes.map((shape) => (
            <button
              key={shape.frets.join()}
              type="button"
              aria-label={`${shape.label}: ${shape.chord}`}
              onClick={() => listener.applyShape(shape.frets)}
            >
              <strong>{shape.chord}</strong>
              <small>{shape.label}</small>
            </button>
          ))}
        </div>
      </Slab>

      <Heard
        tuning={tuning}
        onVideoOpen={listener.stop}
        onCapo={(capo) => {
          listener.setCapo(capo);
          listenerTitle.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(listener.start, 0);
        }}
      />

      <footer className={styles.sources}>
        <details>
          <summary>De dónde salen los datos</summary>
          <p>
            Muchas afinaciones de canciones se transcribieron de oído y no hay un registro oficial. Por eso
            los temas marcan si salen de listas de fans o si las fuentes se contradicen. Si tu oído dice otra
            cosa, probablemente tengas razón.
          </p>
          <p>Los videos son de YouTube y solo se cargan cuando los abrís.</p>
          <ul>
            {SOURCES.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      </footer>
    </>
  );
}

export default function AfinadorRoute() {
  const { tuningId } = useParams();
  const [params] = useSearchParams();
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const risk = useSettings((s) => s.risk);
  const customNotes = useSettings((s) => s.customNotes);
  const set = useSettings((s) => s.set);
  // Elegir de la lista pide un arpegio; la página de esa afinación lo toca al aparecer.
  const pendingPlayRef = useRef<string | null>(null);
  const [playTick, setPlayTick] = useState(0);

  const isCustom = tuningId === CUSTOM_ID;
  const sharedNotes = useMemo(() => {
    const notes = (hydrated ? params.get('n') : null)
      ?.split(',')
      .map((note) => note.replace(/^([A-G])s/, '$1#'));
    return notes?.length === 6 && notes.every(isNote) ? notes : null;
  }, [params, hydrated]);

  const tuning: Tuning | undefined = isCustom
    ? {
        id: CUSTOM_ID,
        name: 'Tu afinación',
        group: 'custom',
        notes: sharedNotes ?? customNotes,
        desc: CUSTOM_DESC,
      }
    : findTuning(tuningId);

  // De dónde se vino al sortear, para poder volver si salió algo que no querías.
  const [rolledFrom, setRolledFrom] = useState<Array<{ notes: string[]; name: string; href: string }>>([]);

  const roll = () => {
    const rolled = rollTuning({ risk, rng: createRng(randomSeed()) });
    if (tuning) {
      const href = isCustom
        ? `/afinador/${CUSTOM_ID}?n=${tuning.notes.join(',').replaceAll('#', 's')}`
        : `/afinador/${tuning.id}`;
      setRolledFrom((stack) => [...stack, { notes: tuning.notes, name: tuning.name, href }].slice(-30));
    }
    publishToConsigna('afinacion', {
      notes: rolled.value.notes,
      name: rolled.label,
      ...(rolled.href?.includes('?') ? {} : { href: rolled.href }),
    });
    if (rolled.href) navigate(rolled.href);
  };

  const goBack = () => {
    const previous = rolledFrom[rolledFrom.length - 1];
    if (!previous) return;
    setRolledFrom(rolledFrom.slice(0, -1));
    publishToConsigna('afinacion', {
      notes: previous.notes,
      name: previous.name,
      ...(previous.href.includes('?') ? {} : { href: previous.href }),
    });
    navigate(previous.href);
  };

  if (!tuning) {
    return (
      <Slab>
        <PageTitle title="Esa afinación no existe" />
        <NavLink to="/afinador">Volver al afinador</NavLink>
      </Slab>
    );
  }

  return (
    <div className={styles.page}>
      <TuningList
        currentId={tuning.id}
        customNotes={customNotes}
        onSelect={(id) => {
          pendingPlayRef.current = id;
          setPlayTick((tick) => tick + 1);
          const chosen = findTuning(id);
          if (id === CUSTOM_ID) publishToConsigna('afinacion', { notes: customNotes, name: 'Tu afinación' });
          else if (chosen) {
            publishToConsigna('afinacion', {
              notes: chosen.notes,
              name: chosen.name,
              href: `/afinador/${id}`,
            });
          }
        }}
      />
      {/* La clave reinicia trastes, capo y lectura al cambiar de afinación. */}
      <div
        className={styles.content}
        key={sharedNotes && isCustom ? `compartida:${sharedNotes.join()}` : tuning.id}
      >
        <TuningPage
          tuning={tuning}
          editable={isCustom}
          onRoll={roll}
          onUndo={rolledFrom.length > 0 ? goBack : null}
          pendingPlayRef={pendingPlayRef}
          playTick={playTick}
          onEdit={(notes) => {
            set({ customNotes: notes });
            publishToConsigna('afinacion', { notes, name: 'Tu afinación' });
            if (sharedNotes) navigate(`/afinador/${CUSTOM_ID}`, { replace: true });
          }}
        />
      </div>
    </div>
  );
}
