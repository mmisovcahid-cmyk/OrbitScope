"""NEOSSat (CSA/CADC) path and the MAST Gaia fallback - offline.

The real-data test uses a real NEOSSat raw science frame of Barnard's Star (CADC, 2019-10-18)
and the Gaia DR3 stars around it, saved from the live services in ``tests/fixtures``.
"""
from __future__ import annotations

import asyncio
import json
import math
import time
from pathlib import Path

import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS
from fastapi.testclient import TestClient

from app.main import app
from app.services import neossat_archive as nm
from app.services.neossat_archive import NeossatError, NeossatFrame, neossat_archive
from app.services.spherex_archive import mjd_to_year, propagate

FIX = Path(__file__).parent / "fixtures"

# Real CADC TAP answer format (columns as requested by query_frames)
TAP_CSV = """observationID,target_name,time_bounds_lower,time_exposure,uri
2019291215900,BarnardStar,58774.91597287037,1.1005,cadc:NEOSSAT/NEOS_SCI_2019291215900.fits
2019291220036,BarnardStar,58774.91708564815,1.1005,cadc:NEOSSAT/NEOS_SCI_2019291220036.fits
2019337012448,BarnardStar,58820.05889074074,1.1005,cadc:NEOSSAT/NEOS_SCI_2019337012448.fits
2019337012448,BarnardStar,58820.05889074074,1.1005,cadc:NEOSSAT/2019337012448_raw_prev.png
"""


def test_parse_tap_rows_and_visits() -> None:
    frames = nm.parse_tap_rows(TAP_CSV)
    assert [f.file for f in frames] == [
        "NEOS_SCI_2019291215900.fits", "NEOS_SCI_2019291220036.fits", "NEOS_SCI_2019337012448.fits"]
    visits = nm.group_visits(frames)
    assert [len(v) for v in visits] == [2, 1]
    s = nm.summarize(frames)
    assert s["n_visits"] == 2 and s["total_frames"] == 3
    assert s["visits"][0]["targets"] == ["BarnardStar"]
    # CADC first, then the CSA open-data mirror (ASTRO/<year>/<day-of-year>/)
    urls = frames[2].urls()
    assert urls[0].endswith("/data/pub/NEOSSAT/NEOS_SCI_2019337012448.fits")
    assert urls[1].endswith("/NEOSSAT/ASTRO/2019/337/NEOS_SCI_2019337012448.fits")


def _star_image(xs, ys, fluxes, shape, sigma=1.2, noise=2.0, seed=1) -> np.ndarray:
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    img = rng.normal(0.0, noise, shape)
    for x, y, f in zip(xs, ys, fluxes):
        img += f * np.exp(-((xx - x) ** 2 + (yy - y) ** 2) / (2 * sigma ** 2))
    return img


def test_plate_solution_recovers_synthetic_field() -> None:
    ra0, dec0 = 120.0, 30.0
    true = WCS(naxis=2)
    true.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    true.wcs.crval = [ra0 + 0.01, dec0 - 0.008]       # boresight is ~40" off the true centre
    true.wcs.crpix = [128.5, 128.5]
    th = math.radians(35.0)
    s = 3.0 / 3600.0
    true.wcs.cd = [[-s * math.cos(th), s * math.sin(th)], [s * math.sin(th), s * math.cos(th)]]
    rng = np.random.default_rng(7)
    n = 60
    gra = ra0 + rng.uniform(-0.2, 0.2, n) / math.cos(math.radians(dec0))
    gdec = dec0 + rng.uniform(-0.2, 0.2, n)
    px, py = true.world_to_pixel_values(gra, gdec)
    inside = (px > 5) & (px < 250) & (py > 5) & (py < 250)
    img = _star_image(px[inside], py[inside], rng.uniform(80, 400, inside.sum()), (256, 256))
    img = img.astype(np.float32)

    xs, ys, _ = nm.detect_stars(img, noise=2.0)
    # the solver needs no exact roll: angle 35 deg is ~10 deg from this hint (roll + 270)
    sol, reason = nm.solve_frame(xs, ys, img.shape, gra, gdec, ra0, dec0, roll=35.0 - 270.0 + 10.0)
    assert sol is not None, reason
    assert sol.rms_arcsec < 0.6
    assert sol.scale_arcsec == pytest.approx(3.0, abs=0.02)
    ra_c, dec_c = sol.wcs.pixel_to_world_values(128.0, 64.0)
    ra_t, dec_t = true.pixel_to_world_values(128.0, 64.0)
    assert math.hypot((ra_c - ra_t) * math.cos(math.radians(dec0)), dec_c - dec_t) * 3600 < 0.5


