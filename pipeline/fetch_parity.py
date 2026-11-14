#!/usr/bin/env python3
"""How tightly put-call parity holds — Track 4, "No-arbitrage and replication".

SIMULATED, not fetched (no CBOE chain). European call and put prices come from
Black-Scholes with S = 5000, r = 4%, q = 1.4%, T = 30 days and a smile
sigma(K) = 0.16 + 0.35*(ln(K/F))^2 - 0.1*ln(K/F). Each quote is the model price
plus noise whose scale is the half-spread, which grows with distance from the
money: half-spread = 0.25 + 12*|ln(K/F)| index points. Parity deviation is
(C - P) - (S*exp(-qT) - K*exp(-rT)); with the same smile vol on both legs it is
zero in theory, so what the chart shows is quote noise. The +/- half-spread
band is drawn for scale.
"""

from __future__ import annotations

import math
import random
import sys

from common import run, write_figure
from simulation import SEED

S, R, Q, T = 5000.0, 0.04, 0.014, 30 / 365
STRIKES = list(range(4600, 5401, 25))


def ncdf(x):
    return 0.5 * math.erfc(-x / math.sqrt(2))


def bs(kind, k, vol):
    d1 = (math.log(S / k) + (R - Q + 0.5 * vol**2) * T) / (vol * math.sqrt(T))
    d2 = d1 - vol * math.sqrt(T)
    if kind == "c":
        return S * math.exp(-Q * T) * ncdf(d1) - k * math.exp(-R * T) * ncdf(d2)
    return k * math.exp(-R * T) * ncdf(-d2) - S * math.exp(-Q * T) * ncdf(-d1)


def main() -> int:
    rng = random.Random(SEED)
    fwd = S * math.exp((R - Q) * T)
    rows, worst = [], 0.0
    for k in STRIKES:
        m = math.log(k / fwd)
        vol = 0.16 + 0.35 * m**2 - 0.1 * m
        half = 0.25 + 12 * abs(m)
        c = bs("c", k, vol) + half * rng.uniform(-1, 1)
        p = bs("p", k, vol) + half * rng.uniform(-1, 1)
        dev = (c - p) - (S * math.exp(-Q * T) - k * math.exp(-R * T))
        worst = max(worst, abs(dev) / (2 * half))
        rows.append({"series": "dev", "x": k, "y": dev})
        rows.append({"series": "upper", "x": k, "y": 2 * half})
        rows.append({"series": "lower", "x": k, "y": -2 * half})
    print("  max |deviation| / (call+put half-spreads): %.2f" % worst)
    write_figure(
        "put-call-parity",
        {
            "chart": "line",
            "source": "Simulation (Black-Scholes quotes with noise, seed %d)" % SEED,
            "series_note": "S=%.0f r=%.0f%% q=%.1f%% T=30d, smile vol; quote noise uniform within the half-spread (0.25 + 12|ln(K/F)| points); band = sum of the two legs' half-spreads" % (S, R * 100, Q * 100),
            "x": {"label": "strike"},
            "y": {"label": "(C - P) minus forward-implied value (index points)"},
            "series": [
                {"key": "dev", "label": "Parity gap"},
                {"key": "upper", "label": "+ combined half-spreads"},
                {"key": "lower", "label": "- combined half-spreads"},
            ],
            "meta": {"seed": SEED, "maxGapOverBand": worst},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
