"""OrbitScope API routes package."""
from app.api.routes.catalog import router as catalog_router
from app.api.routes.detection import router as detection_router
from app.api.routes.observations import router as observations_router
from app.api.routes.planetx import router as planetx_router
from app.api.routes.sky import router as sky_router
from app.api.routes.system import router as system_router

__all__ = [
    "sky_router",
    "observations_router",
    "detection_router",
    "catalog_router",
    "planetx_router",
    "system_router",
]
