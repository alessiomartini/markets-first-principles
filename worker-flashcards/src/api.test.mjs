import { beforeEach, describe, expect, it } from 'vitest';

import { handle, REVIEW_COLUMNS } from './api.js';

/**
 * A fake D1 that understands only the handful of statements this API issues.
 *
 * The alternative is @cloudflare/vitest-pool-workers, which is a further
 * dependency and a much slower test run. What matters here is the API's
 * behaviour — auth, validation, idempotency, export shape — and a stub that
 * enforces the primary-key constraint exercises all of it.
 */
function fakeD1() {
  const reviews = new Map();
  const states = new Map();

  const prepare = (sql) => ({
    sql,
    args: [],
    bind(...args) {
      return { ...this, args };
    },
    async all() {
      if (/FROM card_states/.test(this.sql)) {
        return { results: [...states.values()].sort((a, b) => a.due - b.due) };
      }
      if (/FROM reviews/.test(this.sql)) {
        const rows = [...reviews.values()].sort((a, b) => a.reviewed_at - b.reviewed_at);
        return { results: /DESC/.test(this.sql) ? rows.reverse() : rows };
      }
      return { results: [] };
    },
    run() {
      return apply(this);
    },
  });

  function apply(statement) {
    if (/INSERT OR IGNORE INTO reviews/.test(statement.sql)) {
      const row = Object.fromEntries(REVIEW_COLUMNS.map((c, i) => [c, statement.args[i]]));
      // The real constraint: primary key on review_id, IGNORE on conflict.
      if (!reviews.has(row.review_id)) reviews.set(row.review_id, row);
      return { success: true };
    }
    if (/INTO card_states/.test(statement.sql)) {
      const [card_id, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review, updated_at] =
        statement.args;
      states.set(card_id, {
        card_id, due, stability, difficulty, elapsed_days, scheduled_days,
        reps, lapses, state, last_review, updated_at,
      });
      return { success: true };
    }
    return { success: true };
  }

  return {
    prepare,
    async batch(statements) {
      return statements.map(apply);
    },
    _reviews: reviews,
    _states: states,
  };
}

const TOKEN = 'test-token-value';
let env;

beforeEach(() => {
  env = { DB: fakeD1(), API_TOKEN: TOKEN, ALLOWED_ORIGINS: 'https://alessiomartini.github.io' };
});

const review = (overrides = {}) => ({
  review_id: 'r-1',
  card_id: 'mgf-definition',
  reviewed_at: 1_760_000_000_000,
  rating: 3,
  state: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  stability: 2.3,
  difficulty: 5.1,
  duration_ms: 4200,
  client_id: 'test',
  algo_version: 'fsrs-6.0/w:deadbeef',
  ...overrides,
});

const post = (body, headers = {}) =>
  new Request('https://api.example/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, ...headers },
    body: JSON.stringify(body),
  });

describe('auth', () => {
  it('rejects an unauthenticated write', async () => {
    const request = new Request('https://api.example/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ reviews: [review()] }),
    });
    const response = await handle(request, env);

    expect(response.status).toBe(401);
    expect(env.DB._reviews.size).toBe(0);
  });

  it('rejects a wrong bearer token', async () => {
    const response = await handle(post({ reviews: [review()] }, { Authorization: 'Bearer nope' }), env);
    expect(response.status).toBe(401);
    expect(env.DB._reviews.size).toBe(0);
  });

  it('rejects reads too — there is no public endpoint', async () => {
    const response = await handle(new Request('https://api.example/api/export'), env);
    expect(response.status).toBe(401);
  });

  it('refuses to authorise when the server has no token configured', async () => {
    const response = await handle(post({ reviews: [review()] }), { ...env, API_TOKEN: undefined });
    expect(response.status).toBe(401);
  });

  it('accepts an Access assertion only when Access is declared enabled', async () => {
    const withHeader = new Request('https://api.example/api/states', {
      headers: { 'CF-Access-Jwt-Assertion': 'anything' },
    });

    // Without the flag, a client-supplied header proves nothing and the bearer
    // check still applies.
    expect((await handle(withHeader, env)).status).toBe(401);
    expect((await handle(withHeader, { ...env, ACCESS_ENABLED: 'true' })).status).toBe(200);
  });
});

