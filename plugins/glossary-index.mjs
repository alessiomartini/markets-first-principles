import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GLOSSARY_DIR = fileURLToPath(new URL('../src/content/glossary/', import.meta.url));

/**
 * Minimal frontmatter reader.
 *
 * The glossary files are authored in this repo and only ever use scalars and
 * flow sequences, so a full YAML parser would be dead weight here. Anything
 * more exotic than `key: value` / `key: [a, b]` is deliberately not supported —
 * if a glossary entry ever needs it, reach for a real parser instead of
 * extending this.
 */
function readFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!match) return {};

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;

    const key = kv[1];
    let raw = kv[2].trim();
    if (raw === '') continue;

    if (raw.startsWith('[') && raw.endsWith(']')) {
      data[key] = raw
        .slice(1, -1)
        .split(',')
        .map((item) => unquote(item.trim()))
        .filter(Boolean);
    } else {
      data[key] = unquote(raw);
    }
  }
  return data;
}

function unquote(value) {
  if (value.length >= 2 && /^(["']).*\1$/.test(value)) return value.slice(1, -1);
  return value;
}

/**
 * Normalise a term for lookup: case, surrounding punctuation, curly quotes and
 * internal whitespace are all ignored, so "**Order book**," and "order  book"
 * hit the same entry.
 */
export function normaliseTerm(text) {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/^[^\w(]+|[^\w)]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugifyTerm(text) {
  return normaliseTerm(text)
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

let cached = null;

/**
 * Build a lookup from every spelling of a term (its own name plus any aliases)
 * to the entry it belongs to. Entries still marked `status: stub` are indexed
 * but flagged, so the auto-linker can skip them rather than sending readers to
 * an empty definition.
 */
export function getGlossaryIndex({ force = false } = {}) {
  if (cached && !force) return cached;

  const index = new Map();
  const entries = [];

  if (fs.existsSync(GLOSSARY_DIR)) {
    for (const file of fs.readdirSync(GLOSSARY_DIR).sort()) {
      if (!file.endsWith('.md')) continue;

      const source = fs.readFileSync(path.join(GLOSSARY_DIR, file), 'utf8');
      const fm = readFrontmatter(source);
      if (!fm.term) continue;

      const entry = {
        id: file.replace(/\.md$/, ''),
        term: fm.term,
        slug: slugifyTerm(fm.term),
        aliases: fm.aliases ?? [],
        track: fm.track ?? null,
        written: fm.status !== 'stub',
      };
      entries.push(entry);

      for (const spelling of [entry.term, ...entry.aliases]) {
        const key = normaliseTerm(spelling);
        if (key) index.set(key, entry);
      }
    }
  }

  cached = { index, entries };
  return cached;
}
