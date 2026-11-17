"""Centralised configuration for the ML service. All values come from env vars."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent  # ml-service/
load_dotenv(BASE_DIR / ".env")


def _path(env_key: str, default: str) -> Path:
    value = os.getenv(env_key, default).strip()  # strip whitespace/newlines from env var
    p = Path(value)
    return p if p.is_absolute() else (BASE_DIR / p).resolve()


class Settings:
    SERVICE_NAME = "nyaya-ml-service"
    HOST = os.getenv("ML_SERVICE_HOST", "0.0.0.0").strip()
    PORT = int(os.getenv("PORT", os.getenv("ML_SERVICE_PORT", "8000")).strip())
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").strip().upper()

    MODEL_PATH = _path("MODEL_PATH", "./models/delay_model.joblib")
    REGRESSOR_PATH = _path("REGRESSOR_PATH", "./models/delay_regressor.joblib")
    PREPROCESSOR_PATH = _path("PREPROCESSOR_PATH", "./models/preprocessor.joblib")
    SIMILARITY_MODEL_PATH = _path("SIMILARITY_MODEL_PATH", "./models/similarity_vectorizer.joblib")
    METADATA_PATH = _path("METADATA_PATH", "./models/model_metadata.json")
    DATASET_PATH = _path("DATASET_PATH", "./data/sample/sample_cases.csv")

    RETRIEVER_BACKEND = os.getenv("RETRIEVER_BACKEND", "tfidf").strip()
    INCLUDE_HISTORICAL_CORPUS = os.getenv("INCLUDE_HISTORICAL_CORPUS", "true").strip().lower() == "true"
    AUTO_TRAIN_IF_MISSING = os.getenv("AUTO_TRAIN_IF_MISSING", "true").strip().lower() == "true"

    TOP_K_FEATURES = int(os.getenv("TOP_K_FEATURES", "8").strip())
    ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5000").split(",") if o.strip()]


settings = Settings()
