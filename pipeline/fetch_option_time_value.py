#!/usr/bin/env python3
"""Time value of a call against moneyness — Track 1, "Options".

SCHEMATIC, not fetched and not simulated: the Black-Scholes value of a European
call minus its intrinsic value max(S - K, 0), evaluated on a grid of underlying
prices. Strike K = 100, volatility 20% a year, interest rate and dividends set
to zero so that the only thing that changes between the curves is the time left.
There is no randomness and no market data; the inputs are illustrative.
Deterministic.
"""

from __future__ import annotations

import math
import sys

from common import run, write_figure

STRIKE = 100.0
SIGMA = 0.20
EXPIRIES = [(1.0, "1 year"), (0.25, "3 months"), (1 / 12, "1 month")]
GRID = [75.0 + i * 1.0 for i in range(0, 51)]  # 75 .. 125


def ncdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def call(s: float, t: float) -> float:
    vol = SIGMA * math.sqrt(t)
    d1 = (math.log(s / STRIKE) + 0.5 * vol * vol) / vol
    return s * ncdf(d1) - STRIKE * ncdf(d1 - vol)


def main() -> int:
    rows = []
    for t, label in EXPIRIES:
        key = "t%d" % round(t * 365)
        for s in GRID:
            rows.append({"series": key, "x": s, "y": call(s, t) - max(s - STRIKE, 0.0)})

    write_figure(
        "option-time-value",
        {
            "chart": "line",
            "source": "Schematic (Black-Scholes formula minus intrinsic value; no market data)",
            "series_note": "European call, strike K=%g, volatility %g%% a year, zero rates and dividends" % (STRIKE, SIGMA * 100),
            "x": {"label": "underlying price today, S"},
            "y": {"label": "time value of a call (price units)"},
            "series": [{"key": "t%d" % round(t * 365), "label": label} for t, label in EXPIRIES],
            "meta": {"strike": STRIKE, "volatility": SIGMA},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
