import { describe, expect, it } from 'vitest';

import {
  activity,
  calibration,
  forecast,
  leeches,
  retentionBy,
  stateMix,
  strengthBy,
  trueRetention,
} from './diagnostics.mjs';
import { predictedRetrievability } from './scheduler.mjs';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const DAY = 86_400_000;

const card = (id, deck = 'limit-theorems') => ({ id, deck, topic: 'Probability & Statistics' });

const review = (overrides = {}) => ({
  review_id: Math.random().toString(36).slice(2),
  card_id: 'a',
  reviewed_at: NOW.getTime(),
  rating: 3,
  state: 2,
  elapsed_days: 10,
  scheduled_days: 10,
  stability: 10,
  difficulty: 5,
  ...overrides,
});

describe('trueRetention', () => {
  it('counts anything above Again as recalled', () => {
    const result = trueRetention([
      review({ rating: 1 }),
      review({ rating: 2 }),
      review({ rating: 3 }),
      review({ rating: 4 }),
    ]);

    expect(result).toEqual({ reviews: 4, recalled: 3, rate: 0.75 });
  });

  it('excludes learning and relearning reviews', () => {
    // Learning steps happen minutes apart and are almost always passed.
    // Counting them is how every app reports 95% whatever the setting says.
    const result = trueRetention([
      review({ state: 1, rating: 3 }),
      review({ state: 3, rating: 3 }),
      review({ state: 2, rating: 1 }),
    ]);

    expect(result).toEqual({ reviews: 1, recalled: 0, rate: 0 });
  });

  it('reports null rather than 0 or NaN when there is nothing to measure', () => {
    expect(trueRetention([]).rate).toBeNull();
    expect(trueRetention([review({ state: 0 })]).rate).toBeNull();
  });
});

describe('retentionBy', () => {
  it('groups by deck and puts the worst first', () => {
    const cards = [card('a', 'markov-chains'), card('b', 'limit-theorems')];
    const reviews = [
      review({ card_id: 'a', rating: 1 }),
      review({ card_id: 'a', rating: 3 }),
      review({ card_id: 'b', rating: 3 }),
      review({ card_id: 'b', rating: 3 }),
    ];

    const result = retentionBy(reviews, cards);

    expect(result[0]).toMatchObject({ group: 'markov-chains', rate: 0.5 });
    expect(result[1]).toMatchObject({ group: 'limit-theorems', rate: 1 });
  });

  it('ignores reviews of cards that no longer exist', () => {
    expect(retentionBy([review({ card_id: 'gone' })], [card('a')])).toEqual([]);
  });
});

describe('calibration', () => {
  it('recovers a perfectly calibrated log', () => {
    // Build reviews where the observed pass rate matches the prediction by
    // construction: at t = S the model predicts 0.9, so 90 passes in 100.
    const reviews = Array.from({ length: 100 }, (_, i) =>
      review({ elapsed_days: 10, stability: 10, rating: i < 90 ? 3 : 1 })
    );

    const result = calibration(reviews);
    const bucket = result.buckets.at(-1);

    expect(result.samples).toBe(100);
    expect(bucket.predicted).toBeCloseTo(0.9, 5);
    expect(bucket.observed).toBeCloseTo(0.9, 5);
    expect(result.meanAbsoluteError).toBeLessThan(0.001);
  });

  it('detects overconfidence', () => {
    // The model says 0.9; only half are recalled. That is the finding the
    // dashboard exists to surface — intervals too long for this reader.
    const reviews = Array.from({ length: 100 }, (_, i) =>
      review({ elapsed_days: 10, stability: 10, rating: i < 50 ? 3 : 1 })
    );

    const result = calibration(reviews);

    expect(result.meanAbsoluteError).toBeCloseTo(0.4, 2);
    expect(result.buckets.at(-1).observed).toBeLessThan(result.buckets.at(-1).predicted);
  });

  it('drops reviews with nothing to predict from', () => {
    expect(calibration([review({ stability: null })]).samples).toBe(0);
    expect(calibration([review({ state: 0 })]).samples).toBe(0);
  });

  it('agrees with the scheduler on the curve it is testing', () => {
    // Guards against the dashboard quietly using a different forgetting curve
    // from the one that scheduled the card, which would make every deviation
    // look like a memory finding.
    expect(predictedRetrievability(10, 10)).toBeCloseTo(0.9, 6);
    expect(predictedRetrievability(0, 10)).toBeCloseTo(1, 6);
    expect(predictedRetrievability(100, 10)).toBeLessThan(0.9);
  });
});

