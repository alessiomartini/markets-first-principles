import { visit, SKIP } from 'unist-util-visit';
import { getGlossaryIndex, normaliseTerm } from './glossary-index.mjs';

const BASE = (process.env.BASE_PATH ?? '/markets-first-principles').replace(/\/$/, '');

/**
 * Editorial principle #1: every bolded term links to a permanent glossary
 * entry. Rather than trusting the author to write the link every time, bold
 * text *is* the markup for "this is a defined term" — this plugin turns it
 * into a link, and reports the ones that have no entry yet.
 *
 * Terms whose entry is still a stub are left unlinked on purpose: a link to an
 * empty definition is worse than no link. They show up in the build warnings
 * and in `npm run audit:content`.
 */
export function remarkGlossary() {
  return (tree, file) => {
    const { index } = getGlossaryIndex();
    const missing = new Set();
    const unwritten = new Set();

    visit(tree, 'strong', (node, indexInParent, parent) => {
      // Bold inside a heading is styling, not a term definition.
      if (parent?.type === 'heading') return;

      const text = collectText(node);
      if (!text || looksLikeProse(text)) return;

      const entry = index.get(normaliseTerm(text));
      if (!entry) {
        missing.add(text);
        return;
      }
      if (!entry.written) {
        unwritten.add(text);
        return;
      }

      node.children = [
        {
          type: 'link',
          url: `${BASE}/glossary/#${entry.slug}`,
          data: { hProperties: { class: 'term-link', 'data-term': entry.slug } },
          children: node.children,
        },
      ];

      // Don't descend into the link we just created.
      return SKIP;
    });

    const where = file?.history?.[0] ?? file?.path ?? 'unknown file';
    if (missing.size) {
      console.warn(`[glossary] no entry for: ${[...missing].join(', ')}  (${where})`);
    }
    if (unwritten.size) {
      console.warn(`[glossary] entry still a stub, left unlinked: ${[...unwritten].join(', ')}  (${where})`);
    }
  };
}

/**
 * Bold is the markup for "this is a defined term", but it is also the natural
 * way to lead a bullet in COMMON CONFUSIONS. A whole clause is never a glossary
 * term, so anything sentence-shaped is left alone rather than reported as a
 * missing entry.
 */
function looksLikeProse(text) {
  return /[.!?](\s|$)/.test(text) || text.split(/\s+/).length > 6;
}

function collectText(node) {
  let out = '';
  visit(node, (child) => {
    if (child.type === 'text' || child.type === 'inlineCode') out += child.value;
  });
  return out.trim();
}
