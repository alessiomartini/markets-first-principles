#!/usr/bin/env python3
"""Price response to signed volume — Track 2, "Price formation and impact".

SIMULATED, not fetched (no trade tape). 400,000 intervals each carry a signed
net volume q (lognormal magnitude, random sign) and a price move
r = Y * sigma * sign(q) * sqrt(|q| / V) + noise, i.e. the square-root law with
Y = 0.8, plus Gaussian noise of 5x the impact at typical size. Intervals are
grouped into 25 equal-count bins of q; the chart is the mean move in each bin.
A dashed-style linear benchmark through the smallest bins is drawn for contrast.
"""

from __future__ import annotations

import math
import random
import sys

from common import run, write_figure
from simulation import SEED

N = 400000
Y, SIGMA_BP, V = 0.8, 30.0, 1.0  # impact coefficient, noise scale in bp, volume unit
BINS = 24


def main() -> int:
    rng = random.Random(SEED)
    obs = []
    for _ in range(N):
        q = math.exp(rng.gauss(-1.0, 1.0)) * (1 if rng.random() < 0.5 else -1)
        move = Y * SIGMA_BP * math.copysign(math.sqrt(abs(q) / V), q) + SIGMA_BP * 1.5 * rng.gauss(0, 1)
        obs.append((q, move))
    obs.sort()
    size = N // BINS
    pts = []
    for b in range(BINS):
        chunk = obs[b * size : (b + 1) * size]
        pts.append((sum(c[0] for c in chunk) / len(chunk), sum(c[1] for c in chunk) / len(chunk)))
    # Linear benchmark: slope from the two innermost bins either side of zero.
    inner = [p for p in pts if abs(p[0]) < 0.35]
    slope = sum(p[1] * p[0] for p in inner) / sum(p[0] ** 2 for p in inner)
    rows = [{"series": "impact", "x": q, "y": m} for q, m in pts]
    lo, hi = pts[0][0], pts[-1][0]
    rows += [{"series": "linear", "x": x, "y": slope * x} for x in (lo, 0.0, hi)]
    print("  slope near zero %.1f bp/unit; outer bins: %.1f, %.1f bp" % (slope, pts[0][1], pts[-1][1]))
    write_figure(
        "impact-curve",
        {
            "chart": "line",
            "source": "Simulation (square-root impact law with noise, seed %d)" % SEED,
            "series_note": "%d intervals; move = %.1f*%.0fbp*sign(q)*sqrt(|q|/V) + Gaussian noise (sd %.0f bp); %d equal-count bins of signed volume" % (N, Y, SIGMA_BP, SIGMA_BP * 1.5, BINS),
            "x": {"label": "signed volume q (units of typical interval volume)"},
            "y": {"label": "mean price move (bp)"},
            "series": [
                {"key": "impact", "label": "Binned mean response"},
                {"key": "linear", "label": "Linear benchmark (slope near zero)"},
            ],
            "meta": {"seed": SEED, "n": N, "bins": BINS, "linearSlope": slope},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
