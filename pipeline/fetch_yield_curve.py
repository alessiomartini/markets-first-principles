#!/usr/bin/env python3
"""10-year minus 2-year Treasury spread against NBER recessions — "The yield curve".

FRED T10Y2Y (computed by the St. Louis Fed from US Treasury constant-maturity
yields) and USREC (NBER business-cycle dates). Both are US-government / NBER
public data. Daily spread is thinned to the last observation of each week;
recession months are merged into shaded intervals.
"""

from __future__ import annotations

import datetime
import sys

from common import run, write_figure
from sources import decimal_year, fred_csv

START = "1976-06-01"


def weekly(rows):
    last = {}
    for date, value in rows:
        iso = datetime.date.fromisoformat(date).isocalendar()
        last[(iso[0], iso[1])] = (date, value)
    return [last[key] for key in sorted(last)]


def recession_bands(rows):
    bands, start, previous = [], None, None
    for date, flag in rows:
        if flag >= 0.5 and start is None:
            start = date
        if flag < 0.5 and start is not None:
            bands.append((start, previous))
            start = None
        previous = date
    if start is not None:
        bands.append((start, previous))
    return bands


def main() -> int:
    spread = [r for r in fred_csv("T10Y2Y") if r[0] >= START]
    recessions = [r for r in fred_csv("USREC") if r[0] >= START]
    points = weekly(spread)

    bands = [
        {"x1": decimal_year(a), "x2": decimal_year(b) + 1 / 12, "label": "NBER recession"}
        for a, b in recession_bands(recessions)
    ]
    inverted_days = sum(1 for _, v in spread if v < 0)

    write_figure(
        "curve-inversions",
        {
            "chart": "line",
            "source": "FRED (St. Louis Fed; US Treasury, NBER)",
            "series_note": f"T10Y2Y weekly, {points[0][0]} to {points[-1][0]}; USREC shaded",
            "x": {"label": "year"},
            "y": {"label": "10-year minus 2-year yield (percentage points)"},
            "series": [{"key": "spread", "label": "10y - 2y"}],
            "bands": bands,
            "meta": {"dailyObservations": len(spread), "invertedDays": inverted_days},
            "data": [{"series": "spread", "x": decimal_year(d), "y": v} for d, v in points],
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
