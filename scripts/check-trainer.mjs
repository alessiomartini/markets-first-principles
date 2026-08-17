/**
 * Drive the built trainer in a real browser.
 *
 * A green `astro build` says the page compiled. It does not say a session
 * works, and on this page it twice said nothing useful: the rating buttons
 * were visible before the reveal (`hidden` loses to `display: grid`), and the
 * sync indicator read "synced" with four reviews sitting unsent in IndexedDB.
 * Both passed every DOM-attribute assertion. Only measuring the rendered page
 * caught them.
 *
 *   npm run build && node scripts/check-trainer.mjs [screenshot-dir]
 *
 * Playwright is not a project dependency — it is a tool for this script, not
 * something the site needs — so install it globally or run through npx.
 */
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

// ESM resolution ignores NODE_PATH, so a globally installed playwright is not
// importable by name from a project that does not depend on it. Try the name
// first, then an explicit path.
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
const SHOTS = process.argv[2] ?? join(tmpdir(), 'trainer-shots');
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

await new Promise((r) => server.listen(4399, r));

// PLAYWRIGHT_CHROMIUM lets a sandbox point at a browser playwright did not
// download itself.
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}
);
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });

const problems = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
});
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

const check = (label, condition, detail = '') => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) problems.push(label);
};

await page.goto(`http://localhost:4399${BASE}/flashcards/`, { waitUntil: 'networkidle' });

// --- start screen -----------------------------------------------------------
await page.waitForFunction(() => document.querySelector('[data-el="count-new"]')?.textContent !== '0');

const startCounts = await page.evaluate(() => ({
  due: document.querySelector('[data-el="count-due"]').textContent,
  unseen: document.querySelector('[data-el="count-new"]').textContent,
  later: document.querySelector('[data-el="count-later"]').textContent,
  status: document.querySelector('[data-el="sync-status"]').textContent,
  decks: [...document.querySelectorAll('[data-el="deck"] option')].map((o) => o.value),
}));
check('start screen counts 40 unseen cards', startCounts.unseen === '40', JSON.stringify(startCounts));
check('deck filter offers every deck', startCounts.decks.length === 6, startCounts.decks.join('|'));
check('sync status admits there is no server configured', /no server set/.test(startCounts.status), startCounts.status);
await page.screenshot({ path: `${SHOTS}/trainer-start.png` });

// --- run a session ----------------------------------------------------------
await page.fill('[data-el="new-limit"]', '4');
await page.click('[data-el="start-button"]');
await page.waitForSelector('[data-screen="review"]:not([hidden])');

// Visibility measured, not asserted from the attribute. `hidden` loses to any
// `display: flex/grid` rule, so an element can be hidden in the DOM and still
// be on screen — which is exactly what happened to the rating buttons.
const onScreen = (selector) =>
  page.evaluate((s) => {
    const node = document.querySelector(s);
    if (!node) return null;
    const box = node.getBoundingClientRect();
    return getComputedStyle(node).display !== 'none' && box.width > 0 && box.height > 0;
  }, selector);

const firstFront = await page.evaluate(() => ({
  html: document.querySelector('[data-el="front"]').innerHTML,
  katex: document.querySelectorAll('[data-el="front"] .katex').length,
  progress: document.querySelector('[data-el="progress"]').textContent,
  type: document.querySelector('[data-el="card-type"]').textContent,
  answerFormVisible: !document.querySelector('[data-el="answer-form"]').hidden,
}));
check('progress shows 1 / 4', firstFront.progress.trim() === '1 / 4', firstFront.progress);
check('the card is above the fold once the session starts',
  await page.evaluate(() => {
    const box = document.querySelector('.card').getBoundingClientRect();
    return box.top >= 0 && box.top < window.innerHeight / 2;
  }));
check('rating buttons are really off screen before the reveal',
  (await onScreen('[data-el="ratings"]')) === false);
check('the answer is really off screen before the reveal',
  (await onScreen('[data-el="back"]')) === false);
check('a typed-answer card shows the input, a self-graded one does not',
  (await onScreen('[data-el="answer-form"]')) === firstFront.answerFormVisible,
  `type=${firstFront.type}`);
check('no math-render errors on the first card',
  !firstFront.html.includes('card-math--error'), firstFront.html.slice(0, 120));
await page.screenshot({ path: `${SHOTS}/trainer-front.png` });

// Reveal by keyboard, unless the card wants a typed answer.
if (firstFront.answerFormVisible) {
  await page.fill('[data-el="answer-input"]', 'deliberately wrong');
  await page.press('[data-el="answer-input"]', 'Enter');
} else {
  await page.keyboard.press('Space');
}
await page.waitForSelector('[data-el="ratings"]:not([hidden])');

const revealed = await page.evaluate(() => ({
  backVisible: !document.querySelector('[data-el="back"]').hidden,
  intervals: [...document.querySelectorAll('[data-el="ratings"] em')].map((e) => e.textContent),
  sources: document.querySelectorAll('[data-el="sources"] a').length,
  katexBack: document.querySelectorAll('[data-el="back"] .katex').length,
  focused: document.activeElement?.dataset?.rating ?? null,
  errors: document.querySelectorAll('.card-math--error').length,
}));
check('back is shown after reveal', revealed.backVisible);
check('rating buttons are really on screen after the reveal',
  (await onScreen('[data-el="ratings"]')) === true);
check('the typed-answer input is really gone after the reveal',
  (await onScreen('[data-el="answer-form"]')) === false);
