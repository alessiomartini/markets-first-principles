#!/usr/bin/env python3
"""Information coefficient decay for short-term reversal — Track 7, "Signals and alpha".

SIMULATED, not fetched. Cross-section of N stocks over DAYS days. Each daily
return is r = e + (m_t - m_{t-1}) where e is white noise and m is a transient
price-pressure component, AR(1) with persistence PHI, that fades back. Hence
yesterday's loser tends to rebound, by an amount that decays with the horizon.

Signal: minus the day-t return. IC(h) is the mean over days of the Spearman
rank correlation between the signal at t and the return at t+h, h = 1..10,
with a band of +/- 2 standard errors across days. The script reports the
realised values; it does not assume a closed form.
"""

from __future__ import annotations

import math
import random
import statistics
import sys

from common import run, write_figure

SEED = 20261031
STOCKS = 200
DAYS = 1260
PHI = 0.6
NOISE_SD = 0.012
TRANSIENT_SD = 0.0045
HORIZONS = range(1, 11)


def ranks(values: list[float]) -> list[float]:
    order = sorted(range(len(values)), key=values.__getitem__)
    out = [0.0] * len(values)
    for rank, i in enumerate(order):
        out[i] = rank
    return out


def corr(x: list[float], y: list[float]) -> float:
    mx, my = statistics.fmean(x), statistics.fmean(y)
    sxy = sum((a - mx) * (b - my) for a, b in zip(x, y))
    sxx = sum((a - mx) ** 2 for a in x)
    syy = sum((b - my) ** 2 for b in y)
    return sxy / math.sqrt(sxx * syy)


def main() -> int:
    rng = random.Random(SEED)
    innovation = TRANSIENT_SD * math.sqrt(1 - PHI**2)
    m = [0.0] * STOCKS
    returns = []  # returns[t][i]
    for _ in range(DAYS):
        day = []
        for i in range(STOCKS):
            new = PHI * m[i] + rng.gauss(0, innovation)
            day.append(rng.gauss(0, NOISE_SD) + new - m[i])
            m[i] = new
        returns.append(day)

    rows, summary = [], {}
    for h in HORIZONS:
        ics = []
        for t in range(DAYS - h):
            signal = ranks([-r for r in returns[t]])
            ics.append(corr(signal, ranks(returns[t + h])))
        mean = statistics.fmean(ics)
        se = statistics.stdev(ics) / math.sqrt(len(ics))
        summary[h] = {"ic": mean, "se": se}
        rows += [
            {"series": "ic", "x": h, "y": mean},
            {"series": "upper", "x": h, "y": mean + 2 * se},
            {"series": "lower", "x": h, "y": mean - 2 * se},
        ]
        print(f"  h={h}: IC {mean:.4f} +/- {2 * se:.4f}")

    write_figure(
        "ic-decay",
        {
            "chart": "line",
            "source": "Simulation (transient price-pressure model, seed %d)" % SEED,
            "series_note": "%d stocks, %d days; return = noise + change in an AR(1) transient (phi=%.1f); signal = minus yesterday's return; Spearman rank IC"
            % (STOCKS, DAYS, PHI),
            "x": {"label": "forecast horizon (days after the signal)"},
            "y": {"label": "mean rank information coefficient"},
            "series": [
                {"key": "ic", "label": "Mean IC"},
                {"key": "upper", "label": "+2 s.e."},
                {"key": "lower", "label": "-2 s.e."},
            ],
            "meta": {"seed": SEED, "phi": PHI, "byHorizon": summary},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
