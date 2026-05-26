# app.py
# FastAPI backend server — main entry point.
# Run with: uvicorn app:app --reload --port 8000
# Routes:
#   GET  /api/live              → current snapshot from generator.py
#   GET  /api/history           → SQLite query for historical data
#   GET  /api/summary/{date}    → day summary for a date
#   POST /api/chat              → RAG pipeline 
#   GET  /api/predict/{line}    → ML prediction 
#   WS   /ws/live               → WebSocket live stream 

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import asyncio

from generator import get_database_snapshot, get_line_metrics_at, is_production_active
from database  import (
    init_db,
    get_record_count,
    query_by_date_line,
    query_by_date_product,
    query_by_date_phase,
    query_closest_snapshot,
    query_day_summary,
    query_for_rag,
)

# App setup
app = FastAPI(
    title       = "LG Production Intelligence API",
    description = "Backend for LG AI Production Chatbox",
    version     = "1.0.0"
)

# Allow Vite frontend to call this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:5173"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# Initialise DB on startup
@app.on_event("startup")
def startup():
    init_db()
    count = get_record_count()
    print(f"Server started. Historical records in DB: {count}")

# Health check
@app.get("/")
def root():
    return {"status": "ok", "message": "LG Production API is running"}

# Live snapshot
@app.get("/api/live")
def get_live():
    """
    Returns the current production snapshot for all 13 lines.
    Calculated on-the-fly from generator.py every time it's called.
    """
    now      = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S")
    active   = is_production_active(time_str)
    snapshot = get_database_snapshot(date_str, time_str)

    return {
        "date":            date_str,
        "time":            time_str,
        "production_active": active,
        "rows":            snapshot["rows"],
        "summary":         snapshot["summary"],
        "alerts":          snapshot["alerts"],
    }

# Historical: by date and line
@app.get("/api/history/line")
def get_history_line(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    line: str = Query(..., description="Line code e.g. CM1, W1, R2")
):
    """Returns all shift snapshots for a specific line on a date."""
    rows = query_by_date_line(date, line)
    return {"date": date, "line": line, "records": rows, "count": len(rows)}

# Historical: by date and product
@app.get("/api/history/product")
def get_history_product(
    date:    str = Query(..., description="Date in YYYY-MM-DD format"),
    product: str = Query(..., description="Product code e.g. WMC, REF, COMP")
):
    """Returns all snapshots for all lines of a product on a date."""
    rows = query_by_date_product(date, product)
    return {"date": date, "product": product, "records": rows, "count": len(rows)}

# Historical: by date and phase
@app.get("/api/history/phase")
def get_history_phase(
    date:  str = Query(..., description="Date in YYYY-MM-DD format"),
    phase: str = Query(..., description="Phase name e.g. 'Peak Day Shift'")
):
    """Returns all line snapshots for a shift phase on a date."""
    rows = query_by_date_phase(date, phase)
    return {"date": date, "phase": phase, "records": rows, "count": len(rows)}

#Historical: closest snapshot to a time 
@app.get("/api/history/closest")
def get_closest_snapshot(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    line: str = Query(..., description="Line code"),
    time: str = Query(..., description="Time in HH:MM format")
):
    """Returns the snapshot closest to the requested time."""
    row = query_closest_snapshot(date, line, time)
    if not row:
        return {"error": f"No data found for {line} on {date}"}
    return row

# Day summary 
@app.get("/api/summary/{date}")
def get_summary(date: str):
    """Returns aggregated end-of-day totals for a date."""
    summary = query_day_summary(date)
    if not summary:
        return {"error": f"No summary data found for {date}"}
    return summary

# Flexible RAG retrieval 
@app.get("/api/rag/retrieve")
def rag_retrieve(
    date:    str = Query(None),
    line:    str = Query(None),
    product: str = Query(None),
    phase:   str = Query(None),
    time:    str = Query(None),
    limit:   int = Query(10)
):
    """
    Flexible retrieval endpoint used by the RAG pipeline.
    Any parameter can be omitted - only provided ones are filtered on.
    Returns matching rows as structured data + formatted context string.
    """
    rows = query_for_rag(
        date    = date,
        line    = line,
        product = product,
        phase   = phase,
        time    = time,
        limit   = limit
    )

    # Format rows as readable text for Gemini context
    context_lines = []
    for r in rows:
        status = "Below Threshold" if r["below_threshold"] else "On Track"
        context_lines.append(
            f"Line {r['line']} ({r['product_name']}) | "
            f"Date: {r['date']} | Time: {r['time']} | "
            f"Phase: {r['phase']} | "
            f"Plan: {r['plan']} | Target: {r['target']} | "
            f"Result: {r['result']} | Achieve: {r['achieve']}% | "
            f"Status: {status}"
        )

    context = "\n".join(context_lines)
    return {"rows": rows, "context": context, "count": len(rows)}

# Chat endpoint
from rag import process_chat
@app.post("/api/chat")
def chat(body: dict):
    """
    RAG pipeline endpoint.
    Accepts query + optional conversation history.
    Returns Gemini-generated response grounded in production data.
    """
    query   = body.get("query", "")
    history = body.get("history", [])

    if not query.strip():
        return {"error": "Query cannot be empty"}

    result = process_chat(query, history)
    return result

# Predict endpoint /
@app.get("/api/predict/{line}")
def predict(line: str):
    """
    ML prediction endpoint.
    """
    return {
        "line":    line,
        "message": "ML prediction ."
    }

# WebSocket live stream
class ConnectionManager:
    """Manages all active WebSocket connections."""
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        print(f"WebSocket connected. Total clients: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)
        print(f"WebSocket disconnected. Total clients: {len(self.active)}")

    async def broadcast(self, data: dict):
        for ws in self.active.copy():
            try:
                await ws.send_json(data)
            except Exception:
                self.active.remove(ws)

manager = ConnectionManager()

@app.websocket("/ws/live")
async def websocket_live(ws: WebSocket):
    """
    WebSocket endpoint — broadcasts live snapshot every second
    to all connected frontend clients.
    """
    await manager.connect(ws)
    try:
        while True:
            now      = datetime.now()
            date_str = now.strftime("%Y-%m-%d")
            time_str = now.strftime("%H:%M:%S")
            active   = is_production_active(time_str)
            snapshot = get_database_snapshot(date_str, time_str)

            await ws.send_json({
                "date":              date_str,
                "time":              time_str,
                "production_active": active,
                "rows":              snapshot["rows"],
                "summary":           snapshot["summary"],
                "alerts":            snapshot["alerts"],
            })

            await asyncio.sleep(1)

    except WebSocketDisconnect:
        manager.disconnect(ws)