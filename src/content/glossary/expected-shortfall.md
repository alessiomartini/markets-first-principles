---
term: "Expected shortfall"
aliases: ["ES", "CVaR", "conditional value at risk", "average value at risk"]
track: 4
status: written
---

The average loss in the cases where the loss exceeds the **value at risk** threshold: "if we are in the worst 1% of outcomes, how bad is it on average?" It answers the question VaR leaves open, namely the size of the exceedances, and so it reacts to the shape of the tail rather than only to where the tail starts. For that reason it is more sensitive to **fat tails**, and it is also harder to estimate, since it rests on the few extreme observations in a sample. Unlike VaR it is subadditive, so combining portfolios cannot make it look worse than the sum of the parts, which is why regulators have moved toward it.
