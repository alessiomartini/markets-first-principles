import 'fake-indexeddb/auto';
import { indexedDB } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Store, STORES } from './store.mjs';
import { REVIEW_FIELDS, Sync, backoffMs, localProblem, newReviewId } from './sync.mjs';
import { REVIEW_COLUMNS } from '../../worker-flashcards/src/api.js';

const TOKEN = 'token';
let clock = 1_760_000_000_000;
const now = () => clock;

let databaseCounter = 0;
let store;

async function freshStore() {
  databaseCounter += 1;
  return Store.open(indexedDB, `test-db-${databaseCounter}`);
}

function makeSync(fetchImpl, overrides = {}) {
  return new Sync({
    store,
    endpoint: 'https://api.example',
    getToken: () => TOKEN,
    fetch: fetchImpl,
    now,
    ...overrides,
  });
}

const okResponse = (body, status = 201) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

const review = (overrides = {}) => ({
  review_id: 'r-1',
  card_id: 'mgf-definition',
  reviewed_at: clock,
  rating: 3,
  state: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  stability: 2.3,
  difficulty: 5.1,
  duration_ms: 3000,
  algo_version: 'fsrs-6.0/w:deadbeef',
  ...overrides,
});

beforeEach(async () => {
  clock = 1_760_000_000_000;
  store = await freshStore();
});

describe('wire shape', () => {
  it('matches the columns the Worker writes', () => {
    // If these ever drift, a column silently stops being persisted and the
    // FSRS optimiser loses data that cannot be reconstructed afterwards.
    expect([...REVIEW_FIELDS]).toEqual([...REVIEW_COLUMNS]);
  });

  it('generates distinct review ids', () => {
    expect(newReviewId()).not.toBe(newReviewId());
  });
});

describe('local-first durability', () => {
  it('stores a review without touching the network', async () => {
    const fetchImpl = vi.fn();
    const sync = makeSync(fetchImpl);

    const result = await sync.enqueue(review(), { card_id: 'mgf-definition', due: clock, reps: 1 });

    expect(result.queued).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await store.count(STORES.queue)).toBe(1);
    expect((await sync.cardState('mgf-definition')).reps).toBe(1);
  });

  it('survives the object being thrown away — the data is in IndexedDB, not in memory', async () => {
    await makeSync(vi.fn()).enqueue(review());

    const revived = makeSync(vi.fn());
    await revived.flush().catch(() => {});
    expect(await store.count(STORES.queue)).toBe(1);
  });

  it('tags the client id onto the row', async () => {
    const sync = makeSync(vi.fn(), { clientId: 'laptop' });
    await sync.enqueue(review());

    const [row] = await store.all(STORES.queue);
    expect(row.client_id).toBe('laptop');
  });
});

