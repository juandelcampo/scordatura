import { useEffect, useRef, useState } from 'react';
import { useSearchParams, type MetaFunction } from 'react-router';
import { CARDS } from '~/data/cards';
import { nextCard, previousCard } from '~/core/deck';
import { createRng, randomSeed } from '~/core/rng';
import { RISK_NAMES } from '~/core/roll';
import { publishToConsigna } from '~/shared/consigna';
import { useSettings } from '~/shared/settings';
import { useHydrated } from '~/shared/useHydrated';
import { Button, PageTitle, Slab, SlabHead } from '~/shared/ui/ui';
import styles from './cartas.module.css';

export const meta: MetaFunction = () => [
  { title: 'Cartas de estrategias para componer · Scordatura' },
  {
    name: 'description',
    content: 'Un mazo de consignas concretas para destrabar una canción, y un lugar para escribir las tuyas.',
  },
];

interface Drawn {
  serial: string;
  text: string;
  note: string;
  key: string;
}

const serialOf = (id: number) => `Nº ${String(id).padStart(3, '0')}`;

export default function CartasRoute() {
  const risk = useSettings((s) => s.risk);
  const ownCards = useSettings((s) => s.ownCards);
  const set = useSettings((s) => s.set);
  const [params, setParams] = useSearchParams();
  const hydrated = useHydrated();
  const [draft, setDraft] = useState('');
  const [includeOwn, setIncludeOwn] = useState(true);
  const loaded = useRef(false);

  const deck: Drawn[] = [
    ...CARDS.filter((card) => card.risk === risk).map((card) => ({
      serial: serialOf(card.id),
      text: card.text,
      note: `Rompe ${card.breaks}.`,
      key: String(card.id),
    })),
    ...(includeOwn
      ? ownCards.map((card) => ({
          serial: 'Tuya',
          text: card.text,
          note: 'La escribiste vos.',
          key: card.id,
        }))
      : []),
  ];

  const requested = hydrated ? params.get('c') : null;
  const sharedCard = CARDS.find((card) => String(card.id) === requested);
  const shown: Drawn | undefined = sharedCard
    ? {
        serial: serialOf(sharedCard.id),
        text: sharedCard.text,
        note: `Rompe ${sharedCard.breaks}.`,
        key: String(sharedCard.id),
      }
    : ownCards
        .filter((card) => card.id === requested)
        .map((card) => ({ serial: 'Tuya', text: card.text, note: 'La escribiste vos.', key: card.id }))[0];

  const decks = useSettings((s) => s.decks);
  const deckKey = `${risk}${includeOwn && ownCards.length ? '+' : ''}`;
  const deckState = decks[deckKey];

  const publish = (key: string) => {
    const card = deck.find((item) => item.key === key);
    const known = CARDS.find((item) => String(item.id) === key);
    if (known) publishToConsigna('carta', { id: known.id, text: known.text, breaks: known.breaks });
    else if (card) publishToConsigna('carta', { text: card.text });
  };

  const showKey = (key: string) => setParams({ c: key }, { replace: true, preventScrollReset: true });

  const advance = (mine: boolean) => {
    const next = nextCard(
      deckState,
      deck.map((card) => card.key),
      createRng(randomSeed()),
    );
    const key = next.order[next.position];
    set({ decks: { ...decks, [deckKey]: next } });
    if (!key) return;
    showKey(key);
    if (mine) publish(key);
  };

  const draw = () => advance(true);

  const goBack = () => {
    if (!deckState || deckState.position <= 0) return;
    const previous = previousCard(deckState);
    const key = previous.order[previous.position];
    set({ decks: { ...decks, [deckKey]: previous } });
    if (key) {
      showKey(key);
      publish(key);
    }
  };

  // Al entrar sin una carta pedida, sale la que sigue. Cambiar el riesgo no descarta la que está a la vista.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    if (!params.get('c')) advance(false);
  });

  const addCard = () => {
    const text = draft.trim();
    if (!text) return;
    const id = `tuya-${Date.now().toString(36)}`;
    set({ ownCards: [...ownCards, { id, text }] });
    setDraft('');
  };

  return (
    <div>
      <Slab>
        <PageTitle eyebrow={`Mazo ${RISK_NAMES[risk].toLowerCase()}`} title="Cartas">
          <p>
            Una consigna para cuando no sabés cómo seguir. Hacele caso aunque no te guste, y fijate qué pasa.
          </p>
        </PageTitle>
      </Slab>

      <div className={styles.layout}>
        <Slab>
          {/* El texto de la carta se reserva en la página estática para que no salte al cargar. */}
          <article className={styles.card} aria-live="polite" data-testid="card">
            <header className={styles.cardHead}>
              <span>Ficha de consigna</span>
              <span>{shown?.serial ?? '···'}</span>
            </header>
            <p className={styles.cardText}>{shown?.text ?? 'Sacá una carta.'}</p>
            <p className={styles.cardNote}>{shown?.note ?? ' '}</p>
          </article>
          <div className={styles.actions}>
            <div className={styles.drawRow}>
              <Button onClick={goBack} id="previous-card" disabled={!deckState || deckState.position <= 0}>
                ← Anterior
              </Button>
              <Button variant="primary" full onClick={draw} id="draw">
                Sacar otra carta
              </Button>
            </div>
            {deckState && deckState.position >= 0 && (
              <p className={styles.count} data-testid="deck-count">
                Carta {deckState.position + 1} de {deckState.order.length} de este mazo. No se repite ninguna
                hasta dar toda la vuelta.
              </p>
            )}
            {ownCards.length > 0 && (
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={includeOwn}
                  onChange={(event) => setIncludeOwn(event.target.checked)}
                />
                Mezclar con mis cartas
              </label>
            )}
          </div>
        </Slab>

        <Slab>
          <SlabHead title="Tus cartas" />
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              addCard();
            }}
          >
            <label className={styles.formField}>
              <span>Nueva carta</span>
              <textarea
                rows={2}
                maxLength={160}
                value={draft}
                placeholder="Escribí una consigna"
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
            <button type="submit" className={styles.add} disabled={!draft.trim()}>
              Guardar
            </button>
          </form>
          {ownCards.length > 0 ? (
            <ul className={styles.own}>
              {ownCards.map((card) => (
                <li key={card.id}>
                  <span>{card.text}</span>
                  <Button
                    variant="mini"
                    ariaLabel={`Borrar la carta: ${card.text}`}
                    onClick={() => set({ ownCards: ownCards.filter((item) => item.id !== card.id) })}
                  >
                    Borrar
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>Todavía no escribiste ninguna. Quedan guardadas en este navegador.</p>
          )}
        </Slab>
      </div>
    </div>
  );
}
