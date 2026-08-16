/**
 * Notes collector — the only server-side code in this project.
 *
 * Exposes exactly one route, POST /notes, which appends a row to D1. There is
 * no read endpoint on purpose: anything that can serve notes over HTTP is
 * something that can leak them, and the notes are read directly from D1 by
 * their author. Keeping the write path this narrow means the Worker has no
 * interesting attack surface beyond "someone inserts junk rows".
 */

const ALLOWED_ORIGINS = new Set([
  'https://alessiomartini.github.io',
  // Local preview of the built site.
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:4321',
  'http://127.0.0.1:4321',
]);

const MAX_TEXT = 2000;
const MAX_PAGE = 200;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const allowed = ALLOWED_ORIGINS.has(origin);

    if (request.method === 'OPTIONS') {
      // Preflight. Answer only for origins we would actually serve.
      return allowed
        ? new Response(null, { status: 204, headers: corsHeaders(origin) })
        : new Response(null, { status: 403 });
    }

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/notes') {
      return new Response('Not found', { status: 404 });
    }

    if (!allowed) {
      return new Response('Forbidden', { status: 403 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'invalid JSON' }, 400, origin);
    }

    // Honeypot: a field the real form keeps hidden and empty. A bot that fills
    // every input it finds gets a clean 201 and writes nothing, which is
    // quieter than an error — an error tells the bot what to change.
    if (typeof payload?.website === 'string' && payload.website.trim() !== '') {
      return json({ ok: true, id: null }, 201, origin);
    }

    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
    if (!text) {
      return json({ error: 'text is required' }, 400, origin);
    }
    if (text.length > MAX_TEXT) {
      return json({ error: `text exceeds ${MAX_TEXT} characters` }, 400, origin);
    }

    const page = typeof payload?.page === 'string' ? payload.page.slice(0, MAX_PAGE) : null;

    try {
      const result = await env.DB.prepare(
        "INSERT INTO notes (text, page, created_at) VALUES (?, ?, datetime('now'))"
      )
        .bind(text, page)
        .run();

      return json({ ok: true, id: result.meta?.last_row_id ?? null }, 201, origin);
    } catch (error) {
      console.error('insert failed', error);
      return json({ error: 'could not save note' }, 500, origin);
    }
  },
};
