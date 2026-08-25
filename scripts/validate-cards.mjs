#!/usr/bin/env node
/**
 * Validates the flashcard decks. Exits non-zero on any failure, so CI can gate
 * on it.
 *
 * Checks: unique ids across every deck, required fields present and non-empty,
 * source URLs well-formed and non-empty, LaTeX delimiters balanced, and — the
 * one that matters most — that no card id which appears in the review log has
 * vanished from the content without a tombstone.
 *
 * That last check is the point of the whole script. Review history is keyed on
 * card id and is irreplaceable; renaming a card silently orphans everything
 * ever recorded about it. Better to fail the build than to lose the log.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DECKS = path.join(ROOT, 'src/content/flashcards');
const TOMBSTONES = path.join(DECKS, 'tombstones.json');

const TYPES = new Set(['basic', 'cloze', 'formula', 'why']);
const KINDS = new Set(['primary', 'wikipedia', 'glossary']);
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const problems = [];
const warnings = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);

/**
 * LaTeX is checked structurally rather than parsed: KaTeX is not run here, so
 * the useful check is that delimiters pair up and braces balance, which is what
 * actually breaks rendering in practice.
 */
function checkLatex(where, field, text) {
  const display = (text.match(/\$\$/g) ?? []).length;
  if (display % 2 !== 0) fail(where, `${field}: unbalanced $$ display math`);

  const withoutDisplay = text.replace(/\$\$[\s\S]*?\$\$/g, '');
  const inline = (withoutDisplay.match(/(?<!\\)\$/g) ?? []).length;
  if (inline % 2 !== 0) fail(where, `${field}: unbalanced $ inline math`);

  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\\') { i += 1; continue; }
    if (text[i] === '{') depth += 1;
    if (text[i] === '}') depth -= 1;
    if (depth < 0) break;
  }
  if (depth !== 0) fail(where, `${field}: unbalanced braces in LaTeX`);
}

function checkUrl(where, url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      fail(where, `source url is not http(s): ${url}`);
    }
  } catch {
    fail(where, `source url is not a valid URL: ${url}`);
  }
}

// ---------------------------------------------------------------- load decks

if (!fs.existsSync(DECKS)) {
  console.error(`no deck directory at ${path.relative(ROOT, DECKS)}`);
  process.exit(1);
}

const files = fs.readdirSync(DECKS).filter((f) => f.endsWith('.json') && f !== 'tombstones.json');
const seen = new Map();
let cardCount = 0;

for (const file of files.sort()) {
  const where0 = path.join('src/content/flashcards', file);
  let deck;
  try {
    deck = JSON.parse(fs.readFileSync(path.join(DECKS, file), 'utf8'));
  } catch (error) {
    fail(where0, `not parseable JSON — ${error.message}`);
    continue;
  }

  for (const field of ['deck', 'topic', 'cards']) {
    if (!deck[field]) fail(where0, `missing "${field}"`);
  }
  if (!Array.isArray(deck.cards) || deck.cards.length === 0) {
    fail(where0, 'cards must be a non-empty array');
    continue;
  }
  if (deck.deck && `${deck.deck}.json` !== file) {
    fail(where0, `deck name "${deck.deck}" does not match the filename`);
  }

  for (const card of deck.cards) {
    cardCount += 1;
    const where = `${where0} [${card.id ?? '(no id)'}]`;

    if (!card.id) fail(where, 'missing id');
    else if (!ID.test(card.id)) fail(where, 'id must be lowercase kebab-case');
    else if (seen.has(card.id)) fail(where, `duplicate id, also in ${seen.get(card.id)}`);
    else seen.set(card.id, file);

    if (!TYPES.has(card.type)) fail(where, `type must be one of ${[...TYPES].join(', ')}`);

    for (const field of ['front', 'back']) {
      if (typeof card[field] !== 'string' || card[field].trim() === '') {
        fail(where, `${field} is required and must be non-empty`);
      } else {
        checkLatex(where, field, card[field]);
      }
    }

    if (card.hint !== undefined && typeof card.hint !== 'string') fail(where, 'hint must be a string');
    if (card.hint) checkLatex(where, 'hint', card.hint);

    // Typed answers are what make `formula` cards gradable rather than
    // self-assessed, and self-grading is the weakest link in any SRS. So the
    // type carries an obligation: if an answer cannot be stated as one
    // unambiguous string, the card is not a `formula` card and should be
    // `basic` or `why` instead.
    if (card.type === 'formula' && !card.answer) {
      fail(where, 'formula cards must carry an "answer" to type; use type "basic" if the answer is not a single unambiguous string');
    }
    if (card.answer && card.type !== 'formula') {
      fail(where, 'only formula cards take a typed "answer"');
    }

    if (!Array.isArray(card.sources) || card.sources.length === 0) {
      fail(where, 'at least one source is required');
    } else {
      for (const source of card.sources) {
        if (!source.label) fail(where, 'source is missing a label');
        if (!KINDS.has(source.kind)) fail(where, `source kind must be one of ${[...KINDS].join(', ')}`);
        if (!source.url) fail(where, 'source is missing a url');
        else checkUrl(where, source.url);
      }
    }

    if (card.tags !== undefined && !Array.isArray(card.tags)) fail(where, 'tags must be an array');
  }
}

// ------------------------------------------------- orphaned history check

/**
 * Ids that once existed and were deliberately retired. Retiring a card is
 * allowed; doing it silently is not, because the review history keyed on that
 * id becomes unreachable without anyone noticing.
 */
const tombstones = fs.existsSync(TOMBSTONES)
  ? JSON.parse(fs.readFileSync(TOMBSTONES, 'utf8')).retired ?? []
  : [];
const retired = new Set(tombstones.map((entry) => entry.id));

for (const entry of tombstones) {
  if (!entry.id || !entry.retired_on || !entry.reason) {
    fail('tombstones.json', `entry needs id, retired_on and reason: ${JSON.stringify(entry)}`);
  }
  if (seen.has(entry.id)) {
    fail('tombstones.json', `"${entry.id}" is tombstoned but still present in a deck`);
  }
}

/**
 * The live check needs the ids that appear in the review log. CI has no
 * database access, so the log is supplied as a file when available — written by
 * `npm run flashcards:pull-ids` — and the check is skipped, loudly, when it is
 * not.
 */
const LOG_IDS = path.join(ROOT, '.card-ids-in-log.json');
if (fs.existsSync(LOG_IDS)) {
  const inLog = JSON.parse(fs.readFileSync(LOG_IDS, 'utf8'));
  const orphaned = inLog.filter((id) => !seen.has(id) && !retired.has(id));
  if (orphaned.length) {
    fail(
      'review log',
      `these ids have review history but no card and no tombstone:\n    ${orphaned.join('\n    ')}`
    );
  }
} else {
  warnings.push(
    'no .card-ids-in-log.json present, so the orphaned-history check was skipped. ' +
      'Run `npm run flashcards:pull-ids` against the API to enable it.'
  );
}

// ------------------------------------------------------------------- report

console.log(`${cardCount} cards across ${files.length} decks`);

for (const warning of warnings) console.warn(`  warn  ${warning}`);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log('all checks passed');
