---
term: "Volatility surface"
aliases: ["implied volatility surface", "vol surface"]
track: 4
status: written
---

The full map of **implied volatility** across both **strike** and **expiry**, one number for every listed option on the same underlying. Slicing it at a fixed expiry gives the **volatility smile**; slicing it at a fixed moneyness gives the **term structure of volatility**. Black-Scholes would make it a flat plane, so its actual shape is the market's correction to the model, and it moves every day: a stress episode lifts the short-dated, low-strike corner most. Traders quote, hedge and mark option books in terms of the surface rather than in prices, and models such as **local volatility** and **stochastic volatility** are judged by how well they reproduce it.
