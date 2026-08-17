#!/usr/bin/env node
/**
 * Rebuild `card_states` from the review log.
 *
 * The log is the only irreplaceable data here; `card_states` is a cache. This
 * script proves that claim rather than asserting it: it replays every review
 * through the same scheduler the trainer uses and emits the resulting state as
 * SQL.
 *
 *   FLASHCARDS_API=... FLASHCARDS_TOKEN=... node scripts/rebuild-states.mjs
 *   node scripts/rebuild-states.mjs --file reviews-2026-08-17.json
 *
 * It writes SQL to stdout (or --out) and applies nothing. Deliberately: the
 * Worker has exactly one write route and it appends reviews. Giving the
 * public-facing API a route that can overwrite state wholesale would be a far
 * larger surface than an administrative job needs. Apply it yourself:
 *
 *   npx wrangler d1 execute markets-first-principles-flashcards --remote \
 *     --file=rebuilt-states.sql
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { apiConfig, fetchLog, readLogFile } from './flashcards-api.mjs';
import { rebuildStates, statesToSql } from '../src/lib/rebuild.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DECKS = path.join(ROOT, 'src/content/flashcards');

const args = process.argv.slice(2);
const valueOf = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
};

const reviews = valueOf('--file')
  ? await readLogFile(valueOf('--file'))
  : await fetchLog(apiConfig());

if (reviews.length === 0) {
  console.error('The log is empty; nothing to rebuild.');
  process.exit(1);
}

// Card ids that still exist. History for anything else is reported rather than
// rebuilt: a state row for a card nobody can see is noise, and the fact that
// the history exists at all is worth saying out loud.
const knownCards = new Set();
for (const file of fs.readdirSync(DECKS)) {
  if (!file.endsWith('.json') || file === 'tombstones.json') continue;
  const deck = JSON.parse(fs.readFileSync(path.join(DECKS, file), 'utf8'));
  for (const card of deck.cards ?? []) knownCards.add(card.id);
}

const { states, orphaned, cards } = rebuildStates(reviews, { knownCards });

console.error(`${reviews.length} reviews over ${cards} cards → ${states.length} states`);
if (orphaned.length > 0) {
  console.error(
    `\n${orphaned.length} card(s) have review history but no card in the decks:\n  ` +
      orphaned.join('\n  ') +
      '\nThe history is untouched. Either restore the id or add a tombstone entry.\n'
  );
}

const sql = statesToSql(states);
const out = valueOf('--out');
if (out) {
  fs.writeFileSync(out, sql);
  console.error(`written to ${out}`);
  console.error(
    `apply with:\n  npx wrangler d1 execute markets-first-principles-flashcards --remote --file=${out}`
  );
} else {
  process.stdout.write(sql);
}
