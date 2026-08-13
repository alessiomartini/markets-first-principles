---
term: "Drift"
aliases: ["expected return", "mu"]
track: 3
status: written
---

The deterministic component of a price's motion, the $\mu$ in a model where log price moves by $\mu \Delta t$ plus noise. Drift is the quantity everyone wants to know and almost nobody can measure: its standard error depends on the *span* of the sample rather than its frequency, so a century of daily data is no better for estimating drift than a century of annual data. That asymmetry against **volatility**, which fine sampling does pin down, is the governing constraint of quantitative finance.
