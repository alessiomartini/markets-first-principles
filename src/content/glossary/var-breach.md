---
term: "VaR breach"
aliases: ["VaR exceedance", "exceedance", "backtesting exception"]
track: 3
status: written
---

A day on which the realised loss exceeded the **value at risk** estimate. Breaches are the only direct test of a risk model: at 99% confidence you should see roughly 2.5 per year, and counting them is the standard supervisory backtest. The informative failure is not that breaches happen but *how* they fail — they arrive in clusters rather than independently, because volatility clusters, so a model can have the right average breach count and still be wrong about every period that matters.
