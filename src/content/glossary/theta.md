---
term: "Theta"
aliases: ["time decay"]
track: 4
status: written
---

The sensitivity of an option's price to the passage of time, $\partial V / \partial t$, usually quoted per day. For a long option it is typically negative: with everything else unchanged, the option loses value as **expiry** approaches because there is less time for the **underlying** to move. This is the price paid for the convexity of a long option, and it is the mirror image of the **gamma** it provides: in a delta-hedged position, theta and gamma offset each other, so that decay is earned back only when the underlying actually moves as much as the **implied volatility** assumed.
