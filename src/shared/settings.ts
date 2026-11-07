// Preferencias que comparten todas las herramientas. Se guardan en este navegador.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DeckState } from '~/core/deck';
import { isNote, type Notation } from '~/core/notes';
import type { Risk } from '~/core/roll';
import { STANDARD } from '~/data/tunings';

export interface OwnCard {
  id: string;
  text: string;
}

export type TunerMode = 'guided' | 'auto';
export type ClickSoundId = 'clic' | 'madera' | 'cencerro' | 'bateria' | 'palmas';
export type ChannelId = 'master' | 'instrumento' | 'ritmo' | 'drone';
const CLICK_SOUNDS: readonly ClickSoundId[] = ['clic', 'madera', 'cencerro', 'bateria', 'palmas'];

interface Settings {
  notation: Notation;
  a4: number;
  clickSound: ClickSoundId;
  volumes: Record<ChannelId, number>;
  /** Por dónde va cada mazo de cartas, para no repetir hasta dar toda la vuelta. */
  decks: Record<string, DeckState>;
  risk: Risk;
  tunerMode: TunerMode;
  sidebarCollapsed: boolean;
  customNotes: string[];
  ownCards: OwnCard[];
  set: (patch: Partial<Omit<Settings, 'set'>>) => void;
}

const DEFAULT_VOLUMES: Record<ChannelId, number> = { master: 0.85, instrumento: 0.8, ritmo: 0.8, drone: 0.8 };

const memoryStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };

/** Lo guardado puede venir de otra versión o estar corrupto: lo que no sirve se descarta. */
function sanitize(saved: Partial<Settings>): Partial<Settings> {
  const clean: Partial<Settings> = {};
  if (saved.notation === 'letters' || saved.notation === 'solfege') clean.notation = saved.notation;
  if (typeof saved.a4 === 'number' && saved.a4 >= 415 && saved.a4 <= 466) clean.a4 = saved.a4;
  if (saved.clickSound && CLICK_SOUNDS.includes(saved.clickSound)) clean.clickSound = saved.clickSound;
  if (saved.volumes && typeof saved.volumes === 'object') {
    const volumes = { ...DEFAULT_VOLUMES };
    for (const channel of Object.keys(volumes) as ChannelId[]) {
      const value = saved.volumes[channel];
      if (typeof value === 'number' && value >= 0 && value <= 1) volumes[channel] = value;
    }
    clean.volumes = volumes;
  }
  if (saved.decks && typeof saved.decks === 'object') {
    const valid = Object.entries(saved.decks).filter(
      ([, deck]) => Array.isArray(deck?.order) && typeof deck?.position === 'number',
    );
    clean.decks = Object.fromEntries(valid);
  }
  if (saved.risk === 0 || saved.risk === 1 || saved.risk === 2) clean.risk = saved.risk;
  if (saved.tunerMode === 'guided' || saved.tunerMode === 'auto') clean.tunerMode = saved.tunerMode;
  if (typeof saved.sidebarCollapsed === 'boolean') clean.sidebarCollapsed = saved.sidebarCollapsed;
  if (Array.isArray(saved.customNotes) && saved.customNotes.length === 6 && saved.customNotes.every(isNote)) {
    clean.customNotes = saved.customNotes;
  }
  if (Array.isArray(saved.ownCards)) {
    clean.ownCards = saved.ownCards.filter(
      (card) => typeof card?.id === 'string' && typeof card?.text === 'string',
    );
  }
  return clean;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      notation: 'letters',
      a4: 440,
      clickSound: 'clic',
      volumes: { ...DEFAULT_VOLUMES },
      decks: {},
      risk: 1,
      tunerMode: 'guided',
      sidebarCollapsed: false,
      customNotes: [...STANDARD],
      ownCards: [],
      set: (patch) => set(patch),
    }),
    {
      name: 'scordatura',
      version: 2,
      // Cualquier versión anterior se lee igual: sanitize descarta lo que ya no existe, como el mood.
      migrate: (saved) => saved as Settings,
      storage: createJSONStorage(() => (typeof window === 'undefined' ? memoryStorage : window.localStorage)),
      partialize: ({ set: _set, ...rest }) => rest,
      merge: (saved, current) => ({ ...current, ...sanitize((saved ?? {}) as Partial<Settings>) }),
    },
  ),
);
