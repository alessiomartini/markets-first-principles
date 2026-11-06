#!/usr/bin/env python3
"""Growth rate against betting fraction — Track 5, "Position sizing".

This figure is SIMULATED, not fetched. The page describes it as a real index;
until the Stooq version exists, this script draws 20 years of daily returns from
a fat-tailed model with a known drift and volatility, so the shape of the curve
is reproducible offline and its analytic peak is known in advance.

Model: r_t = mu + sigma * t_nu / sqrt(nu / (nu - 2)), Student-t with nu = 4 so
the variance is sigma^2 exactly. For a fraction f of capital held in the asset
the per-day log growth is g(f) = mean(log(1 + f * r_t)). For small returns
g(f) ~ mu*f - sigma^2*f^2/2, peaking at f* = mu / sigma^2 and crossing zero at
2 f*. The script plots the empirical g over the full sample and over its two
non-overlapping halves, so the instability of the maximiser is visible.
"""

from __future__ import annotations

import math
import random
import sys

from common import run, write_figure

SEED = 20261031
DAYS = 5040  # 20 years of 252 trading days
MU = 0.0003  # per day (about 7.6% a year)
SIGMA = 0.0105  # per day (about 16.7% a year)
NU = 4.0
YEAR = 252
FRACTIONS = [i * 0.1 for i in range(0, 101)]  # 0.0 .. 10.0


def student_t(rng: random.Random, nu: float) -> float:
    return rng.gauss(0, 1) / math.sqrt(rng.gammavariate(nu / 2, 2 / nu))


def growth(returns: list[float], f: float) -> float:
    # f * r must stay above -1 or the position is wiped out (log undefined).
    total = 0.0
    for r in returns:
        wealth = 1 + f * r
        if wealth <= 0:
            return float("-inf")
        total += math.log(wealth)
    return total / len(returns) * YEAR


def main() -> int:
    rng = random.Random(SEED)
    scale = SIGMA / math.sqrt(NU / (NU - 2))
    returns = [MU + scale * student_t(rng, NU) for _ in range(DAYS)]

    half = DAYS // 2
    samples = [
        ("full", "Full sample (20 y)", returns),
        ("first", "First 10 y", returns[:half]),
        ("second", "Second 10 y", returns[half:]),
    ]

    rows = []
    maximisers = {}
    for key, _label, sample in samples:
        best_f, best_g = 0.0, 0.0
        for f in FRACTIONS:
            g = growth(sample, f)
            if not math.isfinite(g):
                continue
            rows.append({"series": key, "x": f, "y": g * 100})
            if g > best_g:
                best_f, best_g = f, g
        maximisers[key] = {"fStar": best_f, "peakGrowthPct": best_g * 100}

    write_figure(
        "kelly-curve",
        {
            "chart": "line",
            "source": "Simulation (Student-t, seed %d)" % SEED,
            "series_note": "simulated daily returns, mu=%.4f sigma=%.4f nu=%g, %d days; analytic peak f*=mu/sigma^2=%.2f"
            % (MU, SIGMA, NU, DAYS, MU / SIGMA**2),
            "x": {"label": "fraction of capital held in the asset, f"},
            "y": {"label": "long-run growth rate (% per year)"},
            "series": [{"key": key, "label": label} for key, label, _ in samples],
            "meta": {"seed": SEED, "analyticFStar": MU / SIGMA**2, "empirical": maximisers},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
