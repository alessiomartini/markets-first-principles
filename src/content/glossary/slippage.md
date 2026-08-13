---
term: "Slippage"
aliases: ["implementation shortfall"]
track: 2
status: written
---

The difference between the price you expected when you decided to trade and the price you actually achieved. It bundles together several distinct costs — the **bid-ask spread**, the **market impact** of your own order, and the drift of the market while you were working the order — and separating them is the whole discipline of execution analysis. The formal version, *implementation shortfall*, measures against the price at the moment of the decision, which is the only benchmark that cannot be gamed by trading slowly.
