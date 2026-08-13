---
term: "Matching engine"
aliases: ["matching engines"]
track: 2
status: written
---

The piece of software that maintains the **order book** and applies the matching rules to incoming messages, one at a time, in the order it receives them. It is deliberately a serial machine: the sequence in which messages reach it determines who trades, so the engine's arrival ordering *is* the market's ground truth. Almost everything exotic about modern market structure — colocation, the microsecond arms race, race conditions between cancels and takes — follows from participants competing over their position in that single queue.
