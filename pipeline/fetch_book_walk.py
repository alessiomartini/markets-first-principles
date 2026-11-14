#!/usr/bin/env python3
"""Cost of a market order against its size — Track 2, "Order types and execution".

SIMULATED, not fetched (no live book snapshot). The ask side of a book is built
level by level with the V-shaped depth the order-book figure describes: the size
resting k ticks from the touch is q(k) = Q0 * (k / K0)^0.6, with a seeded
lognormal wobble (sd 0.35), so the touch is thin and depth grows outward. The
script walks a buy order through the levels and reports slippage against the
mid, in basis points, for the average fill and for the marginal (last) unit.
"""

from __future__ import annotations

import math
import random
import sys

from common import run, write_figure
from simulation import SEED

MID = 60000.0
TICK = 0.5  # price units per level
HALF_SPREAD_TICKS = 1  # best ask sits one tick above mid
LEVELS = 4000
Q0, K0, EXPONENT, WOBBLE = 0.05, 10.0, 0.6, 0.35  # base size (coins), reference tick, growth
SIZES = [0.1 * 1.35**i for i in range(0, 28)]  # coins, log-spaced, ~0.1 .. ~450


def main() -> int:
    rng = random.Random(SEED)
    book = []
    for k in range(1, LEVELS + 1):
        size = Q0 * (k / K0) ** EXPONENT * math.exp(WOBBLE * rng.gauss(0, 1))
        book.append((MID + (HALF_SPREAD_TICKS + k - 1) * TICK, size))

    rows = []
    for order in SIZES:
        left, cost, last = order, 0.0, book[0][0]
        for price, size in book:
            take = min(left, size)
            cost += take * price
            left -= take
            last = price
            if left <= 1e-12:
                break
        if left > 1e-9:
            break
        avg = cost / order
        rows.append({"series": "avg", "x": order, "y": (avg / MID - 1) * 1e4})
        rows.append({"series": "marginal", "x": order, "y": (last / MID - 1) * 1e4})
    print("  %d sizes, avg slippage at largest: %.1f bp" % (len(rows) // 2, rows[-2]["y"]))
    write_figure(
        "walking-the-book",
        {
            "chart": "line",
            "source": "Simulation (V-shaped book, seed %d)" % SEED,
            "series_note": "ask side only; size at k ticks from the touch = %.2f*(k/%g)^%.1f with lognormal sd %.2f; tick %.1f on a mid of %.0f" % (Q0, K0, EXPONENT, WOBBLE, TICK, MID),
            "x": {"label": "order size (coins)", "type": "log"},
            "y": {"label": "slippage against mid (bp)"},
            "series": [
                {"key": "avg", "label": "Average fill price"},
                {"key": "marginal", "label": "Last unit filled"},
            ],
            "meta": {"seed": SEED, "levels": LEVELS},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
