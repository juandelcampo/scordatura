// El diario de semillas: notas de voz y consignas guardadas, en IndexedDB de este navegador.
import { useCallback, useEffect, useState } from 'react';

export interface JournalEntry {
  id: string;
  createdAt: number;
  kind: 'audio' | 'consigna';
  /** Audio de la nota de voz. */
  blob?: Blob;
  name: string;
  note: string;
  /** Las condiciones en las que nació la idea. */
  consignaCode: string | null;
  consignaNumber: string | null;
  section: string | null;
}

/** Antes la consigna se llamaba "tirada": lo ya guardado se sigue leyendo. */
function migrateEntry(
  entry: JournalEntry & { tiradaCode?: string | null; tiradaNumber?: string | null },
): JournalEntry {
  return {
    ...entry,
    name: entry.name.replace(/^Tirada/, 'Consigna'),
    consignaCode: entry.consignaCode ?? entry.tiradaCode ?? null,
    consignaNumber: entry.consignaNumber ?? entry.tiradaNumber ?? null,
  };
}

const DB = 'scordatura';
const STORE = 'diario';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    transaction.oncomplete = () => {
      database.close();
      resolve(request.result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export async function addEntry(entry: Omit<JournalEntry, 'id' | 'createdAt'>): Promise<void> {
  const createdAt = Date.now();
  await run('readwrite', (store) =>
    store.put({ ...entry, id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`, createdAt }),
  );
  notify();
}

export async function updateEntry(entry: JournalEntry): Promise<void> {
  await run('readwrite', (store) => store.put(entry));
  notify();
}

export async function removeEntry(id: string): Promise<void> {
  await run('readwrite', (store) => store.delete(id));
  notify();
}

export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    run<JournalEntry[]>('readonly', (store) => store.getAll())
      .then((all) => setEntries(all.map(migrateEntry).sort((a, b) => b.createdAt - a.createdAt)))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
    listeners.add(load);
    return () => {
      listeners.delete(load);
    };
  }, [load]);

  return { entries, failed };
}
