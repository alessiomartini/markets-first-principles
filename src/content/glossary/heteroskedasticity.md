---
term: "Heteroskedasticity"
aliases: ["heteroscedasticity", "time-varying volatility"]
track: 3
status: written
---

Variance that changes over time rather than staying constant. In returns it is not a nuisance to be corrected for but the dominant feature of the data: volatility varies by an order of magnitude between calm and stressed periods, and it does so persistently enough to be forecastable. Every model that assumes constant variance is therefore wrong in a way that matters, which is what motivates **GARCH** and everything after it.