describe('leeches', () => {
  it('counts only lapses from the Review state', () => {
    const reviews = [
      ...Array.from({ length: 3 }, () => review({ card_id: 'hard', rating: 1, state: 2 })),
      ...Array.from({ length: 5 }, () => review({ card_id: 'learning', rating: 1, state: 1 })),
    ];

    const result = leeches(reviews, [card('hard'), card('learning')]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ lapses: 3 });
    expect(result[0].card.id).toBe('hard');
  });

  it('respects the threshold', () => {
    const reviews = [review({ card_id: 'a', rating: 1 }), review({ card_id: 'a', rating: 1 })];
    expect(leeches(reviews, [card('a')], { threshold: 3 })).toHaveLength(0);
    expect(leeches(reviews, [card('a')], { threshold: 2 })).toHaveLength(1);
  });

  it('orders by lapse count', () => {
    const reviews = [
      ...Array.from({ length: 3 }, () => review({ card_id: 'a', rating: 1 })),
      ...Array.from({ length: 7 }, () => review({ card_id: 'b', rating: 1 })),
    ];

    const result = leeches(reviews, [card('a'), card('b')]);
    expect(result.map((entry) => entry.card.id)).toEqual(['b', 'a']);
  });
});

describe('stateMix', () => {
  it('counts a card with no state as New', () => {
    const result = stateMix(
      [card('a'), card('b'), card('c')],
      [{ card_id: 'a', state: 2 }, { card_id: 'b', state: 3 }]
    );

    expect(result).toEqual([
      { state: 'New', count: 1 },
      { state: 'Learning', count: 0 },
      { state: 'Review', count: 1 },
      { state: 'Relearning', count: 1 },
    ]);
  });
});

describe('strengthBy', () => {
  const state = (card_id, stability) => ({
    card_id,
    due: NOW.getTime(),
    stability,
    difficulty: 5,
    elapsed_days: 1,
    scheduled_days: stability,
    reps: 3,
    lapses: 0,
    state: 2,
    last_review: NOW.getTime() - DAY,
    updated_at: NOW.getTime(),
  });

  it('uses the median, so one long interval does not move the group', () => {
    const cards = [card('a'), card('b'), card('c')];
    const states = [state('a', 5), state('b', 10), state('c', 5000)];

    const [group] = strengthBy(cards, states, NOW);

    expect(group.medianStability).toBe(10);
    expect(group.cards).toBe(3);
  });

  it('reports recall probability now, not at the due date', () => {
    const [group] = strengthBy([card('a')], [state('a', 10)], NOW);
    expect(group.meanRetrievability).toBeGreaterThan(0.9);
    expect(group.meanRetrievability).toBeLessThanOrEqual(1);
  });
});

describe('activity', () => {
  it('includes empty days, because the gaps are the point', () => {
    const result = activity([review({ reviewed_at: NOW.getTime() })], { days: 7, now: NOW });

    expect(result).toHaveLength(7);
    expect(result.at(-1).count).toBe(1);
    expect(result.slice(0, 6).every((day) => day.count === 0)).toBe(true);
  });

  it('buckets by local day', () => {
    const result = activity(
      [
        review({ reviewed_at: NOW.getTime() }),
        review({ reviewed_at: NOW.getTime() - 60_000 }),
        review({ reviewed_at: NOW.getTime() - 2 * DAY }),
      ],
      { days: 5, now: NOW }
    );

    expect(result.at(-1).count).toBe(2);
    expect(result.at(-3).count).toBe(1);
  });
});

describe('forecast', () => {
  it('separates the overdue backlog from the coming days', () => {
    const result = forecast(
      [
        { card_id: 'a', due: NOW.getTime() - 5 * DAY },
        { card_id: 'b', due: NOW.getTime() + 1 * DAY },
        { card_id: 'c', due: NOW.getTime() + 1 * DAY },
        { card_id: 'd', due: NOW.getTime() + 400 * DAY },
      ],
      { days: 14, now: NOW }
    );

    expect(result.overdue).toBe(1);
    expect(result.days[1].count).toBe(2);
    // Far-future cards are simply outside the window, not piled onto day 14.
    expect(result.days.at(-1).count).toBe(0);
  });
});