check('all four buttons carry an interval', revealed.intervals.every((t) => t.trim().length > 0),
  revealed.intervals.join(' | '));
check('intervals are distinct across ratings', new Set(revealed.intervals).size > 1,
  revealed.intervals.join(' | '));
check('sources are linked on the answer', revealed.sources >= 1, String(revealed.sources));
check('a rating button takes focus for the keyboard', revealed.focused !== null, String(revealed.focused));
check('no KaTeX failures anywhere on the revealed card', revealed.errors === 0, String(revealed.errors));
await page.screenshot({ path: `${SHOTS}/trainer-revealed.png` });

// Rate all four cards by keyboard, exercising every rating once.
for (const key of ['Digit1', 'Digit3', 'Digit2', 'Digit4']) {
  await page.waitForSelector('[data-el="ratings"]:not([hidden])', { timeout: 5000 }).catch(() => {});
  const needsReveal = await page.evaluate(() => document.querySelector('[data-el="ratings"]').hidden);
  if (needsReveal) {
    const typed = await page.evaluate(() => !document.querySelector('[data-el="answer-form"]').hidden);
    if (typed) {
      await page.fill('[data-el="answer-input"]', 'x');
      await page.press('[data-el="answer-input"]', 'Enter');
    } else {
      await page.keyboard.press('Space');
    }
    await page.waitForSelector('[data-el="ratings"]:not([hidden])');
  }
  await page.keyboard.press(key);
  await page.waitForTimeout(120);
}

await page.waitForSelector('[data-screen="summary"]:not([hidden])', { timeout: 5000 });
const summary = await page.evaluate(() => ({
  reviewed: document.querySelector('[data-el="summary-reviewed"]').textContent,
  spread: [...document.querySelectorAll('[data-el="summary-spread"] li')].map((li) => li.textContent.trim()),
  againShown: !document.querySelector('[data-el="summary-again-wrap"]').hidden,
  againCount: document.querySelectorAll('[data-el="summary-again"] li').length,
  status: document.querySelector('[data-el="sync-status"]').textContent,
  // Only the trainer's own chrome: the page header contains the sentence
  // "there is no score and no streak", which is the opposite of gamification
  // and must not be what the check trips on.
  text: [...document.querySelectorAll('[data-screen]')].map((s) => s.textContent).join(' '),
}));
check('summary reports 4 reviews', summary.reviewed === '4', summary.reviewed);
check('rating spread is reported', summary.spread.length === 4, summary.spread.join(' / '));
check('the Again list names the card', summary.againShown && summary.againCount === 1,
  `${summary.againShown} ${summary.againCount}`);
check('4 reviews are queued locally', /4 stored locally|4 waiting/.test(summary.status), summary.status);
check('no gamification words anywhere',
  !/\b(streak|points|score|congratulations|well done|badge|level up|xp)\b/i.test(summary.text));
await page.screenshot({ path: `${SHOTS}/trainer-summary.png` });

// --- durability across a reload --------------------------------------------
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('[data-el="count-later"]')?.textContent !== '0'
  || document.querySelector('[data-el="count-due"]')?.textContent !== '0');
const afterReload = await page.evaluate(() => ({
  due: document.querySelector('[data-el="count-due"]').textContent,
  unseen: document.querySelector('[data-el="count-new"]').textContent,
  later: document.querySelector('[data-el="count-later"]').textContent,
  status: document.querySelector('[data-el="sync-status"]').textContent,
}));
check('reviewed cards survived the reload',
  Number(afterReload.unseen) === 36, JSON.stringify(afterReload));
check('the unsynced queue survived the reload',
  /4 stored locally|4 waiting/.test(afterReload.status), afterReload.status);

// --- data export ------------------------------------------------------------
// The "your data is yours" promise has to actually produce a file.
//
// Toggle only if it is closed: after a reload with no server configured the
// panel opens itself, and a blind click would shut it.
const openSettings = async () => {
  if ((await onScreen('[data-el="settings-panel"]')) !== true) {
    await page.click('[data-el="settings-toggle"]');
    await page.waitForSelector('[data-el="settings-panel"]:not([hidden])');
  }
};
await openSettings();
const downloaded = await Promise.all([
  page.waitForEvent('download', { timeout: 5000 }),
  page.click('[data-el="export-button"]'),
]).then(([download]) => download.suggestedFilename()).catch(() => null);
check('the local export downloads a dated file',
  /^flashcards-local-\d{4}-\d{2}-\d{2}\.json$/.test(downloaded ?? ''), downloaded ?? 'no download');

await page.click('[data-el="export-server-button"]');
await page.waitForFunction(
  () => document.querySelector('[data-el="export-status"]')?.textContent.trim().length > 0
);
const exportStatus = await page.textContent('[data-el="export-status"]');
check('the server export says why it cannot run rather than failing silently',
  /No server configured/.test(exportStatus), exportStatus.trim());

// --- dark theme -------------------------------------------------------------
await page.evaluate(() => {
  document.documentElement.dataset.theme = 'dark';
});
await page.click('[data-el="start-button"]');
await page.waitForSelector('[data-screen="review"]:not([hidden])');
await page.keyboard.press('Space');
await page.waitForSelector('[data-el="ratings"]:not([hidden])');
await page.screenshot({ path: `${SHOTS}/trainer-dark.png` });

console.log('\n' + (problems.length ? `PROBLEMS:\n- ${problems.join('\n- ')}` : 'all checks passed'));

await browser.close();
server.close();
process.exit(problems.length ? 1 : 0);
