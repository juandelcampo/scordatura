// Una carta rápida, sin salir de la consigna: usa el mismo mazo que Cartas, así tampoco se repite.
import { useState } from 'react';
import { Link } from 'react-router';
import { nextCard } from '~/core/deck';
import { createRng, randomSeed } from '~/core/rng';
import { CARDS } from '~/data/cards';
import { publishToConsigna } from '~/shared/consigna';
import { useSettings } from '~/shared/settings';
import { Button } from '~/shared/ui/ui';
import styles from './consigna.module.css';

interface Drawn {
  key: string;
  text: string;
  id?: number;
  breaks?: string;
}

export function CartaSuelta() {
  const [drawn, setDrawn] = useState<Drawn | null>(null);

  const draw = () => {
    const { risk, ownCards, decks, set } = useSettings.getState();
    const deck: Drawn[] = [
      ...CARDS.filter((card) => card.risk === risk).map((card) => ({
        key: String(card.id),
        text: card.text,
        id: card.id,
        breaks: card.breaks,
      })),
      ...ownCards.map((card) => ({ key: card.id, text: card.text })),
    ];
    const deckKey = `${risk}${ownCards.length ? '+' : ''}`;
    const next = nextCard(
      decks[deckKey],
      deck.map((card) => card.key),
      createRng(randomSeed()),
    );
    set({ decks: { ...decks, [deckKey]: next } });
    setDrawn(deck.find((card) => card.key === next.order[next.position]) ?? null);
  };

  const use = () => {
    if (!drawn) return;
    publishToConsigna('carta', {
      text: drawn.text,
      ...(drawn.id ? { id: drawn.id } : {}),
      ...(drawn.breaks ? { breaks: drawn.breaks } : {}),
    });
    setDrawn(null);
  };

  return (
    <>
      <Button variant="mini" id="loose-card" onClick={draw}>
        {drawn ? 'Otra carta' : 'Carta suelta'}
      </Button>
      {drawn && (
        <div className={styles.looseCard} data-testid="loose-card">
          <p className={styles.looseText}>{drawn.text}</p>
          {drawn.breaks && <p className={styles.looseNote}>Rompe {drawn.breaks}.</p>}
          <div className={styles.looseActions}>
            <Button variant="mini" onClick={use}>
              Ponerla en la consigna
            </Button>
            <Button variant="mini" onClick={() => setDrawn(null)}>
              Cerrar
            </Button>
            <Link className={styles.rowLink} to="/cartas">
              Abrir el mazo →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
