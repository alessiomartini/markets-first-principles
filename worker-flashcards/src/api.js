/**
 * Request handling for the flashcards API, separated from the Worker entry
 * point so it can be unit-tested against a fake D1 without a runtime.
 *
 * Routes:
 *   POST /api/reviews   append reviews (idempotent) and upsert derived states
 *   GET  /api/states    current card_states, for a fresh device
 *   GET  /api/reviews   recent log, for a fresh device
 *   GET  /api/export    the whole log as CSV or JSON
 *
 * There is no route that deletes or modifies a review. That is the point.
 */

const MAX_BATCH = 500;

export const REVIEW_COLUMNS = [
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
];

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

/**
 * Authorisation.
 *
 * Cloudflare Access, when it is in front of the Worker, terminates the identity
 * check at the edge and forwards a signed assertion. We treat the presence of
 * that header as proof only if Access is declared to be enabled, because
 * otherwise anyone could set the header themselves — an "authenticated" check
 * that a client can satisfy by typing is worse than none.
 *
 * Without Access, a bearer token in a Worker secret guards every route. Adding
 * Access later requires setting ACCESS_ENABLED and nothing else here.
 */
export function authorise(request, env) {
  if (env.ACCESS_ENABLED === 'true') {
    const assertion = request.headers.get('CF-Access-Jwt-Assertion');
    if (!assertion) return { ok: false, reason: 'missing Access assertion' };
    // Access has already verified the JWT before the request reached us; the
    // Worker is not exposed except through Access when this flag is set.
    return { ok: true, via: 'access' };
  }

  const expected = env.API_TOKEN;
  if (!expected) return { ok: false, reason: 'server has no API_TOKEN configured' };

  const header = request.headers.get('Authorization') ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!presented || !timingSafeEqual(presented, expected)) {
    return { ok: false, reason: 'bad or missing bearer token' };
  }
  return { ok: true, via: 'token' };
}

/** Constant-time comparison, so the token cannot be recovered byte by byte. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function validReview(row) {
  if (!row || typeof row !== 'object') return 'not an object';
  if (typeof row.review_id !== 'string' || !row.review_id) return 'review_id required';
  if (typeof row.card_id !== 'string' || !row.card_id) return 'card_id required';
  if (!Number.isFinite(row.reviewed_at)) return 'reviewed_at must be epoch ms';
  if (![1, 2, 3, 4].includes(row.rating)) return 'rating must be 1-4';
  if (!Number.isFinite(row.state)) return 'state required';
  if (!Number.isFinite(row.elapsed_days)) return 'elapsed_days required';
  if (!Number.isFinite(row.scheduled_days)) return 'scheduled_days required';
  return null;
}

export async function handle(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  const auth = authorise(request, env);
  if (!auth.ok) {
    return json({ error: 'unauthorized', detail: auth.reason }, 401, corsHeaders(request, env));
  }

  const cors = corsHeaders(request, env);

  if (request.method === 'POST' && pathname === '/api/reviews') {
    return postReviews(request, env, cors);
  }
  if (request.method === 'GET' && pathname === '/api/states') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM card_states ORDER BY due ASC'
    ).all();
    return json({ states: results ?? [] }, 200, cors);
  }
  if (request.method === 'GET' && pathname === '/api/reviews') {
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 500), 5000);
    const { results } = await env.DB.prepare(
      'SELECT * FROM reviews ORDER BY reviewed_at DESC LIMIT ?'
    )
      .bind(limit)
      .all();
    return json({ reviews: results ?? [] }, 200, cors);
  }
  if (request.method === 'GET' && pathname === '/api/export') {
    return exportLog(url, env, cors);
  }

  return json({ error: 'not found' }, 404, cors);
}

async function postReviews(request, env, cors) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400, cors);
  }

  const rows = Array.isArray(payload) ? payload : payload?.reviews;
  if (!Array.isArray(rows) || rows.length === 0) {
    return json({ error: 'expected a non-empty array of reviews' }, 400, cors);
  }
  if (rows.length > MAX_BATCH) {
    return json({ error: `at most ${MAX_BATCH} reviews per request` }, 413, cors);
  }

  const rejected = [];
  const accepted = [];
  rows.forEach((row, index) => {
    const problem = validReview(row);
    if (problem) rejected.push({ index, review_id: row?.review_id ?? null, problem });
    else accepted.push(row);
  });

  // A malformed row must not take the good ones down with it: the client would
  // retry the whole batch forever and never drain its queue.
  if (accepted.length === 0) {
    return json({ error: 'no valid reviews', rejected }, 400, cors);
  }

  // INSERT OR IGNORE on the client-generated review_id is what makes this
  // idempotent — posting the same review twice leaves exactly one row.
  const insert = env.DB.prepare(
    `INSERT OR IGNORE INTO reviews
       (${REVIEW_COLUMNS.join(', ')})
     VALUES (${REVIEW_COLUMNS.map(() => '?').join(', ')})`
  );

  const statements = accepted.map((row) =>
    insert.bind(...REVIEW_COLUMNS.map((column) => row[column] ?? null))
  );

  // card_states is a cache, so it is written best-effort alongside the log and
  // can always be rebuilt by replay.
  const states = Array.isArray(payload?.states) ? payload.states : [];
  for (const state of states) {
    if (!state?.card_id) continue;
    statements.push(
      env.DB.prepare(
        `INSERT INTO card_states
           (card_id, due, stability, difficulty, elapsed_days, scheduled_days,
            reps, lapses, state, last_review, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(card_id) DO UPDATE SET
           due = excluded.due, stability = excluded.stability,
           difficulty = excluded.difficulty, elapsed_days = excluded.elapsed_days,
           scheduled_days = excluded.scheduled_days, reps = excluded.reps,
           lapses = excluded.lapses, state = excluded.state,
           last_review = excluded.last_review, updated_at = excluded.updated_at`
      ).bind(
        state.card_id,
        state.due ?? 0,
        state.stability ?? 0,
        state.difficulty ?? 0,
        state.elapsed_days ?? 0,
        state.scheduled_days ?? 0,
        state.reps ?? 0,
        state.lapses ?? 0,
        state.state ?? 0,
        state.last_review ?? null,
        Date.now()
      )
    );
  }

  await env.DB.batch(statements);

  return json(
    {
      ok: true,
      accepted: accepted.map((row) => row.review_id),
      rejected,
    },
    201,
    cors
  );
}

async function exportLog(url, env, cors) {
  const format = (url.searchParams.get('format') ?? 'json').toLowerCase();
  const { results } = await env.DB.prepare(
    `SELECT ${REVIEW_COLUMNS.join(', ')} FROM reviews ORDER BY reviewed_at ASC`
  ).all();
  const rows = results ?? [];
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    const lines = [REVIEW_COLUMNS.join(',')];
    for (const row of rows) {
      lines.push(REVIEW_COLUMNS.map((column) => csvCell(row[column])).join(','));
    }
    return new Response(lines.join('\n') + '\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reviews-${stamp}.csv"`,
        ...cors,
      },
    });
  }

  return new Response(JSON.stringify({ exported_at: Date.now(), reviews: rows }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="reviews-${stamp}.json"`,
      ...cors,
    },
  });
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origin = request.headers.get('Origin') ?? '';
  if (!allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
