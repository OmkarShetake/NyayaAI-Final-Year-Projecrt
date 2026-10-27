# NyayaAI Deployment Guide

This guide provides simple, step-by-step instructions to deploy NyayaAI to production. Choose the deployment path that best fits your needs:

- **[Path A: 100% Free Cloud Deployment](#path-a-100-free-cloud-deployment-recommended-for-demos-viva-portfolio)** (MongoDB Atlas + Render + Vercel) – **Recommended for demos, academic evaluation, and portfolio showcase** (No credit card / no server payment required).
- **[Path B: Single Server / VPS with Docker Compose](#path-b-single-server--vps-with-docker-compose-production--aws--digitalocean)** (AWS EC2 / DigitalOcean / Hetzner / Hostinger) – **Recommended for professional production hosting** using 1 single command.
- **[Path C: Deploy on Railway](#path-c-deploy-on-railway)** (Quickest unified PaaS).

---

## 🏛️ System Architecture Overview

NyayaAI consists of 4 decoupled tiers:

```
[ Browser Client ]
       │
       ▼ (HTTPS)
[ Frontend (React + Vite) ]  ───► Hosted on Vercel / Netlify / Nginx
       │
       ▼ (REST API / JSON)
[ Backend (Node.js 20 Express) ] ───► Hosted on Render / Railway / Docker
       │
       ├─────────────────────────────────┬───────────────────────────────┐
       ▼                                 ▼                               ▼
[ MongoDB Database ]            [ Python ML Service ]         [ Indian Kanoon API ]
(Atlas / Docker container)      (FastAPI + XGBoost + TF-IDF)   (api.indiankanoon.org)
```

---

## Path A: 100% Free Cloud Deployment (Recommended for Demos, Viva, Portfolio)

This setup uses official free tiers across industry-standard cloud providers:
1. **MongoDB Atlas** (Free 512 MB Cloud Database)
2. **Render** (Free Cloud Web Services for Backend & ML Service)
3. **Vercel** (Free Global CDN Hosting for Frontend)

---

### Step 1: Set Up Free Cloud MongoDB (MongoDB Atlas)

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and sign up / log in.
2. Click **Create Deployment** ➔ Choose **M0 Free Tier**.
3. Select your closest AWS / Google Cloud region (e.g., `Mumbai`, `Singapore`, or `Frankfurt`).
4. Under **Security Quickstart**:
   - Create a database user (e.g., Username: `nyaya_admin`, Password: `YourStrongPassword123`). **Save this password!**
   - Under **IP Access List**, click **Allow Access from Anywhere** (`0.0.0.0/0`). This is required so Render can connect to your database.
5. Click **Finish and Close** ➔ Click **Connect** ➔ Choose **Drivers** (Node.js).
6. Copy your connection string. It looks like:
   ```text
   mongodb+srv://nyaya_admin:<password>@cluster0.xxxxx.mongodb.net/nyaya_ai?retryWrites=true&w=majority
   ```
   *(Replace `<password>` with your real password and ensure `/nyaya_ai` is specified as the database name).*

---

### Step 2: Deploy the Python ML Service on Render

The ML service provides XGBoost delay classification, SHAP explanations, and TF-IDF similarity.

1. Push your NyayaAI project to **GitHub**.
2. Go to [render.com](https://render.com) and sign in with GitHub.
3. Click **New +** ➔ **Web Service**.
4. Select your `Nyaya-AI` GitHub repository.
5. Configure the service:
   - **Name:** `nyaya-ml-service`
   - **Language / Runtime:** `Docker`
   - **Dockerfile Path:** `ml-service/Dockerfile`
   - **Docker Context:** `ml-service`
   - **Instance Type:** `Free`
6. Add Environment Variables:
   | Key | Value |
   |-----|-------|
   | `LOG_LEVEL` | `INFO` |
   | `ALLOWED_ORIGINS` | `*` |
   | `AUTO_TRAIN_IF_MISSING` | `true` |
7. Click **Create Web Service**.
8. Wait 3–4 minutes for Docker to build and train the model. Once deployed, copy your ML Service URL (e.g., `https://nyaya-ml-service.onrender.com`).
9. Verify it is running by opening: `https://nyaya-ml-service.onrender.com/health` in your browser. It should return `{"status":"ok"}`.

---

### Step 3: Deploy the Node.js Backend API on Render

1. On [render.com](https://render.com), click **New +** ➔ **Web Service**.
2. Select the same `Nyaya-AI` repository.
3. Configure the service:
   - **Name:** `nyaya-backend`
   - **Language / Runtime:** `Docker`
   - **Dockerfile Path:** `backend/Dockerfile`
   - **Docker Context:** `backend`
   - **Instance Type:** `Free`
4. Add Environment Variables:
   | Key | Value | Description |
   |-----|-------|-------------|
   | `NODE_ENV` | `production` | Production mode |
   | `PORT` | `5000` | Port |
   | `MONGODB_URI` | `mongodb+srv://nyaya_admin:***@cluster0.../nyaya_ai` | Your MongoDB Atlas URL from Step 1 |
   | `JWT_SECRET` | `generate-a-random-string-at-least-32-chars-long` | Encryption key for auth tokens |
   | `JWT_EXPIRES_IN` | `7d` | Token expiry |
   | `ML_SERVICE_URL` | `https://nyaya-ml-service.onrender.com` | URL of ML service from Step 2 |
   | `FRONTEND_URL` | `https://nyaya-ai.vercel.app` | Your Vercel frontend URL (from Step 4) |
   | `CORS_ORIGIN` | `*` *(or your Vercel URL)* | Allowed CORS origins |
   | `KANOON_API_TOKEN` | *(Your token from api.indiankanoon.org or blank)* | Kanoon API Token |
   | `KANOON_AUTO_SYNC_ON_STARTUP` | `true` | Automatically fetches cases on start |
   | `KANOON_AUTO_SYNC_LIMIT` | `60` | Fetch 60+ cases for dashboard |
   | `KANOON_AUTO_SYNC_PREDICT` | `true` | Runs ML risk predictions on fetched cases |
   | `GEMINI_API_KEY` | *(Optional Google Gemini API Key)* | For automated case summaries |
5. Click **Create Web Service**.
6. Wait for the build to finish. Once live, copy your backend URL (e.g., `https://nyaya-backend.onrender.com`).
7. Test the health endpoint: `https://nyaya-backend.onrender.com/health` ➔ should return `{"status":"ok"}`.

---

### Step 4: Deploy the React Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and log in with GitHub.
2. Click **Add New...** ➔ **Project**.
3. Import your `Nyaya-AI` repository.
4. In the configuration screen:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click **Edit** and choose `frontend`.
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `dist` (default)
5. Under **Environment Variables**, add:
   | Name | Value |
   |------|-------|
   | `VITE_API_BASE_URL` | `https://nyaya-backend.onrender.com/api` |
   *(⚠️ Be sure to include `/api` at the end of the backend URL).*
6. Click **Deploy**.
7. Vercel will build and deploy your app in ~45 seconds. You will get a live URL like `https://nyaya-ai.vercel.app`.
8. *Post-deploy update:* Go back to your Render backend service settings and set `CORS_ORIGIN` and `FRONTEND_URL` to your actual Vercel URL (`https://nyaya-ai.vercel.app`).

🎉 **Your entire application is now live on the public internet!**

---

## Path B: Single Server / VPS with Docker Compose (Production / AWS / DigitalOcean)

If you have a Linux VPS (Ubuntu 22.04 / 24.04 on AWS EC2, DigitalOcean Droplet, Linode, Hostinger, or Hetzner), you can deploy the complete stack with 1 command.

### 1. Connect to your VPS and Install Docker

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker & Docker Compose plugin
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version && docker compose version
```

### 2. Clone Repository & Setup Environment

```bash
# Clone your repository
git clone https://github.com/your-username/Nyaya-AI.git
cd Nyaya-AI

# Create your production .env from the example
cp .env.example .env

# Edit .env with your favorite editor
nano .env
```

Set the following in `.env`:
- `JWT_SECRET`: Generate a secure string (e.g., run `openssl rand -hex 32`).
- `VITE_API_BASE_URL`: `http://<YOUR_SERVER_IP>:5000/api` (or `https://api.yourdomain.com/api` if using a domain).
- `CORS_ORIGIN`: `http://<YOUR_SERVER_IP>:5173` (or your domain).
- `KANOON_API_TOKEN`: Your Kanoon token if you have one.

### 3. Launch the Stack

```bash
# Build and run all 4 containers in the background
docker compose up -d --build
```

To view real-time logs:
```bash
docker compose logs -f
```

To check container health:
```bash
docker compose ps
```

Your services are running on:
- **Frontend:** `http://<YOUR_SERVER_IP>:5173`
- **Backend API:** `http://<YOUR_SERVER_IP>:5000/api`
- **ML Service:** `http://<YOUR_SERVER_IP>:8000/docs`
- **MongoDB:** `localhost:27017`

### 4. (Optional) Production Nginx Reverse Proxy + Free SSL (HTTPS)

To serve the app on standard port 80/443 with a custom domain name:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/nyaya`:
```nginx
server {
    server_name yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site & get free SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/nyaya /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Path C: Deploy on Railway

[Railway.app](https://railway.app) allows deploying multi-service repositories with automatic MongoDB provisioning:

1. Sign up on [Railway.app](https://railway.app).
2. Click **New Project** ➔ **Provision MongoDB**.
3. In the same project, click **New** ➔ **GitHub Repo** ➔ select `Nyaya-AI`.
4. In Settings:
   - For backend: Set root directory to `/backend`, set env vars (`MONGODB_URI=${{MongoDB.MONGO_URL}}`, `JWT_SECRET`, `ML_SERVICE_URL`).
   - For ML Service: Add service with root directory `/ml-service`.
   - For Frontend: Add service with root directory `/frontend` and build command `npm run build`.
5. Railway provides public HTTPS domains for each service.

---

## 🔑 Environment Variables Cheat Sheet

| Variable | Required By | Default / Example | Purpose |
|----------|-------------|-------------------|---------|
| `VITE_API_BASE_URL` | Frontend | `https://nyaya-backend.onrender.com/api` | Full URL to backend API endpoint |
| `NODE_ENV` | Backend | `production` | Activates production security & caching |
| `PORT` | Backend | `5000` | Port backend listens on (Render sets automatically) |
| `MONGODB_URI` | Backend | `mongodb+srv://...` | Connection URI to MongoDB Atlas or local container |
| `JWT_SECRET` | Backend | Minimum 16 random characters | Secret key for signing user auth tokens |
| `JWT_EXPIRES_IN` | Backend | `7d` | Lifespan of JWT login tokens |
| `ML_SERVICE_URL` | Backend | `https://nyaya-ml-service.onrender.com` | Internal or public URL to Python FastAPI service |
| `FRONTEND_URL` | Backend | `https://nyaya-ai.vercel.app` | Base URL of frontend application |
| `CORS_ORIGIN` | Backend | `https://nyaya-ai.vercel.app` | Allowed browser origins (supports comma-separated list or `*`) |
| `KANOON_API_TOKEN` | Backend | *(optional token)* | Token to access live Indian Kanoon API |
| `KANOON_AUTO_SYNC_ON_STARTUP` | Backend | `true` | Automatically synchronizes judgments upon backend start |
| `KANOON_AUTO_SYNC_LIMIT` | Backend | `60` | Number of cases to auto-fetch |
| `KANOON_AUTO_SYNC_PREDICT` | Backend | `true` | Auto-runs ML delay predictions on newly fetched cases |
| `GEMINI_API_KEY` | Backend | *(optional Google API key)* | Generates AI summaries and action recommendations |
| `ALLOWED_ORIGINS` | ML Service | `*` | Allowed origins that can invoke FastAPI endpoints |
| `AUTO_TRAIN_IF_MISSING` | ML Service | `true` | Automatically trains ML model if model artifacts are missing |

---

## 🧪 Production Verification Checklist

After deploying your services, run this quick check:

- [ ] **ML Service Health:** Visit `https://<YOUR_ML_URL>/health` ➔ returns `{"status":"ok"}`.
- [ ] **Backend Health:** Visit `https://<YOUR_BACKEND_URL>/health` ➔ returns `{"status":"ok"}`.
- [ ] **Frontend Loading:** Open your Vercel URL in browser ➔ loads NyayaAI login/register screen.
- [ ] **Authentication:** Register a new user ➔ redirects directly to the Dashboard.
- [ ] **Dashboard Cases:** Check if cases are populated (60+ cases from auto-sync or seed).
- [ ] **Case Prediction:** Click any case ➔ check if ML Delay Risk score, gauge, and SHAP factors appear.
- [ ] **Similar Precedent Retrieval:** Click "Find Similar Cases" ➔ verifies live Indian Kanoon search & TF-IDF similarity.
- [ ] **Page Refresh:** Refresh on a sub-route like `/cases` ➔ page loads smoothly without 404 error (handled by `vercel.json`).

---

## 💡 Troubleshooting Common Deployment Issues

### 1. `CORS policy: No 'Access-Control-Allow-Origin' header is present`
- **Fix:** In your backend Render environment settings, update `CORS_ORIGIN` to match your exact Vercel frontend URL (e.g. `https://nyaya-ai.vercel.app` without a trailing slash) or set `CORS_ORIGIN=*`.

### 2. Frontend 404 on page refresh on Vercel
- **Fix:** Ensure `frontend/vercel.json` exists with the rewrite rule:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
  *(This is already included in the repository).*

### 3. Backend shows `MongoServerSelectionError: connection timed out`
- **Fix:** In MongoDB Atlas ➔ **Network Access** ➔ Ensure `0.0.0.0/0` (Allow access from anywhere) is active. Render uses dynamic IPs, so whitelisting `0.0.0.0/0` is mandatory.

### 4. Render Free Tier Spin-down (Cold Starts)
- On the free tier, Render spins down inactive web services after 15 minutes. The first request after sleep may take ~30–45 seconds to wake up.
- **Tip for live presentations / viva:** Open your frontend and backend URLs 2 minutes before your demonstration so both services are already warm and responsive. Alternatively, use a free service like [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com) to ping `https://nyaya-backend.onrender.com/health` every 10 minutes.
