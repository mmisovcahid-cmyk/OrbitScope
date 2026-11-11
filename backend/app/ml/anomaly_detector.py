"""OrbitScope - Anomaly Detector
Unsupervised anomaly detection for candidate ranking using Isolation Forest.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, List, Optional
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

if TYPE_CHECKING:
    from app.models.schemas import DetectionCandidate
    from app.ml.feature_extractor import FeatureExtractor


class AnomalyDetector:
    """Unsupervised anomaly detection for candidate ranking.

    Uses Isolation Forest to identify unusual candidates that may be
    real astronomical discoveries vs. artifacts or noise.

    NOTE: This is EXPLORATORY analysis. Results should be verified by experts.
    """

    def __init__(self, contamination: float = 0.1, n_estimators: int = 100) -> None:
        """Initialize the anomaly detector with specified contamination rate.

        Parameters
        ----------
        contamination : float
            Expected proportion of outliers/anomalies in the candidate dataset.
        n_estimators : int
            Number of base estimators in the Isolation Forest ensemble.
        """
        self.contamination = contamination
        self.n_estimators = n_estimators
        self.model = IsolationForest(
            contamination=contamination,
            n_estimators=n_estimators,
            random_state=42,
        )
        self.scaler = StandardScaler()
        self.is_fitted: bool = False

    def fit(self, features: np.ndarray) -> None:
        """Fit the scaler and Isolation Forest model on feature matrix.

        Parameters
        ----------
        features : np.ndarray
            2D feature matrix of shape (n_samples, n_features).
        """
        if features.ndim == 1:
            features = features.reshape(1, -1)

        n_samples = features.shape[0]
        if n_samples == 0:
            return

        # If very few samples, generate small synthetic jitter to stabilize scaler & forest
        if n_samples < 5:
            jitter = np.random.RandomState(42).normal(0.0, 1e-4, size=(10, features.shape[1]))
            repeated = np.vstack([features] * int(np.ceil(10 / n_samples)))[:10]
            fit_data = repeated + jitter
        else:
            fit_data = features

        scaled = self.scaler.fit_transform(fit_data)
        self.model.fit(scaled)
        self.is_fitted = True

    def score(self, features: np.ndarray) -> np.ndarray:
        """Compute anomaly scores for feature matrix.

        Scores are returned in approximately [-1.0, 0.0], where more negative
        values indicate higher anomalousness.

        Parameters
        ----------
        features : np.ndarray
            2D feature matrix (n_samples, n_features).

        Returns
        -------
        np.ndarray
            1D array of anomaly scores.
        """
        if features.ndim == 1:
            features = features.reshape(1, -1)

        if features.shape[0] == 0:
            return np.empty((0,), dtype=np.float64)

        if not self.is_fitted:
            self.fit(features)

        scaled = self.scaler.transform(features)
        scores = self.model.score_samples(scaled)
        return scores.astype(np.float64)

    def predict(self, features: np.ndarray) -> np.ndarray:
        """Predict anomaly labels for feature matrix.

        Parameters
        ----------
        features : np.ndarray
            2D feature matrix.

        Returns
        -------
        np.ndarray
            1 for inliers (normal/artifacts/common), -1 for anomalies (candidates of interest).
        """
        if features.ndim == 1:
            features = features.reshape(1, -1)

        if features.shape[0] == 0:
            return np.empty((0,), dtype=int)

        if not self.is_fitted:
            self.fit(features)

        scaled = self.scaler.transform(features)
        return self.model.predict(scaled)

    def score_candidates(
        self,
        candidates: list[Any],
        feature_extractor: Any,
    ) -> list[Any]:
        """Score candidates for anomalousness.

        Workflow:
        1. Extract feature matrix using feature_extractor
        2. Scale features
        3. Fit model on current batch if not fitted
        4. Compute anomaly scores (-1 to 0, more negative = more anomalous)
        5. Update candidate.anomaly_score

        Parameters
        ----------
        candidates : list[DetectionCandidate]
            List of detected candidates.
        feature_extractor : FeatureExtractor
            Feature extractor instance.

        Returns
        -------
        list[DetectionCandidate]
            Candidates with populated anomaly_score.
        """
        if not candidates:
            return []

        features = feature_extractor.extract_batch(candidates)
        scores = self.score(features)

        for candidate, sc in zip(candidates, scores):
            # sc is typically in [-0.9, -0.1], more negative = more anomalous.
            # Normalize to [0.0, 1.0] where 1.0 represents highest anomaly rank
            # to conform with DetectionCandidate.anomaly_score constraints (ge=0.0, le=1.0).
            score_val = float(np.clip(-sc, 0.0, 1.0))
            if isinstance(candidate, dict):
                candidate["anomaly_score"] = score_val
                candidate["raw_anomaly_score"] = float(sc)
            else:
                try:
                    setattr(candidate, "anomaly_score", score_val)
                except Exception:
                    pass

        return candidates
