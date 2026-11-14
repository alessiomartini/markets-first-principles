#!/usr/bin/env python3
"""A model-generated volatility smile — Track 5, "The volatility surface".

SIMULATED in the sense of "model-generated", not fetched: no market quote is
used. Call prices come from Merton's jump-diffusion model (Black-Scholes
diffusion plus rare log-normal jumps, a Poisson-weighted sum of Black-Scholes
prices), and each price is then inverted back into a Black-Scholes implied
volatility by bisection. Black-Scholes alone would give a flat line at sigma;
the curvature in this figure is produced entirely by the jumps, which is the
textbook way a smile arises. Deterministic (no random numbers, no seed).

Parameters: S=100, r=0, sigma=15%, jump intensity 0.8 a year, mean log-jump -10%,
jump volatility 15%. Three maturities: 1, 3 and 12 months. The smile is
steepest at short maturity and flattens with time, as in real surfaces.
"""

from __future__ import annotations

import math
import sys

from common import run, write_figure

S = 100.0
R = 0.0
SIGMA = 0.15
LAM = 0.8
MU_J = -0.10
SIG_J = 0.15
MATURITIES = [("1m", 1 / 12, "1 month"), ("3m", 0.25, "3 months"), ("12m", 1.0, "12 months")]
STRIKES = [80 + 2.5 * i for i in range(0, 17)]  # 80 .. 120


def norm_cdf(x: float) -> float:
    return 0.5 * math.erfc(-x / math.sqrt(2))


def bs_call(s: float, k: float, r: float, sigma: float, t: float) -> float:
    d1 = (math.log(s / k) + (r + 0.5 * sigma**2) * t) / (sigma * math.sqrt(t))
    d2 = d1 - sigma * math.sqrt(t)
    return s * norm_cdf(d1) - k * math.exp(-r * t) * norm_cdf(d2)


def merton_call(s: float, k: float, r: float, sigma: float, t: float) -> float:
    kappa = math.exp(MU_J + 0.5 * SIG_J**2) - 1
    lam_p = LAM * (1 + kappa)
    total = 0.0
    for n in range(0, 40):
        weight = math.exp(-lam_p * t) * (lam_p * t) ** n / math.factorial(n)
        sigma_n = math.sqrt(sigma**2 + n * SIG_J**2 / t)
        r_n = r - LAM * kappa + n * math.log(1 + kappa) / t
        total += weight * bs_call(s, k, r_n, sigma_n, t)
    return total


def implied_vol(price: float, k: float, t: float) -> float:
    low, high = 1e-4, 3.0
    for _ in range(200):
        mid = 0.5 * (low + high)
        if bs_call(S, k, R, mid, t) < price:
            low = mid
        else:
            high = mid
    return 0.5 * (low + high)


def main() -> int:
    rows = []
    for key, t, _label in MATURITIES:
        for k in STRIKES:
            rows.append({"series": key, "x": k, "y": implied_vol(merton_call(S, k, R, SIGMA, t), k, t) * 100})

    write_figure(
        "model-smile",
        {
            "chart": "line",
            "source": "Simulation (Merton jump-diffusion prices inverted to Black-Scholes implied volatility; no market data)",
            "series_note": "S=%g, r=%g, sigma=%.0f%%, jump intensity %g a year, mean log-jump %.0f%%, jump vol %.0f%%"
            % (S, R, SIGMA * 100, LAM, MU_J * 100, SIG_J * 100),
            "x": {"label": "strike K (spot S = 100)"},
            "y": {"label": "Black-Scholes implied volatility (%)"},
            "series": [{"key": key, "label": label} for key, _t, label in MATURITIES],
            "meta": {"spot": S, "diffusionVolPct": SIGMA * 100},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
