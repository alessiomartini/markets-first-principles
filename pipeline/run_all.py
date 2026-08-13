#!/usr/bin/env python3
"""Run every fetch script, and report rather than abort on failure.

A free data source going down should degrade one figure, not the whole refresh.
The exit code is non-zero if anything failed, so CI still shows red and the
failure gets noticed — but the scripts that did work have already written their
payloads by then.
"""

from __future__ import annotations

import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent

SCRIPTS = [
    "fetch_order_book.py",
    "fetch_tails.py",
    "fetch_market_sizes.py",
]


def main() -> int:
    failures = []

    for name in SCRIPTS:
        print(f"\n=== {name} ===", flush=True)
        result = subprocess.run([sys.executable, str(HERE / name)], cwd=HERE, check=False)
        if result.returncode != 0:
            failures.append(name)

    print("\n=== summary ===")
    print(f"{len(SCRIPTS) - len(failures)}/{len(SCRIPTS)} scripts succeeded")
    for name in failures:
        print(f"  failed: {name}")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
