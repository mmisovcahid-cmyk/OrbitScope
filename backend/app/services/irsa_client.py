"""
OrbitScope - IRSA TAP Service Client for SPHEREx Data
=====================================================
Asynchronous client for NASA/IPAC Infrared Science Archive (IRSA) Table Access Protocol (TAP).
Executes ADQL queries, searches SPHEREx catalogs, queries schema metadata,
and provides transparent fallback to simulated astronomical data when SPHEREx
public data products are pending mission release.
"""
from __future__ import annotations

import asyncio
import math
from typing import Any, Dict, List, Optional

import httpx

from app.core.cache import observation_cache
from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)


class IRSAClient:
    """
    Client for the NASA/IPAC Infrared Science Archive (IRSA) TAP service.
    Implements IVOA Table Access Protocol (TAP) synchronous queries via ADQL.
    """

    def __init__(self, timeout: float = 30.0) -> None:
        self.tap_url: str = settings.IRSA_TAP_URL
        self.timeout: float = timeout
        self._available_tables_cache: Optional[List[Dict[str, Any]]] = None

    # ------------------------------------------------------------------------
    # Core TAP Query Execution
    # ------------------------------------------------------------------------

    async def query_tap(self, adql_query: str) -> List[Dict[str, Any]]:
        """
        Execute an ADQL query against the IRSA TAP synchronous endpoint.
        Endpoint: https://irsa.ipac.caltech.edu/TAP/sync
        Method: HTTP POST with LANG=ADQL, FORMAT=json, QUERY={adql}
        Parses IVOA VOTable-JSON response into a list of row dictionaries.
        """
        clean_query = adql_query.strip()
        if not clean_query:
            return []

        form_data = {
            "REQUEST": "doQuery",
            "LANG": "ADQL",
            "FORMAT": "json",
            "QUERY": clean_query,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(self.tap_url, data=form_data)

                # Check for HTTP errors
                if response.status_code != 200:
                    logger.warning(
                        f"IRSA TAP returned HTTP {response.status_code} for query: {clean_query[:100]}..."
                    )
                    return []

                raw_json = response.json()
                return self._parse_votable_json(raw_json)

        except httpx.TimeoutException:
            logger.warning(f"IRSA TAP query timed out ({self.timeout}s): {clean_query[:100]}...")
            return []
        except Exception as exc:
            logger.warning(f"IRSA TAP execution error: {exc}")
            return []

    def _parse_votable_json(self, raw_json: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract tabular records from IRSA VOTable JSON response hierarchy.
        Supports standard IVOA VOTable-JSON structure with FIELD_ARRAY and TABLEDATA.
        """
        records: List[Dict[str, Any]] = []

        try:
            # Case 1: Standard IVOA VOTable-JSON hierarchy
            votable = raw_json.get("VOTABLE", raw_json)
            resource_array = votable.get("RESOURCE_ARRAY", [])
            if not resource_array and "RESOURCE" in votable:
                res = votable["RESOURCE"]
                resource_array = res if isinstance(res, list) else [res]

            for resource in resource_array:
                # Check for error status
                info_array = resource.get("INFO_ARRAY", [])
                for info in info_array:
                    attr = info.get("<xmlattr>", {})
                    if attr.get("name") == "QUERY_STATUS" and attr.get("value") == "ERROR":
                        logger.warning(f"IRSA TAP Query Error: {info.get('#text', 'Unknown Error')}")
                        return []

                table = resource.get("TABLE", {})
                fields = table.get("FIELD_ARRAY", [])
                if not fields and "FIELD" in table:
                    f = table["FIELD"]
                    fields = f if isinstance(f, list) else [f]

                col_names: List[str] = []
                for field in fields:
                    if isinstance(field, dict):
                        col_name = field.get("<xmlattr>", {}).get("name") or field.get("name")
                        col_names.append(str(col_name) if col_name else f"col_{len(col_names)}")

                data_node = table.get("DATA", {})
                table_data = data_node.get("TABLEDATA", [])
                for row in table_data:
                    if isinstance(row, list) and len(row) == len(col_names):
                        records.append(dict(zip(col_names, row)))

            # Case 2: Simplified JSON response {columns: [...], data: [...]}
            if not records and "columns" in raw_json and "data" in raw_json:
                cols = raw_json["columns"]
                for row in raw_json["data"]:
                    if isinstance(row, list) and len(row) == len(cols):
                        records.append(dict(zip(cols, row)))

        except Exception as exc:
            logger.debug(f"Failed to parse VOTable JSON payload: {exc}")

        return records

    # ------------------------------------------------------------------------
    # SPHEREx Domain Operations
    # ------------------------------------------------------------------------

    async def search_spherex_sources(
        self,
        ra: float,
        dec: float,
        radius_deg: float = 1.0,
    ) -> List[Dict[str, Any]]:
        """
        Search SPHEREx source catalog in a spatial cone.
        ADQL: SELECT * FROM spherex_source WHERE CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', {ra}, {dec}, {radius}))=1
        If SPHEREx data is not yet available on IRSA TAP (table missing or 404),
        falls back to realistic demonstration data with is_simulated=True.
        """
        cache_key = f"irsa_spherex_sources:{ra:.4f}:{dec:.4f}:{radius_deg:.4f}"
        cached = observation_cache.get(cache_key)
        if cached is not None:
            return cached

        adql = (
            f"SELECT TOP 500 * FROM spherex_source "
            f"WHERE CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', {ra:.5f}, {dec:.5f}, {radius_deg:.5f})) = 1"
        )

        real_records = await self.query_tap(adql)
        if real_records:
            # Mark records as real data
            for r in real_records:
                r["is_simulated"] = False
                r["data_source"] = "IRSA TAP (Live SPHEREx)"
            observation_cache.set(cache_key, real_records)
            return real_records

        # Fallback to simulated sources if live SPHEREx catalog is not yet accessible
        logger.info(
            f"SPHEREx source catalog not currently hosted on IRSA TAP; generating simulated sources for ({ra:.2f}, {dec:.2f})."
        )
        simulated_records = self._generate_simulated_sources(ra, dec, radius_deg)
        observation_cache.set(cache_key, simulated_records)
        return simulated_records

    async def get_available_tables(self) -> List[Dict[str, Any]]:
        """
        Query TAP_SCHEMA.tables to find available SPHEREx tables.
        ADQL: SELECT table_name, description FROM TAP_SCHEMA.tables WHERE table_name LIKE '%spherex%'
        """
        cache_key = "irsa_spherex_tables_list"
        cached = observation_cache.get(cache_key)
        if cached is not None:
            return cached

        adql = (
            "SELECT table_name, description FROM TAP_SCHEMA.tables "
            "WHERE table_name LIKE '%spherex%' OR description LIKE '%SPHEREx%'"
        )

        tables = await self.query_tap(adql)
        if tables:
            for t in tables:
                t["is_simulated"] = False
            observation_cache.set(cache_key, tables)
            return tables

        # If mission tables are not yet indexed, provide simulated metadata schema
        simulated_tables = [
            {
                "table_name": "spherex_source",
                "description": "SPHEREx Point Source and Extended Source Spectral Catalog (Simulated Schema)",
                "status": "pending_public_release",
                "is_simulated": True,
            },
            {
                "table_name": "spherex_image",
                "description": "SPHEREx Level 2 Spectral Image Cube Metadata and Pointings (Simulated Schema)",
                "status": "pending_public_release",
                "is_simulated": True,
            },
            {
                "table_name": "spherex_deep_field",
                "description": "SPHEREx Deep Viewing Zones at Ecliptic Poles (Simulated Schema)",
                "status": "pending_public_release",
                "is_simulated": True,
            },
        ]
        observation_cache.set(cache_key, simulated_tables)
        return simulated_tables

    async def get_observation_metadata(self, observation_id: str) -> Dict[str, Any]:
        """
        Get metadata for a specific SPHEREx observation by identifier.
        Returns instrumental setup, pointing, exposure time, wavelength, and calibration.
        """
        cache_key = f"irsa_obs_meta:{observation_id}"
        cached = observation_cache.get(cache_key)
        if cached is not None:
            return cached

        # Attempt to query TAP image table
        adql = f"SELECT * FROM spherex_image WHERE observation_id = '{observation_id}'"
        records = await self.query_tap(adql)
        if records:
            meta = records[0]
            meta["is_simulated"] = False
            observation_cache.set(cache_key, meta)
            return meta

        # Simulated fallback metadata
        meta = {
            "observation_id": observation_id,
            "instrument": "SPHEREx",
            "band": "Band 1",
            "wavelength_um": 0.93,
            "spectral_resolution_R": 41,
            "exposure_time_sec": 140.0,
            "pixel_scale_arcsec": 6.2,
            "fov_degrees": 3.5,
            "quality_flag": "NOMINAL",
            "crval1": 83.822,
            "crval2": -5.391,
            "detector_temp_k": 55.2,
            "source": "SPHEREx Simulated Observation Archive",
            "is_simulated": True,
        }
        observation_cache.set(cache_key, meta)
        return meta

    # ------------------------------------------------------------------------
    # Compatibility Methods
    # ------------------------------------------------------------------------

    async def check_spherex_availability(self) -> Dict[str, Any]:
        """Check availability status of SPHEREx datasets for status dashboard."""
        tables = await self.get_available_tables()
        has_real_tables = any(not t.get("is_simulated", True) for t in tables)
        return {
            "available": has_real_tables,
            "tables": tables,
            "source": "IRSA TAP Service",
            "endpoint": self.tap_url,
            "is_simulated": not has_real_tables,
            "note": "SPHEREx data products depend on Caltech/IPAC public mission release schedules.",
        }

    async def query_sources(
        self,
        ra: float,
        dec: float,
        radius_deg: float = 1.0,
        table: str = "spherex_source",
        max_rows: int = 500,
    ) -> Dict[str, Any]:
        """Legacy cone query compatibility interface."""
        sources = await self.search_spherex_sources(ra, dec, radius_deg)
        return {
            "count": len(sources),
            "columns": list(sources[0].keys()) if sources else [],
            "data": [list(s.values()) for s in sources],
            "source": f"IRSA TAP - {table}",
            "is_simulated": any(s.get("is_simulated", False) for s in sources),
        }

    # ------------------------------------------------------------------------
    # Demonstration Data Synthesis
    # ------------------------------------------------------------------------

    def _generate_simulated_sources(
        self,
        ra: float,
        dec: float,
        radius_deg: float,
        count: int = 120,
    ) -> List[Dict[str, Any]]:
        """Generate synthetic infrared point sources in the queried cone."""
        import random

        rng = random.Random(int(ra * 1000 + dec * 100))
        sources: List[Dict[str, Any]] = []

        for idx in range(count):
            # Uniform disk distribution
            r = radius_deg * math.sqrt(rng.random())
            theta = rng.random() * 2.0 * math.pi
            src_ra = (ra + (r * math.cos(theta)) / max(math.cos(math.radians(dec)), 0.1)) % 360.0
            src_dec = max(-90.0, min(90.0, dec + r * math.sin(theta)))

            # Magnitude power law
            mag = 12.0 + 9.5 * (rng.random() ** 0.5)
            flux_ujy = 10.0 ** ((23.9 - mag) / 2.5)
            snr = min(500.0, max(3.5, flux_ujy / 8.0))

            sources.append(
                {
                    "source_id": f"SPH_SIM_{int(src_ra*100):05d}_{int((src_dec+90)*100):05d}_{idx:03d}",
                    "ra": round(src_ra, 6),
                    "dec": round(src_dec, 6),
                    "flux_ujy": round(flux_ujy, 2),
                    "mag_ab": round(mag, 2),
                    "snr": round(snr, 1),
                    "band": "Band 1",
                    "wavelength_um": 0.93,
                    "is_simulated": True,
                }
            )

        return sources


# Default singleton instance
irsa_client = IRSAClient()
