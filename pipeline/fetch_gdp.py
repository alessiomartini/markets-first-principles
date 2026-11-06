#!/usr/bin/env python3
"""Contributions to real GDP growth — "What GDP actually measures".

BEA national-accounts series republished by FRED (public domain, citation
requested). Each is the contribution, in percentage points of annualised
quarterly real GDP growth, of one expenditure component:

  DPCERY2Q224SBEA  personal consumption expenditures (C)
  A006RY2Q224SBEA  gross private domestic investment (I)
  A822RY2Q224SBEA  government consumption expenditures and gross investment (G)
  A019RY2Q224SBEA  net exports of goods and services (NX)

The four contributions sum to the GDP growth rate, so no separate GDP series is
needed. The page also names Eurostat; no Eurostat data is used here, and the
payload source says so.
"""

from __future__ import annotations

import sys

from common import run, write_figure
from sources import decimal_year, fred_csv

START = "1960-01-01"
SERIES = [
    ("C", "Consumption", "DPCERY2Q224SBEA"),
    ("I", "Investment", "A006RY2Q224SBEA"),
    ("G", "Government", "A822RY2Q224SBEA"),
    ("NX", "Net exports", "A019RY2Q224SBEA"),
]


def main() -> int:
    data, last = [], []
    for key, _label, fred_id in SERIES:
        rows = [r for r in fred_csv(fred_id) if r[0] >= START]
        last.append(rows[-1][0])
        # Quarter-start dates; shift to mid-quarter so points sit inside the quarter.
        data.extend({"series": key, "x": decimal_year(d) + 0.125, "y": v} for d, v in rows)

    write_figure(
        "gdp-decomposition",
        {
            "chart": "line",
            "source": "FRED (Bureau of Economic Analysis)",
            "series_note": f"contributions to real GDP growth, quarterly, 1960Q1 to {min(last)}; Eurostat not used",
            "x": {"label": "year"},
            "y": {"label": "contribution to annualised real GDP growth (percentage points)"},
            "series": [{"key": k, "label": label} for k, label, _ in SERIES],
            "data": data,
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
