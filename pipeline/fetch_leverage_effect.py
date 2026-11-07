#!/usr/bin/env python3
"""Leverage correlation — Track 3, "The leverage effect".

SIMULATED, not fetched. Two 200,000-day GJR-GARCH series with the same
persistence (0.98) and daily volatility: one with an asymmetric response to bad
news (alpha 0.02, gamma 0.12: the "equity-like" case) and one symmetric (alpha
0.08, gamma 0: the "FX-like" case). Statistic: L(tau) = corr(r_t, r_{t+tau}^2)
for tau from -20 to +40 days, so both directions of lag are shown. The
asymmetry is put into the model, so the figure illustrates what the statistic
looks like when the effect exists and when it does not, not that it does.
"""

from __future__ import annotations

import random
import sys

from common import run, write_figure
from simulation import SEED, gjr_garch

N = 200000
LAGS = [-20, -15, -10, -7, -5, -3, -2, -1, 1, 2, 3, 5, 7, 10, 15, 20, 30, 40]


def lead_lag(r, tau):
    r2 = [v * v for v in r]
    n = len(r)
    mr, m2 = sum(r) / n, sum(r2) / n
    sr = (sum((v - mr) ** 2 for v in r) / n) ** 0.5
    s2 = (sum((v - m2) ** 2 for v in r2) / n) ** 0.5
    idx = range(max(0, -tau), min(n, n - tau))
    return sum((r[t] - mr) * (r2[t + tau] - m2) for t in idx) / len(idx) / (sr * s2)


def main() -> int:
    rows, meta = [], {}
    for key, alpha, gamma in (("asym", 0.02, 0.12), ("sym", 0.08, 0.0)):
        r, _ = gjr_garch(N, random.Random(SEED), alpha=alpha, gamma=gamma, beta=0.90)
        vals = {tau: lead_lag(r, tau) for tau in LAGS}
        rows += [{"series": key, "x": tau, "y": v} for tau, v in vals.items()]
        meta[key] = {"corrAtLag1": vals[1], "corrAtLagMinus1": vals[-1], "corrAtLag10": vals[10]}
        print(f"  {key}: L(+1) {vals[1]:.3f}, L(-1) {vals[-1]:.3f}, L(+10) {vals[10]:.3f}")
    write_figure(
        "leverage-correlation",
        {
            "chart": "line",
            "source": "Simulation (GJR-GARCH, seed %d)" % SEED,
            "series_note": "%d days each; asymmetric case alpha=0.02, gamma=0.12; symmetric case alpha=0.08, gamma=0; same persistence 0.98; the asymmetry is an input" % N,
            "x": {"label": "lag tau (days; positive = volatility after the return)"},
            "y": {"label": "corr(r_t, r²_{t+tau})"},
            "series": [
                {"key": "asym", "label": "Asymmetric (equity-like)"},
                {"key": "sym", "label": "Symmetric (no leverage)"},
            ],
            "meta": {"seed": SEED, "n": N, **meta},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
