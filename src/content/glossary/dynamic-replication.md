---
term: "Dynamic replication"
aliases: ["continuous rebalancing"]
track: 4
status: written
---

Reproducing the payoff of an instrument with a portfolio that is traded repeatedly as prices and time change. The Black-Scholes argument is the standard example: holding $\Delta$ units of the **underlying**, financed at the risk-free rate, and adjusting $\Delta$ as the price moves replicates an option, so the option's price is the cost of setting up this strategy. In theory the rebalancing is continuous and costless. In practice it is discrete and has transaction costs, jumps in the price cannot be hedged, and the volatility used to size the hedge must be assumed, so the replication is only approximate and carries residual risk. See **delta hedging**.
