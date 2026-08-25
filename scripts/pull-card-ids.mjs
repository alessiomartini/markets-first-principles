#!/usr/bin/env node
/**
 * Write the set of card ids that appear in the review log to
 * `.card-ids-in-log.json`, so `validate-cards.mjs` can run its most important
 * check: that no id with history has vanished from the decks without a
 * tombstone.
 *
 *   FLASHCARDS_API=... FLASHCARDS_TOKEN=... node scripts/pull-card-ids.mjs
 *
 * The file is gitignored. CI has no database credentials, so the check is
 * skipped there — loudly — and is meant to be run locally before renaming or
 * deleting a card. Renaming is the dangerous operation: the review history is
 * keyed on the id and nothing else, so a rename orphans every review ever
 * recorded about that card, silently and irreversibly.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { apiConfig, fetchLog, readLogFile } from './flashcards-api.mjs';

const OUT = fileURLToPath(new URL('../.card-ids-in-log.json', import.meta.url));

const fileArg = process.argv.indexOf('--file');
const reviews = fileArg === -1
  ? await fetchLog(apiConfig())
  : await readLogFile(process.argv[fileArg + 1]);

const ids = [...new Set(reviews.map((review) => review.card_id).filter(Boolean))].sort();
fs.writeFileSync(OUT, `${JSON.stringify(ids, null, 2)}\n`);

console.log(`${ids.length} card id(s) with review history written to .card-ids-in-log.json`);
console.log('`npm run validate:cards` will now check for orphaned history.');
