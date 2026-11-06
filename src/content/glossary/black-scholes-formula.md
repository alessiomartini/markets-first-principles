---
term: "Black-Scholes formula"
aliases: ["Black-Scholes", "BS formula"]
track: 4
status: written
---

The closed-form price of a European call or put on an underlying that follows geometric Brownian motion with constant volatility, paying no dividends, with a constant risk-free rate $r$. For a call, $C = S\,N(d_1) - K e^{-rT} N(d_2)$, where $d_1 = \big[\ln(S/K) + (r + \sigma^2/2)T\big] / (\sigma\sqrt{T})$, $d_2 = d_1 - \sigma\sqrt{T}$ and $N$ is the standard normal distribution function. The formula follows from continuous **delta hedging**: if the option can be replicated by trading the underlying, its price is fixed by **no-arbitrage** and the expected return of the underlying drops out. The only input that cannot be observed is the volatility $\sigma$, which is why the formula is mostly used backwards, to read **implied volatility** from a market price.
