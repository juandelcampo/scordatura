import { useEffect, useMemo, useRef, useState } from 'react';
import type { MetaFunction } from 'react-router';
import { createRng, randomSeed } from '~/core/rng';
import { rollLyric } from '~/core/rollers';
import {
  assonantKey,
  consonantKey,
  cutUp,
  lastWord,
  metricCount,
  prosody,
  rhymeScheme,
  schemeProblems,
  stressIndex,
  syllabify,
  wordsIn,
} from '~/core/spanish';
import { IMAGE_POOL } from '~/data/pools';
import { publishToConsigna } from '~/shared/consigna';
import { useProject } from '~/shared/project';
import { SectionPicker } from '~/shared/SectionPicker';
import { useSettings } from '~/shared/settings';
import { Button, PageTitle, Segmented, Slab, SlabHead, Tabs } from '~/shared/ui/ui';
import styles from './letras.module.css';

export const meta: MetaFunction = () => [
  { title: 'Herramientas para escribir letras: sílabas, rimas y prosodia · Scordatura' },
  {
    name: 'description',
    content:
      'Contador de sílabas métricas, esquemas de rima, prosodia sobre el compás, diccionario de rimas, cut-up y escritura contra reloj.',
  },
];

const SCHEMES = ['', 'ABAB', 'AABB', 'ABBA', 'ABCB'];

