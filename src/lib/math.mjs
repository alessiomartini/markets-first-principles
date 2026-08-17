/**
 * Runtime maths for the flashcard trainer.
 *
 * The rest of the site renders KaTeX at build time through rehype-katex, which
 * is right for prose: the reader gets HTML with no JavaScript involved. Cards
 * are different — they are data, drawn into the DOM by the trainer as the
 * session goes — so KaTeX has to run in the browser here.
 *
 * The splitter is separated from the rendering so it can be tested without a
 * DOM. Getting `$` handling wrong is easy and the failure is silent: a dollar
 * sign in prose swallows the rest of a card into "maths" that then fails to
 * parse.
 */

/**
 * Split text into literal and mathematical runs.
 *
 * `$$…$$` is display, `$…$` is inline, `\$` is a literal dollar sign. An
 * unclosed delimiter is treated as literal text rather than consuming
 * everything to the end — a typo in a card should look wrong, not eat the card.
 *
 * @returns {{type: 'text'|'inline'|'display', value: string}[]}
 */
export function splitMath(source) {
  const parts = [];
  let buffer = '';
  let index = 0;

  const flush = () => {
    if (buffer) parts.push({ type: 'text', value: buffer });
    buffer = '';
  };

  while (index < source.length) {
    const char = source[index];

    if (char === '\\' && source[index + 1] === '$') {
      buffer += '$';
      index += 2;
      continue;
    }

    if (char === '$') {
      const display = source[index + 1] === '$';
      const delimiter = display ? '$$' : '$';
      const start = index + delimiter.length;
      const end = findClosing(source, start, delimiter);

      if (end === -1) {
        // Unclosed: literal, so the damage stays local.
        buffer += char;
        index += 1;
        continue;
      }

      flush();
      parts.push({ type: display ? 'display' : 'inline', value: source.slice(start, end) });
      index = end + delimiter.length;
      continue;
    }

    buffer += char;
    index += 1;
  }

  flush();
  return parts;
}

function findClosing(source, from, delimiter) {
  for (let i = from; i < source.length; i += 1) {
    if (source[i] === '\\') {
      i += 1;
      continue;
    }
    if (source.startsWith(delimiter, i)) {
      // `$` must not match the first half of a `$$`.
      if (delimiter === '$' && source[i + 1] === '$') continue;
      return i;
    }
  }
  return -1;
}

/**
 * Render text containing `$…$` into an element.
 *
 * Text runs go in as text nodes, never as HTML: card content is authored by
 * hand in this repo, but building a habit of assigning innerHTML from data is
 * how the one card that eventually comes from somewhere else becomes an
 * injection.
 *
 * @param {Element} element
 * @param {string} source
 * @param {{renderToString: Function}} katex
 */
export function renderMath(element, source, katex) {
  element.replaceChildren();

  for (const part of splitMath(source ?? '')) {
    if (part.type === 'text') {
      element.append(document.createTextNode(part.value));
      continue;
    }

    const span = document.createElement(part.type === 'display' ? 'div' : 'span');
    span.className = part.type === 'display' ? 'card-math card-math--display' : 'card-math';
    try {
      span.innerHTML = katex.renderToString(part.value, {
        displayMode: part.type === 'display',
        throwOnError: true,
        strict: false,
      });
    } catch (error) {
      // A card with broken LaTeX must still be reviewable, and the breakage
      // must be visible rather than swallowed — otherwise it is never fixed.
      span.classList.add('card-math--error');
      span.textContent = part.value;
      span.title = String(error?.message ?? error);
    }
    element.append(span);
  }

  return element;
}
