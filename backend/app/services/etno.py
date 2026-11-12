"""
OrbitScope - extreme TNO orbits from JPL and the Planet Nine clustering statistic
=================================================================================
The Planet Nine hypothesis (Batygin & Brown 2016) rests on the observation that distant,
detached Kuiper-belt objects have their orbits' perihelia (longitude of perihelion
varpi = Omega + omega) bunched in one direction. Here the orbits are fetched LIVE from the
JPL Small-Body Database and the clustering is measured with the Rayleigh test.

Caveat reported to the user: surveys find eTNOs only where they looked, so observational
selection can mimic clustering (Shankman et al. 2017; Napier et al. 2021).
"""
from __future__ import annotations

import asyncio
import math
from typing import Any

from cachetools import TTLCache

from app.core.logging_config import get_logger
from app.services import jpl_catalog as jc

logger = get_logger(__name__)

# Distant detached objects discussed in the Planet Nine literature (designations JPL understands).
ETNO_DESIGNATIONS = [
    "90377", "2012 VP113", "2004 VN112", "2010 GB174", "2013 SY99", "2014 SR349", "2015 TG387",
    "2007 TG422", "2013 RF98", "2015 RX245", "2014 FE72", "2013 FT28", "2015 KG163", "2016 QV89",
    "2016 QU89", "2018 VM35", "2015 BP519", "2013 UH15", "2003 SS422", "2000 CR105",
]
MIN_A_AU = 150.0
MIN_Q_AU = 30.0

_cache: TTLCache = TTLCache(maxsize=4, ttl=12 * 3600)


def rayleigh(angles_deg: list[float]) -> dict[str, float]:
    """Rayleigh test for a preferred direction (small-sample corrected p-value, Zar 2010)."""
    n = len(angles_deg)
    if n < 3:
        return {"n": n, "mean_deg": float("nan"), "R": float("nan"), "Z": float("nan"), "p": float("nan")}
    c = sum(math.cos(math.radians(a)) for a in angles_deg)
    s = sum(math.sin(math.radians(a)) for a in angles_deg)
    r_bar = math.hypot(c, s) / n
    z = n * r_bar**2
    p = math.exp(-z) * (1 + (2 * z - z**2) / (4 * n) - (24 * z - 132 * z**2 + 76 * z**3 - 9 * z**4) / (288 * n**2))
    return {"n": n, "mean_deg": round(math.degrees(math.atan2(s, c)) % 360.0, 1), "R": round(r_bar, 3),
            "Z": round(z, 3), "p": round(min(max(p, 0.0), 1.0), 5)}


async def _one(des: str) -> dict[str, Any] | None:
    try:
        res = await jc.sbdb_lookup(des)
    except Exception as exc:  # one missing object must not break the list
        logger.warning(f"eTNO lookup failed for {des}: {exc}")
        return None
    obj = res.get("match")
    if not obj:
        return None
    e = obj["elements"]
    if e.get("a_au") is None or e.get("om_deg") is None or e.get("w_deg") is None:
        return None
    return {
        "designation": obj["designation"], "name": obj["name"],
        "a_au": e["a_au"], "e": e["e"], "i_deg": e["i_deg"], "q_au": e["q_au"], "ad_au": e["ad_au"],
        "om_deg": e["om_deg"], "w_deg": e["w_deg"], "varpi_deg": round((e["om_deg"] + e["w_deg"]) % 360.0, 2),
        "H": obj["physical"].get("H"), "condition_code": obj["orbit_quality"].get("condition_code"),
        "url": obj["url"],
    }


async def etno_analysis() -> dict[str, Any]:
    if "result" in _cache:
        return _cache["result"]
    rows = [r for r in await asyncio.gather(*(_one(d) for d in ETNO_DESIGNATIONS)) if r]
    if not rows:
        raise jc.JPLUnavailable("no eTNO orbits could be retrieved")
    sample = [r for r in rows if r["a_au"] >= MIN_A_AU and r["q_au"] is not None and r["q_au"] >= MIN_Q_AU]
    for r in rows:
        r["in_sample"] = r in sample
    out = {
        "objects": sorted(rows, key=lambda r: -r["a_au"]),
        "selection": {"min_a_au": MIN_A_AU, "min_q_au": MIN_Q_AU},
        "varpi": rayleigh([r["varpi_deg"] for r in sample]),
        "node": rayleigh([r["om_deg"] for r in sample]),
        "argperi": rayleigh([r["w_deg"] for r in sample]),
        "source": "NASA/JPL Small-Body Database (live orbits)",
        "is_simulated": False,
    }
    out["missing"] = len(ETNO_DESIGNATIONS) - len(rows)
    if out["missing"] == 0:  # do not keep a partial result (e.g. one SBDB 503) for 12 hours
        _cache["result"] = out
    return out
