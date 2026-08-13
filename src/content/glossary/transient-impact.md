---
term: "Transient impact"
aliases: ["temporary impact"]
track: 2
status: written
---

The portion of **market impact** that decays after the trade, as the **order book** refills and the price relaxes back. It is what makes patient execution worthwhile: splitting an order lets the transient component decay between slices, so the average cost is lower than trading everything at once. The decay is slow and roughly power-law rather than exponential, which is why "wait a few minutes" helps less than intuition suggests.
