#!/usr/bin/env python3
"""The same rule in sample and out of sample — Track 7, "Backtesting".

SIMULATED, not fetched. N trading rules with exactly zero skill (daily returns
iid Gaussian, mean 0, volatility 1%) are generated; the one with the best Sharpe
ratio over the first half is "the strategy", and its cumulative return is then
followed into the second half, which played no part in the choice. Because no
rule has any edge, everything in-sample is selection and the out-of-sample
drift is zero by construction.

Reference value: the annualised Sharpe ratio of a skill-free rule estimated on
T years of data has standard deviation 1/sqrt(T), and the expected maximum of N
independent standard normals is about sqrt(2 ln N) - (ln ln N + ln 4pi) /
(2 sqrt(2 ln N)). Both are recorded in the payload for comparison with the draw.
"""

from __future__ import annotations

import math
import random
import statistics
import sys

from common import run, write_figure

SEED = 20261031
RULES = 200
DAYS_IN = 1260  # 5 years
DAYS_OUT = 1260
SIGMA = 0.01
YEAR = 252
STEP = 21  # one point a month keeps the payload small


def sharpe(returns: list[float]) -> float:
    return statistics.fmean(returns) / statistics.pstdev(returns) * math.sqrt(YEAR)


def expected_max_normal(n: int) -> float:
    a = math.sqrt(2 * math.log(n))
    return a - (math.log(math.log(n)) + math.log(4 * math.pi)) / (2 * a)


def main() -> int:
    rng = random.Random(SEED)
    total = DAYS_IN + DAYS_OUT
    rules = [[rng.gauss(0, SIGMA) for _ in range(total)] for _ in range(RULES)]

    best = max(range(RULES), key=lambda i: sharpe(rules[i][:DAYS_IN]))
    chosen = rules[best]

    def cumulative(series: list[float]) -> list[float]:
        out, running = [], 0.0
        for value in series:
            running += value
            out.append(running * 100)
        return out

    chosen_curve = cumulative(chosen)
    average = [statistics.fmean(rule[t] for rule in rules) for t in range(total)]
    average_curve = cumulative(average)

    rows = []
    for day in range(0, total + 1, STEP):
        index = max(day - 1, 0)
        rows.append({"series": "chosen", "x": day, "y": chosen_curve[index] if day else 0.0})
        rows.append({"series": "average", "x": day, "y": average_curve[index] if day else 0.0})

    sharpe_in = sharpe(chosen[:DAYS_IN])
    sharpe_out = sharpe(chosen[DAYS_IN:])
    years_in = DAYS_IN / YEAR

    write_figure(
        "in-vs-out-of-sample",
        {
            "chart": "line",
            "source": "Simulation (zero-skill rules, seed %d)" % SEED,
            "series_note": "best of %d rules with no edge, chosen on the first %d days; the next %d days are held back"
            % (RULES, DAYS_IN, DAYS_OUT),
            "x": {"label": "trading day (selection on days 0-%d, held back after)" % DAYS_IN},
            "y": {"label": "cumulative return (%, sum of daily log returns)"},
            "series": [
                {"key": "chosen", "label": "Best in-sample rule"},
                {"key": "average", "label": "Average of all rules"},
            ],
            "meta": {
                "seed": SEED,
                "rules": RULES,
                "boundaryDay": DAYS_IN,
                "sharpeInSample": sharpe_in,
                "sharpeOutOfSample": sharpe_out,
                "expectedMaxSharpeInSample": expected_max_normal(RULES) / math.sqrt(years_in),
                "sharpeSamplingSd": 1 / math.sqrt(years_in),
            },
            "data": rows,
        },
        synthetic=True,
    )
    print(f"  in-sample Sharpe {sharpe_in:.2f} (expected max ~{expected_max_normal(RULES) / math.sqrt(years_in):.2f}), out-of-sample {sharpe_out:.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
