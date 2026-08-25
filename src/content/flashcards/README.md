# Writing cards

One JSON file per deck. Content is versioned here; review progress lives only
in D1 and never in this repo. The two are joined by `id`.

Validate with `npm run validate:cards` — it runs in CI and fails the build.

## Fields

| Field | Required | Notes |
|---|---|---|
| `id` | ✅ | lowercase kebab-case, **permanent**. See the warning below. |
| `type` | ✅ | `basic` · `cloze` · `formula` · `why` |
| `front` | ✅ | markdown + LaTeX. A question to answer, never a passage to recognise. |
| `back` | ✅ | markdown + LaTeX |
| `answer` | for `formula` | the exact string to type. Required on `formula`, forbidden elsewhere. |
| `hint` | | shown only on demand, never auto-revealed |
| `sources` | ✅ | at least one; `{label, url, kind}` with kind `primary` · `wikipedia` · `glossary` |
| `tags` | | free-form |

`deck` and `topic` are set once at file level and apply to every card in it.

## Card ids are permanent

**The entire review history is keyed on `id`.** Renaming a card orphans every
review ever recorded against it — the log still holds the rows, but nothing
connects them to a card any more.

To retire a card, add it to `tombstones.json` with a date and a reason. The
validator fails if an id with history disappears without one, and also fails if
a tombstoned id reappears in a deck.

```json
{ "retired": [{ "id": "old-card-id", "retired_on": "2026-08-17", "reason": "merged into mgf-definition" }] }
```

## Rules

- **Atomic.** One retrievable fact, or one step of a derivation, per card. If
  the back has two unrelated ideas, it is two cards.
- **Generation, not recognition.** "Derive X", "why does Y fail", "where does
  the $\sigma^2$ come from" — not "what is X?" answered by a paragraph you have
  read many times. No multiple choice.
- **Two cards per formula.** One asking you to produce it, one asking you to
  interpret a specific term in it. Producing without understanding is how
  formulas get memorised and misapplied.
- **Your own words.** The study guide is copyrighted. Reformulate independently;
  never paste its prose, tables or sentences.
- **`formula` means typeable.** If the answer is not a single unambiguous
  string, it is a `basic` card. Self-grading is the weak link in any SRS, and
  the type exists to remove it where it can be removed.

## Sources

Resolved in this order:

1. **primary** — the OpenQuant study guide section.
2. **wikipedia** — for concepts the guide does not cover, or where a second
   treatment helps.
3. **glossary** — this site's own glossary, for terms that live nowhere else.

Source links are shown **only after the answer is revealed**, never on the
question side.

> **Anchors are not fabricated.** The guide renders every topic on one route,
> and its anchor ids could not be verified from the environment these cards
> were written in. Every primary link therefore points at the bare page with
> the section named in the label. If you verify an anchor by hand, deep-link it
> then — a generic link is worse than a deep one, and a broken deep link is
> worse than both.

## Two worked examples

A **formula** card. Note the typed `answer`, the hint that gestures without
giving it away, and the back adding the one caveat that makes the formula safe
to use:

```json
{
  "id": "mgf-definition",
  "type": "formula",
  "front": "Write the moment generating function of a random variable $X$.",
  "back": "$$M_X(t) = \\mathbb{E}\\left[e^{tX}\\right]$$\n\nIt exists only where the expectation is finite, which for some distributions is nowhere except $t=0$.",
  "answer": "E[e^{tX}]",
  "hint": "It is an expectation of an exponential in $X$.",
  "sources": [
    { "label": "OpenQuant Study Guide — Probability & Statistics", "url": "https://openquant.co/guide", "kind": "primary" },
    { "label": "Wikipedia — Moment-generating function", "url": "https://en.wikipedia.org/wiki/Moment-generating_function", "kind": "wikipedia" }
  ],
  "tags": ["mgf", "moments"]
}
```

A **why** card. The front demands a construction rather than a definition, and
the back ends with the exception worth carrying away:

```json
{
  "id": "zero-correlation-not-independence",
  "type": "why",
  "front": "Construct a pair of variables that are uncorrelated but not independent.",
  "back": "Let $X \\sim \\mathcal{N}(0,1)$ and $Y = X^2$ … Correlation measures *linear* dependence only. The exception worth remembering: for a jointly Gaussian pair, zero correlation does imply independence.",
  "sources": [ … ],
  "tags": ["correlation", "independence", "counterexample"]
}
```
