#!/usr/bin/env python3
"""
Populate source_linkages from t400 raw — v2 (2026-04-13, fix pollution).

Lien : t400 → tecdoc_map.linkage_target_registry → auto_type → target_internal_id
Filtre : DLNR actifs uniquement (pm_display='1')
Filtre : source_vknzielart = 2 (PKW linkages) — hardcoded dans le WHERE
Filtre : linkage_target_registry.internal_entity_type = 'vehicle_type'
Filtre : auto_type.type_display = '1' (types actifs uniquement)

Changements v2 vs frozen (2026-03-23) :
  - AND t400.col_5 = '2' ajouté dans le WHERE (filtre PKW)
  - target_internal_id devient ltr.internal_id (résolu via LTR), plus de cast
    direct du KTYP brut
  - source_vknzielart figé à 2::smallint, rtp_target_kind figé à 'vehicle_type'
  - business_key recalculé avec '2' hardcodé (plus t400.col_5)
  - Ajout JOIN obligatoire sur linkage_target_registry + auto_type
  - --target-schema optionnel : écrit dans <schema>.source_linkages pour tests
  - --dlnr-only N : ne traite qu'un seul DLNR (tests)

Voir /home/deploy/.claude/plans/swirling-giggling-scott.md §5.A.2 et
.spec/reports/session-a-audit-20260413.md pour le rationnel.

Pré-requis :
  - t400 chargée (load-all-suppliers-v3.py --tables 400)
  - tecdoc_map.linkage_target_registry peuplée (~43k entrées vknzielart=2)
  - auto_type peuplée

Usage:
  python3 populate-source-linkages.v2.py --dry-run
  python3 populate-source-linkages.v2.py --execute
  python3 populate-source-linkages.v2.py --execute --target-schema tecdoc_rebuild --dlnr-only 21
"""
import psycopg2, time, sys, argparse, hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed

LOGFILE = '/opt/automecanik/data/tecdoc/logs/populate-source-linkages.log'


def get_pw():
    with open('/opt/automecanik/app/backend/.env') as f:
        for line in f:
            if line.startswith('SUPABASE_DB_PASSWORD='):
                return line.strip().split('=', 1)[1]
    raise RuntimeError('PW not found')


PW = get_pw()


def get_conn(timeout=600000):
    conn = psycopg2.connect(
        host='aws-0-eu-west-3.pooler.supabase.com', port=6543,
        user='postgres.cxpojprgwgubzjyqzmoq', password=PW, dbname='postgres',
        options=f'-c statement_timeout={timeout}')
    conn.autocommit = True
    return conn


def get_conn_direct(timeout_s=600):
    """Direct connection (port 5432) for long-running queries."""
    conn = psycopg2.connect(
        host='db.cxpojprgwgubzjyqzmoq.supabase.co', port=5432,
        user='postgres', password=PW, dbname='postgres')
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(f'SET statement_timeout = \'{timeout_s}s\'')
    cur.close()
    return conn


def log(msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOGFILE, 'a') as f:
        f.write(line + '\n')


def create_indexes(conn):
    """Create indexes required for the t400→t211 JOIN."""
    cur = conn.cursor()

    log("  Creating index on t400 (col_2, col_4) ...")
    cur.execute("""
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_t400_dlnr_sa
    ON tecdoc_raw.t400 (col_2, col_4)
    """)
    log("  idx_t400_dlnr_sa created ✓")

    log("  Creating index on t211 (dlnr, sa) ...")
    cur.execute("""
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_t211_dlnr_sa
    ON tecdoc_raw.t211 (dlnr, sa)
    """)
    log("  idx_t211_dlnr_sa created ✓")

    cur.close()


