#!/usr/bin/env python3
"""Residual P&L of a delta-hedged option — Track 5, "Bachelier and Black-Scholes".

SIMULATED, not fetched. One long at-the-money call, bought at implied volatility
20% and hedged once a day to expiry (63 trading days) with the Black-Scholes
delta computed at that same 20%. Each path is a geometric Brownian motion with
its own true volatility drawn uniformly from 10% to 30%, zero rates and zero
drift (so the only P&L source is the volatility mismatch and the discrete
hedging).

Hedged P&L = payoff - premium - sum_i delta_i * (S_{i+1} - S_i). In the
continuous limit this is the integral of 0.5 * Gamma * S^2 * (realised variance
- implied variance) dt, positive when realised volatility ends above the implied
one. With daily rebalancing the noise around that line scales like
sigma * sqrt(dt): the scatter is the part the formula does not remove.
"""

from __future__ import annotations

import math
import random
import sys

from common import run, write_figure

SEED = 20261031
PATHS = 150
DAYS = 63
YEAR = 252
S0 = 100.0
IMPLIED = 0.20


def norm_cdf(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def call_price_delta(spot: float, strike: float, vol: float, tau: float) -> tuple[float, float]:
    if tau <= 0:
        return max(spot - strike, 0.0), 1.0 if spot > strike else 0.0
    d1 = (math.log(spot / strike) + 0.5 * vol**2 * tau) / (vol * math.sqrt(tau))
    d2 = d1 - vol * math.sqrt(tau)
    return spot * norm_cdf(d1) - strike * norm_cdf(d2), norm_cdf(d1)


def main() -> int:
    rng = random.Random(SEED)
    dt = 1 / YEAR
    premium, _ = call_price_delta(S0, S0, IMPLIED, DAYS * dt)

    rows = []
    for _ in range(PATHS):
        true_vol = rng.uniform(0.10, 0.30)
        spot = S0
        hedge_pnl = 0.0
        squared = []
        for step in range(DAYS):
            _, delta = call_price_delta(spot, S0, IMPLIED, (DAYS - step) * dt)
            z = rng.gauss(0, 1)
            nxt = spot * math.exp(-0.5 * true_vol**2 * dt + true_vol * math.sqrt(dt) * z)
            hedge_pnl -= delta * (nxt - spot)
            squared.append(math.log(nxt / spot) ** 2)
            spot = nxt
        pnl = max(spot - S0, 0.0) - premium + hedge_pnl
        realised = math.sqrt(sum(squared) / (DAYS * dt))
        rows.append({"series": "paths", "x": (realised - IMPLIED) * 100, "y": pnl, "label": ""})

    # Least-squares slope, as a sanity check against the vega-like theory.
    n = len(rows)
    mx = sum(r["x"] for r in rows) / n
    my = sum(r["y"] for r in rows) / n
    slope = sum((r["x"] - mx) * (r["y"] - my) for r in rows) / sum((r["x"] - mx) ** 2 for r in rows)

    write_figure(
        "delta-hedge-pnl",
        {
            "chart": "scatter",
            "source": "Simulation (GBM, daily hedge, seed %d)" % SEED,
            "series_note": "%d simulated paths of one 3-month at-the-money call, bought at 20%% implied vol, delta-hedged daily"
            % PATHS,
            "x": {"label": "realised minus implied volatility (percentage points)"},
            "y": {"label": "hedged P&L (per option on spot 100)"},
            "series": [{"key": "paths", "label": "Simulated paths"}],
            "meta": {"seed": SEED, "premium": premium, "olsSlope": slope},
            "data": rows,
        },
        synthetic=True,
    )
    print(f"  premium {premium:.3f}, OLS slope of P&L on vol gap {slope:.3f} per vol point")
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
