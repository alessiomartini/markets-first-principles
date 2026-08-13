import * as Plot from '@observablehq/plot';
import { parseHTML } from 'linkedom';

/**
 * Figures are rendered to static SVG at build time, not in the browser.
 *
 * That is a deliberate trade against the usual advice to ship a hover layer:
 * the architecture rule for this site is that the browser talks to at most one
 * live API and otherwise runs no JavaScript, so a tooltip would cost every
 * reader a chart library. The accessibility intent is met by other means —
 * every series carries a direct label so identity is never colour-alone, and
 * every figure ships a data table underneath (see Figure.astro). The one
 * genuinely interactive figure, the live order book, is an island and opts out
 * of this path entirely.
 */

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * Rendering happens once, against the light palette, and the resulting hexes
 * are rewritten into `var(--token, #fallback)` so that a single CSS swap
 * repaints every chart for dark mode. Rendering twice would double build time
 * and let the two modes drift apart.
 */
const LIGHT = {
  series: ['#2a78d6', '#eb6834', '#1baf7a'],
  bid: '#2a78d6',
  ask: '#e34948',
  ink: '#0b0b0b',
  muted: '#898781',
};

const SURFACE = '#fcfcfb';

const TOKENS = new Map([
  [LIGHT.series[0], '--series-1'],
  [LIGHT.series[1], '--series-2'],
  [LIGHT.series[2], '--series-3'],
  [LIGHT.ask, '--series-ask'],
  [LIGHT.ink, '--chart-ink'],
  [LIGHT.muted, '--chart-muted'],
  [SURFACE, '--surface'],
]);

const SUPERSCRIPT = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/**
 * Label decades as 10⁻³ rather than Plot's default SI prefixes, which turn
 * probabilities into "100m" and "1µ" and read as milli- and micro-somethings.
 * Non-decade ticks get no label at all, leaving the minor gridlines unlabelled.
 */
function plainNumber(value) {
  return value >= 1 ? value.toLocaleString('en-GB') : String(value);
}

function decadeTicks(value) {
  const exponent = Math.log10(value);
  const rounded = Math.round(exponent);
  if (Math.abs(exponent - rounded) > 1e-9) return '';
  if (rounded === 0) return '1';
  return `10${String(rounded).split('').map((char) => SUPERSCRIPT[char] ?? char).join('')}`;
}

function themeify(svg) {
  let out = svg;
  for (const [hex, token] of TOKENS) {
    out = out.replaceAll(hex, `var(${token}, ${hex})`);
    out = out.replaceAll(hex.toUpperCase(), `var(${token}, ${hex})`);
  }
  return out;
}

function baseOptions(figure, extra = {}) {
  return {
    width: 720,
    height: 420,
    marginLeft: 64,
    marginBottom: 48,
    marginTop: 24,
    marginRight: 96,
    style: { background: 'transparent', color: LIGHT.ink, fontFamily: FONT, fontSize: '12px' },
    ...extra,
  };
}

function seriesColour(index) {
  return LIGHT.series[index % LIGHT.series.length];
}

/**
 * Direct labels, so identity never depends on colour alone.
 *
 * With `stagger`, each series is labelled at a different point along its own
 * curve rather than all of them at the right-hand end — on a survival function
 * the curves converge there and the labels would land on top of each other.
 * A surface-coloured halo keeps the text readable where it crosses a line.
 */
function directLabels(rows, colourFor, { stagger = false } = {}) {
  const bySeries = new Map();
  for (const row of rows) {
    if (!bySeries.has(row.series)) bySeries.set(row.series, []);
    bySeries.get(row.series).push(row);
  }

  return [...bySeries.entries()].map(([key, points], i) => {
    const ordered = [...points].sort((a, b) => a.x - b.x);
    const at = stagger
      ? Math.min(ordered.length - 1, Math.round((ordered.length - 1) * (0.4 + 0.24 * i)))
      : ordered.length - 1;
    const row = ordered[at];

    return Plot.text([row], {
      x: 'x',
      y: 'y',
      text: () => row.seriesLabel ?? key,
      dy: -11,
      dx: stagger ? 0 : 8,
      textAnchor: stagger ? 'middle' : 'start',
      fill: colourFor(key),
      fontWeight: 600,
      stroke: SURFACE,
      strokeWidth: 3,
      paintOrder: 'stroke',
    });
  });
}

