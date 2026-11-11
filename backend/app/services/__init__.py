"""
OrbitScope Backend Services Package
===================================
Exports external API clients, SPHEREx observation managers, and demo data generators.
"""
from app.services.demo_data import DemoDataGenerator, demo_data
from app.services.irsa_client import IRSAClient, irsa_client
from app.services.jpl_client import JPLClient, jpl_client
from app.services.spherex_data import SPHERExDataManager, spherex_data

__all__ = [
    "JPLClient",
    "jpl_client",
    "IRSAClient",
    "irsa_client",
    "SPHERExDataManager",
    "spherex_data",
    "DemoDataGenerator",
    "demo_data",
]
