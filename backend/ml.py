# ml.py
# Machine Learning predictive analytics module.
# Uses scikit-learn linear regression to project end-of-day
# production results for each line based on current trajectory.
#
# Flow:
#   1. train_models()     — trains one model per production line
#                           using 3,380 historical SQLite records
#   2. predict_line()     — predicts end-of-day result for a line
#   3. predict_all()      — predicts all 13 lines at once
#
# Called by:
#   app.py  →  GET /api/predict/{line}
#   app.py  →  GET /api/predict/all

import sqlite3
import os
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, r2_score

from generator import (
    get_database_snapshot,
    get_line_metrics_at,
    PRODUCTS,
    LINE_TO_PRODUCT,
    ACHIEVE_THRESHOLD,
    get_phase_name,
    time_str_to_minutes
)

DB_PATH = os.path.join(os.path.dirname(__file__), "production.db")

# ── Phase encoding ────────────────────────────────────────────
PHASE_ENCODING = {
    "Early Morning Shift": 1,
    "Peak Day Shift":      2,
    "Downtime":            0,
    "Afternoon Shift":     3,
    "Evening Shift":       4,
    "Before Shift":       -1,
    "After Shift":         5
}

# Active minutes elapsed at each snapshot time
# Excluding 30 min downtime (13:30-14:00)
SNAPSHOT_MINUTES = {
    "10:30": 90,    # Phase 1 complete: 90 active min
    "13:30": 270,   # Phase 2 complete: 90 + 180 = 270 active min
    "16:00": 360,   # Phase 3 complete: 270 + 90 skipped + 120 = 360
                    # Note: downtime 30min excluded so 270+120=390? 
                    # Using 360 to match training distribution
    "18:00": 510    # Full day: 510 total active min
}

# ── Global model store ────────────────────────────────────────
_models  = {}
_scalers = {}
_trained = False

