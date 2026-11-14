#!/usr/bin/env python3
"""Payoff of options at expiry — Track 1, "Options".

SCHEMATIC, not fetched and not even simulated: the payoff of an option at expiry
is a definition, so this script only evaluates the three formulas on a grid.
There is no randomness and no market data; the figure is stamped SCHEMATIC on
the page and the payload carries synthetic=true.

Strike K = 100. Long call: max(S - K, 0). Short call: -max(S - K, 0).
Long put: max(K - S, 0). The premium is deliberately left out so the kink at
the strike is the whole picture; the page explains that the premium shifts each
line down (long) or up (short) by a constant.
"""

from __future__ import annotations

import sys

from common import run, write_figure

STRIKE = 100.0
GRID = [60.0 + i * 2.0 for i in range(0, 41)]  # 60 .. 140


def main() -> int:
    rows = []
    for s in GRID:
        rows.append({"series": "long-call", "x": s, "y": max(s - STRIKE, 0.0)})
        rows.append({"series": "short-call", "x": s, "y": -max(s - STRIKE, 0.0)})
        rows.append({"series": "long-put", "x": s, "y": max(STRIKE - s, 0.0)})

    write_figure(
        "option-payoff",
        {
            "chart": "line",
            "source": "Schematic (payoff formulas evaluated on a grid; no market data)",
            "series_note": "strike K=%g, premium ignored, underlying price S from %g to %g" % (STRIKE, GRID[0], GRID[-1]),
            "x": {"label": "underlying price at expiry, S"},
            "y": {"label": "payoff at expiry"},
            "series": [
                {"key": "long-call", "label": "Long call"},
                {"key": "short-call", "label": "Short call"},
                {"key": "long-put", "label": "Long put"},
            ],
            "meta": {"strike": STRIKE},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