function WriteTab() {
  const active = useProject((s) => s.active);
  const text = useProject((s) => s.sections[s.active]?.text) ?? '';
  const updateSection = useProject((s) => s.updateSection);
  const [target, setTarget] = useState(8);
  const [scheme, setScheme] = useState('ABAB');
  const [kind, setKind] = useState<'consonante' | 'asonante'>('asonante');
  const [forbidden, setForbidden] = useState('');
  const [strongEvery, setStrongEvery] = useState(4);
  const [pickup, setPickup] = useState(0);

  const lines = text.split('\n');
  const written = lines.filter((line) => wordsIn(line).length > 0);
  const scheme_ = rhymeScheme(written, kind);
  const keyOf = kind === 'consonante' ? consonantKey : assonantKey;
  const problems = scheme
    ? schemeProblems(
        written.map((line) => keyOf(lastWord(line))),
        scheme.repeat(Math.ceil(written.length / scheme.length)),
      )
    : [];
  const banned = forbidden.trim().toLowerCase();

  return (
    <>
      <Slab>
        <SlabHead title="Escribir">
          <SectionPicker />
        </SlabHead>
        <label className={styles.field}>
          <span>Letra de la sección {active}</span>
          <textarea
            rows={6}
            value={text}
            placeholder={'En un lugar de la Mancha\nde cuyo nombre no quiero acordarme'}
            data-testid="lyric-text"
            onChange={(event) => updateSection(active, { text: event.target.value })}
          />
        </label>
        <div className={styles.fields}>
          <label className={styles.field}>
            <span>Sílabas por verso</span>
            <input
              type="number"
              min={2}
              max={20}
              value={target}
              data-testid="target"
              onChange={(event) => setTarget(Number(event.target.value))}
            />
          </label>
          <label className={styles.field}>
            <span>Esquema</span>
            <select value={scheme} onChange={(event) => setScheme(event.target.value)} data-testid="scheme">
              {SCHEMES.map((value) => (
                <option key={value} value={value}>
                  {value || 'Sin esquema'}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.field}>
            <span>Rima</span>
            <Segmented
              label="Tipo de rima"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'asonante', label: 'Asonante' },
                { value: 'consonante', label: 'Consonante' },
              ]}
            />
          </div>
          <label className={styles.field}>
            <span>Palabra prohibida</span>
            <input
              value={forbidden}
              placeholder="noche"
              data-testid="forbidden"
              onChange={(event) => setForbidden(event.target.value)}
            />
          </label>
        </div>
      </Slab>

      <Slab>
        <SlabHead title="Métrica y rima" />
        {written.length === 0 ? (
          <p className={styles.hint}>
            Escribí unos versos y acá vas a ver cuántas sílabas tiene cada uno y cómo riman.
          </p>
        ) : (
          <ol className={styles.lines}>
            {written.map((line, index) => {
              const count = metricCount(line);
              const off = count.total !== target;
              const hasBanned = banned !== '' && wordsIn(line).some((word) => word.toLowerCase() === banned);
              const adjust =
                count.adjustment === 1
                  ? ' (+1: final aguda)'
                  : count.adjustment === -1
                    ? ' (−1: final esdrújula)'
                    : '';
              return (
                <li key={index} data-testid="line" data-off={off}>
                  <span className={styles.lineText}>{line}</span>
                  <span className={styles.lineMeta}>
                    <strong data-testid="line-count">{count.total}</strong> sílabas{adjust}
                    {' · '}rima <strong data-testid="line-rhyme">{scheme_[index]}</strong>
                    {off && ` · se va de ${target}`}
                    {problems.includes(index) && ` · no cumple ${scheme}`}
                    {hasBanned && ' · usa la palabra prohibida'}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <p className={styles.hint}>
          Sigue las reglas generales: sinalefa entre palabras, y final aguda +1 o esdrújula −1. Las licencias
          poéticas dependen de cómo lo leas, así que tomalo como guía.
        </p>
      </Slab>

      <Slab>
        <SlabHead title="Prosodia" />
        <p className={styles.hint}>
          Una sílaba por pulso. Si una sílaba acentuada cae en tiempo débil, se marca: es el error más difícil
          de oír en uno mismo.
        </p>
        <div className={styles.fields}>
          <label className={styles.field}>
            <span>Tiempo fuerte cada</span>
            <select value={strongEvery} onChange={(event) => setStrongEvery(Number(event.target.value))}>
              {[2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  {value} pulsos
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Sílabas antes del tiempo 1</span>
            <select value={pickup} onChange={(event) => setPickup(Number(event.target.value))}>
              {[0, 1, 2, 3].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.prosody}>
          {written.map((line, index) => (
            <div key={index} className={styles.prosodyLine} data-testid="prosody-line">
              {prosody(line, strongEvery, pickup).map((cell, cellIndex) => (
                <span
                  key={cellIndex}
                  data-strong={cell.strong}
                  data-stressed={cell.stressed}
                  data-clash={cell.clash}
                >
                  {cell.text}
                </span>
              ))}
            </div>
          ))}
        </div>
      </Slab>
    </>
  );
}

let wordsPromise: Promise<string[]> | null = null;
/** La lista pesa unos megas: se pide recién al buscar la primera rima. */
function loadWords(): Promise<string[]> {
  wordsPromise ??= fetch('/palabras.txt')
    .then((response) => {
      if (!response.ok) throw new Error('No se pudo cargar la lista');
      return response.text();
    })
    .then((text) => text.split('\n'))
    .catch((error) => {
      wordsPromise = null;
      throw error;
    });
  return wordsPromise;
}

const MAX_RESULTS = 90;
type RhymeMode = 'consonante' | 'asonante' | 'final' | 'vocal';

function matchingWords(words: string[], query: string, mode: RhymeMode): string[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return [];
  if (mode === 'final') return words.filter((word) => word.endsWith(clean));
  if (mode === 'vocal') {
    return words.filter((word) => {
      if (word.length > 7) return false;
      const syllable = syllabify(word)[stressIndex(word)] ?? '';
      return syllable.normalize('NFD').includes(clean);
    });
  }
  const keyOf = mode === 'consonante' ? consonantKey : assonantKey;
  const key = keyOf(clean);
  return words.filter((word) => word !== clean && keyOf(word) === key);
}

/** Una muestra repartida por todo el alfabeto, distinta en cada búsqueda. */
function sample(found: string[], next: () => number): string[] {
  if (found.length <= MAX_RESULTS) return found;
  const step = found.length / MAX_RESULTS;
  const offset = next() * step;
  return Array.from({ length: MAX_RESULTS }, (_, index) => found[Math.floor(offset + index * step)]!);
}

function RhymesTab() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<RhymeMode>('consonante');
  const [results, setResults] = useState<string[] | null>(null);
  const [status, setStatus] = useState('');

  const search = async () => {
    setStatus('Buscando…');
    try {
      const words = await loadWords();
      const found = matchingWords(words, query, mode);
      setResults(sample(found, createRng(randomSeed()).next));
      if (found.length === 0) setStatus('No encontré palabras.');
      else if (found.length > MAX_RESULTS)
        setStatus(`${found.length} palabras. Muestra de ${MAX_RESULTS}: buscá de nuevo para ver otras.`);
      else setStatus(`${found.length} palabras.`);
    } catch {
      setStatus('No se pudo cargar el diccionario. Revisá la conexión y probá de nuevo.');
    }
  };

  const placeholder = mode === 'final' ? 'ción' : mode === 'vocal' ? 'a' : 'camino';

  return (
    <Slab>
      <SlabHead title="Diccionario de rimas" />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <div className={styles.fields}>
          <label className={styles.field}>
            <span>{mode === 'final' ? 'Terminación' : mode === 'vocal' ? 'Vocal tónica' : 'Palabra'}</span>
            <input
              value={query}
              placeholder={placeholder}
              data-testid="rhyme-query"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Buscar por</span>
            <select
              value={mode}
              data-testid="rhyme-mode"
              onChange={(event) => setMode(event.target.value as RhymeMode)}
            >
              <option value="consonante">Rima consonante</option>
              <option value="asonante">Rima asonante</option>
              <option value="final">Terminación</option>
              <option value="vocal">Vocal tónica</option>
            </select>
          </label>
          <button type="submit" className={styles.submit} id="rhyme-search">
            Buscar
          </button>
        </div>
      </form>
      <p className={styles.hint}>
        Para notas largas conviene una vocal tónica abierta (a, e, o), que se canta mejor. La lista es muy
        amplia e incluye palabras poco comunes.
      </p>
      <p role="status" className={styles.hint}>
        {status}
      </p>
      {results && results.length > 0 && (
        <ul className={styles.words} data-testid="rhyme-results">
          {results.map((word) => (
            <li key={word}>{word}</li>
          ))}
        </ul>
      )}
    </Slab>
  );
}

function MaterialTab() {
  const risk = useSettings((s) => s.risk);
  const active = useProject((s) => s.active);
  const updateSection = useProject((s) => s.updateSection);
  const [seed, setSeed] = useState(1);
  const roll = useMemo(() => {
    const rng = createRng(seed);
    return {
      object: rng.pick(IMAGE_POOL.objects),
      place: rng.pick(IMAGE_POOL.places),
      verb: rng.pick(IMAGE_POOL.verbs),
      title: rng.pick(IMAGE_POOL.titles),
      forbidden: rng.pick(IMAGE_POOL.forbidden),
      restriction: rng.pick(IMAGE_POOL.restrictions),
      consigna: rollLyric({ risk, rng }),
    };
  }, [seed, risk]);

  const rows: Array<[string, string, string]> = [
    [
      'Imagen',
      `${roll.object}, ${roll.place}, ${roll.verb}`,
      'Un objeto, un lugar y un verbo: lo concreto escapa de las palabras abstractas.',
    ],
    ['Título primero', roll.title, 'Escribí la letra hacia este título, para que llegue a algún lado.'],
    ['Sin decir', roll.forbidden, 'Si no podés nombrarlo, tenés que mostrarlo.'],
    ['Restricción', roll.restriction, 'Limitar lo que se puede decir empuja a decir otra cosa.'],
    ['Consigna', roll.consigna.label, roll.consigna.rule],
  ];

  return (
    <Slab>
      <SlabHead title="Material">
        <Button id="roll-material" onClick={() => setSeed(randomSeed())}>
          Sortear
        </Button>
      </SlabHead>
      <dl className={styles.material} data-testid="material">
        {rows.map(([name, value, why]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
            <dd className={styles.why}>{why}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.fields}>
        <SectionPicker />
        <Button
          id="use-material"
          onClick={() => {
            updateSection(active, { lyric: roll.consigna.label });
            publishToConsigna('letra', { label: roll.consigna.label, rule: roll.consigna.rule });
          }}
        >
          Usar consigna en {active}
        </Button>
      </div>
    </Slab>
  );
}

function CutUpTab() {
  const [source, setSource] = useState('');
  const [pieces, setPieces] = useState<string[]>([]);
  const [rescued, setRescued] = useState<string[]>([]);
  return (
    <Slab>
      <SlabHead title="Cut-up" />
      <label className={styles.field}>
        <span>Pegá frases tuyas sueltas</span>
        <textarea
          rows={5}
          value={source}
          data-testid="cutup-source"
          onChange={(event) => setSource(event.target.value)}
        />
      </label>
      <div className={styles.fields}>
        <Button
          variant="primary"
          id="cut"
          onClick={() => {
            const rng = createRng(randomSeed());
            setPieces(cutUp(source, rng.next));
          }}
        >
          Cortar y mezclar
        </Button>
      </div>
      {pieces.length > 0 && <p className={styles.hint}>Tocá lo que te sorprenda para rescatarlo.</p>}
      <div className={styles.pieces} data-testid="cutup-pieces">
        {pieces.map((piece, index) => (
          <button key={`${piece}-${index}`} type="button" onClick={() => setRescued([...rescued, piece])}>
            {piece}
          </button>
        ))}
      </div>
      {rescued.length > 0 && (
        <>
          <h3 className={styles.subtitle}>Rescatado</h3>
          <p className={styles.rescued} data-testid="cutup-rescued">
            {rescued.join(' / ')}
          </p>
          <Button variant="mini" onClick={() => setRescued([])}>
            Vaciar
          </Button>
        </>
      )}
    </Slab>
  );
}

const CLOCK_SECONDS = 180;

function ClockTab() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [text, setText] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);
  const running = remaining !== null && remaining > 0;

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => setRemaining((value) => (value ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [running, remaining]);

  const minutes = remaining === null ? 3 : Math.floor(remaining / 60);
  const seconds = remaining === null ? 0 : remaining % 60;

  return (
    <Slab>
      <SlabHead title="Escritura con reloj" />
      <p className={styles.hint}>
        Tres minutos sin parar y sin borrar. Mientras corre el reloj, borrar no funciona.
      </p>
      <p className={styles.clock} data-testid="clock" role="timer">
        {minutes}:{String(seconds).padStart(2, '0')}
      </p>
      <Button
        variant="primary"
        id="clock-start"
        onClick={() => {
          setRemaining(running ? null : CLOCK_SECONDS);
          if (!running) area.current?.focus();
        }}
      >
        {running ? 'Parar' : 'Empezar'}
      </Button>
      <label className={styles.field}>
        <span>Escribí</span>
        <textarea
          ref={area}
          rows={8}
          value={text}
          data-testid="clock-text"
          onChange={(event) => {
            // Mientras corre el reloj, el texto solo puede crecer.
            if (!running || event.target.value.length >= text.length) setText(event.target.value);
          }}
        />
      </label>
      {remaining === 0 && <p className={styles.consigna}>Tiempo. Ahora sí, leelo y rescatá lo que sirva.</p>}
    </Slab>
  );
}

type TabId = 'escribir' | 'rimas' | 'material' | 'cutup' | 'reloj';

export default function LetrasRoute() {
  const [tab, setTab] = useState<TabId>('escribir');
  return (
    <div>
      <Slab>
        <PageTitle eyebrow="Letras" title="Letras">
          <p>No escribe la letra por vos: te da material crudo, restricciones y la teoría de la métrica.</p>
        </PageTitle>
      </Slab>
      <Tabs<TabId>
        label="Herramientas de letras"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'escribir', label: 'Escribir' },
          { value: 'rimas', label: 'Rimas' },
          { value: 'material', label: 'Material' },
          { value: 'cutup', label: 'Cut-up' },
          { value: 'reloj', label: 'Reloj' },
        ]}
      />
      {tab === 'escribir' && <WriteTab />}
      {tab === 'rimas' && <RhymesTab />}
      {tab === 'material' && <MaterialTab />}
      {tab === 'cutup' && <CutUpTab />}
      {tab === 'reloj' && <ClockTab />}
    </div>
  );
}
