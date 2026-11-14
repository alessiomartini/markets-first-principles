#!/usr/bin/env python3
"""Leverage multiplies gains and losses — Track 6, "Margin and leverage".

SCHEMATIC, not fetched and not simulated: the return on your own capital when
an asset moves by r and the position is financed so that exposure is L times
equity (no financing cost, no margin top-ups):  equity return = max(L r, -100%).
At L = 1 you cannot lose more than everything and need a -100% asset move to do
so; at L = 5 a -20% move already wipes the equity out, and the lender or the
margin rules force the sale well before that. Deterministic.
"""

from __future__ import annotations

import math
import sys

from common import run, write_figure

LEVERAGES = [1, 2, 5]
GRID = [-30.0 + i * 2.0 for i in range(0, 31)]  # asset return -30% .. +30%


def main() -> int:
    rows = []
    for lev in LEVERAGES:
        for r in GRID:
            rows.append({"series": "x%d" % lev, "x": r, "y": max(lev * r, -100.0)})

    write_figure(
        "leverage-payoff",
        {
            "chart": "line",
            "source": "Schematic (leveraged return formula evaluated on a grid; no market data)",
            "series_note": "equity return = max(L x asset return, -100%); no financing cost, no margin calls modelled",
            "x": {"label": "asset return (%)"},
            "y": {"label": "return on own capital (%)"},
            "series": [{"key": "x%d" % lev, "label": ("Unlevered" if lev == 1 else "%dx leverage" % lev)} for lev in LEVERAGES],
            "meta": {"leverages": LEVERAGES},
            "data": rows,
        },
        synthetic=True,
    )
    return 0

if __name__ == "__main__":
    sys.exit(run(main))
