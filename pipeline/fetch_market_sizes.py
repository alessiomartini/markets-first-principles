#!/usr/bin/env python3
"""Market size comparison — Track 0, "What a market is".

A deliberate hybrid, and the reason is worth stating.

Global equity capitalisation (WFE), bond outstandings (SIFMA) and FX turnover
(BIS Triennial) are published as annual reports, not as APIs. There is no
honest way to fetch them automatically, so they are transcribed by hand into
``pipeline/manual/market_sizes.csv`` with the source document recorded on every
row. Rows without a source URL are dropped.

Crypto market capitalisation *is* available live, from CoinGecko's free tier,
so it is fetched here and appended.

Consequence: until the CSV is filled in, this figure keeps whatever the
synthetic fallback produced and stays stamped SCHEMATIC on the page. That is
the intended behaviour — a blank chart is better than a fabricated one.
"""

from __future__ import annotations

import csv
import sys

from common import MANUAL, fetch_json, write_figure

SOURCE = MANUAL / "market_sizes.csv"


def read_manual() -> list[dict]:
    if not SOURCE.exists():
        return []

    rows = []
    with SOURCE.open(encoding="utf8") as handle:
        lines = [line for line in handle if not line.lstrip().startswith("#") and line.strip()]

    for record in csv.reader(lines):
        if len(record) < 5:
            continue
        label, value, unit, as_of, source_url = (field.strip() for field in record[:5])
        if not source_url:
            print(f"skipping {label!r}: no source_url")
            continue
        try:
            amount = float(value)
        except ValueError:
            print(f"skipping {label!r}: value {value!r} is not a number")
            continue
        rows.append({"label": label, "value": amount, "unit": unit, "asOf": as_of, "source": source_url})

    return rows


def fetch_crypto() -> dict | None:
    try:
        payload = fetch_json("https://api.coingecko.com/api/v3/global")
    except RuntimeError as error:
        print(f"coingecko unavailable, skipping crypto row: {error}")
        return None

    total = payload["data"]["total_market_cap"]["usd"] / 1e12
    return {
        "label": "Crypto (market cap)",
        "value": total,
        "unit": "stock",
        "asOf": "live",
        "source": "https://www.coingecko.com/",
    }


def main() -> int:
    rows = read_manual()

    crypto = fetch_crypto()
    if crypto:
        rows.append(crypto)

    if not rows:
        print(
            "no usable rows — fill in pipeline/manual/market_sizes.csv.\n"
            "Leaving the existing figure untouched."
        )
        return 1

    rows.sort(key=lambda row: row["value"], reverse=True)
    for row in rows:
        suffix = "/day" if row["unit"] == "flow" else ""
        row["display"] = f"${row['value']:,.1f}tn{suffix}"

    write_figure(
        "market-sizes",
        {
            "chart": "bar",
            "x": {"label": "USD trillions (log scale) — note the mix of stocks and flows", "type": "log"},
            "data": rows,
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
