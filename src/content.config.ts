import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Caption contract for every figure on the site, from editorial principle #3:
 * source, series identifier, sample period and a link to the script that
 * produced it are all required. A chart that cannot name its provenance
 * cannot be published — the schema is what makes that true rather than
 * aspirational.
 */
const figure = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  series: z.string(),
  period: z.string(),
  script: z.string(),
  /** Set only for deliberately illustrative diagrams, per principle #3. */
  schematic: z.boolean().default(false),
  /** Two sentences: what to notice, and what would falsify the story. */
  notice: z.string().optional(),
  falsifiedBy: z.string().optional(),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    track: z.number().int().min(0).max(7),
    order: z.number().int(),
    status: z.enum(['stub', 'written']).default('stub'),
    /** One line, shown on the homepage and track listings. */
    summary: z.string(),
    /** The core terms this page is responsible for defining. */
    terms: z.array(z.string()).default([]),
    figure: figure.optional(),
  }),
});

const glossary = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/glossary' }),
  schema: z.object({
    term: z.string(),
    aliases: z.array(z.string()).default([]),
    /** Track that owns the definition; used for the glossary filter. */
    track: z.number().int().min(0).max(7),
    status: z.enum(['stub', 'written']).default('stub'),
    /** The physics analogue, where an honest one exists. */
    physics: z.string().optional(),
    template: z.literal('plain').default('plain'),
  }),
});

/**
 * Flashcard decks.
 *
 * Content is versioned in git and authored by hand; progress lives only in D1
 * and never in this repo. The two are joined by `id`, which is permanent — the
 * entire review history is keyed on it, so renaming a card silently orphans
 * everything ever recorded about it. `scripts/validate-cards.mjs` enforces that.
 */
const flashcardSource = z.object({
  label: z.string(),
  url: z.string().url(),
  kind: z.enum(['primary', 'wikipedia', 'glossary']),
});

const flashcards = defineCollection({
  // tombstones.json lives alongside the decks but is a retirement ledger, not
  // a deck, and has a different shape.
  loader: glob({ pattern: ['**/*.json', '!tombstones.json'], base: './src/content/flashcards' }),
  schema: z.object({
    deck: z.string(),
    /** Matches an OpenQuant top-level section. */
    topic: z.string(),
    cards: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ids are lowercase kebab-case'),
          type: z.enum(['basic', 'cloze', 'formula', 'why']),
          front: z.string().min(1),
          back: z.string().min(1),
          /** Shown only on demand. Never auto-revealed. */
          hint: z.string().optional(),
          /**
           * The exact string the answer must match for `formula` cards, which
           * are typed rather than self-graded. Absent means self-graded.
           */
          answer: z.string().optional(),
          sources: z.array(flashcardSource).min(1),
          tags: z.array(z.string()).default([]),
        })
      )
      .min(1),
  }),
});

export const collections = { pages, glossary, flashcards };
