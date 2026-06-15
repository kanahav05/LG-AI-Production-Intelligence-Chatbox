# database.py
# SQLite setup and all query functions for historical data.
# The production_history table stores one record per line
# per shift snapshot per day.

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "production.db")

# Connection helper
def get_connection():
    """Returns a SQLite connection with row_factory set
    so results come back as dictionaries."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA cache_size=-64000")   # 64MB cache
    conn.execute("PRAGMA temp_store=MEMORY")
    return conn

# Table creation
def init_db():
    """Creates the production_history and troubleshooting tables if they don't exist."""
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS production_history (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            date            TEXT    NOT NULL,
            time            TEXT    NOT NULL,
            line            TEXT    NOT NULL,
            product         TEXT    NOT NULL,
            product_name    TEXT    NOT NULL,
            phase           TEXT    NOT NULL,
            plan            INTEGER NOT NULL,
            target          INTEGER NOT NULL,
            result          INTEGER NOT NULL,
            achieve         REAL    NOT NULL,
            below_threshold INTEGER NOT NULL DEFAULT 0
        )
    """)
    # Index for fast lookups by date, line, product, phase
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_date_line
        ON production_history (date, line)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_date_product
        ON production_history (date, product)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_date_phase
        ON production_history (date, phase)
    """)

    # Troubleshooting tables
    conn.execute("""
        CREATE TABLE IF NOT EXISTS problem_library (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            problem         TEXT    NOT NULL,
            manual_solution TEXT    NOT NULL,
            category        TEXT    NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS resolution_history (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            problem         TEXT    NOT NULL,
            action_taken    TEXT    NOT NULL,
            outcome         TEXT    NOT NULL,
            date            TEXT    NOT NULL
        )
    """)
    conn.commit()
    conn.close()
    
    # Seed troubleshooting database
    seed_troubleshooting_tables()
    print(f"Database initialised at {DB_PATH}")

def seed_troubleshooting_tables():
    PROBLEMS = [
        {"problem": "R1 line conveyor motor overheating", "manual_solution": "Shut down line R1, check cooling fan vents for debris, allow 15 minutes to cool, verify voltage supply is 220V.", "category": "REF"},
        {"problem": "PCB01 soldering machine nozzle clog", "manual_solution": "Run auto-clean cycle on soldering head. If it fails, manual clean with isopropyl alcohol and re-calibrate nozzle height.", "category": "REF"},
        {"problem": "R2 compressor assembly alignment error", "manual_solution": "Check pneumatic clamps alignment, recalibrate the optical sensor on station 4, reset assembly robot arm.", "category": "REF"},
        {"problem": "W1 tub balance test failure rate high", "manual_solution": "Inspect shock absorbers on drum assembly station, verify suspension springs are engaged, calibrate digital balance sensors.", "category": "WMC"},
        {"problem": "PCB04 circuit programmer failure", "manual_solution": "Reboot programming terminal, verify ethernet connection to mainframe, check firmware version mismatch.", "category": "WMC"},
        {"problem": "CM1 helium leak detector false alarms", "manual_solution": "Purge testing chamber, inspect vacuum chamber seals, recalibrate mass spectrometer sensor using standard reference gas.", "category": "COMP"},
        {"problem": "CM2 housing press tonnage low", "manual_solution": "Verify hydraulic fluid levels, check pressure regulator valve settings, inspect cylinder for fluid bypass.", "category": "COMP"},
        {"problem": "A1 copper pipe bender kinking", "manual_solution": "Replace bending mandrel, inspect hydraulic bending arm speed, check copper tube wall thickness specifications.", "category": "RAC"},
        {"problem": "PCB02 SMT placement offsets", "manual_solution": "Clean vision system camera lens, re-run PCB fiducial recognition calibration, verify tape feeder alignment.", "category": "RAC"},
        {"problem": "WP1 filter housing torque out of range", "manual_solution": "Clean capping chuck threads, check pneumatic supply pressure, verify filter o-ring lubricant application.", "category": "A08"}
    ]
    
    RESOLUTIONS = [
        {"problem": "Line R1 motor temperature warning active", "action_taken": "Cleaned debris from cooling fan, verified voltage stability.", "outcome": "Resolved. Temperature stabilized to 45C.", "date": "2026-05-15"},
        {"problem": "PCB01 nozzle clogging frequently", "action_taken": "Cleaned manually with IPA, re-calibrated nozzle height.", "outcome": "Resolved. Solder flow rate returned to normal.", "date": "2026-05-18"},
        {"problem": "W1 imbalance testing failures on shifts", "action_taken": "Adjusted drum alignment clamps, replaced one faulty suspension spring.", "outcome": "Resolved. Failure rate dropped below 1%.", "date": "2026-05-20"},
        {"problem": "WP1 filter capping torque low", "action_taken": "Adjusted pressure to 6.2 bar, applied food-grade silicone grease to o-ring.", "outcome": "Resolved. Torque values verified within 3.2-3.6 Nm.", "date": "2026-05-22"}
    ]

    conn = get_connection()
    # Check if problems are already seeded
    p_count = conn.execute("SELECT COUNT(*) FROM problem_library").fetchone()[0]
    if p_count == 0:
        conn.executemany("""
            INSERT INTO problem_library (problem, manual_solution, category)
            VALUES (:problem, :manual_solution, :category)
        """, PROBLEMS)
    
    r_count = conn.execute("SELECT COUNT(*) FROM resolution_history").fetchone()[0]
    if r_count == 0:
        conn.executemany("""
            INSERT INTO resolution_history (problem, action_taken, outcome, date)
            VALUES (:problem, :action_taken, :outcome, :date)
        """, RESOLUTIONS)
        
    conn.commit()
    conn.close()

