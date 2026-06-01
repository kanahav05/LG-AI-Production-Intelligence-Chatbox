# rag.py
# RAG pipeline — Retrieval Augmented Generation.
# Handles all /api/chat requests.

import os
import re
from datetime import datetime, timedelta
from dotenv import load_dotenv
from google import genai

# Load environment variables from .env file
load_dotenv()
load_dotenv(override=True)
print(os.getenv("GEMINI_API_KEY"))

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

# Gemini setup 
GEMINI_MODEL   = "gemini-2.5-flash"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def get_client():
    """Returns a Gemini client using the key from environment variables."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not found in environment variables.")
    return genai.Client(api_key=GEMINI_API_KEY)

# System prompt 
# Grounds Gemini in LG factory domain knowledge.
# Sent with every API call as the base instruction.
SYSTEM_PROMPT = """
You are an AI production intelligence assistant for LG Electronics.
You help plant heads, product managers, and line employees query
real-time and historical factory production data.

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


# Query parameter extraction
def extract_query_params(query_str):
    """
    Reads a raw user query and extracts structured parameters.
    Returns a dict with: lines, products, date, time, shift,
    intent, is_current_time, is_predictive, is_detailed.
    """
    q     = query_str.lower()
    today = datetime.now()

    # Date resolution 
    resolved_date = today.strftime("%Y-%m-%d")  # default: today

    if "day before yesterday" in q:
        resolved_date = (today - timedelta(days=2)).strftime("%Y-%m-%d")
    elif "yesterday" in q:
        resolved_date = (today - timedelta(days=1)).strftime("%Y-%m-%d")
    else:
        month_names = [
            "january", "february", "march", "april",
            "may", "june", "july", "august",
            "september", "october", "november", "december"
        ]
        explicit = re.search(
            r"(\d{1,2})(?:st|nd|rd|th)?\s+"
            r"(january|february|march|april|may|june|july|august"
            r"|september|october|november|december)\s+(\d{4})",
            q
        )
        if explicit:
            day   = explicit.group(1).zfill(2)
            month = str(month_names.index(explicit.group(2)) + 1).zfill(2)
            year  = explicit.group(3)
            resolved_date = f"{year}-{month}-{day}"

        iso = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", q)
        if iso:
            resolved_date = iso.group(1)

    # Time resolution
    is_current_time = False
    resolved_time   = None

    current_keywords = [
        "right now", "current", "currently",
        "now", "latest", "live"
    ]
    if any(k in q for k in current_keywords):
        resolved_time   = datetime.now().strftime("%H:%M")
        is_current_time = True
    else:
        time_match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", q)
        if time_match:
            hour = int(time_match.group(1))
            mins = time_match.group(2) or "00"
            ampm = time_match.group(3)
            if ampm == "pm" and hour < 12:  hour += 12
            if ampm == "am" and hour == 12: hour  = 0
            if 9 <= hour <= 18:
                resolved_time = f"{str(hour).zfill(2)}:{mins}"
        if not resolved_time:
            resolved_time   = datetime.now().strftime("%H:%M")
            is_current_time = True

    # Shift resolution
    resolved_shift = None
    if   "early morning" in q:              resolved_shift = "Early Morning Shift"
    elif "peak day" in q or "peak" in q:    resolved_shift = "Peak Day Shift"
    elif "afternoon"     in q:              resolved_shift = "Afternoon Shift"
    elif "evening"       in q:              resolved_shift = "Evening Shift"
    elif "downtime"      in q:              resolved_shift = "Downtime"

    # Line extraction
    all_lines   = list(LINE_TO_PRODUCT.keys())
    found_lines = [
        line for line in all_lines
        if re.search(rf"\b{line.lower()}\b", q)
    ]

    # Product extraction 
    product_keywords = {
        "REF":  ["ref", "refrigerator", "fridge"],
        "WMC":  ["wmc", "washing machine", "washer"],
        "COMP": ["comp", "compressor"],
        "RAC":  ["rac", "air conditioner", "residential ac"],
        "A08":  ["a08", "water purifier", "purifier"]
    }
    found_products = []
    for prod_id, keywords in product_keywords.items():
        if any(kw in q for kw in keywords):
            found_products.append(prod_id)
            if not found_lines:
                found_lines.extend(PRODUCTS[prod_id]["lines"].keys())

    # Intent extraction 
    intent = "status"

    if   any(k in q for k in ["predict", "will", "meet", "on track", "forecast"]):
        intent = "prediction"
    elif any(k in q for k in ["achieve", "achievement", "%"]):
        intent = "achieve"
    elif any(k in q for k in ["result", "actual", "produced", "output"]):
        intent = "result"
    elif any(k in q for k in ["target"]):
        intent = "target"
    elif any(k in q for k in ["plan"]):
        intent = "plan"
    elif any(k in q for k in ["rate", "speed", "per minute", "per hour"]):
        intent = "rate"
    elif any(k in q for k in ["alert", "below", "threshold", "underperform"]):
        intent = "alerts"
    elif any(k in q for k in ["summary", "total", "overall", "factory"]):
        intent = "summary"

    is_detailed   = any(k in q for k in ["detail", "detailed", "breakdown", "full"])
    is_predictive = intent == "prediction"

    return {
        "lines":           found_lines,
        "products":        found_products,
        "date":            resolved_date,
        "time":            resolved_time,
        "shift":           resolved_shift,
        "intent":          intent,
        "is_current_time": is_current_time,
        "is_predictive":   is_predictive,
        "is_detailed":     is_detailed,
        "raw_query":       query_str
    }


