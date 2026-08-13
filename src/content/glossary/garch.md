---
term: "GARCH"
aliases: ["ARCH", "GARCH(1,1)", "conditional heteroskedasticity"]
track: 3
status: written
physics: "A multiplicative cascade in disguise: today's variance is fed by yesterday's shock, giving the same intermittent bursts as turbulent energy transfer between scales."
---

A family of models in which today's variance depends on yesterday's variance and yesterday's squared return, $\sigma_t^2 = \omega + \alpha r_{t-1}^2 + \beta \sigma_{t-1}^2$. GARCH is the workhorse of volatility forecasting because it captures clustering with three parameters and estimates reliably. Its known weakness is that the exponential memory it implies decays far faster than the power-law memory actually observed, which is why long-memory and multifractal alternatives exist.
