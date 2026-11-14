#!/usr/bin/env python3
"""Simple interest against compound interest — Track 1, "Cash flows and discounting".

SCHEMATIC, not fetched and not simulated: a deterministic growth formula on a
grid of years, with no randomness and no market data. 100 invested at 5% a year:

    simple      100 * (1 + r t)
    annual      100 * (1 + r)^t
    continuous  100 * exp(r t)

The gap between the lines is the interest earned on interest, which is why the
time value of money is exponential and not linear in the horizon.
"""

from __future__ import annotations

import math
import sys

from common import run, write_figure

PRINCIPAL = 100.0
RATE = 0.05
YEARS = list(range(0, 41))


def main() -> int:
    rows = []
    for t in YEARS:
        rows.append({"series": "simple", "x": t, "y": PRINCIPAL * (1 + RATE * t)})
        rows.append({"series": "annual", "x": t, "y": PRINCIPAL * (1 + RATE) ** t})
        rows.append({"series": "continuous", "x": t, "y": PRINCIPAL * math.exp(RATE * t)})

    write_figure(
        "compounding-vs-simple",
        {
            "chart": "line",
            "source": "Schematic (growth formulas evaluated on a grid; no market data)",
            "series_note": "principal %g, rate %.0f%% a year, horizon %d years" % (PRINCIPAL, RATE * 100, YEARS[-1]),
            "x": {"label": "years invested"},
            "y": {"label": "value of the investment"},
            "series": [
                {"key": "simple", "label": "Simple interest"},
                {"key": "annual", "label": "Compounded annually"},
                {"key": "continuous", "label": "Compounded continuously"},
            ],
            "meta": {"principal": PRINCIPAL, "rate": RATE},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