def get_active_dlnrs(cur):
    """Get list of active DLNR (pm_display='1')."""
    cur.execute("""
    SELECT DISTINCT sm.dlnr
    FROM __tecdoc_supplier_mapping sm
    JOIN pieces_marque pm ON pm.pm_id = sm.sup_pm_id AND pm.pm_display = '1'
    ORDER BY sm.dlnr
    """)
    return [r[0] for r in cur.fetchall()]


def get_already_loaded_dlnrs(cur):
    """Get DLNR already in source_linkages."""
    cur.execute("SELECT DISTINCT source_dlnr FROM tecdoc_map.source_linkages")
    return {r[0] for r in cur.fetchall()}


TARGET_SCHEMA = 'tecdoc_map'


def populate_dlnr(dlnr):
    """Populate <TARGET_SCHEMA>.source_linkages for one DLNR from t400 + LTR.

    t400 mapping (verified 2026-03-23):
      col_1 = ARTNR, col_2 = DLNR, col_3 = SA (=400),
      col_4 = GENARTNR, col_5 = VKNZIELART, col_6 = VKNZIELNR (KTYP),
      col_7 = LFDNR, col_8 = LOSCH_FLAG
    """
    conn = get_conn_direct(timeout_s=600)
    cur = conn.cursor()
    try:
        cur.execute(f"""
        INSERT INTO {TARGET_SCHEMA}.source_linkages (
            source_artnr, source_dlnr, pg_id_source,
            source_vknzielart, source_vknzielnr_raw, source_vknzielnr,
            target_internal_id, rtp_target_kind,
            deduplicated, source_business_key
        )
        SELECT DISTINCT
            t400.col_1,
            t400.col_2::int,
            COALESCE(NULLIF(t400.col_4, '')::int, 0),
            2::smallint,
            lpad(t400.col_6, 9, '0'),
            t400.col_6::int,
            ltr.internal_id,
            'vehicle_type',
            false,
            encode(digest(concat_ws('|', t400.col_1, t400.col_2, '2', t400.col_6), 'sha256'), 'hex')
        FROM tecdoc_raw.t400 t400
        JOIN tecdoc_map.linkage_target_registry ltr
          ON ltr.vknzielnr = t400.col_6::int
         AND ltr.vknzielart = 2
         AND ltr.internal_entity_type = 'vehicle_type'
        JOIN auto_type at
          ON at.type_id_i = ltr.internal_id
         AND at.type_display = '1'
        WHERE t400.col_2 = %s
          AND t400.col_5 = '2'
          AND t400.col_8 != '1'
        ON CONFLICT DO NOTHING
        """, (str(dlnr),))
        inserted = cur.rowcount
        return ('ok', dlnr, inserted)
    except Exception as e:
        return ('error', dlnr, str(e)[:200])
    finally:
        cur.close()
        conn.close()


def dry_run_dlnr(dlnr):
    """Count how many linkages would be created for one DLNR after LTR+auto_type filter."""
    conn = get_conn(120000)
    cur = conn.cursor()
    try:
        cur.execute("""
        SELECT count(DISTINCT (t400.col_1, t400.col_6))
        FROM tecdoc_raw.t400 t400
        JOIN tecdoc_map.linkage_target_registry ltr
          ON ltr.vknzielnr = t400.col_6::int
         AND ltr.vknzielart = 2
         AND ltr.internal_entity_type = 'vehicle_type'
        JOIN auto_type at
          ON at.type_id_i = ltr.internal_id
         AND at.type_display = '1'
        WHERE t400.col_2 = %s
          AND t400.col_5 = '2'
          AND t400.col_8 != '1'
        """, (str(dlnr),))
        count = cur.fetchone()[0]
        return ('ok', dlnr, count)
    except Exception as e:
        return ('error', dlnr, str(e)[:200])
    finally:
        cur.close()
        conn.close()


