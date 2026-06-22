@echo off
echo ================================================
echo  LG Production Intelligence System
echo ================================================

:: Start FastAPI backend in a new command prompt
echo Starting backend on port 8000...
start "LG Backend" cmd /k "cd /d %~dp0backend && ..\.venv\Scripts\uvicorn app:app --host 0.0.0.0 --port 8000 --workers 4"

:: Wait 3 seconds for backend to start up
timeout /t 3 /nobreak >nul

:: Start Vite frontend in the current command prompt
echo Starting frontend on port 5173...
cd frontend
npm run dev
