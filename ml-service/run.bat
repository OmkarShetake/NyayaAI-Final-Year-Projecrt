@echo off
echo ====================================================
echo Starting NyayaAI Python ML Service on http://localhost:8000
echo ====================================================
cd /d "%~dp0"
if exist .venv\Scripts\uvicorn.exe (
    .\.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload
) else (
    echo Error: .venv virtual environment not found.
    pause
)
