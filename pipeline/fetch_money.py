#!/usr/bin/env python3
"""M2 growth against CPI inflation — "Money and inflation".

FRED M2SL (Federal Reserve Board) and CPIAUCSL (BLS), monthly, seasonally
adjusted. Both are shown as year-on-year percentage changes from 1960; 2021-23
is marked with a band.
"""

from __future__ import annotations

import sys

from common import run, write_figure
from sources import decimal_year, fred_csv

START = "1960-01"


def yoy(rows):
    values = dict(rows)
    out = []
    for date, value in rows:
        year, rest = int(date[:4]), date[4:]
        previous = values.get(f"{year - 1}{rest}")
        if previous and date[:7] >= START:
            out.append((date, (value / previous - 1) * 100))
    return out


def main() -> int:
    m2 = yoy(fred_csv("M2SL"))
    cpi = yoy(fred_csv("CPIAUCSL"))

    data = [{"series": "m2", "x": decimal_year(d), "y": v} for d, v in m2]
    data += [{"series": "cpi", "x": decimal_year(d), "y": v} for d, v in cpi]

    write_figure(
        "m2-vs-cpi",
        {
            "chart": "line",
            "source": "FRED (Federal Reserve Board; Bureau of Labor Statistics)",
            "series_note": f"M2SL and CPIAUCSL, year-on-year, {m2[0][0]} to {m2[-1][0]}",
            "x": {"label": "year"},
            "y": {"label": "year-on-year change (%)"},
            "series": [{"key": "m2", "label": "M2 growth"}, {"key": "cpi", "label": "CPI inflation"}],
            "bands": [{"x1": 2021.0, "x2": 2024.0, "label": "2021-23"}],
            "data": data,
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
