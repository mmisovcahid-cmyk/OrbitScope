"""
OrbitScope - NASA/JPL API Client
================================
Asynchronous client for NASA/JPL Small-Body Database (SBDB) and Horizons APIs.
Supports object searches, orbital and physical parameters retrieval, close-approach data,
ephemeris calculations, and spatial cone queries with caching and simulated fallbacks.
"""
from __future__ import annotations

import asyncio
import math
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Union

import httpx

from app.core.cache import catalog_cache
from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.schemas import (
    CatalogObject,
    CloseApproach,
    EphemerisEntry,
    OrbitalElements,
    PhysicalParams,
)

logger = get_logger(__name__)


def _parse_ra_dms(ra_str: str) -> float:
    """Convert RA string (HH MM SS.ss) to decimal degrees [0, 360)."""
    parts = ra_str.strip().split()
    if len(parts) >= 3:
        h, m, s = float(parts[0]), float(parts[1]), float(parts[2])
        return ((h + m / 60.0 + s / 3600.0) * 15.0) % 360.0
    elif len(parts) == 1:
        return float(parts[0])
    return 0.0


def _parse_dec_dms(dec_str: str) -> float:
    """Convert Dec string ([+/-]DD MM SS.s) to decimal degrees [-90, +90]."""
    dec_str = dec_str.strip()
    sign = -1.0 if dec_str.startswith("-") else 1.0
    clean = dec_str.lstrip("+-")
    parts = clean.split()
    if len(parts) >= 3:
        d, m, s = float(parts[0]), float(parts[1]), float(parts[2])
        return sign * (d + m / 60.0 + s / 3600.0)
    elif len(parts) == 1:
        return sign * float(parts[0])
    return 0.0


def _angular_separation_deg(ra1: float, dec1: float, ra2: float, dec2: float) -> float:
    """Compute great-circle angular distance between two sky points in degrees."""
    r1, d1 = math.radians(ra1), math.radians(dec1)
    r2, d2 = math.radians(ra2), math.radians(dec2)
    cos_sep = math.sin(d1) * math.sin(d2) + math.cos(d1) * math.cos(d2) * math.cos(r1 - r2)
    cos_sep = max(-1.0, min(1.0, cos_sep))
    return math.degrees(math.acos(cos_sep))


