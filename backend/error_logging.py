import json
import os
import sqlite3
import smtplib
from base64 import b64decode
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
ERROR_DIR = BASE_DIR / "error_reports"
ERROR_DIR.mkdir(exist_ok=True)
load_dotenv(BASE_DIR / ".env")

ADMIN_EMAIL   = os.getenv("ADMIN_EMAIL", "").strip()
SENDER_EMAIL  = os.getenv("SENDER_EMAIL", "").strip()
SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587").strip() or "587")
SMTP_USERNAME = os.getenv("SMTP_USERNAME", SENDER_EMAIL).strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip().replace(" ", "")

ERROR_CODES = {
    "ERR_001": {
        "type": "Backend Server Error",
        "severity": "CRITICAL",
        "description": "Backend server crash / 500 error",
    },
    "ERR_002": {
        "type": "Database Query Failed",
        "severity": "CRITICAL",
        "description": "Database query failed / SQLite error",
    },
    "ERR_003": {
        "type": "ML Prediction Failed",
        "severity": "CRITICAL",
        "description": "ML model prediction failed",
    },
    "ERR_004": {
        "type": "RAG Pipeline Error",
        "severity": "CRITICAL",
        "description": "RAG pipeline failed / Gemini API error",
    },
    "ERR_005": {
        "type": "WebSocket Session Error",
        "severity": "CRITICAL",
        "description": "WebSocket connection dropped mid-session",
    },
    "ERR_006": {
        "type": "JWT Token Error",
        "severity": "CRITICAL",
        "description": "JWT token generation failed on login",
    },
    "ERR_007": {
        "type": "Data Integrity Error",
        "severity": "CRITICAL",
        "description": "Missing columns / corrupt snapshot",
    },
    "WARN_001": {
        "type": "Invalid Production Line",
        "severity": "WARNING",
        "description": "Invalid production line code entered",
    },
    "WARN_002": {
        "type": "Historical Data Missing",
        "severity": "WARNING",
        "description": "Historical data not found for requested date/line",
    },
    "WARN_003": {
        "type": "No RAG Retrieval Results",
        "severity": "WARNING",
        "description": "No data returned from RAG retrieval",
    },
    "WARN_004": {
        "type": "Rate Limit Hit",
        "severity": "WARNING",
        "description": "Too many requests",
    },
    "WARN_005": {
        "type": "Prediction Unavailable",
        "severity": "WARNING",
        "description": "Prediction unavailable for a line",
    },
    "INFO_001": {
        "type": "Offline / No Internet",
        "severity": "INFO",
        "description": "User offline / navigator.onLine = false",
    },
    "INFO_002": {
        "type": "Empty Query",
        "severity": "INFO",
        "description": "User typed empty query",
    },
    "INFO_003": {
        "type": "Wrong File Format",
        "severity": "INFO",
        "description": "File upload wrong format",
    },
    "INFO_004": {
        "type": "Voice Input Unsupported",
        "severity": "INFO",
        "description": "Voice input not supported in browser",
    },
    "INFO_005": {
        "type": "Expected 401 Redirect",
        "severity": "INFO",
        "description": "Token expired or expected redirect",
    },
}


def get_error_metadata(error_code: str) -> dict:
    return ERROR_CODES.get(error_code, {
        "type": "Unknown Error",
        "severity": "CRITICAL",
        "description": "Unknown error encountered",
    })


def get_error_severity(error_code: str) -> str:
    return get_error_metadata(error_code)["severity"]


def should_email_error(error_code: str) -> bool:
    return get_error_severity(error_code) == "CRITICAL"


DB_PATH = BASE_DIR / "production.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn


