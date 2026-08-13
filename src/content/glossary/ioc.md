---
term: "IOC"
aliases: ["immediate or cancel"]
track: 2
status: written
---

Immediate-or-cancel: execute whatever part of the order can be filled against resting liquidity right now, and cancel the rest rather than leaving it in the **order book**. It is the default instruction of anyone who does not want to reveal a standing intention — the order either trades or vanishes, leaving no trace for others to react to. Most algorithmic execution is built out of streams of small IOCs rather than one large order.
