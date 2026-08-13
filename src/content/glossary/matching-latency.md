---
term: "Matching latency"
aliases: ["exchange latency", "tick-to-trade"]
track: 2
status: written
---

The time between an order arriving at the exchange and the response leaving it. Together with network time it determines who wins a race to a resting quote. What matters competitively is not the mean but the tail: a system that is fast on average and occasionally slow will lose exactly the races that were worth winning, because those are the moments when everyone is trying at once.