def test_plate_solution_refuses_empty_or_unrelated_field() -> None:
    rng = np.random.default_rng(3)
    img = rng.normal(0, 2.0, (256, 256)).astype(np.float32)
    xs, ys, _ = nm.detect_stars(img, noise=2.0)
    gra, gdec = 10 + rng.uniform(-0.2, 0.2, 50), 5 + rng.uniform(-0.2, 0.2, 50)
    sol, reason = nm.solve_frame(xs, ys, img.shape, gra, gdec, 10.0, 5.0, 0.0)
    assert sol is None and reason == "too_few_stars"
    # stars that do not belong to this sky region: no solution, never a guessed one
    fx, fy = rng.uniform(10, 245, 20), rng.uniform(10, 245, 20)
    img2 = _star_image(fx, fy, np.full(20, 300.0), (256, 256)).astype(np.float32)
    xs, ys, _ = nm.detect_stars(img2, noise=2.0)
    sol, reason = nm.solve_frame(xs, ys, img2.shape, gra, gdec, 10.0, 5.0, 0.0)
    assert sol is None


def test_real_neossat_frame_solves_against_gaia() -> None:
    """Real raw frame of Barnard's Star: the solution must match Gaia to ~1" and put the star on a peak."""
    path = FIX / "neossat_barnard_2019291215900.fits"
    gaia = json.loads((FIX / "neossat_barnard_gaia.json").read_text(encoding="utf-8"))
    with fits.open(path) as hl:
        hdu = fits.PrimaryHDU(data=np.array(hl[0].data), header=hl[0].header.copy())
    frame = NeossatFrame("2019291215900", "BarnardStar", 58774.91597287037, 1.1005, path.name)
    cal = nm.calibrate(hdu, frame)
    assert cal.image.shape == (256, 256)            # data section only, overscan removed
    year = mjd_to_year(cal.mjd_mid)
    src = gaia["sources"]
    ref = [propagate(s["ra"], s["dec"], s["pmra"], s["pmdec"], 2016.0, year) for s in src]
    gra, gdec = np.array([r[0] for r in ref]), np.array([r[1] for r in ref])
    xs, ys, _ = nm.detect_stars(cal.image, cal.noise)
    sol, reason = nm.solve_frame(xs, ys, cal.image.shape, gra, gdec, cal.ra0, cal.dec0, cal.roll)
    assert sol is not None, reason
    assert sol.n_match >= 15 and sol.rms_arcsec < 1.5
    assert sol.scale_arcsec == pytest.approx(2.99, abs=0.03)
    # Barnard's Star (Gaia DR3 2016.0 + proper motion) must land on the brightest local peak
    from app.services.target_resolver import BUILTIN_TARGETS
    b = next(t for t in BUILTIN_TARGETS if t["id"] == "barnard")
    t_ra, t_dec = propagate(b["ra"], b["dec"], b["pmra"], b["pmdec"], b["ref_epoch"], year)
    tx, ty = sol.wcs.world_to_pixel_values(t_ra, t_dec)
    d = np.hypot(xs - tx, ys - ty)
    assert d.min() < 1.0  # within one 3" pixel of a detected star


def test_coverage_and_blink_endpoints(monkeypatch) -> None:
    async def no_frames(ra, dec, radius_deg=0.01):
        return []

    monkeypatch.setattr(neossat_archive, "query_frames", no_frames)
    with TestClient(app) as c:
        r = c.get("/api/v1/neossat/coverage", params={"ra": 10, "dec": 5})
        assert r.status_code == 200 and r.json()["data"]["total_frames"] == 0
        r = c.get("/api/v1/neossat/blink", params={"ra": 10, "dec": 5, "locale": "az"})
        assert r.status_code == 404
        assert "NEOSSat" in r.json()["detail"] and "müşahidə" in r.json()["detail"]

    async def down(ra, dec, radius_deg=0.01):
        raise NeossatError("upstream", "CADC TAP error (HTTP 503)")

    monkeypatch.setattr(neossat_archive, "query_frames", down)
    with TestClient(app) as c:
        r = c.get("/api/v1/neossat/coverage", params={"ra": 10, "dec": 5})
        assert r.status_code == 502 and "CADC" in r.json()["detail"]


