/**
 * Diagnostics over the review log.
 *
 * This is a measurement instrument, not a report card. Every number here exists
 * to answer a question that changes what you do next:
 *
 *   true retention   is the scheduler hitting the retention I asked it for?
 *   calibration      is the model's confidence about *me* actually right?
 *   leeches          which cards are consuming reviews and returning nothing?
 *   state mix        how much of the deck is genuinely in long-term memory?
 *   activity         am I reviewing at all, and in what pattern?
 *
 * None of them is a score. "87% retention" is not better than 90% — it is
 * evidence that the request_retention setting is not being met, which is a
 * different kind of fact. The distinction matters because a number you want to
 * push up is a number you will eventually push up by rating dishonestly, and
 * the ratings are the entire dataset.
 */

import { predictedRetrievability, retrievability } from './scheduler.mjs';
import { deserialiseCard } from './scheduler.mjs';

/** FSRS states, by the integer the log stores. */
export const STATE_NAMES = Object.freeze(['New', 'Learning', 'Review', 'Relearning']);

const DAY = 86_400_000;

/**
 * True retention: of the reviews of cards already in the Review state, what
 * fraction were recalled (rated anything but Again)?
 *
 * Learning and relearning reviews are excluded deliberately. They happen
 * minutes apart by design, they are nearly always passed, and including them
 * inflates the figure to the point of meaninglessness — which is exactly how
 * most spaced-repetition apps report ~95% retention regardless of the setting.
 */
export function trueRetention(reviews) {
  const mature = reviews.filter((review) => review.state === 2);
  if (mature.length === 0) return { reviews: 0, recalled: 0, rate: null };
  const recalled = mature.filter((review) => review.rating > 1).length;
  return { reviews: mature.length, recalled, rate: recalled / mature.length };
}

/** True retention, split by whatever key you group cards on (usually deck). */
export function retentionBy(reviews, cards, key = 'deck') {
  const groupOf = new Map(cards.map((card) => [card.id, card[key]]));
  const buckets = new Map();

  for (const review of reviews) {
    const group = groupOf.get(review.card_id);
    if (group === undefined) continue;
    if (!buckets.has(group)) buckets.set(group, []);
    buckets.get(group).push(review);
  }

  return [...buckets.entries()]
    .map(([group, rows]) => ({ group, ...trueRetention(rows) }))
    .sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1));
}

/**
 * Calibration: the model predicted a recall probability before each review;
 * how often was it right?
 *
 * This is the one measurement that can tell you the scheduler is wrong about
 * *you* rather than about people in general. Each review row stores the state
 * before the rating, so the prediction can be recomputed exactly. Bucket by
 * predicted R, compare against the observed pass rate: on the diagonal means
 * calibrated; below means the model is overconfident and the intervals are too
 * long for your memory.
 *
 * Reviews with no stability (a card's first sight of it) have nothing to
 * predict from and are excluded.
 */
export function calibration(reviews, bucketCount = 10) {
  const points = [];
  for (const review of reviews) {
    if (review.state !== 2) continue;
    const predicted = predictedRetrievability(review.elapsed_days, review.stability);
    if (predicted === null) continue;
    points.push({ predicted, recalled: review.rating > 1 });
  }

  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    from: i / bucketCount,
    to: (i + 1) / bucketCount,
    n: 0,
    recalled: 0,
    predictedSum: 0,
  }));

  for (const point of points) {
    const index = Math.min(bucketCount - 1, Math.floor(point.predicted * bucketCount));
    const bucket = buckets[index];
    bucket.n += 1;
    bucket.predictedSum += point.predicted;
    if (point.recalled) bucket.recalled += 1;
  }

  const filled = buckets
    .filter((bucket) => bucket.n > 0)
    .map((bucket) => ({
      ...bucket,
      predicted: bucket.predictedSum / bucket.n,
      observed: bucket.recalled / bucket.n,
    }));

  // Mean absolute calibration error, weighted by how many reviews landed in
  // each bucket. One number, and it is a diagnostic: large means the model's
  // confidence does not match reality here.
  const total = filled.reduce((sum, bucket) => sum + bucket.n, 0);
  const error =
    total === 0
      ? null
      : filled.reduce((sum, b) => sum + b.n * Math.abs(b.predicted - b.observed), 0) / total;

  return { buckets: filled, samples: total, meanAbsoluteError: error };
}

