---
term: "Stochastic volatility"
aliases: ["stoch vol", "SV model"]
track: 4
status: written
---

A class of models in which the volatility of the **underlying** is itself a random process rather than a constant or a deterministic function, typically with its own volatility (**volatility of volatility**) and a correlation with the price. A negative correlation between price and volatility produces the downward-sloping skew seen in equity options, and mean reversion in volatility shapes how the smile changes with **expiry**. Well-known examples include Heston and SABR. Because volatility is not itself a traded asset, the market is incomplete: options cannot be replicated by the underlying alone, and their price depends on an additional assumption about the price of volatility risk.
