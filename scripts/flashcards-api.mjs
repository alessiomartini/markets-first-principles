/**
 * Shared plumbing for the flashcard command-line tools.
 *
 * Credentials come from the environment and are never written to a file in the
 * repo. `.dev.vars`, exports and local databases are all gitignored; the token
 * belongs in a shell, a password manager, or `wrangler secret`.
 */

export function apiConfig() {
  const endpoint = (process.env.FLASHCARDS_API ?? '').replace(/\/$/, '');
  const token = process.env.FLASHCARDS_TOKEN ?? '';

  if (!endpoint || !token) {
    console.error(
      'Set FLASHCARDS_API and FLASHCARDS_TOKEN first:\n' +
        '  export FLASHCARDS_API=https://markets-first-principles-flashcards.<subdomain>.workers.dev\n' +
        '  export FLASHCARDS_TOKEN=...   # the value given to `wrangler secret put API_TOKEN`'
    );
    process.exit(2);
  }

  return { endpoint, token };
}

export async function fetchLog({ endpoint, token }) {
  const response = await fetch(`${endpoint}/api/export?format=json`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    console.error('The API rejected the token. Check FLASHCARDS_TOKEN.');
    process.exit(1);
  }
  if (!response.ok) {
    console.error(`The API returned ${response.status}.`);
    process.exit(1);
  }

  const { reviews = [] } = await response.json();
  return reviews;
}

/** Read a log from a file instead — an export downloaded from the trainer. */
export async function readLogFile(filePath) {
  const { readFile } = await import('node:fs/promises');
  const parsed = JSON.parse(await readFile(filePath, 'utf8'));
  return Array.isArray(parsed) ? parsed : (parsed.reviews ?? []);
}
