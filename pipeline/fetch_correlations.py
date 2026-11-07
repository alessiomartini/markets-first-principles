#!/usr/bin/env python3
"""Eigenvalue spectrum against Marchenko-Pastur — Track 3, "Correlations".

SIMULATED, not fetched. N = 100 assets, T = 1000 days. Returns follow a market
factor plus three sector factors plus idiosyncratic noise (loadings are inputs).
The correlation matrix is diagonalised with a cyclic Jacobi sweep. The chart is
a histogram (density) of the eigenvalues below 4, against the Marchenko-Pastur
density for q = N/T; the eigenvalues above that range, which hold the factors,
are listed in the payload meta. Sector structure here is put in by hand.
"""

from __future__ import annotations

import math
import random
import sys

from common import run, write_figure
from simulation import SEED

N, T = 100, 1000
SECTORS = 3
BINS = 40
X_MAX = 4.0


def jacobi_eigenvalues(a, sweeps=30):
    n = len(a)
    a = [row[:] for row in a]
    for _ in range(sweeps):
        off = sum(a[i][j] ** 2 for i in range(n) for j in range(i + 1, n))
        if off < 1e-18:
            break
        for p in range(n - 1):
            for q in range(p + 1, n):
                if abs(a[p][q]) < 1e-14:
                    continue
                theta = (a[q][q] - a[p][p]) / (2 * a[p][q])
                t = (1 if theta >= 0 else -1) / (abs(theta) + math.sqrt(theta * theta + 1))
                c = 1 / math.sqrt(t * t + 1)
                s = t * c
                for k in range(n):
                    akp, akq = a[k][p], a[k][q]
                    a[k][p], a[k][q] = c * akp - s * akq, s * akp + c * akq
                for k in range(n):
                    apk, aqk = a[p][k], a[q][k]
                    a[p][k], a[q][k] = c * apk - s * aqk, s * apk + c * aqk
    return sorted((a[i][i] for i in range(n)), reverse=True)


def main() -> int:
    rng = random.Random(SEED)
    market = [0.5 + 0.3 * rng.random() for _ in range(N)]
    sector = [i * SECTORS // N for i in range(N)]
    x = [[0.0] * T for _ in range(N)]
    for t in range(T):
        m = rng.gauss(0, 1)
        f = [rng.gauss(0, 1) for _ in range(SECTORS)]
        for i in range(N):
            x[i][t] = market[i] * m + 0.5 * f[sector[i]] + rng.gauss(0, 1)
    z = []
    for row in x:
        mu = sum(row) / T
        sd = math.sqrt(sum((v - mu) ** 2 for v in row) / T)
        z.append([(v - mu) / sd for v in row])
    corr = [[sum(z[i][t] * z[j][t] for t in range(T)) / T for j in range(N)] for i in range(N)]
    eig = jacobi_eigenvalues(corr)

    q = N / T
    lo, hi = (1 - math.sqrt(q)) ** 2, (1 + math.sqrt(q)) ** 2
    width = X_MAX / BINS
    rows = []
    for b in range(BINS):
        c = (b + 0.5) * width
        count = sum(1 for v in eig if b * width <= v < (b + 1) * width)
        rows.append({"series": "empirical", "x": c, "y": count / N / width})
        mp = math.sqrt((hi - c) * (c - lo)) / (2 * math.pi * q * c) if lo < c < hi else 0.0
        rows.append({"series": "mp", "x": c, "y": mp})
    above = [v for v in eig if v > hi]
    print(f"  MP edges [{lo:.3f}, {hi:.3f}]; eigenvalues above upper edge: {[round(v, 2) for v in above]}")
    write_figure(
        "eigenvalue-spectrum",
        {
            "chart": "line",
            "source": "Simulation (market + 3 sector factors + noise, seed %d)" % SEED,
            "series_note": "N=%d assets, T=%d days (q=%.2f); correlation matrix of simulated returns; factor loadings are inputs" % (N, T, q),
            "x": {"label": "eigenvalue λ (values above %.0f not shown)" % X_MAX},
            "y": {"label": "density"},
            "series": [
                {"key": "empirical", "label": "Simulated correlation matrix"},
                {"key": "mp", "label": "Marchenko-Pastur (pure noise)"},
            ],
            "meta": {"seed": SEED, "q": q, "mpEdges": [lo, hi], "eigenvaluesAboveUpperEdge": above},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
