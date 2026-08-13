---
term: "Correlation matrix"
aliases: ["correlation", "covariance matrix"]
track: 3
status: written
---

The matrix of pairwise correlations between a set of assets, and the central input to portfolio construction and risk models. Its difficulty is dimensional: estimating $N(N-1)/2$ parameters from $T$ observations per asset is hopeless unless $T \gg N$, and in practice $T$ and $N$ are comparable. The result is a matrix dominated by estimation noise, which looks perfectly well-behaved and is not.
