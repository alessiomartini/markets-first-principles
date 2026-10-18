---
term: "Gamma"
aliases: ["option gamma", "Γ"]
track: 4
status: written
---

The rate at which an option's **delta** changes as the underlying moves, $\Gamma = \partial^2 V / \partial S^2$: the curvature of the option price in the underlying. Long options have positive gamma, so delta grows as the market rises and shrinks as it falls, which is the option's convexity at work. Gamma is largest for at-the-money options close to **expiry**. It is what makes a delta hedge leak: a position hedged to be insensitive to small moves is still exposed to large ones, and must be re-hedged as delta drifts.
