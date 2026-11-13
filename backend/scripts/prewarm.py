"""Download the SPHEREx data for the five challenge targets ahead of a demo.

The first view of a new field downloads 16-60 cutouts from IRSA (30-90 s, and IRSA sometimes
answers 503). Running this once before a presentation fills the on-disk cutout cache, so every
test target opens immediately for the audience. Re-running it is cheap: cached cutouts are reused.

    cd backend
    python -m scripts.prewarm                 # blink (default view) + spectrum for all 5 targets
    python -m scripts.prewarm --targets barnard,wise-0855 --no-photometry
    python -m scripts.prewarm --all-detectors # also the blink views for detectors 1-6

In Docker:  docker compose exec backend python -m scripts.prewarm
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.routes import spherex as sx  # noqa: E402
from app.services.spherex_archive import spherex_archive  # noqa: E402
from app.services.target_resolver import BUILTIN_TARGETS  # noqa: E402

# Same defaults as the Blink page (frontend/src/lib/spherex.ts DEFAULT_QUERY).
BLINK_DEFAULTS = dict(fov=0.1, mode="epoch", per_epoch=4, max_frames=16)
PHOT_MAX_FRAMES = 60  # PhotometryPanel default


async def warm_target(t: dict, detectors: list[int], photometry: bool) -> list[str]:
    lines = []
    for det in detectors:
        t0 = time.perf_counter()
        try:
            res = await sx._build(t["name"], None, None, None, None, None, BLINK_DEFAULTS["fov"], str(det),
                                  BLINK_DEFAULTS["mode"], BLINK_DEFAULTS["per_epoch"], BLINK_DEFAULTS["max_frames"], "en")
            lines.append(f"  blink D{det}: {len(res['frames'])} frames  ({time.perf_counter() - t0:.0f} s)")
        except Exception as exc:  # noqa: BLE001 - report and continue with the next target
            lines.append(f"  blink D{det}: FAILED - {getattr(exc, 'detail', exc)}")
    if photometry:
        t0 = time.perf_counter()
        try:
            d = await spherex_archive.photometry(ra=t["ra"], dec=t["dec"], detectors=None, max_frames=PHOT_MAX_FRAMES,
                                                 pmra=t.get("pmra"), pmdec=t.get("pmdec"),
                                                 ref_epoch=t.get("ref_epoch") or 2000.0)
            lines.append(f"  spectrum/light curve: {d['n_good']}/{d['n_points']} good points  ({time.perf_counter() - t0:.0f} s)")
        except Exception as exc:  # noqa: BLE001
            lines.append(f"  spectrum/light curve: FAILED - {exc}")
    return lines


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--targets", default="all", help="comma list of ids (barnard, eps-indi-b, wise-0855, rw-aur, r-dra)")
    ap.add_argument("--all-detectors", action="store_true", help="warm detectors 1-6, not only each target's default")
    ap.add_argument("--no-photometry", action="store_true", help="skip the spectrum / light curve")
    args = ap.parse_args()

    wanted = None if args.targets == "all" else {x.strip() for x in args.targets.split(",")}
    targets = [t for t in BUILTIN_TARGETS if wanted is None or t["id"] in wanted]
    if not targets:
        print("No matching targets. Ids: " + ", ".join(t["id"] for t in BUILTIN_TARGETS))
        return 2

    failed = False
    t_all = time.perf_counter()
    for t in targets:  # one target at a time: kind to IRSA, and progress is readable
        dets = [1, 2, 3, 4, 5, 6] if args.all_detectors else [int(t.get("detector", 3))]
        print(f"{t['name']} ...", flush=True)
        lines = await warm_target(t, dets, not args.no_photometry)
        failed |= any("FAILED" in ln for ln in lines)
        print("\n".join(lines), flush=True)
    stats = spherex_archive.cache_stats()
    print(f"\nDone in {time.perf_counter() - t_all:.0f} s. Cache: {stats.get('cutouts')} cutouts, {stats.get('size_mb')} MB")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
