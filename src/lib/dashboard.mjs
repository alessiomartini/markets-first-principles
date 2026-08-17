/**
 * Rendering for the diagnostics page.
 *
 * All the arithmetic lives in diagnostics.mjs and is tested there; this file
 * only draws. The charts are hand-built SVG rather than Observable Plot: Plot
 * is a build-time dependency here (see src/lib/figures.mjs) and these charts
 * are drawn from data that exists only in the reader's browser.
 *
 * Every panel states what it measures and what would count as a bad reading,
 * because a number nobody can interpret is decoration.
 */

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
import { Store } from './store.mjs';
import { Sync } from './sync.mjs';
import { loadSettings } from './trainer.mjs';

const SVG = 'http://www.w3.org/2000/svg';

export async function bootDashboard({ root, cards }) {
  const el = (name) => root.querySelector(`[data-el="${name}"]`);
  const settings = loadSettings();

  let store;
  try {
    store = await Store.open();
  } catch (error) {
    el('fatal').hidden = false;
    el('fatal').textContent = `Local storage unavailable: ${error.message}.`;
    return;
  }

  const sync = new Sync({
    store,
    endpoint: settings.endpoint ?? '',
    getToken: () => loadSettings().token ?? null,
  });

  try {
    await sync.hydrate();
  } catch {
    el('note').textContent =
      'Could not reach the server. Showing the history stored in this browser only.';
  }

  const reviews = await sync.allReviews();
  const states = await sync.allCardStates();
  const now = new Date();

  if (reviews.length === 0) {
    el('empty').hidden = false;
    el('panels').hidden = true;
    return;
  }

  renderRetention({ el, reviews, cards });
  renderCalibration({ el, reviews });
  renderStates({ el, cards, states });
  renderStrength({ el, cards, states, now });
  renderLeeches({ el, reviews, cards });
  renderActivity({ el, reviews, now });
  renderForecast({ el, states, now });
}

// --- panels -----------------------------------------------------------------

function renderRetention({ el, reviews, cards }) {
  const overall = trueRetention(reviews);
  el('retention-overall').textContent = overall.rate === null ? '—' : percent(overall.rate);
  el('retention-n').textContent = String(overall.reviews);

  const rows = retentionBy(reviews, cards).filter((row) => row.reviews > 0);
  const table = el('retention-table');
  table.replaceChildren();

  for (const row of rows) {
    table.append(
      tableRow([
        row.group.replaceAll('-', ' '),
        row.rate === null ? '—' : percent(row.rate),
        `${row.recalled}/${row.reviews}`,
      ])
    );
  }
  el('retention-empty').hidden = rows.length > 0;
}

