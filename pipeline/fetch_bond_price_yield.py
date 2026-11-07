#!/usr/bin/env python3
"""Price against yield for a real bond — Track 1, "Bonds".

FRED DGS10 (US Treasury constant-maturity 10-year yield, public domain) gives
today's yield. The instrument is a 10-year note with semiannual coupons whose
coupon is that yield rounded to the nearest 1/8 %, as on-the-run issues are
set. It is a stylised par-ish note, not a specific CUSIP: no real issue is
quoted. Price per 100 face is the sum of discounted cash flows at yield y
(semiannual compounding), for y from 0.5% to 12%. The tangent at today's yield
(slope = -modified duration * price) is drawn as a second series, so the gap
between the curve and the line is the convexity.
"""

from __future__ import annotations

import sys

from common import run, write_figure
from sources import fred_csv

YEARS = 10


def price(coupon: float, y: float) -> float:
    c, r, n = coupon / 2, y / 200, YEARS * 2
    return sum(c / (1 + r) ** k for k in range(1, n + 1)) + 100 / (1 + r) ** n


def main() -> int:
    date, y0 = fred_csv("DGS10")[-1]
    coupon = round(y0 * 8) / 8
    p0 = price(coupon, y0)
    h = 1e-4
    slope = (price(coupon, y0 + h) - price(coupon, y0 - h)) / (2 * h)
    convexity = (price(coupon, y0 + 0.01) + price(coupon, y0 - 0.01) - 2 * p0) / (0.01 / 100) ** 2 / p0

    rows = []
    for i in range(0, 116):
        y = 0.5 + i * 0.1
        rows.append({"series": "price", "x": y, "y": price(coupon, y)})
        line = p0 + slope * (y - y0)
        if line > 0:
            rows.append({"series": "tangent", "x": y, "y": line})

    write_figure(
        "price-yield-curve",
        {
            "chart": "line",
            "source": "FRED (US Treasury constant-maturity 10-year yield, DGS10)",
            "series_note": "stylised 10-year note, semiannual %.3f%% coupon (DGS10 of %s rounded to 1/8), priced at yields 0.5%% to 12%%; not a specific issue"
            % (coupon, date),
            "x": {"label": "yield to maturity (%)"},
            "y": {"label": "price per 100 face"},
            "series": [
                {"key": "price", "label": "Price"},
                {"key": "tangent", "label": "Duration tangent at today's yield"},
            ],
            "meta": {
                "date": date,
                "yield": y0,
                "coupon": coupon,
                "price": p0,
                "modifiedDuration": -slope / p0 * 100,
                "convexity": convexity,
            },
            "data": rows,
        },
    )
    print(f"  y={y0} coupon={coupon} price={p0:.3f} modDur={-slope / p0 * 100:.2f} convexity={convexity:.1f}")
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
