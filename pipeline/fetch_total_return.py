#!/usr/bin/env python3
"""Total return against price return — Track 1, "Equity".

SIMULATED, not fetched (no Stooq or FRED series). 360 monthly index returns with
drift 0.6% a month before dividends and volatility 4.3% a month (fixed seed).
The dividend yield mean-reverts around 2.0% a year (AR(1) on the annual yield,
monthly phi = 0.97, shock sd 0.04 points) and is paid out monthly. Price index
= product of price returns; total-return index = product of price return plus
yield/12. Both start at 100 and are drawn on a log axis, so a constant
reinvestment premium is a gap that widens steadily.
"""

from __future__ import annotations

import math
import random
import sys

from common import run, write_figure
from simulation import SEED

MONTHS = 360
MU, SIGMA = 0.006, 0.043
Y_MEAN, PHI, Y_SD = 2.0, 0.97, 0.04  # yield in percent a year


def main() -> int:
    rng = random.Random(SEED)
    y = Y_MEAN
    price = total = 100.0
    rows = [{"series": "price", "x": 0.0, "y": price}, {"series": "total", "x": 0.0, "y": total}]
    for m in range(1, MONTHS + 1):
        y = max(0.5, Y_MEAN + PHI * (y - Y_MEAN) + Y_SD * rng.gauss(0, 1))
        r = MU - 0.5 * SIGMA**2 + SIGMA * rng.gauss(0, 1)
        price *= math.exp(r)
        total *= math.exp(r) + y / 100 / 12
        if m % 3 == 0:
            rows.append({"series": "price", "x": m / 12, "y": price})
            rows.append({"series": "total", "x": m / 12, "y": total})
    share = 1 - math.log(price / 100) / math.log(total / 100)
    print("  price %.0f, total %.0f; dividends = %.0f%% of log growth" % (price, total, share * 100))
    write_figure(
        "total-vs-price-return",
        {
            "chart": "line",
            "source": "Simulation (lognormal index with mean-reverting dividend yield, seed %d)" % SEED,
            "series_note": "%d monthly returns (shown quarterly); drift %.1f%%/month, vol %.1f%%/month, yield AR(1) around %.1f%%; both indices start at 100" % (MONTHS, MU * 100, SIGMA * 100, Y_MEAN),
            "x": {"label": "years"},
            "y": {"label": "index level (start = 100, log scale)", "type": "log"},
            "series": [
                {"key": "total", "label": "Total return"},
                {"key": "price", "label": "Price return"},
            ],
            "meta": {"seed": SEED, "months": MONTHS, "dividendShareOfLogGrowth": share},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
