---
term: "Volatility"
aliases: ["vol", "realised volatility"]
track: 3
status: written
physics: "A diffusion constant, with the same caveat: it is only constant over the window you assumed it was."
---

The standard deviation of **log returns**, expressed per unit time. Two different quantities share the name and are constantly confused: *realised* volatility is measured from past prices, while *implied* volatility is backed out of option prices and is a statement about the future that the market is charging for. This site writes bare $\sigma$ for realised and $\sigma_{\text{imp}}$ for implied. Volatility is also not risk, however often the two words are swapped — it is one number summarising a distribution whose most important feature, its tail, it systematically understates.
