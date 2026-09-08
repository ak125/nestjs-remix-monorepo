#!/usr/bin/env python3
"""
Load ALL remaining DLNR for ALL supplier-sharded tables.
v3 — complete loading: t200, t204, t207, t209, t210, t211, t212 + tables déjà partielles.
8 workers, cleanup après chaque fichier, skip si déjà chargé.

Usage:
  python3 load-all-suppliers-v3.py                    # toutes les tables
  python3 load-all-suppliers-v3.py --tables 200 211   # tables spécifiques
  python3 load-all-suppliers-v3.py --workers 6        # 6 workers
"""
import psycopg2, subprocess, os, csv, time, sys, argparse
from concurrent.futures import ThreadPoolExecutor, as_completed

ARCHIVE = '/opt/automecanik/app/.github/SQL-CONVERTED.7z'
WORKDIR = '/opt/automecanik/data/tecdoc/workdir'
PARSER = '/opt/automecanik/app/scripts/tecdoc-mysql-to-csv.py'
LOGFILE = '/opt/automecanik/data/tecdoc/logs/load-all-v3.log'
ERRFILE = '/opt/automecanik/data/tecdoc/logs/load-all-v3-errors.log'

# TOUTES les tables shardées par DLNR dans l'archive
ALL_SHARDED_TABLES = [
    '200', '201', '202', '203', '204', '205', '206', '207', '208', '209',
    '210', '211', '212', '213', '215', '217',
    '222', '228', '231', '232', '233',
    '030', '035', '040', '042', '043',
    '400', '401', '403', '404', '410', '432',
]

# Tables prioritaires pour la création de nouvelles pièces
PRIORITY_TABLES = ['200', '211', '210', '204', '207', '209', '212']


def get_pw():
    with open('/opt/automecanik/app/backend/.env') as f:
        for line in f:
            if line.startswith('SUPABASE_DB_PASSWORD='):
                return line.strip().split('=', 1)[1]
    raise RuntimeError('PW not found')


PW = get_pw()


def get_conn():
    return psycopg2.connect(
        host='aws-0-eu-west-3.pooler.supabase.com',
        port=6543,
        user='postgres.cxpojprgwgubzjyqzmoq',
        password=PW,
        dbname='postgres'
    )


def log(msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOGFILE, 'a') as f:
        f.write(line + '\n')


