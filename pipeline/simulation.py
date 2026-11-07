"""Deterministic return generators shared by the simulated figure scripts.

Standard library only. Everything here is a model, not data: the scripts that
use it stamp their payloads ``synthetic: true``.
"""

from __future__ import annotations

import math
import random

SEED = 20261031


def gjr_garch(n, rng, *, alpha, gamma, beta, daily_vol=0.01, burn=500, shocks=None):
    """GJR-GARCH(1,1) returns; gamma > 0 makes bad news raise volatility more.

    ``shocks`` maps a day index to a multiplier applied to that day's variance
    (an exogenous stress, used to mimic crisis windows). Returns (returns, sigma).
    """
    persistence = alpha + gamma / 2 + beta
    omega = daily_vol**2 * (1 - persistence)
    s2 = daily_vol**2
    rets, sig = [], []
    for t in range(n + burn):
        v = s2 * (shocks.get(t - burn, 1.0) if shocks else 1.0)
        r = math.sqrt(v) * rng.gauss(0, 1)
        if t >= burn:
            rets.append(r)
            sig.append(math.sqrt(v))
        s2 = omega + (alpha + (gamma if r < 0 else 0.0)) * r * r + beta * s2
    return rets, sig


def multiscale_sv(n, rng, *, daily_vol=0.01, times=(5, 60, 600), sd=0.25):
    """Stochastic-volatility returns whose log-volatility is a sum of AR(1)
    components with different memory, which gives a slowly decaying
    autocorrelation of absolute returns."""
    phis = [1 - 1 / tau for tau in times]
    comps = [0.0] * len(times)
    out = []
    for _ in range(n):
        for i, phi in enumerate(phis):
            comps[i] = phi * comps[i] + sd * math.sqrt(1 - phi**2) * rng.gauss(0, 1)
        h = sum(comps) - len(times) * sd**2 / 2
        out.append(daily_vol * math.exp(h) * rng.gauss(0, 1))
    return out


def acf(x, lags):
    n = len(x)
    m = sum(x) / n
    d = [v - m for v in x]
    var = sum(v * v for v in d)
    return {k: sum(d[i] * d[i + k] for i in range(n - k)) / var for k in lags}
