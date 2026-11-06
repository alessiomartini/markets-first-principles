#!/usr/bin/env python3
"""SOFR against the administered rates — "Funding".

FRED series, daily from 2018:
  SOFR  Secured Overnight Financing Rate, Federal Reserve Bank of New York
        (FRED label "Copyrighted: Citation required": use is allowed with
        attribution, so the payload source reads "Federal Reserve Bank of New
        York via FRED")
  EFFR  effective federal funds rate, Federal Reserve Bank of New York
  IORB  interest on reserve balances, Federal Reserve Board, from July 2021;
        before that the same administered rate was published as IOER, so the two
        are spliced into one series

All dates are US business days.
"""

from __future__ import annotations

import sys

from common import run, write_figure
from sources import decimal_year, fred_csv

START = "2018-04-03"  # first SOFR publication


def main() -> int:
    sofr = [r for r in fred_csv("SOFR") if r[0] >= START]
    effr = [r for r in fred_csv("EFFR") if r[0] >= START]

    iorb = dict(fred_csv("IORB"))
    ioer = dict(fred_csv("IOER"))
    spliced = {d: v for d, v in ioer.items() if d >= START and d not in iorb}
    spliced.update({d: v for d, v in iorb.items() if d >= START})

    data = []
    for key, rows in (("sofr", sofr), ("effr", effr), ("iorb", sorted(spliced.items()))):
        data.extend({"series": key, "x": decimal_year(d), "y": v} for d, v in rows)

    peak = max(sofr, key=lambda r: r[1])
    write_figure(
        "repo-rates",
        {
            "chart": "line",
            "source": "Federal Reserve Bank of New York and Federal Reserve Board via FRED",
            "series_note": f"SOFR, EFFR, IORB (IOER before July 2021), daily, {sofr[0][0]} to {sofr[-1][0]}",
            "x": {"label": "year"},
            "y": {"label": "percent per year"},
            "series": [
                {"key": "sofr", "label": "SOFR"},
                {"key": "effr", "label": "EFFR"},
                {"key": "iorb", "label": "IORB / IOER"},
            ],
            "meta": {"sofrPeak": {"date": peak[0], "value": peak[1]}},
            "data": data,
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
