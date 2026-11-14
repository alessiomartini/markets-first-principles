#!/usr/bin/env python3
"""Put-call parity as payoffs — Track 4, "No-arbitrage and replication".

SCHEMATIC, not fetched and not simulated: payoff formulas evaluated on a grid.
No randomness, no market data. Strike K = 100. A long call plus a short put at
the same strike and expiry pays max(S - K, 0) - max(K - S, 0) = S - K for every
S, which is the payoff of a forward struck at K. Two positions with the same
payoff in every state must cost the same today: that is put-call parity.
Premiums are ignored so the identity is visible. (The page's own figure,
"put-call-parity", is the measured gap on a real option chain and still has no
data; this one is a different id on purpose.)
"""

from __future__ import annotations

import math
import sys

from common import run, write_figure

STRIKE = 100.0
GRID = [60.0 + i * 2.0 for i in range(0, 41)]  # 60 .. 140


def main() -> int:
    rows = []
    for s in GRID:
        call = max(s - STRIKE, 0.0)
        short_put = -max(STRIKE - s, 0.0)
        rows.append({"series": "long-call", "x": s, "y": call})
        rows.append({"series": "short-put", "x": s, "y": short_put})
        rows.append({"series": "sum", "x": s, "y": call + short_put})

    write_figure(
        "parity-payoff",
        {
            "chart": "line",
            "source": "Schematic (payoff formulas evaluated on a grid; no market data)",
            "series_note": "strike K=%g, premiums ignored, underlying price S from %g to %g" % (STRIKE, GRID[0], GRID[-1]),
            "x": {"label": "underlying price at expiry, S"},
            "y": {"label": "payoff at expiry"},
            "series": [
                {"key": "long-call", "label": "Long call"},
                {"key": "short-put", "label": "Short put"},
                {"key": "sum", "label": "Sum = S - K"},
            ],
            "meta": {"strike": STRIKE},
            "data": rows,
        },
        synthetic=True,
    )
    return 0

if __name__ == "__main__":
    sys.exit(run(main))
