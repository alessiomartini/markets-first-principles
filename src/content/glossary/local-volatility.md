---
term: "Local volatility"
aliases: ["Dupire", "local vol"]
track: 4
status: written
---

A model in which the volatility of the **underlying** is a deterministic function of the current price and time, $\sigma(S,t)$, chosen so that the model reproduces the entire observed surface of European option prices. Dupire showed that this function can be read directly from how option prices change with **strike** and **expiry**. It fits today's **volatility surface** exactly and keeps the market complete, so options can still be hedged by the underlying alone. Its weakness is that the future smile it implies is usually unrealistic: it predicts that the smile flattens as the price moves, which is not what markets do. Contrast **stochastic volatility**.
