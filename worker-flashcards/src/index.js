/**
 * Flashcards API Worker.
 *
 * Thin entry point: all request handling lives in api.js so it can be tested
 * without a Workers runtime.
 */
import { backup, handle } from './api.js';

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (error) {
      // Never leak internals to the client; the detail goes to the log.
      console.error('unhandled', error);
      return new Response(JSON.stringify({ error: 'internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },

  /**
   * Weekly backup of the review log to R2.
   *
   * D1 has its own point-in-time recovery, but that protects against Cloudflare
   * losing the data, not against me dropping the table. A copy in a different
   * service, in a format readable without any of this code, is the one that
   * survives a mistake.
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      backup(env).then(
        (result) => console.log('backup', JSON.stringify(result)),
        (error) => console.error('backup failed', error)
      )
    );
    void event;
  },
};
