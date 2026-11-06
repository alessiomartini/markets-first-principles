#!/usr/bin/env python3
"""Fed funds rate against 2-year and 10-year Treasury yields — "Interest rates and central banks".

FRED DFF (effective federal funds rate, Federal Reserve Board), DGS2 and DGS10
(US Treasury constant-maturity yields). Monthly averages of the daily values,
1990 onward.
"""

from __future__ import annotations

import sys
from collections import defaultdict

from common import run, write_figure
from sources import decimal_year, fred_csv

START = "1990-01"
SERIES = [("DFF", "Fed funds rate"), ("DGS2", "2-year yield"), ("DGS10", "10-year yield")]


def monthly(rows):
    groups = defaultdict(list)
    for date, value in rows:
        if date[:7] >= START:
            groups[date[:7]].append(value)
    return {month: sum(v) / len(v) for month, v in sorted(groups.items())}


def main() -> int:
    data, span = [], []
    for key, _label in SERIES:
        averages = monthly(fred_csv(key))
        span.append((min(averages), max(averages)))
        data.extend({"series": key, "x": decimal_year(f"{m}-01"), "y": v} for m, v in averages.items())

    write_figure(
        "policy-vs-curve",
        {
            "chart": "line",
            "source": "FRED (Federal Reserve Board; US Treasury)",
            "series_note": f"DFF, DGS2, DGS10 monthly averages, {min(s[0] for s in span)} to {max(s[1] for s in span)}",
            "x": {"label": "year"},
            "y": {"label": "percent per year"},
            "series": [{"key": k, "label": label} for k, label in SERIES],
            "data": data,
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