function renderCalibration({ el, reviews }) {
  const result = calibration(reviews);
  el('calibration-error').textContent =
    result.meanAbsoluteError === null ? '—' : result.meanAbsoluteError.toFixed(3);
  el('calibration-n').textContent = String(result.samples);

  const width = 320;
  const height = 240;
  const pad = 34;
  const svg = makeSvg(width, height);
  const x = (v) => pad + v * (width - pad - 8);
  const y = (v) => height - pad - v * (height - pad - 8);

  // The diagonal is the claim being tested: predicted = observed.
  svg.append(
    line(x(0), y(0), x(1), y(1), { stroke: 'var(--chart-muted)', 'stroke-dasharray': '3 3' })
  );
  svg.append(axis(pad, height - pad, width - 8, height - pad));
  svg.append(axis(pad, height - pad, pad, 8));

  for (const tick of [0, 0.5, 1]) {
    svg.append(text(x(tick), height - pad + 14, tick.toFixed(1), { 'text-anchor': 'middle' }));
    svg.append(text(pad - 6, y(tick) + 4, tick.toFixed(1), { 'text-anchor': 'end' }));
  }

  const maxN = Math.max(...result.buckets.map((b) => b.n), 1);
  for (const bucket of result.buckets) {
    const dot = document.createElementNS(SVG, 'circle');
    dot.setAttribute('cx', x(bucket.predicted));
    dot.setAttribute('cy', y(bucket.observed));
    // Area proportional to sample count: a bucket holding three reviews should
    // not look like evidence.
    dot.setAttribute('r', String(3 + 7 * Math.sqrt(bucket.n / maxN)));
    dot.setAttribute('fill', 'var(--series-1)');
    dot.setAttribute('fill-opacity', '0.75');
    dot.append(titleNode(`predicted ${percent(bucket.predicted)}, observed ${percent(bucket.observed)}, n=${bucket.n}`));
    svg.append(dot);
  }

  svg.append(text(width / 2, height - 6, 'predicted recall', { 'text-anchor': 'middle', class: 'chart-label' }));
  const yLabel = text(12, height / 2, 'observed', { 'text-anchor': 'middle', class: 'chart-label' });
  yLabel.setAttribute('transform', `rotate(-90 12 ${height / 2})`);
  svg.append(yLabel);

  el('calibration-chart').replaceChildren(svg);

  // Describe the number, not a picture the reader is not seeing.
  //
  // The summary is weighted by review count, so one heavily populated bucket
  // can be below the diagonal while most of the visible dots are above it. An
  // earlier version said "points sit below the diagonal" and was flatly
  // contradicted by its own chart. Say "on average, weighted by reviews", and
  // say so explicitly when the buckets disagree.
  const verdict = el('calibration-verdict');
  if (result.samples < 50) {
    verdict.textContent = `Only ${result.samples} mature reviews so far — too few to read anything into.`;
    return;
  }

  const weighted =
    result.buckets.reduce((sum, b) => sum + b.n * (b.observed - b.predicted), 0) / result.samples;
  const gap = Math.abs(weighted * 100).toFixed(1);
  const above = result.buckets.filter((b) => b.observed > b.predicted).length;
  const mixed = above > 0 && above < result.buckets.length;

  const headline =
    Math.abs(weighted) < 0.03
      ? `Weighted across ${result.samples} reviews, observed recall matches the prediction to within a point — the model’s confidence about you is about right.`
      : weighted < 0
        ? `Weighted across ${result.samples} reviews, observed recall runs ${gap} points below the prediction: the model is overconfident here, so its intervals are longer than your memory supports.`
        : `Weighted across ${result.samples} reviews, observed recall runs ${gap} points above the prediction: the model is underconfident, so cards are coming back sooner than they need to.`;

  verdict.textContent = mixed
    ? `${headline} Buckets fall on both sides of the diagonal, so read the chart rather than this one number — the average is dominated by whichever bucket holds the most reviews.`
    : headline;
}

function renderStates({ el, cards, states }) {
  const mix = stateMix(cards, states);
  const total = mix.reduce((sum, row) => sum + row.count, 0) || 1;
  const bar = el('state-bar');
  bar.replaceChildren();

  mix.forEach((row, index) => {
    if (row.count === 0) return;
    const segment = document.createElement('span');
    segment.style.width = `${(row.count / total) * 100}%`;
    segment.style.background = `var(--series-${(index % 3) + 1})`;
    segment.style.opacity = row.state === 'New' ? '0.25' : '1';
    segment.title = `${row.state}: ${row.count}`;
    bar.append(segment);
  });

  const legend = el('state-legend');
  legend.replaceChildren();
  for (const row of mix) {
    const item = document.createElement('li');
    item.innerHTML = `<span>${row.state}</span> <b>${row.count}</b>`;
    legend.append(item);
  }
}

function renderStrength({ el, cards, states, now }) {
  const table = el('strength-table');
  table.replaceChildren();
  for (const row of strengthBy(cards, states, now)) {
    table.append(
      tableRow([
        row.group.replaceAll('-', ' '),
        String(row.cards),
        row.medianStability === null ? '—' : `${row.medianStability.toFixed(1)} d`,
        row.meanRetrievability === null ? '—' : percent(row.meanRetrievability),
      ])
    );
  }
}

