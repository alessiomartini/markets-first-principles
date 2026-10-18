---
term: "Sharpe ratio"
aliases: ["Sharpe", "reward-to-variability"]
track: 4
status: written
---

Average excess return per unit of **volatility**: the mean return above the risk-free rate, divided by the standard deviation of returns, $S = (\mu - r_f)/\sigma$. It is the standard way of comparing strategies that run at different risk levels, because scaling a position up or down scales $\mu - r_f$ and $\sigma$ together and leaves $S$ unchanged. It is usually quoted annualised, and it is only as trustworthy as the assumption behind it: that risk is fully described by the standard deviation. Strategies with **fat tails**, skewed payoffs or short-option profiles can show a flattering Sharpe ratio right up to the day they do not.
