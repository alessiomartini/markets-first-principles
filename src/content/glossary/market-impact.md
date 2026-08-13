---
term: "Market impact"
aliases: ["impact", "price impact"]
track: 2
status: written
physics: "A linear response function with memory: the price responds to the perturbation of your order flow through a propagator, not instantaneously and not permanently."
---

The extent to which your own trading moves the price against you. It is not a friction to be estimated away but the dominant cost of any strategy at size, and it is concave: impact grows roughly as the square root of the quantity traded, so doubling your size costs less than twice as much but the average price still deteriorates. Impact is conventionally split into a *permanent* component, reflecting the information the market infers from your trade, and a *transient* component that decays as the book refills — and how much of it is truly permanent is one of the genuinely open questions in the field.
