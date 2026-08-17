---
term: "Zero-coupon curve"
aliases: ["zero curve", "spot curve", "discount curve"]
track: 1
status: written
---

The set of **discount factor**s for every maturity, equivalently the yields on hypothetical bonds paying nothing until they mature. It is the object from which every other fixed-income price is built, and it is not directly observable: real bonds pay coupons along the way, so the curve has to be *bootstrapped* out of their prices. Two desks with the same market data can produce slightly different curves, which is why curve construction is a real discipline rather than a data-loading step.
