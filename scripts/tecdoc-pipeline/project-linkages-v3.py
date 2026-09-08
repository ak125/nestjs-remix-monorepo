#!/usr/bin/env python3
"""
Project source_linkages → pieces_relation_type for NEW pieces (year=2025).
v3 — Direct connection, by DLNR, no GROUP BY prefix.

Usage:
  python3 project-linkages-v3.py --workers 6
  python3 project-linkages-v3.py --dry-run
"""
import psycopg2, time, sys, argparse
from concurrent.futures import ThreadPoolExecutor, as_completed

def get_pw():
    with open('/opt/automecanik/app/backend/.env') as f:
        for line in f:
            if line.startswith('SUPABASE_DB_PASSWORD='):
                return line.strip().split('=', 1)[1]
    raise RuntimeError('PW not found')

PW = get_pw()

def get_conn_direct(timeout_s=600):
    conn = psycopg2.connect(
        host='db.cxpojprgwgubzjyqzmoq.supabase.co', port=5432,
        user='postgres', password=PW, dbname='postgres')
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(f"SET statement_timeout = '{timeout_s}s'")
    cur.close()
    return conn

def get_conn_pooler(timeout_s=120):
    conn = psycopg2.connect(
        host='aws-0-eu-west-3.pooler.supabase.com', port=6543,
        user='postgres.cxpojprgwgubzjyqzmoq', password=PW, dbname='postgres',
        options=f'-c statement_timeout={timeout_s * 1000}')
    conn.autocommit = True
    return conn

def log(msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{ts}] {msg}", flush=True)


def get_dlnrs_to_project():
    """Get DLNR list from source_linkages that have new pieces."""
    conn = get_conn_pooler(timeout_s=120)
    cur = conn.cursor()
    cur.execute("""
    SELECT DISTINCT sm.dlnr
    FROM __tecdoc_supplier_mapping sm
    JOIN pieces_marque pm ON pm.pm_id = sm.sup_pm_id AND pm.pm_display = '1'
    ORDER BY sm.dlnr
    """)
    dlnrs = [r[0] for r in cur.fetchall()]
    cur.close()
    conn.close()
    return dlnrs


def project_dlnr(dlnr):
    """Project linkages for one DLNR: source_linkages → pieces_relation_type."""
    conn = get_conn_direct(timeout_s=600)
    cur = conn.cursor()
    try:
        cur.execute("""
        INSERT INTO pieces_relation_type
          (rtp_type_id, rtp_piece_id, rtp_pm_id, rtp_pg_id, rtp_pg_pid, rtp_ga_id, rtp_psf_id, rtp_inside, rtp_target_kind)
        SELECT DISTINCT
          sl.source_vknzielnr,
          ar.piece_id,
          p.piece_pm_id,
          p.piece_pg_id,
          p.piece_pg_pid,
          p.piece_ga_id,
          0,
          '0',
          'vehicle_type'
        FROM tecdoc_map.source_linkages sl
        JOIN tecdoc_map.article_registry ar ON ar.source_artnr = sl.source_artnr AND ar.source_dlnr = sl.source_dlnr
        JOIN pieces p ON p.piece_id = ar.piece_id AND p.piece_year = 2025
        JOIN auto_type at2 ON at2.type_id_i = sl.source_vknzielnr
        WHERE sl.source_vknzielart = 2
          AND sl.source_dlnr = %s
        ON CONFLICT DO NOTHING
        """, (dlnr,))
        inserted = cur.rowcount
        return ('ok', dlnr, inserted)
    except Exception as e:
        return ('error', dlnr, str(e)[:200])
    finally:
        cur.close()
        conn.close()


def main():
    parser = argparse.ArgumentParser(description='Project linkages v3')
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    log("=== Project linkages: source_linkages → pieces_relation_type (year=2025) ===")

    dlnrs = get_dlnrs_to_project()
    log(f"  DLNR to project: {len(dlnrs)}")

    if args.dry_run:
        log("  DRY-RUN: would project linkages for all active DLNR")
        return

    total = 0
    errors = 0
    start = time.monotonic()

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(project_dlnr, dlnr): dlnr for dlnr in dlnrs}
        done = 0
        for future in as_completed(futures):
            result = future.result()
            done += 1
            if result[0] == 'ok':
                count = result[2]
                total += count
                if count > 0:
                    log(f"  DLNR={result[1]}: +{count:,}")
            else:
                errors += 1
                log(f"  ERROR DLNR={result[1]}: {result[2]}")
            if done % 20 == 0:
                elapsed = int(time.monotonic() - start)
                log(f"  Progress: {done}/{len(dlnrs)} (+{total:,} rows, {errors} errors, {elapsed}s)")

    dur = int(time.monotonic() - start)
    log(f"\n=== DONE: +{total:,} linkages, {errors} errors ({dur}s / {dur//60}min) ===")


if __name__ == '__main__':
    main()
