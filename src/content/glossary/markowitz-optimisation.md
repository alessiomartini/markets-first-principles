---
term: "Markowitz optimisation"
aliases: ["mean-variance optimisation", "MVO"]
track: 4
status: written
physics: "Inverting an estimated covariance operator: the solution is dominated by the weakest eigenmodes, which are the noisiest, so regularisation is the whole game."
---

Choosing portfolio weights to maximise expected return for a given variance, or to minimise variance for a given expected return, from a vector of expected returns and a **covariance matrix**. The unconstrained solution is proportional to the inverse covariance matrix applied to the expected returns, so it is very sensitive to estimation error in both, and in practice the weights are constrained, shrunk or built from a factor model. Introduced by Harry Markowitz in 1952.
