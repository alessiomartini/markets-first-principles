#!/usr/bin/env python3
"""Signature plot — Track 3, "Is the market efficient".

SIMULATED, not fetched. An efficient log price is a Gaussian random walk
(per-tick volatility SIGMA). Each tick a trade prints at the mid
plus or minus half a spread (HALF_SPREAD) with an independent random sign
(Roll bounce). Signature = variance per tick of k-tick returns, normalised by
the same quantity at k = 500, for the trade-price series and for the mid-price
series. Trade prices start high at k = 1 because of the bounce and fall toward
1; mid prices sit at 1 throughout, by construction.
"""

from __future__ import annotations

import random
import sys

from common import run, write_figure
from simulation import SEED

TICKS = 400000
SIGMA = 1e-4
HALF_SPREAD = 2e-4
LAGS = [1, 2, 3, 5, 8, 12, 20, 35, 60, 100, 170, 300, 500]


def variance_per_tick(p, k):
    d = [p[i + k] - p[i] for i in range(0, len(p) - k, k)]
    m = sum(d) / len(d)
    return sum((v - m) ** 2 for v in d) / len(d) / k


def main() -> int:
    rng = random.Random(SEED)
    mid, trade, x = [], [], 0.0
    for _ in range(TICKS):
        x += SIGMA * rng.gauss(0, 1)
        mid.append(x)
        trade.append(x + HALF_SPREAD * (1 if rng.random() < 0.5 else -1))
    rows = []
    out = {}
    for name, series in (("trade", trade), ("mid", mid)):
        ref = variance_per_tick(series, LAGS[-1])
        out[name] = {k: variance_per_tick(series, k) / ref for k in LAGS}
        rows += [{"series": name, "x": k, "y": v} for k, v in out[name].items()]
    print("  trade k=1: %.2f, k=10ish: %.2f; mid k=1: %.2f" % (out["trade"][1], out["trade"][12], out["mid"][1]))
    write_figure(
        "signature-plot",
        {
            "chart": "line",
            "source": "Simulation (random-walk mid price with bid-ask bounce, seed %d)" % SEED,
            "series_note": "%d ticks; trade price = mid ± %.0f bp half-spread with random sign; variance per tick normalised by its value at 500 ticks" % (TICKS, HALF_SPREAD * 1e4),
            "x": {"label": "lag k (ticks)", "type": "log"},
            "y": {"label": "variance per tick, relative to k = 500"},
            "series": [
                {"key": "trade", "label": "Trade prices"},
                {"key": "mid", "label": "Mid prices"},
            ],
            "meta": {"seed": SEED, "ticks": TICKS, "signature": out},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
