#!/usr/bin/env python3
"""
Project newly loaded TecDoc data to core tables — v2 (with proper types + error logging).

Phase 1: t203 → pieces_ref_oem (requires index on t203.dlnr)
Phase 2: t231 → graphics_registry + t232 → pieces_media_img
Phase 3: source_linkages → pieces_relation_type
Phase 4: ANALYZE

Usage:
  python3 project-core-v2.py --oem              # Phase 1 only
  python3 project-core-v2.py --images           # Phase 2 only
  python3 project-core-v2.py --linkages         # Phase 3 only
  python3 project-core-v2.py --all              # All phases
  python3 project-core-v2.py --all --workers 8  # 8 parallel workers
"""
import argparse
import psycopg2
import time
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

LOGFILE = '/opt/automecanik/data/tecdoc/logs/project-core-v2.log'
ERRFILE = '/opt/automecanik/data/tecdoc/logs/project-core-v2-errors.log'


def get_pw():
    with open('/opt/automecanik/app/backend/.env') as f:
        for line in f:
            if line.startswith('SUPABASE_DB_PASSWORD='):
                return line.strip().split('=', 1)[1]
    raise RuntimeError('SUPABASE_DB_PASSWORD not found in .env')


PW = get_pw()


def get_conn(timeout_ms=300000):
    return psycopg2.connect(
        host='aws-0-eu-west-3.pooler.supabase.com',
        port=6543,
        user='postgres.cxpojprgwgubzjyqzmoq',
        password=PW,
        dbname='postgres',
        options=f'-c statement_timeout={timeout_ms}'
    )


def get_conn_direct():
    """Direct connection (port 5432, session mode) for long-running queries."""
    conn = psycopg2.connect(
        host='aws-0-eu-west-3.pooler.supabase.com',
        port=5432,
        user='postgres.cxpojprgwgubzjyqzmoq',
        password=PW,
        dbname='postgres'
    )
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute('SET statement_timeout = 0')
    cur.close()
    return conn


def log(msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOGFILE, 'a') as f:
        f.write(line + '\n')


def log_error(msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    with open(ERRFILE, 'a') as f:
        f.write(line + '\n')


def get_dlnrs():
    """Get active DLNR list from supplier mapping."""
    conn = get_conn(30000)
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT dlnr FROM __tecdoc_supplier_mapping WHERE dlnr IS NOT NULL ORDER BY dlnr")
    result = [r[0] for r in cur.fetchall()]
    cur.close()
    conn.close()
    return result


# ============ Phase 1: t203 → pieces_ref_oem ============
def project_oem_chunk(dlnr):
    conn = get_conn(300000)  # 5 min per chunk
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("""
        INSERT INTO pieces_ref_oem (pro_piece_id, pro_prb_id, pro_oem, pro_oem_serach)
        SELECT DISTINCT ON (ar.piece_id, t203.khernr::text, regexp_replace(t203.refnr, '[^A-Za-z0-9]', '', 'g'))
          ar.piece_id::text, t203.khernr::text, t203.refnr,
          regexp_replace(t203.refnr, '[^A-Za-z0-9]', '', 'g')
        FROM tecdoc_raw.t203 t203
        JOIN tecdoc_map.article_registry ar
          ON ar.source_artnr = t203.artnr AND ar.source_dlnr = t203.dlnr::int
        WHERE ar.piece_id IS NOT NULL
          AND t203.losch_flag != 1
          AND t203.dlnr = %s::smallint
        ON CONFLICT (pro_piece_id, pro_prb_id, pro_oem_serach) DO NOTHING
        """, (dlnr,))
        return ('ok', dlnr, cur.rowcount)
    except Exception as e:
        err = str(e).replace('\n', ' ')[:200]
        log_error(f"OEM DLNR={dlnr}: {err}")
        return ('error', dlnr, err)
    finally:
        cur.close()
        conn.close()


def run_oem(workers):
    log("=== Phase 1: t203 → pieces_ref_oem ===")
    dlnrs = get_dlnrs()
    log(f"  {len(dlnrs)} DLNR to project")

    total = 0
    errors = 0
    start = time.monotonic()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(project_oem_chunk, d): d for d in dlnrs}
        done = 0
        for future in as_completed(futures):
            result = future.result()
            done += 1
            if result[0] == 'ok':
                total += result[2]
                if result[2] > 1000:
                    log(f"  DLNR={result[1]}: +{result[2]:,}")
            else:
                errors += 1
                if done <= 5:  # Log first 5 errors inline
                    log(f"  ERROR DLNR={result[1]}: {result[2][:80]}")
            if done % 50 == 0:
                log(f"  Progress: {done}/{len(dlnrs)} (+{total:,} rows, {errors} errors)")

    dur = int(time.monotonic() - start)
    log(f"  OEM DONE: +{total:,} rows, {errors} errors ({dur}s / {dur//60}min)")
    return total


