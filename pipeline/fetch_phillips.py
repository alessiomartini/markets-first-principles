#!/usr/bin/env python3
"""The Phillips curve by decade — "Labour, output, prices".

FRED UNRATE (BLS) and CPIAUCSL (BLS). Quarterly points: unemployment is the
quarter's mean monthly rate, inflation the year-on-year change of the quarter's
mean CPI. One series per decade from the 1960s; the first point of each decade
carries its label.
"""

from __future__ import annotations

import sys
from collections import defaultdict

from common import run, write_figure
from sources import fred_csv


def quarterly(rows):
    groups = defaultdict(list)
    for date, value in rows:
        groups[(int(date[:4]), (int(date[5:7]) - 1) // 3 + 1)].append(value)
    return {key: sum(v) / len(v) for key, v in groups.items() if len(v) == 3}


def main() -> int:
    unemployment = quarterly(fred_csv("UNRATE"))
    cpi = quarterly(fred_csv("CPIAUCSL"))

    points = []
    for (year, quarter), rate in sorted(unemployment.items()):
        before = cpi.get((year - 1, quarter))
        now = cpi.get((year, quarter))
        if year >= 1960 and before and now:
            points.append((year, quarter, rate, (now / before - 1) * 100))

    decades = sorted({year // 10 * 10 for year, *_ in points})
    data, seen = [], set()
    for year, quarter, rate, inflation in points:
        decade = year // 10 * 10
        row = {"series": f"d{decade}", "x": rate, "y": inflation, "label": ""}
        if decade not in seen:
            seen.add(decade)
            row["label"] = f"{decade}s"
        data.append(row)

    write_figure(
        "phillips-by-decade",
        {
            "chart": "scatter",
            "source": "FRED (Bureau of Labor Statistics)",
            "series_note": f"UNRATE and CPIAUCSL, quarterly, {points[0][0]}Q{points[0][1]} to {points[-1][0]}Q{points[-1][1]}",
            "x": {"label": "unemployment rate (%)"},
            "y": {"label": "CPI inflation, year-on-year (%)"},
            "series": [{"key": f"d{d}", "label": f"{d}s"} for d in decades],
            "data": data,
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
