import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import { remarkGlossary } from './plugins/remark-glossary.mjs';
import { rehypeSlots } from './plugins/rehype-slots.mjs';

// The site is published on GitHub Pages under a project path, so every
// internal link has to go through `base`. Both values are overridable from
// the environment so a fork can deploy somewhere else without editing code.
const site = process.env.SITE_URL ?? 'https://alessiomartini.github.io';
const base = process.env.BASE_PATH ?? '/markets-first-principles';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  build: { format: 'directory' },
  // Concept pages are MDX so the template's figure and bridge slots can hold
  // real components; the glossary stays plain Markdown. MDX inherits the
  // `markdown` pipeline below by default.
  integrations: [mdx()],
  markdown: {
    // remarkGlossary runs before remarkMath so that bolded terms inside a
    // formula are never rewritten into links.
    remarkPlugins: [remarkGlossary, remarkMath],
    rehypePlugins: [
      [rehypeKatex, { output: 'html', throwOnError: false, strict: false }],
      rehypeSlots,
    ],
    shikiConfig: { theme: 'github-dark-dimmed', wrap: true },
  },
});
