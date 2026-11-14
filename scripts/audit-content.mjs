#!/usr/bin/env node
/**
 * Editorial backlog in one command.
 *
 * Reports what is written, which declared terms have no glossary entry, and
 * which figures have no data. Read-only and never fails the build — its job is
 * to tell the author what to do next, not to block them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getGlossaryIndex, normaliseTerm } from '../plugins/glossary-index.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PAGES_DIR = path.join(ROOT, 'src/content/pages');
const FIGURES_DIR = path.join(ROOT, 'src/data/figures');

const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-map.json'), 'utf8'));
const { index, entries } = getGlossaryIndex();

function statusOf(file) {
  const source = fs.readFileSync(file, 'utf8');
  return /^status:\s*written\s*$/m.test(source) ? 'written' : 'stub';
}

const pages = [];
for (const track of map.tracks) {
  for (const page of track.pages) {
    const file = path.join(PAGES_DIR, track.slug, `${page.slug}.mdx`);
    pages.push({
      track,
      page,
      file,
      exists: fs.existsSync(file),
      status: fs.existsSync(file) ? statusOf(file) : 'missing',
    });
  }
}

const written = pages.filter((entry) => entry.status === 'written');

console.log(`\nPAGES  ${written.length}/${pages.length} written`);
for (const track of map.tracks) {
  const mine = pages.filter((entry) => entry.track.number === track.number);
  const done = mine.filter((entry) => entry.status === 'written').length;
  const bar = '█'.repeat(done) + '·'.repeat(mine.length - done);
  console.log(`  ${String(track.number).padStart(2)}  ${bar}  ${done}/${mine.length}  ${track.title}`);
}

// Terms a page has promised to define, with no glossary entry behind them.
const missing = new Map();
for (const entry of pages) {
  for (const term of entry.page.terms ?? []) {
    const found = index.get(normaliseTerm(term));
    if (found?.written) continue;
    const key = found ? `${term} (stub)` : term;
    if (!missing.has(key)) missing.set(key, []);
    missing.get(key).push(`${entry.track.number}/${entry.page.slug}`);
  }
}

const declared = pages.flatMap((entry) => entry.page.terms ?? []).length;
console.log(`\nGLOSSARY  ${entries.filter((e) => e.written).length} entries written, ${declared} terms declared`);
if (missing.size === 0) {
  console.log('  every declared term has a written entry');
} else {
  console.log(`  ${missing.size} declared terms still need one:`);
  for (const [term, where] of [...missing].sort()) {
    console.log(`    ${term.padEnd(38)} ${where.join(', ')}`);
  }
}

// Figures whose JSON is absent or still synthetic. A page has one main figure
// (content-map.json) plus any number of extraFigures declared in its frontmatter.
function extraFigureIds(file) {
  if (!fs.existsSync(file)) return [];
  const match = fs.readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return [];
  const block = match[1].match(/^extraFigures:\s*\r?\n((?:[ \t]+.*\r?\n?|\r?\n)*)/m);
  if (!block) return [];
  return [...block[1].matchAll(/^[ \t]+-\s+id:\s*["']?([^"'\r\n]+?)["']?\s*$/gm)].map((m) => m[1]);
}

const figureIds = new Set();
for (const entry of pages) {
  if (entry.page.figure) figureIds.add(entry.page.figure.id);
  for (const id of extraFigureIds(entry.file)) figureIds.add(id);
}
const states = { real: [], synthetic: [], absent: [] };

for (const id of figureIds) {
  const file = path.join(FIGURES_DIR, `${id}.json`);
  if (!fs.existsSync(file)) {
    states.absent.push(id);
    continue;
  }
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  (payload.synthetic ? states.synthetic : states.real).push(id);
}

console.log(`\nFIGURES  ${figureIds.size} specified`);
console.log(`  real       ${states.real.length}${states.real.length ? `  ${states.real.join(', ')}` : ''}`);
console.log(`  synthetic  ${states.synthetic.length}${states.synthetic.length ? `  ${states.synthetic.join(', ')}` : ''}`);
console.log(`  no data    ${states.absent.length}`);
console.log('');
