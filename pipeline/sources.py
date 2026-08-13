"""Market data sources, each behind a uniform interface.

Every function here returns plain Python and raises on anything unexpected, so
that `first_working` can treat a provider as simply working or not.

The reason there are several per instrument is empirical rather than
architectural: see the note in `common.first_working`. The order within each
list is "best data first", so a successful run uses the richest source and a
degraded run still produces a real, if shorter, series.
"""

from __future__ import annotations

import csv
import io

from common import fetch, fetch_json

# Yahoo refuses a bare scripted User-Agent. This is the documented cost of the
# unofficial endpoint, which the build spec allows for a nightly cached
# pipeline and forbids as a live browser dependency.
BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"


# --------------------------------------------------------------------------
# Daily closes
# --------------------------------------------------------------------------

def yahoo_closes(symbol: str, *, span: str = "max") -> list[float]:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={span}&interval=1d"
    payload = fetch_json(url, headers={"User-Agent": BROWSER_UA, "Accept": "application/json"})

    error = payload.get("chart", {}).get("error")
    if error:
        raise RuntimeError(str(error))

    result = payload["chart"]["result"][0]
    closes = result["indicators"]["quote"][0]["close"]
    series = [value for value in closes if value]
    if len(series) < 500:
        raise RuntimeError(f"only {len(series)} closes")
    return series


def stooq_closes(symbol: str) -> list[float]:
    text = fetch(f"https://stooq.com/q/d/l/?s={symbol}&i=d").decode("utf8", "replace")
    if "," not in text.split("\n", 1)[0]:
        # Stooq answers rate-limited automation with a plain-text notice
        # rather than an HTTP error, so the body has to be inspected.
        raise RuntimeError(f"not a CSV: {text[:80].strip()!r}")

    closes = []
    for row in csv.DictReader(io.StringIO(text)):
        try:
            closes.append(float(row["Close"]))
        except (KeyError, TypeError, ValueError):
            continue

    if len(closes) < 500:
        raise RuntimeError(f"only {len(closes)} rows")
    return closes


def binance_closes(symbol: str = "BTCUSDT", limit: int = 1000) -> list[float]:
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval=1d&limit={limit}"
    return [float(candle[4]) for candle in fetch_json(url)]


def kraken_closes(pair: str = "XXBTZUSD") -> list[float]:
    payload = fetch_json(f"https://api.kraken.com/0/public/OHLC?pair={pair}&interval=1440")
    if payload.get("error"):
        raise RuntimeError(str(payload["error"]))

    (key,) = [name for name in payload["result"] if name != "last"]
    return [float(row[4]) for row in payload["result"][key]]


def coinbase_closes(product: str = "BTC-USD") -> list[float]:
    url = f"https://api.exchange.coinbase.com/products/{product}/candles?granularity=86400"
    candles = fetch_json(url, headers={"Accept": "application/json"})
    # Coinbase returns [time, low, high, open, close, volume], newest first.
    return [float(row[4]) for row in sorted(candles, key=lambda row: row[0])]


CRYPTO_CLOSES = [
    ("Binance", binance_closes),
    ("Kraken", kraken_closes),
    ("Coinbase", coinbase_closes),
]

EQUITY_CLOSES = [
    ("Yahoo Finance", lambda: yahoo_closes("%5EGSPC")),
    ("Stooq", lambda: stooq_closes("%5Espx")),
]

FX_CLOSES = [
    ("Yahoo Finance", lambda: yahoo_closes("EURUSD=X")),
    ("Stooq", lambda: stooq_closes("eurusd")),
]


# --------------------------------------------------------------------------
# Order books — (bids, asks) as [(price, size)], best price first
# --------------------------------------------------------------------------

def binance_book(symbol: str = "BTCUSDT", limit: int = 500):
    payload = fetch_json(f"https://api.binance.com/api/v3/depth?symbol={symbol}&limit={limit}")
    bids = [(float(p), float(q)) for p, q in payload["bids"]]
    asks = [(float(p), float(q)) for p, q in payload["asks"]]
    return _check_book(bids, asks, "BTCUSDT", "USDT", "BTC")


def kraken_book(pair: str = "XBTUSD", count: int = 500):
    payload = fetch_json(f"https://api.kraken.com/0/public/Depth?pair={pair}&count={count}")
    if payload.get("error"):
        raise RuntimeError(str(payload["error"]))

    (key,) = payload["result"].keys()
    book = payload["result"][key]
    bids = [(float(row[0]), float(row[1])) for row in book["bids"]]
    asks = [(float(row[0]), float(row[1])) for row in book["asks"]]
    return _check_book(bids, asks, "XBT/USD", "USD", "BTC")


def coinbase_book(product: str = "BTC-USD"):
    payload = fetch_json(
        f"https://api.exchange.coinbase.com/products/{product}/book?level=2",
        headers={"Accept": "application/json"},
    )
    bids = [(float(row[0]), float(row[1])) for row in payload["bids"]]
    asks = [(float(row[0]), float(row[1])) for row in payload["asks"]]
    return _check_book(bids, asks, "BTC-USD", "USD", "BTC")


def _check_book(bids, asks, instrument, quote, base):
    if not bids or not asks:
        raise RuntimeError("empty book")
    if bids[0][0] >= asks[0][0]:
        raise RuntimeError("crossed book")
    return {
        "bids": sorted(bids, key=lambda row: -row[0]),
        "asks": sorted(asks, key=lambda row: row[0]),
        "instrument": instrument,
        "quote": quote,
        "base": base,
    }


BOOKS = [
    ("Binance", binance_book),
    ("Kraken", kraken_book),
    ("Coinbase", coinbase_book),
]