def init_error_tables() -> None:
    conn = get_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS error_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            error_code TEXT NOT NULL,
            severity TEXT NOT NULL,
            error_type TEXT NOT NULL,
            message TEXT NOT NULL,
            user_id TEXT,
            user_name TEXT,
            user_role TEXT,
            page TEXT,
            query TEXT,
            response_code TEXT,
            timestamp TEXT NOT NULL,
            screenshot_path TEXT,
            request_info TEXT,
            email_sent INTEGER DEFAULT 0,
            resolved INTEGER DEFAULT 0
        )
        """
    )
    conn.commit()
    conn.close()


def _safe_json(data: Any) -> str:
    try:
        return json.dumps(data, default=str)
    except Exception:
        return json.dumps({"value": str(data)})


def _save_screenshot(screenshot: Optional[str]) -> Optional[str]:
    if not screenshot:
        return None

    try:
        if not screenshot.startswith("data:image/"):
            return None

        header, encoded = screenshot.split(",", 1)
        ext = ".png"
        if "image/jpeg" in header:
            ext = ".jpg"
        elif "image/webp" in header:
            ext = ".webp"

        file_name = f"error_{datetime.now().strftime('%Y%m%d_%H%M%S')}{ext}"
        path = ERROR_DIR / file_name
        decoded = b64decode(encoded)
        path.write_bytes(decoded)
        return str(path)
    except Exception:
        return None


def log_error_event(
    error_code: str,
    message: str,
    *,
    user_id: Optional[str] = None,
    user_name: Optional[str] = None,
    user_role: Optional[str] = None,
    page: Optional[str] = None,
    query: Optional[str] = None,
    response_code: Optional[str] = None,
    screenshot: Optional[str] = None,
    request_info: Optional[dict] = None,
) -> dict:
    init_error_tables()
    metadata = get_error_metadata(error_code)
    severity = metadata["severity"]
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    screenshot_path = _save_screenshot(screenshot)

    conn = get_connection()
    cursor = conn.execute(
        """
        INSERT INTO error_logs (
            error_code, severity, error_type, message, user_id, user_name,
            user_role, page, query, response_code, timestamp,
            screenshot_path, request_info
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            error_code,
            severity,
            metadata["type"],
            message,
            user_id,
            user_name,
            user_role,
            page,
            query,
            response_code,
            timestamp,
            screenshot_path,
            _safe_json(request_info or {}),
        ),
    )
    error_id = cursor.lastrowid
    conn.commit()
    conn.close()

    payload = {
        "id": error_id,
        "error_code": error_code,
        "severity": severity,
        "error_type": metadata["type"],
        "message": message,
        "user_id": user_id,
        "user_name": user_name,
        "user_role": user_role,
        "page": page,
        "query": query,
        "response_code": response_code,
        "timestamp": timestamp,
        "screenshot_path": screenshot_path,
        "request_info": request_info,
    }

    if should_email_error(error_code):
        import threading
        t = threading.Thread(target=send_error_email, args=(payload,), daemon=True)
        t.start()

    return payload


def send_error_email(payload: dict) -> bool:
    if not SMTP_PASSWORD:
        print("SMTP password not configured; skipping email send.")
        return False

    try:
        msg = EmailMessage()
        msg["Subject"] = (
            f"[LG ALERT] {payload['error_code']} — {payload['error_type']}"
        )
        msg["From"] = SENDER_EMAIL
        msg["To"] = ADMIN_EMAIL
        msg["Reply-To"] = SENDER_EMAIL

        user_label = (
            f"{payload.get('user_name') or 'Unknown User'}"
            f" ({payload.get('user_id') or 'unknown'})"
        )
        if payload.get('user_role'):
            user_label = f"{user_label} — {payload.get('user_role')}"

        body = (
            f"Error Code    : {payload['error_code']}\n"
            f"Error Type    : {payload['error_type']}\n"
            f"User          : {user_label}\n"
            f"Page          : {payload.get('page') or 'Unknown'}\n"
            f"Query         : {payload.get('query') or '-'}\n"
            f"Time          : {payload.get('timestamp')}\n"
            f"Response Code : {payload.get('response_code') or '-'}\n"
            f"Message       : {payload.get('message')}\n\n"
        )
        msg.set_content(body)

        if payload.get("screenshot_path"):
            with open(payload["screenshot_path"], "rb") as f:
                content = f.read()
            msg.add_attachment(
                content,
                maintype="image",
                subtype="png" if payload["screenshot_path"].endswith(".png") else "jpeg",
                filename=os.path.basename(payload["screenshot_path"]),
            )

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)

        conn = get_connection()
        conn.execute(
            "UPDATE error_logs SET email_sent = 1 WHERE id = ?",
            (payload["id"],),
        )
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Failed to send error email: {e}")
        return False
