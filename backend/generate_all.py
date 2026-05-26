# generate_all.py
# Run this ONCE to generate all historical production data
# and insert it into SQLite.
# Takes roughly 1-2 minutes to complete.

from datetime import datetime, timedelta
from generator import get_line_metrics_at, PRODUCTS, ACHIEVE_THRESHOLD
from database import init_db, insert_records, get_record_count

# Configuration
# How many months of history to generate
MONTHS_BACK = 3

# Snapshot times - one record per line at end of each shift phase
# These are the "checkpoint" times stored in SQLite
SNAPSHOT_TIMES = [
    "10:30",   # end of Early Morning Shift
    "13:30",   # end of Peak Day Shift
    "16:00",   # end of Afternoon Shift
    "18:00",   # end of Evening Shift
]

#  Date range
end_date   = datetime.today()
start_date = end_date - timedelta(days=MONTHS_BACK * 30)

# Main generation loop
def generate():
    print("Initialising database...")
    init_db()

    # Check if already populated
    existing = get_record_count()
    if existing > 0:
        print(f"Database already has {existing} records.")
        answer = input("Re-generate and replace all data? (y/n): ").strip().lower()
        if answer != "y":
            print("Aborted. Existing data kept.")
            return

        # Clear existing data
        import sqlite3, os
        db_path = os.path.join(os.path.dirname(__file__), "production.db")
        conn    = sqlite3.connect(db_path)
        conn.execute("DELETE FROM production_history")
        conn.commit()
        conn.close()
        print("Existing data cleared.")

    print(f"\nGenerating data from {start_date.date()} to {end_date.date()}...")
    print(f"Snapshot times : {SNAPSHOT_TIMES}")
    print(f"Lines          : 13")
    print(f"Expected records: ~{len(SNAPSHOT_TIMES) * 13 * MONTHS_BACK * 30} \n")

    records   = []
    day       = start_date
    day_count = 0
    skipped   = 0

    while day <= end_date:
        # Skip weekends - factory doesn't run
        if day.weekday() >= 5:
            skipped += 1
            day     += timedelta(days=1)
            continue

        date_str = day.strftime("%Y-%m-%d")

        for time_str in SNAPSHOT_TIMES:
            for prod_id, prod_data in PRODUCTS.items():
                for line in prod_data["lines"]:
                    metrics = get_line_metrics_at(line, date_str, time_str)
                    if not metrics:
                        continue

                    records.append({
                        "date":            date_str,
                        "time":            time_str,
                        "line":            line,
                        "product":         prod_id,
                        "product_name":    prod_data["name"],
                        "phase":           metrics["phase"],
                        "plan":            metrics["plan"],
                        "target":          metrics["target"],
                        "result":          metrics["result"],
                        "achieve":         metrics["achieve"],
                        "below_threshold": 1 if metrics["below_threshold"] else 0,
                    })

        day_count += 1
        day       += timedelta(days=1)

        # Insert in batches of 500 to keep memory usage low
        if len(records) >= 500:
            insert_records(records)
            print(f"  Inserted {get_record_count()} records so far... "
                  f"(processing {date_str})")
            records = []

    # Insert any remaining records
    if records:
        insert_records(records)

    total = get_record_count()
    print(f"\nDone!")
    print(f"  Working days generated : {day_count}")
    print(f"  Weekend days skipped   : {skipped}")
    print(f"  Total records in DB    : {total}")
    print(f"\nDatabase is ready. You can now run app.py.")

if __name__ == "__main__":
    generate()