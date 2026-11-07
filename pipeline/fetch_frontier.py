#!/usr/bin/env python3
"""The efficient frontier, in sample and out — Track 6, "Portfolio construction".

SIMULATED, not fetched. ASSETS assets with a known one-factor covariance and
known true means are simulated for two consecutive periods of YEARS years each.
The unconstrained mean-variance frontier is computed from the first period's
sample mean and covariance. Its weights are then held fixed and evaluated in
the second period (realised mean and volatility of the same portfolios). The
frontier that uses the true parameters is drawn for reference, and the equal-
weight portfolio is recorded in `meta`.

Closed form (Merton): with S the covariance, 1 the ones vector, a = 1'S^-1 1,
b = 1'S^-1 mu, c = mu'S^-1 mu, the minimum-variance portfolio for target mean m
has weights S^-1 (l 1 + g mu) and variance (a m^2 - 2 b m + c) / (a c - b^2).
"""

from __future__ import annotations

import math
import random
import sys

from common import run, write_figure

SEED = 20261031
ASSETS = 40
YEARS = 5
DAYS = 252 * YEARS
YEAR = 252
POINTS = 25


def inverse(m: list[list[float]]) -> list[list[float]]:
    n = len(m)
    a = [row[:] + [1.0 if i == j else 0.0 for j in range(n)] for i, row in enumerate(m)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(a[r][col]))
        a[col], a[piv] = a[piv], a[col]
        d = a[col][col]
        a[col] = [x / d for x in a[col]]
        for r in range(n):
            if r != col:
                f = a[r][col]
                if f:
                    a[r] = [x - f * y for x, y in zip(a[r], a[col])]
    return [row[n:] for row in a]


def matvec(m: list[list[float]], v: list[float]) -> list[float]:
    return [sum(x * y for x, y in zip(row, v)) for row in m]


def estimate(sample: list[list[float]]) -> tuple[list[float], list[list[float]]]:
    t, n = len(sample), len(sample[0])
    mu = [sum(day[i] for day in sample) / t for i in range(n)]
    cov = [[0.0] * n for _ in range(n)]
    for day in sample:
        d = [day[i] - mu[i] for i in range(n)]
        for i in range(n):
            for j in range(i, n):
                cov[i][j] += d[i] * d[j]
    for i in range(n):
        for j in range(i, n):
            cov[i][j] /= t - 1
            cov[j][i] = cov[i][j]
    return mu, cov


def frontier_weights(mu, cov, targets):
    inv = inverse(cov)
    ones = [1.0] * len(mu)
    si1, simu = matvec(inv, ones), matvec(inv, mu)
    a = sum(si1)
    b = sum(simu)
    c = sum(m * x for m, x in zip(mu, simu))
    den = a * c - b * b
    out = []
    for m in targets:
        lam = (c - b * m) / den
        gam = (a * m - b) / den
        out.append([lam * x + gam * y for x, y in zip(si1, simu)])
    return out


def moments(w, mu, cov):
    mean = sum(x * y for x, y in zip(w, mu))
    var = sum(x * y for x, y in zip(w, matvec(cov, w)))
    return mean * YEAR * 100, math.sqrt(var * YEAR) * 100


def main() -> int:
    rng = random.Random(SEED)
    beta = [rng.uniform(0.6, 1.4) for _ in range(ASSETS)]
    idio = [rng.uniform(0.012, 0.022) for _ in range(ASSETS)]
    true_mu = [0.0003 + 0.0002 * b + rng.gauss(0, 0.00008) for b in beta]  # daily
    market = 0.01

    true_cov = [
        [beta[i] * beta[j] * market**2 + (idio[i] ** 2 if i == j else 0.0) for j in range(ASSETS)]
        for i in range(ASSETS)
    ]

    def simulate() -> list[list[float]]:
        out = []
        for _ in range(DAYS):
            m = rng.gauss(0, market)
            out.append([true_mu[i] + beta[i] * m + rng.gauss(0, idio[i]) for i in range(ASSETS)])
        return out

    first, second = simulate(), simulate()
    mu1, cov1 = estimate(first)
    mu2, cov2 = estimate(second)

    lo = sum(mu1) / ASSETS
    targets_in = [lo + (max(mu1) * 0.6 - lo) * k / (POINTS - 1) for k in range(POINTS)]
    in_sample = frontier_weights(mu1, cov1, targets_in)

    # True frontier at the same volatility range is awkward; use the true-parameter
    # frontier over the true-mean range of the same weights' targets instead.
    true_targets = [lo + (max(true_mu) * 0.9 - lo) * k / (POINTS - 1) for k in range(POINTS)]
    true_front = frontier_weights(true_mu, true_cov, true_targets)

    rows = []
    for w in in_sample:
        r, v = moments(w, mu1, cov1)
        rows.append({"series": "insample", "x": v, "y": r})
    realised_vol_ratio = []
    for w in in_sample:
        r, v = moments(w, mu2, cov2)
        rows.append({"series": "realised", "x": v, "y": r})
    for w in true_front:
        r, v = moments(w, true_mu, true_cov)
        rows.append({"series": "true", "x": v, "y": r})
    for w, row_in in zip(in_sample, rows[:POINTS]):
        _, v2 = moments(w, mu2, cov2)
        realised_vol_ratio.append(v2 / row_in["x"])

    equal = [1.0 / ASSETS] * ASSETS
    eq_in, eq_out = moments(equal, mu1, cov1), moments(equal, mu2, cov2)

    write_figure(
        "frontier-out-of-sample",
        {
            "chart": "scatter",
            "source": "Simulation (one-factor model, seed %d)" % SEED,
            "series_note": "%d assets, two consecutive %d-year samples; unconstrained frontier from sample 1, same weights evaluated in sample 2"
            % (ASSETS, YEARS),
            "x": {"label": "annualised volatility (%)"},
            "y": {"label": "annualised mean return (%)"},
            "series": [
                {"key": "insample", "label": "In-sample frontier"},
                {"key": "realised", "label": "Same weights, next period"},
                {"key": "true", "label": "True-parameter frontier"},
            ],
            "meta": {
                "seed": SEED,
                "assets": ASSETS,
                "equalWeight": {
                    "sample1": {"returnPct": eq_in[0], "volPct": eq_in[1]},
                    "sample2": {"returnPct": eq_out[0], "volPct": eq_out[1]},
                },
                "meanRealisedToPredictedVol": sum(realised_vol_ratio) / len(realised_vol_ratio),
            },
            "data": rows,
        },
        synthetic=True,
    )
    print(f"  equal weight: sample1 {eq_in}, sample2 {eq_out}")
    print(f"  top of in-sample frontier {rows[POINTS - 1]}, realised {rows[2 * POINTS - 1]}")
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
