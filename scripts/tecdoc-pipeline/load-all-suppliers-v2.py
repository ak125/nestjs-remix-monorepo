#!/usr/bin/env python3
"""Load ALL remaining DLNR — tables + DLNR en parallele, 8 workers total."""
import psycopg2, subprocess, os, csv, time, sys
from concurrent.futures import ThreadPoolExecutor, as_completed

ARCHIVE = '/opt/automecanik/app/.github/SQL-CONVERTED.7z'
WORKDIR = '/opt/automecanik/data/tecdoc/workdir'
PARSER = '/opt/automecanik/app/scripts/tecdoc-mysql-to-csv.py'
LOGFILE = '/opt/automecanik/data/tecdoc/logs/load-all-v2.log'

def get_conn():
    with open('/opt/automecanik/app/backend/.env') as f:
        for line in f:
            if line.startswith('SUPABASE_DB_PASSWORD='):
                pw = line.strip().split('=',1)[1]
    return psycopg2.connect(f'postgresql://postgres.cxpojprgwgubzjyqzmoq:{pw}@aws-0-eu-west-3.pooler.supabase.com:6543/postgres')

def log(msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOGFILE, 'a') as f:
        f.write(line + '\n')

def load_one(table_id, dlnr):
    dlnr_pad = str(dlnr).zfill(4)
    filename = f"{table_id}.{dlnr_pad}.sql"
    filepath = os.path.join(WORKDIR, filename)
    csvpath = filepath.replace('.sql', '.csv')
    metapath = csvpath.replace('.csv', '.meta')
    try:
        if not os.path.exists(filepath):
            subprocess.run(['7z', 'e', ARCHIVE, filename, f'-o{WORKDIR}/', '-y'], capture_output=True, timeout=120)
        if not os.path.exists(filepath):
            return ('skip', table_id, dlnr, 0)
        subprocess.run(['python3', PARSER, filepath, '-o', csvpath], capture_output=True, timeout=300)
        if not os.path.exists(csvpath):
            return ('skip', table_id, dlnr, 0)
        with open(csvpath) as f:
            first = next(csv.reader(f))
            ncols = len(first)
        c = get_conn()
        c.autocommit = True
        cu = c.cursor()
        rows = 0
        with open(csvpath) as f:
            batch = []
            for row in csv.reader(f):
                batch.append([None if v in ('__PG_NULL__', '') else v for v in row])
                if len(batch) >= 500:
                    ph = ','.join(['%s'] * ncols)
                    args = ','.join(cu.mogrify(f"({ph})", b).decode() for b in batch)
                    cu.execute(f"INSERT INTO tecdoc_raw.t{table_id} VALUES {args}")
                    rows += len(batch)
                    batch = []
            if batch:
                ph = ','.join(['%s'] * ncols)
                args = ','.join(cu.mogrify(f"({ph})", b).decode() for b in batch)
                cu.execute(f"INSERT INTO tecdoc_raw.t{table_id} VALUES {args}")
                rows += len(batch)
        cu.close()
        c.close()
        return ('ok', table_id, dlnr, rows)
    except Exception as e:
        return ('error', table_id, dlnr, str(e)[:80])
    finally:
        for f in [filepath, csvpath, metapath]:
            if f and os.path.exists(f):
                try: os.remove(f)
                except: pass

def main():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT dlnr FROM __tecdoc_supplier_mapping WHERE dlnr IS NOT NULL AND mapping_confidence = 'high' ORDER BY dlnr")
    all_dlnr = [r[0] for r in cur.fetchall()]
    log(f"Active DLNR: {len(all_dlnr)}")

    TABLES = ['035', '042', '043', '203', '205', '206', '222', '228', '231', '232', '233']
    
    # Build ALL tasks (table, dlnr) across ALL tables
    all_tasks = []
    for t in TABLES:
        try:
            cur.execute(f"SELECT DISTINCT CASE WHEN dlnr ~ '^\\d+$' THEN dlnr::int ELSE NULL END FROM tecdoc_raw.t{t}")
            loaded = set(r[0] for r in cur.fetchall() if r[0])
        except:
            conn.rollback()
            loaded = set()
        missing = [d for d in all_dlnr if d not in loaded]
        if missing:
            for d in missing:
                all_tasks.append((t, d))
            log(f"  t{t}: {len(loaded)} loaded, {len(missing)} remaining")
        else:
            log(f"  t{t}: all loaded ✅")
    
    cur.close()
    conn.close()
    
    log(f"\nTotal tasks: {len(all_tasks)} (table, DLNR) pairs")
    log(f"Running with 8 workers...\n")
    
    # Process ALL tasks with 8 workers in parallel
    start = time.monotonic()
    total_rows = 0
    total_errors = 0
    completed = 0
    
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(load_one, t, d): (t, d) for t, d in all_tasks}
        for future in as_completed(futures):
            result = future.result()
            completed += 1
            if result[0] == 'ok':
                total_rows += result[3]
            elif result[0] == 'error':
                total_errors += 1
            
            # Log every 100 completed
            if completed % 100 == 0:
                elapsed = int((time.monotonic() - start) / 60)
                log(f"  Progress: {completed}/{len(all_tasks)} ({elapsed}min, +{total_rows:,} rows, {total_errors} errors)")
    
    duration = int((time.monotonic() - start) / 60)
    log(f"\n=== DONE ===")
    log(f"  Total tasks: {len(all_tasks)}")
    log(f"  Completed: {completed}")
    log(f"  Rows loaded: {total_rows:,}")
    log(f"  Errors: {total_errors}")
    log(f"  Duration: {duration} minutes")

if __name__ == '__main__':
    main()
