"""Offline tests for the real-data SPHEREx blink service (no network access)."""
from __future__ import annotations

import base64

import numpy as np
import pytest
from astropy.wcs import WCS
from fastapi.testclient import TestClient

from app.main import app
from app.services import spherex_archive as sa
from app.services.target_resolver import find_builtin, parse_coordinates


# ---------------------------------------------------------------- resolver
@pytest.mark.parametrize(
    "text, ra, dec",
    [
        ("269.452 4.693", 269.452, 4.693),
        ("269.452, -4.693", 269.452, -4.693),
        ("08h55m10.831s -7d14m42.53s", 133.795129, -7.245147),
        ("17:57:48.5 +04:41:36", 269.452083, 4.693333),
        ("17 57 48.5 +04 41 36", 269.452083, 4.693333),
    ],
)
def test_parse_coordinates(text: str, ra: float, dec: float) -> None:
    out = parse_coordinates(text)
    assert out is not None
    assert out[0] == pytest.approx(ra, abs=1e-4)
    assert out[1] == pytest.approx(dec, abs=1e-4)


@pytest.mark.parametrize("text", ["Barnard's Star", "M31", "400 10", "12 -95", ""])
def test_parse_coordinates_rejects_names_and_out_of_range(text: str) -> None:
    assert parse_coordinates(text) is None


@pytest.mark.parametrize("text, tid", [("Barnard's Star", "barnard"), ("eps indi b", "eps-indi-b"),
                                       ("WISE 0855-0714", "wise-0855"), ("RW Aur", "rw-aur"), ("r draconis", "r-dra")])
def test_builtin_targets(text: str, tid: str) -> None:
    t = find_builtin(text)
    assert t is not None and t["id"] == tid


def test_proper_motion_propagation_barnard() -> None:
    # Barnard's Star moves ~10.36"/yr north: 10 years -> ~103.6"
    ra, dec = sa.propagate(269.4485, 4.7394, -801.551, 10362.394, 2016.0, 2026.0)
    assert (dec - 4.7394) * 3600 == pytest.approx(103.62, abs=0.05)
    assert ra < 269.4485


# ---------------------------------------------------------------- grouping
def _rec(mjd: float, det: int = 3) -> sa.FrameRecord:
    return sa.FrameRecord(obs_id=f"OBS{mjd:.0f}_{det}", collection="spherex_qr2", detector=det, mjd=mjd,
                          em_min_um=1.6, em_max_um=2.4)


def test_group_epochs_splits_on_gaps() -> None:
    frames = [_rec(m) for m in (60900, 60905, 60912, 61110, 61120, 61270)]
    groups = sa.group_epochs(frames)
    assert [len(g) for g in groups] == [3, 2, 1]


def test_select_groups_limits_downloads() -> None:
    frames = [_rec(60900 + i) for i in range(20)] + [_rec(61200 + i) for i in range(20)]
    epochs = sa.select_groups(frames, "epoch", per_epoch=4, max_frames=16)
    assert len(epochs) == 2 and all(len(g) == 4 for g in epochs)
    singles = sa.select_groups(frames, "frames", per_epoch=4, max_frames=10)
    assert len(singles) == 10 and all(len(g) == 1 for g in singles)
    assert [g[0].mjd for g in singles] == sorted(g[0].mjd for g in singles)


# ---------------------------------------------------------------- imaging
def test_fill_saturated_holes_fills_interior_only() -> None:
    img = np.ones((21, 21), np.float32)
    img[9:12, 9:12] = np.nan  # saturated core
    img[0, 0:3] = np.nan  # edge gap must stay NaN
    out, filled = sa.fill_saturated_holes(img)
    assert np.isfinite(out[10, 10]) and filled[10, 10]
    assert np.isnan(out[0, 1]) and not filled[0, 1]


