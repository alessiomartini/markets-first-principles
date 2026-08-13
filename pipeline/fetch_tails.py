#!/usr/bin/env python3
"""Return survival functions — Track 3, "Fat tails".

Three assets on one pair of log–log axes, each normalised by its own sample
volatility so the shapes are comparable, plus a Gaussian reference so the
comparison has a null hypothesis.

A series that cannot be fetched from any of its sources is dropped rather than
failing the whole figure: two real curves beat three synthetic ones. What was
actually fetched — which venue, how many observations — is recorded in the
payload and printed in the caption.
"""

from __future__ import annotations

import sys

from common import first_working, gaussian_reference, log_returns, run, survival_curve, write_figure
from sources import CRYPTO_CLOSES, EQUITY_CLOSES, FX_CLOSES

ASSETS = [
    ("spx", "S&P 500", EQUITY_CLOSES),
    ("eurusd", "EUR/USD", FX_CLOSES),
    ("btc", "BTC/USD", CRYPTO_CLOSES),
]


def main() -> int:
    rows = []
    series = []
    meta = {}
    venues = []

    for key, label, providers in ASSETS:
        print(f"{label}:")
        try:
            venue, closes = first_working(providers, label)
        except RuntimeError as error:
            print(f"  dropping {label} — {error}")
            continue

        returns = log_returns(closes)
        curve, sigma, count = survival_curve(returns)

        rows.extend({"series": key, "x": point["x"], "y": point["y"]} for point in curve)
        series.append({"key": key, "label": label})
        meta[key] = {"venue": venue, "observations": count, "dailySigma": sigma}
        venues.append(venue)
        print(f"  {count} observations via {venue}")

    if len(series) < 2:
        # One lone curve cannot show that the shape is common across asset
        # classes, which is the entire claim of the page.
        raise RuntimeError(f"only {len(series)} series available; leaving the figure untouched")

    write_figure(
        "return-ccdf",
        {
            "chart": "loglog",
            "source": ", ".join(dict.fromkeys(venues)),
            "series_note": " · ".join(
                f"{item['label']} ({meta[item['key']]['observations']} obs)" for item in series
            ),
            "x": {"label": "|r| / σ  (standard deviations)"},
            "y": {"label": "P(|r|/σ > x)"},
            "series": series,
            "reference": gaussian_reference(),
            "referenceLabel": "Gaussian",
            "meta": meta,
            "data": rows,
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
