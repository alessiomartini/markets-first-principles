#!/usr/bin/env python3
"""Today's discount curve, built from Treasury par yields — Track 1, "Cash flows and discounting".

FRED constant-maturity Treasury yields (US Treasury via the Federal Reserve
Board H.15; public domain): DGS1MO, DGS3MO, DGS6MO, DGS1, DGS2, DGS3, DGS5,
DGS7, DGS10, DGS20, DGS30. The page names the Treasury's own XML/CSV feed;
FRED republishes the same par yields and is already the pipeline's keyless
path, so it is used here and the caption says so.

Method. Par yields are linearly interpolated onto a half-year grid out to 30
years (flat from 6M to 0.5y). Discount factors are then bootstrapped: for the
6-month point DF = 1/(1 + y/2); for later points, a par bond with semiannual
coupon c = y pays c/2 each half-year and 100 at the end, priced at 100:
DF(n) = (1 - (c/2) * sum_{k<n} DF(k)) / (1 + c/2). Curves are drawn for the
latest date with all tenors available and for the same calendar date 1, 5 and 10
years earlier (nearest earlier date with all tenors).
"""

from __future__ import annotations

import datetime as dt
import sys

from common import run, write_figure
from sources import fred_csv

TENORS = [("DGS6MO", 0.5), ("DGS1", 1), ("DGS2", 2), ("DGS3", 3), ("DGS5", 5), ("DGS7", 7), ("DGS10", 10), ("DGS20", 20), ("DGS30", 30)]


def bootstrap(par: dict[float, float]) -> list[tuple[float, float]]:
    knots = sorted(par.items())

    def interp(t: float) -> float:
        if t <= knots[0][0]:
            return knots[0][1]
        for (t0, y0), (t1, y1) in zip(knots, knots[1:]):
            if t <= t1:
                return y0 + (y1 - y0) * (t - t0) / (t1 - t0)
        return knots[-1][1]

    dfs = []
    for n in range(1, 61):
        t = n / 2
        c = interp(t) / 100
        if n == 1:
            df = 1 / (1 + c / 2)
        else:
            df = (1 - (c / 2) * sum(dfs)) / (1 + c / 2)
        dfs.append(df)
    return [((n + 1) / 2, df) for n, df in enumerate(dfs)]


def main() -> int:
    series = {name: dict(fred_csv(name)) for name, _ in TENORS}
    dates = sorted(set.intersection(*(set(d) for d in series.values())))
    latest = dates[-1]

    def on_or_before(target: str) -> str:
        return max(d for d in dates if d <= target)

    last = dt.date.fromisoformat(latest)
    picks = [("now", latest)]
    for years in (1, 5, 10):
        target = last.replace(year=last.year - years, day=min(last.day, 28)).isoformat()
        picks.append((f"ago{years}", on_or_before(target)))

    rows, labels, meta = [], [], {}
    for key, date in picks:
        par = {tenor: series[name][date] for name, tenor in TENORS}
        curve = bootstrap(par)
        dfs = [df for _, df in curve]
        meta[key] = {"date": date, "monotonic": all(a > b for a, b in zip(dfs, dfs[1:]))}
        labels.append({"key": key, "label": "Latest (%s)" % date if key == "now" else f"{date}"})
        rows += [{"series": key, "x": t, "y": df} for t, df in curve]

    write_figure(
        "discount-curve",
        {
            "chart": "line",
            "source": "FRED (US Treasury constant-maturity par yields, Federal Reserve Board H.15)",
            "series_note": "par yields DGS6MO to DGS30, linearly interpolated to half-years and bootstrapped to discount factors; curves for %s and the nearest earlier dates 1, 5 and 10 years before"
            % latest,
            "x": {"label": "maturity (years)"},
            "y": {"label": "discount factor"},
            "series": labels,
            "meta": meta,
            "data": rows,
        },
    )
    print("  ", meta)
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
