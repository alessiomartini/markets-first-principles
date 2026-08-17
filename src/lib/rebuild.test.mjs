import { describe, expect, it } from 'vitest';

import { rebuildStates, statesToSql } from './rebuild.mjs';
import { applyReview, emptyCard, serialiseCard } from './scheduler.mjs';

const T0 = new Date('2026-01-01T09:00:00.000Z');
const DAY = 86_400_000;

/**
 * Play a session the way the trainer does — one review at a time, carrying the
 * card state forward — and return both the log it produced and the state it
 * arrived at.
 */
function playSession(cardId, ratings) {
  let card = emptyCard(T0);
  const log = [];

  ratings.forEach((rating, index) => {
    const at = new Date(T0.getTime() + index * 3 * DAY);
    const { next, review } = applyReview(card, rating, at, {
      cardId,
      reviewId: `${cardId}-${index}`,
    });
    log.push(review);
    card = next;
  });

  return { log, card };
}

describe('rebuildStates', () => {
  it('reproduces exactly the state the trainer arrived at', () => {
    // The property the whole append-only design rests on: the cache is
    // recomputable. If replay and incremental application ever disagree, a
    // rebuild silently reschedules the entire deck.
    const { log, card } = playSession('mgf-definition', [3, 3, 1, 2, 3, 4]);

    const { states } = rebuildStates(log, { now: T0.getTime() });
    const expected = serialiseCard('mgf-definition', card, T0.getTime());

    expect(states).toHaveLength(1);
    expect(states[0]).toEqual(expected);
  });

  it('rebuilds many cards independently', () => {
    const a = playSession('card-a', [3, 4, 3]);
    const b = playSession('card-b', [1, 1, 3]);

    const { states, cards } = rebuildStates([...a.log, ...b.log], { now: T0.getTime() });

    expect(cards).toBe(2);
    expect(states.map((s) => s.card_id)).toEqual(['card-a', 'card-b']);
    expect(states[0]).toEqual(serialiseCard('card-a', a.card, T0.getTime()));
    expect(states[1]).toEqual(serialiseCard('card-b', b.card, T0.getTime()));
  });

  it('does not care what order the log arrives in', () => {
    // Rows come back from D1 in whatever order the query gives, and the offline
    // queue can deliver a later session before an earlier one.
    const { log } = playSession('card-a', [3, 1, 3, 4]);
    const shuffled = [log[2], log[0], log[3], log[1]];

    expect(rebuildStates(shuffled, { now: T0.getTime() })).toEqual(
      rebuildStates(log, { now: T0.getTime() })
    );
  });

  it('reports history for cards that no longer exist instead of rebuilding it', () => {
    const { log } = playSession('retired-card', [3, 3]);

    const result = rebuildStates(log, { knownCards: new Set(['still-here']), now: T0.getTime() });

    expect(result.states).toEqual([]);
    expect(result.orphaned).toEqual(['retired-card']);
  });

  it('ignores rows with no card id rather than inventing a card for them', () => {
    expect(rebuildStates([{ rating: 3, reviewed_at: 1 }], { now: T0.getTime() }).cards).toBe(0);
  });
});

describe('statesToSql', () => {
  it('wraps the rewrite in a transaction and never touches reviews', () => {
    const { log } = playSession('card-a', [3]);
    const { states } = rebuildStates(log, { now: T0.getTime() });
    const sql = statesToSql(states);

    expect(sql).toContain('BEGIN TRANSACTION;');
    expect(sql).toContain('DELETE FROM card_states;');
    expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true);
    expect(sql).not.toMatch(/DELETE FROM reviews|UPDATE reviews/);
  });

  it('escapes quotes in ids rather than breaking out of the string', () => {
    const sql = statesToSql([
      { card_id: "o'reilly", due: 1, stability: 1, difficulty: 1, elapsed_days: 0,
        scheduled_days: 0, reps: 1, lapses: 0, state: 1, last_review: null, updated_at: 2 },
    ]);

    expect(sql).toContain("'o''reilly'");
  });

  it('writes NULL for a missing last_review, not the string "null"', () => {
    const sql = statesToSql([
      { card_id: 'a', due: 1, stability: 1, difficulty: 1, elapsed_days: 0,
        scheduled_days: 0, reps: 1, lapses: 0, state: 1, last_review: null, updated_at: 2 },
    ]);

    expect(sql).toMatch(/, NULL, 2\);/);
  });
});