/**
 * Leeches: cards that keep being forgotten.
 *
 * Counted as lapses — an Again on a card that had reached the Review state.
 * Forgetting during learning is learning; forgetting something you had already
 * consolidated, repeatedly, means the card is wrong: two facts in a trenchcoat,
 * or an answer that does not follow from the question. The fix is to rewrite
 * the card, not to see it more often, and that is what the list is for.
 */
export function leeches(reviews, cards, { threshold = 3, limit = 20 } = {}) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const tally = new Map();

  for (const review of reviews) {
    if (review.rating !== 1 || review.state !== 2) continue;
    const entry = tally.get(review.card_id) ?? { lapses: 0, lastAt: 0 };
    entry.lapses += 1;
    entry.lastAt = Math.max(entry.lastAt, review.reviewed_at);
    tally.set(review.card_id, entry);
  }

  return [...tally.entries()]
    .filter(([cardId, entry]) => entry.lapses >= threshold && byId.has(cardId))
    .map(([cardId, entry]) => ({ card: byId.get(cardId), ...entry }))
    .sort((a, b) => b.lapses - a.lapses || b.lastAt - a.lastAt)
    .slice(0, limit);
}

/** How much of the deck is where: New / Learning / Review / Relearning. */
export function stateMix(cards, states) {
  const byId = new Map(states.map((state) => [state.card_id, state]));
  const mix = [0, 0, 0, 0];
  for (const card of cards) {
    const state = byId.get(card.id);
    mix[state ? state.state : 0] += 1;
  }
  return STATE_NAMES.map((name, index) => ({ state: name, count: mix[index] }));
}

/**
 * Memory strength per group: median stability, and mean recall probability
 * right now.
 *
 * Median rather than mean stability, because one card with a four-year interval
 * drags a mean somewhere no card actually is.
 */
export function strengthBy(cards, states, now = new Date(), key = 'deck') {
  const groupOf = new Map(cards.map((card) => [card.id, card[key]]));
  const buckets = new Map();

  for (const state of states) {
    const group = groupOf.get(state.card_id);
    if (group === undefined) continue;
    if (!buckets.has(group)) buckets.set(group, []);
    buckets.get(group).push(state);
  }

  return [...buckets.entries()]
    .map(([group, rows]) => {
      const stabilities = rows.map((row) => row.stability).filter(Number.isFinite);
      const recall = rows
        .map((row) => retrievability(deserialiseCard(row), now))
        .filter(Number.isFinite);
      return {
        group,
        cards: rows.length,
        medianStability: median(stabilities),
        meanRetrievability: recall.length ? recall.reduce((a, b) => a + b, 0) / recall.length : null,
      };
    })
    .sort((a, b) => (a.meanRetrievability ?? 1) - (b.meanRetrievability ?? 1));
}

/**
 * Reviews per day over a window ending today.
 *
 * Days with nothing are present and zero — the gaps are the informative part,
 * and a chart that silently omits them turns a fortnight off into a straight
 * line. No streak counter: a run of days is a fact about a calendar, not about
 * memory.
 */
export function activity(reviews, { days = 90, now = new Date() } = {}) {
  const end = startOfDay(now);
  const counts = new Map();

  for (const review of reviews) {
    const key = startOfDay(new Date(review.reviewed_at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const stamp = end - i * DAY;
    out.push({ date: new Date(stamp), count: counts.get(stamp) ?? 0 });
  }
  return out;
}

/** The work the next fortnight already contains, before any new cards. */
export function forecast(states, { days = 14, now = new Date() } = {}) {
  const start = startOfDay(now);
  const out = Array.from({ length: days }, (_, i) => ({ date: new Date(start + i * DAY), count: 0 }));
  let overdue = 0;

  for (const state of states) {
    const offset = Math.floor((startOfDay(new Date(state.due)) - start) / DAY);
    if (offset < 0) overdue += 1;
    else if (offset < days) out[offset].count += 1;
  }

  return { overdue, days: out };
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
