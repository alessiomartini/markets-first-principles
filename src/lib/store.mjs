/**
 * IndexedDB persistence for the trainer.
 *
 * The browser is the primary store, not a cache in front of the server. You can
 * open the trainer on a plane, review forty cards, close the tab, and the
 * reviews are still there — the network is a later, optional step. That is what
 * "local-first" means here, and it is the reason the review UI never awaits a
 * fetch before showing the next card.
 *
 * Four object stores:
 *   queue       reviews written locally and not yet acknowledged by the server
 *   quarantine  reviews the server refused, or that are locally unusable
 *   cards       the derived FSRS state per card (a cache; the log is the truth)
 *   meta        small scalars: last sync time, last server cursor
 *
 * IndexedDB's callback API is wrapped in promises here and nowhere else, so the
 * rest of the code can be read without it.
 */

export const DB_NAME = 'mfp-flashcards';
export const DB_VERSION = 2;

export const STORES = Object.freeze({
  queue: 'queue',
  quarantine: 'quarantine',
  reviews: 'reviews',
  cards: 'cards',
  meta: 'meta',
});

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * @param {IDBFactory} factory  injected so tests can pass fake-indexeddb
 */
export function openDatabase(factory = globalThis.indexedDB, name = DB_NAME) {
  if (!factory) throw new Error('no IndexedDB available');

  return new Promise((resolve, reject) => {
    const request = factory.open(name, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      // review_id is the key everywhere: it is generated on the client, it is
      // the server's primary key, and it is what makes a retry a no-op.
      if (!db.objectStoreNames.contains(STORES.queue)) {
        db.createObjectStore(STORES.queue, { keyPath: 'review_id' });
      }
      if (!db.objectStoreNames.contains(STORES.quarantine)) {
        db.createObjectStore(STORES.quarantine, { keyPath: 'review_id' });
      }
      // The local archive of every review ever made on this device. The queue
      // empties as rows are acknowledged, so without this the dashboard would
      // have to ask the server for history it already had — and would show
      // nothing at all offline.
      if (!db.objectStoreNames.contains(STORES.reviews)) {
        const reviews = db.createObjectStore(STORES.reviews, { keyPath: 'review_id' });
        reviews.createIndex('reviewed_at', 'reviewed_at');
        reviews.createIndex('card_id', 'card_id');
      }
      if (!db.objectStoreNames.contains(STORES.cards)) {
        db.createObjectStore(STORES.cards, { keyPath: 'card_id' });
      }
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
  });
}

/** A thin, promise-returning handle over one database. */
export class Store {
  constructor(db) {
    this.db = db;
  }

  static async open(factory, name) {
    return new Store(await openDatabase(factory, name));
  }

  #transaction(names, mode) {
    const tx = this.db.transaction(names, mode);
    const done = new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
    });
    return { tx, done };
  }

  async put(storeName, value) {
    const { tx, done } = this.#transaction([storeName], 'readwrite');
    tx.objectStore(storeName).put(value);
    await done;
    return value;
  }

  async putMany(storeName, values) {
    if (values.length === 0) return 0;
    const { tx, done } = this.#transaction([storeName], 'readwrite');
    const objectStore = tx.objectStore(storeName);
    for (const value of values) objectStore.put(value);
    await done;
    return values.length;
  }

  async get(storeName, key) {
    const { tx } = this.#transaction([storeName], 'readonly');
    return promisify(tx.objectStore(storeName).get(key));
  }

  async all(storeName) {
    const { tx } = this.#transaction([storeName], 'readonly');
    return (await promisify(tx.objectStore(storeName).getAll())) ?? [];
  }

  async count(storeName) {
    const { tx } = this.#transaction([storeName], 'readonly');
    return promisify(tx.objectStore(storeName).count());
  }

  async delete(storeName, key) {
    const { tx, done } = this.#transaction([storeName], 'readwrite');
    tx.objectStore(storeName).delete(key);
    await done;
  }

  async deleteMany(storeName, keys) {
    if (keys.length === 0) return;
    const { tx, done } = this.#transaction([storeName], 'readwrite');
    const objectStore = tx.objectStore(storeName);
    for (const key of keys) objectStore.delete(key);
    await done;
  }

  /**
   * Move records between stores in one transaction, so a crash cannot leave a
   * review in both the queue and quarantine — or, worse, in neither.
   */
  async move(fromStore, toStore, records) {
    if (records.length === 0) return;
    const { tx, done } = this.#transaction([fromStore, toStore], 'readwrite');
    const source = tx.objectStore(fromStore);
    const target = tx.objectStore(toStore);
    for (const record of records) {
      target.put(record);
      source.delete(record.review_id);
    }
    await done;
  }

  async meta(key, fallback = null) {
    const row = await this.get(STORES.meta, key);
    return row ? row.value : fallback;
  }

  async setMeta(key, value) {
    return this.put(STORES.meta, { key, value });
  }

  close() {
    this.db.close();
  }
}