describe('flush', () => {
  it('sends queued reviews and drops the acknowledged ones', async () => {
    const fetchImpl = vi.fn(async () => okResponse({ accepted: ['r-1'], rejected: [] }));
    const sync = makeSync(fetchImpl);
    await sync.enqueue(review());

    const result = await sync.flush();

    expect(result.sent).toBe(1);
    expect(await store.count(STORES.queue)).toBe(0);

    const [, options] = fetchImpl.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(Object.keys(body.reviews[0])).toEqual([...REVIEW_FIELDS]);
    expect(options.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('sends the same review_id on a retry, so the server can ignore the duplicate', async () => {
    let attempt = 0;
    const fetchImpl = vi.fn(async (_url, options) => {
      attempt += 1;
      if (attempt === 1) throw new Error('network down');
      return okResponse({ accepted: JSON.parse(options.body).reviews.map((r) => r.review_id) });
    });
    const sync = makeSync(fetchImpl);
    await sync.enqueue(review({ review_id: 'stable-id' }));

    await sync.flush();
    clock += 60_000;
    await sync.flush();

    const sentIds = fetchImpl.mock.calls.map(([, o]) => JSON.parse(o.body).reviews[0].review_id);
    expect(sentIds).toEqual(['stable-id', 'stable-id']);
    expect(await store.count(STORES.queue)).toBe(0);
  });

  it('keeps rows queued when the network fails, and backs off', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    });
    const sync = makeSync(fetchImpl);
    await sync.enqueue(review());

    const result = await sync.flush();

    expect(result.deferred).toBe(1);
    expect(sync.status.state).toBe('offline');
    const [row] = await store.all(STORES.queue);
    expect(row.attempts).toBe(1);
    expect(row.next_attempt_at).toBe(clock + backoffMs(1));

    // A second flush before the backoff expires must not hit the network again.
    await sync.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    clock += backoffMs(1);
    await sync.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('grows the backoff with each failure', () => {
    expect(backoffMs(1)).toBe(2_000);
    expect(backoffMs(2)).toBe(4_000);
    expect(backoffMs(3)).toBe(8_000);
    // and is capped, so a long outage does not schedule a retry next year
    expect(backoffMs(40)).toBe(5 * 60_000);
  });

  it('collapses concurrent flushes onto one request', async () => {
    // The gate is created up front: `flush` awaits IndexedDB several times
    // before it reaches the network, so a resolver assigned inside the fetch
    // stub does not exist yet at the point the test would call it.
    let openGate;
    const gate = new Promise((resolve) => {
      openGate = resolve;
    });
    const fetchImpl = vi.fn(async () => {
      await gate;
      return okResponse({ accepted: ['r-1'] });
    });
    const sync = makeSync(fetchImpl);
    await sync.enqueue(review());

    const first = sync.flush();
    const second = sync.flush();
    openGate();
    await Promise.all([first, second]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('respects the batch size', async () => {
    const fetchImpl = vi.fn(async (_url, options) =>
      okResponse({ accepted: JSON.parse(options.body).reviews.map((r) => r.review_id) })
    );
    const sync = makeSync(fetchImpl, { batchSize: 2 });
    for (const i of [1, 2, 3, 4, 5]) {
      await sync.enqueue(review({ review_id: `r-${i}`, reviewed_at: clock + i }));
    }

    await sync.flush();

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).reviews).toHaveLength(2);
    expect(await store.count(STORES.queue)).toBe(3);
  });

  it('sends the derived card state alongside the log', async () => {
    const fetchImpl = vi.fn(async () => okResponse({ accepted: ['r-1'] }));
    const sync = makeSync(fetchImpl);
    await sync.enqueue(review(), { card_id: 'mgf-definition', due: clock + 86_400_000, reps: 3 });

    await sync.flush();

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.states).toEqual([{ card_id: 'mgf-definition', due: clock + 86_400_000, reps: 3 }]);
  });

  it('does nothing without a token rather than firing unauthenticated requests', async () => {
    const fetchImpl = vi.fn();
    const sync = makeSync(fetchImpl, { getToken: () => null });
    await sync.enqueue(review());

    await sync.flush();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(sync.status.state).toBe('unconfigured');
    expect(await store.count(STORES.queue)).toBe(1);
  });
});

describe('quarantine', () => {
  it('refuses a locally invalid review instead of queueing it', async () => {
    const sync = makeSync(vi.fn());

    const result = await sync.enqueue(review({ rating: 9 }));

    expect(result.queued).toBe(false);
    expect(await store.count(STORES.queue)).toBe(0);
    expect(await store.count(STORES.quarantine)).toBe(1);
  });

  it('moves a corrupt record out of the queue so it cannot block the rest', async () => {
    const fetchImpl = vi.fn(async (_url, options) =>
      okResponse({ accepted: JSON.parse(options.body).reviews.map((r) => r.review_id) })
    );
    const sync = makeSync(fetchImpl);
    await sync.enqueue(review({ review_id: 'good' }));
    // Written straight to the store, as a half-finished write or an older
    // schema version would leave it.
    await store.put(STORES.queue, { review_id: 'broken', card_id: 'x' });

    await sync.flush();

    expect(await store.count(STORES.queue)).toBe(0);
    const [held] = await store.all(STORES.quarantine);
    expect(held.review_id).toBe('broken');
    expect(held.reason).toMatch(/corrupt/);
    // The good row still went out.
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).reviews[0].review_id).toBe('good');
  });

  it('quarantines the rows the server names and keeps the rest', async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse({ accepted: ['ok'], rejected: [{ review_id: 'nope', problem: 'card_id required' }] })
    );
    const sync = makeSync(fetchImpl);
    await sync.enqueue(review({ review_id: 'ok' }));
    await sync.enqueue(review({ review_id: 'nope', card_id: 'gone' }));

    await sync.flush();

    expect(await store.count(STORES.queue)).toBe(0);
    const [held] = await store.all(STORES.quarantine);
    expect(held.review_id).toBe('nope');
    expect(held.reason).toMatch(/card_id required/);
  });

  it('treats a 4xx as permanent and a 5xx as temporary', async () => {
    const sync = makeSync(vi.fn(async () => okResponse({}, 400)));
    await sync.enqueue(review());
    await sync.flush();
    expect(await store.count(STORES.quarantine)).toBe(1);

    const other = makeSync(vi.fn(async () => okResponse({}, 503)));
    await other.enqueue(review({ review_id: 'r-2' }));
    await other.flush();
    // Still queued: the server being broken is not the review's fault.
    expect(await store.count(STORES.queue)).toBe(1);
  });

  it('does not quarantine on 401 — a bad token is a config problem, not bad data', async () => {
    const sync = makeSync(vi.fn(async () => okResponse({}, 401)));
    await sync.enqueue(review());

    await sync.flush();

    expect(await store.count(STORES.quarantine)).toBe(0);
    expect(await store.count(STORES.queue)).toBe(1);
    expect(sync.status.state).toBe('error');
  });

  it('requeues quarantined rows that are usable again', async () => {
    const sync = makeSync(vi.fn(async () => okResponse({}, 400)));
    await sync.enqueue(review());
    await sync.flush();

    const result = await sync.retryQuarantined();

    expect(result.requeued).toBe(1);
    expect(await store.count(STORES.queue)).toBe(1);
    expect(await store.count(STORES.quarantine)).toBe(0);
  });

  it('leaves genuinely broken rows in quarantine when retrying', async () => {
    await store.put(STORES.quarantine, { review_id: 'broken', reason: 'corrupt: card_id missing' });
    const sync = makeSync(vi.fn());

    const result = await sync.retryQuarantined();

    expect(result).toEqual({ requeued: 0, stillBroken: 1 });
    expect(await store.count(STORES.quarantine)).toBe(1);
  });
});

