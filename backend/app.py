# app.py
# FastAPI backend — main entry point.

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect, Depends, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from pydantic import BaseModel
from datetime import datetime
import asyncio
import bcrypt

# Settings (load first) 
from settings import settings

# Auth
from auth import create_access_token, get_current_user

# App setup
app = FastAPI(
    title       = "LG Production Intelligence API",
    description = "Backend for LG AI Production Chatbox",
    version     = "1.0.0"
)

# Rate limiting
limiter           = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code = 429,
        content     = {"detail": "Rate limit exceeded. Please wait before retrying."}
    )

# Security headers middleware 
from middleware import SecurityHeadersMiddleware
app.add_middleware(SecurityHeadersMiddleware)

# SlowAPI middleware 
app.add_middleware(SlowAPIMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins     = settings.allowed_origins,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# Internal imports
from generator import get_database_snapshot, is_production_active
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
from ml  import predict_line, predict_all, train_models
from rag import process_chat, process_troubleshoot

# User store
VALID_USERS = {
    "LG2026": {"password": "$2b$12$if7rhLfmyQQcirYIuIrcFemyH1wErJTakz4fD3A1FUEbZc3a64lj6", "name": "Plant Head",      "role": "Plant Head"},
    "LG2027": {"password": "$2b$12$3QK6SdJSI4LWwxwvGjHkK.XWESsbKy2PJCreQHCNP2PO.KPSLBsK.", "name": "Product Manager", "role": "Product Manager"},
    "LG2028": {"password": "$2b$12$1YY2GoBzAmtShfrWPyRkBOPOl8ebHLp7gAOBot7r3aca27s0E43Ty", "name": "Line Employee",   "role": "Line Employee"},
}

# Startup 
@app.on_event("startup")
def startup():
    init_db()
    count = get_record_count()
    print(f"Server started. Historical records in DB: {count}")
    print("Training ML models...")
    train_models()
    print("ML models trained successfully.")

# Health check 
@app.get("/")
def root():
    return {"status": "ok", "message": "LG Production API is running"}

# Auth: login 
class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    user = VALID_USERS.get(req.username)
    if not user or not bcrypt.checkpw(req.password.encode("utf-8"), user["password"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token_data   = {"user_id": req.username, "name": user["name"], "role": user["role"]}
    access_token = create_access_token(token_data)
    return {"access_token": access_token, "token_type": "bearer"}

# Live snapshot
@app.get("/api/live")
async def get_live(current_user: dict = Depends(get_current_user)):
    now      = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S")
    active   = is_production_active(time_str)
    snapshot = get_database_snapshot(date_str, time_str)
    return {
        "date":               date_str,
        "time":               time_str,
        "production_active":  active,
        "rows":               snapshot["rows"],
        "summary":            snapshot["summary"],
        "alerts":             snapshot["alerts"],
    }

# Historical: by date and line
@app.get("/api/history/line")
async def get_history_line(
    date: str = Query(...),
    line: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    rows = query_by_date_line(date, line)
    return {"date": date, "line": line, "records": rows, "count": len(rows)}

# Historical: by date and product 
@app.get("/api/history/product")
async def get_history_product(
    date:    str = Query(...),
    product: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    rows = query_by_date_product(date, product)
    return {"date": date, "product": product, "records": rows, "count": len(rows)}

# Historical: by date and phase
@app.get("/api/history/phase")
async def get_history_phase(
    date:  str = Query(...),
    phase: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    rows = query_by_date_phase(date, phase)
    return {"date": date, "phase": phase, "records": rows, "count": len(rows)}

# Historical: closest snapshot 
@app.get("/api/history/closest")
async def get_closest_snapshot(
    date: str = Query(...),
    line: str = Query(...),
    time: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    row = query_closest_snapshot(date, line, time)
    if not row:
        return {"error": f"No data found for {line} on {date}"}
    return row

# Day summary 
@app.get("/api/summary/{date}")
async def get_summary(
    date: str,
    current_user: dict = Depends(get_current_user)
):
    summary = query_day_summary(date)
    if not summary:
        return {"error": f"No summary data found for {date}"}
    return summary

# RAG retrieval 
@app.get("/api/rag/retrieve")
async def rag_retrieve(
    date:    str = Query(None),
    line:    str = Query(None),
    product: str = Query(None),
    phase:   str = Query(None),
    time:    str = Query(None),
    limit:   int = Query(10),
    current_user: dict = Depends(get_current_user)
):
    rows          = query_for_rag(date=date, line=line, product=product, phase=phase, time=time, limit=limit)
    context_lines = []
    for r in rows:
        status = "Below Threshold" if r["below_threshold"] else "On Track"
        context_lines.append(
            f"Line {r['line']} ({r['product_name']}) | Date: {r['date']} | "
            f"Time: {r['time']} | Phase: {r['phase']} | Plan: {r['plan']} | "
            f"Target: {r['target']} | Result: {r['result']} | "
            f"Achieve: {r['achieve']}% | Status: {status}"
        )
    return {"rows": rows, "context": "\n".join(context_lines), "count": len(rows)}

# Chat (rate limited) 
@app.post("/api/chat")
@limiter.limit("10/minute")
async def chat(
    request: Request,
    body:    dict,
    current_user: dict = Depends(get_current_user)
):
    query   = body.get("query", "")
    history = body.get("history", [])
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    result = process_chat(query, history)
    # Return only clean production fields — no internal params
    return {
        "response":  result["response"],
        "rows_used": result["rows_used"],
        "is_live":   result["is_live"],
        "intent":    result["intent"],
    }

# Troubleshoot (rate limited)
@app.post("/api/troubleshoot")
@limiter.limit("5/minute")
async def troubleshoot(
    request: Request,
    body:    dict,
    current_user: dict = Depends(get_current_user)
):
    problem = body.get("problem", "")
    if not problem.strip():
        raise HTTPException(status_code=400, detail="Problem description cannot be empty")
    return process_troubleshoot(problem)

# Predict all lines 
@app.get("/api/predict/all")
async def predict_all_lines(current_user: dict = Depends(get_current_user)):
    return predict_all()

# Predict single line 
@app.get("/api/predict/{line}")
async def predict_one(
    line: str,
    current_user: dict = Depends(get_current_user)
):
    return predict_line(line)

# WebSocket live stream 
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        print(f"WebSocket connected. Total clients: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
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
async def websocket_live(ws: WebSocket, token: str = Query(None)):
    # Validate JWT token passed as query param
    if not token:
        await ws.close(code=1008)
        return
    try:
        from auth import decode_access_token
        decode_access_token(token)
    except HTTPException:
        await ws.close(code=1008)
        return

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