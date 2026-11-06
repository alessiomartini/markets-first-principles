---
term: "Forecast horizon"
aliases: ["horizon", "prediction horizon"]
track: 7
status: written
---

The period over which a signal is meant to predict returns, from seconds for an order-book signal to months for a valuation signal. The signal is evaluated against returns over that period and the portfolio is traded on that time scale, so the horizon decides how often positions turn over and hence how large the trading costs are.
