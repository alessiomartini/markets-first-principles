#!/usr/bin/env python3
"""Effective vs realised spread — Track 2, "Market makers and adverse selection".

SIMULATED, not fetched. A Glosten-Milgrom-style market: a fraction INFORMED
of orders trade in the direction of a jump of INFO_MOVE ticks in the efficient
value (the jump comes just before the trade); the rest are random-sign noise.
The market maker quotes the mid plus or minus HALF_SPREAD, and the mid closes a
fraction CATCH_UP of its gap to the value after every trade. Effective spread of a trade =
2 * sign * (price - mid before); realised spread at horizon h = 2 * sign *
(price - mid h trades later). The curve shows the mean of each against h:
the gap is the price drift in the direction of the trade, which here is
produced by the informed flow in the model.
"""

from __future__ import annotations

import random
import sys

from common import run, write_figure
from simulation import SEED

TRADES = 200000
INFORMED = 0.25
HALF_SPREAD = 1.0  # in ticks
INFO_MOVE = 1.0
CATCH_UP = 0.1
HORIZONS = [1, 2, 3, 5, 8, 12, 20, 30, 50]


def main() -> int:
    rng = random.Random(SEED)
    mid, sign, price = [], [], []
    m = v = 0.0
    for _ in range(TRADES):
        informed = rng.random() < INFORMED
        s = rng.choice((-1, 1))
        if informed:
            v += s * INFO_MOVE  # informed traders trade because the value just moved their way
        mid.append(m)
        sign.append(s)
        price.append(m + s * HALF_SPREAD)
        m += CATCH_UP * (v - m)  # the quote only gradually learns the new value
    eff = sum(2 * s * (p - mm) for s, p, mm in zip(sign, price, mid)) / TRADES
    rows, rs = [], {}
    for h in HORIZONS:
        n = TRADES - h
        rs[h] = sum(2 * sign[i] * (price[i] - mid[i + h]) for i in range(n)) / n
        rows.append({"series": "effective", "x": h, "y": eff})
        rows.append({"series": "realised", "x": h, "y": rs[h]})
    print("  effective %.3f; realised h=1 %.3f, h=50 %.3f" % (eff, rs[1], rs[50]))
    write_figure(
        "spread-decomposition",
        {
            "chart": "line",
            "source": "Simulation (Glosten-Milgrom-style informed/noise flow, seed %d)" % SEED,
            "series_note": "%d trades, %.0f%% informed; spreads in ticks; information content and quote adjustment speed are inputs" % (TRADES, INFORMED * 100),
            "x": {"label": "horizon h (trades after the trade)", "type": "log"},
            "y": {"label": "spread (ticks)"},
            "series": [
                {"key": "effective", "label": "Effective spread"},
                {"key": "realised", "label": "Realised spread"},
            ],
            "meta": {"seed": SEED, "informedShare": INFORMED, "effective": eff, "realisedByHorizon": rs},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