# Retrieve and format context
def retrieve_and_format(params):
    """
    Decides whether to use live data (generator.py) or
    historical data (SQLite) based on extracted parameters.
    """
    date    = params["date"]
    time    = params["time"]
    lines   = params["lines"]
    shift   = params["shift"]
    intent  = params["intent"]
    today   = datetime.now().strftime("%Y-%m-%d")
    is_live = params["is_current_time"] and date == today

    rows = []

    if is_live:
        now_str  = datetime.now().strftime("%H:%M:%S")
        snapshot = get_database_snapshot(today, now_str)
        rows     = snapshot["rows"]

        if lines:
            rows = [r for r in rows if r["line"] in lines]
        if intent == "alerts":
            rows = [r for r in rows if r["below_threshold"]]

    else:
        rows = query_for_rag(
            date    = date,
            line    = lines[0] if len(lines) == 1 else None,
            product = params["products"][0] if len(params["products"]) == 1 else None,
            phase   = shift,
            time    = time,
            limit   = 15
        )
        if len(lines) > 1:
            rows = [r for r in rows if r["line"] in lines]

    if not rows:
        return "No production data found matching the query parameters.", []

    context_parts = []
    for r in rows:
        bt      = r.get("below_threshold") or r.get("belowThreshold") or False
        status  = "BELOW THRESHOLD" if bt else "On Track"
        achieve = r.get("achieve", 0)

        context_parts.append(
            f"Line {r['line']} ({r.get('product_name', r.get('productName', ''))}) | "
            f"Date: {r['date']} | Time: {r['time']} | "
            f"Phase: {r.get('phase', 'N/A')}\n"
            f"  Plan: {r['plan']} units | "
            f"Target: {r['target']} units | "
            f"Result: {r['result']} units | "
            f"Achieve: {achieve:.1f}% | "
            f"Status: {status}"
        )

    if intent == "summary" or not lines:
        if is_live:
            snap    = get_database_snapshot(today, datetime.now().strftime("%H:%M:%S"))
            summary = snap["summary"]
        else:
            summary = query_day_summary(date) or {}

        if summary:
            context_parts.append(
                f"\nFACTORY TOTAL | Date: {date}\n"
                f"  Total Plan: {summary.get('plan', summary.get('total_plan', 'N/A'))} | "
                f"Total Target: {summary.get('target', summary.get('total_target', 'N/A'))} | "
                f"Total Result: {summary.get('result', summary.get('total_result', 'N/A'))} | "
                f"Avg Achieve: {summary.get('achieve', summary.get('avg_achieve', 0)):.1f}%"
            )

    context = "\n\n".join(context_parts)
    return context, rows


# Call Gemini 
def call_gemini(query_str, context, history=None, is_detailed=False):
    """
    Builds the full prompt and calls Gemini 2.5 Flash using the env key.
    """
    history_text = ""
    if history:
        for turn in history[-6:]:
            role          = "User" if turn["role"] == "user" else "Assistant"
            history_text += f"{role}: {turn['content']}\n"

    detail_instruction = (
        "\nThe user has requested a DETAILED breakdown. "
        "Provide full line-by-line analysis with all numbers."
        if is_detailed else ""
    )

    prompt = f"""
{SYSTEM_PROMPT}
{detail_instruction}

RETRIEVED PRODUCTION DATA:
{context}

CONVERSATION HISTORY:
{history_text}

User: {query_str}
Assistant:""".strip()

    gemini_client = get_client()
    response      = gemini_client.models.generate_content(
        model    = GEMINI_MODEL,
        contents = prompt
    )
    return response.text.strip()


# Main RAG function 
def process_chat(query_str, history=None):
    """Full RAG pipeline entry point."""
    params = extract_query_params(query_str)
    context, rows = retrieve_and_format(params)
    response = call_gemini(
        query_str   = query_str,
        context     = context,
        history     = history or [],
        is_detailed = params["is_detailed"]
    )

    return {
        "response":  response,
        "params":    params,
        "rows_used": len(rows),
        "is_live":   params["is_current_time"],
        "intent":    params["intent"]
    }


# Testing 
if __name__ == "__main__":
    test_queries = [
        "What is the current status of the WMC production lines?",
        "What was the result of CM1 on 2026-05-20 at 3pm?",
        "Will R1 meet today's plan?",
        "Which lines are below threshold right now?",
    ]
    for q in test_queries:
        print(f"\nQuery: {q}")
        print("-" * 60)
        result = process_chat(q)
        print(f"Intent   : {result['intent']}")
        print(f"Live     : {result['is_live']}")
        print(f"Rows     : {result['rows_used']}")
        print(f"Response :\n{result['response']}")
        print("=" * 60)