def log_error(msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    with open(ERRFILE, 'a') as f:
        f.write(f"[{ts}] {msg}\n")


def ensure_table_exists(table_id, sample_csv_path):
    """Create table in tecdoc_raw if it doesn't exist, based on CSV column count."""
    conn = get_conn()
    conn.autocommit = True
    cur = conn.cursor()

    # Check if table exists
    cur.execute("""SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'tecdoc_raw' AND table_name = %s""", (f't{table_id}',))
    if cur.fetchone():
        cur.close()
        conn.close()
        return True

    # Table doesn't exist — create with generic columns from CSV
    try:
        with open(sample_csv_path) as f:
            first_row = next(csv.reader(f))
            ncols = len(first_row)

        cols = ', '.join([f'col_{i+1} TEXT' for i in range(ncols)])
        cur.execute(f"CREATE TABLE IF NOT EXISTS tecdoc_raw.t{table_id} ({cols})")
        log(f"  Created tecdoc_raw.t{table_id} ({ncols} columns)")
        cur.close()
        conn.close()
        return True
    except Exception as e:
        log_error(f"CREATE TABLE t{table_id}: {str(e)[:200]}")
        cur.close()
        conn.close()
        return False


def load_one(table_id, dlnr):
    """Extract .sql from archive, parse to CSV, load into DB."""
    dlnr_pad = str(dlnr).zfill(4)
    filename = f"{table_id}.{dlnr_pad}.sql"
    filepath = os.path.join(WORKDIR, filename)
    csvpath = filepath.replace('.sql', '.csv')
    metapath = csvpath.replace('.csv', '.meta')

    try:
        # Extract from archive
        if not os.path.exists(filepath):
            subprocess.run(
                ['7z', 'e', ARCHIVE, filename, f'-o{WORKDIR}/', '-y'],
                capture_output=True, timeout=120
            )
        if not os.path.exists(filepath):
            return ('skip', table_id, dlnr, 0)

        # Parse SQL to CSV
        subprocess.run(
            ['python3', PARSER, filepath, '-o', csvpath],
            capture_output=True, timeout=300
        )
        if not os.path.exists(csvpath):
            return ('skip', table_id, dlnr, 0)

        # Count columns
        with open(csvpath) as f:
            first = next(csv.reader(f))
            ncols = len(first)

        # Ensure table exists
        conn = get_conn()
        conn.autocommit = True
        cur = conn.cursor()

        # Check table exists
        cur.execute("""SELECT count(*) FROM information_schema.tables
            WHERE table_schema = 'tecdoc_raw' AND table_name = %s""", (f't{table_id}',))
        if cur.fetchone()[0] == 0:
            # Create table with correct column count
            cols = ', '.join([f'col_{i+1} TEXT' for i in range(ncols)])
            cur.execute(f"CREATE TABLE IF NOT EXISTS tecdoc_raw.t{table_id} ({cols})")
            log(f"  Auto-created tecdoc_raw.t{table_id} ({ncols} cols)")

        # Load data in batches of 500
        rows = 0
        with open(csvpath) as f:
            batch = []
            for row in csv.reader(f):
                vals = [None if v in ('__PG_NULL__', '') else v for v in row]
                # Pad or truncate to match expected columns
                if len(vals) < ncols:
                    vals.extend([None] * (ncols - len(vals)))
                elif len(vals) > ncols:
                    vals = vals[:ncols]
                batch.append(vals)
                if len(batch) >= 500:
                    ph = ','.join(['%s'] * ncols)
                    args = ','.join(cur.mogrify(f"({ph})", b).decode() for b in batch)
                    cur.execute(f"INSERT INTO tecdoc_raw.t{table_id} VALUES {args}")
                    rows += len(batch)
                    batch = []
            if batch:
                ph = ','.join(['%s'] * ncols)
                args = ','.join(cur.mogrify(f"({ph})", b).decode() for b in batch)
                cur.execute(f"INSERT INTO tecdoc_raw.t{table_id} VALUES {args}")
                rows += len(batch)

        cur.close()
        conn.close()
        return ('ok', table_id, dlnr, rows)
    except Exception as e:
        err = str(e).replace('\n', ' ')[:200]
        log_error(f"t{table_id} DLNR={dlnr}: {err}")
        return ('error', table_id, dlnr, err)
    finally:
        for f in [filepath, csvpath, metapath]:
            if f and os.path.exists(f):
                try:
                    os.remove(f)
                except:
                    pass


def get_loaded_dlnrs(table_id):
    """Get set of already loaded DLNR for a table."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        # Try to find dlnr column
        cur.execute("""SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'tecdoc_raw' AND table_name = %s AND column_name = 'dlnr'""",
            (f't{table_id}',))
        if cur.fetchone():
            cur.execute(f"SELECT DISTINCT CASE WHEN dlnr ~ '^\\d+$' THEN dlnr::int ELSE NULL END FROM tecdoc_raw.t{table_id}")
            result = set(r[0] for r in cur.fetchall() if r[0] is not None)
        else:
            # Check generic column names — dlnr is usually col_2 for most tables
            # For t200: col_2 is dlnr
            cur.execute(f"SELECT DISTINCT CASE WHEN col_2 ~ '^\\d+$' THEN col_2::int ELSE NULL END FROM tecdoc_raw.t{table_id}")
            result = set(r[0] for r in cur.fetchall() if r[0] is not None)
    except Exception:
        conn.rollback()
        result = set()
    cur.close()
    conn.close()
    return result


def get_archive_dlnrs(table_id):
    """Get list of DLNR files available in archive for a table."""
    result = subprocess.run(
        ['7z', 'l', ARCHIVE],
        capture_output=True, text=True, timeout=60
    )
    dlnrs = []
    for line in result.stdout.split('\n'):
        if f'{table_id}.' in line and '.sql' in line:
            fname = line.strip().split()[-1] if line.strip() else ''
            parts = fname.replace('.sql', '').split('.')
            if len(parts) == 2:
                try:
                    dlnrs.append(int(parts[1]))
                except ValueError:
                    pass
    return sorted(set(dlnrs))


def main():
    parser = argparse.ArgumentParser(description='TecDoc Loader v3 — Complete')
    parser.add_argument('--tables', nargs='+', default=None, help='Specific tables to load (e.g., 200 211)')
    parser.add_argument('--workers', type=int, default=8, help='Parallel workers (default: 8)')
    parser.add_argument('--priority-only', action='store_true', help='Load only priority tables (t200, t211, t210, t204, t207, t209, t212)')
    args = parser.parse_args()

    if args.tables:
        tables = args.tables
    elif args.priority_only:
        tables = PRIORITY_TABLES
    else:
        tables = ALL_SHARDED_TABLES

    log(f"=== TecDoc Loader v3 — {len(tables)} tables, {args.workers} workers ===")

    # Get active suppliers
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT dlnr FROM __tecdoc_supplier_mapping WHERE dlnr IS NOT NULL ORDER BY dlnr")
    active_dlnrs = set(r[0] for r in cur.fetchall())
    cur.close()
    conn.close()
    log(f"  Active suppliers: {len(active_dlnrs)}")

    # Build task list
    all_tasks = []
    for t in tables:
        archive_dlnrs = get_archive_dlnrs(t)

        # Check table existence
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'tecdoc_raw' AND table_name = %s""", (f't{t}',))
        table_exists = cur.fetchone() is not None
        cur.close()
        conn.close()

        if table_exists:
            loaded = get_loaded_dlnrs(t)
        else:
            loaded = set()

        # Only load active suppliers that are in archive but not yet loaded
        to_load = [d for d in archive_dlnrs if d in active_dlnrs and d not in loaded]

        if to_load:
            all_tasks.extend([(t, d) for d in to_load])
            log(f"  t{t}: {len(loaded)} loaded, {len(to_load)} to load (archive has {len(archive_dlnrs)})")
        else:
            log(f"  t{t}: complete ✅ ({len(loaded)} loaded)")

    if not all_tasks:
        log("Nothing to load — all tables complete!")
        return

    log(f"\n  Total tasks: {len(all_tasks)} (table, DLNR) pairs")
    log(f"  Running with {args.workers} workers...\n")

    start = time.monotonic()
    total_rows = 0
    total_errors = 0
    total_skips = 0
    completed = 0

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(load_one, t, d): (t, d) for t, d in all_tasks}
        for future in as_completed(futures):
            result = future.result()
            completed += 1
            if result[0] == 'ok':
                total_rows += result[3]
                if result[3] > 10000:
                    log(f"  t{result[1]} DLNR={result[2]}: +{result[3]:,}")
            elif result[0] == 'error':
                total_errors += 1
            elif result[0] == 'skip':
                total_skips += 1

            if completed % 100 == 0:
                elapsed = int((time.monotonic() - start) / 60)
                log(f"  Progress: {completed}/{len(all_tasks)} ({elapsed}min, +{total_rows:,} rows, {total_errors} err, {total_skips} skip)")

    duration = int((time.monotonic() - start) / 60)
    log(f"\n=== DONE ===")
    log(f"  Total tasks: {len(all_tasks)}")
    log(f"  Completed: {completed}")
    log(f"  Rows loaded: {total_rows:,}")
    log(f"  Errors: {total_errors}")
    log(f"  Skips: {total_skips}")
    log(f"  Duration: {duration} minutes")


if __name__ == '__main__':
    main()
