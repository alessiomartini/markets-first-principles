---
term: "Delta hedging"
aliases: ["delta hedge", "dynamic hedging"]
track: 4
status: written
---

Holding the amount of the **underlying** that offsets an option position's **delta**, so that the combined position is insensitive to small moves in the price. Because delta changes as the market moves, the hedge has to be adjusted repeatedly, and each adjustment costs the **bid-ask spread** and some **slippage**. The result is that a delta-hedged option does not eliminate risk but converts it: the position no longer bets on direction and instead earns or loses depending on whether the underlying actually moves more or less than the volatility the option was priced at. In the idealised model with continuous, costless rebalancing the hedge is exact; in practice it never is.