# ============ Phase 2: t232 → pieces_media_img ============
def update_graphics_registry():
    """Insert new t231 entries into graphics_registry."""
    log("  Updating graphics_registry from t231 (direct connection, no timeout)...")
    conn = get_conn_direct()
    cur = conn.cursor()
    try:
        cur.execute("""
        INSERT INTO tecdoc_doc.graphics_registry
          (source_bildnr, source_dlnr, bildname, bildtype, dokumentenart, width, height, source_business_key)
        SELECT DISTINCT ON (bildnr::int, dlnr::int)
          bildnr::int, dlnr::int, bildname, bildtype::smallint, dokumentenart::smallint,
          CASE WHEN breit ~ '^\\d+$' THEN breit::smallint ELSE NULL END,
          CASE WHEN hoch ~ '^\\d+$' THEN hoch::smallint ELSE NULL END,
          encode(digest(concat_ws('|', bildnr, dlnr), 'sha256'), 'hex')
        FROM tecdoc_raw.t231
        WHERE losch_flag != '1'
        ON CONFLICT (source_bildnr, source_dlnr) DO NOTHING
        """)
        log(f"  Graphics registry: +{cur.rowcount:,}")
    finally:
        cur.close()
        conn.close()


def project_img_chunk(dlnr):
    conn = get_conn(300000)
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("""
        INSERT INTO pieces_media_img
          (pmi_piece_id, pmi_pm_id, pmi_folder, pmi_name, pmi_sort, pmi_display, pmi_piece_id_i)
        SELECT ar.piece_id::text, %s::text, '', gr.bildname, t232.sortnr, '1', ar.piece_id
        FROM tecdoc_raw.t232 t232
        JOIN tecdoc_map.article_registry ar
          ON ar.source_artnr = t232.artnr AND ar.source_dlnr = t232.dlnr::int
        JOIN tecdoc_doc.graphics_registry gr
          ON gr.source_bildnr = t232.bildnr::int AND gr.source_dlnr = t232.dlnr::int
        WHERE ar.piece_id IS NOT NULL
          AND t232.losch_flag != '1'
          AND gr.bildname IS NOT NULL
          AND t232.dlnr = %s
        ON CONFLICT (pmi_piece_id, pmi_name) DO NOTHING
        """, (str(dlnr), str(dlnr)))
        return ('ok', dlnr, cur.rowcount)
    except Exception as e:
        err = str(e).replace('\n', ' ')[:200]
        log_error(f"IMG DLNR={dlnr}: {err}")
        return ('error', dlnr, err)
    finally:
        cur.close()
        conn.close()


def run_images(workers):
    log("\n=== Phase 2: t232 → pieces_media_img ===")
    update_graphics_registry()

    dlnrs = get_dlnrs()
    log(f"  {len(dlnrs)} DLNR to project images")

    total = 0
    errors = 0
    start = time.monotonic()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(project_img_chunk, d): d for d in dlnrs}
        done = 0
        for future in as_completed(futures):
            result = future.result()
            done += 1
            if result[0] == 'ok':
                total += result[2]
                if result[2] > 100:
                    log(f"  DLNR={result[1]}: +{result[2]:,} images")
            else:
                errors += 1
                if done <= 5:
                    log(f"  ERROR DLNR={result[1]}: {result[2][:80]}")
            if done % 50 == 0:
                log(f"  Progress: {done}/{len(dlnrs)} (+{total:,} rows, {errors} errors)")

    dur = int(time.monotonic() - start)
    log(f"  IMG DONE: +{total:,} rows, {errors} errors ({dur}s / {dur//60}min)")
    return total