describe('hydrate', () => {
  it('fills an empty cache from the server', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ states: [{ card_id: 'a', due: 1, updated_at: 10 }] }),
    }));

    const result = await makeSync(fetchImpl).hydrate();

    expect(result.hydrated).toBe(1);
    expect((await store.get(STORES.cards, 'a')).due).toBe(1);
  });

  it('keeps a newer local state — the server has not seen this queue yet', async () => {
    await store.put(STORES.cards, { card_id: 'a', due: 999, updated_at: 20 });
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ states: [{ card_id: 'a', due: 1, updated_at: 10 }] }),
    }));

    await makeSync(fetchImpl).hydrate();

    expect((await store.get(STORES.cards, 'a')).due).toBe(999);
  });
});

describe('status', () => {
  it('reports counts to subscribers as they change', async () => {
    const seen = [];
    const sync = makeSync(vi.fn(async () => okResponse({ accepted: ['r-1'] })));
    sync.subscribe((status) => seen.push({ ...status }));

    await sync.enqueue(review());
    await sync.flush();

    expect(seen[0].state).toBe('idle');
    expect(seen.some((s) => s.pending === 1)).toBe(true);
    expect(seen.some((s) => s.state === 'syncing')).toBe(true);
    expect(seen.at(-1)).toMatchObject({ state: 'idle', pending: 0, lastSyncAt: clock });
  });

  it('reports a queue left behind by a previous visit, instead of "synced"', async () => {
    // The bug this pins: a freshly constructed Sync holds zeroes, so the
    // indicator claimed everything was synced on a device that had closed the
    // tab with reviews still waiting. An indicator that under-reports unsent
    // data is worse than none — it is what you check before wiping a profile.
    await makeSync(vi.fn()).enqueue(review());

    const reopened = makeSync(vi.fn());
    const seen = [];
    reopened.subscribe((status) => seen.push({ ...status }));
    await reopened.refresh();

    expect(seen[0].pending).toBe(0); // the constructor's guess
    expect(seen.at(-1).pending).toBe(1); // the truth, once counted
  });

  it('says so when no server is configured', async () => {
    const sync = makeSync(vi.fn(), { getToken: () => null });
    await sync.refresh();

    expect(sync.status.state).toBe('unconfigured');
  });

  it('stops notifying after unsubscribe', async () => {
    const seen = [];
    const sync = makeSync(vi.fn());
    const off = sync.subscribe((status) => seen.push(status));
    off();

    await sync.enqueue(review());

    expect(seen).toHaveLength(1);
  });
});

describe('localProblem', () => {
  it('accepts a well-formed review', () => {
    expect(localProblem(review())).toBeNull();
  });

  it.each([
    ['review_id', { review_id: '' }],
    ['card_id', { card_id: undefined }],
    ['reviewed_at', { reviewed_at: 'yesterday' }],
    ['rating', { rating: 0 }],
    ['elapsed_days', { elapsed_days: null }],
  ])('rejects a bad %s', (_field, patch) => {
    expect(localProblem({ ...review(), ...patch })).not.toBeNull();
  });
});
