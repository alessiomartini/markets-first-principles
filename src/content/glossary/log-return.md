---
term: "Log return"
aliases: ["log returns", "logarithmic return"]
track: 3
status: written
---

The change in the logarithm of the price, $r_t = \ln S_t - \ln S_{t-1}$. It is the working variable of empirical finance for one decisive reason: log returns add across time, so a return over $n$ periods is the sum of $n$ one-period returns, and every tool built for sums — central limit theorems, cumulants, scaling arguments — applies directly. Simple returns compound instead of adding, which makes them right for reporting performance and wrong for statistics. For small moves the two agree to first order; for the large moves that dominate risk, they do not.
