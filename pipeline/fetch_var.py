#!/usr/bin/env python3
"""VaR exceedances by year — Track 5, "Risk measures".

SIMULATED, not fetched. 25 years of daily returns from a GJR-GARCH model with
two exogenous volatility shocks (a 40-day stress at year 8 and another at year
20, loosely placed where the page's real episodes fall; the dates and sizes are
illustrative). Each day's one-day 99% VaR is the empirical 1% quantile of the
previous 250 returns (historical simulation); a breach is a loss beyond it.
The chart counts breaches per year against the nominal 2.5.
"""

from __future__ import annotations

import random
import sys

from common import run, write_figure
from simulation import SEED, gjr_garch

YEARS = 25
DAYS_PER_YEAR = 250
WINDOW = 250
SHOCKS = {
    **{d: 25.0 for d in range(8 * 250 + 100, 8 * 250 + 140)},
    **{d: 40.0 for d in range(20 * 250 + 50, 20 * 250 + 90)},
}


def main() -> int:
    rng = random.Random(SEED)
    rets, _ = gjr_garch(YEARS * DAYS_PER_YEAR, rng, alpha=0.03, gamma=0.13, beta=0.90, shocks=SHOCKS)
    counts = [0] * YEARS
    worst = [0.0] * YEARS
    for t in range(WINDOW, len(rets)):
        window = sorted(rets[t - WINDOW : t])
        var99 = -window[int(0.01 * WINDOW)]
        if -rets[t] > var99:
            y = t // DAYS_PER_YEAR
            counts[y] += 1
            worst[y] = max(worst[y], -rets[t] / var99)
    expected = 0.01 * DAYS_PER_YEAR
    rows = []
    for y in range(1, YEARS):
        rows.append({"series": "breaches", "x": y + 1, "y": counts[y]})
        rows.append({"series": "nominal", "x": y + 1, "y": expected})
    print("  breaches per year:", counts[1:])
    write_figure(
        "var-exceedances",
        {
            "chart": "line",
            "source": "Simulation (GJR-GARCH with two stress windows, seed %d)" % SEED,
            "series_note": "%d years of daily returns; 1-day 99%% historical-simulation VaR on a trailing %d-day window; stress windows are exogenous and illustrative"
            % (YEARS, WINDOW),
            "x": {"label": "simulated year"},
            "y": {"label": "VaR breaches in the year"},
            "series": [
                {"key": "breaches", "label": "Breaches"},
                {"key": "nominal", "label": "Nominal (1% of days)"},
            ],
            "meta": {"seed": SEED, "total": sum(counts[1:]), "maxYear": max(counts), "worstBreachOverVar": max(worst)},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