class JPLClient:
    """
    Client for NASA/JPL Small-Body Database (SBDB) and Horizons System.
    Connects to live JPL REST endpoints, caches queries in TTLCache,
    and returns strongly-typed Pydantic schemas.
    """

    def __init__(self, timeout: float = 25.0) -> None:
        self.sbdb_url: str = settings.JPL_SBDB_URL
        self.horizons_url: str = settings.JPL_HORIZONS_URL
        self.timeout: float = timeout

    # ------------------------------------------------------------------------
    # SBDB Helpers
    # ------------------------------------------------------------------------

    def _parse_sbdb_payload(self, data: Dict[str, Any], is_simulated: bool = False) -> CatalogObject:
        """Parse raw JSON dict from JPL SBDB API into a CatalogObject model."""
        obj = data.get("object", {})
        orbit = data.get("orbit", {})
        elements_list = orbit.get("elements", [])
        phys_list = data.get("phys_par", [])
        ca_list = data.get("ca_data", [])

        # Map orbital elements by label/name
        elem_map: Dict[str, float] = {}
        for el in elements_list:
            if isinstance(el, dict) and "name" in el and "value" in el:
                try:
                    elem_map[el["name"]] = float(el["value"])
                except (ValueError, TypeError):
                    pass

        # Map physical parameters
        phys_map: Dict[str, float] = {}
        for p in phys_list:
            if isinstance(p, dict) and "name" in p and "value" in p:
                try:
                    phys_map[p["name"]] = float(p["value"])
                except (ValueError, TypeError):
                    pass

        # Parse close approaches
        close_approaches: List[CloseApproach] = []
        if isinstance(ca_list, list):
            for ca in ca_list:
                if isinstance(ca, dict):
                    try:
                        dist_au = float(ca.get("dist", 0.0))
                        v_rel = float(ca.get("v_rel", 0.0)) if ca.get("v_rel") else None
                        close_approaches.append(
                            CloseApproach(
                                date=str(ca.get("cd", "")),
                                body=str(ca.get("body", "Earth")),
                                distance_au=dist_au,
                                distance_km=dist_au * 1.495978707e8 if dist_au else None,
                                velocity_km_s=v_rel,
                            )
                        )
                    except (ValueError, TypeError):
                        continue

        # Orbital element values
        a_au = elem_map.get("a")
        e_val = elem_map.get("e")
        i_deg = elem_map.get("i")
        q_au = elem_map.get("q")
        ad_au = elem_map.get("ad")
        per_d = elem_map.get("per")
        period_yr = (per_d / 365.25) if per_d else None

        # Physical parameters values
        h_mag = phys_map.get("H")
        diam = phys_map.get("diameter")
        albedo = phys_map.get("albedo")

        # Object metadata
        designation = str(obj.get("des") or obj.get("spkid") or "Unknown")
        fullname = obj.get("fullname") or obj.get("shortname") or designation
        orbit_class_info = obj.get("orbit_class", {})
        if isinstance(orbit_class_info, dict):
            orbit_class_name = orbit_class_info.get("name") or orbit_class_info.get("code")
        else:
            orbit_class_name = str(orbit_class_info) if orbit_class_info else None

        kind = obj.get("kind", "")
        if "comet" in kind.lower() or designation.startswith(("C/", "P/")):
            object_type = "comet"
        elif "tno" in str(orbit_class_name).lower() or (a_au and a_au > 30.1):
            object_type = "tno"
        elif obj.get("neo"):
            object_type = "neo"
        else:
            object_type = "asteroid"

        orbital_sub = OrbitalElements(
            semi_major_axis_au=a_au,
            eccentricity=e_val,
            inclination_deg=i_deg,
            longitude_asc_node_deg=elem_map.get("om"),
            argument_perihelion_deg=elem_map.get("w"),
            mean_anomaly_deg=elem_map.get("ma"),
            perihelion_dist_au=q_au,
            aphelion_dist_au=ad_au,
            orbital_period_years=period_yr,
            epoch_jd=elem_map.get("epoch"),
        )

        physical_sub = PhysicalParams(
            diameter_km=diam,
            albedo=albedo,
            abs_magnitude=h_mag,
            rotation_period_hours=phys_map.get("rot_per"),
        )

        return CatalogObject(
            designation=designation,
            name=fullname,
            object_type=object_type,
            orbit_class=orbit_class_name,
            orbital_elements=orbital_sub,
            physical_params=physical_sub,
            close_approaches=close_approaches,
            semi_major_axis_au=a_au,
            eccentricity=e_val,
            inclination_deg=i_deg,
            perihelion_au=q_au,
            aphelion_au=ad_au,
            period_yr=period_yr,
            absolute_magnitude=h_mag,
            diameter_km=diam,
            albedo=albedo,
            last_obs=orbit.get("last_obs"),
            data_source="JPL SBDB" if not is_simulated else "OrbitScope Demo",
            is_simulated=is_simulated,
            is_neo=bool(obj.get("neo", False)),
            is_pha=bool(obj.get("pha", False)),
        )

    # ------------------------------------------------------------------------
    # Public API Methods
    # ------------------------------------------------------------------------

    async def search_small_body(self, query: str, limit: int = 20) -> List[CatalogObject]:
        """
        Search JPL SBDB by name or designation.
        Queries endpoint: https://ssd-api.jpl.nasa.gov/sbdb.api?sstr={query}&phys-par=1&orbit=1
        Handles single match (HTTP 200) and multiple choices (HTTP 300).
        Returns a list of CatalogObject models.
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        cache_key = f"sbdb_search:{clean_query.lower()}:{limit}"
        cached = catalog_cache.get(cache_key)
        if cached is not None:
            logger.debug(f"Catalog cache hit for SBDB search: '{clean_query}'")
            return cached

        params = {
            "sstr": clean_query,
            "phys-par": "1",
            "ca-data": "1",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(self.sbdb_url, params=params)

                # HTTP 200: Exact match or not found message
                if response.status_code == 200:
                    data = response.json()
                    # Check for not found code in body
                    if data.get("code") == "200" and "not found" in data.get("message", "").lower():
                        logger.info(f"SBDB object not found for query: '{clean_query}'")
                        catalog_cache.set(cache_key, [])
                        return []

                    if "object" in data:
                        parsed = self._parse_sbdb_payload(data, is_simulated=False)
                        catalog_cache.set(cache_key, [parsed])
                        return [parsed]

                    return []

                # HTTP 300: Multiple matches found
                elif response.status_code == 300:
                    data = response.json()
                    candidates = data.get("list", [])
                    results: List[CatalogObject] = []

                    # Limit number of candidate lookups to avoid rate limits
                    top_candidates = candidates[: min(limit, 5)]
                    for cand in top_candidates:
                        pdes = cand.get("pdes") or cand.get("name")
                        if pdes:
                            try:
                                obj_detail = await self.get_object_details(str(pdes))
                                if obj_detail:
                                    results.append(obj_detail)
                            except Exception:
                                # Construct basic entry if detailed lookup fails
                                results.append(
                                    CatalogObject(
                                        designation=str(cand.get("pdes", clean_query)),
                                        name=str(cand.get("name", pdes)),
                                        object_type="asteroid",
                                        data_source="JPL SBDB",
                                        is_simulated=False,
                                    )
                                )

                    catalog_cache.set(cache_key, results)
                    return results

                elif response.status_code == 404:
                    catalog_cache.set(cache_key, [])
                    return []

                else:
                    logger.warning(f"SBDB returned HTTP {response.status_code} for '{clean_query}'")

        except Exception as exc:
            logger.warning(f"Live SBDB search failed for '{clean_query}': {exc}. Checking demo fallback.")

        # Fallback to simulated data if demo mode is enabled
        if settings.DEMO_MODE:
            demo_results = self._generate_simulated_search(clean_query, limit)
            catalog_cache.set(cache_key, demo_results)
            return demo_results

        return []

    async def get_object_details(self, designation: str) -> Optional[CatalogObject]:
        """
        Get detailed object info from SBDB for an exact designation.
        Endpoint: https://ssd-api.jpl.nasa.gov/sbdb.api?sstr={designation}&phys-par=1&orbit=1&ca-data=1
        """
        clean_des = designation.strip()
        if not clean_des:
            return None

        cache_key = f"sbdb_details:{clean_des.lower()}"
        cached = catalog_cache.get(cache_key)
        if cached is not None:
            return cached

        params = {
            "sstr": clean_des,
            "phys-par": "1",
            "ca-data": "1",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(self.sbdb_url, params=params)
                if response.status_code == 200:
                    data = response.json()
                    if "object" in data:
                        parsed = self._parse_sbdb_payload(data, is_simulated=False)
                        catalog_cache.set(cache_key, parsed)
                        return parsed
        except Exception as exc:
            logger.warning(f"SBDB details fetch failed for '{clean_des}': {exc}")

        if settings.DEMO_MODE:
            sim = self._generate_simulated_object(clean_des)
            catalog_cache.set(cache_key, sim)
            return sim

        return None

    async def get_close_approaches(self, designation: str) -> List[Dict[str, Any]]:
        """
        Get close approach data for a solar system body.
        Returns list of approach dicts containing date, body, distance_au, velocity_km_s.
        """
        obj = await self.get_object_details(designation)
        if obj and obj.close_approaches:
            return [ca.model_dump() for ca in obj.close_approaches]

        # Generate realistic simulated close approach if in demo mode
        if settings.DEMO_MODE:
            now = datetime.now(timezone.utc)
            return [
                {
                    "date": (now + timedelta(days=120)).strftime("%Y-%b-%d %H:%M"),
                    "body": "Earth",
                    "distance_au": 0.0485,
                    "distance_km": 7255000.0,
                    "velocity_km_s": 14.8,
                    "is_simulated": True,
                },
                {
                    "date": (now + timedelta(days=580)).strftime("%Y-%b-%d %H:%M"),
                    "body": "Earth",
                    "distance_au": 0.1240,
                    "distance_km": 18550000.0,
                    "velocity_km_s": 18.2,
                    "is_simulated": True,
                },
            ]
        return []

    async def get_ephemeris(
        self,
        target: str,
        start_time: str,
        stop_time: Optional[str] = None,
        step_size: str = "1d",
    ) -> List[EphemerisEntry]:
        """
        Get ephemeris from JPL Horizons API.
        Endpoint: https://ssd.jpl.nasa.gov/api/horizons.api
        Queries observer table with geocentric coordinates (CENTER='500@399')
        QUANTITIES='1,9,19,20,23,24' (RA/Dec, Mag, r, delta, Elongation, Phase angle).
        Parses the text output between $$SOE and $$EOE markers.
        """
        clean_target = target.strip()
        stop_time_val = stop_time or start_time

        # Format start time if 'now'
        if start_time.lower() == "now":
            start_dt = datetime.now(timezone.utc)
            start_time_formatted = start_dt.strftime("%Y-%m-%d %H:%M")
            stop_time_formatted = (start_dt + timedelta(days=7)).strftime("%Y-%m-%d %H:%M")
        else:
            start_time_formatted = start_time
            stop_time_formatted = stop_time_val

        cache_key = f"horizons_ephem:{clean_target}:{start_time_formatted}:{stop_time_formatted}:{step_size}"
        cached = catalog_cache.get(cache_key)
        if cached is not None:
            return cached

        params = {
            "format": "json",
            "COMMAND": f"'{clean_target}'",
            "EPHEM_TYPE": "'OBSERVER'",
            "CENTER": "'500@399'",
            "START_TIME": f"'{start_time_formatted}'",
            "STOP_TIME": f"'{stop_time_formatted}'",
            "STEP_SIZE": f"'{step_size}'",
            "QUANTITIES": "'1,9,19,20,23,24'",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(self.horizons_url, params=params)
                if response.status_code == 200:
                    data = response.json()
                    result_text = data.get("result", "")
                    parsed_entries = self._parse_horizons_text(clean_target, result_text)
                    if parsed_entries:
                        catalog_cache.set(cache_key, parsed_entries)
                        return parsed_entries
        except Exception as exc:
            logger.warning(f"JPL Horizons API query failed for '{clean_target}': {exc}")

        # Fallback to simulated ephemeris
        if settings.DEMO_MODE:
            sim_entries = self._generate_simulated_ephemeris(
                clean_target, start_time_formatted, stop_time_formatted, step_size
            )
            catalog_cache.set(cache_key, sim_entries)
            return sim_entries

        return []

    def _parse_horizons_text(self, target: str, text: str) -> List[EphemerisEntry]:
        """Parse raw Horizons plain-text block between $$SOE and $$EOE markers."""
        entries: List[EphemerisEntry] = []
        soe_idx = text.find("$$SOE")
        eoe_idx = text.find("$$EOE")

        if soe_idx == -1 or eoe_idx == -1 or eoe_idx <= soe_idx:
            return entries

        data_block = text[soe_idx + 5 : eoe_idx].strip()
        lines = [line.strip() for line in data_block.splitlines() if line.strip()]

        for line in lines:
            try:
                tokens = re.split(r"\s+", line)
                if len(tokens) < 8:
                    continue

                # Token 0 and 1: Date and Time (e.g. 2026-Jan-01 00:00)
                dt_str = f"{tokens[0]} {tokens[1]}"

                # Token 2, 3, 4: RA HMS
                ra_str = f"{tokens[2]} {tokens[3]} {tokens[4]}"
                ra_deg = _parse_ra_dms(ra_str)

                # Token 5, 6, 7: Dec DMS
                dec_str = f"{tokens[5]} {tokens[6]} {tokens[7]}"
                dec_deg = _parse_dec_dms(dec_str)

                # Remaining tokens vary depending on whether quantities 19, 20 are included
                # Search for numerical float tokens after token 7
                numeric_tokens: List[float] = []
                for tok in tokens[8:]:
                    cleaned_tok = tok.rstrip("/T").rstrip("/L")
                    try:
                        numeric_tokens.append(float(cleaned_tok))
                    except ValueError:
                        pass

                # Typical ordering: APmag, S-brt, r, rdot, delta, deldot, S-O-T, S-T-O
                mag: Optional[float] = None
                r_au: float = 1.0
                delta_au: float = 1.0
                elong: Optional[float] = None
                phase: Optional[float] = None

                if len(numeric_tokens) >= 1:
                    mag = numeric_tokens[0] if numeric_tokens[0] > 0 else None
                if len(numeric_tokens) >= 3:
                    r_au = numeric_tokens[1]
                    delta_au = numeric_tokens[2]
                elif len(numeric_tokens) == 2:
                    delta_au = numeric_tokens[1]
                if len(numeric_tokens) >= 5:
                    elong = numeric_tokens[3]
                    phase = numeric_tokens[4]

                entries.append(
                    EphemerisEntry(
                        target=target,
                        datetime_str=dt_str,
                        ra=round(ra_deg, 5),
                        dec=round(dec_deg, 5),
                        delta_au=round(delta_au, 4),
                        r_au=round(r_au, 4),
                        magnitude=round(mag, 2) if mag is not None else None,
                        elongation=round(elong, 2) if elong is not None else None,
                        elongation_deg=round(elong, 2) if elong is not None else None,
                        phase_angle_deg=round(phase, 2) if phase is not None else None,
                        is_simulated=False,
                    )
                )
            except Exception as e:
                logger.debug(f"Skipping unparseable Horizons line: {line} ({e})")
                continue

        return entries

    async def find_nearby_objects(
        self,
        ra: float,
        dec: float,
        radius_deg: float = 1.0,
        radius_arcsec: Optional[float] = None,
    ) -> List[CatalogObject]:
        """
        Find known catalog objects near coordinates (ra, dec) within search radius.
        Uses ephemerides of known major outer solar system objects and asteroids,
        or generates simulated solar system objects when in demo mode.
        """
        effective_radius = (radius_arcsec / 3600.0) if radius_arcsec is not None else radius_deg
        cache_key = f"nearby_objects:{ra:.3f}:{dec:.3f}:{effective_radius:.3f}"
        cached = catalog_cache.get(cache_key)
        if cached is not None:
            return cached

        # One JPL SB Ident query covers every known asteroid/comet in the field (the former loop
        # over eight Horizons ephemerides took minutes and only knew eight bodies).
        try:
            from app.services.jpl_catalog import known_in_field

            field = await known_in_field(ra, dec, max(effective_radius, 0.01))
            live = [
                CatalogObject(
                    designation=o["name"].split(" (")[0], name=o["name"],
                    object_type="comet" if o["kind"] == "comet" else "asteroid",
                    data_source="JPL SB Ident", is_simulated=False, ra=o["ra"], dec=o["dec"],
                )
                for o in field["objects"]
            ]
            catalog_cache.set(cache_key, live)
            return live
        except Exception as exc:
            logger.warning(f"SB Ident field search failed: {exc}")

        nearby_objects: List[CatalogObject] = []

        # JPL unreachable: demo mode returns clearly labelled [SIMULATED] objects, otherwise nothing.
        if settings.DEMO_MODE:
            simulated = self._generate_simulated_nearby(ra, dec, effective_radius)
            catalog_cache.set(cache_key, simulated)
            return simulated

        catalog_cache.set(cache_key, nearby_objects)
        return nearby_objects

    # ------------------------------------------------------------------------
    # Simulated / Demo Data Generators
    # ------------------------------------------------------------------------

    def _generate_simulated_search(self, query: str, limit: int) -> List[CatalogObject]:
        """Generate clearly labeled simulated CatalogObject results for demo fallback."""
        sim_objects = [
            CatalogObject(
                designation="SIM-90377",
                name=f"[SIMULATED] 90377 Sedna-like TNO ({query})",
                object_type="tno",
                orbit_class="Detached TNO",
                semi_major_axis_au=506.0,
                eccentricity=0.855,
                inclination_deg=11.93,
                perihelion_au=76.2,
                aphelion_au=936.0,
                period_yr=11400.0,
                absolute_magnitude=1.5,
                diameter_km=995.0,
                albedo=0.32,
                data_source="OrbitScope Simulated Demo",
                is_simulated=True,
            ),
            CatalogObject(
                designation="SIM-P9-CAND1",
                name="[SIMULATED] Planet Nine Search Field Candidate Alpha",
                object_type="tno",
                orbit_class="Extreme TNO",
                semi_major_axis_au=450.0,
                eccentricity=0.62,
                inclination_deg=18.5,
                perihelion_au=171.0,
                aphelion_au=729.0,
                period_yr=9540.0,
                absolute_magnitude=4.2,
                diameter_km=320.0,
                albedo=0.08,
                data_source="OrbitScope Simulated Demo",
                is_simulated=True,
            ),
            CatalogObject(
                designation="SIM-2012VP113",
                name="[SIMULATED] 2012 VP113 Analog (Biden)",
                object_type="tno",
                orbit_class="Sednoid",
                semi_major_axis_au=263.0,
                eccentricity=0.69,
                inclination_deg=24.0,
                perihelion_au=80.5,
                aphelion_au=445.0,
                period_yr=4270.0,
                absolute_magnitude=4.0,
                diameter_km=450.0,
                albedo=0.10,
                data_source="OrbitScope Simulated Demo",
                is_simulated=True,
            ),
        ]
        return sim_objects[:limit]

    def _generate_simulated_object(self, designation: str) -> CatalogObject:
        """Generate a single simulated CatalogObject for a given designation."""
        return CatalogObject(
            designation=f"SIM-{designation}",
            name=f"[SIMULATED] Test Body {designation}",
            object_type="tno",
            orbit_class="Outer Solar System Body",
            semi_major_axis_au=85.4,
            eccentricity=0.42,
            inclination_deg=16.8,
            perihelion_au=49.5,
            aphelion_au=121.3,
            period_yr=790.0,
            absolute_magnitude=5.8,
            diameter_km=210.0,
            albedo=0.12,
            data_source="OrbitScope Simulated Demo",
            is_simulated=True,
        )

    def _generate_simulated_ephemeris(
        self,
        target: str,
        start_time_str: str,
        stop_time_str: str,
        step_size: str,
    ) -> List[EphemerisEntry]:
        """Generate synthetic ephemeris entries with realistic orbital progression."""
        entries: List[EphemerisEntry] = []
        try:
            start_dt = datetime.strptime(start_time_str.split()[0], "%Y-%m-%d")
        except Exception:
            start_dt = datetime.now(timezone.utc)

        base_ra = 83.822
        base_dec = -5.391
        steps = 7

        for step in range(steps):
            current_dt = start_dt + timedelta(days=step)
            # Apparent retrograde motion for an outer solar system body (~0.005 deg/day)
            step_ra = (base_ra - step * 0.0042) % 360.0
            step_dec = base_dec + step * 0.0018
            dist_au = 42.5 + step * 0.015

            entries.append(
                EphemerisEntry(
                    target=f"[SIMULATED] {target}",
                    datetime_str=current_dt.strftime("%Y-%b-%d %H:%M"),
                    ra=round(step_ra, 5),
                    dec=round(step_dec, 5),
                    delta_au=round(dist_au, 3),
                    r_au=round(dist_au + 1.0, 3),
                    magnitude=21.4,
                    elongation=156.4,
                    elongation_deg=156.4,
                    phase_angle_deg=1.3,
                    is_simulated=True,
                )
            )

        return entries

    def _generate_simulated_nearby(self, ra: float, dec: float, radius_deg: float) -> List[CatalogObject]:
        """Generate simulated known objects near specified sky coordinates."""
        offset_ra = ra + radius_deg * 0.35
        offset_dec = dec - radius_deg * 0.25

        return [
            CatalogObject(
                designation="SIM-TNO-FIELD-1",
                name="[SIMULATED] Calibration TNO OS-001",
                object_type="tno",
                orbit_class="Resonant TNO",
                semi_major_axis_au=39.4,
                eccentricity=0.18,
                inclination_deg=6.5,
                perihelion_au=32.3,
                aphelion_au=46.5,
                period_yr=248.0,
                absolute_magnitude=6.2,
                diameter_km=180.0,
                albedo=0.09,
                ra=round(offset_ra, 4),
                dec=round(offset_dec, 4),
                data_source="OrbitScope Simulated Demo",
                is_simulated=True,
            )
        ]


# Default singleton instance
jpl_client = JPLClient()
