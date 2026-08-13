---
term: "Race condition"
aliases: ["latency race", "sniping"]
track: 2
status: written
---

The situation where a price becomes stale and several participants simultaneously try to act on it — some to take the stale quote, the maker to cancel it. Only one message can reach the **matching engine** first, so the outcome is decided by microseconds rather than by analysis. These races are the mechanism by which speed converts into profit, and the estimated total value of winning them is the standard measure of what the arms race costs everyone else.
