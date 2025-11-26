import csv
from datetime import datetime
from posthog import Posthog

# 🔴 FILL THESE IN FROM POSTHOG PROJECT SETTINGS 🔴
API_KEY = "phc_qqnC2GxyAyGUtGYrpKLKYn2ChAXAJE5YpLpljkAILFK"
HOST = "https://us.i.posthog.com"  # or "https://eu.i.posthog.com"

posthog = Posthog(API_KEY, host=HOST, debug=True)  # debug=True prints upload info


def parse_timestamp(ts: str | None):
    if not ts:
        return None
    ts = ts.strip()
    try:
        if ts.endswith("Z"):
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return datetime.fromisoformat(ts)
    except Exception:
        return None


def import_csv(path: str):
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        total = 0
        sent = 0

        for row in reader:
            total += 1
            event = row.pop("event", None)
            distinct_id = row.pop("distinct_id", None)
            raw_ts = row.pop("timestamp", None)
            ts = parse_timestamp(raw_ts)

            if not event or not distinct_id:
                print(f"[SKIP] Row {total}: missing event or distinct_id")
                continue

            props = row

            print(f"[SENDING] Row {total}: event={event}, distinct_id={distinct_id}, ts={ts}, props={props}")

            try:
                posthog.capture(
                    distinct_id=distinct_id,
                    event=event,
                    properties=props,
                    timestamp=ts,
                )
                sent += 1
            except Exception as e:
                print(f"[ERROR] Row {total}: {e}")

        posthog.flush()
        print(f"✅ Done. Read {total} rows, successfully sent {sent} events.")


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python scripts/import_posthog_csv.py <csv_path>")
        raise SystemExit(1)
    import_csv(sys.argv[1])
