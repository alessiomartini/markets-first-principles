import { describe, expect, it } from 'vitest';

import { buildQueue, counts, mostForgotten, summarise } from './session.mjs';
import { applyReview, deserialiseCard, emptyCard, serialiseCard } from './scheduler.mjs';

const NOW = new Date('2026-03-01T09:00:00.000Z');
const day = 86_400_000;

const card = (id, topic = 'probability', deck = 'general') => ({
  id,
  topic,
  deck,
  type: 'basic',
  front: id,
  back: id,
});

const state = (card_id, dueOffsetDays, extra = {}) => ({
  card_id,
  due: NOW.getTime() + dueOffsetDays * day,
  stability: 10,
  difficulty: 5,
  elapsed_days: 1,
  scheduled_days: 1,
  reps: 3,
  lapses: 0,
  state: 2,
  last_review: NOW.getTime() - day,
  updated_at: NOW.getTime(),
  ...extra,
});

describe('buildQueue', () => {
  it('puts due cards before new ones', () => {
    const queue = buildQueue({
      cards: [card('new-1'), card('due-1')],
      states: [state('due-1', -1)],
      now: NOW,
    });

    expect(queue.map((entry) => entry.card.id)).toEqual(['due-1', 'new-1']);
  });

  it('orders due cards most overdue first', () => {
    const queue = buildQueue({
      cards: [card('a'), card('b'), card('c')],
      states: [state('a', -1), state('b', -30), state('c', -5)],
      now: NOW,
    });

    expect(queue.map((entry) => entry.card.id)).toEqual(['b', 'c', 'a']);
  });

  it('excludes cards that are not due yet', () => {
    const queue = buildQueue({
      cards: [card('later')],
      states: [state('later', 3)],
      now: NOW,
    });

    expect(queue).toHaveLength(0);
  });

  it('caps new cards, because their cost is next year, not today', () => {
    const queue = buildQueue({
      cards: Array.from({ length: 40 }, (_, i) => card(`n-${i}`)),
      states: [],
      now: NOW,
      newPerSession: 5,
    });

    expect(queue).toHaveLength(5);
  });

  it('caps the session as a whole', () => {
    const cards = Array.from({ length: 100 }, (_, i) => card(`d-${i}`));
    const queue = buildQueue({
      cards,
      states: cards.map((c, i) => state(c.id, -i - 1)),
      now: NOW,
      maxSession: 20,
    });

    expect(queue).toHaveLength(20);
  });

  it('filters by topic', () => {
    const queue = buildQueue({
      cards: [card('a', 'probability'), card('b', 'linear-algebra')],
      states: [],
      now: NOW,
      topics: ['linear-algebra'],
    });

    expect(queue.map((entry) => entry.card.id)).toEqual(['b']);
  });

  it('filters by deck, which is the grain that actually distinguishes cards', () => {
    // Every card currently shares one OpenQuant topic, so a topic filter is a
    // control that does nothing. The deck is what a session picks.
    const queue = buildQueue({
      cards: [
        card('a', 'Probability & Statistics', 'markov-chains'),
        card('b', 'Probability & Statistics', 'limit-theorems'),
      ],
      states: [],
      now: NOW,
      decks: ['markov-chains'],
    });

    expect(queue.map((entry) => entry.card.id)).toEqual(['a']);
  });

  it('ignores a state whose card no longer exists', () => {
    // Retiring a card leaves its history behind on purpose; the queue must not
    // trip over it.
    const queue = buildQueue({
      cards: [card('kept')],
      states: [state('kept', -1), state('retired-long-ago', -1)],
      now: NOW,
    });

    expect(queue.map((entry) => entry.card.id)).toEqual(['kept']);
  });

  it('gives new cards a blank FSRS card and due cards their stored one', () => {
    const [dueEntry, newEntry] = buildQueue({
      cards: [card('fresh'), card('seen')],
      states: [state('seen', -1, { stability: 12.5 })],
      now: NOW,
    });

    expect(dueEntry.fsrs.stability).toBe(12.5);
    expect(newEntry.fsrs.reps).toBe(0);
  });
});

describe('counts', () => {
  it('splits the deck into due, unseen and scheduled', () => {
    expect(
      counts({
        cards: [card('a'), card('b'), card('c'), card('d')],
        states: [state('a', -1), state('b', 5), state('c', -2)],
        now: NOW,
      })
    ).toEqual({ due: 2, unseen: 1, later: 1, total: 4 });
  });
});

describe('summarise', () => {
  it('counts ratings and names the cards rated Again', () => {
    const result = summarise([
      { cardId: 'a', rating: 3, durationMs: 4000 },
      { cardId: 'b', rating: 1, durationMs: 12000 },
      { cardId: 'c', rating: 4, durationMs: 2000 },
    ]);

    expect(result.reviewed).toBe(3);
    expect(result.byRating).toEqual({ 1: 1, 2: 0, 3: 1, 4: 1 });
    expect(result.medianMs).toBe(4000);
    expect(result.again.map((e) => e.cardId)).toEqual(['b']);
  });

  it('handles an empty session without dividing by zero', () => {
    expect(summarise([])).toMatchObject({ reviewed: 0, medianMs: null, totalMs: 0 });
  });
});

describe('mostForgotten', () => {
  it('ranks by recall probability, not by due date', () => {
    // A card with low stability reviewed recently can be closer to forgotten
    // than one with high stability that is technically more overdue.
    const states = [
      state('fragile', -2, { stability: 1, last_review: NOW.getTime() - 5 * day }),
      state('solid', -10, { stability: 400, last_review: NOW.getTime() - 20 * day }),
    ];

    const ranked = mostForgotten({ cards: [card('fragile'), card('solid')], states, now: NOW });

    expect(ranked[0].card.id).toBe('fragile');
    expect(ranked[0].retrievability).toBeLessThan(ranked[1].retrievability);
  });
});

describe('card state round-trip', () => {
  it('survives serialise → deserialise unchanged where it matters', () => {
    const { next } = applyReview(emptyCard(NOW), 3, NOW, { cardId: 'x' });
    const record = serialiseCard('x', next, NOW.getTime());
    const restored = deserialiseCard(record);

    expect(restored.due.getTime()).toBe(new Date(next.due).getTime());
    expect(restored.stability).toBe(next.stability);
    expect(restored.difficulty).toBe(next.difficulty);
    expect(restored.state).toBe(next.state);
    expect(restored.reps).toBe(next.reps);
  });

  it('keeps last_review, so the next interval is computed from the right instant', () => {
    const { next } = applyReview(emptyCard(NOW), 3, NOW, { cardId: 'x' });
    const restored = deserialiseCard(serialiseCard('x', next));

    expect(restored.last_review?.getTime()).toBe(new Date(next.last_review).getTime());
  });
});
