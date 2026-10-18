---
term: "Overfitting"
aliases: ["overfit", "data snooping", "curve fitting"]
track: 7
status: written
---

Fitting a model so closely to a particular sample that it captures that sample's noise instead of a relationship that persists. The more parameters, rules or variants one tries on the same data, the better the best of them looks by chance alone, so a strong backtest is weaker evidence than it appears whenever many alternatives were tested to obtain it. Financial data make this especially easy to do: histories are short relative to the number of ideas, the signal is faint against the noise, and the same history is reused by everyone. The usual defences are simplicity, out-of-sample testing that was never used for tuning, and keeping a count of how many things were tried.
