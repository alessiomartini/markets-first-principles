/**
 * Grading for typed answers on `formula` cards.
 *
 * Self-grading — "did I get that right? yes" — is the weak point of every
 * flashcard system: recognition feels like recall and the rating drifts upward.
 * For formulas there is a typeable answer, so the card can check it. That is
 * the whole reason the `formula` type exists, and why the card validator
 * refuses a `formula` card without an `answer` field.
 *
 * The comparison has to be forgiving of formatting and strict about content.
 * `x^{2}` and `x^2` are the same answer; `x^2` and `x^3` are not. Everything
 * normalised away below is presentation. Nothing that changes meaning is.
 */

/** Spacing macros: pure presentation. */
const SPACING = /\\[,;:!>]|\\quad|\\qquad|\\thinspace|\\!/g;

/** Sizing macros: presentation. `\left(` and `(` mean the same thing. */
const SIZING = /\\left|\\right|\\big[lrm]?|\\Big[lrm]?|\\bigg[lrm]?|\\Bigg[lrm]?/g;

/** Synonyms that render identically or differ only in style. */
const SYNONYMS = [
  [/\\dfrac|\\tfrac/g, '\\frac'],
  [/\\dbinom|\\tbinom/g, '\\binom'],
  [/\\cdot|\\times/g, '*'],
  [/\\mathrm\{([^{}]*)\}|\\text\{([^{}]*)\}|\\operatorname\{([^{}]*)\}/g, (...m) => m[1] ?? m[2] ?? m[3]],
  [/\\mathbb\{E\}|\\mathbf\{E\}|\\operatorname\{E\}/g, 'E'],
  [/\\mathbb\{P\}|\\mathbf\{P\}/g, 'P'],
  [/\\mathrm\{d\}|\\mathrm d/g, 'd'],
  [/\\varphi/g, '\\phi'],
  [/\\vert|\\mid/g, '|'],
  [/\\le\b/g, '\\leq'],
  [/\\ge\b/g, '\\geq'],
  [/\\neq|\\ne\b/g, '\\neq'],
];

/**
 * Strip braces that group a single token, so `x^{2}` and `x^2` agree.
 * Repeated because `e^{{x}}` exists in the wild.
 */
function unwrapSingleTokenBraces(text) {
  let previous;
  let current = text;
  do {
    previous = current;
    current = current.replace(/([\^_])\{([A-Za-z0-9]|\\[A-Za-z]+)\}/g, '$1$2');
  } while (current !== previous);
  return current;
}

export function normaliseLatex(input) {
  let text = String(input ?? '').trim();

  // Card answers are stored bare; a typed `$…$` wrapper is the user writing
  // what they see rather than a different answer.
  text = text.replace(/^\$\$?([\s\S]*?)\$\$?$/, '$1');

  text = text.replace(SPACING, '');
  text = text.replace(SIZING, '');
  for (const [pattern, replacement] of SYNONYMS) text = text.replace(pattern, replacement);
  text = unwrapSingleTokenBraces(text);

  // Whitespace in LaTeX is not significant except between a macro and a letter,
  // and the macros have all been consumed by now.
  text = text.replace(/\s+/g, '');

  return text;
}

/**
 * @returns {{correct: boolean, normalised: string, expected: string, near: boolean}}
 *   `near` marks an answer that differs only in case — worth telling the user
 *   about, because in this notation case is meaning ($N$ and $n$ are different
 *   quantities) and a near miss should be graded wrong but explained.
 */
export function gradeTyped(typed, expected) {
  const a = normaliseLatex(typed);
  const b = normaliseLatex(expected);
  if (!a) return { correct: false, normalised: a, expected: b, near: false };

  const correct = a === b;
  return {
    correct,
    normalised: a,
    expected: b,
    near: !correct && a.toLowerCase() === b.toLowerCase(),
  };
}
