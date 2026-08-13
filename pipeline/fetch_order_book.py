#!/usr/bin/env python3
"""Order book depth snapshot — Track 2, "The order book".

Whichever venue answers supplies the snapshot; the payload records which one,
so the caption on the page names the venue the numbers actually came from.
"""

from __future__ import annotations

import sys

from common import first_working, run, write_figure
from sources import BOOKS

# Only the part of the book near the mid is worth plotting: further out the
# resting volume is stale quotes nobody expects to trade against.
BAND = 0.004


def main() -> int:
    venue, book = first_working(BOOKS, "order book")

    bids, asks = book["bids"], book["asks"]
    best_bid, best_ask = bids[0][0], asks[0][0]
    mid = (best_bid + best_ask) / 2

    rows = []
    for side, levels, inside in (("bid", bids, lambda p: p >= mid * (1 - BAND)),
                                 ("ask", asks, lambda p: p <= mid * (1 + BAND))):
        cumulative = 0.0
        for price, size in levels:
            if not inside(price):
                break
            cumulative += size
            rows.append({"side": side, "price": price, "cumulative": cumulative})

    if len(rows) < 20:
        raise RuntimeError(f"only {len(rows)} levels within {BAND:.1%} of the mid")

    write_figure(
        "order-book-depth",
        {
            "chart": "depth",
            "mid": mid,
            "source": f"{venue} public REST",
            # Not "series": that key holds the multi-series list the legend and
            # renderer iterate over, and a string there would break both.
            "series_note": f"{book['instrument']} L2 book snapshot",
            "x": {"label": f"price ({book['quote']}) · mid {mid:,.2f} · spread {best_ask - best_bid:.2f}"},
            "y": {"label": f"cumulative size ({book['base']})"},
            "meta": {
                "venue": venue,
                "instrument": book["instrument"],
                "bestBid": best_bid,
                "bestAsk": best_ask,
                "spreadBps": (best_ask - best_bid) / mid * 1e4,
                "bandPct": BAND * 100,
            },
            "data": rows,
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