def test_neossat_job(monkeypatch) -> None:
    from app.services import jobs as jobs_mod
    import app.api.routes.jobs as jr

    mgr = jobs_mod.JobManager()
    monkeypatch.setattr(jr, "job_manager", mgr)

    async def fake_build(**kw):
        return {"target": {}, "frames": [], "kw": kw}

    monkeypatch.setattr(neossat_archive, "build_blink", fake_build)
    with TestClient(app) as c:
        jid = c.post("/api/v1/jobs", json={"kind": "neossat_blink", "params": {"ra": 1, "dec": 2, "mode": "frames"}}).json()["data"]["id"]
        t0 = time.time()
        while time.time() - t0 < 5:
            d = c.get(f"/api/v1/jobs/{jid}").json()["data"]
            if d["status"] in ("done", "error"):
                break
            time.sleep(0.05)
        assert d["status"] == "done"
        assert d["result"]["kw"]["mode"] == "frames"
        bad = c.post("/api/v1/jobs", json={"kind": "neossat_blink", "params": {"ra": 1, "dec": 2, "fov": 0.5}})
        assert bad.status_code == 422


def test_neossat_endpoints_are_rate_limited() -> None:
    from app.core.rate_limit import is_limited

    assert is_limited("GET", "/api/v1/neossat/blink") and is_limited("GET", "/api/v1/neossat/coverage")


# ---------------------------------------------------------------- Gaia DR3: ESA, then MAST
VOTABLE = b"""<?xml version="1.0" encoding="utf-8"?>
<VOTABLE version="1.4" xmlns="http://www.ivoa.net/xml/VOTable/v1.3">
<RESOURCE type="results"><TABLE>
<FIELD name="source_id" datatype="long"/><FIELD name="ra" datatype="double"/><FIELD name="dec" datatype="double"/>
<FIELD name="pmra" datatype="double"/><FIELD name="pmdec" datatype="double"/><FIELD name="parallax" datatype="double"/>
<FIELD name="phot_g_mean_mag" datatype="float"/>
<DATA><TABLEDATA>
<TR><TD>4472832165289153024</TD><TD>269.4664606871366</TD><TD>4.705572810663312</TD><TD>0.578</TD><TD>-8.671</TD><TD>1.814</TD><TD>11.451174</TD></TR>
<TR><TD>4472832238306753024</TD><TD>269.4528420991245</TD><TD>4.71333322097457</TD><TD>12.55</TD><TD>25.58</TD><TD>2.34</TD><TD></TD></TR>
</TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>"""


def test_votable_rows_keep_empty_cells_empty() -> None:
    from app.services import catalog_overlay as co

    rows = co._votable_rows(VOTABLE)
    assert rows[0]["phot_g_mean_mag"].startswith("11.45") and rows[1]["phot_g_mean_mag"] == ""


def test_gaia_falls_back_to_mast(monkeypatch) -> None:
    from app.services import catalog_overlay as co

    async def esa_down(url, query, extra=None):
        raise co.CatalogError("catalog service error (HTTP 503)")

    seen = {}

    async def mast(url, query):
        seen["url"], seen["query"] = url, query
        return co._votable_rows(VOTABLE)

    monkeypatch.setattr(co, "_tap", esa_down)
    monkeypatch.setattr(co, "_tap_votable", mast)
    co._cache.clear()
    res = asyncio.run(co.fetch_catalog("gaia", 269.45, 4.70, 0.05))
    assert res["mirror"] == "MAST" and res["count"] == 2
    assert seen["url"] == co.MAST_GAIA_TAP and "dbo.gaia_source" in seen["query"]
    assert res["sources"][1]["mag"] is None

    async def mast_down(url, query):
        raise co.CatalogError("catalog service unreachable")

    monkeypatch.setattr(co, "_tap_votable", mast_down)
    co._cache.clear()
    with pytest.raises(co.CatalogError):
        asyncio.run(co.fetch_catalog("gaia", 269.45, 4.70, 0.06))
