#!/usr/bin/env python3
"""Standalone script to load ALL remaining DLNR for all supplier-sharded tables."""
import psycopg2, subprocess, os, csv, time, sys
from concurrent.futures import ThreadPoolExecutor, as_completed

ARCHIVE = '/opt/automecanik/app/.github/SQL-CONVERTED.7z'
WORKDIR = '/opt/automecanik/data/tecdoc/workdir'
PARSER = '/opt/automecanik/app/scripts/tecdoc-mysql-to-csv.py'
LOGFILE = '/opt/automecanik/data/tecdoc/logs/load-all-suppliers.log'

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
            reader = csv.reader(f)
            batch = []
            for row in reader:
                vals = [None if v in ('__PG_NULL__', '') else v for v in row]
                batch.append(vals)
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
        for f in [filepath, csvpath]:
            if f and os.path.exists(f):
                os.remove(f)
        meta = csvpath.replace('.csv', '.meta') if csvpath else None
        if meta and os.path.exists(meta):
            os.remove(meta)

def main():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT dlnr FROM __tecdoc_supplier_mapping WHERE dlnr IS NOT NULL AND mapping_confidence = 'high' ORDER BY dlnr")
    all_dlnr = [r[0] for r in cur.fetchall()]
    log(f"Active DLNR: {len(all_dlnr)}")

    TABLES = ['035', '042', '043', '203', '205', '206', '222', '228', '231', '232', '233']
    todo = {}
    for t in TABLES:
        try:
            cur.execute(f"SELECT DISTINCT CASE WHEN dlnr ~ '^\\d+$' THEN dlnr::int ELSE NULL END FROM tecdoc_raw.t{t}")
            loaded = set(r[0] for r in cur.fetchall() if r[0])
        except:
            conn.rollback()
            loaded = set()
        missing = [d for d in all_dlnr if d not in loaded]
        if missing:
            todo[t] = missing
            log(f"  t{t}: {len(loaded)} loaded, {len(missing)} remaining")
        else:
            log(f"  t{t}: all loaded ✅")
    cur.close()
    conn.close()

    grand_total = 0
    for table_id, missing in todo.items():
        start = time.monotonic()
        table_total = 0
        errors = 0
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(load_one, table_id, dlnr): dlnr for dlnr in missing}
            for future in as_completed(futures):
                result = future.result()
                if result[0] == 'ok':
                    table_total += result[3]
                elif result[0] == 'error':
                    errors += 1
        duration = int((time.monotonic() - start) * 1000)
        grand_total += table_total
        log(f"  t{table_id}: +{table_total:,} rows, {errors} errors ({duration}ms)")

    log(f"\nGrand total: {grand_total:,}")
    log("Done.")

if __name__ == '__main__':
    main()
