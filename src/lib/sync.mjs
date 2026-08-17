/**
 * Local-first sync between the browser's IndexedDB and the flashcards Worker.
 *
 * The contract, in order of importance:
 *
 * 1. A review is durable the moment it is rated. `enqueue` writes to IndexedDB
 *    and returns; nothing in the review loop awaits the network. If the sync
 *    never happens, the review still exists locally and still schedules the
 *    card correctly.
 * 2. Retries are free. Every review carries a client-generated `review_id`,
 *    which is the server's primary key under INSERT OR IGNORE. Sending the same
 *    review after an ambiguous timeout produces one row, not two. This is why
 *    the queue can retry blindly and does not need to ask "did that land?".
 * 3. A bad record cannot stop the good ones. A row the server refuses, or one
 *    that fails local validation, moves to quarantine and is never retried. A
 *    queue that retries an unacceptable row forever is a queue that never
 *    drains, and it takes every review behind it down with it.
 *
 * Network failure and rejection are treated as different things. A fetch that
 * throws means "not now" — the row stays queued with a backoff. A 4xx naming
 * the row means "not ever" — it is quarantined and surfaced, because silently
 * dropping a review is data loss and silently retrying it is a hang.
 */

const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 5 * 60_000;
const DEFAULT_BATCH = 200;

import { STORES } from './store.mjs';

/**
 * The wire shape of a review. Must match REVIEW_COLUMNS in
 * worker-flashcards/src/api.js — `sync.test.mjs` imports both and asserts it,
 * so drift fails the test run rather than silently dropping a column that the
 * FSRS optimiser will want years from now.
 */
export const REVIEW_FIELDS = Object.freeze([
  'review_id',
  'card_id',
  'reviewed_at',
  'rating',
  'state',
  'elapsed_days',
  'scheduled_days',
  'stability',
  'difficulty',
  'duration_ms',
  'client_id',
  'algo_version',
]);

/** Mirrors the server's validation, so a hopeless row is caught before a round trip. */
export function localProblem(record) {
  if (!record || typeof record !== 'object') return 'not an object';
  if (typeof record.review_id !== 'string' || !record.review_id) return 'review_id missing';
  if (typeof record.card_id !== 'string' || !record.card_id) return 'card_id missing';
  if (!Number.isFinite(record.reviewed_at)) return 'reviewed_at missing';
  if (![1, 2, 3, 4].includes(record.rating)) return 'rating out of range';
  if (!Number.isFinite(record.state)) return 'state missing';
  if (!Number.isFinite(record.elapsed_days)) return 'elapsed_days missing';
  if (!Number.isFinite(record.scheduled_days)) return 'scheduled_days missing';
  return null;
}

export function backoffMs(attempts) {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_MAX_MS);
}

/** Strip the local bookkeeping fields; only the wire shape goes to the server. */
function wireShape(record) {
  const out = {};
  for (const field of REVIEW_FIELDS) out[field] = record[field] ?? null;
  return out;
}