describe('POST /api/reviews', () => {
  it('appends a review', async () => {
    const response = await handle(post({ reviews: [review()] }), env);

    expect(response.status).toBe(201);
    expect(env.DB._reviews.size).toBe(1);
    expect(env.DB._reviews.get('r-1').rating).toBe(3);
  });

  it('is idempotent: the same review_id twice leaves one row', async () => {
    await handle(post({ reviews: [review()] }), env);
    await handle(post({ reviews: [review({ rating: 1 })] }), env);

    expect(env.DB._reviews.size).toBe(1);
    // First write wins; the retry is ignored rather than overwriting.
    expect(env.DB._reviews.get('r-1').rating).toBe(3);
  });

  it('accepts the good rows in a batch and reports the bad ones', async () => {
    const response = await handle(
      post({ reviews: [review({ review_id: 'ok-1' }), { review_id: 'bad', card_id: 'x' }] }),
      env
    );
    const body = await response.json();

    // A malformed row must not block the queue: the client would retry the
    // whole batch forever and never drain it.
    expect(response.status).toBe(201);
    expect(body.accepted).toEqual(['ok-1']);
    expect(body.rejected).toHaveLength(1);
    expect(env.DB._reviews.size).toBe(1);
  });

  it('rejects a batch with nothing valid in it', async () => {
    const response = await handle(post({ reviews: [{ nonsense: true }] }), env);
    expect(response.status).toBe(400);
    expect(env.DB._reviews.size).toBe(0);
  });

  it('rejects an out-of-range rating', async () => {
    const response = await handle(post({ reviews: [review({ rating: 5 })] }), env);
    expect(response.status).toBe(400);
  });

  it('upserts card_states alongside the log', async () => {
    await handle(
      post({
        reviews: [review()],
        states: [{ card_id: 'mgf-definition', due: 123, stability: 2.3, difficulty: 5.1, reps: 1, lapses: 0, state: 1 }],
      }),
      env
    );

    expect(env.DB._states.get('mgf-definition').reps).toBe(1);
  });
});

describe('GET /api/export', () => {
  const authed = (path) =>
    new Request(`https://api.example${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });

  beforeEach(async () => {
    await handle(post({ reviews: [review({ review_id: 'a', reviewed_at: 2 }), review({ review_id: 'b', reviewed_at: 1 })] }), env);
  });

  it('round-trips the log as JSON in chronological order', async () => {
    const response = await handle(authed('/api/export?format=json'), env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reviews.map((r) => r.review_id)).toEqual(['b', 'a']);
    expect(Object.keys(body.reviews[0])).toEqual(REVIEW_COLUMNS);
  });

  it('emits CSV with the optimiser column order and a header', async () => {
    const response = await handle(authed('/api/export?format=csv'), env);
    const text = await response.text();
    const [header, ...rows] = text.trim().split('\n');

    expect(response.headers.get('Content-Type')).toMatch(/text\/csv/);
    expect(header).toBe(REVIEW_COLUMNS.join(','));
    expect(rows).toHaveLength(2);
  });

  it('quotes cells containing commas', async () => {
    await handle(post({ reviews: [review({ review_id: 'c', client_id: 'a,b' })] }), env);
    const text = await handle(authed('/api/export?format=csv'), env).then((r) => r.text());

    expect(text).toContain('"a,b"');
  });
});

describe('routing', () => {
  it('has no route that deletes or mutates a review', async () => {
    for (const method of ['DELETE', 'PUT', 'PATCH']) {
      const request = new Request('https://api.example/api/reviews/r-1', {
        method,
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      expect((await handle(request, env)).status).toBe(404);
    }
  });
});
