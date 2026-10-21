# NyayaAI – Judicial Intelligence & Decision-Support System

NyayaAI is a full-stack, AI-powered judicial decision-support platform designed to address case pendency and court backlogs in India. It predicts **case delay risk (`LOW` / `MEDIUM` / `HIGH`)** using XGBoost, provides transparent feature explanations via **SHAP**, retrieves **similar historical cases** using cosine similarity, generates **administrative recommendations**, and synchronizes with **real-world court judgments from Indian Kanoon**.

> **Disclaimer:** NyayaAI is an academic research and decision-support prototype. Its predictions are model estimates intended for court administrators and researchers — not legal advice, judicial decrees, or guarantees of any case outcome.

---

## 🏛️ System Architecture

```
┌─────────────────────────────────┐
│     React + Vite Frontend       │ (Port 5173 - User Interface)
│ Tailwind CSS · Recharts · Icons │
└────────────────┬────────────────┘
                 │ REST / HTTPS (Bearer JWT)
┌────────────────▼────────────────┐
│   Node.js / Express Gateway     │ (Port 5000 - Security, Auth & Logic)
│ Zod · Helmet · Rate-Limit · DB  │
└──────┬────────────────────┬─────┘
       │                    │
 Mongoose / BSON       HTTP / JSON
       │                    │
┌──────▼───────┐     ┌──────▼──────────────────────────────────────┐
│   MongoDB    │     │             Python FastAPI ML Service       │ (Port 8000)
│ 27017 Local  │     │ ├─ XGBoost Classifier (Risk Level)          │
│ or Atlas     │     │ ├─ XGBoost Regressor (Estimated Delay Days) │
└──────────────┘     │ ├─ SHAP TreeExplainer (Feature Attribution) │
                     │ └─ TF-IDF Retriever (Precedent Matching)    │
                     └──────────────────────┬──────────────────────┘
                                            │ HTTPS
                             ┌──────────────▼──────────────────────┐
                             │ External APIs:                      │
                             │ ├─ Indian Kanoon (Real Judgments)   │
                             │ └─ Google Gemini (Plain Narratives) │
                             └─────────────────────────────────────┘
```

The browser only connects to the Node.js API Gateway; the gateway securely manages authentication, business logic, MongoDB, and calls to the Python ML engine.

---

## 📋 Prerequisites

