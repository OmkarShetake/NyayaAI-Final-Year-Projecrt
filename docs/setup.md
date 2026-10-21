# Setup

## 1. Requirements
| Tool | Version |
|---|---|
| Node.js | 18 or newer (20 LTS recommended) |
| Python | 3.10 – 3.13 |
| MongoDB | 5.0+ locally, or a free MongoDB Atlas cluster |

## 2. MongoDB
**Local:** install MongoDB Community Server and use `MONGODB_URI=mongodb://127.0.0.1:27017/nyaya_ai`.

**Atlas:** create a free cluster → Database Access (user) → Network Access (allow your IP) → Connect → Drivers,
then set `MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/nyaya_ai?retryWrites=true&w=majority`.

## 3. ML service
```bash
cd ml-service
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python -m training.generate_sample_data   # optional - CSV is already included
python -m training.train                  # prints accuracy/precision/recall/F1/confusion matrix
uvicorn app.main:app --port 8000 --reload
```
Open http://localhost:8000/docs for interactive API docs.

If the bundled `.joblib` files were created with library versions different from yours, the service
detects the load failure and retrains automatically from the sample CSV (`AUTO_TRAIN_IF_MISSING=true`).

## 4. Backend
```bash
cd backend
npm install
cp .env.example .env
# edit .env: MONGODB_URI, JWT_SECRET (generate one below)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm run seed            # admin + 120 synthetic sample cases
npm run seed:predict    # same, plus predictions (ML service must be running)
npm run dev
```
Seed options: `--count 300`, `--reset` (removes previously seeded sample cases).

## 5. Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev            # http://localhost:5173
npm run build          # production bundle in dist/
```

## 6. End-to-end check
With all three services running: `cd backend && npm run test:flow`. It registers a user, logs in, creates a case,
runs a prediction (Node → FastAPI → XGBoost → SHAP), retrieves similar cases, fetches recommendations and analytics,
checks validation/auth errors, and deletes the test case.

## 7. Optional: Gemini
Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) in `backend/.env`. Gemini is only used to write a plain-language
paragraph about a prediction. Without a key — or if the call fails — a deterministic template is used. The key is
only read by the backend and never sent to the browser.

## 8. Real-World Data: Indian Kanoon API (Option C)
To sync live real-world court cases directly into your database:
1. Register for a free account at [https://api.indiankanoon.org/](https://api.indiankanoon.org/).
2. Copy your API token from your account profile.
3. Paste it in `.env` (and `backend/.env`):
   ```env
   KANOON_API_TOKEN=your_token_here
   ```
4. Fetch real cases and run predictions:
   ```bash
   cd backend
   npm run sync:kanoon
   ```
   Custom search options:
   ```bash
   npm run sync:kanoon -- --query "cheque bounce high court" --limit 50 --predict
   ```

## Troubleshooting
| Symptom | Fix |
|---|---|
| `Invalid environment configuration` on backend start | copy `.env.example` to `.env`; JWT_SECRET must be ≥ 16 chars |
| Prediction returns **503** | ML service is not running / not reachable at `ML_SERVICE_URL` |
| CORS error in browser | add the frontend origin to `CORS_ORIGIN` |
| `MongoServerSelectionError` | check `MONGODB_URI`, Atlas IP allow-list |
| Analytics error on non-MongoDB engines | analytics uses `$facet`/`$dateToString`; use real MongoDB 5+ or Atlas |
