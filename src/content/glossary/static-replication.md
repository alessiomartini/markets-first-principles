---
term: "Static replication"
aliases: []
track: 4
status: written
---

Reproducing the payoff of an instrument with a portfolio of other instruments that is set up once and then left alone until **expiry**. By the **law of one price**, the instrument must be worth the same as the portfolio. A forward is statically replicated by buying the **underlying** and borrowing, and a call and a put are linked to a forward by **put-call parity**. Static replication is preferred when it exists, because it needs no model of how prices move and has no hedging costs along the way; when it is not possible, one falls back on **dynamic replication**.
