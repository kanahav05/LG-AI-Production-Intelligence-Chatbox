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
    return conn

# Table creation
def init_db():
    """Creates the production_history table if it doesn't exist."""
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
    conn.commit()
    conn.close()
    print(f"Database initialised at {DB_PATH}")

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