#!/usr/bin/env python3
"""
Load t400 linkages ONLY for active DLNR (pm_display='1').
Streaming + chunks + workers. Skip already loaded.

Usage:
  python3 load-t400-active.py --workers 6
  python3 load-t400-active.py --workers 4 --dry-run
"""
import psycopg2, subprocess, os, csv, time, sys, argparse, io, tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed

ARCHIVE = '/opt/automecanik/app/.github/SQL-CONVERTED.7z'
WORKDIR = '/opt/automecanik/data/tecdoc/workdir'
PARSER = '/opt/automecanik/app/scripts/tecdoc-mysql-to-csv.py'
CHUNK_SIZE = 50000  # rows per COPY batch

def get_pw():
    with open('/opt/automecanik/app/backend/.env') as f:
        for line in f:
            if line.startswith('SUPABASE_DB_PASSWORD='):
                return line.strip().split('=', 1)[1]
    raise RuntimeError('PW not found')

PW = get_pw()

def get_conn_direct(timeout=600):
    """Direct connection (not pooler) for COPY."""
    conn = psycopg2.connect(
        host='db.cxpojprgwgubzjyqzmoq.supabase.co', port=5432,
        user='postgres', password=PW, dbname='postgres',
        options=f'-c statement_timeout={timeout}s')
    conn.autocommit = True
    return conn

def get_conn_pooler(timeout=300):
    """Pooler connection for queries."""
    conn = psycopg2.connect(
        host='aws-0-eu-west-3.pooler.supabase.com', port=6543,
        user='postgres.cxpojprgwgubzjyqzmoq', password=PW, dbname='postgres',
        options=f'-c statement_timeout={timeout}s')
    conn.autocommit = True
    return conn

def log(msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{ts}] {msg}", flush=True)


def get_active_dlnrs():
    """Get list of active DLNR from DB."""
    conn = get_conn_pooler()
    cur = conn.cursor()
    cur.execute("""
    SELECT sm.dlnr FROM __tecdoc_supplier_mapping sm
    JOIN pieces_marque pm ON pm.pm_id = sm.sup_pm_id AND pm.pm_display = '1'
    ORDER BY sm.dlnr
    """)
    dlnrs = [r[0] for r in cur.fetchall()]
    cur.close()
    conn.close()
    return dlnrs


def get_loaded_dlnrs():
    """Get DLNR already loaded in t400 (direct connection, table is large)."""
    conn = get_conn_direct(timeout=600)
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT col_2::int FROM tecdoc_raw.t400")
    loaded = {r[0] for r in cur.fetchall()}
    cur.close()
    conn.close()
    return loaded


def list_archive_files(table='400'):
    """List files matching table in archive."""
    result = subprocess.run(
        ['7z', 'l', ARCHIVE],
        capture_output=True, text=True, timeout=60
    )
    files = []
    for line in result.stdout.split('\n'):
        line = line.strip()
        if f'{table}.' in line and line.endswith('.sql'):
            parts = line.split()
            fname = parts[-1]
            # Extract DLNR: 400.XXXX.sql -> XXXX
            try:
                dlnr = int(fname.replace(f'{table}.', '').replace('.sql', ''))
                files.append((dlnr, fname))
            except ValueError:
                pass
    return files


def extract_file(fname):
    """Extract a single file from 7z archive."""
    os.makedirs(WORKDIR, exist_ok=True)
    subprocess.run(
        ['7z', 'e', '-y', f'-o{WORKDIR}', ARCHIVE, fname],
        capture_output=True, timeout=120
    )
    return os.path.join(WORKDIR, fname)


def parse_mysql_to_csv(sql_file):
    """Parse MySQL INSERT to CSV using parser script."""
    csv_file = sql_file.replace('.sql', '.csv')
    result = subprocess.run(
        ['python3', PARSER, sql_file, '-o', csv_file],
        capture_output=True, text=True, timeout=600
    )
    if result.returncode != 0:
        log(f"  Parser error: {result.stderr[:200]}")
    return csv_file


T400_COLUMNS = [
    'col_1', 'col_2', 'col_3', 'col_4', 'col_5', 'col_6', 'col_7', 'col_8',
    '_source_filename', '_batch_id', '_loaded_at', '_source_row_no', '_raw_hash'
]

