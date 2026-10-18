---
term: "Put-call parity"
aliases: ["parity"]
track: 4
status: written
---

The exact relationship between the prices of a European call and put with the same **strike** and **expiry** on the same **underlying**: $C - P = S - K e^{-rT}$, ignoring dividends. A long call plus a short put replicates a forward position, so their price difference must equal the forward value of the underlying discounted to today. Because the relation follows from **no-arbitrage** alone and does not depend on any model of the price process, it is one of the few results in option pricing that holds regardless of what volatility does. A persistent violation, after costs and borrowing, is an **arbitrage**.