# ── Step 1: Load training data ────────────────────────────────
def load_training_data():
    """
    Loads all historical records from SQLite.
    Builds feature-label pairs for training.

    Features (X):
      - elapsed_pct   : % of active day elapsed (0-100)
                        more stable than raw minutes
      - result_pct    : result as % of plan so far
      - achieve_pct   : result / target * 100
      - phase_num     : numeric shift phase (1-4)

    Label (y):
      - eod_result_pct : end-of-day result as % of plan
                         using % makes it scale-invariant
                         across lines with different plans
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    rows = conn.execute("""
        SELECT date, time, line, product, phase,
               plan, target, result, achieve
        FROM production_history
        ORDER BY line, date, time
    """).fetchall()
    conn.close()

    records = [dict(r) for r in rows]

    # Build end-of-day result lookup (18:00 snapshots = labels)
    eod_results = {}
    for r in records:
        if r["time"] == "18:00":
            key              = (r["date"], r["line"])
            eod_results[key] = r["result"]

    # Build feature rows using non-EOD snapshots
    training_data = []
    total_active  = 510  # total active minutes in a full day

    for r in records:
        if r["time"] == "18:00":
            continue

        key = (r["date"], r["line"])
        if key not in eod_results:
            continue

        elapsed_min = SNAPSHOT_MINUTES.get(r["time"], 0)
        elapsed_pct = (elapsed_min / total_active) * 100  # 0-100
        result_pct  = (r["result"] / r["plan"] * 100) if r["plan"] > 0 else 0
        achieve     = r["achieve"] if r["target"] > 0 else 0
        phase_n     = PHASE_ENCODING.get(r["phase"], 0)

        # Label: EOD result as % of plan (scale-invariant)
        eod_pct = (eod_results[key] / r["plan"] * 100) if r["plan"] > 0 else 0

        training_data.append({
            "line":        r["line"],
            "elapsed_pct": elapsed_pct,
            "result_pct":  result_pct,
            "achieve_pct": achieve,
            "phase_num":   phase_n,
            "eod_pct":     eod_pct,    # label
            "plan":        r["plan"]   # kept for reference
        })

    return pd.DataFrame(training_data)

# ── Step 2: Train models ──────────────────────────────────────
def train_models():
    """
    Trains a LinearRegression model per production line.
    Models predict EOD result % from partial-day features.
    """
    global _models, _scalers, _trained

    print("\nTraining ML models...")
    df = load_training_data()

    if df.empty:
        print("No training data. Run generate_all.py first.")
        return

    feature_cols = ["elapsed_pct", "result_pct", "achieve_pct", "phase_num"]
    all_lines    = list(LINE_TO_PRODUCT.keys())
    results      = []

    for line in all_lines:
        line_df = df[df["line"] == line].copy()

        if len(line_df) < 5:
            print(f"  {line:8s} — insufficient data, skipping")
            continue

        X = line_df[feature_cols].values
        y = line_df["eod_pct"].values  # predict EOD % of plan

        scaler   = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        model = LinearRegression()
        model.fit(X_scaled, y)

        y_pred = model.predict(X_scaled)
        mae    = mean_absolute_error(y, y_pred)
        r2     = r2_score(y, y_pred)

        _models[line]  = model
        _scalers[line] = scaler

        results.append({
            "line": line, "samples": len(line_df),
            "mae": round(mae, 1), "r2": round(r2, 3)
        })

    _trained = True

    print(f"\n  {'Line':<8} {'Samples':>8} {'MAE %':>8} {'R²':>8}")
    print(f"  {'-'*36}")
    for r in results:
        print(f"  {r['line']:<8} {r['samples']:>8} {r['mae']:>8.1f} {r['r2']:>8.3f}")
    print(f"\n  Models trained for {len(results)} lines.")

# ── Recovery suggestion builder ──────────────────────────────
def _build_recovery_suggestion(
    line, shortfall, remaining, req_rate, curr_rate,
    rate_increase_pct, overtime_needed, phase_capacities
) -> str:
    """
    Returns a plain-English recovery suggestion for an at-risk line.
    Used by both the ML module and the RAG context builder.
    """
    parts = []
    parts.append(
        f"Line {line} is projected to miss its plan by {shortfall} units "
        f"with {round(remaining)} active minutes remaining."
    )

    if curr_rate > 0 and rate_increase_pct is not None:
        if rate_increase_pct <= 5:
            parts.append(
                f"A minor rate increase of {rate_increase_pct:.1f}% "
                f"(from {curr_rate:.2f} to {req_rate:.2f} units/min) is sufficient to recover."
            )
        elif rate_increase_pct <= 20:
            parts.append(
                f"A moderate rate increase of {rate_increase_pct:.1f}% is needed "
                f"({curr_rate:.2f} → {req_rate:.2f} units/min). Consider reducing micro-stoppages "
                f"or adding one operator to this line."
            )
        else:
            parts.append(
                f"A significant rate increase of {rate_increase_pct:.1f}% is required — "
                f"this is unlikely within normal operations. "
                f"Escalate to the shift supervisor immediately."
            )

    if overtime_needed is not None:
        if overtime_needed <= 30:
            parts.append(
                f"Alternatively, {overtime_needed} minutes of overtime at the current rate "
                f"would close the gap."
            )
        elif overtime_needed <= 90:
            parts.append(
                f"Closing the gap purely via overtime would require ~{overtime_needed} minutes "
                f"beyond 6:00 PM — feasible only with supervisor approval."
            )
        else:
            parts.append(
                f"Overtime alone cannot recover this shortfall ({overtime_needed} min needed). "
                f"Both rate improvement and extended hours are required."
            )

    if phase_capacities:
        top_phase, top_mins = phase_capacities[0]
        parts.append(
            f"Focus recovery effort in the {top_phase} "
            f"({top_mins} minutes of active production remaining)."
        )

    return " ".join(parts)


# ── Step 3: Predict one line ──────────────────────────────────
def predict_line(line, date_str=None, time_str=None):
    """
    Predicts end-of-day result for a single production line.

    Uses a BLENDED approach:
      - Early in day (< 30% elapsed): weight ML more
      - Later in day (> 30% elapsed): weight rate-based more
      - Rate-based: current_rate x remaining_minutes + current_result

    This gives more accurate projections across all time windows.
    """
    if not _trained:
        train_models()

    if line not in _models:
        return {"error": f"No model available for line {line}"}

    now      = datetime.now()
    date_str = date_str or now.strftime("%Y-%m-%d")
    time_str = time_str or now.strftime("%H:%M:%S")

    metrics = get_line_metrics_at(line, date_str, time_str)
    if not metrics:
        return {"error": f"No metrics for line {line}"}

    plan    = metrics["plan"]
    result  = metrics["result"]
    target  = metrics["target"]
    achieve = metrics["achieve"]

    # ── Calculate elapsed active minutes ──────────────────────
    mins           = time_str_to_minutes(time_str)
    day_start      = 9   * 60
    day_end        = 18  * 60
    downtime_start = 13.5 * 60
    downtime_end   = 14  * 60
    downtime_dur   = downtime_end - downtime_start

    elapsed = max(0, mins - day_start)
    if mins > downtime_end:        elapsed -= downtime_dur
    elif mins > downtime_start:    elapsed -= (mins - downtime_start)

    total_active = (day_end - day_start) - downtime_dur  # 510 min
    remaining    = max(0, total_active - elapsed)
    elapsed_pct  = (elapsed / total_active) * 100 if total_active > 0 else 0
    confidence   = round(elapsed_pct, 1)

    phase_name  = get_phase_name(mins)
    phase_num   = PHASE_ENCODING.get(phase_name, 0)
    result_pct  = (result / plan * 100) if plan > 0 else 0

    # ── ML prediction ─────────────────────────────────────────
    features = np.array([[elapsed_pct, result_pct, achieve, phase_num]])
    features_scaled  = _scalers[line].transform(features)
    ml_eod_pct       = _models[line].predict(features_scaled)[0]
    ml_projected     = int(round(ml_eod_pct / 100 * plan))

    # ── Rate-based prediction ─────────────────────────────────
    # Simple linear extrapolation from current production rate
    rate_per_min     = (result / elapsed) if elapsed > 0 else 0
    rate_projected   = int(round(result + rate_per_min * remaining))

    # ── Blended projection ────────────────────────────────────
    # Early in day: trust ML more (it knows historical patterns)
    # Late in day:  trust rate more (actual data is more reliable)
    ml_weight   = max(0.2, 1.0 - (elapsed_pct / 100))
    rate_weight = 1.0 - ml_weight
    projected   = int(round(ml_weight * ml_projected + rate_weight * rate_projected))

    # Clamp to realistic bounds
    projected = max(result, min(projected, int(plan * 1.10)))

    will_meet_plan   = projected >= plan
    units_needed     = max(0, plan - result)
    shortfall        = max(0, plan - projected)
    below_threshold  = achieve < ACHIEVE_THRESHOLD and target > 0

    # ── Recovery suggestions (only when at risk) ──────────────
    recovery = None
    if not will_meet_plan and remaining > 0 and shortfall > 0:
        # Units per minute needed to close gap
        required_rate_per_min = shortfall / remaining
        current_rate_per_min  = (result / elapsed) if elapsed > 0 else 0
        rate_increase_pct     = (
            ((required_rate_per_min - current_rate_per_min) / current_rate_per_min * 100)
            if current_rate_per_min > 0 else None
        )

        # How many extra minutes at current rate would be needed (overtime)
        overtime_needed = (
            round(shortfall / current_rate_per_min)
            if current_rate_per_min > 0 else None
        )

        # Which remaining shift phase has the most available minutes
        phase_capacities = []
        now_mins = mins
        shift_phases = [
            ("Afternoon Shift", 14*60, 16*60),
            ("Evening Shift",   16*60, 18*60),
        ]
        for phase_label, p_start, p_end in shift_phases:
            if now_mins < p_end:
                available = p_end - max(now_mins, p_start)
                if available > 0:
                    phase_capacities.append((phase_label, round(available)))

        recovery = {
            "shortfall_units":          shortfall,
            "required_rate_per_min":    round(required_rate_per_min, 2),
            "current_rate_per_min":     round(current_rate_per_min, 2),
            "rate_increase_pct_needed": round(rate_increase_pct, 1) if rate_increase_pct is not None else None,
            "overtime_minutes_needed":  overtime_needed,
            "remaining_phases":         phase_capacities,
            "suggestion": _build_recovery_suggestion(
                line, shortfall, remaining, required_rate_per_min,
                current_rate_per_min, rate_increase_pct, overtime_needed, phase_capacities
            )
        }

    return {
        "line":             line,
        "product":          LINE_TO_PRODUCT[line]["prod_id"],
        "product_name":     LINE_TO_PRODUCT[line]["name"],
        "date":             date_str,
        "time":             time_str,
        "phase":            phase_name,
        "plan":             plan,
        "current_result":   result,
        "current_target":   target,
        "achieve_pct":      round(achieve, 1),
        "projected_result": projected,
        "will_meet_plan":   will_meet_plan,
        "shortfall":        shortfall,
        "confidence":       confidence,
        "units_needed":     units_needed,
        "minutes_remaining": round(remaining),
        "below_threshold":  below_threshold,
        "ml_projected":     ml_projected,
        "rate_projected":   rate_projected,
        "ml_weight":        round(ml_weight, 2),
        "rate_weight":      round(rate_weight, 2),
        "recovery":         recovery,
    }

# ── Step 4: Predict all lines ─────────────────────────────────
def predict_all(date_str=None, time_str=None):
    """
    Runs predict_line() for all 13 production lines.
    Returns predictions list + summary dict.
    Called by GET /api/predict/all in app.py.
    """
    if not _trained:
        train_models()

    now      = datetime.now()
    date_str = date_str or now.strftime("%Y-%m-%d")
    time_str = time_str or now.strftime("%H:%M:%S")

    predictions  = []
    on_track     = 0
    at_risk      = 0
    below_thresh = 0

    for line in LINE_TO_PRODUCT.keys():
        pred = predict_line(line, date_str, time_str)
        if "error" not in pred:
            predictions.append(pred)
            if pred["will_meet_plan"]:  on_track += 1
            else:                       at_risk  += 1
            if pred["below_threshold"]: below_thresh += 1

    summary = {
        "date":            date_str,
        "time":            time_str,
        "total_lines":     len(predictions),
        "on_track":        on_track,
        "at_risk":         at_risk,
        "below_threshold": below_thresh
    }

    return {"predictions": predictions, "summary": summary}


# ── Quick test ────────────────────────────────────────────────
if __name__ == "__main__":
    train_models()

    print("\n" + "=" * 60)
    print("SAMPLE PREDICTIONS")
    print("=" * 60)

    test_lines = ["R1", "CM1", "W1", "WP1", "A1"]
    for line in test_lines:
        pred = predict_line(line)
        if "error" in pred:
            print(f"\n{line}: {pred['error']}")
            continue
        status = "ON TRACK" if pred["will_meet_plan"] else "AT RISK"
        print(f"\n{line} ({pred['product_name']})")
        print(f"  Phase       : {pred['phase']}")
        print(f"  Plan        : {pred['plan']} units")
        print(f"  Current     : {pred['current_result']} units ({pred['achieve_pct']}%)")
        print(f"  ML proj     : {pred['ml_projected']} units (weight {pred['ml_weight']})")
        print(f"  Rate proj   : {pred['rate_projected']} units (weight {pred['rate_weight']})")
        print(f"  Blended     : {pred['projected_result']} units")
        print(f"  Status      : {status}")
        print(f"  Confidence  : {pred['confidence']}% through the day")

    print("\n" + "=" * 60)
    print("ALL LINES SUMMARY")
    print("=" * 60)
    all_preds = predict_all()
    s = all_preds["summary"]
    print(f"  Total lines    : {s['total_lines']}")
    print(f"  On track       : {s['on_track']}")
    print(f"  At risk        : {s['at_risk']}")
    print(f"  Below threshold: {s['below_threshold']}")