import { describe, expect, it } from 'vitest';

import { gradeTyped, normaliseLatex } from './answer.mjs';
import { splitMath } from './math.mjs';

describe('normaliseLatex', () => {
  it('ignores formatting that does not change meaning', () => {
    const same = [
      ['x^{2}', 'x^2'],
      ['\\left( a + b \\right)', '(a+b)'],
      ['\\dfrac{1}{2}', '\\frac{1}{2}'],
      ['E[X]', '\\mathbb{E}[X]'],
      ['a \\cdot b', 'a \\times b'],
      ['x \\le y', 'x \\leq y'],
      ['$\\sigma^2$', '\\sigma^{2}'],
      ['\\varphi(t)', '\\phi(t)'],
    ];
    for (const [a, b] of same) {
      expect(normaliseLatex(a), `${a} vs ${b}`).toBe(normaliseLatex(b));
    }
  });

  it('keeps differences that do change meaning', () => {
    const different = [
      ['x^2', 'x^3'],
      ['\\frac{1}{2}', '\\frac{2}{1}'],
      ['E[X^2]', 'E[X]^2'],
      ['a-b', 'b-a'],
      ['\\sum_{i=1}^{n}', '\\sum_{i=0}^{n}'],
    ];
    for (const [a, b] of different) {
      expect(normaliseLatex(a), `${a} vs ${b}`).not.toBe(normaliseLatex(b));
    }
  });

  it('survives empty and nullish input', () => {
    expect(normaliseLatex(undefined)).toBe('');
    expect(normaliseLatex('   ')).toBe('');
  });
});

describe('gradeTyped', () => {
  it('accepts a correct answer typed differently', () => {
    expect(gradeTyped('  Var(X) = E[X^{2}] - E[X]^2  ', 'Var(X)=E[X^2]-E[X]^2').correct).toBe(true);
  });

  it('rejects a wrong answer', () => {
    expect(gradeTyped('E[X^2] - E[X]', 'E[X^2]-E[X]^2').correct).toBe(false);
  });

  it('rejects an empty answer rather than counting it right against an empty expectation', () => {
    expect(gradeTyped('', '').correct).toBe(false);
  });

  it('flags a case-only miss as wrong but near', () => {
    const result = gradeTyped('e[x]', 'E[X]');
    expect(result.correct).toBe(false);
    expect(result.near).toBe(true);
  });
});

describe('splitMath', () => {
  it('separates inline maths from prose', () => {
    expect(splitMath('the mean $\\mu$ of $X$')).toEqual([
      { type: 'text', value: 'the mean ' },
      { type: 'inline', value: '\\mu' },
      { type: 'text', value: ' of ' },
      { type: 'inline', value: 'X' },
    ]);
  });

  it('recognises display maths', () => {
    expect(splitMath('$$\\int_0^1 x\\,dx$$')).toEqual([
      { type: 'display', value: '\\int_0^1 x\\,dx' },
    ]);
  });

  it('leaves an escaped dollar alone', () => {
    expect(splitMath('costs \\$5')).toEqual([{ type: 'text', value: 'costs $5' }]);
  });

  it('treats an unclosed delimiter as literal instead of eating the card', () => {
    expect(splitMath('a $ b c')).toEqual([{ type: 'text', value: 'a $ b c' }]);
  });

  it('does not let a single $ close inside a $$ block', () => {
    const parts = splitMath('$$a$$ and $b$');
    expect(parts.map((p) => p.type)).toEqual(['display', 'text', 'inline']);
    expect(parts[0].value).toBe('a');
  });

  it('handles a dollar sign in prose next to real maths', () => {
    // Prices show up in this material constantly; the failure this guards
    // against is one price swallowing the rest of the card.
    const parts = splitMath('a \\$100 bond with yield $y$');
    expect(parts.at(-1)).toEqual({ type: 'inline', value: 'y' });
  });
});
