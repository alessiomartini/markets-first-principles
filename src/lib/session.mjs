/**
 * Which cards to show, in which order, and how to describe what happened.
 *
 * Kept apart from the DOM so the queue-building rules — the part with actual
 * decisions in it — can be tested directly.
 *
 * The rules, and why:
 *
 * - Due cards come before new ones. Introducing new material while a backlog of
 *   due reviews sits there is how a spaced-repetition deck collapses: the
 *   backlog grows faster than it drains and the whole thing gets abandoned.
 * - New cards are capped per session. The cost of a new card is not today, it
 *   is the reviews it generates for the next year.
 * - Within due cards, most overdue first. Retrievability decays, so those are
 *   the ones closest to being genuinely forgotten.
 * - A card whose deck no longer contains it is skipped, not crashed on.
 */

import { deserialiseCard, emptyCard, retrievability } from './scheduler.mjs';

export const DEFAULTS = Object.freeze({
  newPerSession: 10,
  maxSession: 60,
});

/**
 * @param {object} options
 * @param {Array}  options.cards   flattened card definitions from the content collection
 * @param {Array}  options.states  serialised card states from IndexedDB
 * @param {Date}   [options.now]
 * @param {string[]} [options.topics] restrict to these topics; empty means all
 * @param {string[]} [options.decks]  restrict to these decks; empty means all
 */
export function buildQueue({ cards, states, now = new Date(), topics = [], decks = [], ...limits } = {}) {
  const { newPerSession, maxSession } = { ...DEFAULTS, ...limits };
  const byId = new Map(states.map((state) => [state.card_id, state]));
  const keep = selector(topics, decks);

  const due = [];
  const fresh = [];

  for (const card of cards) {
    if (!keep(card)) continue;
    const state = byId.get(card.id);

    if (!state) {
      fresh.push({ card, state: null, fsrs: emptyCard(now) });
      continue;
    }
    if (state.due <= now.getTime()) {
      due.push({ card, state, fsrs: deserialiseCard(state) });
    }
  }

  due.sort((a, b) => a.state.due - b.state.due);

  return [...due, ...fresh.slice(0, newPerSession)].slice(0, maxSession);
}

/**
 * Two levels of grouping, because they answer different questions. `topic` is
 * the OpenQuant section — the coarse one, and currently there is only one, so
 * filtering by it does nothing. `deck` is the working grain (distributions,
 * Bayes, Markov chains) and is what the session picker actually needs.
 */
function selector(topics, decks) {
  const wantedTopics = topics.length > 0 ? new Set(topics) : null;
  const wantedDecks = decks.length > 0 ? new Set(decks) : null;
  return (card) =>
    (!wantedTopics || wantedTopics.has(card.topic)) && (!wantedDecks || wantedDecks.has(card.deck));
}

/** Counts for the "what is waiting" line, without building the queue. */
export function counts({ cards, states, now = new Date(), topics = [], decks = [] } = {}) {
  const byId = new Map(states.map((state) => [state.card_id, state]));
  const keep = selector(topics, decks);
  let dueNow = 0;
  let unseen = 0;
  let later = 0;

  for (const card of cards) {
    if (!keep(card)) continue;
    const state = byId.get(card.id);
    if (!state) unseen += 1;
    else if (state.due <= now.getTime()) dueNow += 1;
    else later += 1;
  }

  return { due: dueNow, unseen, later, total: dueNow + unseen + later };
}

/**
 * Summarise a finished session.
 *
 * Deliberately not a score. Counts, median time, and the cards that were rated
 * Again — the last of these is the only actionable output, because it names
 * what to go and read. A percentage would invite optimising the number.
 */
export function summarise(events) {
  const byRating = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const durations = [];
  const again = [];

  for (const event of events) {
    byRating[event.rating] = (byRating[event.rating] ?? 0) + 1;
    if (Number.isFinite(event.durationMs)) durations.push(event.durationMs);
    if (event.rating === 1) again.push(event);
  }

  return {
    reviewed: events.length,
    byRating,
    medianMs: median(durations),
    totalMs: durations.reduce((sum, value) => sum + value, 0),
    again,
  };
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Cards whose recall probability has dropped furthest below the target.
 *
 * Used by the dashboard rather than the session, but it belongs with the queue
 * logic: it is the same question — what is closest to being forgotten — asked
 * without the "is it due" cutoff.
 */
export function mostForgotten({ cards, states, now = new Date(), limit = 10 } = {}) {
  const byId = new Map(cards.map((card) => [card.id, card]));

  return states
    .filter((state) => byId.has(state.card_id))
    .map((state) => ({
      card: byId.get(state.card_id),
      state,
      retrievability: retrievability(deserialiseCard(state), now),
    }))
    .sort((a, b) => a.retrievability - b.retrievability)
    .slice(0, limit);
}
