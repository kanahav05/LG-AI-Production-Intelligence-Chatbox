# generator.py
# seed function, phase structure, and interpolation math.

# Products & Lines 
PRODUCTS = {
    "REF":  {"name": "Refrigerator",               "lines": {"R1": 800,  "R2": 700,  "PCB01": 1500, "PCB03": 1500}},
    "WMC":  {"name": "Washing Machine",             "lines": {"W1": 500,  "W2": 450,  "PCB04": 1200}},
    "COMP": {"name": "Compressor",                  "lines": {"CM1": 1000, "CM2": 900}},
    "RAC":  {"name": "Residential Air Conditioner", "lines": {"A1": 600,  "A4": 600,  "PCB02": 1400}},
    "A08":  {"name": "Water Purifier",              "lines": {"WP1": 400}}
}

PHASES = [
    {"id": 1, "name": "Early Morning Shift", "start": 9*60,    "end": 10.5*60, "pct": 0.20},
    {"id": 2, "name": "Peak Day Shift",      "start": 10.5*60, "end": 13.5*60, "pct": 0.40},
    {"id": 0, "name": "Downtime",            "start": 13.5*60, "end": 14*60,   "pct": 0.00},
    {"id": 3, "name": "Afternoon Shift",     "start": 14*60,   "end": 16*60,   "pct": 0.25},
    {"id": 4, "name": "Evening Shift",       "start": 16*60,   "end": 18*60,   "pct": 0.15},
]

ACHIEVE_THRESHOLD = 80

# Line → Product lookup
LINE_TO_PRODUCT = {}
for prod_id, prod_data in PRODUCTS.items():
    for line in prod_data["lines"]:
        LINE_TO_PRODUCT[line] = {"prod_id": prod_id, "name": prod_data["name"]}

# Seed-based random 
def seed_random(seed_string):
    h = 1779033703 ^ len(seed_string)
    for ch in seed_string:
        h = ((h ^ ord(ch)) * 3432918353) & 0xFFFFFFFF
        h = ((h << 13) | (h >> 19)) & 0xFFFFFFFF

    def next_val():
        nonlocal h
        h = ((h ^ (h >> 16)) * 2246822507) & 0xFFFFFFFF
        h = ((h ^ (h >> 13)) * 3266489909) & 0xFFFFFFFF
        h = (h ^ (h >> 16)) & 0xFFFFFFFF
        return h / 4294967296

    return next_val

# Time helpers 
def time_str_to_minutes(time_str):
    """Converts HH:MM or HH:MM:SS to fractional minutes."""
    parts = time_str.split(":")
    h, m = int(parts[0]), int(parts[1])
    s = int(parts[2]) if len(parts) == 3 else 0
    return h * 60 + m + s / 60

def get_phase_name(time_mins):
    if   time_mins < 9*60:    return "Before Shift"
    elif time_mins < 10.5*60: return "Early Morning Shift"
    elif time_mins < 13.5*60: return "Peak Day Shift"
    elif time_mins < 14*60:   return "Downtime"
    elif time_mins < 16*60:   return "Afternoon Shift"
    elif time_mins < 18*60:   return "Evening Shift"
    else:                     return "After Shift"

def is_production_active(time_str):
    mins = time_str_to_minutes(time_str)
    return 9*60 <= mins < 18*60

# Core metrics
def get_line_metrics_at(line, date_str, time_str):
    """
    Returns plan, target, result, achieve for a line
    at a specific date and time. Identical output to db.js.
    """
    prod_info = LINE_TO_PRODUCT.get(line)
    if not prod_info:
        return None

    base_plan = PRODUCTS[prod_info["prod_id"]]["lines"][line]
    rand      = seed_random(f"{date_str}-{line}")

    # ±5% plan variation seeded by date+line
    plan = round(base_plan * (0.95 + rand() * 0.10))

    # Per-phase achievement factors
    ach = {
        1: 0.90 + rand() * 0.12,
        2: 0.92 + rand() * 0.10,
        3: 0.86 + rand() * 0.14,
        4: 0.88 + rand() * 0.12,
    }

    # Phase target and result increments
    t = [0.20*plan, 0.40*plan, 0.25*plan, 0.15*plan]
    r = [t[i] * ach[i+1] for i in range(4)]

    # Phase boundaries in minutes
    p1s  = 9    * 60
    p1e  = 10.5 * 60
    p2e  = 13.5 * 60
    dte  = 14   * 60
    p3e  = 16   * 60
    p4e  = 18   * 60

    mins = time_str_to_minutes(time_str)

    # Interpolate target and result based on current time
    if mins <= p1s:
        target, result = 0, 0
    elif mins <= p1e:
        f = (mins - p1s) / (p1e - p1s)
        target, result = f*t[0], f*r[0]
    elif mins <= p2e:
        f = (mins - p1e) / (p2e - p1e)
        target, result = t[0] + f*t[1], r[0] + f*r[1]
    elif mins <= dte:
        # Downtime — freeze at end of Phase 2
        target, result = t[0]+t[1], r[0]+r[1]
    elif mins <= p3e:
        f = (mins - dte) / (p3e - dte)
        target, result = t[0]+t[1] + f*t[2], r[0]+r[1] + f*r[2]
    elif mins <= p4e:
        f = (mins - p3e) / (p4e - p3e)
        target, result = t[0]+t[1]+t[2] + f*t[3], r[0]+r[1]+r[2] + f*r[3]
    else:
        target, result = plan, sum(r)

    target  = round(target)
    result  = round(result)
    achieve = (result / target * 100) if target > 0 else 0

    return {
        "line":         line,
        "product":      prod_info["prod_id"],
        "product_name": prod_info["name"],
        "date":         date_str,
        "time":         time_str,
        "phase":        get_phase_name(mins),
        "plan":         plan,
        "target":       target,
        "result":       result,
        "achieve":      round(achieve, 2),
        "below_threshold": achieve < ACHIEVE_THRESHOLD and target > 0,
    }

# Full snapshot
def get_database_snapshot(date_str, time_str):
    """Returns all 13 lines + summary row for a given moment."""
    rows         = []
    total_plan   = 0
    total_target = 0
    total_result = 0
    alerts       = []

    for prod_id, prod_data in PRODUCTS.items():
        for line in prod_data["lines"]:
            m = get_line_metrics_at(line, date_str, time_str)
            if not m:
                continue
            rows.append(m)
            total_plan   += m["plan"]
            total_target += m["target"]
            total_result += m["result"]
            if m["below_threshold"]:
                alerts.append({
                    "line":    line,
                    "product": prod_id,
                    "achieve": m["achieve"]
                })

    avg_achieve = round(total_result / total_target * 100, 2) if total_target > 0 else 0

    summary = {
        "line":    "TOTAL",
        "product": "ALL",
        "date":    date_str,
        "time":    time_str,
        "plan":    total_plan,
        "target":  total_target,
        "result":  total_result,
        "achieve": avg_achieve,
    }

    return {"rows": rows, "summary": summary, "alerts": alerts}


if __name__ == "__main__":
    from datetime import datetime
    now      = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S")

    snap = get_database_snapshot(date_str, time_str)
    print(f"Lines    : {len(snap['rows'])}")
    print(f"Summary  : {snap['summary']}")
    print(f"Alerts   : {snap['alerts']}")
    print(f"Sample   : {snap['rows'][0]}")