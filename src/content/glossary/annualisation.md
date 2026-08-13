---
term: "Annualisation"
aliases: ["annualised", "square root of time"]
track: 3
status: written
---

Rescaling a return or volatility measured over one horizon to a yearly figure, conventionally by multiplying returns by the number of periods and volatilities by its square root. The square root is not a convention but a consequence of **additivity** plus independence — variance adds, so standard deviation grows as $\sqrt{T}$ — and it therefore fails exactly when returns are dependent. Since volatility clusters and returns are mildly mean-reverting, annualised numbers are always slightly wrong, and the site states the underlying horizon whenever it matters.
