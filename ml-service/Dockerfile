FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Models are pre-trained and committed to the repo (models/*.joblib).
# Training is skipped at build time for faster deploys.
# To retrain: run `python -m training.train` locally, commit the new model files, then redeploy.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-${ML_SERVICE_PORT:-8000}}"]