def load_csv_streaming(csv_file, dlnr):
    """Load CSV into t400 using streaming COPY with chunks."""
    if not os.path.exists(csv_file):
        return 0

    conn = get_conn_direct(timeout=600)
    cur = conn.cursor()
    cur.execute('SET search_path TO tecdoc_raw, public')
    total = 0

    try:
        with open(csv_file, 'r') as f:
            reader = csv.reader(f)
            chunk = []

            for row in reader:
                if len(row) >= 8:
                    # Pad to 13 columns if needed (some rows may miss meta cols)
                    while len(row) < 13:
                        row.append('')
                    # Replace empty strings with \N for COPY NULL handling
                    tsv_row = '\t'.join(v if v else '\\N' for v in row[:13])
                    chunk.append(tsv_row)

                if len(chunk) >= CHUNK_SIZE:
                    total += _copy_chunk(cur, chunk)
                    chunk = []

            if chunk:
                total += _copy_chunk(cur, chunk)

    except Exception as e:
        log(f"  ERROR DLNR={dlnr}: {e}")
    finally:
        cur.close()
        conn.close()

    return total


def _copy_chunk(cur, rows):
    """COPY a chunk of rows into t400."""
    buf = io.StringIO('\n'.join(rows) + '\n')
    cur.copy_from(buf, 't400', sep='\t', columns=T400_COLUMNS, null='\\N')
    return len(rows)


def process_dlnr(dlnr, fname, dry_run=False):
    """Process one DLNR: extract → parse → load → cleanup."""
    t0 = time.time()

    if dry_run:
        log(f"  DRY-RUN DLNR={dlnr}: {fname}")
        return dlnr, 0

    try:
        # Extract
        sql_path = extract_file(fname)
        if not os.path.exists(sql_path):
            log(f"  SKIP DLNR={dlnr}: file not found after extract")
            return dlnr, 0

        # Parse
        csv_path = parse_mysql_to_csv(sql_path)
        if not os.path.exists(csv_path):
            log(f"  SKIP DLNR={dlnr}: CSV parse failed")
            return dlnr, 0

        # Load streaming
        count = load_csv_streaming(csv_path, dlnr)

        # Cleanup
        for f in [sql_path, csv_path]:
            if os.path.exists(f):
                os.remove(f)

        elapsed = time.time() - t0
        log(f"  DLNR={dlnr}: +{count:,} rows ({elapsed:.0f}s)")
        return dlnr, count

    except Exception as e:
        log(f"  ERROR DLNR={dlnr}: {e}")
        return dlnr, 0


def main():
    parser = argparse.ArgumentParser(description='Load t400 for active DLNR only')
    parser.add_argument('--workers', type=int, default=4, help='Parallel workers')
    parser.add_argument('--dry-run', action='store_true', help='List what would be loaded')
    args = parser.parse_args()

    log("=== Load t400 linkages — Active DLNR only ===")

    # Step 1: Get active DLNR
    active = set(get_active_dlnrs())
    log(f"  Active DLNR: {len(active)}")

    # Step 2: Get already loaded
    loaded = get_loaded_dlnrs()
    log(f"  Already loaded in t400: {len(loaded)}")

    # Step 3: List archive files
    archive_files = list_archive_files('400')
    log(f"  Files in archive: {len(archive_files)}")

    # Step 4: Filter to active + missing
    to_load = [(dlnr, fname) for dlnr, fname in archive_files
               if dlnr in active and dlnr not in loaded]
    log(f"  To load (active & missing): {len(to_load)}")

    if not to_load:
        log("  Nothing to load!")
        return

    if args.dry_run:
        for dlnr, fname in to_load:
            log(f"  WOULD LOAD: DLNR={dlnr} ({fname})")
        return

    # Step 5: Process with workers
    log(f"  Starting {args.workers} workers...")
    total_rows = 0
    completed = 0

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(process_dlnr, dlnr, fname): dlnr
                   for dlnr, fname in to_load}

        for future in as_completed(futures):
            dlnr, count = future.result()
            total_rows += count
            completed += 1
            if completed % 10 == 0:
                log(f"  Progress: {completed}/{len(to_load)} DLNR, {total_rows:,} rows total")

    log(f"\n=== DONE: {completed} DLNR loaded, {total_rows:,} rows total ===")


if __name__ == '__main__':
    main()
