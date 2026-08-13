#!/usr/bin/env python3
"""Order book depth snapshot — Track 2, "The order book".

Binance's public REST depth endpoint needs no key and returns up to 5000 levels
per side. The figure wants cumulative depth, so the raw levels are aggregated
outward from the touch.
"""

from __future__ import annotations

import sys

from common import fetch_json, write_figure

SYMBOL = "BTCUSDT"
LEVELS = 500
# Only the part of the book near the mid is worth plotting: beyond a percent or
# so the resting volume is stale quotes nobody expects to trade against.
BAND = 0.004


def main() -> int:
    payload = fetch_json(f"https://api.binance.com/api/v3/depth?symbol={SYMBOL}&limit={LEVELS}")

    bids = [(float(price), float(size)) for price, size in payload["bids"]]
    asks = [(float(price), float(size)) for price, size in payload["asks"]]
    if not bids or not asks:
        raise RuntimeError("empty book returned")

    best_bid, best_ask = bids[0][0], asks[0][0]
    mid = (best_bid + best_ask) / 2

    rows = []

    cumulative = 0.0
    for price, size in bids:  # already sorted descending
        if price < mid * (1 - BAND):
            break
        cumulative += size
        rows.append({"side": "bid", "price": price, "cumulative": cumulative})

    cumulative = 0.0
    for price, size in asks:  # already sorted ascending
        if price > mid * (1 + BAND):
            break
        cumulative += size
        rows.append({"side": "ask", "price": price, "cumulative": cumulative})

    write_figure(
        "order-book-depth",
        {
            "chart": "depth",
            "mid": mid,
            "x": {"label": f"price (USDT) · mid {mid:,.2f} · spread {best_ask - best_bid:.2f}"},
            "y": {"label": "cumulative size (BTC)"},
            "meta": {
                "symbol": SYMBOL,
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
    sys.exit(main())
