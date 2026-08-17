/**
 * The review loop.
 *
 * Keyboard-first: the whole session runs on Space and 1–4, because a trainer
 * you drive with the mouse is a trainer you stop opening. Every rating is
 * written to IndexedDB before the next card appears, so closing the tab mid
 * session loses nothing.
 *
 * There is no score, no streak, no daily goal and no congratulation. The
 * session summary reports counts, median time and which cards were rated
 * Again — the last of these is the only actionable line, because it names what
 * to go and read. Anything that turns reviewing into a number to protect
 * corrupts the ratings, and the ratings are the data.
 */

import katex from 'katex';

import { renderMath } from './math.mjs';
import { gradeTyped } from './answer.mjs';
import { buildQueue, counts, summarise } from './session.mjs';
import { applyReview, formatInterval, preview, serialiseCard } from './scheduler.mjs';
import { Store, STORES } from './store.mjs';
import { Sync, newReviewId } from './sync.mjs';

const SETTINGS_KEY = 'mfp-flashcards-settings';

const RATING_KEYS = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 };

export function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function boot({ root, cards }) {
  const el = (name) => root.querySelector(`[data-el="${name}"]`);
  const settings = loadSettings();

  let store;
  try {
    store = await Store.open();
  } catch (error) {
    el('fatal').hidden = false;
    el('fatal').textContent = `Local storage unavailable: ${error.message}. Reviews cannot be recorded.`;
    return;
  }

  const sync = new Sync({
    store,
    endpoint: settings.endpoint ?? '',
    getToken: () => loadSettings().token ?? null,
    clientId: settings.clientId ?? deviceName(),
  });

  const state = {
    queue: [],
    index: 0,
    revealed: false,
    shownAt: 0,
    events: [],
    graded: null,
  };

  wireSettings({ root, el, sync, settings });
  wireStatus({ el, sync });

  // Count what is already in IndexedDB before anything else. Without this the
  // indicator opens on the constructor's zeroes and reads "synced" on a device
  // that closed the tab with reviews still queued.
  await sync.refresh();

  // A device that has never synced starts empty; fill it before counting, so
  // the start screen is not misleading about what is due.
  try {
    await sync.hydrate();
  } catch (error) {
    el('sync-note').textContent = `Could not reach the server (${error.message}). Working from local data.`;
  }

  await showStart();

  async function showStart() {
    const states = await sync.allCardStates();
    const summary = counts({ cards, states, now: new Date() });

    el('count-due').textContent = String(summary.due);
    el('count-new').textContent = String(summary.unseen);
    el('count-later').textContent = String(summary.later);

    // Decks, not topics. Every card currently sits under the one OpenQuant
    // section, so a topic filter offers a single choice that changes nothing;
    // the deck is the grain you actually want to drill ("Markov chains only").
    const decks = [...new Set(cards.map((card) => card.deck))].sort();
    const select = el('deck');
    if (select.options.length <= 1) {
      for (const deck of decks) {
        const option = document.createElement('option');
        option.value = deck;
        option.textContent = deck.replaceAll('-', ' ');
        select.append(option);
      }
    }

    show('start');
    el('start-button').focus();
  }

  el('start-button').addEventListener('click', async () => {
    const deck = el('deck').value;
    const states = await sync.allCardStates();
    state.queue = buildQueue({
      cards,
      states,
      now: new Date(),
      decks: deck ? [deck] : [],
      newPerSession: Number(el('new-limit').value) || undefined,
    });
    state.index = 0;
    state.events = [];

    if (state.queue.length === 0) {
      el('empty').hidden = false;
      return;
    }
    el('empty').hidden = true;
    // The settings panel opens itself when no server is configured, which is
    // right on the start screen and wrong the moment a session begins: it
    // pushes the card below the fold, and the first thing you do is scroll.
    el('settings-panel').hidden = true;
    show('review');
    renderCard();
    root.querySelector('[data-screen="review"]').scrollIntoView({ block: 'start' });
  });

  function renderCard() {
    const entry = state.queue[state.index];
    state.revealed = false;
    state.graded = null;
    state.shownAt = performance.now();

    el('progress').textContent = `${state.index + 1} / ${state.queue.length}`;
    el('card-topic').textContent = entry.card.deck.replaceAll('-', ' ');
    el('card-type').textContent = entry.card.type;

    renderMath(el('front'), entry.card.front, katex);
    el('back').hidden = true;
    el('ratings').hidden = true;
    el('reveal').hidden = false;
    el('hint').hidden = !entry.card.hint;
    el('hint-text').hidden = true;
    el('verdict').hidden = true;
    el('sources').replaceChildren();

    const typed = entry.card.type === 'formula' && entry.card.answer;
    el('answer-form').hidden = !typed;
    if (typed) {
      el('answer-input').value = '';
      el('answer-input').focus();
    } else {
      el('reveal').focus();
    }
  }

  function reveal() {
    if (state.revealed) return;
    const entry = state.queue[state.index];
    state.revealed = true;

    renderMath(el('back'), entry.card.back, katex);
    el('back').hidden = false;
    el('reveal').hidden = true;
    el('answer-form').hidden = true;

    const list = el('sources');
    list.replaceChildren();
    for (const source of entry.card.sources ?? []) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = source.url;
      link.textContent = source.label;
      link.rel = 'noreferrer';
      link.target = '_blank';
      item.append(link);
      list.append(item);
    }

    // Interval previews on the buttons: seeing that Hard costs three days and
    // Good costs three weeks is what makes the four ratings a real choice
    // rather than a pass/fail dressed up.
    const options = preview(entry.fsrs, new Date());
    for (const option of options) {
      const button = el(`rate-${option.value}`);
      button.querySelector('[data-el="interval"]').textContent = option.intervalLabel;
    }

    el('ratings').hidden = false;
    const suggested = state.graded?.correct === false ? 1 : 3;
    el(`rate-${suggested}`).focus();
  }

  async function rate(rating) {
    if (!state.revealed) return;
    const entry = state.queue[state.index];
    const now = new Date();
    const durationMs = Math.round(performance.now() - state.shownAt);

    const { next, review } = applyReview(entry.fsrs, rating, now, {
      cardId: entry.card.id,
      reviewId: newReviewId(),
      durationMs,
      clientId: sync.clientId,
    });

    // Durable first, then move on. Enqueue writes to IndexedDB and returns; the
    // network attempt is fired but not awaited, so a dead connection never
    // stalls the next card.
    await sync.enqueue(review, serialiseCard(entry.card.id, next, now.getTime()));
    sync.flush().catch(() => {});

    state.events.push({
      cardId: entry.card.id,
      topic: entry.card.topic,
      front: entry.card.front,
      rating,
      durationMs,
      typedCorrect: state.graded?.correct ?? null,
    });

    state.index += 1;
    if (state.index >= state.queue.length) finish();
    else renderCard();
  }

  function finish() {
    const result = summarise(state.events);
    el('summary-reviewed').textContent = String(result.reviewed);
    el('summary-time').textContent = result.medianMs === null ? '—' : `${(result.medianMs / 1000).toFixed(1)}s`;
    // "0 min" for a twenty-second session is a wrong-looking number, and a
    // wrong-looking number is one you stop reading.
    el('summary-total').textContent =
      result.totalMs < 60_000
        ? `${Math.round(result.totalMs / 1000)}s`
        : `${Math.round(result.totalMs / 60_000)} min`;

    const spread = el('summary-spread');
    spread.replaceChildren();
    for (const [rating, label] of [[1, 'Again'], [2, 'Hard'], [3, 'Good'], [4, 'Easy']]) {
      const item = document.createElement('li');
      item.innerHTML = `<span>${label}</span> <b>${result.byRating[rating] ?? 0}</b>`;
      spread.append(item);
    }

    const again = el('summary-again');
    again.replaceChildren();
    el('summary-again-wrap').hidden = result.again.length === 0;
    for (const event of result.again) {
      const item = document.createElement('li');
      renderMath(item, event.front, katex);
      again.append(item);
    }

    show('summary');
    sync.flush().catch(() => {});
    el('again-button').focus();
  }

  el('answer-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const entry = state.queue[state.index];
    state.graded = gradeTyped(el('answer-input').value, entry.card.answer);

    const verdict = el('verdict');
    verdict.hidden = false;
    verdict.dataset.correct = String(state.graded.correct);
    verdict.textContent = state.graded.correct
      ? 'Matches.'
      : state.graded.near
        ? 'Not a match — same letters, different case, and case is meaning here.'
        : 'Not a match.';

    reveal();
  });

  el('reveal').addEventListener('click', reveal);
  el('hint').addEventListener('click', () => {
    const entry = state.queue[state.index];
    renderMath(el('hint-text'), entry.card.hint ?? '', katex);
    el('hint-text').hidden = false;
  });
  for (const rating of [1, 2, 3, 4]) {
    el(`rate-${rating}`).addEventListener('click', () => rate(rating));
  }
  el('again-button').addEventListener('click', showStart);
  el('end-button').addEventListener('click', () => (state.events.length ? finish() : showStart()));

  document.addEventListener('keydown', (event) => {
    if (root.querySelector('[data-screen="review"]').hidden) return;
    const typing = document.activeElement === el('answer-input');

    if (event.code === 'Escape') {
      event.preventDefault();
      state.events.length ? finish() : showStart();
      return;
    }
    if (typing) return;

    if ((event.code === 'Space' || event.code === 'Enter') && !state.revealed) {
      event.preventDefault();
      reveal();
      return;
    }
    if (state.revealed && RATING_KEYS[event.code]) {
      event.preventDefault();
      rate(RATING_KEYS[event.code]);
      return;
    }
    if (event.code === 'KeyH') {
      event.preventDefault();
      el('hint').click();
    }
  });

  function show(screen) {
    for (const node of root.querySelectorAll('[data-screen]')) {
      node.hidden = node.dataset.screen !== screen;
    }
  }
}