def query_problem_library(query: str) -> list[dict]:
    conn = get_connection()
    words = [f"%{w}%" for w in query.split() if len(w) > 2]
    if not words:
        words = [f"%{query}%"]
        
    conditions = []
    params = []
    for w in words:
        conditions.append("(problem LIKE ? OR category LIKE ?)")
        params.extend([w, w])
        
    if not conditions:
        conn.close()
        return []
        
    where_clause = " OR ".join(conditions)
    rows = conn.execute(f"""
        SELECT * FROM problem_library
        WHERE {where_clause}
        LIMIT 5
    """, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def query_resolution_history(query: str) -> list[dict]:
    conn = get_connection()
    words = [f"%{w}%" for w in query.split() if len(w) > 2]
    if not words:
        words = [f"%{query}%"]
        
    conditions = []
    params = []
    for w in words:
        conditions.append("(problem LIKE ? OR action_taken LIKE ? OR outcome LIKE ?)")
        params.extend([w, w, w])
        
    if not conditions:
        conn.close()
        return []
        
    where_clause = " OR ".join(conditions)
    rows = conn.execute(f"""
        SELECT * FROM resolution_history
        WHERE {where_clause}
        LIMIT 5
    """, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# Bulk insert 
def insert_records(records: list[dict]):
    """Inserts a list of record dicts into production_history.
    Used by generate_all.py during the one-time data generation."""
    conn = get_connection()
    conn.executemany("""
        INSERT INTO production_history
            (date, time, line, product, product_name,
             phase, plan, target, result, achieve, below_threshold)
        VALUES
            (:date, :time, :line, :product, :product_name,
             :phase, :plan, :target, :result, :achieve, :below_threshold)
    """, records)
    conn.commit()
    conn.close()

# Record count
def get_record_count():
    conn   = get_connection()
    count  = conn.execute(
        "SELECT COUNT(*) FROM production_history"
    ).fetchone()[0]
    conn.close()
    return count

#  Query: by date and line 
def query_by_date_line(date: str, line: str) -> list[dict]:
    """Returns all snapshots for a specific line on a specific date."""
    conn = get_connection()
    rows = conn.execute("""
        SELECT * FROM production_history
        WHERE date = ? AND line = ?
        ORDER BY time ASC
    """, (date, line)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# Query: by date and product 
def query_by_date_product(date: str, product: str) -> list[dict]:
    """Returns all snapshots for all lines of a product on a date."""
    conn = get_connection()
    rows = conn.execute("""
        SELECT * FROM production_history
        WHERE date = ? AND product = ?
        ORDER BY line ASC, time ASC
    """, (date, product)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# Query: by date and phase 
def query_by_date_phase(date: str, phase: str) -> list[dict]:
    """Returns all line snapshots for a specific shift phase on a date."""
    conn = get_connection()
    rows = conn.execute("""
        SELECT * FROM production_history
        WHERE date = ? AND phase = ?
        ORDER BY line ASC
    """, (date, phase)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# Query: by date, line, and time (closest match) 
def query_closest_snapshot(date: str, line: str, time: str) -> dict | None:
    """Returns the snapshot closest to the requested time
    for a given line and date."""
    conn = get_connection()
    row  = conn.execute("""
        SELECT * FROM production_history
        WHERE date = ? AND line = ?
        ORDER BY ABS(
            (CAST(SUBSTR(time,1,2) AS INTEGER)*60 +
             CAST(SUBSTR(time,4,2) AS INTEGER)) -
            (CAST(SUBSTR(?,1,2) AS INTEGER)*60 +
             CAST(SUBSTR(?,4,2) AS INTEGER))
        ) ASC
        LIMIT 1
    """, (date, line, time, time)).fetchone()
    conn.close()
    return dict(row) if row else None

# Query: day summary (end-of-day totals)
def query_day_summary(date: str) -> dict | None:
    """Returns aggregated totals for an entire day."""
    conn = get_connection()
    row  = conn.execute("""
        SELECT
            date,
            SUM(plan)            AS total_plan,
            SUM(target)          AS total_target,
            SUM(result)          AS total_result,
            AVG(achieve)         AS avg_achieve,
            COUNT(DISTINCT line) AS lines_active,
            SUM(CASE WHEN below_threshold = 1 THEN 1 ELSE 0 END)
                                 AS lines_below_threshold
        FROM production_history
        WHERE date = ?
          AND phase = 'Evening Shift'
    """, (date,)).fetchone()
    conn.close()
    return dict(row) if row else None

#Query: flexible RAG retrieval 
def query_for_rag(
    date:    str  = None,
    line:    str  = None,
    product: str  = None,
    phase:   str  = None,
    time:    str  = None,
    limit:   int  = 10
) -> list[dict]:
    """
    Flexible query used by the RAG pipeline to retrieve
    relevant rows based on whatever parameters were extracted
    from the user's query. Any parameter can be None (ignored).
    """
    conditions = []
    params     = []

    if date:
        conditions.append("date = ?")
        params.append(date)
    if line:
        conditions.append("line = ?")
        params.append(line)
    if product:
        conditions.append("product = ?")
        params.append(product)
    if phase:
        conditions.append("phase = ?")
        params.append(phase)
    if time:
        # Find snapshots within 90 minutes of requested time
        conditions.append("""
                          ABS(
                          (CAST(SUBSTR(time,1,2) AS INTEGER)*60 +
                          CAST(SUBSTR(time,4,2) AS INTEGER)) -
                          (CAST(SUBSTR(?,1,2) AS INTEGER)*60 +
                          CAST(SUBSTR(?,4,2) AS INTEGER))
                          ) <= 90
                          """)
        params.extend([time, time])

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    conn = get_connection()
    rows = conn.execute(f"""
        SELECT * FROM production_history
        {where}
        ORDER BY date DESC, time DESC
        LIMIT ?
    """, params + [limit]).fetchall()
    conn.close()
    return [dict(r) for r in rows]


if __name__ == "__main__":
    init_db()
    print(f"Records in DB : {get_record_count()}")