---
term: "Impact cost"
aliases: ["market impact cost", "price impact cost"]
track: 7
status: written
---

The cost of moving the price by trading: a large order consumes the best quotes and moves on to worse ones, and the price may stay displaced for a while. For orders that are not tiny it grows roughly with volatility times the square root of order size as a fraction of daily volume. It is what makes the capacity of a strategy finite, and it is highest when many participants are trying to do the same thing.
