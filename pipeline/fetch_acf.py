#!/usr/bin/env python3
"""Autocorrelation of returns vs absolute returns — Track 3, "Volatility clustering".

SIMULATED, not fetched. 40,000 daily returns from a stochastic-volatility model
whose log-volatility is a sum of three AR(1) components (memory 5, 60 and 600
days) times an independent Gaussian shock. Returns are therefore serially
uncorrelated by construction while absolute returns inherit the slow decay of
volatility. The chart is the sample autocorrelation at lags 1-250, log lag axis.
The model has finite memory (longest component 600 days), so beyond that scale
the decay is exponential; the script does not claim a true power law.
"""

from __future__ import annotations

import random
import sys

from common import run, write_figure
from simulation import SEED, acf, multiscale_sv

N = 40000
LAGS = [1, 2, 3, 4, 5, 7, 10, 14, 20, 30, 45, 65, 90, 130, 180, 250]


def main() -> int:
    rng = random.Random(SEED)
    r = multiscale_sv(N, rng)
    a_ret = acf(r, LAGS)
    a_abs = acf([abs(v) for v in r], LAGS)
    rows = []
    for k in LAGS:
        rows.append({"series": "returns", "x": k, "y": a_ret[k]})
        rows.append({"series": "abs", "x": k, "y": a_abs[k]})
    band = 2 / N**0.5
    for k in (LAGS[0], LAGS[-1]):
        rows.append({"series": "band", "x": k, "y": band})
    print("  acf(r) max |.|: %.3f, acf(|r|) at 1/20/250: %.3f %.3f %.3f" % (max(abs(v) for v in a_ret.values()), a_abs[1], a_abs[20], a_abs[250]))
    write_figure(
        "acf-returns-vs-absreturns",
        {
            "chart": "line",
            "source": "Simulation (multi-scale stochastic volatility, seed %d)" % SEED,
            "series_note": "%d daily returns; log-vol = sum of AR(1) components with memory 5, 60, 600 days; independent Gaussian shocks" % N,
            "x": {"label": "lag (days)", "type": "log"},
            "y": {"label": "sample autocorrelation"},
            "series": [
                {"key": "returns", "label": "Returns"},
                {"key": "abs", "label": "Absolute returns"},
                {"key": "band", "label": "+2/sqrt(N) (white-noise band)"},
            ],
            "meta": {"seed": SEED, "n": N, "band": band},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
