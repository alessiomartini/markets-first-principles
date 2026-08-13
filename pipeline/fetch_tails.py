#!/usr/bin/env python3
"""Return survival functions — Track 3, "Fat tails".

Three assets on one pair of log–log axes, each normalised by its own sample
volatility so the shapes are comparable, plus a Gaussian reference so the
comparison has a null hypothesis.

Sources are chosen for being free and key-free: Stooq for the equity index and
the FX pair, Binance for crypto.
"""

from __future__ import annotations

import csv
import io
import sys

from common import fetch, fetch_json, gaussian_reference, log_returns, survival_curve, write_figure

STOOQ = "https://stooq.com/q/d/l/?s={symbol}&i=d"


def stooq_closes(symbol: str) -> list[float]:
    text = fetch(STOOQ.format(symbol=symbol)).decode("utf8")
    reader = csv.DictReader(io.StringIO(text))
    closes = []
    for row in reader:
        try:
            closes.append(float(row["Close"]))
        except (KeyError, TypeError, ValueError):
            continue
    if len(closes) < 500:
        raise RuntimeError(f"stooq returned only {len(closes)} rows for {symbol}")
    return closes


def binance_closes(symbol: str, limit: int = 1000) -> list[float]:
    """Daily closes. Binance caps a single call at 1000 klines."""
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval=1d&limit={limit}"
    return [float(candle[4]) for candle in fetch_json(url)]


ASSETS = [
    ("spx", "S&P 500", lambda: stooq_closes("%5Espx")),
    ("eurusd", "EUR/USD", lambda: stooq_closes("eurusd")),
    ("btc", "BTC/USDT", lambda: binance_closes("BTCUSDT")),
]


def main() -> int:
    rows = []
    series = []
    notes = {}

    for key, label, loader in ASSETS:
        closes = loader()
        returns = log_returns(closes)
        curve, sigma, count = survival_curve(returns)

        rows.extend({"series": key, "x": point["x"], "y": point["y"]} for point in curve)
        series.append({"key": key, "label": label})
        notes[key] = {"observations": count, "dailySigma": sigma}

    if not rows:
        raise RuntimeError("no series fetched")

    write_figure(
        "return-ccdf",
        {
            "chart": "loglog",
            "x": {"label": "|r| / σ  (standard deviations)"},
            "y": {"label": "P(|r|/σ > x)"},
            "series": series,
            "reference": gaussian_reference(),
            "referenceLabel": "Gaussian",
            "meta": notes,
            "data": rows,
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
