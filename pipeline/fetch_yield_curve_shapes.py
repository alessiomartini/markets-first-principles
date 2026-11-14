#!/usr/bin/env python3
"""Four shapes of the yield curve — Track 5, "The yield curve".

SCHEMATIC, not fetched and not simulated: the Nelson-Siegel curve

    y(m) = b0 + b1 * (1 - e^(-m/L)) / (m/L) + b2 * ((1 - e^(-m/L)) / (m/L) - e^(-m/L))

with decay scale L = 2 years, evaluated for three hand-picked parameter sets
that give a normal (upward), a flat and an inverted curve. The
parameters are illustrative, not estimated from any date. Deterministic.

b0 is the long-run level (the yield at infinite maturity), b0 + b1 the
instantaneous short rate, and b2 the size of a hump (set to zero here).
"""

from __future__ import annotations

import math
import sys

from common import run, write_figure

LAMBDA = 2.0
MATURITIES = [0.25 + i * 0.25 for i in range(0, 120)]  # 0.25 .. 30 years
SHAPES = [
    ("normal", "Normal", 5.0, -3.0, 0.0),
    ("flat", "Flat", 4.0, 0.0, 0.0),
    ("inverted", "Inverted", 3.5, 2.0, 0.0),
]


def nelson_siegel(m: float, b0: float, b1: float, b2: float) -> float:
    x = m / LAMBDA
    slope = (1.0 - math.exp(-x)) / x
    return b0 + b1 * slope + b2 * (slope - math.exp(-x))


def main() -> int:
    rows = []
    for key, _label, b0, b1, b2 in SHAPES:
        for m in MATURITIES:
            rows.append({"series": key, "x": m, "y": nelson_siegel(m, b0, b1, b2)})

    write_figure(
        "yield-curve-shapes",
        {
            "chart": "line",
            "source": "Schematic (Nelson-Siegel formula with illustrative parameters; no market data)",
            "series_note": "Nelson-Siegel curve, decay scale %g years, three parameter sets chosen to show the shapes" % LAMBDA,
            "x": {"label": "maturity (years)"},
            "y": {"label": "yield (% a year)"},
            "series": [{"key": key, "label": label} for key, label, *_ in SHAPES],
            "meta": {"lambdaYears": LAMBDA},
            "data": rows,
        },
        synthetic=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run(main))
