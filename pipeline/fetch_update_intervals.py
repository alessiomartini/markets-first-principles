#!/usr/bin/env python3
"""Time between consecutive book updates — Track 2, "Latency and the arms race".

SIMULATED, not fetched (no WebSocket capture). 200,000 inter-arrival gaps from a
bursty point process: each gap is an Exp(1) draw times a slowly varying activity
level exp(z), where z is an AR(1) process (phi = 0.995, stationary sd 1.4). Quiet
and busy stretches therefore mix, and the gap distribution spans orders of
magnitude. The chart is the survival function P(gap > t) on log-log axes against
the exponential (Poisson) benchmark with the same mean. The model has a finite
memory, so the claim is "no single scale at this range", not a true power law.
"""

from __future__ import annotations

import math
import random
import sys

from common import run, write_figure
from simulation import SEED

N = 200000
MEAN_MS = 5.0  # target mean gap, milliseconds
PHI = 0.995
Z_SD = 1.4
POINTS = 60


def main() -> int:
    rng = random.Random(SEED)
    z = rng.gauss(0, Z_SD)
    innov = Z_SD * math.sqrt(1 - PHI**2)
    raw = []
    for _ in range(N):
        z = PHI * z + innov * rng.gauss(0, 1)
        raw.append(rng.expovariate(1.0) * math.exp(z))
    scale = MEAN_MS / (sum(raw) / N)
    gaps = sorted(g * scale for g in raw)
    mean = sum(gaps) / N

    lo, hi = gaps[int(N * 0.001)], gaps[-1] / 1.5
    curve, ref = [], []
    j = 0
    for i in range(POINTS):
        t = lo * (hi / lo) ** (i / (POINTS - 1))
        while j < N and gaps[j] <= t:
            j += 1
        s = (N - j) / N
        if s > 0:
            curve.append({"series": "gaps", "x": t, "y": s})
        ref.append({"x": t, "y": math.exp(-t / mean)})
    print("  mean %.2f ms, median %.2f ms, p99 %.1f ms, max %.0f ms" % (mean, gaps[N // 2], gaps[int(N * 0.99)], gaps[-1]))
    write_figure(
        "update-intervals",
        {
            "chart": "loglog",
            "source": "Simulation (bursty arrivals, AR(1) activity level, seed %d)" % SEED,
            "series_note": "%d gaps; Exp(1) times exp(z), z AR(1) phi=%.3f sd=%.1f; rescaled to a %.0f ms mean" % (N, PHI, Z_SD, MEAN_MS),
            "x": {"label": "gap between updates t (ms)", "type": "log"},
            "y": {"label": "P(gap > t)", "type": "log"},
            "series": [{"key": "gaps", "label": "Simulated gaps"}],
            "reference": [r for r in ref if r["y"] > 1e-6],
            "referenceLabel": "Poisson (exponential)",
            "meta": {"seed": SEED, "n": N, "meanMs": mean, "medianMs": gaps[N // 2]},
            "data": curve,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