def _cutout(shift_px: float = 0.0) -> sa.Cutout:
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    w.wcs.crval = [100.0, 10.0]
    w.wcs.crpix = [31.0 + shift_px, 31.0]
    w.wcs.cdelt = [-6.15 / 3600, 6.15 / 3600]
    yy, xx = np.mgrid[0:61, 0:61]
    image = np.exp(-(((xx - 30 - shift_px) ** 2 + (yy - 30) ** 2) / 4.0)).astype(np.float32) * 100
    flags = np.zeros_like(image, dtype=np.int64)
    flags[5, 5] = 1 << sa.DEFAULT_FLAG_BITS["HOT"]
    return sa.Cutout(_rec(60900), "u", image, flags, np.ones_like(image), w, 60900.0, 2.0, dict(sa.DEFAULT_FLAG_BITS))


def test_reproject_keeps_star_at_sky_position() -> None:
    out_wcs = sa.make_target_wcs(100.0, 10.0, 31, 6.15)
    yy, xx = np.mgrid[0:31, 0:31]
    wr, wd = out_wcs.pixel_to_world_values(xx, yy)
    for shift in (0.0, 3.0):  # pointing offset must not move the star on the sky grid
        img, var, mask, _ = sa.reproject_cutout(_cutout(shift), wr, wd)
        y, x = np.unravel_index(np.nanargmax(img), img.shape)
        assert (x, y) == (15, 15)


def test_reproject_masks_flagged_pixels() -> None:
    c = _cutout()
    out_wcs = sa.make_target_wcs(100.0, 10.0, 61, 6.15)
    yy, xx = np.mgrid[0:61, 0:61]
    wr, wd = out_wcs.pixel_to_world_values(xx, yy)
    img, _, mask, stats = sa.reproject_cutout(c, wr, wd)
    assert mask[5, 5] and np.isnan(img[5, 5])
    assert stats.get("HOT", 0) > 0


def test_assemble_coadds_and_encodes(tmp_path) -> None:
    arch = sa.SpherexArchive(cache_dir=tmp_path)
    c1, c2 = _cutout(), _cutout()
    c2.record = _rec(60901)
    out_wcs = sa.make_target_wcs(100.0, 10.0, 31, 6.15)
    frames = arch._assemble([[c1.record, c2.record]], {c1.record.key: c1, c2.record.key: c2},
                            out_wcs, 31, 100.0, 10.0, None, None, 2000.0, False)
    assert len(frames) == 1 and frames[0]["n_frames"] == 2
    arr = np.frombuffer(base64.b64decode(frames[0]["data"]), dtype="<f4").reshape(31, 31)
    assert np.nanargmax(arr) == 15 * 31 + 15
    assert frames[0]["target_px"] == [15.0, 15.0]


# ---------------------------------------------------------------- API (offline paths)
@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as c:
        yield c


def test_targets_endpoint(client: TestClient) -> None:
    res = client.get("/api/v1/spherex/targets")
    assert res.status_code == 200
    ids = {t["id"] for t in res.json()["data"]["targets"]}
    assert {"barnard", "eps-indi-b", "wise-0855", "rw-aur", "r-dra"} <= ids


def test_resolve_coordinates_endpoint(client: TestClient) -> None:
    res = client.get("/api/v1/spherex/resolve", params={"q": "08h55m10.831s -7d14m42.53s"})
    assert res.status_code == 200
    assert res.json()["data"]["ra"] == pytest.approx(133.795129, abs=1e-4)


def test_blink_rejects_bad_detector_localized(client: TestClient) -> None:
    res = client.get("/api/v1/spherex/blink", params={"ra": 10, "dec": 10, "detector": "9", "locale": "az"})
    assert res.status_code == 400
    assert "Detektor" in res.json()["detail"]


def test_blink_validates_fov(client: TestClient) -> None:
    assert client.get("/api/v1/spherex/blink", params={"ra": 10, "dec": 10, "fov": 5}).status_code == 422
