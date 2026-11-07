#!/usr/bin/env python3
"""Factor-neutral against raw returns of one signal — Track 7, "From research to P&L".

SIMULATED, not fetched. N stocks, DAYS days. Stock returns follow
r_i = b_i*M + c_i*F + e_i with a market factor M and a style factor F, loadings
b_i ~ N(1, 0.3), c_i ~ N(0, 1). The signal is mostly a disguised exposure: it
is built from b_i and c_i plus a small genuine component that predicts e_i.

Raw portfolio: weights proportional to the cross-sectionally standardised
signal, scaled to unit gross. Neutralised portfolio: the same weights with the
projection onto (1, b, c) removed, so it carries no net, beta or style
exposure, rescaled to unit gross. Loadings are known to the simulation; a real
risk model would estimate them, which is the main thing this toy leaves out.
"""

from __future__ import annotations

import math
import random
import statistics
import sys

from common import run, write_figure

SEED = 20261031
STOCKS = 300
DAYS = 2520
MARKET_SD = 0.01
STYLE_SD = 0.005
IDIO_SD = 0.015
TRUE_ALPHA = 0.00006  # daily predictable part of idiosyncratic return, per unit of genuine signal
STEP = 21
YEAR = 252


def solve(a: list[list[float]], b: list[float]) -> list[float]:
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(m[r][col]))
        m[col], m[piv] = m[piv], m[col]
        for r in range(n):
            if r != col:
                f = m[r][col] / m[col][col]
                for k in range(col, n + 1):
                    m[r][k] -= f * m[col][k]
    return [m[i][n] / m[i][i] for i in range(n)]


def gross_one(w: list[float]) -> list[float]:
    g = sum(abs(x) for x in w)
    return [x / g for x in w]


def main() -> int:
    rng = random.Random(SEED)
    beta = [rng.gauss(1, 0.3) for _ in range(STOCKS)]
    style = [rng.gauss(0, 1) for _ in range(STOCKS)]
    genuine = [rng.gauss(0, 1) for _ in range(STOCKS)]
    raw_signal = [0.6 * (beta[i] - 1) / 0.3 + 0.6 * style[i] + 0.35 * genuine[i] for i in range(STOCKS)]
    mean = statistics.fmean(raw_signal)
    sd = statistics.pstdev(raw_signal)
    raw_w = gross_one([(s - mean) / sd for s in raw_signal])

    cols = [[1.0] * STOCKS, beta, style]
    gram = [[sum(x * y for x, y in zip(a, b)) for b in cols] for a in cols]
    coef = solve(gram, [sum(x * y for x, y in zip(c, raw_w)) for c in cols])
    neutral_w = gross_one([raw_w[i] - sum(coef[k] * cols[k][i] for k in range(3)) for i in range(STOCKS)])

    def exposure(w: list[float]) -> dict[str, float]:
        return {
            "net": sum(w),
            "beta": sum(x * b for x, b in zip(w, beta)),
            "style": sum(x * c for x, c in zip(w, style)),
        }

    raw_r, neu_r = [], []
    for _ in range(DAYS):
        mkt, sty = rng.gauss(0, MARKET_SD), rng.gauss(0, STYLE_SD)
        r = [
            beta[i] * mkt + style[i] * sty + TRUE_ALPHA * genuine[i] + rng.gauss(0, IDIO_SD)
            for i in range(STOCKS)
        ]
        raw_r.append(sum(w * x for w, x in zip(raw_w, r)))
        neu_r.append(sum(w * x for w, x in zip(neutral_w, r)))

    rows, stats = [], {}
    for key, rets in (("raw", raw_r), ("neutral", neu_r)):
        running, curve = 0.0, [0.0]
        for x in rets:
            running += x
            curve.append(running * 100)
        peak, worst = 0.0, 0.0
        for v in curve:
            peak = max(peak, v)
            worst = min(worst, v - peak)
        stats[key] = {
            "annualVolPct": statistics.pstdev(rets) * math.sqrt(YEAR) * 100,
            "sharpe": statistics.fmean(rets) / statistics.pstdev(rets) * math.sqrt(YEAR),
            "maxDrawdownPct": worst,
        }
        rows += [{"series": key, "x": d, "y": curve[d]} for d in range(0, DAYS + 1, STEP)]

    write_figure(
        "neutralised-vs-raw",
        {
            "chart": "line",
            "source": "Simulation (two-factor model with a disguised signal, seed %d)" % SEED,
            "series_note": "%d stocks, %d days; loadings known to the simulation, a real risk model would estimate them"
            % (STOCKS, DAYS),
            "x": {"label": "trading day"},
            "y": {"label": "cumulative return (%, sum of daily returns at unit gross exposure)"},
            "series": [
                {"key": "raw", "label": "Raw long-short"},
                {"key": "neutral", "label": "Factor-neutral"},
            ],
            "meta": {
                "seed": SEED,
                "exposuresRaw": exposure(raw_w),
                "exposuresNeutral": exposure(neutral_w),
                "stats": stats,
            },
            "data": rows,
        },
        synthetic=True,
    )
    print("  raw", stats["raw"], "\n  neutral", stats["neutral"])
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
