#!/bin/bash
echo "================================================"
echo " LG Production Intelligence System"
echo "================================================"

# Activate virtual environment
source .venv/bin/activate

# Start FastAPI backend in background
echo "Starting backend on port 8000..."
cd backend
uvicorn app:app --host 0.0.0.0 --port 8000 --workers 4 &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
sleep 3

# Start Vite frontend
echo "Starting frontend on port 5173..."
cd frontend
npm run dev

# When frontend exits (Ctrl+C), kill backend too
echo "Shutting down backend..."
kill $BACKEND_PID 2>/dev/null
wait $BACKEND_PID 2>/dev/null
echo "Done."