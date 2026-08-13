#!/usr/bin/env python3
"""Synthetic stand-ins for figures whose real data has not been fetched yet.

Every payload written here is stamped ``synthetic: true``, which makes the page
render a SCHEMATIC badge and a sentence telling the reader the numbers are not
real. The shapes are drawn from the models the pages describe — a V-shaped book,
a power-law tail — so the design can be reviewed before any API is reachable,
and so a broken pipeline is visibly broken rather than quietly plausible.

Existing real payloads are never overwritten. Run with --force to replace them
anyway (useful when redesigning a chart offline).
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys

from common import FIGURES, gaussian_reference, survival_curve, write_figure


def already_real(figure_id: str) -> bool:
    path = FIGURES / f"{figure_id}.json"
    if not path.exists():
        return False
    try:
        return json.loads(path.read_text(encoding="utf8")).get("synthetic") is False
    except (ValueError, OSError):
        return False


def market_sizes() -> dict:
    """Orders of magnitude only — the point of the figure is the log spread."""
    rows = [
        {"label": "Bonds (outstanding)", "value": 140.0, "unit": "stock"},
        {"label": "Equities (market cap)", "value": 110.0, "unit": "stock"},
        {"label": "FX (turnover)", "value": 7.5, "unit": "flow"},
        {"label": "Crypto (market cap)", "value": 3.0, "unit": "stock"},
    ]
    for row in rows:
        suffix = "/day" if row["unit"] == "flow" else ""
        row["display"] = f"~${row['value']:,.0f}tn{suffix} (synthetic)"

    return {
        "chart": "bar",
        "x": {"label": "USD trillions (log scale) — note the mix of stocks and flows", "type": "log"},
        "data": rows,
    }


def order_book_depth() -> dict:
    """A V-shaped book: density suppressed at the interface, growing outward.

    This is the reaction–diffusion prediction the page describes, which is
    exactly why it is a legitimate schematic — it shows the claim, and the badge
    says it is not a measurement.
    """
    random.seed(2)
    mid = 100_000.0
    tick = 1.0
    rows = []

    for side, direction in (("bid", -1), ("ask", +1)):
        cumulative = 0.0
        for level in range(1, 121):
            distance = level * tick
            # Density grows roughly linearly away from the touch, with noise.
            size = (0.02 + 0.05 * distance / 20) * random.uniform(0.4, 1.8)
            cumulative += size
            rows.append(
                {"side": side, "price": mid + direction * distance, "cumulative": cumulative}
            )

    return {
        "chart": "depth",
        "mid": mid,
        "x": {"label": "price (USDT)"},
        "y": {"label": "cumulative size (BTC)"},
        "data": rows,
    }


def return_ccdf() -> dict:
    """Student-t draws with the tail exponents the page claims are observed."""
    random.seed(3)
    series = []
    rows = []

    for key, label, nu, count in (
        ("spx", "S&P 500", 3.0, 20000),
        ("eurusd", "EUR/USD", 3.6, 20000),
        ("btc", "BTC/USDT", 2.6, 20000),
    ):
        draws = [random.gauss(0, 1) / math.sqrt(random.gammavariate(nu / 2, 2 / nu)) for _ in range(count)]
        curve, _sigma, _n = survival_curve(draws)
        rows.extend({"series": key, "x": point["x"], "y": point["y"]} for point in curve)
        series.append({"key": key, "label": label})

    return {
        "chart": "loglog",
        "x": {"label": "|r| / σ  (standard deviations)"},
        "y": {"label": "P(|r|/σ > x)"},
        "series": series,
        "reference": gaussian_reference(),
        "referenceLabel": "Gaussian",
        "data": rows,
    }


BUILDERS = {
    "market-sizes": market_sizes,
    "order-book-depth": order_book_depth,
    "return-ccdf": return_ccdf,
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="overwrite payloads that hold real data")
    parser.add_argument("figures", nargs="*", help="figure ids (default: all known)")
    args = parser.parse_args()

    targets = args.figures or list(BUILDERS)

    for figure_id in targets:
        builder = BUILDERS.get(figure_id)
        if not builder:
            print(f"no synthetic builder for {figure_id!r}")
            continue
        if already_real(figure_id) and not args.force:
            print(f"{figure_id}: real data present, leaving it alone")
            continue
        write_figure(figure_id, builder(), synthetic=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())
