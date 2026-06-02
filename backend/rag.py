# rag.py
# RAG pipeline — Retrieval Augmented Generation.
import os
import re
from datetime import datetime, timedelta
from google import genai
from dotenv import load_dotenv

from generator import (
    get_database_snapshot,
    get_line_metrics_at,
    is_production_active,
    PRODUCTS,
    LINE_TO_PRODUCT,
    PHASES,
    ACHIEVE_THRESHOLD,
    get_phase_name,
    time_str_to_minutes
)
from database import query_for_rag, query_day_summary

# Setup
load_dotenv()
load_dotenv(override=True)

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize the client ONCE at the module level
_client = genai.Client(api_key=GEMINI_API_KEY)

def get_client():
    """Returns the persistent client instance."""
    return _client

# System prompt 
SYSTEM_PROMPT = """
You are an AI production intelligence assistant for LG Electronics.
You help plant heads, product managers, and line employees query
real-time and historical factory production data. Follow all internal rules 
regarding brief answers and detailed breakdowns.

FACTORY CONTEXT:
Products and their production lines:
  REF  (Refrigerator)         : R1, R2, PCB01, PCB03
  WMC  (Washing Machine)      : W1, W2, PCB04
  COMP (Compressor)           : CM1, CM2
  RAC  (Residential AC)       : A1, A4, PCB02
  A08  (Water Purifier)       : WP1

Production shifts:
  Phase 1 : Early Morning Shift  —  9:00 AM to 10:30 AM
  Phase 2 : Peak Day Shift       — 10:30 AM to  1:30 PM
  Downtime                       —  1:30 PM to  2:00 PM
  Phase 3 : Afternoon Shift      —  2:00 PM to  4:00 PM
  Phase 4 : Evening Shift        —  4:00 PM to  6:00 PM

Database columns:
  Plan     = daily end-of-day production target
  Target   = expected units by current time in current phase
  Result   = actual units produced so far
  Achieve% = Result / Target x 100
  Threshold = 80% (lines below this are flagged as underperforming)

RESPONSE RULES:
1. Always give a BRIEF answer first (2-3 sentences max).
2. End every response with: "Reply 'detail' for a full breakdown."
3. If achieve % is below 80%, always flag it clearly.
4. Use the exact data provided in the context — never guess or invent numbers.
5. Be direct and professional — users are factory personnel familiar with these terms.
6. For predictive queries, base your answer on the projection data provided.
7. If no relevant data is found, say so clearly and suggest rephrasing.
""".strip()


# Step 1: Query parameter extraction
def extract_query_params(query_str, override_context=None):
    if override_context is None:
        override_context = {}
    q     = query_str.lower()
    today = datetime.now()

    # Date resolution
    resolved_date = override_context.get("date", today.strftime("%Y-%m-%d"))
    date_was_explicit = "date" in override_context

    if "day before yesterday" in q:
        resolved_date     = (today - timedelta(days=2)).strftime("%Y-%m-%d")
        date_was_explicit = True
    elif "yesterday" in q:
        resolved_date     = (today - timedelta(days=1)).strftime("%Y-%m-%d")
        date_was_explicit = True
    else:
        month_names = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
        explicit = re.search(r"(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})", q)
        if explicit:
            day = explicit.group(1).zfill(2)
            month = str(month_names.index(explicit.group(2)) + 1).zfill(2)
            year = explicit.group(3)
            resolved_date = f"{year}-{month}-{day}"
            date_was_explicit = True
        iso = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", q)
        if iso:
            resolved_date = iso.group(1)
            date_was_explicit = True

    # Time resolution
    is_current_time = False
    resolved_time   = None
    current_keywords = ["right now", "current", "currently", "now", "latest", "live"]
    if any(k in q for k in current_keywords):
        resolved_time   = datetime.now().strftime("%H:%M")
        is_current_time = True
    else:
        time_match = re.search(r"(?<!\d)(\d{1,2}):(\d{2})(?:\s*(am|pm))?(?!\d)|(?<!\d)(\d{1,2})\s*(am|pm)(?!\w)", q)
        if time_match:
            if time_match.group(1):
                hour = int(time_match.group(1))
                mins = time_match.group(2)
                ampm = time_match.group(3)
            else:
                hour = int(time_match.group(4))
                mins = "00"
                ampm = time_match.group(5)
            if ampm == "pm" and hour < 12:  hour += 12
            if ampm == "am" and hour == 12: hour  = 0
            if 9 <= hour <= 18:
                resolved_time = f"{str(hour).zfill(2)}:{mins}"

        if not resolved_time:
            if date_was_explicit:
                resolved_time   = "18:00"
                is_current_time = False
            else:
                resolved_time   = datetime.now().strftime("%H:%M")
                is_current_time = True

    # Shift/Line/Product/Intent extraction
    resolved_shift = None
    if "early morning" in q: resolved_shift = "Early Morning Shift"
    elif "peak day" in q or "peak" in q: resolved_shift = "Peak Day Shift"
    elif "afternoon" in q: resolved_shift = "Afternoon Shift"
    elif "evening" in q: resolved_shift = "Evening Shift"
    elif "downtime" in q: resolved_shift = "Downtime"

    all_lines = list(LINE_TO_PRODUCT.keys())
    found_lines = [line for line in all_lines if re.search(rf"\b{line.lower()}\b", q)]
    if not found_lines and "lines" in override_context:
        found_lines = override_context["lines"]

    product_keywords = {"REF": ["ref", "refrigerator", "fridge"], "WMC": ["wmc", "washing machine", "washer"], "COMP": ["comp", "compressor"], "RAC": ["rac", "air conditioner", "residential ac"], "A08": ["a08", "water purifier", "purifier"]}
    found_products = []
    for prod_id, keywords in product_keywords.items():
        if any(kw in q for kw in keywords):
            found_products.append(prod_id)
            if not found_lines: found_lines.extend(PRODUCTS[prod_id]["lines"].keys())

    intent = "status"
    if any(k in q for k in ["predict", "will", "meet", "on track", "forecast"]): intent = "prediction"
    elif any(k in q for k in ["achieve", "achievement", "%"]): intent = "achieve"
    elif any(k in q for k in ["result", "actual", "produced", "output"]): intent = "result"
    elif any(k in q for k in ["target"]): intent = "target"
    elif any(k in q for k in ["plan"]): intent = "plan"
    elif any(k in q for k in ["rate", "speed", "per minute", "per hour"]): intent = "rate"
    elif any(k in q for k in ["alert", "below", "threshold", "underperform"]): intent = "alerts"
    elif any(k in q for k in ["summary", "total", "overall", "factory"]): intent = "summary"

    return {
        "lines": found_lines, "products": found_products, "date": resolved_date, "time": resolved_time,
        "shift": resolved_shift, "intent": intent, "is_current_time": is_current_time,
        "is_predictive": intent == "prediction", "is_detailed": any(k in q for k in ["detail", "detailed", "breakdown", "full"]),
        "raw_query": query_str
    }

