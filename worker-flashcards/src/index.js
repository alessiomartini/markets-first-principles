/**
 * Flashcards API Worker.
 *
 * Thin entry point: all request handling lives in api.js so it can be tested
 * without a Workers runtime.
 */
import { handle } from './api.js';

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
};
