---
term: "Implied volatility"
aliases: ["implied vol", "IV", "sigma_imp"]
track: 4
status: written
physics: "A parameter inverted from an observation rather than measured directly \u2014 like reading a temperature off a spectrum by assuming a blackbody, it is only as meaningful as the model used to invert it."
---

The volatility that, put into the Black-Scholes formula, reproduces an option's observed market price. It is not a forecast and not a measurement: it is a *quoting convention*, a way of expressing a price in units that are comparable across strikes and maturities. That distinction matters because implied volatility inherits every assumption of the model used to invert it, and the fact that it varies with strike \u2014 the **volatility smile** \u2014 is the market saying plainly that those assumptions are wrong. Traders nonetheless think in implied vol rather than in price, because it is the coordinate in which option markets are legible.
