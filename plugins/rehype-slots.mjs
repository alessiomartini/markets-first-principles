import { toString } from 'hast-util-to-string';

/**
 * The page template from the build spec, §3. Every content page uses these
 * slots, in this order — that is the whole point of the site's consistency, so
 * it is enforced at build time rather than left to discipline.
 */
export const SLOTS = [
  { id: 'in-one-sentence', label: 'IN ONE SENTENCE' },
  { id: 'why-it-exists', label: 'WHY IT EXISTS' },
  { id: 'definition', label: 'DEFINITION' },
  { id: 'formally', label: 'FORMALLY' },
  { id: 'physics-bridge', label: 'PHYSICS BRIDGE' },
  { id: 'in-the-data', label: 'IN THE DATA' },
  { id: 'common-confusions', label: 'COMMON CONFUSIONS' },
  { id: 'go-deeper', label: 'GO DEEPER' },
];

const BY_LABEL = new Map(SLOTS.map((slot) => [slot.label, slot]));

/**
 * Splits a page body at its `## SLOT NAME` headings and wraps each run of
 * content in a `<section>` the stylesheet can target.
 *
 * Pages marked `status: written` must carry all eight slots in the canonical
 * order; anything else fails the build. Stubs are exempt — they exist precisely
 * to be incomplete — but still get their slots wrapped so a half-finished page
 * looks like the finished ones.
 */
export function rehypeSlots() {
  return (tree, file) => {
    const frontmatter = file?.data?.astro?.frontmatter ?? {};
    const where = frontmatter.title ?? file?.history?.[0] ?? 'unknown page';

    // Only concept pages carry the eight-slot template. Glossary entries and
    // any other plain prose opt out — identified by the absence of a reading
    // `order`, which only pages in the content map have.
    const isConceptPage = frontmatter.template !== 'plain' && frontmatter.order !== undefined;
    if (!isConceptPage) return;

    const sections = [];
    let current = null;
    const preamble = [];

    for (const node of tree.children) {
      const isSlotHeading = node.type === 'element' && node.tagName === 'h2';
      if (isSlotHeading) {
        const label = toString(node).trim().toUpperCase();
        const slot = BY_LABEL.get(label);
        if (slot) {
          current = { slot, heading: node, children: [] };
          sections.push(current);
          continue;
        }
      }

      if (current) current.children.push(node);
      else preamble.push(node);
    }

    validate(sections, frontmatter, where);

    tree.children = [
      ...preamble,
      ...sections.map(({ slot, children }) => ({
        type: 'element',
        tagName: 'section',
        properties: {
          className: ['slot', `slot--${slot.id}`],
          id: slot.id,
          'data-slot': slot.id,
        },
        children: [
          {
            type: 'element',
            tagName: 'h2',
            properties: { className: ['slot__label'] },
            children: [{ type: 'text', value: slot.label }],
          },
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['slot__body'] },
            children,
          },
        ],
      })),
    ];
  };
}

function validate(sections, frontmatter, where) {
  const found = sections.map((section) => section.slot.id);

  const duplicates = found.filter((id, i) => found.indexOf(id) !== i);
  if (duplicates.length) {
    throw new Error(`[slots] ${where}: slot repeated — ${[...new Set(duplicates)].join(', ')}`);
  }

  if (frontmatter.status !== 'written') {
    if (found.length === 0) {
      console.warn(`[slots] ${where}: stub has no slots yet`);
    }
    return;
  }

  const missing = SLOTS.filter((slot) => !found.includes(slot.id)).map((slot) => slot.label);
  if (missing.length) {
    throw new Error(
      `[slots] ${where} is marked status: written but is missing — ${missing.join(', ')}. ` +
        `Either write the slot or set status: stub.`
    );
  }

  const canonical = SLOTS.map((slot) => slot.id);
  const ordered = canonical.filter((id) => found.includes(id));
  if (found.join('>') !== ordered.join('>')) {
    throw new Error(
      `[slots] ${where}: slots are out of order.\n  found:    ${found.join(' > ')}\n  expected: ${ordered.join(' > ')}`
    );
  }
}
