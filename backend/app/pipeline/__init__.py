"""
OrbitScope Scientific Pipeline Package
Provides image preprocessing, astrometric alignment, point-source detection,
matched image subtraction, multi-epoch candidate association, catalog cross-matching,
and end-to-end pipeline management.
"""
from app.pipeline.alignment import ImageAligner
from app.pipeline.candidate_associator import CandidateAssociator
from app.pipeline.crossmatcher import CatalogCrossmatcher
from app.pipeline.pipeline_manager import PipelineManager
from app.pipeline.preprocessor import ImagePreprocessor
from app.pipeline.source_detector import SourceDetector
from app.pipeline.subtractor import ImageSubtractor

__all__ = [
    "ImagePreprocessor",
    "ImageAligner",
    "SourceDetector",
    "ImageSubtractor",
    "CandidateAssociator",
    "CatalogCrossmatcher",
    "PipelineManager",
]