Make sure you have installed on your computer:
1. **Node.js** (v18 or newer) — [Download Node.js](https://nodejs.org/)
2. **Python** (Python 3.10 is recommended; pre-configured in `ml-service/.venv`)
3. **MongoDB** (Local MongoDB Community Server running on `27017` or a free MongoDB Atlas connection string)

---

## 🚀 How to Start Each Service (Step-by-Step)

To run the entire system, open **3 separate terminal windows** (one for each service):

### 🔹 Terminal 1: Python ML Service (Port 8000)
The ML microservice handles XGBoost delay predictions, SHAP explainability, and case similarity matching.

```powershell
cd "c:\Users\Omkar Shetake\Desktop\Nyaya-AI\ml-service"

# Method A (Fastest on Windows):
.\run.bat

# Method B (Manual command):
.\.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
* **ML Service URL:** `http://localhost:8000`
* **Interactive API Docs (Swagger):** `http://localhost:8000/docs`
* **Health Endpoint:** `http://localhost:8000/health`

---

### 🔹 Terminal 2: Node.js Backend API Gateway (Port 5000)
The backend gateway handles authentication, MongoDB storage, role permissions, and recommendation logic.

```powershell
cd "c:\Users\Omkar Shetake\Desktop\Nyaya-AI\backend"

# 1. Install dependencies (first time only):
npm install

# 2. Start the API server in development mode:
npm run dev
```
* **API Base URL:** `http://localhost:5000/api`
* **API Health Check:** `http://localhost:5000/api/health`

---

### 🔹 Terminal 3: React Web Frontend (Port 5173)
The modern user dashboard with interactive charts, case management, and risk gauges.

```powershell
cd "c:\Users\Omkar Shetake\Desktop\Nyaya-AI\frontend"

# 1. Install dependencies (first time only):
npm install

# 2. Start Vite development server:
npm run dev
```
* **Open in your browser:** **`http://localhost:5173`**

---

## ⚖️ Real-World Court Data: Indian Kanoon Sync

NyayaAI is connected to the **Indian Kanoon API** to fetch live, real-world Indian court judgments directly into your database.

From the `backend/` folder:

```powershell
cd backend

# 1. Fetch real court judgments and store them:
npm run sync:kanoon

# 2. Fetch real court judgments AND run AI delay-risk predictions on each:
npm run sync:kanoon:predict

# 3. Custom Search - Filter by legal topic or court:
npm run sync:kanoon -- --query "cheque bounce" --limit 20
npm run sync:kanoon -- --query "property dispute" --limit 20
npm run sync:kanoon -- --query "bail application high court" --limit 20
```

*Every judgment fetched from Indian Kanoon is saved with real parties, citations, filing dates, and marked as `isSample: false`.*

---

## 🧪 Seeding & Training Data Options

### Option 1: Seed Curated Real-World Benchmark Cases (Zero Setup)
We have prepared a benchmark of 150 real Indian cases (`ml-service/data/raw/real_cases.csv`) with official 16-digit CNR numbers:
```powershell
cd backend
npm run seed:predict
```

### Option 2: Retrain the XGBoost Models on Real Data
To retrain the ML classifier and regressor on your imported real court data:
```powershell
cd ml-service
.\.venv\Scripts\python.exe -m training.train --data data/raw/real_cases.csv
```

### Option 3: Verify Entire Integration End-to-End
Tests the entire pipeline (Auth ⇄ API ⇄ MongoDB ⇄ FastAPI ⇄ XGBoost ⇄ SHAP ⇄ Similarity ⇄ Recommendations):
```powershell
cd backend
npm run test:flow
```

---

## 🔑 Default Login & User Roles

You can register a new account on the UI (`http://localhost:5173/register`) or use the default seeded admin:

* **Email:** `admin@nyaya.local`
* **Password:** `Admin@12345`

| Role | Permissions |
|---|---|
| **Admin** | Full access: manage all cases, delete any case, change user roles in Settings |
| **Analyst** | Create cases, edit/delete own cases, run AI predictions and similarity searches |
| **Viewer** | Read-only access to dashboard, analytics, and case records |

*(Note: The very first user registered in a fresh database automatically becomes an `admin`)*.

---

## ⚙️ Environment Configuration (`.env`)

All settings are environment-driven. The main configuration lives in `.env`:

| Key | Description | Default / Example |
|---|---|---|
| `PORT` | Backend API port | `5000` |
| `MONGODB_URI` | MongoDB connection URL | `mongodb://127.0.0.1:27017/nyaya_ai` |
| `JWT_SECRET` | Secret key for JWT signing | `16+ character random secret` |
| `ML_SERVICE_URL` | Internal URL to Python FastAPI | `http://localhost:8000` |
| `VITE_API_BASE_URL` | Frontend $\rightarrow$ Backend API URL | `http://localhost:5000/api` |
| `KANOON_API_TOKEN` | Indian Kanoon developer API token | `Configured in .env` |
| `GEMINI_API_KEY` | Google Gemini API key (for narratives) | Optional (falls back to rule template) |

---

## 📂 Project Directory Map

```
Nyaya-AI/
├── frontend/               # React 18 + Vite Web Application
│   ├── src/
│   │   ├── components/     # UI components (RiskGauge, SHAP charts, CaseForm, Tables)
│   │   ├── pages/          # Pages (Dashboard, Cases, CaseDetails, Prediction, Analytics)
│   │   ├── services/       # Axios API client services
│   │   └── routes/         # Protected routes and role-based access
├── backend/                # Express.js REST API Gateway
│   ├── src/
│   │   ├── config/         # Database, env validation (Zod), logger
│   │   ├── controllers/    # Route controllers (Auth, Cases, Predictions, Analytics)
│   │   ├── models/         # Mongoose models (User, Case, Prediction, Recommendation)
│   │   ├── services/       # Kanoon sync, prediction runner, recommendation engine
│   │   └── scripts/        # CLI scripts (syncKanoon.js, seed.js, e2eFlow.js)
├── ml-service/             # FastAPI Machine Learning Engine
│   ├── app/                # API routes (/predict, /explain, /similar, /health)
│   ├── models/             # Persisted models (delay_model.joblib, preprocessor.joblib)
│   ├── training/           # Training pipeline (train.py, import_real_data.py)
│   ├── run.bat             # One-click Windows runner for ML service
│   └── .venv/              # Dedicated Python 3.10 virtual environment
├── shared/                 # Shared JSON schemas and API contracts
└── docs/                   # Detailed documentation (architecture, database, API, setup)
```

---

## 🐳 Docker Quickstart (Alternative)

If you prefer running everything in Docker containers:

```powershell
docker compose up --build
```
* **Frontend:** `http://localhost:5173`
* **API Gateway:** `http://localhost:5000/api`
* **ML Service Docs:** `http://localhost:8000/docs`