function renderLeeches({ el, reviews, cards }) {
  const rows = leeches(reviews, cards);
  el('leeches-empty').hidden = rows.length > 0;
  const list = el('leeches-list');
  list.replaceChildren();

  for (const row of rows) {
    const item = document.createElement('li');
    const count = document.createElement('b');
    count.textContent = `${row.lapses}×`;
    item.append(count, document.createTextNode(` ${row.card.front}`));
    const deck = document.createElement('span');
    deck.className = 'dash__deck';
    deck.textContent = row.card.deck?.replaceAll('-', ' ') ?? '';
    item.append(deck);
    list.append(item);
  }
}

function renderActivity({ el, reviews, now }) {
  const days = activity(reviews, { days: 119, now });
  const grid = el('activity-grid');
  grid.replaceChildren();
  const max = Math.max(...days.map((day) => day.count), 1);

  for (const day of days) {
    const cell = document.createElement('span');
    cell.className = 'dash__day';
    // Zero days stay visible as empty cells: a fortnight off should look like
    // a fortnight off, not like a gap in the axis.
    cell.style.opacity = day.count === 0 ? '0.12' : String(0.25 + 0.75 * (day.count / max));
    cell.title = `${day.date.toISOString().slice(0, 10)}: ${day.count} review${day.count === 1 ? '' : 's'}`;
    grid.append(cell);
  }

  const active = days.filter((day) => day.count > 0).length;
  el('activity-summary').textContent =
    `${reviews.length} reviews on ${active} of the last ${days.length} days.`;
}

function renderForecast({ el, states, now }) {
  const { overdue, days } = forecast(states, { days: 14, now });
  el('forecast-overdue').textContent = String(overdue);

  const max = Math.max(...days.map((day) => day.count), 1);
  const chart = el('forecast-chart');
  chart.replaceChildren();

  for (const day of days) {
    const column = document.createElement('div');
    column.className = 'dash__bar';
    const fill = document.createElement('span');
    fill.style.height = `${(day.count / max) * 100}%`;
    column.append(fill);
    column.title = `${day.date.toISOString().slice(0, 10)}: ${day.count} due`;
    chart.append(column);
  }

  // The bars are scaled to the busiest day, so without the scale printed a
  // wall of full-height bars means one card a day exactly as much as it means
  // eighty. Unlabelled relative heights are how a chart lies without an error.
  const total = days.reduce((sum, day) => sum + day.count, 0);
  el('forecast-scale').textContent =
    `${total} card${total === 1 ? '' : 's'} over the fourteen days; the tallest bar is ${max}.`;
}

// --- small DOM helpers ------------------------------------------------------

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function tableRow(cells) {
  const row = document.createElement('tr');
  for (const cell of cells) {
    const td = document.createElement('td');
    td.textContent = cell;
    row.append(td);
  }
  return row;
}

function makeSvg(width, height) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('role', 'img');
  return svg;
}

function line(x1, y1, x2, y2, attributes = {}) {
  const node = document.createElementNS(SVG, 'line');
  node.setAttribute('x1', x1);
  node.setAttribute('y1', y1);
  node.setAttribute('x2', x2);
  node.setAttribute('y2', y2);
  node.setAttribute('stroke', 'var(--chart-muted)');
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function axis(x1, y1, x2, y2) {
  return line(x1, y1, x2, y2, { 'stroke-opacity': '0.5' });
}

function text(x, y, content, attributes = {}) {
  const node = document.createElementNS(SVG, 'text');
  node.setAttribute('x', x);
  node.setAttribute('y', y);
  node.setAttribute('font-size', '10');
  node.setAttribute('fill', 'var(--chart-muted)');
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  node.textContent = content;
  return node;
}

function titleNode(content) {
  const node = document.createElementNS(SVG, 'title');
  node.textContent = content;
  return node;
}
