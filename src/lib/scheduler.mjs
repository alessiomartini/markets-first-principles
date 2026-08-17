/**
 * The only module in this project that imports ts-fsrs.
 *
 * Everything else — the review UI, the sync layer, the Worker, the rebuild
 * command — talks to the functions here. That indirection exists so the
 * scheduler can be swapped or re-tuned without touching anything else, and so
 * the behaviour that matters can be unit-tested against a frozen clock.
 *
 * Algorithm: FSRS-6. Note that the npm package version and the algorithm
 * version are different numbers — ts-fsrs 5.4.1 reports
 * "v5.4.1 using FSRS-6.0" and ships 21 default weights, which is FSRS-6.
 * Checking the package version alone would be misleading.
 */

import {
  createEmptyCard,
  fsrs,
  FSRSVersion,
  generatorParameters,
  Rating,
  State,
} from 'ts-fsrs';

/**
 * Every tunable lives here and nowhere else.
 *
 * request_retention is the probability of recall the scheduler aims for at the
 * moment a card comes due. Raising it shortens intervals and buys accuracy with
 * volume; lowering it does the reverse. 0.9 is the usual starting point — see
 * docs/scheduling.md for what the trade actually costs.
 */
export const SCHEDULER_CONFIG = Object.freeze({
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: true,
  enable_short_term: true,
});

/** Rating values are persisted as integers, so they are fixed by contract. */
export const RATINGS = Object.freeze([
  { value: Rating.Again, key: '1', label: 'Again' },
  { value: Rating.Hard, key: '2', label: 'Hard' },
  { value: Rating.Good, key: '3', label: 'Good' },
  { value: Rating.Easy, key: '4', label: 'Easy' },
]);

export { Rating, State };

const parameters = generatorParameters(SCHEDULER_CONFIG);
const engine = fsrs(parameters);

/**
 * Identifies both the algorithm and the exact weights in use, and is written
 * onto every review row.
 *
 * The weight fingerprint matters: once the parameters are re-fitted to a real
 * forgetting curve, reviews scheduled by the old weights and the new ones must
 * be distinguishable, otherwise the log cannot be used to evaluate the change
 * that the log itself made possible.
 */
export const ALGO_VERSION = `${algorithmName()}/w:${fingerprint(parameters.w)}`;

function algorithmName() {
  // "v5.4.1 using FSRS-6.0" -> "fsrs-6.0"
  const match = /FSRS-([\d.]+)/.exec(FSRSVersion);
  return match ? `fsrs-${match[1]}` : 'fsrs-unknown';
}

function fingerprint(weights) {
  // Small, stable, non-cryptographic: this is a change detector, not a
  // security boundary.
  let hash = 0x811c9dc5;
  for (const value of weights) {
    for (const char of value.toFixed(6)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, '0');
}

/** A card nobody has reviewed yet. */
export function emptyCard(now = new Date()) {
  return createEmptyCard(now);
}

/**
 * What each of the four ratings would do, without committing to any of them.
 *
 * The UI shows these on the buttons before the click. Exposing all four is not
 * cosmetic: FSRS estimates difficulty from the spread of ratings a card
 * receives, so a trainer that only ever records pass/fail starves the model of
 * exactly the signal it needs.
 */
export function preview(card, now = new Date()) {
  const scheduled = engine.repeat(card, now);
  return RATINGS.map((rating) => {
    const outcome = scheduled[rating.value];
    return {
      ...rating,
      card: outcome.card,
      due: outcome.card.due,
      intervalDays: intervalInDays(outcome.card.due, now),
      intervalLabel: formatInterval(intervalInDays(outcome.card.due, now)),
    };
  });
}

/**
 * Apply a rating.
 *
 * Returns the next card state and the review row to append to the log. The row
 * records the state *before* the review, which is what the FSRS optimiser
 * needs to replay history and re-fit the weights later.
 */
export function applyReview(card, rating, now = new Date(), extra = {}) {
  const outcome = engine.repeat(card, now)[rating];
  if (!outcome) throw new Error(`unknown rating: ${rating}`);

  const before = outcome.log;

  return {
    next: outcome.card,
    review: {
      card_id: extra.cardId ?? null,
      review_id: extra.reviewId ?? null,
      reviewed_at: now.getTime(),
      rating,
      state: before.state,
      elapsed_days: before.elapsed_days,
      scheduled_days: before.scheduled_days,
      stability: before.stability,
      difficulty: before.difficulty,
      duration_ms: extra.durationMs ?? null,
      client_id: extra.clientId ?? null,
      algo_version: ALGO_VERSION,
    },
  };
}

/**
 * Rebuild a card's state by replaying its reviews in order.
 *
 * This is what makes the log the real asset rather than a diagnostic: the state
 * table can be thrown away and reconstructed, so a bug in the cache is
 * recoverable and a change of parameters can be applied to all of history.
 */
export function replay(reviews) {
  const ordered = [...reviews].sort((a, b) => a.reviewed_at - b.reviewed_at);
  let card = emptyCard(ordered.length ? new Date(ordered[0].reviewed_at) : new Date());

  for (const review of ordered) {
    card = engine.repeat(card, new Date(review.reviewed_at))[review.rating].card;
  }
  return card;
}

/**
 * Convert an FSRS card to the flat, numeric row that IndexedDB and D1 both
 * store, and back.
 *
 * ts-fsrs uses Date objects; SQLite has no date type and IndexedDB's support
 * for them is not worth relying on across a schema change. Epoch milliseconds
 * are unambiguous in both, and `card_states` is a cache anyway — but a cache
 * that silently loses `last_review` produces wrong intervals rather than
 * missing ones, which is harder to notice.
 */
export function serialiseCard(cardId, card, updatedAt = Date.now()) {
  return {
    card_id: cardId,
    due: new Date(card.due).getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? new Date(card.last_review).getTime() : null,
    updated_at: updatedAt,
  };
}

export function deserialiseCard(record) {
  if (!record) return null;
  return {
    due: new Date(record.due),
    stability: record.stability,
    difficulty: record.difficulty,
    elapsed_days: record.elapsed_days,
    scheduled_days: record.scheduled_days,
    reps: record.reps,
    lapses: record.lapses,
    state: record.state,
    last_review: record.last_review ? new Date(record.last_review) : undefined,
    learning_steps: record.learning_steps ?? 0,
  };
}

/** Probability of recall right now, given the card's stability. */
export function retrievability(card, now = new Date()) {
  return engine.get_retrievability(card, now, false);
}

function intervalInDays(due, now) {
  return (new Date(due).getTime() - now.getTime()) / 86_400_000;
}

/** "10m", "2d", "3w", "5mo", "1.4y" — short enough to sit on a button. */
export function formatInterval(days) {
  const minutes = days * 24 * 60;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  if (days < 1) return `${Math.round(minutes / 60)}h`;
  if (days < 7) return `${round(days)}d`;
  if (days < 30) return `${round(days / 7)}w`;
  if (days < 365) return `${round(days / 30)}mo`;
  return `${round(days / 365)}y`;
}

function round(value) {
  return value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
}
