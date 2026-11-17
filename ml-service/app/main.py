"""NyayaAI ML service (FastAPI). Run: uvicorn app.main:app --port 8000"""
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import explanation, health, prediction, similarity
from app.config import settings
from app.models.predictor import ModelNotReadyError, predictor
from app.models.similarity_model import similarity_service

logging.basicConfig(level=settings.LOG_LEVEL, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("nyaya-ml")


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        predictor.load()
        logger.info("Model loaded successfully: %s (%s)", predictor.model_version, predictor.model_type)
    except Exception as e:  # noqa: BLE001
        logger.exception("Model failed to load (%s); /predict will return 503 until fixed", str(e))
    try:
        similarity_service.load()
    except Exception as e:  # noqa: BLE001
        logger.exception("Similarity service failed to load (%s)", str(e))
    yield


app = FastAPI(title="NyayaAI ML Service", version="1.0.0", lifespan=lifespan,
              description="Delay-risk prediction, SHAP explanations and similar-case retrieval. "
                          "Research/decision-support only - not a legal judgment.")
app.add_middleware(CORSMiddleware, allow_origins=settings.ALLOWED_ORIGINS, allow_methods=["GET", "POST"], allow_headers=["*"])


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    logger.info("%s %s -> %s (%.1f ms)", request.method, request.url.path, response.status_code,
                (time.perf_counter() - start) * 1000)
    return response


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    details = [{"field": ".".join(str(x) for x in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"success": False, "message": "Invalid case features", "error": details})


@app.exception_handler(ModelNotReadyError)
async def model_not_ready(_: Request, exc: ModelNotReadyError):
    return JSONResponse(status_code=503, content={"success": False, "message": "Model not loaded", "error": str(exc)})


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    logger.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"success": False, "message": "ML service error", "error": type(exc).__name__})


app.include_router(health.router)
app.include_router(prediction.router)
app.include_router(explanation.router)
app.include_router(similarity.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT)
