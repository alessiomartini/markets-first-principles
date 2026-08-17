/**
 * Drive the diagnostics page in a real browser against a seeded history.
 *
 * Seeding matters: a fresh browser has no mature reviews, so every panel shows
 * an em-dash and a screenshot proves nothing. Here IndexedDB is filled with a
 * synthetic log whose true retention and calibration are known in advance, and
 * the page is then required to report those numbers back.
 *
 *   npm run build && node scripts/check-dashboard.mjs [screenshot-dir]
 *
 * Playwright is not a project dependency; install it globally or set
 * PLAYWRIGHT_MODULE.
 */
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

let chromium;
for (const specifier of [
  'playwright',
  process.env.PLAYWRIGHT_MODULE,
  '/usr/lib/node_modules/playwright/index.mjs',
  '/opt/node22/lib/node_modules/playwright/index.mjs',
]) {
  if (!specifier) continue;
  try {
    ({ chromium } = await import(specifier));
    break;
  } catch {
    /* next candidate */
  }
}
if (!chromium) {
  console.error('playwright is not installed. `npm i -g playwright`, or set PLAYWRIGHT_MODULE.');
  process.exit(2);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, '..', 'dist');
const BASE = '/markets-first-principles';
const SHOTS = process.argv[2] ?? join(tmpdir(), 'dashboard-shots');
await mkdir(SHOTS, { recursive: true });

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf',
};

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(req.url.split('?')[0]);
  if (path.startsWith(BASE)) path = path.slice(BASE.length);
  if (path.endsWith('/')) path += 'index.html';
  const file = join(DIST, normalize(path));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(4398, r));

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}
);
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });

const problems = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
});
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

const check = (label, condition, detail = '') => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) problems.push(label);
};

