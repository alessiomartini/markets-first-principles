#!/usr/bin/env python3
"""An equity curve and its running peak — Track 7, "From research to P&L".

SIMULATED, not fetched. Daily returns are i.i.d. normal with mean MU and
volatility SIGMA (a zero-memory benchmark: no clustering, no fat tails), for
DAYS trading days, from the fixed seed in simulation.SEED. The curve starts at
100. The figure plots the equity curve and its running maximum; the gap between
them is the drawdown, and its largest value is the maximum drawdown reported in
the metadata. Deterministic.
"""

from __future__ import annotations

import random
import sys

from common import run, write_figure
from simulation import SEED

DAYS = 1000
MU = 0.0004
SIGMA = 0.01
STEP = 4  # keep every 4th day so the payload stays small


def main() -> int:
    rng = random.Random(SEED)
    equity, peak, worst = 100.0, 100.0, 0.0
    rows = []
    for day in range(DAYS + 1):
        if day > 0:
            equity *= 1.0 + rng.gauss(MU, SIGMA)
        peak = max(peak, equity)
        worst = max(worst, 1.0 - equity / peak)
        if day % STEP == 0:
            rows.append({"series": "equity", "x": day, "y": equity})
            rows.append({"series": "peak", "x": day, "y": peak})

    write_figure(
        "drawdown-equity-curve",
        {
            "chart": "line",
            "source": "Simulation (illustrative model; see pipeline/fetch_drawdown.py). No market data",
            "series_note": "one simulated path of %d daily returns, normal, mean %g, volatility %g, seed %d" % (DAYS, MU, SIGMA, SEED),
            "x": {"label": "trading day"},
            "y": {"label": "equity (start = 100)"},
            "series": [
                {"key": "equity", "label": "Equity curve"},
                {"key": "peak", "label": "Running peak"},
            ],
            "meta": {"maxDrawdownPct": worst * 100, "seed": SEED},
            "data": rows,
        },
        synthetic=True,
    )
    print("max drawdown %.1f%%" % (worst * 100))
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