def retrieve_and_format(params):
    date, time, lines, shift, intent = params["date"], params["time"], params["lines"], params["shift"], params["intent"]
    today = datetime.now().strftime("%Y-%m-%d")
    is_live = params["is_current_time"] and date == today
    rows = []
    if is_live:
        snapshot = get_database_snapshot(today, datetime.now().strftime("%H:%M:%S"))
        rows = snapshot["rows"]
        if lines: rows = [r for r in rows if r["line"] in lines]
        if intent == "alerts": rows = [r for r in rows if r.get("below_threshold")]
    else:
        rows = query_for_rag(date=date, line=lines[0] if len(lines) == 1 else None, product=params["products"][0] if len(params["products"]) == 1 else None, phase=shift, time=time, limit=15)
        if len(lines) > 1: rows = [r for r in rows if r["line"] in lines]
    if not rows: return "No production data found matching the query parameters.", []
    context_parts = []
    for r in rows:
        bt = r.get("below_threshold") or r.get("belowThreshold") or False
        context_parts.append(f"Line {r['line']} ({r.get('product_name', r.get('productName', ''))}) | Date: {r['date']} | Time: {r['time']} | Status: {'BELOW THRESHOLD' if bt else 'On Track'} | Achieve: {r.get('achieve', 0):.1f}%")
    return "\n\n".join(context_parts), rows

def call_gemini(query_str, context, history=None, is_detailed=False):
    history_text = "\n".join([f"{'User' if t['role']=='user' else 'Assistant'}: {t['content']}" for t in (history or [])[-6:]])
    prompt = f"{SYSTEM_PROMPT}\n\nRETRIEVED PRODUCTION DATA:\n{context}\n\nCONVERSATION HISTORY:\n{history_text}\n\nUser: {query_str}\nAssistant:"
    return get_client().models.generate_content(model=GEMINI_MODEL, contents=prompt).text.strip()

def process_chat(query_str, history=None):
    last_context = {}
    if history:
        for turn in reversed(history):
            if turn["role"] == "assistant":
                date_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", turn["content"])
                if date_match:
                    last_context["date"] = date_match.group(1)
                break
    params = extract_query_params(query_str, override_context=last_context)
    context, rows = retrieve_and_format(params)
    return {
        "response": call_gemini(query_str, context, history, params["is_detailed"]),
        "params": params, "rows_used": len(rows), "is_live": params["is_current_time"], "intent": params["intent"]
    }


# Quick test 
if __name__ == "__main__":
    test_queries = [
        "What is the current status of the WMC production lines?",
        "What was the result of CM1 on 2026-05-20 at 3pm?",
        "What was CM1 doing on 19th May 2026?",
        "Will R1 meet today's plan?",
        "Which lines are below threshold right now?",
        "What was WMC doing yesterday?",
    ]
    for q in test_queries:
        print(f"\nQuery: {q}")
        print("-" * 60)
        result = process_chat(q)
        print(f"Intent   : {result['intent']}")
        print(f"Live     : {result['is_live']}")
        print(f"Date     : {result['params']['date']}")
        print(f"Time     : {result['params']['time']}")
        print(f"Rows     : {result['rows_used']}")
        print(f"Response :\n{result['response']}")
        print("=" * 60)