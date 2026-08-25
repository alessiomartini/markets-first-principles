/**
 * Rebuilding `card_states` from the review log.
 *
 * This is what makes the append-only log the real asset rather than a
 * diagnostic. `card_states` is a cache: if it is corrupted by a bug, lost to a
 * failed migration, or made obsolete by re-fitted FSRS parameters, it can be
 * thrown away and recomputed exactly. Nothing is lost that the log did not
 * already lack.
 *
 * The logic lives here rather than in the script so it can be tested against
 * the same scheduler the trainer uses. A rebuild that disagrees with the live
 * scheduler would silently reschedule the whole deck.
 */

import { replay, serialiseCard } from './scheduler.mjs';

/**
 * Group a flat review log by card and replay each one.
 *
 * @param {Array} reviews  rows as stored in D1
 * @param {object} [options]
 * @param {Set<string>|null} [options.knownCards]  ids that still exist; others
 *   are reported rather than rebuilt, since a state row for a card nobody can
 *   see is noise
 * @returns {{states: Array, orphaned: string[], cards: number}}
 */
export function rebuildStates(reviews, { knownCards = null, now = Date.now() } = {}) {
  const byCard = new Map();
  for (const review of reviews) {
    if (!review?.card_id) continue;
    if (!byCard.has(review.card_id)) byCard.set(review.card_id, []);
    byCard.get(review.card_id).push(review);
  }

  const states = [];
  const orphaned = [];

  for (const [cardId, rows] of byCard) {
    if (knownCards && !knownCards.has(cardId)) {
      orphaned.push(cardId);
      continue;
    }
    states.push(serialiseCard(cardId, replay(rows), now));
  }

  states.sort((a, b) => a.card_id.localeCompare(b.card_id));
  orphaned.sort();

  return { states, orphaned, cards: byCard.size };
}

const STATE_COLUMNS = [
  'card_id',
  'due',
  'stability',
  'difficulty',
  'elapsed_days',
  'scheduled_days',
  'reps',
  'lapses',
  'state',
  'last_review',
  'updated_at',
];

/**
 * Emit the rebuild as SQL rather than pushing it through the API.
 *
 * Deliberate: the API has exactly one write route and it appends reviews. A
 * rebuild is an administrative act on a cache, done from a laptop with
 * `wrangler d1 execute`, and giving the public-facing Worker a route that can
 * overwrite state wholesale would be a much bigger surface than the job is
 * worth.
 *
 * The reviews table is never touched — this only rewrites the derived cache.
 */
export function statesToSql(states) {
  const lines = [
    '-- Rebuilt from the review log by scripts/rebuild-states.mjs.',
    '-- Only the derived cache is touched; `reviews` is append-only and is not',
    '-- read-modified-written here.',
    'BEGIN TRANSACTION;',
    'DELETE FROM card_states;',
  ];

  for (const state of states) {
    const values = STATE_COLUMNS.map((column) => sqlValue(state[column])).join(', ');
    lines.push(`INSERT INTO card_states (${STATE_COLUMNS.join(', ')}) VALUES (${values});`);
  }

  lines.push('COMMIT;', '');
  return lines.join('\n');
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}
