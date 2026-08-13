"""Shared helpers for the data pipeline.

The contract every fetch script honours:

  * it writes exactly one JSON payload to ``src/data/figures/<id>.json``
  * that payload carries ``synthetic: false`` and a ``generatedAt`` stamp
  * it never invents a number it did not fetch

The site renders whatever is committed. If a script has never run, the figure
says so on the page; if the synthetic fallback ran, the figure is stamped
SCHEMATIC. Neither state is allowed to look like real data.
"""

from __future__ import annotations

import json
import math
import pathlib
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Iterable

ROOT = pathlib.Path(__file__).resolve().parent.parent
FIGURES = ROOT / "src" / "data" / "figures"
MANUAL = ROOT / "pipeline" / "manual"

USER_AGENT = (
    "markets-first-principles/0.1 (+https://github.com/alessiomartini/markets-first-principles)"
)


def fetch(url: str, *, headers: dict[str, str] | None = None, retries: int = 4, timeout: int = 30) -> bytes:
    """GET with exponential backoff.

    Free data endpoints rate-limit and occasionally simply fail; a scheduled job
    that gives up on the first 503 will produce a repo full of stale figures.
    """
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})

    last: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError) as error:  # noqa: PERF203
            last = error
            if attempt < retries - 1:
                time.sleep(2**attempt)

    raise RuntimeError(f"failed to fetch {url}: {last}")


def fetch_json(url: str, **kwargs: Any) -> Any:
    return json.loads(fetch(url, **kwargs))


def write_figure(figure_id: str, payload: dict[str, Any], *, synthetic: bool = False) -> pathlib.Path:
    """Write one figure payload, rounding floats so diffs stay readable."""
    FIGURES.mkdir(parents=True, exist_ok=True)

    document = {
        "id": figure_id,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "synthetic": synthetic,
        **payload,
    }

    path = FIGURES / f"{figure_id}.json"
    path.write_text(json.dumps(_round(document), indent=1, ensure_ascii=False) + "\n", encoding="utf8")
    print(f"wrote {path.relative_to(ROOT)} ({len(payload.get('data', []))} rows, synthetic={synthetic})")
    return path


def _round(value: Any) -> Any:
    """Six significant figures is plenty for a chart and keeps the repo small."""
    if isinstance(value, float):
        if not math.isfinite(value):
            return None
        if value == 0:
            return 0.0
        return round(value, max(0, 6 - int(math.floor(math.log10(abs(value)))) - 1))
    if isinstance(value, dict):
        return {key: _round(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_round(item) for item in value]
    return value


def log_returns(closes: Iterable[float]) -> list[float]:
    series = [price for price in closes if price and price > 0]
    return [math.log(series[i] / series[i - 1]) for i in range(1, len(series))]


def survival_curve(returns: list[float], *, points: int = 60, x_min: float = 0.5, x_max: float = 30.0):
    """Empirical P(|r|/sigma > x) sampled on a log grid.

    Returns are normalised by their own sample standard deviation so that
    several assets can share one pair of axes — which is the entire point of the
    fat-tails figure.
    """
    if len(returns) < 100:
        raise ValueError("not enough observations for a tail estimate")

    mean = sum(returns) / len(returns)
    variance = sum((value - mean) ** 2 for value in returns) / (len(returns) - 1)
    sigma = math.sqrt(variance)
    if sigma <= 0:
        raise ValueError("degenerate series")

    magnitudes = sorted(abs(value - mean) / sigma for value in returns)
    total = len(magnitudes)

    curve = []
    for index in range(points):
        x = x_min * (x_max / x_min) ** (index / (points - 1))
        # Count of observations strictly above x, via the sorted array.
        low, high = 0, total
        while low < high:
            middle = (low + high) // 2
            if magnitudes[middle] > x:
                high = middle
            else:
                low = middle + 1
        exceedances = total - low
        if exceedances == 0:
            break
        curve.append({"x": x, "y": exceedances / total})

    return curve, sigma, total


def gaussian_reference(points: int = 60, x_min: float = 0.5, x_max: float = 30.0):
    """Two-sided Gaussian survival function, for the same axes."""
    curve = []
    for index in range(points):
        x = x_min * (x_max / x_min) ** (index / (points - 1))
        y = math.erfc(x / math.sqrt(2))
        if y < 1e-12:
            break
        curve.append({"x": x, "y": y})
    return curve