// Land on the trainer first so the database exists at the current version.
await page.goto(`http://localhost:4398${BASE}/flashcards/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('[data-el="count-new"]')?.textContent === '40');

// --- seed a history with known properties -----------------------------------
//
// 200 mature reviews on cards whose ids come from the real decks:
//   - 150 at elapsed = stability (model predicts 0.90), 135 recalled → 0.90
//   -  50 on one card, all Again → that card becomes the top leech
// plus 40 learning-state reviews that must NOT count towards retention.
const seeded = await page.evaluate(async () => {
  const cards = JSON.parse(document.querySelector('[data-cards]').textContent);
  const byDeck = {};
  for (const card of cards) (byDeck[card.deck] ??= []).push(card.id);
  const decks = Object.keys(byDeck).sort();

  const now = Date.now();
  const DAY = 86_400_000;
  const reviews = [];
  let n = 0;
  const push = (row) => reviews.push({
    review_id: `seed-${n++}`, reviewed_at: now - (n % 60) * DAY, rating: 3, state: 2,
    elapsed_days: 10, scheduled_days: 10, stability: 10, difficulty: 5,
    duration_ms: 4000, client_id: 'seed', algo_version: 'seed', ...row,
  });

  // 150 mature reviews, 135 recalled. Elapsed time varies so the predicted
  // recall spans several deciles — with one elapsed value every review lands
  // in a single bucket and the chart draws one dot, which tests nothing.
  // t/S up to 100. The FSRS-6 curve is a power law and remarkably flat: even
  // four stability-lengths still predicts 0.78, so a narrower spread piles
  // every review into the top two deciles and the chart tests nothing.
  const elapsed = [2, 10, 40, 100, 300, 1000];
  for (let i = 0; i < 150; i += 1) {
    push({
      card_id: byDeck[decks[i % decks.length]][i % 5],
      elapsed_days: elapsed[i % elapsed.length],
      rating: i % 10 === 9 ? 1 : 3,
    });
  }
  // One card forgotten 50 times — the leech.
  const leechId = byDeck[decks[0]][6] ?? byDeck[decks[0]][0];
  for (let i = 0; i < 50; i += 1) push({ card_id: leechId, rating: 1 });

  // Learning-state reviews, which must be excluded from retention.
  for (let i = 0; i < 40; i += 1) {
    push({ card_id: byDeck[decks[1]][0], rating: 3, state: 1, stability: 0.5, elapsed_days: 0 });
  }

  const states = cards.slice(0, 25).map((card, i) => ({
    card_id: card.id,
    due: now + (i - 5) * DAY,
    stability: 5 + i,
    difficulty: 5,
    elapsed_days: 1,
    scheduled_days: 5 + i,
    reps: 4,
    lapses: i % 3,
    state: i < 20 ? 2 : 3,
    last_review: now - DAY,
    updated_at: now,
  }));

  const db = await new Promise((res, rej) => {
    const request = indexedDB.open('mfp-flashcards');
    request.onsuccess = () => res(request.result);
    request.onerror = () => rej(request.error);
  });
  await new Promise((res, rej) => {
    const tx = db.transaction(['reviews', 'cards'], 'readwrite');
    for (const row of reviews) tx.objectStore('reviews').put(row);
    for (const row of states) tx.objectStore('cards').put(row);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
  db.close();

  return { reviews: reviews.length, mature: 200, leechId, decks: decks.length, states: states.length };
});

console.log(`seeded ${seeded.reviews} reviews, leech = ${seeded.leechId}`);

// --- the dashboard ----------------------------------------------------------
await page.goto(`http://localhost:4398${BASE}/flashcards/dashboard/`, { waitUntil: 'networkidle' });
await page.waitForFunction(
  () => document.querySelector('[data-el="retention-overall"]')?.textContent !== '—',
  { timeout: 10_000 }
);

const read = (selector) => page.textContent(selector).then((t) => t.trim());

const retention = await read('[data-el="retention-overall"]');
const matureN = await read('[data-el="retention-n"]');
// 135 recalled of 200 mature (150 mixed + 50 all-Again) = 67.5%.
check('true retention is computed from mature reviews only', retention === '67.5%', retention);
check('the 40 learning-state reviews are excluded', matureN === '200', matureN);

const calN = await read('[data-el="calibration-n"]');
const calError = await read('[data-el="calibration-error"]');
check('calibration uses the mature reviews', calN === '200', calN);
check('calibration error is a number, not NaN', /^[0-9]+\.[0-9]+$/.test(calError), calError);

const dots = await page.evaluate(
  () => document.querySelectorAll('[data-el="calibration-chart"] circle').length
);
check('the calibration chart spreads across buckets', dots >= 4, `${dots} dots`);

const chartBox = await page.evaluate(() => {
  const svg = document.querySelector('[data-el="calibration-chart"] svg');
  if (!svg) return null;
  const box = svg.getBoundingClientRect();
  const dot = svg.querySelector('circle')?.getBoundingClientRect();
  return dot
    ? { inside: dot.left >= box.left - 1 && dot.right <= box.right + 1 && dot.top >= box.top - 1 && dot.bottom <= box.bottom + 1, w: box.width, h: box.height }
    : null;
});
check('the chart has real size and its points are inside it',
  chartBox?.inside === true && chartBox.w > 100 && chartBox.h > 100, JSON.stringify(chartBox));

const verdict = await read('[data-el="calibration-verdict"]');
check('the calibration verdict is stated as a weighted average, not as where dots sit',
  /Weighted across \d+ reviews/.test(verdict), verdict);
check('the verdict admits when buckets disagree with the average',
  /both sides of the diagonal/.test(verdict), verdict.slice(-70));

const leech = await page.evaluate(() => {
  const first = document.querySelector('[data-el="leeches-list"] li');
  return first ? first.textContent.trim() : null;
});
check('the worst leech is listed first with its lapse count',
  leech?.startsWith('50×'), leech?.slice(0, 60) ?? 'none');

const stateLegend = await page.evaluate(() =>
  [...document.querySelectorAll('[data-el="state-legend"] li')].map((li) => li.textContent.trim())
);
check('the state mix accounts for every card',
  stateLegend.reduce((sum, row) => sum + Number(row.match(/(\d+)$/)?.[1] ?? 0), 0) === 40,
  stateLegend.join(' / '));

const strengthRows = await page.evaluate(
  () => document.querySelectorAll('[data-el="strength-table"] tr').length
);
check('memory strength has a row per deck with state', strengthRows >= 1, String(strengthRows));

const activity = await read('[data-el="activity-summary"]');
check('activity summarises the window', /reviews on \d+ of the last 119 days/.test(activity), activity);

const forecastBars = await page.evaluate(
  () => document.querySelectorAll('[data-el="forecast-chart"] .dash__bar').length
);
check('the forecast covers fourteen days', forecastBars === 14, String(forecastBars));

const scale = await read('[data-el="forecast-scale"]');
// Bars are scaled to the busiest day, so a wall of full-height bars means one
// card a day exactly as much as eighty. The scale has to be printed.
check('the forecast prints its scale', /the tallest bar is \d+/.test(scale), scale);

const overdue = await read('[data-el="forecast-overdue"]');
check('overdue cards are counted separately', Number(overdue) === 5, overdue);

const text = await page.evaluate(() => document.body.textContent);
// "points" is excluded from this list: the calibration panel talks about data
// points constantly, and a check that cannot tell those from reward points
// just trains you to ignore it.
check('no gamification anywhere on the dashboard',
  !/\b(streak counter|badge|level up|xp\b|congratulations|well done|daily goal|points earned)\b/i.test(text));

await page.screenshot({ path: `${SHOTS}/dashboard-light.png`, fullPage: true });
await page.evaluate(() => {
  document.documentElement.dataset.theme = 'dark';
});
await page.screenshot({ path: `${SHOTS}/dashboard-dark.png`, fullPage: true });

console.log('\n' + (problems.length ? `PROBLEMS:\n- ${problems.join('\n- ')}` : 'all checks passed'));

await browser.close();
server.close();
process.exit(problems.length ? 1 : 0);
