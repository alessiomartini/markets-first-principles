---
term: "Iceberg order"
aliases: ["iceberg", "reserve order", "hidden size"]
track: 2
status: written
---

A **limit order** that displays only a small portion of its true size, replenishing the visible slice each time it is consumed. The purpose is to sit in the book without announcing how much you intend to trade. The cost is **queue priority**: on most venues the hidden portion loses its place in line each time the visible slice refreshes, so an iceberg trades less often than a fully displayed order of the same size — you pay for concealment in execution probability.
