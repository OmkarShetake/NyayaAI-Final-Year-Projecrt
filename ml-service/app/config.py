"""Centralised configuration for the ML service. All values come from env vars."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent  # ml-service/
load_dotenv(BASE_DIR / ".env")


def _path(env_key: str, default: str) -> Path:
    value = os.getenv(env_key, default)
    p = Path(value)
    return p if p.is_absolute() else (BASE_DIR / p).resolve()


class Settings:
    SERVICE_NAME = "nyaya-ml-service"
    HOST = os.getenv("ML_SERVICE_HOST", "0.0.0.0")
    PORT = int(os.getenv("ML_SERVICE_PORT", "8000"))
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

    MODEL_PATH = _path("MODEL_PATH", "./models/delay_model.joblib")
    REGRESSOR_PATH = _path("REGRESSOR_PATH", "./models/delay_regressor.joblib")
    PREPROCESSOR_PATH = _path("PREPROCESSOR_PATH", "./models/preprocessor.joblib")
    SIMILARITY_MODEL_PATH = _path("SIMILARITY_MODEL_PATH", "./models/similarity_vectorizer.joblib")
    METADATA_PATH = _path("METADATA_PATH", "./models/model_metadata.json")
    DATASET_PATH = _path("DATASET_PATH", "./data/sample/sample_cases.csv")

    # Retrieval backend: "tfidf" (default). Future: "sentence-transformers", "faiss".
    RETRIEVER_BACKEND = os.getenv("RETRIEVER_BACKEND", "tfidf")
    # Include the (synthetic) historical dataset as a retrieval corpus.
    INCLUDE_HISTORICAL_CORPUS = os.getenv("INCLUDE_HISTORICAL_CORPUS", "true").lower() == "true"
    # Train automatically on startup if artifacts are missing/incompatible.
    AUTO_TRAIN_IF_MISSING = os.getenv("AUTO_TRAIN_IF_MISSING", "true").lower() == "true"

    TOP_K_FEATURES = int(os.getenv("TOP_K_FEATURES", "8"))
    ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5000").split(",") if o.strip()]


settings = Settings()
