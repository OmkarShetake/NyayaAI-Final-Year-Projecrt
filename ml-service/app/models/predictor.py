"""Loads persisted artifacts and produces delay-risk predictions."""
from __future__ import annotations

import json
import logging
import threading

import joblib
import numpy as np

from app.config import settings
from app.preprocessing.preprocess import extract_features

logger = logging.getLogger(__name__)


class ModelNotReadyError(RuntimeError):
    pass


class DelayRiskPredictor:
    def __init__(self):
        self._lock = threading.Lock()
        self.model = None
        self.label_encoder = None
        self.preprocessor = None
        self.regressor = None
        self.model_version = None
        self.model_type = None
        self.feature_names: list[str] = []
        self.metadata: dict = {}

    @property
    def ready(self) -> bool:
        return self.model is not None and self.preprocessor is not None

    def load(self) -> None:
        with self._lock:
            try:
                self._load_artifacts()
            except Exception as exc:  # noqa: BLE001
                if not settings.AUTO_TRAIN_IF_MISSING:
                    raise
                logger.warning("Could not load model artifacts (%s). Training from %s ...", exc, settings.DATASET_PATH)
                from training.train import train
                train()
                self._load_artifacts()

    def _load_artifacts(self) -> None:
        logger.info("Loading model from: %s", settings.MODEL_PATH)
        logger.info("Loading preprocessor from: %s", settings.PREPROCESSOR_PATH)
        logger.info("Loading regressor from: %s", settings.REGRESSOR_PATH)
        bundle = joblib.load(settings.MODEL_PATH)
        self.model = bundle["model"]
        self.label_encoder = bundle["label_encoder"]
        self.model_version = bundle.get("model_version", "unknown")
        self.model_type = bundle.get("model_type", "unknown")
        self.feature_names = bundle.get("feature_names", [])
        self.preprocessor = joblib.load(settings.PREPROCESSOR_PATH)
        self.regressor = joblib.load(settings.REGRESSOR_PATH)["model"] if settings.REGRESSOR_PATH.exists() else None
        self.metadata = json.loads(settings.METADATA_PATH.read_text()) if settings.METADATA_PATH.exists() else {}
        logger.info("Loaded model %s (%s), %d encoded features", self.model_version, self.model_type, len(self.feature_names))

    def transform(self, case: dict):
        raw = extract_features([case])
        return raw, self.preprocessor.transform(raw)

    def predict(self, case: dict) -> dict:
        if not self.ready:
            raise ModelNotReadyError("Model is not loaded")
        raw, X = self.transform(case)
        proba = self.model.predict_proba(X)[0]
        classes = list(self.label_encoder.inverse_transform(np.arange(len(proba))))
        best = int(np.argmax(proba))
        delay = None
        if self.regressor is not None:
            delay = int(max(0, round(float(np.expm1(self.regressor.predict(X)[0])))))
        return {
            "riskLevel": classes[best],
            "probability": round(float(proba[best]), 4),
            "classProbabilities": {c: round(float(p), 4) for c, p in zip(classes, proba)},
            "predictedDelayDays": delay,
            "modelVersion": self.model_version,
            "modelType": self.model_type,
            "inputFeatures": {k: (None if (isinstance(v, float) and np.isnan(v)) else (float(v) if isinstance(v, (int, float, np.floating)) else v))
                              for k, v in raw.iloc[0].to_dict().items()},
            "_X": X,
            "_classes": classes,
        }


predictor = DelayRiskPredictor()