# ============ Phase 3: source_linkages → pieces_relation_type ============
def project_linkage_chunk(dlnr, prefix):
    conn = get_conn(300000)
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("""
        INSERT INTO pieces_relation_type
          (rtp_piece_id, rtp_type_id, rtp_target_kind, rtp_pg_id, rtp_ga_id, rtp_pm_id)
        SELECT DISTINCT ON (ar.piece_id, sl.target_internal_id)
          ar.piece_id, sl.target_internal_id, sl.rtp_target_kind,
          COALESCE(pg.pg_id, 0), sl.source_genartnr, sl.source_dlnr
        FROM tecdoc_map.source_linkages sl
        JOIN tecdoc_map.article_registry ar
          ON ar.source_artnr = sl.source_artnr AND ar.source_dlnr = sl.source_dlnr
        LEFT JOIN pieces_gamme pg ON pg.pg_id = sl.source_genartnr
        WHERE ar.piece_id IS NOT NULL
          AND sl.source_dlnr = %s
          AND left(sl.source_artnr, 3) = %s
        ON CONFLICT (rtp_type_id, rtp_piece_id) DO NOTHING
        """, (dlnr, prefix))
        return ('ok', dlnr, prefix, cur.rowcount)
    except Exception as e:
        err = str(e).replace('\n', ' ')[:200]
        log_error(f"LINK DLNR={dlnr} prefix={prefix}: {err}")
        return ('error', dlnr, prefix, err)
    finally:
        cur.close()
        conn.close()


def run_linkages(workers):
    log("\n=== Phase 3: source_linkages → pieces_relation_type ===")
    conn = get_conn(120000)
    cur = conn.cursor()
    cur.execute("""
    SELECT source_dlnr, left(source_artnr, 3) as prefix, count(*)
    FROM tecdoc_map.source_linkages
    GROUP BY source_dlnr, left(source_artnr, 3)
    ORDER BY count(*) ASC
    """)
    chunks = cur.fetchall()
    cur.close()
    conn.close()
    log(f"  {len(chunks)} chunks to project")

    total = 0
    errors = 0
    start = time.monotonic()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(project_linkage_chunk, dlnr, prefix): (dlnr, prefix)
            for dlnr, prefix, _ in chunks
        }
        done = 0
        for future in as_completed(futures):
            result = future.result()
            done += 1
            if result[0] == 'ok':
                total += result[3]
                if result[3] > 500:
                    log(f"  DLNR={result[1]} prefix={result[2]}: +{result[3]:,}")
            else:
                errors += 1
            if done % 100 == 0:
                log(f"  Progress: {done}/{len(chunks)} (+{total:,} rows, {errors} errors)")

    dur = int(time.monotonic() - start)
    log(f"  LINK DONE: +{total:,} rows, {errors} errors ({dur}s / {dur//60}min)")
    return total


def run_analyze():
    log("\n=== Phase 4: ANALYZE ===")
    conn = get_conn(600000)
    conn.autocommit = True
    cur = conn.cursor()
    for t in ['pieces_ref_oem', 'pieces_media_img', 'pieces_relation_type']:
        s = time.monotonic()
        cur.execute(f"ANALYZE {t}")
        log(f"  ANALYZE {t} ({int((time.monotonic()-s)*1000)}ms)")
    cur.close()
    conn.close()


def main():
    parser = argparse.ArgumentParser(description='TecDoc Core Projector v2')
    parser.add_argument('--oem', action='store_true', help='Phase 1: t203 → pieces_ref_oem')
    parser.add_argument('--images', action='store_true', help='Phase 2: t232 → pieces_media_img')
    parser.add_argument('--linkages', action='store_true', help='Phase 3: linkages → pieces_relation_type')
    parser.add_argument('--analyze', action='store_true', help='Phase 4: ANALYZE')
    parser.add_argument('--all', action='store_true', help='All phases')
    parser.add_argument('--workers', type=int, default=6, help='Parallel workers (default: 6)')
    args = parser.parse_args()

    if not any([args.oem, args.images, args.linkages, args.analyze, args.all]):
        parser.print_help()
        sys.exit(1)

    results = {}

    if args.all or args.oem:
        results['oem'] = run_oem(args.workers)

    if args.all or args.images:
        results['images'] = run_images(args.workers)

    if args.all or args.linkages:
        results['linkages'] = run_linkages(args.workers)

    if args.all or args.analyze:
        run_analyze()

    log("\n=== BILAN FINAL ===")
    for k, v in results.items():
        log(f"  {k}: +{v:,}")
    log("Done.")


if __name__ == '__main__':
    main()
