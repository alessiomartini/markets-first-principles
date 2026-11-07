#!/usr/bin/env python3
"""Equity curve as turnover rises — Track 7, "Costs".

SIMULATED, not fetched. The page describes one real signal at several holding
periods with an impact model from Track 2; until that exists, this script
builds a toy with the same structure and a known answer.

Model: a latent forecast a_t follows an AR(1) with persistence PHI and the
asset's daily return is r_t = a_t + noise. The trader sees s_t = a_t + noise
and holds position clip(s / SD, -1, 1), re-set every h days (h = 1, 5, 21):
slower versions trade less but act on stale forecasts. Each unit of position
changed costs a half-spread (HALF_SPREAD) plus square-root-style impact
(IMPACT * |trade|^1.5). All numbers are illustrative, not calibrated.
"""

from __future__ import annotations

import math
import random
import sys

from common import run, write_figure

SEED = 20261031
DAYS = 2520  # 10 years
PHI = 0.85
FORECAST_SD = 0.0007  # daily sd of the true forecast
NOISE_SD = 0.01  # daily idiosyncratic return noise
SIGNAL_NOISE_SD = 0.0007
HALF_SPREAD = 0.0004  # 4 bp per unit of position traded
IMPACT = 0.0008
HORIZONS = [1, 5, 21]
STEP = 21


def main() -> int:
    rng = random.Random(SEED)
    innovation = FORECAST_SD * math.sqrt(1 - PHI**2)
    a, forecast, returns, signal = 0.0, [], [], []
    for _ in range(DAYS):
        a = PHI * a + rng.gauss(0, innovation)
        forecast.append(a)
        returns.append(a + rng.gauss(0, NOISE_SD))
        signal.append(a + rng.gauss(0, SIGNAL_NOISE_SD))

    sd = math.sqrt(sum(s * s for s in signal) / DAYS)
    rows, series, meta = [], [], {}
    for h in HORIZONS:
        position, gross, net = 0.0, 0.0, 0.0
        turnover = 0.0
        curves = {"gross": [0.0], "net": [0.0]}
        for t in range(DAYS):
            if t % h == 0:
                target = max(-1.0, min(1.0, signal[t] / sd))
                trade = abs(target - position)
                net -= HALF_SPREAD * trade + IMPACT * trade**1.5
                turnover += trade
                position = target
            pnl = position * returns[t]
            gross += pnl
            net += pnl
            curves["gross"].append(gross * 100)
            curves["net"].append(net * 100)
        for kind in ("gross", "net"):
            key = f"{kind}{h}"
            series.append({"key": key, "label": f"{kind.capitalize()}, rebalance every {h} d"})
            for day in range(0, DAYS + 1, STEP):
                rows.append({"series": key, "x": day, "y": curves[kind][day]})
        meta[f"h{h}"] = {
            "grossPct": curves["gross"][-1],
            "netPct": curves["net"][-1],
            "turnoverPerYear": turnover / (DAYS / 252),
        }

    write_figure(
        "gross-vs-net",
        {
            "chart": "line",
            "source": "Simulation (AR(1) forecast, toy cost model, seed %d)" % SEED,
            "series_note": "illustrative costs: half-spread %.0f bp plus impact %.4f*|trade|^1.5 per unit of position; not calibrated to any market"
            % (HALF_SPREAD * 1e4, IMPACT),
            "x": {"label": "trading day"},
            "y": {"label": "cumulative return (%, sum of daily returns)"},
            "series": series,
            "meta": {"seed": SEED, "phi": PHI, "results": meta},
            "data": rows,
        },
        synthetic=True,
    )
    for k, v in meta.items():
        print(f"  {k}: gross {v['grossPct']:.1f}% net {v['netPct']:.1f}% turnover/yr {v['turnoverPerYear']:.0f}")
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