function wireSettings({ root, el, sync, settings }) {
  const form = el('settings-form');
  el('endpoint-input').value = settings.endpoint ?? '';
  el('token-input').value = settings.token ?? '';

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const next = {
      ...loadSettings(),
      endpoint: el('endpoint-input').value.trim().replace(/\/$/, ''),
      token: el('token-input').value.trim(),
    };
    saveSettings(next);
    sync.endpoint = next.endpoint;
    el('settings-saved').hidden = false;
    sync.flush().catch(() => {});
  });

  el('settings-toggle').addEventListener('click', () => {
    const panel = el('settings-panel');
    panel.hidden = !panel.hidden;
  });

  el('export-button')?.addEventListener('click', async () => {
    const rows = await sync.store.all(STORES.queue);
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pending-reviews.json';
    link.click();
    URL.revokeObjectURL(url);
  });

  if (!settings.endpoint) {
    el('settings-panel').hidden = false;
    el('sync-note').textContent =
      'No server configured. Reviews are recorded locally and will sync once you add the endpoint and token.';
  }
  void root;
}

function wireStatus({ el, sync }) {
  sync.subscribe((status) => {
    const label = {
      idle: status.pending > 0 ? `${status.pending} waiting to sync` : 'synced',
      syncing: 'syncing…',
      offline: `offline — ${status.pending} held locally`,
      error: status.lastError ?? 'sync error',
      unconfigured: `${status.pending} stored locally, no server set`,
    }[status.state];

    el('sync-status').textContent = label;
    el('sync-status').dataset.state = status.state;
    el('quarantine').hidden = status.quarantined === 0;
    el('quarantine-count').textContent = String(status.quarantined);
  });
}

function deviceName() {
  const platform = navigator.userAgentData?.platform ?? navigator.platform ?? 'browser';
  return `${platform}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) || 'browser';
}