export class Sync {
  /**
   * @param {object} options
   * @param {import('./store.mjs').Store} options.store
   * @param {string} options.endpoint      base URL of the Worker, no trailing slash
   * @param {() => (string|null)} options.getToken
   * @param {typeof fetch} [options.fetch]
   * @param {() => number} [options.now]
   */
  constructor({
    store,
    endpoint,
    getToken,
    fetch: fetchImpl,
    now,
    batchSize = DEFAULT_BATCH,
    clientId = 'browser',
    // When the Worker sits behind Cloudflare Access, the browser carries an
    // Access cookie and no bearer token exists to hold. Set this and the
    // absence of a token stops meaning "not configured".
    accessMode = false,
  }) {
    this.store = store;
    this.accessMode = accessMode;
    this.endpoint = (endpoint ?? '').replace(/\/$/, '');
    this.getToken = getToken ?? (() => null);
    this.fetch = fetchImpl ?? globalThis.fetch?.bind(globalThis);
    this.now = now ?? (() => Date.now());
    this.batchSize = batchSize;
    this.clientId = clientId;
    this.listeners = new Set();
    this.status = {
      state: 'idle',
      pending: 0,
      quarantined: 0,
      lastSyncAt: null,
      lastError: null,
    };
    this.inFlight = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  /**
   * Recount from the stores and notify.
   *
   * A freshly constructed Sync has zeroes in `status`, which is a lie on any
   * device that closed the tab with reviews still queued: the indicator said
   * "synced" while four reviews sat in IndexedDB. An indicator that
   * under-reports unsent data is worse than none, because it is exactly what
   * you would check before wiping a browser profile.
   */
  async refresh() {
    const configured = Boolean(this.endpoint) && (Boolean(this.getToken()) || this.accessMode);
    return this.#announce({
      state: configured ? this.status.state : 'unconfigured',
      lastSyncAt: (await this.store.meta('last_sync_at')) ?? this.status.lastSyncAt,
    });
  }

  async #announce(patch = {}) {
    this.status = {
      ...this.status,
      ...patch,
      pending: await this.store.count(STORES.queue),
      quarantined: await this.store.count(STORES.quarantine),
    };
    for (const listener of this.listeners) listener(this.status);
    return this.status;
  }

  /**
   * Record a review locally. Returns as soon as it is durable; the network
   * attempt is deliberately not awaited, so a slow or absent connection cannot
   * stall the next card.
   */
  async enqueue(review, cardState) {
    const record = {
      ...wireShape({ client_id: this.clientId, ...review }),
      attempts: 0,
      next_attempt_at: 0,
      queued_at: this.now(),
      last_error: null,
    };

    const problem = localProblem(record);
    if (problem) {
      // Quarantine immediately rather than writing a row that can never be
      // accepted — the queue is not a place to discover bugs later.
      await this.store.put(STORES.quarantine, { ...record, reason: `local: ${problem}` });
      await this.#announce({ state: 'error', lastError: problem });
      return { queued: false, problem };
    }

    await this.store.put(STORES.queue, record);
    if (cardState?.card_id) await this.store.put(STORES.cards, cardState);
    await this.#announce();
    return { queued: true };
  }

  /** The FSRS state for one card, from the local cache. */
  async cardState(cardId) {
    return this.store.get(STORES.cards, cardId);
  }

  async allCardStates() {
    return this.store.all(STORES.cards);
  }

  /**
   * Send whatever is due. Concurrent calls collapse onto the one in flight:
   * two tabs, or a timer racing an "online" event, must not send the same batch
   * twice — harmless server-side thanks to the primary key, but it would double
   * the traffic and confuse the indicator.
   */
  async flush() {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.#flush().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  async #flush() {
    const token = this.getToken();
    if (!this.endpoint || (!token && !this.accessMode)) {
      await this.#announce({ state: 'unconfigured' });
      return { sent: 0, reason: 'no endpoint or token' };
    }

    const queued = await this.store.all(STORES.queue);
    if (queued.length === 0) {
      await this.#announce({ state: 'idle', lastError: null });
      return { sent: 0 };
    }

    // Anything that fails validation now is corrupt — a partial write, a
    // schema change, a hand-edited record. It will never be accepted, so it
    // leaves the queue rather than blocking it.
    const corrupt = [];
    const eligible = [];
    const now = this.now();
    for (const record of queued) {
      const problem = localProblem(record);
      if (problem) corrupt.push({ ...record, reason: `corrupt: ${problem}` });
      else if ((record.next_attempt_at ?? 0) <= now) eligible.push(record);
    }
    if (corrupt.length > 0) await this.store.move(STORES.queue, STORES.quarantine, corrupt);

    if (eligible.length === 0) {
      await this.#announce({ state: 'idle' });
      return { sent: 0, waiting: queued.length - corrupt.length };
    }

    const batch = eligible
      .sort((a, b) => a.reviewed_at - b.reviewed_at)
      .slice(0, this.batchSize);

    await this.#announce({ state: 'syncing' });

    const states = await this.#statesFor(batch);

    let response;
    try {
      response = await this.fetch(`${this.endpoint}/api/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // Access identifies the browser by cookie; a bearer token needs no
        // credentials and should not carry any.
        credentials: this.accessMode ? 'include' : 'omit',
        body: JSON.stringify({ reviews: batch.map(wireShape), states }),
      });
    } catch (error) {
      // The network said no. Not the rows' fault: keep them, back off.
      await this.#defer(batch, String(error?.message ?? error));
      await this.#announce({ state: 'offline', lastError: String(error?.message ?? error) });
      return { sent: 0, deferred: batch.length };
    }

    if (response.status === 401 || response.status === 403) {
      // A bad token is a configuration problem, not a data problem. Retrying
      // every two seconds against a locked door helps nobody.
      await this.#defer(batch, `auth failed (${response.status})`, BACKOFF_MAX_MS);
      await this.#announce({ state: 'error', lastError: `not authorised (${response.status})` });
      return { sent: 0, deferred: batch.length };
    }

    if (!response.ok && response.status < 500) {
      // The server understood and refused. These rows will never be accepted.
      await this.store.move(
        STORES.queue,
        STORES.quarantine,
        batch.map((record) => ({ ...record, reason: `server ${response.status}` }))
      );
      await this.#announce({ state: 'error', lastError: `server refused (${response.status})` });
      return { sent: 0, quarantined: batch.length };
    }

    if (!response.ok) {
      await this.#defer(batch, `server error ${response.status}`);
      await this.#announce({ state: 'error', lastError: `server error ${response.status}` });
      return { sent: 0, deferred: batch.length };
    }

    let body = {};
    try {
      body = await response.json();
    } catch {
      // A 2xx with an unreadable body: assume it landed. The primary key makes
      // a wrong guess here cost one duplicate request, not one duplicate row.
      body = { accepted: batch.map((record) => record.review_id) };
    }

    const accepted = new Set(body.accepted ?? []);
    const rejected = body.rejected ?? [];

    await this.store.deleteMany(
      STORES.queue,
      batch.filter((record) => accepted.has(record.review_id)).map((record) => record.review_id)
    );

    if (rejected.length > 0) {
      const byId = new Map(batch.map((record) => [record.review_id, record]));
      const doomed = rejected
        .map((entry) => {
          const record = byId.get(entry.review_id);
          return record ? { ...record, reason: `server: ${entry.problem}` } : null;
        })
        .filter(Boolean);
      await this.store.move(STORES.queue, STORES.quarantine, doomed);
    }

    await this.store.setMeta('last_sync_at', this.now());
    await this.#announce({ state: 'idle', lastSyncAt: this.now(), lastError: null });

    return { sent: accepted.size, quarantined: rejected.length };
  }

  async #statesFor(batch) {
    const ids = [...new Set(batch.map((record) => record.card_id))];
    const states = [];
    for (const id of ids) {
      const state = await this.store.get(STORES.cards, id);
      if (state) states.push(state);
    }
    return states;
  }

  async #defer(batch, error, fixedDelay) {
    const now = this.now();
    await this.store.putMany(
      STORES.queue,
      batch.map((record) => {
        const attempts = (record.attempts ?? 0) + 1;
        return {
          ...record,
          attempts,
          last_error: error,
          next_attempt_at: now + (fixedDelay ?? backoffMs(attempts)),
        };
      })
    );
  }

  /**
   * Pull server state onto a device that has none. Only ever fills gaps: a
   * local card state that is newer than the server's is kept, because the
   * server may not yet have seen the reviews still sitting in this device's
   * queue.
   */
  async hydrate() {
    const token = this.getToken();
    if (!this.endpoint || (!token && !this.accessMode)) return { hydrated: 0 };

    const response = await this.fetch(`${this.endpoint}/api/states`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: this.accessMode ? 'include' : 'omit',
    });
    if (!response.ok) throw new Error(`could not fetch states (${response.status})`);

    const { states = [] } = await response.json();
    const fresh = [];
    for (const state of states) {
      const local = await this.store.get(STORES.cards, state.card_id);
      if (!local || (local.updated_at ?? 0) < (state.updated_at ?? 0)) fresh.push(state);
    }
    await this.store.putMany(STORES.cards, fresh);
    await this.#announce();
    return { hydrated: fresh.length };
  }

  async quarantined() {
    return this.store.all(STORES.quarantine);
  }

  /** Put quarantined rows back in the queue, after the cause has been fixed. */
  async retryQuarantined() {
    const rows = await this.store.all(STORES.quarantine);
    const usable = rows.filter((row) => !localProblem(row));
    await this.store.move(
      STORES.quarantine,
      STORES.queue,
      usable.map(({ reason, ...record }) => ({ ...record, attempts: 0, next_attempt_at: 0 }))
    );
    await this.#announce();
    return { requeued: usable.length, stillBroken: rows.length - usable.length };
  }
}

/** Generate a review id. Client-generated ids are what make retries idempotent. */
export function newReviewId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
