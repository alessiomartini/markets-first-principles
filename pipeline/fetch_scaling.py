#!/usr/bin/env python3
"""Kurtosis against aggregation scale — Track 3, "Scale invariance".

SIMULATED, not fetched. 262,144 daily returns from the multi-scale stochastic
volatility model (see simulation.py), summed over non-overlapping blocks of
1, 2, 4, ... 256 days. The chart plots excess kurtosis against block size on
log-log axes, with the benchmark for independent returns: excess kurtosis
divided by n. The measured values are whatever the simulation gives.
"""

from __future__ import annotations

import random
import sys

from common import run, write_figure
from simulation import SEED, multiscale_sv

N = 2**18
SCALES = [1, 2, 4, 8, 16, 32, 64, 128, 256]


def excess_kurtosis(x):
    n = len(x)
    m = sum(x) / n
    m2 = sum((v - m) ** 2 for v in x) / n
    m4 = sum((v - m) ** 4 for v in x) / n
    return m4 / m2**2 - 3


def main() -> int:
    rng = random.Random(SEED)
    r = multiscale_sv(N, rng)
    k1 = excess_kurtosis(r)
    rows, measured = [], {}
    for n in SCALES:
        agg = [sum(r[i : i + n]) for i in range(0, N - n + 1, n)]
        k = excess_kurtosis(agg)
        measured[n] = k
        rows.append({"series": "measured", "x": n, "y": k})
        rows.append({"series": "iid", "x": n, "y": k1 / n})
        print(f"  n={n}: excess kurtosis {k:.3f} (independent benchmark {k1 / n:.3f})")
    write_figure(
        "kurtosis-vs-scale",
        {
            "chart": "line",
            "source": "Simulation (multi-scale stochastic volatility, seed %d)" % SEED,
            "series_note": "%d daily returns summed over non-overlapping blocks; benchmark = 1-day excess kurtosis / n (independent increments)" % N,
            "x": {"label": "aggregation window n (days)", "type": "log"},
            "y": {"label": "excess kurtosis", "type": "log"},
            "series": [
                {"key": "measured", "label": "Simulated returns"},
                {"key": "iid", "label": "Independent returns: 1/n"},
            ],
            "meta": {"seed": SEED, "n": N, "excessKurtosisByScale": measured},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
