import { describe, expect, it } from 'vitest';

import {
  ALGO_VERSION,
  applyReview,
  emptyCard,
  formatInterval,
  preview,
  RATINGS,
  Rating,
  replay,
  SCHEDULER_CONFIG,
  State,
} from './scheduler.mjs';

// Every test runs against a fixed instant. FSRS schedules relative to "now",
// so a floating clock would make interval assertions flaky for reasons that
// have nothing to do with the scheduler being wrong.
const T0 = new Date('2026-01-01T09:00:00.000Z');
const day = (n) => new Date(T0.getTime() + n * 86_400_000);

/** Drive a card forward through a sequence of ratings, one per day. */
function sequence(ratings) {
  let card = emptyCard(T0);
  const log = [];
  ratings.forEach((rating, index) => {
    const at = day(index === 0 ? 0 : cumulativeDays(card, index));
    const { next, review } = applyReview(card, rating, at, { cardId: 'c1' });
    card = next;
    log.push(review);
  });
  return { card, log };
}

// Advance to whenever the card is actually due, so ratings land on a due card
// rather than on one reviewed far too early.
function cumulativeDays(card, fallback) {
  const dueIn = (new Date(card.due).getTime() - T0.getTime()) / 86_400_000;
  return Number.isFinite(dueIn) ? Math.max(dueIn, fallback) : fallback;
}

describe('configuration', () => {
  it('pins the four defaults the project committed to', () => {
    expect(SCHEDULER_CONFIG).toEqual({
      request_retention: 0.9,
      maximum_interval: 36500,
      enable_fuzz: true,
      enable_short_term: true,
    });
  });

  it('reports FSRS-6 and a weight fingerprint', () => {
    // The npm package is 5.x while the algorithm is 6.x, so this assertion is
    // about the thing that actually matters.
    expect(ALGO_VERSION).toMatch(/^fsrs-6\.\d+\/w:[0-9a-f]{8}$/);
  });

  it('exposes exactly four ratings, numbered as the schema stores them', () => {
    expect(RATINGS.map((r) => r.value)).toEqual([1, 2, 3, 4]);
    expect(RATINGS.map((r) => r.label)).toEqual(['Again', 'Hard', 'Good', 'Easy']);
  });
});

describe('preview', () => {
  it('offers all four ratings with an interval for each', () => {
    const options = preview(emptyCard(T0), T0);
    expect(options).toHaveLength(4);
    for (const option of options) {
      expect(option.intervalLabel).toMatch(/^\d+(\.\d+)?(m|h|d|w|mo|y)$/);
      expect(option.intervalDays).toBeGreaterThan(0);
    }
  });

  it('orders intervals Again <= Hard <= Good <= Easy', () => {
    const { card } = sequence([Rating.Good, Rating.Good, Rating.Good]);
    const [again, hard, good, easy] = preview(card, day(30)).map((o) => o.intervalDays);

    expect(again).toBeLessThanOrEqual(hard);
    expect(hard).toBeLessThanOrEqual(good);
    expect(good).toBeLessThanOrEqual(easy);
  });

  it('does not mutate the card it is previewing', () => {
    const card = emptyCard(T0);
    const before = JSON.stringify(card);
    preview(card, T0);
    expect(JSON.stringify(card)).toBe(before);
  });
});

describe('applyReview', () => {
  it('schedules Again sooner than Good', () => {
    const { card } = sequence([Rating.Good, Rating.Good]);
    const at = day(10);

    const again = applyReview(card, Rating.Again, at).next;
    const good = applyReview(card, Rating.Good, at).next;

    expect(new Date(again.due).getTime()).toBeLessThan(new Date(good.due).getTime());
  });

  it('grows the interval across successive Good ratings', () => {
    let card = emptyCard(T0);
    const intervals = [];

    for (let i = 0; i < 5; i += 1) {
      const at = new Date(Math.max(new Date(card.due).getTime(), T0.getTime()));
      const { next } = applyReview(card, Rating.Good, at);
      intervals.push((new Date(next.due).getTime() - at.getTime()) / 86_400_000);
      card = next;
    }

    // Compare only once the card has left the short-term learning steps, which
    // are deliberately minutes long and not part of the growth claim.
    const reviewPhase = intervals.filter((d) => d >= 1);
    for (let i = 1; i < reviewPhase.length; i += 1) {
      expect(reviewPhase[i]).toBeGreaterThan(reviewPhase[i - 1]);
    }
    expect(reviewPhase.length).toBeGreaterThanOrEqual(2);
  });

  it('increments lapses on Again from the review state', () => {
    let { card } = sequence([Rating.Good, Rating.Good, Rating.Good, Rating.Good]);
    expect(card.state).toBe(State.Review);
    expect(card.lapses).toBe(0);

    const { next } = applyReview(card, Rating.Again, new Date(card.due));
    expect(next.lapses).toBe(1);
    expect(next.state).toBe(State.Relearning);
  });

  it('records the state before the review, not after', () => {
    const { card } = sequence([Rating.Good, Rating.Good, Rating.Good, Rating.Good]);
    const stabilityBefore = card.stability;

    const { review, next } = applyReview(card, Rating.Again, new Date(card.due), {
      cardId: 'c1',
      reviewId: 'r1',
      durationMs: 4200,
      clientId: 'test',
    });

    // This is the property the FSRS optimiser depends on: each row describes
    // the memory state the rating was given *from*.
    expect(review.stability).toBeCloseTo(stabilityBefore, 6);
    expect(review.state).toBe(State.Review);
    expect(next.state).toBe(State.Relearning);
    expect(review.rating).toBe(Rating.Again);
    expect(review.duration_ms).toBe(4200);
    expect(review.algo_version).toBe(ALGO_VERSION);
  });

  it('rejects a rating it does not know', () => {
    expect(() => applyReview(emptyCard(T0), 99, T0)).toThrow(/unknown rating/);
  });
});

describe('replay', () => {
  it('reproduces the state reached by applying reviews directly', () => {
    const ratings = [Rating.Good, Rating.Good, Rating.Again, Rating.Good, Rating.Easy];

    let card = emptyCard(T0);
    const log = [];
    for (const rating of ratings) {
      const at = new Date(Math.max(new Date(card.due).getTime(), T0.getTime()));
      const { next, review } = applyReview(card, rating, at, { cardId: 'c1' });
      log.push(review);
      card = next;
    }

    const replayed = replay(log);

    expect(replayed.stability).toBeCloseTo(card.stability, 6);
    expect(replayed.difficulty).toBeCloseTo(card.difficulty, 6);
    expect(replayed.reps).toBe(card.reps);
    expect(replayed.lapses).toBe(card.lapses);
    expect(replayed.state).toBe(card.state);
  });

  it('is insensitive to the order rows arrive in', () => {
    const { log } = sequence([Rating.Good, Rating.Hard, Rating.Good]);
    const shuffled = [log[2], log[0], log[1]];

    expect(replay(shuffled).stability).toBeCloseTo(replay(log).stability, 6);
  });

  it('returns a fresh card for an empty log', () => {
    expect(replay([]).state).toBe(State.New);
  });
});

describe('formatInterval', () => {
  it('scales the unit to the size of the interval', () => {
    expect(formatInterval(1 / 144)).toBe('10m');
    expect(formatInterval(0.25)).toBe('6h');
    expect(formatInterval(3)).toBe('3d');
    expect(formatInterval(14)).toBe('2w');
    expect(formatInterval(90)).toBe('3mo');
    expect(formatInterval(730)).toBe('2y');
  });
});
