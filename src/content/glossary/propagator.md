---
term: "Propagator"
aliases: ["propagator model", "impact kernel", "G(tau)"]
track: 2
status: written
physics: "Literally a linear response function with a memory kernel: the price is the convolution of past order flow with G, exactly as a driven system responds to its history of forcing."
---

The function $G(\tau)$ describing how much of a single trade's price effect survives $\tau$ events later. The propagator framework writes the price as the sum of all past **order flow** convolved with this kernel, which resolves the central puzzle of Track 2: order flow is strongly autocorrelated, yet prices are nearly unpredictable, because $G$ decays in exactly the way needed to cancel that autocorrelation. The decay is a power law with an exponent tied to the persistence of flow, and that tie is not a coincidence but a no-arbitrage condition.
