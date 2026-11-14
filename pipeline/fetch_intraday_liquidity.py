#!/usr/bin/env python3
"""Spread and depth by time of day — Track 2, "Liquidity".

SIMULATED, not fetched (no klines or book snapshots). A 24-hour market where
activity follows a smooth daily cycle a(h) = 1 + 0.6*cos(2*pi*(h - 14)/24)
(busiest 14:00 UTC). Quoted spread scales as a^-0.8 and top-of-book depth as
a^0.7, each times a lognormal day-by-day shock (sd 0.2 on the spread, 0.15 on
depth), averaged over 60 simulated days. Both series are shown relative to their
own 24-hour mean so they share one axis; spread is high exactly when depth is
low, as the cycle implies by construction.
"""

from __future__ import annotations

import math
import random
import sys

from common import run, write_figure
from simulation import SEED

DAYS = 60


def main() -> int:
    rng = random.Random(SEED)
    spread = [0.0] * 24
    depth = [0.0] * 24
    for _ in range(DAYS):
        for h in range(24):
            a = 1 + 0.6 * math.cos(2 * math.pi * (h - 14) / 24)
            spread[h] += a**-0.8 * math.exp(0.2 * rng.gauss(0, 1)) / DAYS
            depth[h] += a**0.7 * math.exp(0.15 * rng.gauss(0, 1)) / DAYS
    ms, md = sum(spread) / 24, sum(depth) / 24
    rows = []
    for h in range(24):
        rows.append({"series": "spread", "x": h, "y": spread[h] / ms})
        rows.append({"series": "depth", "x": h, "y": depth[h] / md})
    corr = _corr(spread, depth)
    print("  corr(spread, depth) across hours: %.2f" % corr)
    write_figure(
        "intraday-liquidity",
        {
            "chart": "line",
            "source": "Simulation (daily activity cycle, seed %d)" % SEED,
            "series_note": "%d simulated days; spread ~ a^-0.8, depth ~ a^0.7 with a = 1+0.6cos(2pi(h-14)/24), lognormal daily shocks; each series divided by its 24-hour mean" % DAYS,
            "x": {"label": "hour of day (UTC)"},
            "y": {"label": "relative to 24-hour mean"},
            "series": [
                {"key": "spread", "label": "Quoted spread"},
                {"key": "depth", "label": "Top-of-book depth"},
            ],
            "meta": {"seed": SEED, "days": DAYS, "correlation": corr},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


def _corr(a, b):
    ma, mb = sum(a) / len(a), sum(b) / len(b)
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    return num / math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))


if __name__ == "__main__":
    sys.exit(run(main))