function withSeriesLabels(figure) {
  const labels = new Map((figure.series ?? []).map((s) => [s.key, s.label ?? s.key]));
  const order = [...(figure.series ?? []).map((s) => s.key)];
  const colourFor = (key) => seriesColour(Math.max(0, order.indexOf(key)));
  const rows = figure.data.map((row) => ({ ...row, seriesLabel: labels.get(row.series) ?? row.series }));
  return { rows, colourFor };
}

const RENDERERS = {
  /** Magnitude comparison across named categories. One series, so no legend. */
  bar(figure, document) {
    const data = figure.data;
    const isLog = figure.x?.type === 'log';

    // A bar has to start somewhere, and on a log axis that cannot be zero —
    // leaving it implicit makes Plot drop every bar silently. The baseline is
    // the decade below the smallest value, so the shortest bar is still
    // visible and the comparison stays honest about being logarithmic.
    const smallest = Math.min(...data.map((d) => d.value).filter((value) => value > 0));
    const baseline = isLog ? (figure.x?.floor ?? 10 ** Math.floor(Math.log10(smallest) - 1)) : 0;

    // Value labels sit outside the bar end, so the margin has to fit the
    // longest of them.
    const widest = Math.max(...data.map((d) => (d.display ?? String(d.value)).length));

    return Plot.plot(
      baseOptions(figure, {
        document,
        height: Math.max(220, 40 * data.length + 90),
        marginLeft: 170,
        marginRight: Math.max(48, widest * 7 + 20),
        x: {
          label: figure.x?.label ?? null,
          type: figure.x?.type ?? 'linear',
          grid: true,
          // Plot's default log format renders 0.1 as "100m", which reads as a
          // milli-something rather than a tenth.
          tickFormat: figure.x?.tickFormat ?? (isLog ? plainNumber : undefined),
        },
        y: { label: null, domain: data.map((d) => d.label) },
        marks: [
          Plot.barX(data, {
            x1: baseline,
            x2: 'value',
            y: 'label',
            fill: LIGHT.series[0],
            // 4px rounded data-end, square against the baseline.
            rx2: 4,
            insetTop: 2,
            insetBottom: 2,
          }),
          Plot.text(data, {
            x: 'value',
            y: 'label',
            text: (d) => d.display ?? String(d.value),
            dx: 8,
            textAnchor: 'start',
            fill: LIGHT.ink,
          }),
          Plot.ruleX([baseline], { stroke: LIGHT.muted }),
        ],
      })
    );
  },

  /** Time series or any ordered x. Multiple series, direct-labelled. */
  line(figure, document) {
    const { rows, colourFor } = withSeriesLabels(figure);
    return Plot.plot(
      baseOptions(figure, {
        document,
        x: { label: figure.x?.label ?? null, type: figure.x?.type ?? 'linear', grid: true },
        y: { label: figure.y?.label ?? null, type: figure.y?.type ?? 'linear', grid: true },
        marks: [
          Plot.line(rows, { x: 'x', y: 'y', z: 'series', stroke: (d) => colourFor(d.series), strokeWidth: 2 }),
          ...directLabels(rows, colourFor),
          Plot.ruleY([0], { stroke: LIGHT.muted, strokeOpacity: 0.6 }),
        ],
      })
    );
  },

  /**
   * The workhorse of Track 3: a survival function on log-log axes, where a
   * power law is a straight line and a Gaussian falls off a cliff.
   */
  loglog(figure, document) {
    const { rows, colourFor } = withSeriesLabels(figure);

    // The Gaussian reference falls off a cliff — plotted in full it drags the
    // y domain down by ten decades and squashes the part of the chart the page
    // is actually about. Scale the axis to the empirical curves and let the
    // reference run out of the bottom of the frame, which is also the visual
    // point being made.
    const floor = Math.min(...rows.map((row) => row.y).filter((y) => y > 0));
    const reference = (figure.reference ?? []).filter((point) => point.y >= floor);

    return Plot.plot(
      baseOptions(figure, {
        document,
        marginRight: 40,
        x: { label: figure.x?.label ?? null, type: 'log', grid: true },
        y: {
          label: figure.y?.label ?? null,
          type: 'log',
          grid: true,
          tickFormat: decadeTicks,
          domain: [floor / 2, 1],
        },
        marks: [
          ...(reference.length
            ? [
                Plot.line(reference, {
                  x: 'x',
                  y: 'y',
                  stroke: LIGHT.muted,
                  strokeDasharray: '4 4',
                  strokeWidth: 1.5,
                }),
                Plot.text([reference.at(-1)], {
                  x: 'x',
                  y: 'y',
                  text: () => figure.referenceLabel ?? 'reference',
                  dx: 8,
                  textAnchor: 'start',
                  fill: LIGHT.muted,
                }),
              ]
            : []),
          Plot.line(rows, { x: 'x', y: 'y', z: 'series', stroke: (d) => colourFor(d.series), strokeWidth: 2 }),
          ...directLabels(rows, colourFor, { stagger: true }),
        ],
      })
    );
  },

  /** Cumulative order book depth: bids to the left, asks to the right. */
  depth(figure, document) {
    const bids = figure.data.filter((d) => d.side === 'bid');
    const asks = figure.data.filter((d) => d.side === 'ask');
    const mid = figure.mid ?? 0;

    return Plot.plot(
      baseOptions(figure, {
        document,
        marginRight: 40,
        // Price ticks are long numbers; six of them fit without colliding.
        x: { label: figure.x?.label ?? 'price', grid: true, ticks: 6 },
        y: { label: figure.y?.label ?? 'cumulative size', grid: true },
        marks: [
          Plot.areaY(bids, {
            x: 'price',
            y: 'cumulative',
            fill: LIGHT.bid,
            fillOpacity: 0.18,
            curve: 'step-after',
          }),
          Plot.areaY(asks, {
            x: 'price',
            y: 'cumulative',
            fill: LIGHT.ask,
            fillOpacity: 0.18,
            curve: 'step-before',
          }),
          Plot.line(bids, { x: 'price', y: 'cumulative', stroke: LIGHT.bid, strokeWidth: 2, curve: 'step-after' }),
          Plot.line(asks, { x: 'price', y: 'cumulative', stroke: LIGHT.ask, strokeWidth: 2, curve: 'step-before' }),
          Plot.ruleX([mid], { stroke: LIGHT.muted, strokeDasharray: '3 3' }),
          Plot.text([{ price: mid }], {
            x: 'price',
            y: 0,
            text: () => 'mid',
            dy: -8,
            fill: LIGHT.muted,
          }),
          Plot.text(bids.length ? [bids.at(-1)] : [], {
            x: 'price',
            y: 'cumulative',
            text: () => 'bids',
            dx: 6,
            textAnchor: 'start',
            fill: LIGHT.bid,
            fontWeight: 600,
          }),
          Plot.text(asks.length ? [asks.at(-1)] : [], {
            x: 'price',
            y: 'cumulative',
            text: () => 'asks',
            dx: -6,
            textAnchor: 'end',
            fill: LIGHT.ask,
            fontWeight: 600,
          }),
        ],
      })
    );
  },

  scatter(figure, document) {
    const { rows, colourFor } = withSeriesLabels(figure);
    return Plot.plot(
      baseOptions(figure, {
        document,
        x: { label: figure.x?.label ?? null, type: figure.x?.type ?? 'linear', grid: true },
        y: { label: figure.y?.label ?? null, type: figure.y?.type ?? 'linear', grid: true },
        marks: [
          Plot.dot(rows, {
            x: 'x',
            y: 'y',
            fill: (d) => colourFor(d.series),
            r: 5,
            stroke: '#fcfcfb',
            strokeWidth: 2,
          }),
          Plot.text(rows, {
            x: 'x',
            y: 'y',
            text: (d) => d.label ?? '',
            dy: -12,
            fill: LIGHT.ink,
          }),
        ],
      })
    );
  },
};

/**
 * Render one figure JSON payload to a themed SVG string.
 * Returns null for payloads this renderer does not know how to draw, so a new
 * chart type fails visibly in the page rather than breaking the build.
 */
export function renderFigure(figure) {
  const renderer = RENDERERS[figure.chart];
  if (!renderer) return null;

  const { document } = parseHTML('<!doctype html><html><body></body></html>');
  const node = renderer(figure, document);
  const svg = node.outerHTML ?? String(node);
  return themeify(svg);
}

/** Column headers and rows for the accessible table under each figure. */
export function figureTable(figure) {
  const rows = figure.data ?? [];
  if (!rows.length) return { columns: [], rows: [] };
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((key) => key !== 'seriesLabel');
  return { columns, rows: rows.map((row) => columns.map((col) => row[col] ?? '')) };
}
