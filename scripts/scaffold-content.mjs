#!/usr/bin/env node
/**
 * Turns content-map.json into stub pages under src/content/pages/.
 *
 * Existing files are never touched, so this is safe to re-run after adding a
 * page to the map. Pass --check to only report drift (map entries with no
 * file, files with no map entry) without writing anything — that is what CI
 * runs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SLOTS } from '../plugins/rehype-slots.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PAGES_DIR = path.join(ROOT, 'src/content/pages');
const MAP_PATH = path.join(ROOT, 'content-map.json');

const checkOnly = process.argv.includes('--check');

/** Authoring prompts, invisible in the rendered page. */
const PROMPTS = {
  'in-one-sentence': 'The concept, no jargon, no maths. One sentence.',
  'why-it-exists': 'The economic problem the concept solves. What went wrong before it existed?',
  definition: 'The practitioner\'s definition. Bold every term that belongs in the glossary — bold IS the glossary link.',
  formally: 'Maths, KaTeX. Short. The reader does not need it padded.',
  'physics-bridge': 'Use the <PhysicsBridge> component. Name the physics idea; never let it replace the practitioner definition.',
  'in-the-data': 'Use the <Figure> component with the frontmatter figure id. Then two sentences: what to notice, and what would falsify the story.',
  'common-confusions': '2-4 bullets. Things a smart reader will otherwise get wrong.',
  'go-deeper': '2-3 references with page/chapter numbers, plus one paper.',
};

function quote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function frontmatter(page, track, order) {
  const lines = [
    '---',
    `title: ${quote(page.title)}`,
    `track: ${track.number}`,
    `order: ${order}`,
    'status: stub',
    `summary: ${quote(page.summary)}`,
  ];

  lines.push('terms:');
  for (const term of page.terms ?? []) lines.push(`  - ${quote(term)}`);

  if (page.figure) {
    lines.push('figure:');
    for (const [key, value] of Object.entries(page.figure)) {
      lines.push(`  ${key}: ${quote(value)}`);
    }
    // `schematic: true` is reserved for deliberately illustrative diagrams and
    // is set by hand. Placeholder data announces itself through the figure
    // JSON's own `synthetic` flag instead.
  }

  lines.push('---', '');
  return lines.join('\n');
}

function body() {
  // MDX comments are JS expressions, not HTML comments.
  return SLOTS.map((slot) => `## ${slot.label}\n\n{/* ${PROMPTS[slot.id]} */}\n`).join('\n');
}

const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));

const expected = new Set();
let created = 0;

for (const track of map.tracks) {
  const dir = path.join(PAGES_DIR, track.slug);
  if (!checkOnly) fs.mkdirSync(dir, { recursive: true });

  track.pages.forEach((page, i) => {
    const file = path.join(dir, `${page.slug}.mdx`);
    expected.add(path.relative(PAGES_DIR, file));

    if (fs.existsSync(file)) return;
    if (checkOnly) {
      console.log(`missing page: ${path.relative(ROOT, file)}`);
      return;
    }

    fs.writeFileSync(file, frontmatter(page, track, i + 1) + body(), 'utf8');
    created += 1;
  });
}

const onDisk = new Set();
if (fs.existsSync(PAGES_DIR)) {
  for (const dir of fs.readdirSync(PAGES_DIR)) {
    const full = path.join(PAGES_DIR, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const file of fs.readdirSync(full)) {
      if (file.endsWith('.mdx')) onDisk.add(path.join(dir, file));
    }
  }
}

const orphans = [...onDisk].filter((file) => !expected.has(file));
for (const orphan of orphans) {
  console.warn(`page not in content-map.json: ${orphan}`);
}

if (checkOnly) {
  const missing = [...expected].filter((file) => !onDisk.has(file));
  if (missing.length || orphans.length) {
    console.error(`\ncontent map drift: ${missing.length} missing, ${orphans.length} orphaned`);
    process.exit(1);
  }
  console.log(`content map clean: ${expected.size} pages`);
} else {
  console.log(`scaffold: ${created} created, ${expected.size - created} already present`);
}
