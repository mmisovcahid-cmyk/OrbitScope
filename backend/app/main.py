"""OrbitScope Backend - FastAPI Application
Main application entry point configuring lifespan management, service singletons,
CORS policies, routing, and global exception handling.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.catalog import router as catalog_router
from app.api.routes.detection import router as detection_router
from app.api.routes.observations import router as observations_router
from app.api.routes.planetx import router as planetx_router
from app.api.routes.sky import router as sky_router
from app.api.routes.system import router as system_router
from app.core.config import settings
from app.core.logging_config import get_logger, setup_logging
from app.services.irsa_client import IRSAClient, irsa_client
from app.services.jpl_client import JPLClient, jpl_client

# Graceful dynamic imports for services that may be initialized in parallel
try:
    from app.services.spherex_data import SPHERExDataManager, spherex_data
except ImportError:
    SPHERExDataManager = None
    spherex_data = None

try:
    from app.services.demo_data import DemoDataGenerator, demo_data
except ImportError:
    DemoDataGenerator = None
    demo_data = None

try:
    from app.pipeline.pipeline_manager import PipelineManager, pipeline_manager
except ImportError:
    PipelineManager = None
    pipeline_manager = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager handling startup and shutdown events."""
    setup_logging(settings.LOG_LEVEL if hasattr(settings, "LOG_LEVEL") else "INFO")
    logger = get_logger("main")
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Configuration: DEMO_MODE={settings.DEMO_MODE}, DEBUG={settings.DEBUG}")

    # Set server startup time for uptime tracking
    app.state.startup_time = datetime.now(timezone.utc)

    # Initialize Service Singletons in app.state
    app.state.jpl_client = jpl_client or JPLClient()
    app.state.irsa_client = irsa_client or IRSAClient()

    # SPHEREx data service
    if spherex_data is not None:
        app.state.spherex_data = spherex_data
    elif SPHERExDataManager is not None:
        app.state.spherex_data = SPHERExDataManager()
    else:
        app.state.spherex_data = None

    # Demo data generator
    if demo_data is not None:
        app.state.demo_data = demo_data
    elif DemoDataGenerator is not None:
        app.state.demo_data = DemoDataGenerator()
    else:
        app.state.demo_data = None

    # Pipeline manager
    if pipeline_manager is not None:
        app.state.pipeline_manager = pipeline_manager
    elif PipelineManager is not None:
        app.state.pipeline_manager = PipelineManager()
    else:
        app.state.pipeline_manager = None

    # Session storage for in-memory candidates and observations
    app.state._candidates = {}
    app.state._observations = {}

    logger.info("OrbitScope service singletons registered in application state.")
    yield
    logger.info("OrbitScope backend shutting down. Releasing resources...")


# Initialize FastAPI instance
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="SPHEREx Time-Domain Sky Monitoring & Moving Object Detection Platform",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS Middleware
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [str(settings.CORS_ORIGINS)]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API routers
app.include_router(sky_router)
app.include_router(observations_router)
app.include_router(detection_router)
app.include_router(catalog_router)
app.include_router(planetx_router)
app.include_router(system_router)


@app.get(
    "/",
    summary="OrbitScope Root Welcome",
    description="Provides basic service metadata, documentation URL, and multilingual greeting.",
)
async def root() -> dict[str, Any]:
    """Root endpoint welcoming clients and indicating operational mode."""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "description": "OrbitScope - SPHEREx Time-Domain Sky Monitoring & Moving Object Detection Platform",
        "message": "Welcome to OrbitScope API. Explore the sky, detect changes, track celestial objects.",
        "message_az": "OrbitScope API-yə xoş gəlmisiniz. Göyü kəşf edin, dəyişiklikləri aşkar edin, göy cisimlərini izləyin.",
        "documentation": "/docs",
        "demo_mode": settings.DEMO_MODE,
        "locale_default": getattr(settings, "DEFAULT_LOCALE", "en"),
        "status": "operational",
    }
