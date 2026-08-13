---
term: "Realised volatility"
aliases: ["realized volatility", "RV"]
track: 3
status: written
---

Volatility computed from observed returns over a window, as opposed to volatility implied by option prices. Its useful property is that it converges as sampling gets finer — it is a quadratic variation, so more frequent observations genuinely improve the estimate, unlike the mean. The limit is microstructure noise: sample too finely and you start measuring the **bid-ask spread** bouncing rather than the price moving, which is why the signature plot of Track 3's efficiency page bends at short lags.