def main():
    global TARGET_SCHEMA
    parser = argparse.ArgumentParser(description='Populate source_linkages from t400 raw (v2)')
    parser.add_argument('--dry-run', action='store_true', help='Count only, no writes')
    parser.add_argument('--execute', action='store_true', help='Insert into source_linkages')
    parser.add_argument('--create-indexes', action='store_true', help='Create required indexes first')
    parser.add_argument('--workers', type=int, default=4, help='Number of parallel workers')
    parser.add_argument('--target-schema', type=str, default='tecdoc_map',
                        help='Target schema for source_linkages (default tecdoc_map; use tecdoc_rebuild for sibling tests)')
    parser.add_argument('--dlnr-only', type=int, default=None,
                        help='Process only this DLNR (test mode, bypasses already_loaded filter)')
    args = parser.parse_args()

    if not args.dry_run and not args.execute and not args.create_indexes:
        parser.print_help()
        sys.exit(1)

    TARGET_SCHEMA = args.target_schema
    log(f"=== Populate {TARGET_SCHEMA}.source_linkages from t400 raw (v2) ===")

    if args.create_indexes:
        log("\n--- Creating indexes ---")
        conn = get_conn_direct()
        create_indexes(conn)
        conn.close()
        log("  Indexes done ✓")
        if not args.dry_run and not args.execute:
            return

    conn = get_conn()
    cur = conn.cursor()

    if args.dlnr_only is not None:
        to_process = [args.dlnr_only]
        log(f"  Test mode: processing only DLNR={args.dlnr_only} (bypassing already_loaded check)")
    else:
        active_dlnrs = get_active_dlnrs(cur)
        already_loaded = get_already_loaded_dlnrs(cur) if TARGET_SCHEMA == 'tecdoc_map' else set()
        to_process = [d for d in active_dlnrs if d not in already_loaded]
        log(f"  Active DLNR: {len(active_dlnrs)}, already in {TARGET_SCHEMA}.source_linkages: {len(already_loaded)}, to process: {len(to_process)}")

    cur.close()
    conn.close()

    if not to_process:
        log("  Nothing to do!")
        return

    if args.dry_run:
        log(f"\n--- DRY-RUN: counting linkages for {len(to_process)} DLNR ---")
        total = 0
        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            futures = {executor.submit(dry_run_dlnr, dlnr): dlnr for dlnr in to_process}
            done = 0
            for future in as_completed(futures):
                result = future.result()
                done += 1
                if result[0] == 'ok':
                    total += result[2]
                    if result[2] > 0:
                        log(f"    DLNR={result[1]}: {result[2]:,} linkages")
                else:
                    log(f"    DLNR={result[1]}: ERROR {result[2]}")
                if done % 20 == 0:
                    log(f"  Progress: {done}/{len(to_process)} ({total:,} total)")
        log(f"\n  DRY-RUN TOTAL: {total:,} linkages for {len(to_process)} DLNR")
        return

    if args.execute:
        log(f"\n--- EXECUTE: populating source_linkages for {len(to_process)} DLNR ---")
        total = 0
        errors = 0
        start = time.monotonic()
        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            futures = {executor.submit(populate_dlnr, dlnr): dlnr for dlnr in to_process}
            done = 0
            for future in as_completed(futures):
                result = future.result()
                done += 1
                if result[0] == 'ok':
                    total += result[2]
                    if result[2] > 0:
                        log(f"    DLNR={result[1]}: +{result[2]:,}")
                else:
                    errors += 1
                    log(f"    DLNR={result[1]}: ERROR {result[2]}")
                if done % 20 == 0:
                    elapsed = int((time.monotonic() - start) / 60)
                    log(f"  Progress: {done}/{len(to_process)} (+{total:,} total, {errors} errors, {elapsed}min)")

        elapsed = int((time.monotonic() - start) / 60)
        log(f"\n=== BILAN ===")
        log(f"  DLNR processed: {len(to_process)}")
        log(f"  Linkages inserted: {total:,}")
        log(f"  Errors: {errors}")
        log(f"  Time: {elapsed} minutes")


if __name__ == '__main__':
    main()
