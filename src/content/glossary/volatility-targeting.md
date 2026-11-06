---
term: "Volatility targeting"
aliases: ["vol targeting", "volatility scaling"]
track: 4
status: written
---

Scaling a position so that its expected **volatility** equals a chosen number: hold less when the asset is volatile and more when it is calm, with exposure proportional to the target divided by the current volatility estimate. It keeps the size of a typical day's move roughly constant and is a simple form of **position sizing**. It does not remove risk: volatility rises after a shock, so the position is cut after the loss and not before, and a sudden jump is not scaled at all.
