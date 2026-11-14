#!/usr/bin/env python3
"""Diversification and its floor — Track 4, "Portfolio construction".

SCHEMATIC, not fetched and not simulated: the volatility of an equal-weight
portfolio of N assets that each have volatility 20% and a common pairwise
correlation rho:

    sigma_p = sigma * sqrt(1/N + (1 - 1/N) * rho)

With rho = 0 volatility falls like 1/sqrt(N) towards zero; with rho > 0 it
levels off at sigma * sqrt(rho), the part no number of assets removes. The
inputs are illustrative, not estimated. Deterministic.
"""

from __future__ import annotations

import math
import sys

from common import run, write_figure

SIGMA = 20.0
RHOS = [0.0, 0.3, 0.6]
NS = list(range(1, 51))


def main() -> int:
    rows = []
    for rho in RHOS:
        for n in NS:
            rows.append({"series": "rho%d" % round(rho * 10), "x": n, "y": SIGMA * math.sqrt(1 / n + (1 - 1 / n) * rho)})

    write_figure(
        "diversification-vs-n",
        {
            "chart": "line",
            "source": "Schematic (equal-weight portfolio volatility formula; no market data)",
            "series_note": "each asset volatility %g%%, common pairwise correlation rho, equal weights" % SIGMA,
            "x": {"label": "number of assets, N"},
            "y": {"label": "portfolio volatility (% a year)"},
            "series": [{"key": "rho%d" % round(rho * 10), "label": "correlation %.1f" % rho} for rho in RHOS],
            "meta": {"assetVolPct": SIGMA},
            "data": rows,
        },
        synthetic=True,
    )
    return 0

if __name__ == "__main__":
    sys.exit(run(main))
