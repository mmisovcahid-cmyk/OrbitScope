"""
Export the real-data snapshots used by the /presentation page (frontend/public/presentation/data).

Nothing is simulated: every file is a saved answer of the running OrbitScope backend, which itself
queries NASA/IPAC IRSA (SPHEREx), NASA/JPL (SBDB) and Gaia/SIMBAD. The presentation is shown on a
Raspberry Pi without internet, so these answers are stored as static files with their export date.

    cd backend
    python run.py                                    # in another terminal (needs internet on a cold cache)
    python -m scripts.export_presentation_assets     # writes ../frontend/public/presentation/data/*.json

Options: --api URL (default http://127.0.0.1:8000), --out DIR, --min-spectrum-points N.
Uses only the standard library.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "presentation" / "data"


def get(api: str, path: str, params: dict[str, object] | None = None, timeout: int = 900) -> dict:
    url = api.rstrip("/") + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=timeout) as resp:  # noqa: S310 - fixed local/known URL
        return json.loads(resp.read().decode("utf-8"))


def dump(out: Path, name: str, payload: dict) -> None:
    out.mkdir(parents=True, exist_ok=True)
    path = out / name
    path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"  wrote {path.name}: {path.stat().st_size / 1024:.1f} KB")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--min-spectrum-points", type=int, default=80)
    args = ap.parse_args()
    exported = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    print("targets and detector bands ...")
    t = get(args.api, "/api/v1/spherex/targets")["data"]
    dump(args.out, "targets.json", {
        "source": "OrbitScope /api/v1/spherex/targets (Gaia DR3 / SIMBAD positions, proper motion in mas/yr)",
        "exported_at": exported, **t})

    print("Barnard's Star, detector 3, one coadd per survey pass (real SPHEREx cutouts) ...")
    b = get(args.api, "/api/v1/spherex/blink", {"target": "Barnard's Star", "fov": 0.1, "detector": 3, "mode": "epoch",
                                                "per_epoch": 4, "max_frames": 12})["data"]
    dump(args.out, "barnard-frames.json", {
        "source": "NASA/IPAC IRSA - SPHEREx Level-2 spectral images, processed by OrbitScope (zodiacal light and local sky subtracted, "
                  "reprojected to a north-up TAN grid, inverse-variance coadd per survey pass)",
        "exported_at": exported, "detector": 3, "units": b["units"], "grid": b["grid"], "stretch_hint": b["stretch_hint"],
        "target": {k: b["target"][k] for k in ("name", "ra", "dec", "pmra", "pmdec", "ref_epoch")},
        "frames": [{"date": f["date"], "date_start": f["date_start"], "date_end": f["date_end"], "n_frames": f["n_frames"],
                    "wavelength_um": f["wavelength_um"], "target_px": f["target_px"], "data_b64": f["data"]} for f in b["frames"]],
    })

    print("epsilon Indi B spectrum (up to 96 exposures) ...")
    p = get(args.api, "/api/v1/spherex/photometry", {"target": "Epsilon Indi B", "detector": "all", "max_frames": 96})["data"]
    good = [x for x in p["points"] if not x["flagged"]]
    if len(good) < args.min_spectrum_points:
        print(f"only {len(good)} usable points (IRSA hiccup?). Re-run to fill the cache, or lower --min-spectrum-points.", file=sys.stderr)
        return 1
    dump(args.out, "epsindib-spectrum.json", {
        "source": "NASA/IPAC IRSA - SPHEREx Level-2 spectral images, aperture photometry by OrbitScope",
        "exported_at": exported, "position": p["position"], "aperture_arcsec": p["aperture_arcsec"], "units": p["units"],
        "n_points": p["n_points"], "n_good": p["n_good"],
        "points": [{"wl": x["wavelength_um"], "flux": x["flux_mjy"], "err": x["err_mjy"], "det": x["detector"], "date": x["date"][:10],
                    "flagged": x["flagged"]} for x in p["points"]],
    })

    print("extreme TNO orbits and Rayleigh statistics (live NASA/JPL SBDB) ...")
    c = get(args.api, "/api/v1/planetx/clustering")["data"]
    keep = [o for o in c["objects"] if o["in_sample"] or o["in_literature"]]
    dump(args.out, "planetx-orbits.json", {
        "source": c["source"], "exported_at": exported, "selection": c["selection"],
        "varpi": c["varpi"], "node": c["node"], "argperi": c["argperi"],
        "literature": {k: v for k, v in c["literature"].items() if k != "designations"},
        "objects": [{"des": o["designation"], "a": o["a_au"], "e": o["e"], "i": o["i_deg"], "q": o["q_au"], "om": o["om_deg"],
                     "w": o["w_deg"], "varpi": o["varpi_deg"],
                     "in_sample": o["in_sample"], "in_literature": o["in_literature"]} for o in keep],
    })
    print("done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
